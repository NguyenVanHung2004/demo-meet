"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, AlignLeft, Trash2, Zap, Loader2 } from "lucide-react";
import useDeepgram, { LiveSegment } from "../hooks/useDeepgram"; 
import { requestSegmentSummary } from "../lib/api";

type SummaryItem = { id: number; content: string; isLoading: boolean; };

const MobileTabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button onClick={onClick} className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${active ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"}`}>
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default function LiveRecordingState({ 
  onFinish, onBack 
}: { 
  onFinish: (text: string, audioUrl: string, finalSummary: string ) => void, 
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
  const bufferTextRef = useRef(""); 
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordCountRef = useRef(0);
  const isInterimActiveRef = useRef(false);

  const flushBuffer = async (force: boolean = false) => {
      const content = bufferTextRef.current.trim();
      const minWords = force ? 2 : 15;
      if (wordCountRef.current < minWords) return;

      if (!force && isInterimActiveRef.current) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => flushBuffer(false), 2000);
          return;
      }

      const currentId = Date.now();
      const previewText = content.length > 50 ? content.substring(0, 50) + "..." : content;
      setSummaries(prev => [...prev, { id: currentId, content: `⏳ Đang xử lý: "${previewText}"`, isLoading: true }]);

      const textToProcess = content;
      bufferTextRef.current = "";
      wordCountRef.current = 0;

      try {
        const summary = await requestSegmentSummary(textToProcess);
        if (!summary || summary.trim().length === 0) {
            setSummaries(prev => prev.filter(item => item.id !== currentId));
            return;
        }
        setSummaries(prev => prev.map(item => item.id === currentId ? { ...item, content: summary, isLoading: false } : item));
      } catch (e) {
        setSummaries(prev => prev.filter(item => item.id !== currentId));
      }
  };

  const handleDeepgramFinal = ({ speaker, content }: { speaker: number; content: string }) => {
      const formattedLine = `Speaker ${speaker}: ${content}`;
      bufferTextRef.current += (bufferTextRef.current ? "\n" : "") + formattedLine;
      const newWords = content.trim().split(/\s+/).length;
      wordCountRef.current += newWords;

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (wordCountRef.current > 80) { flushBuffer(true); return; }

      const timeoutMs = wordCountRef.current >= 30 ? 2000 : 3000;
      silenceTimerRef.current = setTimeout(() => flushBuffer(), timeoutMs);
  };

  const { segments, interimContent, isListening, isConnecting, startListening, stopListening, resetTranscript } = useDeepgram(handleDeepgramFinal);

  useEffect(() => { isInterimActiveRef.current = !!(interimContent && interimContent.trim().length > 0); }, [interimContent]);
  useEffect(() => { if (mobileTab === 'summary') summariesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [summaries, mobileTab]);
  useEffect(() => { if (mobileTab === 'transcript') transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [segments, interimContent, mobileTab]);
  useEffect(() => {
    let interval: any;
    if (isListening) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  const startRecordingSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
        // [QUAN TRỌNG] Bắt buộc phải bật nếu bạn dùng loa ngoài (speaker) 
        // để AI không nghe thấy tiếng chính nó (Echo).
        // Nếu đeo tai nghe, có thể tắt luôn để âm thanh mộc nhất.
        echoCancellation: true,      

        // [TỐI ƯU] Tắt khử ồn của trình duyệt. 
        // Deepgram Nova-2 xử lý nhiễu tốt hơn Chrome rất nhiều.
        // Bật cái này thường làm mất các từ ngắn hoặc âm cuối.
        noiseSuppression: false,      

        // [TỐI ƯU] Tắt tự động cân bằng âm lượng.
        // Giúp giữ dynamic range của giọng nói, tránh bị "bơm" noise khi im lặng.
        autoGainControl: false,       

        // Chuẩn, STT chỉ cần Mono. Stereo chỉ tốn băng thông gấp đôi.
        channelCount: 1,             
        
        // Deepgram hỗ trợ tốt nhất ở dải này. 
        // 16000 là đủ cho giọng nói, nhưng 44100/48000 cho chất lượng cao hơn chút.
        // Để trình duyệt tự chọn (thường là 44.1k hoặc 48k) sẽ ổn định phần cứng hơn.
        // sampleRate: 16000, 
    } 
});
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
    if (bufferTextRef.current.length > 0) flushBuffer(true);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    setVolume(0);
  };

  const handleToggleRecord = () => { 
      if (isConnecting) return;
      isListening ? stopRecordingSession() : startRecordingSession(); 
  };

  const handleSaveAndProcess = () => {
    stopRecordingSession();
    setTimeout(() => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const createdAudioUrl = URL.createObjectURL(audioBlob);
        const fullTranscript = segments.map(s => `[Speaker ${s.speaker}]: ${s.content}`).join("\n") + (interimContent ? " " + interimContent : "");
        let finalSummary = summaries.filter(s => !s.isLoading).map(item => item.content.trim()).join(" ");
        onFinish(fullTranscript, createdAudioUrl, finalSummary); 
    }, 500);
  };

  const handleClearTranscript = () => {
      if (confirm("Xóa toàn bộ?")) { resetTranscript(); setSummaries([]); bufferTextRef.current = ""; wordCountRef.current = 0; }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper render bong bóng chat
  const renderChatBubble = (seg: LiveSegment, idx: number) => {
      const isSequence = idx > 0 && segments[idx - 1].speaker === seg.speaker;
      const isMe = seg.speaker === 0; 
      const alignClass = isMe ? 'items-start' : 'items-end';
      const bubbleColor = isMe ? 'bg-white border-slate-200' : 'bg-indigo-50 border-indigo-100';
      const avatarColor = isMe ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600';
      const avatarLabel = isMe ? 'Tôi' : `S${seg.speaker}`;

      return (
        <div key={seg.id} className={`flex flex-col ${alignClass} animate-in fade-in slide-in-from-bottom-1 duration-300 ${isSequence ? 'mt-1' : 'mt-4'}`}>
            <div className={`flex gap-3 max-w-[90%] ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-sm mt-1 ${avatarColor} ${isSequence ? 'invisible' : ''}`}>
                    {avatarLabel}
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                    {!isSequence && (
                        <div className={`flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-wider ${isMe ? 'ml-2' : 'mr-2 flex-row-reverse'}`}>
                            <span>Speaker {seg.speaker}</span>
                            <span className="font-medium opacity-70 normal-case">{new Date(seg.id).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                    )}
                    <div className={`p-3 rounded-2xl border text-sm text-slate-800 leading-relaxed shadow-sm ${bubbleColor} ${isMe ? 'rounded-tl-none' : 'rounded-tr-none'}`}>
                        {seg.content}
                    </div>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* HEADER */}
      <div className="h-14 md:h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 shadow-sm z-20 shrink-0">
         <div className="flex items-center gap-3">
             <button onClick={() => { stopRecordingSession(); onBack(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft className="w-5 h-5" /></button>
             <div className="flex flex-col">
                <span className="text-xs text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    {isConnecting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Zap className="w-3 h-3"/>} Deepgram Nova-2
                </span>
                <span className="text-sm md:text-base font-mono font-bold text-slate-700">{formatTime(timer)}</span>
             </div>
         </div>
         <button onClick={handleSaveAndProcess} className="px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg transition-all">
           <Save className="w-4 h-4" /> <span className="hidden md:inline">Lưu</span>
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
                   return <div key={i} className={`w-1.5 md:w-2 rounded-full transition-all duration-75 ${isListening ? 'bg-indigo-500' : 'bg-slate-700'}`} style={{ height: `${height}%` }}></div>
                 })}
               </div>
               <button onClick={handleToggleRecord} disabled={isConnecting} className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 transition-all shrink-0 ${isConnecting ? 'bg-slate-600 border-slate-700 cursor-wait' : isListening ? 'bg-yellow-500 animate-pulse border-slate-800' : 'bg-red-600 hover:bg-red-700 border-slate-800 active:scale-95'}`}>
                  {isConnecting ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : isListening ? <Pause className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
               </button>
               <div className="absolute bottom-2 left-0 right-0 text-center">
                   {isConnecting ? <span className="text-xs text-yellow-400 font-medium animate-pulse flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Đang kết nối Deepgram...</span> : isListening ? <span className="text-[10px] text-green-400 font-medium opacity-80">● Đang ghi âm</span> : <span className="text-xs text-slate-500 font-medium">Sẵn sàng</span>}
               </div>
            </div>

            {/* TRANSCRIPT */}
            <div className="flex md:hidden bg-slate-200 p-1 rounded-xl shrink-0">
                <MobileTabBtn active={mobileTab === 'transcript'} onClick={() => setMobileTab('transcript')} icon={AlignLeft} label="Hội thoại" />
                <MobileTabBtn active={mobileTab === 'summary'} onClick={() => setMobileTab('summary')} icon={Sparkles} label="Live Tóm tắt" />
            </div>

            <div className={`bg-white rounded-2xl border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden transition-all ${mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'}`}>
               <div className="p-3 border-b bg-slate-50 flex items-center gap-2 shrink-0">
                  <AlignLeft className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600 uppercase">Nội dung chi tiết</span>
                  <button onClick={handleClearTranscript} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors ml-auto"><Trash2 className="w-4 h-4" /></button>
               </div>
               
               {/* CHAT AREA */}
               <div className="flex-1 overflow-y-auto p-4 font-sans bg-slate-50/50">
                  {segments.map((seg, idx) => renderChatBubble(seg, idx))}
                  {interimContent && (
                      <div className="flex gap-3 mt-2 animate-pulse opacity-80">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                          </div>
                          <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none border border-transparent max-w-[85%]">
                              <p className="text-slate-500 italic font-medium text-sm">{interimContent} ...</p>
                          </div>
                      </div>
                  )}
                  <div ref={transcriptEndRef} className="h-2" />
               </div>
            </div>
        </div>

        {/* RIGHT COLUMN */}
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