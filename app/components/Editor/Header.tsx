"use client";
import { useRef, useEffect } from "react";
import { Pencil, Check, LayoutTemplate, Sparkles, Save, Users } from "lucide-react";
import Button from "@/app/components/ui/Button";
import Tooltip from "@/app/components/ui/Tooltip";
import PageHeader from "@/app/components/ui/PageHeader";

interface EditorHeaderProps {
  title: string;
  isEditingTitle: boolean;
  isSaving: boolean;
  selectedTemplateName: string;
  speakerCount: number;
  onBack: () => void;
  onStartEditingTitle: () => void;
  onSaveTitle: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent) => void;
  onTitleChange: (v: string) => void;
  onOpenTemplateModal: () => void;
  onOpenSpeakerModal: () => void;
  onSummarize: () => void;
  onSave: () => void;
}

export default function EditorHeader({
  title, isEditingTitle, isSaving, selectedTemplateName, speakerCount,
  onBack, onStartEditingTitle, onSaveTitle, onTitleKeyDown,
  onTitleChange, onOpenTemplateModal, onOpenSpeakerModal, onSummarize, onSave
}: EditorHeaderProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  return (
    <PageHeader
      variant="compact"
      sticky
      onBack={onBack}
      title={title}
      actions={
        <>
          <Tooltip content={`Quản lý ${speakerCount} người nói`}>
            <button
              onClick={onOpenSpeakerModal}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors border border-slate-200"
              aria-label="Quản lý người nói"
            >
              <Users className="w-4 h-4 text-primary-600" />
              <span>{speakerCount}</span>
            </button>
          </Tooltip>

          <button
            onClick={onOpenTemplateModal}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200 max-w-[160px]"
            title={selectedTemplateName}
          >
            <LayoutTemplate className="w-4 h-4 text-primary-600 shrink-0" />
            <span className="truncate">{selectedTemplateName}</span>
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={onSummarize}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="text-orange-700 border-orange-200 bg-orange-50 hover:bg-orange-100 hidden md:flex whitespace-nowrap"
          >
            Tóm tắt lại
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            loading={isSaving}
            leftIcon={isSaving ? undefined : <Save className="w-4 h-4" />}
          >
            {isSaving ? "Đã lưu" : "Lưu"}
          </Button>
        </>
      }
    />
  );
}
