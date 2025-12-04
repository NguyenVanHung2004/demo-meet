"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, Activity, FileText, AlignLeft,Trash2 } from "lucide-react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { requestSegmentSummary } from "../lib/api";

type SummaryItem = {
  id: number;
  content: string;
  isLoading: boolean;
};

// [MỚI] Component Tab Button cho Mobile
const MobileTabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${
      active 
        ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
        : "text-slate-500 hover:bg-slate-100"
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default function LiveRecordingState({ 
  onFinish, 
  onBack 
}: { 
  onFinish: (text: string, audioUrl: string, finalSummary: string ) => void, 
  onBack: () => void 
}) {
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [timer, setTimer] = useState(0);
  const [volume, setVolume] = useState(0);
  
  // [MỚI] State quản lý Tab trên Mobile
  const [mobileTab, setMobileTab] = useState<'transcript' | 'summary'>('transcript');

  const summariesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null); // [MỚI] Auto scroll cho transcript
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  // Hook nhận diện giọng nói (đã tối ưu)
  const { text, interimText, isListening, startListening, stopListening,resetTranscript } = useSpeechRecognition();

  // Logic tóm tắt (Giữ nguyên)
  const handleSegmentEnd = async (segmentText: string) => {
    if (!segmentText || segmentText.trim().length < 5) return;
    const currentId = Date.now();
    setSummaries(prev => [...prev, { id: currentId, content: "⏳ Đang phân tích...", isLoading: true }]);

    try {
      // Gọi API Gemini (Next.js API Route)
      const summary = await requestSegmentSummary(segmentText);
      setSummaries(prev => prev.map(item => 
        item.id === currentId 
          ? { ...item, content: summary || "Không có nội dung chính.", isLoading: false }
          : item
      ));
    } catch (e) {
      setSummaries(prev => prev.filter(item => item.id !== currentId));
    }
  };

  // Auto Scroll
  useEffect(() => {
    if (mobileTab === 'summary') {
      summariesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [summaries, mobileTab]);

  useEffect(() => {
    if (mobileTab === 'transcript') {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [text, interimText, mobileTab]);

  // Timer
  useEffect(() => {
    let interval: any;
    if (isListening) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  // Logic Ghi âm (Start/Stop)
  const startRecordingSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

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

      startListening(handleSegmentEnd);

    } catch (err) {
      alert("Không thể truy cập Micro! Hãy kiểm tra quyền truy cập.");
    }
  };

  const stopRecordingSession = () => {
    stopListening();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    setVolume(0);
  };
  // [MỚI] Hàm xử lý khi bấm nút xóa
  const handleClearTranscript = () => {
      if (confirm("Bạn có chắc muốn xóa toàn bộ nội dung hội thoại hiện tại?")) {
          resetTranscript();
          setSummaries([]); // Xóa luôn cả tóm tắt cho đồng bộ
      }
  };
  const handleToggleRecord = () => {
    if (isListening) stopRecordingSession();
    else startRecordingSession();
  };

  const handleSaveAndProcess = () => {
    stopRecordingSession();
    setTimeout(() => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const createdAudioUrl = URL.createObjectURL(audioBlob);
        const fullTranscript = (text + " " + interimText).trim(); 
        
        let finalSummary = summaries
            .filter(s => !s.isLoading)
            .map(item => item.content.trim())
            .join(" ");

        onFinish(fullTranscript, createdAudioUrl, finalSummary); 
    }, 500);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // --- RENDER UI ---
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      
      {/* 1. HEADER (Compact on Mobile) */}
      <div className="h-14 md:h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-3">
             <button onClick={() => { stopRecordingSession(); onBack(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Thời gian</span>
                <span className="text-sm md:text-base font-mono font-bold text-slate-700">{formatTime(timer)}</span>
             </div>
         </div>
         <button 
           onClick={handleSaveAndProcess}
           className="px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg transition-all"
         >
           <Save className="w-4 h-4" /> <span className="hidden md:inline">Dừng & Lưu</span> <span className="md:hidden">Lưu</span>
         </button>
      </div>

      {/* 2. BODY CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-4 gap-4 md:gap-6">
        
        {/* LEFT COLUMN (Desktop: 60%, Mobile: Stacked) */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
            
            {/* A. VISUALIZER CARD (Always Visible) */}
            <div className="bg-slate-900 rounded-2xl p-4 md:p-6 shadow-lg shrink-0 flex items-center justify-between gap-4 md:flex-col md:justify-center md:h-64 transition-all">
               {/* Sóng âm */}
               <div className="flex items-center justify-center gap-1 h-12 md:h-32 flex-1 md:w-full">
                 {[...Array(20)].map((_, i) => {
                   const height = isListening ? Math.min(100, Math.max(15, volume * (1 + Math.random()) * 2)) : 5;
                   return <div key={i} className="w-1.5 md:w-2 bg-indigo-500 rounded-full transition-all duration-75" style={{ height: `${height}%` }}></div>
                 })}
               </div>

               {/* Nút Micro */}
               <button 
                  onClick={handleToggleRecord}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-slate-800 transition-transform active:scale-95 shrink-0 ${isListening ? 'bg-yellow-500 animate-pulse' : 'bg-red-600'}`}
               >
                  {isListening ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
               </button>
            </div>

            {/* [MOBILE ONLY] TAB SWITCHER */}
            <div className="flex md:hidden bg-slate-200 p-1 rounded-xl shrink-0">
                <MobileTabBtn 
                    active={mobileTab === 'transcript'} 
                    onClick={() => setMobileTab('transcript')} 
                    icon={AlignLeft} 
                    label="Hội thoại" 
                />
                <MobileTabBtn 
                    active={mobileTab === 'summary'} 
                    onClick={() => setMobileTab('summary')} 
                    icon={Sparkles} 
                    label="Live Tóm tắt" 
                />
            </div>

            {/* B. TRANSCRIPT (Desktop: Always Show | Mobile: Show if Tab Active) */}
            <div className={`bg-white rounded-2xl border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden transition-all ${mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'}`}>
               <div className="p-3 border-b bg-slate-50 flex items-center gap-2 shrink-0">
                  <AlignLeft className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600 uppercase">Nội dung chi tiết</span>
                  {/* [MỚI] Nút Xóa văn bản */}
                  <button 
                    onClick={handleClearTranscript}
                    className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    title="Xóa toàn bộ văn bản"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
                {/* 1. Hiển thị văn bản chính thức (Màu đen) */}
                {text.split("\n").map((line, idx) => line.trim() && (
                    <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100 max-w-[85%]">
                            <p className="text-slate-800 leading-relaxed">{line}</p>
                        </div>
                    </div>
                ))}

                {/* 2. Hiển thị chữ xám Interim (Style đẹp như Google) */}
                {interimText && (
                    <div className="flex gap-3 opacity-75">
                        <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0 flex items-center justify-center">
                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-dashed border-slate-300 shadow-sm max-w-[85%]">
                            <p className="text-slate-500 italic font-medium">
                              {interimText} ...
                            </p>
                        </div>
                    </div>
                )}
               </div>
            </div>
        </div>

        {/* RIGHT COLUMN (Desktop: 40%, Mobile: Show if Tab Active) */}
        {/* C. LIVE SUMMARY */}
        <div className={`md:w-1/3 bg-white rounded-2xl border shadow-sm flex flex-col min-h-0 overflow-hidden transition-all ${mobileTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
             <div className="p-3 border-b bg-indigo-50 flex items-center gap-2 shrink-0">
               <Sparkles className="w-4 h-4 text-indigo-600" />
               <span className="text-xs font-bold text-indigo-800 uppercase">Live Insights (Tóm tắt)</span>
             </div>

             <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                <div className="space-y-4">
                   {/* Các ý đã chốt */}
                   {summaries.filter(s => !s.isLoading).map((item) => (
                      <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                         <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                         <p className="text-slate-700 text-sm leading-relaxed text-justify">{item.content}</p>
                      </div>
                   ))}

                   {/* Loading State */}
                   {summaries.filter(s => s.isLoading).map((item) => (
                      <div key={item.id} className="flex gap-3 opacity-70">
                         <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 animate-bounce shrink-0"></div>
                         <p className="text-slate-400 text-sm italic">{item.content}</p>
                      </div>
                   ))}
                </div>
                <div ref={summariesEndRef} className="h-4" />
             </div>
        </div>

      </div>
    </div>
  );
}