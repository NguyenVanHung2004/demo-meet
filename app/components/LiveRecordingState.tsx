"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, AlignLeft, Trash2, Cloud, Loader2, User } from "lucide-react";
import useGoogleCloud from "../hooks/useGoogleCloud"; 
import { requestSegmentSummary } from "../lib/api";

type SummaryItem = { id: number; content: string; isLoading: boolean; };

const MobileTabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${
      active ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"
    }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default function LiveRecordingState({ 
  onFinish, onBack 
}: { 
  onFinish: (text: string, audioUrl: string, finalSummary: string, segments?: any[]) => void,
  onBack: () => void 
}) {
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [timer, setTimer] = useState(0);
  const [volume, setVolume] = useState(0);
  const [mobileTab, setMobileTab] = useState<'transcript' | 'summary'>('transcript');

  const summariesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  // --- LOGIC TÓM TẮT ---
  const handleSegmentEnd = async (segmentText: string) => {
    if (!segmentText || segmentText.length < 20) return;
    const currentId = Date.now();
    // Cắt ngắn text preview
    const preview = segmentText.length > 40 ? segmentText.substring(0, 40) + "..." : segmentText;
    
    setSummaries(prev => [...prev, { id: currentId, content: `⏳ Đang tóm tắt: "${preview}"`, isLoading: true }]);

    try {
      const summary = await requestSegmentSummary(segmentText);
      if (!summary || summary.trim().length === 0) {
          setSummaries(prev => prev.filter(item => item.id !== currentId));
          return;
      }
      setSummaries(prev => prev.map(item => item.id === currentId ? { ...item, content: summary, isLoading: false } : item));
    } catch (e) {
      setSummaries(prev => prev.filter(item => item.id !== currentId));
    }
  };

  const { 
    segments, interimText, 
    isListening, isConnected, isConnecting,
    startListening, stopListening, resetTranscript 
  } = useGoogleCloud(handleSegmentEnd);

  // Auto Scroll
  useEffect(() => { if (mobileTab === 'summary') summariesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [summaries, mobileTab]);
  useEffect(() => { if (mobileTab === 'transcript') transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [segments, interimText, mobileTab]);
  
  useEffect(() => {
    let interval: any;
    if (isListening) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  const startRecordingSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      
      const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioContext();
      const analyzer = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 32;
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0; for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setVolume(sum / dataArray.length);
        animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      startListening(stream);
    } catch (err) { alert("Lỗi Micro: " + err); }
  };

  const stopRecordingSession = () => {
    stopListening();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    setVolume(0);
  };

  const handleToggleRecord = () => { 
      if (isConnecting || !isConnected) return;
      isListening ? stopRecordingSession() : startRecordingSession(); 
  };

  const handleSaveAndProcess = () => {
    stopRecordingSession();
    setTimeout(() => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const createdAudioUrl = URL.createObjectURL(audioBlob);
        const fullTranscript = segments.map(s => s.text).join(" ") + (interimText ? " " + interimText : "");
        let finalSummary = summaries.filter(s => !s.isLoading).map(item => item.content.trim()).join(" ");
        const dbSegments = segments.map(s => ({
            id: s.id.toString(),
            start: s.words?.[0]?.start || 0,
            end: s.words?.[s.words.length - 1]?.end || 0,
            text: s.text,
            speakerId: s.speaker,
            words: s.words || [] // <--- QUAN TRỌNG
        }));
        onFinish(fullTranscript, createdAudioUrl, finalSummary,dbSegments); 
    }, 500);
  };

  const handleClearTranscript = () => {
      if (confirm("Xóa toàn bộ nội dung?")) { resetTranscript(); setSummaries([]); }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="h-14 md:h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-3">
             <button onClick={() => { stopRecordingSession(); onBack(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
             <div className="flex flex-col">
                <span className="text-xs text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    {isConnecting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Cloud className="w-3 h-3"/>} Google Mode
                </span>
                <span className="text-sm md:text-base font-mono font-bold text-slate-700">{formatTime(timer)}</span>
             </div>
         </div>
         <button onClick={handleSaveAndProcess} className="px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg transition-all">
           <Save className="w-4 h-4" /> <span className="hidden md:inline">Dừng & Lưu</span> <span className="md:hidden">Lưu</span>
         </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-4 gap-4 md:gap-6">
        
        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
            
            {/* VISUALIZER */}
            <div className="bg-slate-900 rounded-2xl p-4 md:p-6 shadow-lg shrink-0 flex items-center justify-between gap-4 md:flex-col md:justify-center md:h-64 transition-all relative">
               <div className="flex items-center justify-center gap-1 h-12 md:h-32 flex-1 md:w-full">
                 {[...Array(20)].map((_, i) => {
                   const height = isListening ? Math.min(100, Math.max(15, volume * (1 + Math.random()) * 2)) : 5;
                   return <div key={i} className={`w-1.5 md:w-2 rounded-full transition-all duration-75 ${isConnected ? 'bg-indigo-500' : 'bg-slate-700'}`} style={{ height: `${height}%` }}></div>
                 })}
               </div>
               <button 
                  onClick={handleToggleRecord}
                  disabled={isConnecting || !isConnected}
                  className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 transition-all shrink-0
                    ${isConnecting 
                        ? 'bg-slate-600 border-slate-700 cursor-wait' 
                        : isListening 
                            ? 'bg-yellow-500 animate-pulse border-slate-800' 
                            : 'bg-red-600 hover:bg-red-700 border-slate-800 active:scale-95'
                    }
                  `}
               >
                  {isConnecting ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : isListening ? <Pause className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
               </button>
               <div className="absolute bottom-2 left-0 right-0 text-center">
                   {isConnecting ? <span className="text-xs text-yellow-400 font-medium animate-pulse flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Đang kết nối...</span> : isConnected ? <span className="text-[10px] text-green-400 font-medium opacity-80">● Máy chủ sẵn sàng</span> : <span className="text-xs text-red-400 font-medium">Mất kết nối</span>}
               </div>
            </div>

            {/* TRANSCRIPT UI */}
            <div className="flex md:hidden bg-slate-200 p-1 rounded-xl shrink-0">
                <MobileTabBtn active={mobileTab === 'transcript'} onClick={() => setMobileTab('transcript')} icon={AlignLeft} label="Hội thoại" />
                <MobileTabBtn active={mobileTab === 'summary'} onClick={() => setMobileTab('summary')} icon={Sparkles} label="Live Tóm tắt" />
            </div>

            <div className={`bg-white rounded-2xl border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden transition-all ${mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'}`}>
               <div className="p-3 border-b bg-slate-50 flex items-center gap-2 shrink-0">
                  <AlignLeft className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600 uppercase">Nội dung (Google STT)</span>
                  <button onClick={handleClearTranscript} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors ml-auto"><Trash2 className="w-4 h-4" /></button>
               </div>
               
               {/* [THAY ĐỔI] Giao diện Chat Bubble */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm bg-slate-50/50">
                  {segments.map((seg) => (
                      <div key={seg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs mt-1 shadow-sm">
                              Tôi
                          </div>
                          
                          {/* Bubble */}
                          <div className="flex-1 max-w-[85%]">
                              <div className="text-[10px] text-slate-400 mb-1 ml-1 flex items-center gap-2">
                                  <span>{new Date(seg.id).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</span>
                              </div>
                              <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-slate-800 leading-relaxed text-sm">
                                  {seg.text}
                              </div>
                          </div>
                      </div>
                  ))}

                  {/* Chữ đang nói (Interim) - Hiệu ứng Typing */}
                  {interimText && (
                      <div className="flex gap-3 animate-pulse opacity-80">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                          </div>
                          <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none border border-transparent shadow-none max-w-[85%]">
                              <p className="text-slate-500 italic font-medium text-sm">{interimText} ...</p>
                          </div>
                      </div>
                  )}
                  <div ref={transcriptEndRef} className="h-2" />
               </div>
            </div>
        </div>

        {/* RIGHT COLUMN (SUMMARY) */}
        <div className={`md:w-1/3 bg-white rounded-2xl border shadow-sm flex flex-col min-h-0 overflow-hidden transition-all ${mobileTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
             <div className="p-3 border-b bg-indigo-50 flex items-center gap-2 shrink-0">
               <Sparkles className="w-4 h-4 text-indigo-600" />
               <span className="text-xs font-bold text-indigo-800 uppercase">Live Insights</span>
             </div>
             <div className="flex-1 overflow-y-auto p-4 scroll-smooth space-y-4">
                {summaries.filter(s => !s.isLoading).map((item) => (
                   <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                      <p className="text-slate-700 text-sm leading-relaxed text-justify">{item.content}</p>
                   </div>
                ))}
                {summaries.filter(s => s.isLoading).map((item) => (
                   <div key={item.id} className="flex gap-3 opacity-70 bg-slate-50 p-3 rounded-xl border border-slate-100 border-dashed">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 animate-bounce shrink-0"></div>
                      <p className="text-slate-400 text-sm italic">{item.content}</p>
                   </div>
                ))}
                <div ref={summariesEndRef} className="h-4" />
             </div>
        </div>
      </div>
    </div>
  );
}