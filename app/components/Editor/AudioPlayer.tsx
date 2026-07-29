"use client";
import { useRef } from "react";
import { Play, Pause, RotateCcw, RotateCw, Sparkles } from "lucide-react";

interface EditorAudioPlayerProps {
  audioSrc: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSkip: (seconds: number) => void;
  onRateChange: () => void;
  onSeek: (time: number) => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => void;
  onEnded: () => void;
  onSummarize: () => void;
  formatTime: (s: number) => string;
}

export default function EditorAudioPlayer({
  audioSrc, isPlaying, currentTime, duration, playbackRate,
  onTogglePlay, onSkip, onRateChange, onSeek,
  onTimeUpdate, onLoadedMetadata, onEnded,
  onSummarize, formatTime
}: EditorAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className="h-20 bg-white border-t px-4 md:px-8 flex items-center gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20 shrink-0">
      <button onClick={onTogglePlay} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg shrink-0">
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
      </button>

      <div className="flex items-center gap-1 md:gap-2">
        <button onClick={() => onSkip(-10)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition" title="-10s">
          <RotateCcw className="w-5 h-5" />
        </button>
        <button onClick={() => onSkip(10)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition" title="+10s">
          <RotateCw className="w-5 h-5" />
        </button>
        <button onClick={onRateChange} className="p-2 text-slate-700 hover:bg-slate-100 rounded-lg transition text-xs font-bold min-w-[3rem]" title="Tốc độ">
          {playbackRate}x
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <div className="flex justify-between text-[10px] md:text-xs font-medium text-slate-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div
          className="w-full h-2 bg-slate-100 rounded-full cursor-pointer relative overflow-hidden group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            if (duration > 0) onSeek(percent * duration);
          }}
        >
          <div className="absolute inset-0 bg-indigo-500 origin-left" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
        </div>
      </div>

      <div className="md:hidden">
        <button onClick={onSummarize} className="p-2 bg-orange-100 text-orange-600 rounded-full">
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />
    </div>
  );
}
