"use client";
import { useRouter } from "next/navigation";
import {
  FileText, Calendar, Clock, Square, CheckSquare,
  ChevronRight
} from "lucide-react";
import type { Meeting } from "@/app/lib/db";

interface MeetingListProps {
  meetings: Meeting[];
  loading: boolean;
  searchQuery: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onSelectAll?: () => void;
  getHighlightedSnippet: (content: string, query: string) => string;
  getSummaryPreview: (summary: string) => string;
  formatDate: (ts: number) => string;
  formatDuration: (sec: number) => string;
}

export default function MeetingList({
  meetings, loading, searchQuery, selectedIds,
  onToggleSelect, getHighlightedSnippet, getSummaryPreview,
  formatDate, formatDuration
}: MeetingListProps) {
  const router = useRouter();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Tên cuộc họp</th>
                <th className="px-6 py-4">Ngày tạo</th>
                <th className="px-6 py-4">Thời lượng</th>
                <th className="px-6 py-4">Nội dung</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-3/4"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                  <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-full"></div>
                      <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><div className="h-8 w-8 bg-slate-200 rounded"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="space-y-2 mt-4">
                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                    <div className="h-3 bg-slate-100 rounded w-4/5"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
          <FileText className="w-8 h-8" />
        </div>
        <p className="text-slate-500 font-medium">
          {searchQuery.trim()
            ? "Không tìm thấy biên bản phù hợp"
            : "Chưa có biên bản nào. Hãy import hoặc tạo cuộc họp mới!"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Tên cuộc họp</th>
              <th className="px-6 py-4">Ngày tạo</th>
              <th className="px-6 py-4">Thời lượng</th>
              <th className="px-6 py-4">Nội dung</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meetings.map((meeting) => (
              <tr
                key={meeting.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("meetingId", meeting.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => {
                  const url = `/minutes/${meeting.id}${searchQuery.trim() ? `?highlight=${encodeURIComponent(searchQuery.trim())}` : ""}`;
                  router.push(url);
                }}
                className="group hover:bg-indigo-50/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <button onClick={(e) => onToggleSelect(meeting.id, e)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                    {selectedIds.has(meeting.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">
                      {meeting.title.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 transition-colors line-clamp-1 max-w-[250px]">
                      {meeting.title}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">{formatDate(meeting.createdAt)}</td>
                <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                  {meeting.duration > 0 ? formatDuration(meeting.duration) : "-"}
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm max-w-md">
                  <div className="text-slate-600 line-clamp-2"
                    dangerouslySetInnerHTML={{
                      __html: searchQuery.trim()
                        ? getHighlightedSnippet(meeting.summary || "", searchQuery.trim())
                        : getSummaryPreview(meeting.summary || "")
                    }}
                  />
                </td>
                <td className="px-6 py-4">
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {meetings.map((meeting) => (
          <div
            key={meeting.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("meetingId", meeting.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => {
              const url = `/minutes/${meeting.id}${searchQuery.trim() ? `?highlight=${encodeURIComponent(searchQuery.trim())}` : ""}`;
              router.push(url);
            }}
            className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <button onClick={(e) => onToggleSelect(meeting.id, e)} className="mt-1 shrink-0">
                {selectedIds.has(meeting.id) ? <CheckSquare className="w-6 h-6 text-indigo-600" /> : <Square className="w-6 h-6 text-slate-300" />}
              </button>
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-sm">
                {meeting.title.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 mb-1 line-clamp-1">{meeting.title}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(meeting.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                  {meeting.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(meeting.duration)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-600 line-clamp-2"
                  dangerouslySetInnerHTML={{
                    __html: searchQuery.trim()
                      ? getHighlightedSnippet(meeting.summary || "", searchQuery.trim())
                      : getSummaryPreview(meeting.summary || "")
                  }}
                />
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
