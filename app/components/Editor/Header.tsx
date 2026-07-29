"use client";
import { useRef, useEffect } from "react";
import {
  ChevronLeft, Pencil, Check, Users, LayoutTemplate,
  Sparkles, Save
} from "lucide-react";

interface EditorHeaderProps {
  title: string;
  isEditingTitle: boolean;
  isSaving: boolean;
  selectedTemplateName: string;
  onBack: () => void;
  onStartEditingTitle: () => void;
  onSaveTitle: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent) => void;
  onTitleChange: (v: string) => void;
  onOpenSpeakerModal: () => void;
  onOpenTemplateModal: () => void;
  onSummarize: () => void;
  onSave: () => void;
}

export default function EditorHeader({
  title, isEditingTitle, isSaving, selectedTemplateName,
  onBack, onStartEditingTitle, onSaveTitle, onTitleKeyDown,
  onTitleChange, onOpenSpeakerModal, onOpenTemplateModal,
  onSummarize, onSave
}: EditorHeaderProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <div className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-20 shadow-sm">
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                ref={titleInputRef}
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={onTitleKeyDown}
                onBlur={onSaveTitle}
                className="text-sm md:text-lg font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button onMouseDown={onSaveTitle} className="text-green-600"><Check className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="group flex items-center gap-2 cursor-pointer" onClick={onStartEditingTitle}>
              <h1 className="font-bold text-slate-800 text-sm md:text-lg truncate max-w-[150px] md:max-w-md" title={title}>{title}</h1>
              <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
          )}
          <p className="text-[10px] md:text-xs text-slate-400 hidden md:block">Chế độ chỉnh sửa chi tiết</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onOpenSpeakerModal}
          className="md:hidden flex items-center justify-center p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Users className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenTemplateModal}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200"
          title={selectedTemplateName}
        >
          <LayoutTemplate className="w-4 h-4 text-indigo-600" />
          <span className="max-w-[100px] truncate">{selectedTemplateName}</span>
        </button>

        <button onClick={onSummarize} className="hidden md:flex items-center gap-2 px-3 py-1.5 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg text-sm font-medium transition-colors border border-orange-200">
          <Sparkles className="w-4 h-4" /> Tóm tắt lại
        </button>
        <button onClick={onSave} disabled={isSaving} className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-sm font-medium shadow-md transition-all ${isSaving ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
          <Save className="w-4 h-4" /> <span className="hidden md:inline">{isSaving ? "Đã lưu" : "Lưu"}</span>
        </button>
      </div>
    </div>
  );
}
