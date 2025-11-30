"use client";
import React, { useRef, useEffect, useState } from "react";
import { ChevronDown, Play, Pause, ArrowUpToLine, Plus } from "lucide-react";

interface TranscriptRowProps {
  segment: any;
  speaker: any;
  allSpeakers: any[];
  isActive: boolean;
  isAudioPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onTextChange: (id: string, text: string) => void;
  onSpeakerChange: (id: string, spkId: string) => void;
  onSplit: (id: string, cursor: number) => void;
  onMerge: (id: string) => void;
  onAddRow: (id: string) => void; // [MỚI]
  onTimeChange: (id: string, newTime: number) => void; // [MỚI]
}

export default function TranscriptRow({ 
  segment, speaker, allSpeakers, isActive, 
  isAudioPlaying, onTogglePlay, 
  onSeek, onTextChange, onSpeakerChange, onSplit, onMerge,
  onAddRow, onTimeChange 
}: TranscriptRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State nội bộ để quản lý việc sửa thời gian
  const [timeStr, setTimeStr] = useState("");

  // Helper: Chuyển giây -> MM:SS
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper: Chuyển MM:SS -> giây
  const parseTime = (str: string) => {
    const parts = str.split(":").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return segment.start; // Fallback nếu nhập sai
  };

  // Sync state khi prop thay đổi
  useEffect(() => {
    setTimeStr(formatTime(segment.start));
  }, [segment.start]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [segment.text]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (isActive) {
      onTogglePlay();
    } else {
      onSeek(segment.start);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLTextAreaElement;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSplit(segment.id, target.selectionStart);
    }
    if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
      // Chỉ cho phép gộp nếu không bôi đen
      e.preventDefault(); 
      onMerge(segment.id);
    }
  };

  // [MỚI] Xử lý khi người dùng sửa xong thời gian (blur hoặc enter)
  const handleTimeBlur = () => {
    const newTime = parseTime(timeStr);
    if (newTime !== segment.start) {
      onTimeChange(segment.id, newTime);
    } else {
        // Nếu nhập sai hoặc không đổi, reset lại hiển thị cũ
        setTimeStr(formatTime(segment.start));
    }
  };

  return (
    <div className={`flex gap-4 group transition-all duration-300 ${isActive ? "opacity-100" : "opacity-80 hover:opacity-100"}`}>
      
      {/* 1. Cột Thời Gian & Nút Play */}
      <div className="w-16 flex flex-col items-end pt-1 gap-2 flex-shrink-0">
        {/* [MỚI] Input thời gian thay vì text tĩnh */}
        <div className="relative group/time">
             <input 
                  className={`text-xs font-mono text-right bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-14
                      ${isActive ? "text-indigo-600 font-bold" : "text-slate-400"}
                  `}
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  onBlur={handleTimeBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              {/* Tooltip nhắc nhở format */}
              <span className="absolute right-0 -top-6 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-focus-within/time:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  Nhập MM:SS
              </span>
        </div>

       <button 
          onClick={handlePlayClick}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all 
            ${isActive 
              ? "bg-indigo-600 text-white shadow-md scale-110" 
              : "bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-100 hover:text-indigo-600" 
            }`}
          title={isActive && isAudioPlaying ? "Tạm dừng" : "Nghe đoạn này"}
        >
          {isActive && isAudioPlaying ? (
            <Pause className="w-3 h-3 fill-current" />
          ) : (
            <Play className="w-3 h-3 ml-0.5 fill-current" />
          )}
        </button>
      </div>

      {/* 2. Cột Nội Dung */}
      <div className={`flex-1 p-4 rounded-xl border transition-all relative group/content ${isActive ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-transparent hover:border-slate-200"}`}>
        
        {/* [MỚI] Action Buttons (Insert & Merge) - Chỉ hiện khi hover vào box nội dung */}
        <div className="absolute right-2 top-2 opacity-0 group-hover/content:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-slate-100 z-10">
          <button 
            onClick={() => onAddRow(segment.id)}
            title="Chèn dòng mới phía dưới"
            className="p-1.5 hover:bg-green-50 rounded text-slate-400 hover:text-green-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 my-auto"></div>
          <button 
            onClick={() => onMerge(segment.id)}
            title="Gộp với đoạn trên (Backspace)"
            className="p-1.5 hover:bg-indigo-50 rounded text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <ArrowUpToLine className="w-4 h-4" />
          </button>
        </div>

        {/* Speaker Name */}
        <div className="group/spk relative inline-block mb-1">
          <button className={`text-xs font-bold px-2 py-1 rounded border uppercase flex items-center gap-1 transition-colors ${speaker.color}`}>
            {speaker.name}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          
          {/* Dropdown Menu chọn người nói */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-lg shadow-xl hidden group-hover/spk:block z-50 py-1 max-h-60 overflow-y-auto">
            {allSpeakers.map((spk: any) => (
              <div 
                key={spk.id}
                onClick={() => onSpeakerChange(segment.id, spk.id)}
                className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center gap-2"
              >
                <div className={`w-2 h-2 rounded-full ${spk.color.split(" ")[0].replace("bg-", "bg-slate-900")}`}></div> 
                {spk.name}
              </div>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={segment.text}
          onChange={(e) => onTextChange(segment.id, e.target.value)}
          onKeyDown={handleKeyDown}
          // [QUAN TRỌNG] Đã xóa sự kiện onClick để không nhảy audio khi click sửa
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-slate-800 leading-relaxed mt-1 placeholder:text-slate-300 focus:ring-0 border-none p-0"
          placeholder="Nhập nội dung hội thoại..."
        />
      </div>
    </div>
  );
}