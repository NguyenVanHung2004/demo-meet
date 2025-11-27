"use client";
import React, { useRef, useEffect } from "react";
import { ChevronDown, Play, Pause, ArrowUpToLine } from "lucide-react";
// [MỚI] Thêm type cho props mới
interface TranscriptRowProps {
  segment: any;
  speaker: any;
  allSpeakers: any[];
  isActive: boolean;
  isAudioPlaying: boolean; // <--- MỚI
  onTogglePlay: () => void; // <--- MỚI
  onSeek: (time: number) => void;
  onTextChange: (id: string, text: string) => void;
  onSpeakerChange: (id: string, spkId: string) => void;
  onSplit: (id: string, cursor: number) => void;
  onMerge: (id: string) => void;
}

export default function TranscriptRow({ 
  segment, speaker, allSpeakers, isActive, 
  isAudioPlaying, onTogglePlay, // <--- Nhận props
  onSeek, onTextChange, onSpeakerChange, onSplit, onMerge 
}: TranscriptRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [segment.text]);

  // [MỚI] Hàm xử lý nút Play/Pause
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Tránh click nhầm vào các element cha

    if (isActive) {
      // Nếu đoạn này đang được highlight (đang phát đoạn này)
      // Thì nút bấm sẽ có tác dụng: Play <-> Pause
      onTogglePlay();
    } else {
      // Nếu đang ở đoạn khác mà bấm vào đây -> Nhảy tới đây và phát luôn
      onSeek(segment.start);
    }
  };

    // [QUAN TRỌNG] Xử lý phím tắt
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLTextAreaElement;

    // 1. Enter: Tách dòng (Logic cũ)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSplit(segment.id, target.selectionStart);
    }

    // 2. [MỚI] Backspace: Gộp lên trên
    // Điều kiện: Phím Backspace + Con trỏ đang ở vị trí đầu tiên (index 0) + Không bôi đen text
    if (e.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
      // Chặn hành động xóa ký tự mặc định (để tránh xóa mất ký tự của dòng trên)
      e.preventDefault(); 
      onMerge(segment.id);
    }
  };

  return (
    <div className={`flex gap-4 group transition-all duration-300 ${isActive ? "opacity-100" : "opacity-80 hover:opacity-100"}`}>
      {/* Time & Play Btn */}
      <div className="w-16 flex flex-col items-end pt-1 gap-2 flex-shrink-0">
        <span 
          onClick={() => onSeek(segment.start)}
          className={`text-xs font-mono cursor-pointer hover:underline ${isActive ? "text-indigo-600 font-bold" : "text-slate-400"}`}
        >
          {new Date(segment.start * 1000).toISOString().substr(14, 5)}
        </span>
       <button 
          onClick={handlePlayClick}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all 
            ${isActive 
              ? "bg-indigo-600 text-white shadow-md scale-110" // Đang active thì nổi bật
              : "bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-100 hover:text-indigo-600" // Không active thì ẩn
            }`}
        >
          {/* Logic icon: Nếu đang Active VÀ Audio đang chạy thì hiện Pause, còn lại hiện Play */}
          {isActive && isAudioPlaying ? (
            <Pause className="w-3 h-3 fill-current" />
          ) : (
            <Play className="w-3 h-3 ml-0.5 fill-current" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 p-4 rounded-xl border transition-all ${isActive ? "bg-indigo-50 border-indigo-200 shadow-sm" : "bg-white border-transparent hover:border-slate-200"}`}>
        {/* [MỚI] Nút công cụ nhanh (Hiện khi hover) */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button 
            onClick={() => onMerge(segment.id)}
            title="Gộp với đoạn trên (Backspace)"
            className="p-1.5 hover:bg-slate-200 rounded text-slate-400 hover:text-indigo-600"
          >
            <ArrowUpToLine className="w-4 h-4" />
          </button>
        </div>
        {/* Speaker Name (Dropdown) */}
        <div className="group/spk relative inline-block mb-1">
          <button className={`text-xs font-bold px-2 py-1 rounded border uppercase flex items-center gap-1 transition-colors ${speaker.color}`}>
            {speaker.name}
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-white border rounded-lg shadow-xl hidden group-hover/spk:block z-50 py-1">
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
          onClick={() => onSeek(segment.start)}
          rows={1}
          className="w-full bg-transparent resize-none outline-none text-slate-800 leading-relaxed mt-1 placeholder:text-slate-300 focus:ring-0 border-none p-0"
        />
      </div>
    </div>
  );
}