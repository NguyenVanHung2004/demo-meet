"use client";
import React from "react";
import Link from "next/link";
import { Meeting, updateMeetingProcess } from "@/app/lib/db";
import { useState, useEffect } from "react";
import { useGlobalUI } from "@/app/context/GlobalUIProvider";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { sanitizeHtml } from "@/app/lib/sanitizeHtml";
import {
  Sparkles, FileText, AlignLeft, Edit3, Check
} from "lucide-react";

interface SummaryPanelProps {
  meeting: Meeting;
  isReadOnly: boolean;
  activeTab: "transcript" | "summary";
  onEdit: () => void;
  onScrollToSegment: (time: number) => void;
}

export default function SummaryPanel({
  meeting, isReadOnly, activeTab, onEdit, onScrollToSegment
}: SummaryPanelProps) {
  const { toast } = useGlobalUI();
  const [objectives, setObjectives] = useState(meeting.objectives || "");
  const [isEditingObjectives, setIsEditingObjectives] = useState(false);
  const [objectivesInput, setObjectivesInput] = useState(meeting.objectives || "");

  useEffect(() => {
    setObjectives(meeting.objectives || "");
    setObjectivesInput(meeting.objectives || "");
  }, [meeting.objectives]);

  const formatHtmlSummary = (html: string) => {
    if (!html) return "";
    return html.replace(/\[(\d{1,2}):(\d{2})\]/g, (match, mins, secs) => {
      const totalSecs = parseInt(mins) * 60 + parseInt(secs);
      return `<span role="button" class="timestamp-btn inline-block cursor-pointer select-none px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono text-[11px] font-bold border border-indigo-100 shadow-sm mx-0.5 hover:bg-indigo-100 transition-colors" data-time="${totalSecs}">${match}</span>`;
    });
  };

  const renderTextWithTimestamps = (text: string) => {
    if (typeof text !== "string") return text;
    const parts = text.split(/(\[\d{1,2}:\d{2}\])/g);
    return parts.map((part, i) => {
      const match = part.match(/\[(\d{1,2}):(\d{2})\]/);
      if (match) {
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        const totalSecs = mins * 60 + secs;
        return (
          <span
            key={i}
            role="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onScrollToSegment(totalSecs);
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-mono text-[11px] font-bold transition-colors mx-0.5 border border-indigo-100 shadow-sm cursor-pointer select-none"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, child => {
      if (typeof child === "string") {
        return renderTextWithTimestamps(child);
      }
      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        const nested = child.props.children;
        if (nested !== undefined) {
          return React.cloneElement(child, {
            ...child.props,
            children: processChildren(nested),
          } as Partial<typeof child.props>);
        }
      }
      if (Array.isArray(child)) {
        return processChildren(child);
      }
      return child;
    });
  };

  const MarkdownComponents: Components = {
    p: ({ children }) => <p className="mb-4 leading-relaxed">{processChildren(children)}</p>,
    li: ({ children }) => <li className="mb-2">{processChildren(children)}</li>,
    h1: ({ children }) => <h1 className="text-xl font-bold text-slate-900 mt-6 mb-3 border-b pb-1">{processChildren(children)}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold text-indigo-700 mt-5 mb-2">{processChildren(children)}</h2>,
    h3: ({ children }) => <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">{processChildren(children)}</h3>,
    strong: ({ children }) => <strong className="font-bold text-slate-900">{processChildren(children)}</strong>,
    em: ({ children }) => <em className="italic">{processChildren(children)}</em>,
    code: ({ children }) => <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[12px] font-mono">{processChildren(children)}</code>,
  };

  const formatTimeCode = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`lg:w-2/5 md:w-[350px] bg-slate-50 flex flex-col shrink-0 ${activeTab === "summary" ? "flex flex-1" : "hidden md:flex"}`}>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32">
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-orange-50">
            <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Tóm tắt
            </h3>
            {!isReadOnly && (
              <Link
                href={`/minutes/${meeting.id}`}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline uppercase tracking-tight flex items-center gap-1 transition-colors"
              >
                <FileText className="w-3 h-3" /> Xem chi tiết
              </Link>
            )}
          </div>
          {meeting.summary ? (
            <div
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains("timestamp-btn")) {
                  e.preventDefault();
                  e.stopPropagation();
                  const time = parseInt(target.getAttribute("data-time") || "0");
                  onScrollToSegment(time);
                }
              }}
            >
              {meeting.summary.startsWith("<") ? (
                <div
                  className="prose prose-sm text-slate-700 prose-headings:text-indigo-700 prose-strong:text-slate-900 leading-relaxed text-justify max-w-none"
                  dangerouslySetInnerHTML={{ __html: formatHtmlSummary(sanitizeHtml(meeting.summary)) }}
                />
              ) : (
                <div className="prose prose-sm text-slate-700 prose-headings:text-indigo-700 prose-strong:text-slate-900 leading-relaxed text-justify max-w-none">
                  <ReactMarkdown components={MarkdownComponents}>{meeting.summary}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <Sparkles className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm italic">Chưa có tóm tắt nào.</p>
              {!isReadOnly && (
                <button onClick={onEdit} className="mt-3 text-xs text-indigo-600 hover:underline font-medium">Tạo ngay trong Edit</button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlignLeft className="w-4 h-4 text-indigo-500" /> Mục tiêu cuộc họp
            </h3>
            {!isReadOnly && (
              <button
                onClick={() => {
                  if (isEditingObjectives) {
                    setObjectivesInput(objectives);
                    setIsEditingObjectives(false);
                  } else {
                    setIsEditingObjectives(true);
                  }
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
              >
                {isEditingObjectives ? (
                  <>Hủy</>
                ) : (
                  <><Edit3 className="w-3.5 h-3.5" /> Sửa</>
                )}
              </button>
            )}
          </div>

          {isEditingObjectives ? (
            <div className="space-y-3">
              <textarea
                value={objectivesInput}
                onChange={(e) => setObjectivesInput(e.target.value)}
                placeholder="Nhập mục tiêu cuộc họp..."
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium text-slate-700 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={async () => {
                    try {
                      setObjectives(objectivesInput);
                      meeting.objectives = objectivesInput;
                      await updateMeetingProcess(meeting.id, { objectives: objectivesInput.trim() || undefined });
                      setIsEditingObjectives(false);
                      toast.success("Đã cập nhật mục tiêu cuộc họp!");
                    } catch (err) {
                      toast.error("Lỗi khi lưu mục tiêu: " + (err as Error).message);
                    }
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all"
                >
                  <Check className="w-3 h-3 inline mr-1" /> Lưu mục tiêu
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed italic">
              {objectives ? objectives : "Chưa cấu hình mục tiêu cuộc họp."}
            </p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5 hidden md:block">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Metadata</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
              <span className="text-slate-500">Duration</span>
              <span className="font-mono font-medium text-slate-700">{formatTimeCode(meeting.duration)}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
              <span className="text-slate-500">Segments</span>
              <span className="font-mono font-medium text-slate-700">{meeting.segments.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Format</span>
              <span className="font-mono font-medium uppercase text-slate-700">AUDIO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
