"use client";

import React, { useState, useRef, useEffect } from "react";
import { Meeting } from "../lib/db";
import ReactMarkdown from 'react-markdown'; 
import { 
  Play, Pause, ChevronLeft, Edit3, Calendar, 
  Clock, Download, FileText, Sparkles, User, AlignLeft, Share2
} from "lucide-react";

export default function MeetingDetailState({ 
  meeting, 
  audioSrc,
  onBack, 
  onEdit 
}: { 
  meeting: Meeting, 
  audioSrc: string,
  onBack: () => void, 
  onEdit: () => void 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');

  // --- AUDIO CONTROL ---
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.load();
    }
  }, [audioSrc]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const jumpToTime = (time: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          audioRef.current.play();
          setIsPlaying(true);
      }
  };

  // --- LOGIC XUẤT FILE (MỚI) ---
  const handleExport = () => {
    try {
        // 1. Tạo nội dung file
        let content = `TIÊU ĐỀ: ${meeting.title}\n`;
        content += `NGÀY: ${new Date(meeting.createdAt).toLocaleString('vi-VN')}\n`;
        content += `THỜI LƯỢNG: ${formatDuration(meeting.duration)}\n`;
        content += `------------------------------------------------\n\n`;

        if (meeting.summary) {
            content += `[TÓM TẮT AI]\n${meeting.summary}\n\n`;
            content += `------------------------------------------------\n\n`;
        }

        content += `[NỘI DUNG CHI TIẾT]\n`;
        meeting.segments.forEach(seg => {
            const time = formatTimeCode(seg.start);
            const speaker = seg.speakerId.replace("SPEAKER_", "Speaker ");
            content += `[${time}] ${speaker}: ${seg.text}\n`;
        });

        // 2. Tạo Blob và tải về
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${meeting.title.replace(/\s+/g, "_")}_transcript.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        alert("Lỗi khi xuất file");
    }
  };

  // --- FORMATTERS ---
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("vi-VN", { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}p ${s}s`;
  };

  const formatTimeCode = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper chọn màu Speaker
  const getSpeakerStyle = (speakerId: string) => {
      const id = parseInt(speakerId.split('_')[1] || '0');
      const colors = [
          'bg-indigo-100 text-indigo-700 ring-indigo-200',
          'bg-emerald-100 text-emerald-700 ring-emerald-200',
          'bg-orange-100 text-orange-700 ring-orange-200',
          'bg-pink-100 text-pink-700 ring-pink-200',
          'bg-cyan-100 text-cyan-700 ring-cyan-200',
      ];
      return colors[id % colors.length];
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. HEADER */}
      <div className="bg-white border-b px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition shrink-0">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold text-slate-800 truncate pr-2">{meeting.title}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(meeting.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(meeting.duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button 
            onClick={handleExport}
            className="p-2 md:px-4 md:py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2 transition"
            title="Xuất file TXT"
          >
            <Download className="w-4 h-4" /> <span className="hidden md:inline">Xuất file</span>
          </button>
          <button 
            onClick={onEdit}
            className="px-3 py-2 md:px-5 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md shadow-indigo-200 flex items-center gap-2 transition"
          >
            <Edit3 className="w-4 h-4" /> <span className="hidden md:inline">Sửa</span>
          </button>
        </div>
      </div>

      {/* 2. TABS NAVIGATION (Sticky) - Chỉ hiện trên Mobile */}
      <div className="md:hidden flex bg-white border-b sticky top-0 z-10 shrink-0">
        <button 
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border-b-2 
            ${activeTab === 'transcript' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <AlignLeft className="w-4 h-4" /> Nội dung
        </button>
        <button 
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border-b-2
            ${activeTab === 'summary' ? 'border-orange-500 text-orange-700 bg-orange-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Sparkles className="w-4 h-4" /> Tóm tắt
        </button>
      </div>

      {/* 3. MAIN CONTENT (Có thể cuộn) */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        
        {/* COLUMN 1: TRANSCRIPT */}
        <div className={`flex-1 overflow-y-auto bg-white md:border-r scroll-smooth ${activeTab === 'transcript' ? 'block' : 'hidden md:block'}`}>
            <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 pb-32">
                {meeting.segments.map((seg, idx) => {
                  const speakerStyle = getSpeakerStyle(seg.speakerId);
                  return (
                    <div key={idx} className="flex gap-3 md:gap-4 group">
                      {/* Avatar / Time */}
                      <div className="w-10 md:w-14 shrink-0 flex flex-col items-center pt-1 gap-1">
                         <div 
                            onClick={() => jumpToTime(seg.start)}
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 shadow-sm cursor-pointer hover:scale-105 transition-transform select-none ${speakerStyle}`}
                            title="Nghe từ đoạn này"
                         >
                            {seg.speakerId.split('_')[1] || '00'}
                         </div>
                         <span className="text-[10px] text-slate-400 font-mono group-hover:text-indigo-600 cursor-pointer" onClick={() => jumpToTime(seg.start)}>
                            {formatTimeCode(seg.start)}
                         </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                Speaker {seg.speakerId.split('_')[1]}
                            </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed text-sm md:text-base hover:bg-slate-50 p-2 -ml-2 rounded-lg transition-colors cursor-text">
                          {seg.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
        </div>

        {/* COLUMN 2: SUMMARY & METADATA */}
        <div className={`md:w-[400px] bg-slate-50 flex flex-col shrink-0 ${activeTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32">
                
                {/* Summary Card */}
                <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
                    <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-orange-50">
                        <Sparkles className="w-4 h-4" /> AI Tóm tắt
                    </h3>
                    {meeting.summary ? (
                         <div className="prose prose-sm text-slate-700 prose-headings:text-indigo-700 prose-strong:text-slate-900 leading-relaxed text-justify max-w-none">
                            <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                         </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                            <Sparkles className="w-12 h-12 mb-2 opacity-20" />
                            <p className="text-sm italic">Chưa có tóm tắt nào.</p>
                            <button onClick={onEdit} className="mt-3 text-xs text-indigo-600 hover:underline font-medium">Tạo ngay trong Edit</button>
                        </div>
                    )}
                </div>

                {/* Metadata (Desktop Only) */}
                <div className="bg-white rounded-xl shadow-sm border p-5 hidden md:block">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Metadata</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
                            <span className="text-slate-500">Duration</span>
                            <span className="font-mono font-medium text-slate-700">{formatTimeCode(meeting.duration)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
                            <span className="text-slate-500">Segments</span>
                            <span className="font-mono font-medium text-slate-700">{meeting.segments.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Format</span>
                            <span className="font-mono font-medium uppercase text-slate-700">AUDIO</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>

      </div>

      {/* 4. FOOTER AUDIO PLAYER (Sticky Bottom) */}
      <div className="bg-white border-t p-3 md:p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 shrink-0">
         <div className="max-w-3xl mx-auto flex items-center gap-3 md:gap-4">
             <button 
               onClick={togglePlay}
               className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition shadow-lg shrink-0"
             >
               {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 pl-1" />}
             </button>
             
             <div className="flex-1 flex flex-col justify-center gap-1">
               <div className="flex justify-between text-[10px] md:text-xs font-medium text-slate-500">
                 <span>{formatTimeCode(currentTime)}</span>
                 <span>{formatTimeCode(duration)}</span>
               </div>
               
               <input 
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={(e) => {
                      const t = Number(e.target.value);
                      setCurrentTime(t);
                      if(audioRef.current) audioRef.current.currentTime = t;
                  }}
                  className="w-full h-1.5 md:h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
               />
             </div>

             <audio 
               ref={audioRef} 
               src={audioSrc} 
               onTimeUpdate={handleTimeUpdate}
               onLoadedMetadata={handleLoadedMetadata}
               onEnded={() => setIsPlaying(false)}
               className="hidden" 
             />
         </div>
      </div>

    </div>
  );
}