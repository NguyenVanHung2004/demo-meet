"use client";
import { useRef } from "react";
import {
  UploadCloud, Mic, Calendar, Clock, Loader2, Trash2, Sparkles
} from "lucide-react";
import HeroCard from "./HeroCard";
import StatCard from "@/app/components/ui/StatCard";
import SegmentedControl from "@/app/components/ui/SegmentedControl";

interface StatsCardsProps {
  totalMeetings: number;
  totalDuration: number;
  processingCount: number;
  trashCount: number;
  uploadLanguage: "vi" | "en";
  liveLanguage: "vi" | "en";
  onUploadLanguageChange: (lang: "vi" | "en") => void;
  onLiveLanguageChange: (lang: "vi" | "en") => void;
  onFileSelected: (file: File) => void;
  onLiveClick: () => void;
}

export default function StatsCards({
  totalMeetings, totalDuration, processingCount, trashCount,
  uploadLanguage, liveLanguage,
  onUploadLanguageChange, onLiveLanguageChange,
  onFileSelected, onLiveClick
}: StatsCardsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
      <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />

      <HeroCard
        icon={<Sparkles className="w-7 h-7 md:w-8 md:h-8" />}
        title="Bắt đầu một cuộc họp mới"
        description="Tải lên file ghi âm có sẵn hoặc ghi âm trực tiếp. AI sẽ tự động phiên âm, phân biệt người nói và tóm tắt."
        stepNumber={1}
        totalSteps={3}
        primaryAction={{
          label: "Tải file lên",
          icon: <UploadCloud className="w-4 h-4" />,
          onClick: () => fileInputRef.current?.click(),
        }}
        secondaryAction={{
          label: "Ghi âm trực tiếp",
          icon: <Mic className="w-4 h-4" />,
          onClick: onLiveClick,
        }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard icon={<Calendar className="w-5 h-5" />} label="Tổng cuộc họp" value={totalMeetings} intent="primary" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Tổng thời lượng" value={formatDuration(totalDuration)} intent="success" />
        <StatCard icon={<Loader2 className="w-5 h-5" />} label="Đang xử lý" value={processingCount} intent="warning" />
        <StatCard icon={<Trash2 className="w-5 h-5" />} label="Thùng rác" value={trashCount} intent="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>Ngôn ngữ upload:</span>
        <SegmentedControl
          options={[
            { value: "vi", label: "🇻🇳 VI" },
            { value: "en", label: "🇬🇧 EN" },
          ]}
          value={uploadLanguage}
          onChange={onUploadLanguageChange}
          size="sm"
        />
        <span className="ml-2">Ngôn ngữ live:</span>
        <SegmentedControl
          options={[
            { value: "vi", label: "🇻🇳 VI" },
            { value: "en", label: "🇬🇧 EN" },
          ]}
          value={liveLanguage}
          onChange={onLiveLanguageChange}
          size="sm"
        />
      </div>
    </div>
  );
}
