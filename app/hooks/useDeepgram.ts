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

// Hàm nối chuỗi thông minh
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
  const [isConnecting, setIsConnecting] = useState(false); // Trạng thái đang kết nối
  
  const deepgramLiveRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isSessionActive = useRef(false);
  const apiKeyRef = useRef<{ key: string, expires: number } | null>(null);

  // 1. Hàng đợi âm thanh (Queue)
  const audioQueueRef = useRef<Blob[]>([]); 

  // 2. Biến theo dõi thời gian để cắt đoạn
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const shouldMergeRef = useRef<boolean>(false);
  const isInterimActiveRef = useRef(false);

  const handleTranscript = (data: any) => {
    const received = data.channel.alternatives[0];
    const transcript = received.transcript;
    
    if (!transcript || transcript.trim().length === 0) return;

    const now = Date.now();

    // Logic: Nếu đang im lặng mà có chữ mới -> Check xem đã im lặng bao lâu
    if (!isInterimActiveRef.current) {
        const silenceGap = now - lastSpeechTimeRef.current;
        shouldMergeRef.current = silenceGap < 2000; // Dưới 2s thì nối
    }
    lastSpeechTimeRef.current = now;

    const isFinal = data.is_final;
    const speakerId = received.words?.[0]?.speaker ?? 0;

    if (isFinal) {
        setInterimContent(""); 
        isInterimActiveRef.current = false; 

        setSegments(prev => {
            const lastSeg = prev[prev.length - 1];

            // Điều kiện nối: 
            // 1. Cờ Merge bật (do nói liền mạch)
            // 2. Cùng Speaker (Quan trọng với Deepgram)
            // 3. Có đoạn trước đó
            const isMergeable = shouldMergeRef.current && 
                              lastSeg && 
                              lastSeg.speaker === speakerId;

            if (isMergeable) {
                return [
                    ...prev.slice(0, -1),
                    {
                        ...lastSeg,
                        content: mergeText(lastSeg.content, transcript.trim()),
                        lastUpdate: now
                    }
                ];
            } else {
                return [
                    ...prev,
                    {
                        id: now,
                        speaker: speakerId,
                        content: transcript.trim(),
                        isFinal: true,
                        lastUpdate: now
                    }
                ];
            }
        });

        if (onFinal) {
            onFinal({ speaker: speakerId, content: transcript.trim() });
        }

    } else {
        setInterimContent(transcript);
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
    
    setIsConnecting(true); // Báo UI đang kết nối
    isSessionActive.current = true;
    
    // [QUAN TRỌNG] Bắt đầu thu âm vào Queue ngay lập tức
    audioQueueRef.current = [];
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        // Nếu Socket đã mở -> Gửi luôn
        if (deepgramLiveRef.current && deepgramLiveRef.current.getReadyState() === 1) {
            deepgramLiveRef.current.send(event.data);
        } else {
            // Nếu chưa -> Cất vào kho
            audioQueueRef.current.push(event.data);
        }
      }
    });
    mediaRecorder.start(100);
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
        endpointing: 300, 
        utterance_end_ms: 1000,
      });

      dgSocket.on(LiveTranscriptionEvents.Open, () => {
          console.log("🟢 Deepgram Connected");
          setIsConnecting(false);
          setIsListening(true);
          
          lastSpeechTimeRef.current = Date.now();
          isInterimActiveRef.current = false;

          // [XẢ HÀNG] Gửi bù toàn bộ hàng tồn kho
          if (audioQueueRef.current.length > 0) {
              console.log(`🚀 Sending ${audioQueueRef.current.length} buffered chunks...`);
              audioQueueRef.current.forEach(blob => dgSocket.send(blob));
              audioQueueRef.current = []; 
          }
      });

      dgSocket.on(LiveTranscriptionEvents.Transcript, handleTranscript);
      
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
  
  const resetTranscript = () => { setSegments([]); setInterimContent(""); };

  useEffect(() => { return () => stopListening(); }, []);

  return { segments, interimContent, isListening, isConnecting, startListening, stopListening, resetTranscript };
}