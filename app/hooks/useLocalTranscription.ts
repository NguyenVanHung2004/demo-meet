import { useState, useRef, useEffect } from "react";
import { Word } from "../lib/mockData"; 

// HÀM NỐI CHUỖI THÔNG MINH (CHỐNG LẶP) - COPY TỪ CODE CŨ CỦA BẠN
const mergeText = (prev: string, next: string) => {
    const p = prev.trim();
    const n = next.trim();
    if (!p) return n;
    if (!n) return p;
    if (n.startsWith(p)) return n;
    const overlapMax = Math.min(p.length, n.length, 20);
    for (let i = overlapMax; i > 0; i--) {
        const suffix = p.slice(-i);
        const prefix = n.slice(0, i);
        if (suffix === prefix) return p + n.slice(i);
    }
    if (/^[.,!?;:]/.test(n)) return p + n;
    return p + " " + n;
};

// AUDIO HELPER: Downsample & Convert to Int16
const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) => {
    if (outputSampleRate === inputSampleRate) return convertFloat32ToInt16(buffer);
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);
    let offsetResult = 0, offsetBuffer = 0;
    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        let accum = 0, count = 0;
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = Math.max(-1, Math.min(1, count > 0 ? accum / count : 0)) * 32768;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
};
const convertFloat32ToInt16 = (buffer: Float32Array) => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
    return buf;
};

export type TranscriptSegment = {
  speaker: number;
  content: string;
  isFinal: boolean;
  words?: Word[];
};

export default function useLocalTranscription(
    onFinal?: (data: any) => void
) {
  const serverUrl = "wss://zipformer-server.zeabur.app";
  // --- STATE ---
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimContent, setInterimContent] = useState<string>(""); 
  const [isListening, setIsListening] = useState(false);
  
  // --- REFS ---
  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // [QUAN TRỌNG] Biến cộng dồn thời gian (giống useDeepgram)
  const offsetTimeRef = useRef(0);
    const lastEndTimestampRef = useRef<number>(0);
  // -----------------------------------------------------

  const startListening = async (rawStream: MediaStream, startTimeOffset: number = 0) => {
    // 1. CẬP NHẬT THỜI GIAN
    offsetTimeRef.current = startTimeOffset;
    setIsListening(true);
    // [FIX] KHÔNG GỌI setSegments([]) Ở ĐÂY để giữ lại nội dung cũ khi Resume
     if (startTimeOffset === 0) {
        lastEndTimestampRef.current = 0;
    } 
    console.log(`🔌 Connecting to ${serverUrl} at offset ${startTimeOffset}s...`);

    // 2. SETUP WEBSOCKET
    const ws = new WebSocket(serverUrl);
    socketRef.current = ws;

    ws.onopen = () => { console.log("✅ Connected to Local Zipformer Server"); };
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerResponse(data);
        } catch (e) { console.error("Parse error:", e); }
    };
    ws.onerror = (e) => console.error("WS Error:", e);

    // 3. AUDIO PROCESSING (Raw Int16 16kHz)
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(rawStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    
    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
        ws.send(pcmData.buffer);
    };
    streamRef.current = rawStream;
  };

  const handleServerResponse = (data: any) => {
      // Structure: { channel: { alternatives: [...] }, is_final: true }
      if (data.channel && data.channel.alternatives?.[0]) {
          const alt = data.channel.alternatives[0];
          const transcript = alt.transcript;
          
          // [FIX] CỘNG THÊM offsetTimeRef VÀO TỪNG TỪ
          const words = (alt.words || []).map((w: any) => ({
             ...w,
             start: w.start + offsetTimeRef.current,
             end: w.end + offsetTimeRef.current
          }));

          if (transcript) {
             // GỌI CALLBACK NẾU CẦN
             if (onFinal) onFinal({ speaker: 0, content: transcript });

             setSegments(prev => {
                const lastSegment = prev[prev.length - 1];
                
                // [LOGIC TÁCH ĐOẠN DỰA TRÊN THỜI GIAN]
                // 1. Lấy thời gian bắt đầu của câu mới này
                const currentStart = words.length > 0 ? words[0].start : (lastEndTimestampRef.current + 0.1); 
                
                // 2. Tính khoảng cách so với câu trước (GAP)
                const gap = currentStart - lastEndTimestampRef.current;
                
                // Cập nhật mốc thời gian kết thúc mới nhất
                if (words.length > 0) {
                    lastEndTimestampRef.current = words[words.length - 1].end;
                }
                // 3. RULE: Nếu im lặng < 1.5s -> Gộp vào đoạn cũ
                if (lastSegment && gap < 1.0) {
                     return [
                        ...prev.slice(0, -1),
                        {
                            ...lastSegment,
                            content: mergeText(lastSegment.content, transcript),
                            words: (lastSegment.words || []).concat(words)
                        }
                     ];
                }
                
                // 4. Nếu im lặng > 1.5s -> Tách đoạn mới (coi như ngắt ý hoặc người khác nói)
                // Mẹo: Đổi speaker ID giả (toggle 0 -> 1) để UI hiển thị khác màu cho dễ nhìn
                const nextSpeaker = lastSegment ? (lastSegment.speaker === 0 ? 1 : 0) : 0;
                return [...prev, {
                     speaker: nextSpeaker,
                     content: transcript,
                     isFinal: true,
                     words: words
                }];
             });
          }
      }
  };


  const stopListening = () => {
    setIsListening(false);
    socketRef.current?.close();
    
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    // [QUAN TRỌNG] KHÔNG setSegments([]) ở đây
  };

  const resetTranscript = () => {
      // Chỉ khi người dùng ấn nút Thùng rác mới xóa
      setSegments([]);
      setInterimContent("");
  };

  return { segments, interimContent, isListening, startListening, stopListening, resetTranscript };
}