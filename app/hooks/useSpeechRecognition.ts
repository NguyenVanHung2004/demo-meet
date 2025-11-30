// src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useRef } from "react";

export default function useSpeechRecognition() {
  const [text, setText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);
  
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onSegmentEndRef = useRef<((segment: string) => void) | null>(null);
  
  // [FIX] Tạo Ref để lưu trữ text mới nhất, giúp đọc được trong setTimeout mà không cần dùng setText callback
  const textRef = useRef(""); 

  // Đồng bộ textRef mỗi khi text thay đổi
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setHasSupport(false);
        return;
      }
      setHasSupport(true);

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "vi-VN";

      recognition.onresult = (event: any) => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        let currentInterim = "";
        let hasFinal = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalText = event.results[i][0].transcript.trim();
            setText((prev) => prev + " " + finalText);
            hasFinal = true;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        setInterimText(currentInterim);

        // Reset timer im lặng
        silenceTimerRef.current = setTimeout(() => {
           handleSilenceDetected(); 
        }, 1500); // Gộp logic lại check 1 lần ở mốc 1.5s cho gọn
      };
      
      recognition.onerror = (event: any) => { 
          // Nếu lỗi là do mình tự stop (aborted) thì bỏ qua, không in ra cho đỡ rác console
          if (event.error === 'aborted') return;
          if (event.error === 'no-speech') {
              console.warn("⚠️ Phát hiện im lặng (no-speech), sẽ tự bật lại...");
              return; 
          }
          
          console.error("Speech Recognition Error:", event.error); 
      };
      recognition.onend = () => { 
          // [FIX 1] Clear text tạm để giao diện sạch sẽ
          setInterimText(""); 

          // [FIX 2] Delay nhẹ rồi mới bật lại để tránh lỗi trình duyệt bị "sốc"
          setTimeout(() => {
              if (isListening) {
                  try {
                    recognition.start(); 
                  } catch (e) {
                    console.log("Re-start error ignored:", e);
                  }
              }
          }, 200); 
      };

      recognitionRef.current = recognition;
    }
  }, [isListening]);

  // [FIX] Logic xử lý im lặng tách biệt hoàn toàn
  const handleSilenceDetected = () => {
    // 1. Lấy text hiện tại từ Ref (không dùng state trực tiếp để tránh closure cũ)
    const currentText = textRef.current.trim();
    if (!currentText) return;

    // 2. Kiểm tra xem câu đã kết thúc chưa
    if (currentText.endsWith("\n\n")) return;

    // 3. Cắt segment cuối cùng
    const lastNewLineIndex = currentText.lastIndexOf("\n\n");
    const newSegment = currentText.substring(lastNewLineIndex + 1).trim();

    // 4. [QUAN TRỌNG] Gọi callback Ở NGOÀI hàm setText
    if (newSegment.length > 10 && onSegmentEndRef.current) {
         onSegmentEndRef.current(newSegment);
    }

    // 5. Sau đó mới update UI (thêm xuống dòng)
    setText(prev => {
        const trimmed = prev.trim();
        return trimmed.endsWith('.') ? trimmed + "\n\n" : trimmed + ".\n\n";
    });
  };

  const startListening = (onSegmentEnd?: (seg: string) => void) => {
    if (!recognitionRef.current) return;
    try {

      setInterimText("");
      if (onSegmentEnd) onSegmentEndRef.current = onSegmentEnd;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {}
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } catch (e) {}
  };

  return { text, interimText, isListening, startListening, stopListening, hasSupport };
}