"use client";
import { useState, useMemo } from "react";
import type { Meeting } from "@/app/lib/db";
import { MEETING_STATUS } from "@/app/lib/constants";
import { Calendar, Trash2 } from "lucide-react";
import MeetingCard from "./MeetingCard";
import MeetingListFilter, { type SortBy, type StatusFilter } from "./MeetingListFilter";
import BulkActionBar from "@/app/components/ui/BulkActionBar";
import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

type DashboardTab = "all" | "trash";

interface MeetingListViewProps {
  meetings: Meeting[];
  currentTab: DashboardTab;
  selectedIds: string[];
  loading: boolean;
  isFinalizing: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
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
  onNavigateToUpload?: () => void;
  onNavigateToLive?: () => void;
}

export default function MeetingListView({
  meetings, currentTab, selectedIds, loading, isFinalizing, hasMore, onLoadMore,
  onToggleSelect, onToggleSelectAll, onOpenMeeting, onReprocess, onFinalizeDraft,
  onMoveToTrash, onRestore, onDeleteForever,
  onMoveSelectedToTrash, onDeleteSelected, onEmptyTrash,
  onNavigateToUpload, onNavigateToLive
}: MeetingListViewProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredMeetings = useMemo(() => {
    let result = meetings;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m => m.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter(m => m.status === statusFilter);
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "newest": return b.createdAt - a.createdAt;
        case "oldest": return a.createdAt - b.createdAt;
        case "title": return a.title.localeCompare(b.title);
        case "duration": return (b.duration || 0) - (a.duration || 0);
        default: return 0;
      }
    });
    return result;
  }, [meetings, search, sortBy, statusFilter]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
              <div className="h-6 w-16 rounded-full bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredMeetings.length === 0) {
    if (currentTab === "trash") {
      return (
        <EmptyState
          icon={<Trash2 className="w-8 h-8" />}
          title="Thùng rác trống"
          description="Các cuộc họp đã xóa sẽ xuất hiện ở đây."
        />
      );
    }
    return (
      <EmptyState
        icon={<Calendar className="w-8 h-8" />}
        title="Chưa có cuộc họp nào"
        description="Tải lên file audio hoặc ghi âm trực tiếp để bắt đầu."
        action={
          <div className="flex gap-3">
            {onNavigateToUpload && (
              <Button variant="primary" onClick={onNavigateToUpload}>Tải file lên</Button>
            )}
            {onNavigateToLive && (
              <Button variant="outline" onClick={onNavigateToLive}>Ghi âm trực tiếp</Button>
            )}
          </div>
        }
      />
    );
  }

  return (
    <div>
      {currentTab === "all" && meetings.length > 0 && (
        <MeetingListFilter
          search={search}
          sortBy={sortBy}
          statusFilter={statusFilter}
          onSearchChange={setSearch}
          onSortChange={setSortBy}
          onStatusFilterChange={setStatusFilter}
        />
      )}

      <div id="tour-list" className="space-y-2 md:space-y-3">
        {currentTab === "trash" && (
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">{meetings.length} mục trong thùng rác</p>
            <Button variant="danger" size="sm" onClick={onEmptyTrash}>Dọn sạch thùng rác</Button>
          </div>
        )}

        {filteredMeetings.map((m) => (
          <MeetingCard
            key={m.id}
            meeting={m}
            currentTab={currentTab}
            isSelected={selectedIds.includes(m.id)}
            isFinalizing={isFinalizing === m.id}
            onToggleSelect={() => onToggleSelect(m.id)}
            onOpen={() => onOpenMeeting(m)}
            onReprocess={() => onReprocess(m)}
            onFinalizeDraft={() => onFinalizeDraft({ stopPropagation: () => {} } as any, m)}
            onMoveToTrash={() => onMoveToTrash({ stopPropagation: () => {} } as any, m.id)}
            onRestore={() => onRestore({ stopPropagation: () => {} } as any, m.id)}
            onDeleteForever={() => onDeleteForever({ stopPropagation: () => {} } as any, m.id)}
          />
        ))}
      </div>

      {hasMore && currentTab === "all" && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={onLoadMore}>Tải thêm</Button>
        </div>
      )}

      <BulkActionBar
        selectedCount={selectedIds.length}
        actions={
          currentTab === "all"
            ? [{ label: "Xóa đã chọn", icon: <Trash2 className="w-4 h-4" />, onClick: onMoveSelectedToTrash, intent: "danger" }]
            : [{ label: "Xóa vĩnh viễn", icon: <Trash2 className="w-4 h-4" />, onClick: onDeleteSelected, intent: "danger" }]
        }
        onClear={() => onToggleSelectAll()}
      />
    </div>
  );
}
