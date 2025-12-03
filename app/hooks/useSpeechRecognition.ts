// src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useRef } from "react";

const KEYWORD_CORRECTIONS: Record<string, string> = {
  "ran pót": "RunPod", "run pót": "RunPod", "ran pod": "RunPod",
  "ai": "AI", "ây ai": "AI",
  "chat gpt": "ChatGPT", "chát gpt": "ChatGPT",
  "api": "API", "ây pi ai": "API",
  "next js": "Next.js", "nếch ji ét": "Next.js",
  "ri át": "React",
  "gemini": "Gemini", "gê mi ni": "Gemini"
};

const normalizeText = (text: string): string => {
  let normalized = text.toLowerCase();
  Object.keys(KEYWORD_CORRECTIONS).forEach((key) => {
    const regex = new RegExp(`\\b${key}\\b`, "gi");
    normalized = normalized.replace(regex, KEYWORD_CORRECTIONS[key]);
  });
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export default function useSpeechRecognition() {
  const [text, setText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);

  const isListeningRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onSegmentEndRef = useRef<((segment: string) => void) | null>(null);
  const textRef = useRef("");
  const isLineBreakPending = useRef(false);

  // [MỚI] Bộ đệm để tích trữ các câu ngắn
  const pendingBufferRef = useRef(""); 

  useEffect(() => { textRef.current = text; }, [text]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // @ts-ignore
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) { setHasSupport(false); return; }
      setHasSupport(true);

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "vi-VN";

      recognition.onresult = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        isLineBreakPending.current = false; 

        let currentInterim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const raw = event.results[i][0].transcript.trim();
            const clean = normalizeText(raw);
            
            setText((prev) => {
                if (prev.endsWith("\n") || prev === "") return prev + "- " + clean;
                const prefix = prev.trim().length > 0 ? " " : "- "; 
                return prev + prefix + clean;
            });
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        setInterimText(currentInterim);

        silenceTimerRef.current = setTimeout(() => {
           handleSilenceDetected(); 
        }, 1500); 
      };
      
      recognition.onerror = (event: any) => { 
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
              console.warn("Mic warning:", event.error); 
          }
      };
      
      recognition.onend = () => { 
          if (isListeningRef.current) {
              try { recognition.start(); } catch (e) {}
          }
      };

      recognitionRef.current = recognition;
    }
    
    return () => {
        if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []); 

  // [LOGIC CẢI TIẾN]
  const handleSilenceDetected = () => {
    const currentText = textRef.current.trim();
    if (!currentText || isLineBreakPending.current) return;

    // 1. Cập nhật UI (Chấm câu & Xuống dòng)
    setText(prev => {
        let trimmed = prev.trim();
        if (!/[.!?]$/.test(trimmed) && !trimmed.endsWith('\n')) {
            trimmed += ".";
        }
        return trimmed + "\n";
    });
    isLineBreakPending.current = true;

    // 2. Logic Tóm tắt thông minh (Dùng Buffer)
    const segments = currentText.split("\n");
    // Lấy đoạn vừa mới nói xong (chưa có trong buffer)
    let lastSegment = segments[segments.length - 1]; 
    
    // Làm sạch: bỏ dấu gạch đầu dòng
    lastSegment = lastSegment.replace(/^- /, "").trim();

    if (!lastSegment) return;

    // CỘNG DỒN VÀO BUFFER
    // Nếu buffer đang có dữ liệu, thêm dấu cách trước khi nối
    if (pendingBufferRef.current) {
        pendingBufferRef.current += " " + lastSegment;
    } else {
        pendingBufferRef.current = lastSegment;
    }

    console.log("Current Buffer:", pendingBufferRef.current);

    // 3. Kiểm tra độ dài Buffer
    // Nếu tổng tích lũy > 50 ký tự thì mới gửi đi tóm tắt
    if (pendingBufferRef.current.length > 30 && onSegmentEndRef.current) {
         console.log("🚀 Buffer đủ lớn, gửi đi tóm tắt...");
         onSegmentEndRef.current(pendingBufferRef.current);
         
         // Gửi xong thì Reset buffer sạch sẽ
         pendingBufferRef.current = "";
    } else {
        console.log("⏳ Buffer còn ngắn, chờ câu tiếp theo...");
    }
  };

  const startListening = (onSegmentEnd?: (seg: string) => void) => {
    if (!recognitionRef.current) return;
    try {
      setInterimText("");
      if (onSegmentEnd) onSegmentEndRef.current = onSegmentEnd;
      
      isListeningRef.current = true;
      setIsListening(true);
      
      recognitionRef.current.start();
    } catch (e) {}
  };

  // [MỚI] Hàm xóa sạch văn bản thủ công
  const resetTranscript = () => {
      setText("");
      setInterimText("");
      pendingBufferRef.current = "";
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      isListeningRef.current = false;
      setIsListening(false);
      
      // [QUAN TRỌNG] Khi bấm dừng, nếu trong buffer còn sót chữ nào (dù ngắn) cũng gửi nốt
      if (pendingBufferRef.current && pendingBufferRef.current.length > 0 && onSegmentEndRef.current) {
          onSegmentEndRef.current(pendingBufferRef.current);
          pendingBufferRef.current = "";
      }

      recognitionRef.current.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } catch (e) {}
  };

  return { text, interimText, isListening, startListening, stopListening, hasSupport,resetTranscript };
}