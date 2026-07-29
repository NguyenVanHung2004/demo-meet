"use client";
import { useRef } from "react";
import { UploadCloud, Mic } from "lucide-react";

interface StatsCardsProps {
  uploadLanguage: "vi" | "en";
  liveLanguage: "vi" | "en";
  onUploadLanguageChange: (lang: "vi" | "en") => void;
  onLiveLanguageChange: (lang: "vi" | "en") => void;
  onFileSelected: (file: File) => void;
  onLiveClick: () => void;
}

export default function StatsCards({
  uploadLanguage, liveLanguage,
  onUploadLanguageChange, onLiveLanguageChange,
  onFileSelected, onLiveClick
}: StatsCardsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="audio/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />

      <div
        className="group relative border border-dashed border-indigo-200 bg-white hover:border-indigo-400 rounded-xl p-4 md:p-6 flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 cursor-pointer transition-all duration-300 shadow-sm active:scale-[0.98]"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
          <UploadCloud className="w-6 h-6 md:w-8 md:h-8" />
        </div>
        <div className="text-left md:text-center flex-1">
          <span className="font-bold text-slate-700 block text-sm md:text-lg">Tải file lên</span>
          <span className="text-xs text-slate-400">MP3, WAV (Max 100MB)</span>
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={uploadLanguage}
              onChange={(e) => onUploadLanguageChange(e.target.value as "vi" | "en")}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full md:w-auto"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>
      </div>

      <div
        onClick={onLiveClick}
        className="group border border-dashed border-red-200 bg-white hover:border-red-400 rounded-xl p-4 md:p-6 flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 cursor-pointer transition-all duration-300 shadow-sm active:scale-[0.98]"
      >
        <div className="p-3 bg-red-50 text-red-600 rounded-full group-hover:scale-110 transition-transform">
          <Mic className="w-6 h-6 md:w-8 md:h-8" />
        </div>
        <div className="text-left md:text-center flex-1">
          <span className="font-bold text-slate-700 block text-sm md:text-lg">Ghi âm trực tiếp</span>
          <span className="text-xs text-slate-400">Chuyển giọng nói thành văn bản</span>
          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
            <select
              value={liveLanguage}
              onChange={(e) => onLiveLanguageChange(e.target.value as "vi" | "en")}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-red-400 w-full md:w-auto"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
