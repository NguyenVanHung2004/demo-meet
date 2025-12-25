import { useState, useRef, useEffect } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { Word } from "../lib/mockData";
export type TranscriptSegment = {
  speaker: number;
  content: string;
  isFinal: boolean;
  words?: Word[];
};

type OnFinalCallback = (data: { speaker: number; content: string }) => void;

// [FIX QUAN TRỌNG] Hàm nối chuỗi có khử trùng lặp (De-duplication)
const mergeText = (prev: string, next: string) => {
    const p = prev.trim();
    const n = next.trim();

    if (!p) return n;
    if (!n) return p;

    // 1. CHỐNG LẶP: Nếu câu mới bắt đầu y hệt câu cũ -> Lấy câu mới (vì nó đầy đủ hơn)
    // Ví dụ: Prev="Hôm nay", Next="Hôm nay tôi đi" -> Result="Hôm nay tôi đi"
    if (n.startsWith(p)) {
        return n;
    }

    // 2. CHỐNG LẶP ĐUÔI: Nếu đuôi câu cũ trùng với đầu câu mới
    // Ví dụ: Prev="...ABC", Next="ABC..." -> Result="...ABC..."
    // Quét tối đa 20 ký tự cuối để check overlap
    const overlapMax = Math.min(p.length, n.length, 20);
    for (let i = overlapMax; i > 0; i--) {
        const suffix = p.slice(-i);
        const prefix = n.slice(0, i);
        if (suffix === prefix) {
            // Tìm thấy điểm trùng -> Nối phần còn thiếu của next vào prev
            return p + n.slice(i);
        }
    }

    // 3. Nối bình thường (Xử lý dấu câu)
    if (/^[.,!?;:]/.test(n)) return p + n;
    return p + " " + n;
};

export default function useDeepgram(onFinal?: OnFinalCallback) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimContent, setInterimContent] = useState<string>(""); 
  const [isListening, setIsListening] = useState(false);
  
  const [preFetchedKey, setPreFetchedKey] = useState<{ key: string, createdAt: number } | null>(null);
  
  const deepgramLiveRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isSessionActive = useRef(false);
  const audioQueueRef = useRef<Blob[]>([]); 
  const lastInterimRef = useRef<{ content: string, speaker: number }>({ content: "", speaker: 0 });

  const fetchNewKey = async () => {
    try {
      fetch("/api/deepgram")
        .then(res => res.json())
        .then(data => {
            if(data.key) {
                console.log("🔑 Đã nạp key mới sẵn sàng");
                setPreFetchedKey({ key: data.key, createdAt: Date.now() });
            }
        })
        .catch(e => console.error("Lỗi nạp key ngầm:", e));
    } catch (e) {}
  };

  useEffect(() => { fetchNewKey(); return () => stopListening(); }, []);
  const offsetTimeRef = useRef(0);
  const handleTranscript = (data: any) => {
    const received = data.channel.alternatives[0];
    const transcript = received.transcript;
    const isFinal = data.is_final;

    if (!isFinal && transcript && transcript.trim().length > 0) {
        lastInterimRef.current = { 
            content: transcript, 
            speaker: received.words?.[0]?.speaker ?? 0 
        };
        setInterimContent(transcript);
    }

    const words = (received.words || []).map((w: any) => ({
        ...w,
        start: w.start + offsetTimeRef.current, // Cộng thời gian cũ vào
        end: w.end + offsetTimeRef.current
    }));

    if (isFinal) {
      let finalContent = transcript;
      let finalSpeaker = received.words?.[0]?.speaker ?? 0;

      // Logic Cứu hộ (Rescue)
      if ((!finalContent || finalContent.trim().length === 0) && lastInterimRef.current.content.length > 0) {
          if (lastInterimRef.current.content.trim().length > 1) {
             finalContent = lastInterimRef.current.content;
             finalSpeaker = lastInterimRef.current.speaker;
          }
      }

      setInterimContent("");
      lastInterimRef.current = { content: "", speaker: 0 };

      if (!finalContent || finalContent.trim().length === 0) return;

      if (onFinal) {
          onFinal({ speaker: finalSpeaker, content: finalContent.trim() });
      }

      setSegments((prev) => {
        const lastSegment = prev[prev.length - 1];
        
        // Nếu cùng Speaker -> Gộp
        if (lastSegment && lastSegment.speaker === finalSpeaker) {
            return [
                ...prev.slice(0, -1), 
                { 
                    ...lastSegment, 
                    // [FIX] Dùng hàm mergeText thay vì smartConcat cũ
                    content: mergeText(lastSegment.content, finalContent),
                    words: (lastSegment.words || []).concat(words)
                }
            ];
        }
        return [...prev, { speaker: finalSpeaker, content: finalContent.trim(), isFinal: true,words: words }];
      });
    }
  };

  const startListening = async (stream: MediaStream,startTimeOffset: number = 0) => {
    offsetTimeRef.current = startTimeOffset;
    isSessionActive.current = true;
    setIsListening(true);
    audioQueueRef.current = []; 

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        if (deepgramLiveRef.current && deepgramLiveRef.current.getReadyState() === 1) {
            deepgramLiveRef.current.send(event.data);
        } else {
            audioQueueRef.current.push(event.data);
        }
      }
    });
    
    // Gửi gói tin nhỏ 100ms để bắt nhịp nhanh
    mediaRecorder.start(100);
    mediaRecorderRef.current = mediaRecorder;

    try {
      let keyToUse = null;
      if (preFetchedKey) {
          const age = Date.now() - preFetchedKey.createdAt;
          if (age < 55 * 60 * 1000) keyToUse = preFetchedKey.key;
      }

      if (!keyToUse) {
         const res = await fetch("/api/deepgram");
         const data = await res.json();
         keyToUse = data.key;
         setPreFetchedKey({ key: data.key, createdAt: Date.now() });
      }

      if (!isSessionActive.current || !keyToUse) {
        setIsListening(false);
        return;
      }

      const deepgram = createClient(keyToUse);
      const dgSocket = deepgram.listen.live({
        model: "nova-3",
        language: "vi", 
        smart_format: true, 
        diarize: true,      
        interim_results: true,
        endpointing: 1000, 
        utterance_end_ms: 1000,
        filler_words: true, 
      });

      dgSocket.on(LiveTranscriptionEvents.Open, () => {
        if (!isSessionActive.current) { dgSocket.finish(); return; }
        
        if (audioQueueRef.current.length > 0) {
            audioQueueRef.current.forEach(blob => dgSocket.send(blob));
            audioQueueRef.current = []; 
        }
      });

      dgSocket.on(LiveTranscriptionEvents.Transcript, handleTranscript);
      dgSocket.on(LiveTranscriptionEvents.Error, (err) => console.error("DG Error:", err));
      
      deepgramLiveRef.current = dgSocket;

    } catch (error) { setIsListening(false); }
  };

  const stopListening = () => {
    isSessionActive.current = false;
    setIsListening(false);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    try { deepgramLiveRef.current?.finish(); } catch(e) {}
    deepgramLiveRef.current = null;
    fetchNewKey();
  };
  
  const resetTranscript = () => { setSegments([]); setInterimContent(""); };

  return { segments, interimContent, isListening, startListening, stopListening, resetTranscript };
}