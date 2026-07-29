"use client";
import { useState } from "react";
import {
  ChevronLeft, Calendar, Clock, Share2, Download,
  Music, FileText, FileType, Sparkles, Edit3
} from "lucide-react";
import type { Meeting } from "@/app/lib/db";

interface MeetingHeaderProps {
  meeting: Meeting;
  isReadOnly: boolean;
  showTemplateBtn: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenTemplateModal: () => void;
  onShare: () => Promise<void>;
  onDownloadAudio: () => void;
  onExportTxt: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  formatDate: (ts: number) => string;
  formatDuration: (sec: number) => string;
}

export default function MeetingHeader({
  meeting, isReadOnly, showTemplateBtn,
  onBack, onEdit, onOpenTemplateModal,
  onShare, onDownloadAudio, onExportTxt,
  onExportDocx, onExportPdf, formatDate, formatDuration
}: MeetingHeaderProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
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

      <div className="flex gap-2 shrink-0 relative">
        {!isReadOnly && (
          <button onClick={onShare} className="px-3 py-2 md:px-4 md:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-medium rounded-lg shadow-sm flex items-center gap-2 transition">
            <Share2 className="w-4 h-4" /> <span className="hidden md:inline">Chia sẻ</span>
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="p-2 md:px-4 md:py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" /> <span className="hidden md:inline">Tải xuống</span>
          </button>

          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <button onClick={onDownloadAudio} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium border-b border-slate-50">
                  <Music className="w-4 h-4 text-pink-500" /> Audio
                </button>
                <button onClick={onExportTxt} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 border-b border-slate-50">
                  <FileText className="w-4 h-4 text-slate-400" /> Nội dung thô (.txt)
                </button>
                <button onClick={onExportDocx} className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 flex items-center gap-3 text-indigo-700 font-medium">
                  <FileType className="w-4 h-4" /> Bản tóm tắt (.docx)
                </button>
                <button onClick={onExportPdf} className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 flex items-center gap-3 text-orange-700 font-medium">
                  <FileType className="w-4 h-4" /> Bản tóm tắt (.pdf)
                </button>
              </div>
            </>
          )}
        </div>

        {!isReadOnly && showTemplateBtn && (
          <button onClick={onOpenTemplateModal} className="px-3 py-2 md:px-5 md:py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg shadow-sm border border-orange-200 flex items-center gap-2 transition">
            <Sparkles className="w-4 h-4" /> <span className="hidden md:inline">Tóm tắt lại</span>
          </button>
        )}

        {!isReadOnly && (
          <button onClick={onEdit} className="px-3 py-2 md:px-5 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md shadow-indigo-200 flex items-center gap-2 transition">
            <Edit3 className="w-4 h-4" /> <span className="hidden md:inline">Sửa</span>
          </button>
        )}
      </div>
    </div>
  );
}
