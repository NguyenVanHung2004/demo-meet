// app/hooks/useGoogleCloud.ts

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { Word } from "../lib/mockData";

export type LiveSegment = {
  id: number;
  text: string;
  isFinal: boolean;
  speaker: string; 
  lastUpdate: number;
  words?: Word[];
};

type TranscriptData = {
  text: string;
  isFinal: boolean;
  speaker: number | string;
  words?: Word[];
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const isInterimActiveRef = useRef(false);

  // [FIX 1] Lưu callback mới nhất vào Ref để tránh lỗi Stale Closure trong useEffect []
  const onSegmentEndRef = useRef(onSegmentEnd);
  
  // Cập nhật ref mỗi khi onSegmentEnd thay đổi
  useEffect(() => {
    onSegmentEndRef.current = onSegmentEnd;
  }, [onSegmentEnd]);

  const SERVER_URL = "https://meeting-socket-server.onrender.com"; 
  const offsetTimeRef = useRef(0);
  // Hàm xử lý khi phát hiện im lặng
  const handleSilenceDetected = () => {
      const buffer = pendingBufferRef.current.trim();
      // Gọi thông qua Ref để đảm bảo logic mới nhất
      if (buffer.length > 20 && onSegmentEndRef.current) {
          console.log("🤫 Silence detected -> Trigger Summary");
          onSegmentEndRef.current(buffer);
          pendingBufferRef.current = ""; 
      }
  };

  // Hàm reset đồng hồ đếm ngược
  const resetSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // Đợi 2 giây im lặng thì gọi xử lý
      silenceTimerRef.current = setTimeout(handleSilenceDetected, 2000);
  };

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

    socket.on("force-client-restart", () => {
        console.log("♻️ Server yêu cầu restart (Reset 5 phút)");
    
        if (pendingBufferRef.current.trim().length > 0) {
           handleSilenceDetected(); 
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            setTimeout(() => {
               startListening(streamRef.current!); 
            }, 100);
        }
    });

    socket.on("disconnect", () => {
        setIsConnected(false);
        setIsConnecting(true); 
    });

    socket.on("connect_error", () => setIsConnecting(true));

    socket.on("transcript-data", (data: TranscriptData) => {
        console.log("🔥 Socket Data trả về:", data);
        // [FIX 2] Chỉ reset timer khi có nội dung thực sự
        // Nếu server gửi gói tin rỗng/keep-alive thì KHÔNG reset timer -> để timer chạy hết và trigger tóm tắt
        if (!data.text || data.text.trim().length === 0) return;

        // Có nội dung -> Reset timer (người dùng đang nói)
        resetSilenceTimer();

        const now = Date.now();
        
        if (!isInterimActiveRef.current) {
            const silenceGap = now - lastSpeechTimeRef.current;
            shouldMergeRef.current = silenceGap < 2000;
        }
        
        lastSpeechTimeRef.current = now;

        if (data.isFinal) {
            setInterimText("");
            isInterimActiveRef.current = false; 

            const cleanText = data.text.trim();
            const currentSpeaker = "SPEAKER_00"; 
            const incomingWords = (data.words || []).map((w: any) => ({
                ...w,
                start: (w.start || 1) + offsetTimeRef.current,
                end: (w.end || 1 ) + offsetTimeRef.current
            }));
            if (cleanText) {
                setSegments(prev => {
                    const lastSeg = prev[prev.length - 1];
                    if (shouldMergeRef.current && lastSeg && lastSeg.speaker === currentSpeaker) {
                       return [
                        ...prev.slice(0, -1),
                        {
                            ...lastSeg,
                            text: lastSeg.text + " " + cleanText,
                            // [MỚI] Nối words cũ + mới
                            words: (lastSeg.words || []).concat(incomingWords), 
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
                                words: incomingWords,
                                lastUpdate: now
                            }
                        ];
                    }
                });
                // Cộng dồn vào buffer chờ tóm tắt
                pendingBufferRef.current += (pendingBufferRef.current ? " " : "") + cleanText;
            }
        } else {
            setInterimText(data.text);
            isInterimActiveRef.current = true; 
        }
    });

    return () => { 
        if (socket) socket.disconnect(); 
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []); 
  const setupAudioProcessing = async (rawStream: MediaStream) => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(rawStream);
    
    // 1. Compressor: Ép giọng to xuống
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-50, audioContext.currentTime); 
    compressor.knee.setValueAtTime(40, audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, audioContext.currentTime);      
    compressor.attack.setValueAtTime(0, audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, audioContext.currentTime);

    // 2. Gain: Kích âm lượng lên 2.0 lần
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(2.0, audioContext.currentTime);        

    // Kết nối: Mic -> Compressor -> Gain -> Output
    source.connect(compressor);   
    compressor.connect(gainNode);         
    
    const destination = audioContext.createMediaStreamDestination();
    gainNode.connect(destination);

    return destination.stream;
  };
  const startListening = async (stream: MediaStream, startTimeOffset: number = 0) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    try {
      setIsListening(true);
      streamRef.current = stream;
      offsetTimeRef.current = startTimeOffset;
      pendingBufferRef.current = "";
      lastSpeechTimeRef.current = Date.now();
      isInterimActiveRef.current = false; 
      
      socketRef.current.emit("start-google-stream");
      const processedStream = await setupAudioProcessing(stream);

      // 👇 [SỬA] Dùng processedStream thay vì stream
      const mediaRecorder = new MediaRecorder(processedStream, { mimeType: 'audio/webm' });
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
    // Gọi tóm tắt lần cuối cho phần còn dư
    if (pendingBufferRef.current.length > 0) handleSilenceDetected();
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    if (socketRef.current) socketRef.current.emit("stop-google-stream");
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  };

  const resetTranscript = () => {
      setSegments([]);
      setInterimText("");
      pendingBufferRef.current = "";
  };

  return { segments, interimText, isListening, isConnected, isConnecting, startListening, stopListening, resetTranscript };
}