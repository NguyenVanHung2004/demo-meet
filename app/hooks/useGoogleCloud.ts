import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

// Định nghĩa kiểu dữ liệu từ Server trả về
type TranscriptData = {
  text: string;
  isFinal: boolean;
  speaker: number | string;
};

// Callback tóm tắt
type OnSegmentEndCallback = (text: string) => void;

export default function useGoogleCloud(onSegmentEnd?: OnSegmentEndCallback) {
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Logic Cổ Điển: Buffer + Timer Im Lặng
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBufferRef = useRef(""); 

  // URL Server Socket.IO (Server bạn chạy port 8080)
  const SERVER_URL = "https://meeting-socket-server.onrender.com"; 

  // Hàm cắt tóm tắt khi im lặng
  const handleSilenceDetected = () => {
      const buffer = pendingBufferRef.current.trim();
      
      // Nếu gom đủ dài (> 30 ký tự) thì cắt đi tóm tắt
      if (buffer.length > 30 && onSegmentEnd) {
          console.log("✂️ Google: Cắt tóm tắt đoạn:", buffer);
          onSegmentEnd(buffer);
          pendingBufferRef.current = ""; // Xả buffer
      }
  };

  const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // Im lặng 1.5 giây -> Chốt đoạn văn
      silenceTimerRef.current = setTimeout(handleSilenceDetected, 1500);
  };

  const startListening = async (stream: MediaStream) => {
    try {
      setIsListening(true);
      streamRef.current = stream;
      pendingBufferRef.current = "";

      // 1. Kết nối Socket.IO
      const socket = io(SERVER_URL);
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("🟢 Connected to Google Socket.IO");
        setIsConnected(true);
        // Báo server bắt đầu nhận diện
        socket.emit("start-google-stream");
        
        // 2. Mở Mic & Gửi Audio
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && socket.connected) {
            socket.emit("audio-chunk", event.data); // Gửi blob
          }
        });
        mediaRecorder.start(100); // Gửi mỗi 100ms
        mediaRecorderRef.current = mediaRecorder;
      });

      socket.on("transcript-data", (data: TranscriptData) => {
        // Reset timer im lặng mỗi khi có chữ mới
        resetSilenceTimer();

        if (data.isFinal) {
            // Chốt câu
            setInterimText("");
            setTranscript(prev => prev + (prev ? " " : "") + data.text);
            
            // Gom vào buffer chờ tóm tắt
            pendingBufferRef.current += (pendingBufferRef.current ? " " : "") + data.text;
        } else {
            // Đang nói
            setInterimText(data.text);
        }
      });

      socket.on("google-error", (err) => {
          console.error("Server Error:", err);
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

    // Vét nốt buffer cuối cùng
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

  return { transcript, interimText, isListening, isConnected, startListening, stopListening, resetTranscript };
}