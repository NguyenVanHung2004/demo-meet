"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, Activity } from "lucide-react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

export default function LiveRecordingState({ onFinish, onBack }: { onFinish: (text: string, audioUrl: string) => void, onBack: () => void }) {
    const { text, interimText, isListening, startListening, stopListening, hasSupport } = useSpeechRecognition();  
  const [timer, setTimer] = useState(0);
  const [summaries, setSummaries] = useState<string[]>([]);
  
  // State cho Audio Recorder & Visualizer
  const [volume, setVolume] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  // 1. Timer
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  // 2. Hàm bắt đầu Ghi Âm (Cả Audio + Text)
  const startRecordingSession = async () => {
    try {
      // Xin quyền Micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // A. Cấu hình MediaRecorder (Ghi file âm thanh)
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = []; // Reset bộ nhớ đệm

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      // B. Cấu hình Visualizer (Sóng âm nhảy múa)
      const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioContext();
      const analyzer = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 32;
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);

      const updateVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setVolume(sum / dataArray.length);
        animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // C. Bắt đầu nhận diện chữ (Speech to Text)
      startListening();

    } catch (err) {
      console.error("Lỗi Micro:", err);
      alert("Không thể truy cập Micro!");
    }
  };

  // 3. Hàm dừng Ghi Âm
  const stopRecordingSession = () => {
    // Dừng Speech to Text
    stopListening();

    // Dừng Visualizer
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    // Dừng MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    // Tắt đèn Micro (để trình duyệt không hiện chấm đỏ nữa)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setVolume(0);
  };

  const handleToggleRecord = () => {
    if (isListening) {
      stopRecordingSession();
    } else {
      startRecordingSession();
    }
  };

 // 4. Xử lý khi ấn "Lưu & Xử lý"
  const handleSaveAndProcess = () => {
    stopRecordingSession();

    // Đợi 1 chút để media recorder hoàn tất đẩy dữ liệu
    setTimeout(() => {
        // [FIX LỖI Ở ĐÂY] Tạo audioUrl từ chunks đã ghi
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const createdAudioUrl = URL.createObjectURL(audioBlob); // Đặt tên biến rõ ràng
        
        // Gộp text
        const fullText = (text + " " + interimText).trim(); 
        
        // Truyền URL vừa tạo vào onFinish
        onFinish(fullText, createdAudioUrl); 
    }, 500);
  };

  // Giả lập Summary
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        if (text.length > 30) {
           const newSummary = `- [00:${timer < 10 ? '0' + timer : timer}] Ghi nhận nội dung mới...`;
           setSummaries((prev) => [newSummary, ...prev]);
        }
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [isListening, timer, text]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const hasContent = text.trim().length > 0 || interimText.trim().length > 0;
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* HEADER */}
      <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => { stopRecordingSession(); onBack(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className={`flex items-center gap-2 font-bold transition-colors ${isListening ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-600' : 'bg-slate-300'}`}></div>
            {isListening ? "Đang ghi âm..." : "Chờ ghi âm"}
          </div>
          <div className="px-3 py-1 bg-slate-100 rounded text-mono font-medium text-slate-700">
            {formatTime(timer)}
          </div>
        </div>
        <button 
          onClick={handleSaveAndProcess}
          disabled={!hasContent}
         className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-lg transition-all
            ${hasContent 
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200" // Active
              : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"     // Disabled
            }`}
        >
          <Save className="w-4 h-4" />
          Dừng & Xử lý
        </button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 grid grid-rows-[1fr_1fr] gap-6 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
          
          {/* WAVEFORM */}
          <div className="bg-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden">
            <h3 className="text-slate-400 text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" /> Tín hiệu Micro
            </h3>
            <div className="flex items-center justify-center gap-1 h-32">
              {[...Array(20)].map((_, i) => {
                const height = isListening ? Math.min(100, Math.max(10, volume * (1 + Math.random()))) : 4;
                return <div key={i} className="w-2 bg-indigo-500 rounded-full transition-all duration-75" style={{ height: `${height}%` }}></div>
              })}
            </div>
            <div className="flex justify-center gap-6 mt-4 z-10">
              <button 
                onClick={handleToggleRecord}
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 ${isListening ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isListening ? <Pause className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
              </button>
            </div>
          </div>

          {/* TEXT */}
          <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col">
            <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-4 flex items-center justify-between">
              <span>Hội thoại thời gian thực</span>
              {isListening && <span className="text-green-600 text-xs flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span> Listening</span>}
            </h3>
            <div className="flex-1 overflow-y-auto font-mono text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border-inner">
             {/* [LOGIC HIỂN THỊ MỚI] */}
              <span>{text}</span>
              
              {/* Phần đang nói dở: Màu xám + in nghiêng */}
              <span className="text-slate-400 italic transition-all duration-75">
                {interimText}
              </span>

              {/* Cursor nhấp nháy */}
              {isListening && <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 align-middle animate-pulse"></span>}
              
              {!text && !interimText && <span className="text-slate-400 italic">Hãy nói gì đó...</span>}
            </div>
          </div>
        </div>

        {/* SUMMARY */}
        <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col min-h-0">
          <h3 className="text-indigo-700 text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Tóm tắt tự động
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3">
            {summaries.map((sum, index) => (
              <div key={index} className="flex gap-3 animate-in slide-in-from-bottom duration-500">
                 <div className="w-1 h-auto bg-indigo-200 rounded-full mt-1 mb-1"></div>
                 <p className="text-slate-700 bg-indigo-50 px-4 py-2 rounded-lg text-sm flex-1">{sum}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}