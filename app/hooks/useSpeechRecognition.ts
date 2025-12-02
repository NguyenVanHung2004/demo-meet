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

  // Ref lưu text mới nhất
  const textRef = useRef("");
  // [NEW] Ref lưu mốc thời gian lần cuối tóm tắt (hoặc lúc bắt đầu)
  const lastSummaryTimeRef = useRef<number>(0);

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
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalText = event.results[i][0].transcript.trim();
            setText((prev) => prev + " " + finalText);
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        setInterimText(currentInterim);

        // Reset timer im lặng (1s)
        silenceTimerRef.current = setTimeout(() => {
           handleSilenceDetected(); 
        }, 1000); 
      };
      
      recognition.onerror = (event: any) => { 
          if (event.error === 'aborted') return;
          if (event.error === 'no-speech') {
              console.warn("⚠️ Phát hiện im lặng (no-speech), sẽ tự bật lại...");
              return; 
          }
          console.error("Speech Recognition Error:", event.error); 
      };

      recognition.onend = () => { 
          setInterimText(""); 
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

  // [MODIFIED] Logic xử lý im lặng + Check 20s
  const handleSilenceDetected = () => {
    const currentText = textRef.current.trim();
    if (!currentText) return;

    // 1. Kiểm tra thời gian trôi qua từ lần tóm tắt cuối
    const now = Date.now();
    const timeDiff = now - lastSummaryTimeRef.current;
    
    // Nếu chưa đủ 20 giây: Chỉ thêm dấu chấm (nếu chưa có) để câu văn đẹp, NHƯNG KHÔNG CẮT ĐOẠN
    if (timeDiff < 20000) {
        setText(prev => {
            const trimmed = prev.trim();
            // Nếu đã kết thúc bằng dấu chấm hoặc xuống dòng thì thôi, không thì thêm chấm
            if (trimmed.endsWith('.') || trimmed.endsWith('\n\n')) return trimmed;
            return trimmed + "."; 
        });
        return; // THOÁT HÀM, chờ lần im lặng tiếp theo
    }

    // --- Dưới đây là logic khi ĐÃ ĐỦ 20 giây ---

    // 2. Kiểm tra xem đoạn này đã từng xử lý chưa (tránh lặp)
    if (currentText.endsWith("\n\n")) return;

    // 3. Cắt segment cuối cùng (tính từ dấu xuống dòng gần nhất)
    const lastNewLineIndex = currentText.lastIndexOf("\n\n");
    // Lấy toàn bộ text từ lần cắt trước đến nay
    const newSegment = currentText.substring(lastNewLineIndex + 1).trim();

    // 4. Gọi callback summary
    if (newSegment.length > 10 && onSegmentEndRef.current) {
         onSegmentEndRef.current(newSegment);
         
         // [NEW] Cập nhật lại mốc thời gian sau khi đã gửi tóm tắt thành công
         lastSummaryTimeRef.current = Date.now();
    }

    // 5. Update UI: Thêm xuống dòng để đánh dấu hết 1 đoạn (block)
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
      
      // [NEW] Reset mốc thời gian khi bắt đầu nghe
      lastSummaryTimeRef.current = Date.now();
      
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