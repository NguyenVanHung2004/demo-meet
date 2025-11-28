// src/hooks/useSpeechRecognition.ts
import { useState, useEffect, useRef } from "react";

export default function useSpeechRecognition() {
  const [text, setText] = useState("");
  
  // [MỚI] State chứa chữ đang nói dở (chưa chốt)
  const [interimText, setInterimText] = useState(""); 
  
  const [isListening, setIsListening] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);
  const recognitionRef = useRef<any>(null);

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
      recognition.interimResults = true; // [QUAN TRỌNG] Bắt buộc là true
      recognition.lang = "vi-VN";

      recognition.onresult = (event: any) => {
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            // Nếu câu đã chốt -> Cộng vào text chính
            setText((prev) => prev + " " + event.results[i][0].transcript);
          } else {
            // Nếu đang nói dở -> Cộng vào interim
            currentInterim += event.results[i][0].transcript;
          }
        }
        
        // Cập nhật text tạm thời ra ngoài
        setInterimText(currentInterim);
      };

      recognition.onerror = (event: any) => { /* ... giữ nguyên ... */ };
      recognition.onend = () => { /* ... giữ nguyên ... */ };

      recognitionRef.current = recognition;
    }
  }, []); // Bỏ isListening ra khỏi dependency để tránh re-init liên tục

  const startListening = () => {
    if (!recognitionRef.current) return;
    try {
      setText(""); 
      setInterimText(""); // Reset text tạm
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {}
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (e) {}
  };

  // [MỚI] Trả về thêm interimText
  return { 
    text, 
    interimText, // <--- Xuất cái này ra
    isListening, 
    startListening, 
    stopListening, 
    hasSupport 
  };
}