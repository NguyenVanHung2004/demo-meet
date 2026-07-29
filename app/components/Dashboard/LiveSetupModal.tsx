"use client";
import { Mic } from "lucide-react";

interface LiveSetupModalProps {
  liveTitle: string;
  liveObjectives: string;
  liveLanguage: "vi" | "en";
  onTitleChange: (v: string) => void;
  onObjectivesChange: (v: string) => void;
  onLanguageChange: (v: "vi" | "en") => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function LiveSetupModal({
  liveTitle, liveObjectives, liveLanguage,
  onTitleChange, onObjectivesChange, onLanguageChange,
  onConfirm, onCancel
}: LiveSetupModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-500 animate-pulse" /> Cấu hình ghi âm trực tiếp
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập thông tin cuộc họp trước khi bắt đầu thu âm trực tiếp
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Tiêu đề cuộc họp</label>
            <input
              type="text"
              value={liveTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Nhập tên cuộc họp..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Ngôn ngữ phiên âm</label>
            <select
              value={liveLanguage}
              onChange={(e) => onLanguageChange(e.target.value as "vi" | "en")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium text-slate-700"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mục tiêu cuộc họp (Objectives)</label>
            <textarea
              value={liveObjectives}
              onChange={(e) => onObjectivesChange(e.target.value)}
              placeholder="Nhập mục tiêu để AI bám sát và tóm tắt cuộc họp chuẩn hơn..."
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium text-slate-700 resize-none animate-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold transition-all text-sm"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-red-100 flex items-center justify-center gap-1.5"
          >
            <Mic className="w-4 h-4" /> Bắt đầu ghi âm
          </button>
        </div>
      </div>
    </div>
  );
}
