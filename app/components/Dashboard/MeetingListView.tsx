"use client";
import type { Meeting } from "@/app/lib/db";
import { MEETING_STATUS, MeetingStatus } from "@/app/lib/constants";
import Badge from "../ui/Badge";
import {
  Calendar, Trash2, RotateCcw,
  Wand2, FolderOpen, Edit3, Eye, Loader2, Clock
} from "lucide-react";

type DashboardTab = "all" | "trash";

interface MeetingListViewProps {
  meetings: Meeting[];
  currentTab: DashboardTab;
  selectedIds: string[];
  loading: boolean;
  isFinalizing: string | null;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenMeeting: (m: Meeting) => void;
  onReprocess: (m: Meeting) => void;
  onFinalizeDraft: (e: React.MouseEvent, m: Meeting) => void;
  onMoveToTrash: (e: React.MouseEvent, id: string) => void;
  onRestore: (e: React.MouseEvent, id: string) => void;
  onDeleteForever: (e: React.MouseEvent, id: string) => void;
  onMoveSelectedToTrash: () => void;
  onDeleteSelected: () => void;
  onEmptyTrash: () => void;
}

export default function MeetingListView({
  meetings, currentTab, selectedIds, loading, isFinalizing,
  onToggleSelect, onToggleSelectAll,
  onOpenMeeting, onReprocess, onFinalizeDraft,
  onMoveToTrash, onRestore, onDeleteForever,
  onMoveSelectedToTrash, onDeleteSelected, onEmptyTrash
}: MeetingListViewProps) {
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/2" />
              <div className="h-3 bg-slate-100 rounded w-1/4" />
            </div>
            <div className="h-6 w-16 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 md:py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
          {currentTab === "all" ? (
            <Calendar className="w-6 h-6 md:w-8 md:h-8" />
          ) : (
            <Trash2 className="w-6 h-6 md:w-8 md:h-8" />
          )}
        </div>
        <p className="text-slate-500 font-medium text-sm">Danh sách trống.</p>
      </div>
    );
  }

  const isInteractiveStatuses: MeetingStatus[] = [
    MEETING_STATUS.TRANSCRIBED, MEETING_STATUS.SUMMARIZING,
    MEETING_STATUS.COMPLETED, MEETING_STATUS.FAILED, MEETING_STATUS.DRAFT
  ];

  return (
    <div id="tour-list" className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {meetings.length} Cuộc họp
        </h3>
        {meetings.length > 0 && (
          <div className="flex gap-2">
            {selectedIds.length > 0 && currentTab === "all" && (
              <button
                onClick={onMoveSelectedToTrash}
                className="text-xs text-red-600 font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors shadow-sm"
              >
                Xóa đã chọn ({selectedIds.length})
              </button>
            )}
            {selectedIds.length > 0 && currentTab === "trash" && (
              <button
                onClick={onDeleteSelected}
                className="text-xs text-red-600 font-medium hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors shadow-sm"
              >
                Xóa vĩnh viễn ({selectedIds.length})
              </button>
            )}
            {currentTab === "trash" && (
              <button
                onClick={onEmptyTrash}
                className="text-xs text-white bg-red-600 hover:bg-red-700 font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                Dọn sạch thùng rác
              </button>
            )}
          </div>
        )}
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-4 py-4 w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.length === meetings.length && meetings.length > 0}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="px-6 py-4">Tên cuộc họp</th>
              <th className="px-6 py-4">Thời lượng</th>
              <th className="px-6 py-4">Ngày tạo</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {meetings.map((m) => {
              const isInteractive = isInteractiveStatuses.includes(m.status);
              return (
                <tr
                  key={m.id}
                  onClick={() => isInteractive && onOpenMeeting(m)}
                  className={`group transition-colors ${isInteractive ? "hover:bg-indigo-50/50 cursor-pointer" : "bg-slate-50 opacity-70"}`}
                >
                  <td className="px-4 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(m.id)}
                      onChange={() => onToggleSelect(m.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${m.status === MEETING_STATUS.FAILED ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"}`}>
                        {m.title.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-700 group-hover:text-indigo-700 transition-colors line-clamp-1 max-w-[200px]">
                        {m.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-sm">{formatDuration(m.duration)}</td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-6 py-4"><Badge status={m.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 transition-opacity">
                      {currentTab === "all" && ([MEETING_STATUS.COMPLETED, MEETING_STATUS.TRANSCRIBED, MEETING_STATUS.FAILED] as MeetingStatus[]).includes(m.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onReprocess(m); }}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Xử lý lại"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                      {m.status === MEETING_STATUS.DRAFT && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onFinalizeDraft(e, m); }}
                            disabled={isFinalizing === m.id}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-bold text-xs disabled:opacity-50"
                            title="Đồng bộ lên cloud"
                          >
                            {isFinalizing === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      {([MEETING_STATUS.COMPLETED, MEETING_STATUS.TRANSCRIBED] as MeetingStatus[]).includes(m.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenMeeting(m); }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Xem/Sửa"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {currentTab === "all" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onMoveToTrash(e, m.id); }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {currentTab === "trash" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onRestore(e, m.id); }}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Khôi phục"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteForever(e, m.id); }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa vĩnh viễn"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden grid grid-cols-1 gap-3">
        {meetings.map((m) => {
          const isInteractive = isInteractiveStatuses.includes(m.status);
          return (
            <div
              key={m.id}
              onClick={() => isInteractive && onOpenMeeting(m)}
              className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${isInteractive ? "cursor-pointer hover:shadow-md active:scale-[0.99]" : "opacity-70"}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${m.status === MEETING_STATUS.FAILED ? "bg-red-100 text-red-600" : m.status === MEETING_STATUS.COMPLETED ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-600"}`}>
                    {m.title.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <span className="block font-medium text-slate-700 line-clamp-1">{m.title}</span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" /> {formatDuration(m.duration)}
                      <span>·</span>
                      <Calendar className="w-3 h-3" /> {new Date(m.createdAt).toLocaleDateString("vi-VN")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Badge status={m.status} />
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {m.status === MEETING_STATUS.DRAFT && (
                    <button
                      onClick={(e) => onFinalizeDraft(e, m)}
                      disabled={isFinalizing === m.id}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Lưu lên cloud"
                    >
                      {isFinalizing === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                  {([MEETING_STATUS.COMPLETED, MEETING_STATUS.TRANSCRIBED] as MeetingStatus[]).includes(m.status) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenMeeting(m); }}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Xem"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
