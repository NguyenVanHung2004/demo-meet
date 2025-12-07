import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

// Định nghĩa dữ liệu server trả về
type TranscriptData = {
  text: string;
  isFinal: boolean;
  speaker: number | string;
};

// Callback bắn text ra ngoài để tóm tắt
type OnSegmentEndCallback = (text: string) => void;

export default function useGoogleCloud(onSegmentEnd?: OnSegmentEndCallback) {
  const [transcript, setTranscript] = useState(""); // Text hiển thị
  const [interimText, setInterimText] = useState(""); // Chữ xám
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Logic Cổ Điển: Buffer + Timer Im Lặng
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBufferRef = useRef(""); 

  // URL Server Socket (Đổi thành domain Render nếu đã deploy)
  // Ví dụ: "https://my-socket-server.onrender.com"
  const SERVER_URL = "https://meeting-socket-server.onrender.com"; 

  // Hàm xử lý "Cắt đoạn" khi im lặng
  const handleSilenceDetected = () => {
      const buffer = pendingBufferRef.current.trim();
      
      // Chỉ tóm tắt nếu đoạn văn đủ dài (> 30 ký tự ~ 1 câu hoàn chỉnh)
      if (buffer.length > 30 && onSegmentEnd) {
          console.log("✂️ Google: Cắt đoạn tóm tắt:", buffer);
          onSegmentEnd(buffer);
          pendingBufferRef.current = ""; // Xả buffer sau khi gửi
      }
  };

  const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // Chờ 2 giây im lặng là chốt đơn (Logic phù hợp với Google trả về cả câu)
      silenceTimerRef.current = setTimeout(handleSilenceDetected, 2000);
  };

  const startListening = async (stream: MediaStream) => {
    try {
      if (isListening) return;
      
      setIsListening(true);
      streamRef.current = stream;
      pendingBufferRef.current = "";

      // 1. Kết nối Socket.IO (Bắt buộc dùng websocket transport để ổn định)
      const socket = io(SERVER_URL, { 
          transports: ["websocket"],
          reconnection: true,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("🟢 Connected to Google Socket");
        setIsConnected(true);
        socket.emit("start-google-stream");
        
        // 2. Gửi Audio
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && socket.connected) {
            socket.emit("audio-chunk", event.data);
          }
        });
        mediaRecorder.start(100); // Gửi 100ms/lần
        mediaRecorderRef.current = mediaRecorder;
      });

      socket.on("transcript-data", (data: TranscriptData) => {
        // Có tín hiệu chữ về -> Reset timer im lặng
        resetSilenceTimer();

        if (data.isFinal) {
            setInterimText("");
            // Google đôi khi trả về trùng lặp, logic UI sẽ xử lý hiển thị
            // Ở đây ta gom text thuần túy
            setTranscript(prev => prev + (prev ? " " : "") + data.text);
            
            // Gom vào buffer chờ tóm tắt
            pendingBufferRef.current += (pendingBufferRef.current ? " " : "") + data.text;
        } else {
            setInterimText(data.text);
        }
      });

      socket.on("disconnect", () => {
        console.log("🔴 Disconnected");
        setIsConnected(false);
      });

    } catch (e) {
      console.error("Mic Error:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setIsConnected(false);

    // Vét nốt buffer cuối cùng khi tắt mic
    if (pendingBufferRef.current.length > 0) {
        handleSilenceDetected();
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    if (socketRef.current) {
      socketRef.current.emit("stop-google-stream");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const resetTranscript = () => {
      setTranscript("");
      setInterimText("");
      pendingBufferRef.current = "";
  };

  return { 
    transcript, // Toàn bộ văn bản đã lưu
    interimText, // Chữ đang chạy
    isListening, 
    isConnected, 
    startListening, 
    stopListening, 
    resetTranscript 
  };
}