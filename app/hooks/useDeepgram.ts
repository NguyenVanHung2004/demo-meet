import { useState, useRef, useEffect } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export type LiveSegment = {
  id: number;
  speaker: number;
  content: string;
  isFinal: boolean;
  lastUpdate: number;
};

type OnFinalCallback = (data: { speaker: number; content: string }) => void;

const mergeText = (prev: string, next: string) => {
    const p = prev.trim();
    const n = next.trim();
    if (!p) return n;
    if (!n) return p;
    if (n.startsWith(p)) return n;
    if (/[.!?]$/.test(p)) return p + " " + n;
    return p + " " + n;
};

export default function useDeepgram(onFinal?: OnFinalCallback) {
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [interimContent, setInterimContent] = useState<string>(""); 
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const deepgramLiveRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isSessionActive = useRef(false);
  const apiKeyRef = useRef<{ key: string, expires: number } | null>(null);
  
  // [QUAN TRỌNG] Dùng Ref để lưu interim mới nhất, giúp event listener truy cập được
  const interimRef = useRef<string>("");
  const curSpeakerRef = useRef<number>(0);

  const audioQueueRef = useRef<Blob[]>([]); 
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const shouldMergeRef = useRef<boolean>(false);
  const isInterimActiveRef = useRef(false);

  // Hàm save segment dùng chung cho cả Transcript Final và UtteranceEnd
  const finalizeSegment = (text: string, speaker: number, now: number) => {
      if (!text.trim()) return;

      setSegments(prev => {
          const lastSeg = prev[prev.length - 1];
          // Logic nối câu nếu im lặng < 2s
          if (!isInterimActiveRef.current) {
               const silenceGap = now - lastSpeechTimeRef.current;
               shouldMergeRef.current = silenceGap < 2000; 
          }
          
          const isMergeable = shouldMergeRef.current && 
                            lastSeg && 
                            lastSeg.speaker === speaker;

          if (isMergeable) {
              return [
                  ...prev.slice(0, -1),
                  {
                      ...lastSeg,
                      content: mergeText(lastSeg.content, text),
                      lastUpdate: now
                  }
              ];
          } else {
              return [
                  ...prev,
                  {
                      id: now,
                      speaker: speaker,
                      content: text,
                      isFinal: true,
                      lastUpdate: now
                  }
              ];
          }
      });

      if (onFinal) onFinal({ speaker, content: text });
      
      // Reset state sau khi finalize
      setInterimContent("");
      interimRef.current = "";
      isInterimActiveRef.current = false;
      lastSpeechTimeRef.current = now;
  };

  const handleTranscript = (data: any) => {
    // Check an toàn
    if (!data.channel?.alternatives?.[0]) return;

    const received = data.channel.alternatives[0];
    const transcript = received.transcript;
    
    if (!transcript) return; // Không trim() vội để giữ format nếu cần

    const now = Date.now();
    const isFinal = data.is_final;
    const speakerId = received.words?.[0]?.speaker ?? 0;

    if (isFinal) {
        finalizeSegment(transcript.trim(), speakerId, now);
    } else {
        // [QUAN TRỌNG] Cập nhật cả State và Ref
        setInterimContent(transcript);
        interimRef.current = transcript;
        curSpeakerRef.current = speakerId;
        
        isInterimActiveRef.current = true;
    }
  };

  const getApiKey = async () => {
      if (apiKeyRef.current && apiKeyRef.current.expires > Date.now()) {
          return apiKeyRef.current.key;
      }
      try {
          const res = await fetch("/api/deepgram");
          const data = await res.json();
          if (data.key) {
              apiKeyRef.current = { key: data.key, expires: Date.now() + 50 * 60 * 1000 };
              return data.key;
          }
      } catch (e) {
          console.error("Key Error:", e);
      }
      return null;
  };

  const startListening = async (stream: MediaStream) => {
    if (isListening || isConnecting) return;
    setIsConnecting(true); 
    isSessionActive.current = true;
    audioQueueRef.current = [];

    const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 24000 // Tối ưu băng thông cực mạnh 
    });
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        if (deepgramLiveRef.current && deepgramLiveRef.current.getReadyState() === 1) {
            deepgramLiveRef.current.send(event.data);
        } else {
            audioQueueRef.current.push(event.data);
        }
      }
    });
    mediaRecorder.start(200);
    mediaRecorderRef.current = mediaRecorder;

    try {
      const key = await getApiKey();
      if (!key) throw new Error("No Key");

      const deepgram = createClient(key);
      const dgSocket = deepgram.listen.live({
        model: "nova-2",
        language: "vi", 
        smart_format: true, 
        diarize: true,      
        interim_results: true,
        endpointing: 500,     // Tăng lên 500ms cho chắc
        utterance_end_ms: 1000, // Im lặng 1s sẽ bắn sự kiện UtteranceEnd
      });

      dgSocket.on(LiveTranscriptionEvents.Open, () => {
          console.log("🟢 Deepgram Connected");
          setIsConnecting(false);
          setIsListening(true);
          
          lastSpeechTimeRef.current = Date.now();
          isInterimActiveRef.current = false;
          interimRef.current = ""; // Reset ref

          if (audioQueueRef.current.length > 0) {
              audioQueueRef.current.forEach(blob => dgSocket.send(blob));
              audioQueueRef.current = []; 
          }
      });

      dgSocket.on(LiveTranscriptionEvents.Transcript, handleTranscript);

      // [FIX CHÍNH] Lắng nghe sự kiện UtteranceEnd để cứu chữ bị treo
      dgSocket.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          console.log("🛑 Utterance End Detected");
          if (interimRef.current && interimRef.current.trim().length > 0) {
              console.log("💾 Flushing stuck interim:", interimRef.current);
              finalizeSegment(interimRef.current.trim(), curSpeakerRef.current, Date.now());
          }
      });
      
      const handleError = () => {
          setIsListening(false);
          setIsConnecting(false);
          if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      };
      
      dgSocket.on(LiveTranscriptionEvents.Error, handleError);
      dgSocket.on(LiveTranscriptionEvents.Close, handleError);

      deepgramLiveRef.current = dgSocket;

    } catch (error) { 
        console.error(error);
        setIsConnecting(false);
        setIsListening(false);
        mediaRecorder.stop();
    }
  };

  const stopListening = () => {
    isSessionActive.current = false;
    setIsListening(false);
    setIsConnecting(false);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    try { deepgramLiveRef.current?.finish(); } catch(e) {}
    deepgramLiveRef.current = null;
  };
  
  const resetTranscript = () => { 
      setSegments([]); 
      setInterimContent(""); 
      interimRef.current = ""; 
  };

  useEffect(() => { return () => stopListening(); }, []);

  return { segments, interimContent, isListening, isConnecting, startListening, stopListening, resetTranscript };
}