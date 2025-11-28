"use client";

import React, { useState, useRef } from "react";
import { Meeting } from "../lib/db";
import ReactMarkdown from 'react-markdown'; // [MỚI] Import để render tóm tắt
import { 
  Play, Pause, ChevronLeft, Edit3, Calendar, 
  Clock, Download, FileText, Sparkles, User
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
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // [MỚI] State quản lý Tab
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("vi-VN", { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m} phút ${s} giây`;
  };

  const formatTimeCode = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      
      {/* HEADER */}
      <div className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{meeting.title}</h1>
            <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(meeting.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(meeting.duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2 transition">
            <Download className="w-4 h-4" /> Xuất file
          </button>
          <button 
            onClick={onEdit}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md shadow-indigo-200 flex items-center gap-2 transition"
          >
            <Edit3 className="w-4 h-4" /> Chỉnh sửa
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:px-24">
          <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm border rounded-xl overflow-hidden flex flex-col">
            
            {/* [MỚI] TABS NAVIGATION */}
            <div className="flex border-b bg-slate-50 sticky top-0 z-10">
              <button 
                onClick={() => setActiveTab('transcript')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors border-b-2 
                  ${activeTab === 'transcript' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <FileText className="w-4 h-4" /> Nội dung chi tiết
              </button>
              <button 
                onClick={() => setActiveTab('summary')}
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-colors border-b-2
                  ${activeTab === 'summary' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                <Sparkles className="w-4 h-4" /> Tóm tắt thông minh
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="p-8 md:p-12">
              
              {/* VIEW 1: TRANSCRIPT */}
              {activeTab === 'transcript' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {meeting.segments.map((seg) => {
                    const speakerName = meeting.speakers.find(s => s.id === seg.speakerId)?.name || seg.speakerId;
                    const speakerColor = meeting.speakers.find(s => s.id === seg.speakerId)?.color || "text-slate-700";
                    return (
                      <div key={seg.id} className="flex gap-4 group">
                        <div className="w-12 pt-1 shrink-0 text-right">
                          <span className="text-xs font-mono text-slate-400 block group-hover:text-indigo-500 transition-colors">{formatTimeCode(seg.start)}</span>
                        </div>
                        <div>
                          <div className={`text-xs font-bold mb-1 uppercase tracking-wide ${speakerColor.split(' ')[1] || 'text-slate-800'}`}>
                            {speakerName}
                          </div>
                          <p className="text-slate-700 leading-relaxed text-sm">
                            {seg.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* VIEW 2: SUMMARY */}
              {activeTab === 'summary' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {meeting.summary ? (
                    <div className="prose prose-indigo max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-indigo-700 mb-6 border-b pb-2" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2 bg-slate-50 p-2 rounded-lg" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-md font-semibold text-slate-700 mt-4 mb-2 ml-1" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-600" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                          p: ({node, ...props}) => <p className="mb-4 text-slate-600 leading-relaxed text-justify" {...props} />,
                        }}
                      >
                        {meeting.summary}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                      <Sparkles className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium">Chưa có tóm tắt cho cuộc họp này.</p>
                      <button onClick={onEdit} className="mt-4 text-indigo-600 hover:underline text-sm">
                        Chuyển sang chế độ chỉnh sửa để tạo tóm tắt
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>

        {/* FOOTER AUDIO (Giữ nguyên) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 flex items-center gap-4 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <button 
             onClick={togglePlay}
             className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition"
           >
             {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
           </button>
           <div className="flex-1">
             <div className="text-xs font-medium text-slate-500 mb-1 flex justify-between">
                <span>Đang phát lại bản ghi gốc</span>
                <span>{formatDuration(meeting.duration)}</span>
             </div>
             <audio 
               ref={audioRef} 
               src={audioSrc} 
               controls 
               className="w-full h-8"
               onPlay={() => setIsPlaying(true)}
               onPause={() => setIsPlaying(false)}
             />
           </div>
        </div>

      </div>
    </div>
  );
}