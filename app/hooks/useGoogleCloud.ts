import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

export type LiveSegment = {
  id: number;
  text: string;
  isFinal: boolean;
  speaker: string; 
  lastUpdate: number;
};

type TranscriptData = {
  text: string;
  isFinal: boolean;
  speaker: number | string;
};

type OnSegmentEndCallback = (text: string) => void;

export default function useGoogleCloud(onSegmentEnd?: OnSegmentEndCallback) {
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [interimText, setInterimText] = useState(""); 
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingBufferRef = useRef(""); 

  const lastSpeechTimeRef = useRef<number>(Date.now());
  const shouldMergeRef = useRef<boolean>(false);
  
  // [MỚI] Ref để theo dõi trạng thái interim mà không gây re-render useEffect
  const isInterimActiveRef = useRef(false);

  const SERVER_URL = "https://meeting-socket-server.onrender.com"; 

  // [FIX QUAN TRỌNG] useEffect này chỉ được chạy 1 lần duy nhất!
  useEffect(() => {
    setIsConnecting(true);
    const socket = io(SERVER_URL, { 
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 10, 
    });
    socketRef.current = socket;

    socket.on("connect", () => {
        console.log("🟢 Google Socket Ready");
        setIsConnected(true);
        setIsConnecting(false);
        lastSpeechTimeRef.current = Date.now();
    });

    socket.on("disconnect", () => {
        setIsConnected(false);
        setIsConnecting(true); 
    });

    socket.on("connect_error", () => setIsConnecting(true));

    socket.on("transcript-data", (data: TranscriptData) => {
        resetSilenceTimer();

        if (!data.text || data.text.trim().length === 0) return;

        const now = Date.now();
        
        // [LOGIC MỚI] Dùng Ref để kiểm tra thay vì State
        // Nếu trước đó chưa có interim (đang im lặng) -> Đây là bắt đầu câu mới
        if (!isInterimActiveRef.current) {
            const silenceGap = now - lastSpeechTimeRef.current;
            // Nếu nghỉ ít hơn 2s -> Nối
            shouldMergeRef.current = silenceGap < 2000;
        }
        
        // Cập nhật thời điểm mới nhất có tiếng
        lastSpeechTimeRef.current = now;

        if (data.isFinal) {
            setInterimText("");
            isInterimActiveRef.current = false; // Reset cờ interim

            const cleanText = data.text.trim();
            const currentSpeaker = "SPEAKER_00"; 

            if (cleanText) {
                setSegments(prev => {
                    const lastSeg = prev[prev.length - 1];

                    // Logic nối dòng:
                    // 1. Cờ Merge bật (do nói nhanh)
                    // 2. Cùng người nói
                    // 3. Có đoạn trước đó
                    if (shouldMergeRef.current && lastSeg && lastSeg.speaker === currentSpeaker) {
                        return [
                            ...prev.slice(0, -1),
                            {
                                ...lastSeg,
                                text: lastSeg.text + " " + cleanText,
                                lastUpdate: now 
                            }
                        ];
                    } else {
                        return [
                            ...prev, 
                            { 
                                id: now, 
                                text: cleanText, 
                                isFinal: true,
                                speaker: currentSpeaker,
                                lastUpdate: now
                            }
                        ];
                    }
                });
                pendingBufferRef.current += (pendingBufferRef.current ? " " : "") + cleanText;
            }
        } else {
            setInterimText(data.text);
            isInterimActiveRef.current = true; // Đánh dấu là đang nói dở
        }
    });

    return () => { if (socket) socket.disconnect(); };
  }, []); // [QUAN TRỌNG] Dependency rỗng để không bao giờ reset Socket

  const handleSilenceDetected = () => {
      const buffer = pendingBufferRef.current.trim();
      if (buffer.length > 30 && onSegmentEnd) {
          onSegmentEnd(buffer);
          pendingBufferRef.current = ""; 
      }
  };

  const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(handleSilenceDetected, 2000);
  };

  const startListening = async (stream: MediaStream) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    try {
      setIsListening(true);
      streamRef.current = stream;
      pendingBufferRef.current = "";
      lastSpeechTimeRef.current = Date.now();
      isInterimActiveRef.current = false; // Reset trạng thái
      
      socketRef.current.emit("start-google-stream");
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0 && socketRef.current?.connected) {
          socketRef.current.emit("audio-chunk", event.data);
        }
      });
      mediaRecorder.start(100); 
      mediaRecorderRef.current = mediaRecorder;
    } catch (e) { console.error(e); setIsListening(false); }
  };

  const stopListening = () => {
    setIsListening(false);
    if (pendingBufferRef.current.length > 0) handleSilenceDetected();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    if (socketRef.current) socketRef.current.emit("stop-google-stream");
  };

  const resetTranscript = () => {
      setSegments([]);
      setInterimText("");
      pendingBufferRef.current = "";
  };

  return { segments, interimText, isListening, isConnected, isConnecting, startListening, stopListening, resetTranscript };
}