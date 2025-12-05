import { useState, useRef, useEffect } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

// Định nghĩa kiểu dữ liệu cho UI
export type TranscriptSegment = {
  speaker: number;
  content: string;
  isFinal: boolean;
};

// Định nghĩa kiểu dữ liệu cho Callback Logic (Tóm tắt)
type OnFinalCallback = (data: { speaker: number; content: string }) => void;

// Hàm nối chuỗi thông minh (xử lý dấu câu)
const smartConcat = (prev: string, next: string) => {
    const cleanNext = next.trim();
    if (!prev) return cleanNext;
    // Nếu từ mới bắt đầu bằng dấu câu, không thêm dấu cách
    if (/^[.,!?;:]/.test(cleanNext)) return prev + cleanNext;
    return prev + " " + cleanNext;
};

export default function useDeepgram(onFinal?: OnFinalCallback) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimContent, setInterimContent] = useState<string>(""); 
  const [isListening, setIsListening] = useState(false);
  const [preFetchedKey, setPreFetchedKey] = useState<string | null>(null);
  
  const deepgramLiveRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isSessionActive = useRef(false);
  
  // Hàng đợi âm thanh để xử lý độ trễ lúc bắt đầu
  const audioQueueRef = useRef<Blob[]>([]); 

  // Hàm lấy Key chạy ngầm
  const fetchNewKey = async () => {
    try {
      fetch("/api/deepgram")
        .then(res => res.json())
        .then(data => {
            if(data.key) {
                console.log("🔑 Đã nạp key mới sẵn sàng");
                setPreFetchedKey(data.key);
            }
        })
        .catch(e => console.error("Lỗi nạp key ngầm:", e));
    } catch (e) {}
  };

  useEffect(() => {
    fetchNewKey();
    return () => stopListening();
  }, []);

  const handleTranscript = (data: any) => {
    const received = data.channel.alternatives[0];
    const transcript = received.transcript;
    
    // Bỏ qua nếu text rỗng
    if (!transcript || transcript.trim().length === 0) return;

    const isFinal = data.is_final;

    if (isFinal) {
      const speaker = received.words?.[0]?.speaker ?? 0;
      
      // [QUAN TRỌNG] Gửi dữ liệu thô ra ngoài để xử lý Logic Tóm tắt
      if (onFinal) {
          onFinal({ speaker, content: transcript.trim() });
      }

      // [UI LOGIC] Cập nhật giao diện (Nối chuỗi cho đẹp)
      setInterimContent("");
      setSegments((prev) => {
        const lastSegment = prev[prev.length - 1];
        // Nếu cùng người nói -> Gộp vào đoạn cũ
        if (lastSegment && lastSegment.speaker === speaker) {
            return [
                ...prev.slice(0, -1), 
                { ...lastSegment, content: smartConcat(lastSegment.content, transcript) }
            ];
        }
        // Khác người nói -> Tạo dòng mới
        return [...prev, { speaker, content: transcript.trim(), isFinal: true }];
      });
    } else {
      setInterimContent(transcript);
    }
  };

  const startListening = async (stream: MediaStream) => {
    isSessionActive.current = true;
    setIsListening(true);
    audioQueueRef.current = []; // Reset hàng đợi

    // 1. Bắt đầu thu âm NGAY LẬP TỨC (Zero Latency)
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        if (deepgramLiveRef.current && deepgramLiveRef.current.getReadyState() === 1) {
            // Nếu đã kết nối -> Gửi luôn
            deepgramLiveRef.current.send(event.data);
        } else {
            // Nếu chưa kết nối -> Lưu tạm vào hàng đợi
            audioQueueRef.current.push(event.data);
        }
      }
    });
    mediaRecorder.start(250);
    mediaRecorderRef.current = mediaRecorder;

    try {
      // 2. Lấy Key (nếu chưa có thì gọi fetch)
      let key = preFetchedKey;
      if (!key) {
         const res = await fetch("/api/deepgram");
         const data = await res.json();
         key = data.key;
      }

      if (!isSessionActive.current) return; // User đã bấm Stop trong lúc chờ
      if (!key) {
        console.error("❌ Không lấy được API Key");
        setIsListening(false);
        return;
      }

      // 3. Kết nối Deepgram
      const deepgram = createClient(key);
      const dgSocket = deepgram.listen.live({
        model: "nova-3",
        language: "vi", 
        smart_format: true, 
        diarize: true,      
        interim_results: true,
        // Cấu hình nhạy: 500ms ngắt câu, 1000ms chốt cứng
        endpointing: 500, 
        utterance_end_ms: 1000,
        filler_words: true, 
      });

      dgSocket.on(LiveTranscriptionEvents.Open, () => {
        if (!isSessionActive.current) {
            dgSocket.finish();
            return;
        }
        console.log("✅ Deepgram Connected!");

        // 4. Xả hàng đợi (Gửi bù âm thanh đã thu lúc chờ)
        if (audioQueueRef.current.length > 0) {
            console.log(`🚀 Gửi bù ${audioQueueRef.current.length} gói tin...`);
            audioQueueRef.current.forEach(blob => dgSocket.send(blob));
            audioQueueRef.current = [];
        }
      });

      dgSocket.on(LiveTranscriptionEvents.Transcript, handleTranscript);
      dgSocket.on(LiveTranscriptionEvents.Error, (err) => console.error("DG Error:", err));
      
      deepgramLiveRef.current = dgSocket;

    } catch (error) {
      console.error("Lỗi khởi động:", error);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    isSessionActive.current = false;
    setIsListening(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (deepgramLiveRef.current) {
      try {
          if(deepgramLiveRef.current.getReadyState() === 1) {
              deepgramLiveRef.current.finish();
          }
      } catch(e) {}
      deepgramLiveRef.current = null;
    }
    
    audioQueueRef.current = [];
    fetchNewKey(); // Nạp key mới cho lần sau
  };
  
  const resetTranscript = () => {
      setSegments([]);
      setInterimContent("");
  };

  return { segments, interimContent, isListening, startListening, stopListening, resetTranscript };
}