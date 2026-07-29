"use client";
import { AlertTriangle } from "lucide-react";
import Button from "../ui/Button";

interface UploadModalProps {
  selectedFile: File;
  uploadTitle: string;
  uploadObjectives: string;
  uploadLanguage: "vi" | "en";
  loading?: boolean;
  onTitleChange: (v: string) => void;
  onObjectivesChange: (v: string) => void;
  onLanguageChange: (v: "vi" | "en") => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function UploadModal({
  selectedFile, uploadTitle, uploadObjectives, uploadLanguage, loading = false,
  onTitleChange, onObjectivesChange, onLanguageChange,
  onConfirm, onCancel
}: UploadModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cấu hình tải file lên</h2>
          <p className="text-xs text-slate-500 mt-1">
            Tệp: <span className="font-semibold text-slate-700">{selectedFile.name}</span> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>

        {selectedFile.size > 100 * 1024 * 1024 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            File lớn (&gt;100MB) có thể mất nhiều thời gian để xử lý.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Tiêu đề cuộc họp</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Nhập tên cuộc họp..."
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Ngôn ngữ ghi âm</label>
            <select
              value={uploadLanguage}
              onChange={(e) => onLanguageChange(e.target.value as "vi" | "en")}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700"
            >
              <option value="vi">🇻🇳 Tiếng Việt</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mục tiêu cuộc họp (Objectives)</label>
            <textarea
              value={uploadObjectives}
              onChange={(e) => onObjectivesChange(e.target.value)}
              placeholder="Nhập mục tiêu để AI bám sát và tóm tắt cuộc họp chuẩn hơn..."
              rows={4}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 resize-none animate-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Hủy bỏ
          </Button>
          <Button variant="primary" loading={loading} disabled={!uploadTitle.trim()} onClick={onConfirm} className="flex-1">
            Bắt đầu tải lên
          </Button>
        </div>
      </div>
    </div>
  );
}
