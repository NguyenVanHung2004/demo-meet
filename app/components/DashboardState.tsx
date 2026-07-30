"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QueryDocumentSnapshot } from "firebase/firestore";
import {
  getMeetingsPaginated,
  Meeting,
  toggleTrashMeeting,
  deleteMeetingPermanent,
} from "../lib/db";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useAuth } from "../context/AuthContext";
import RecordSetupModal from "./Dashboard/RecordSetupModal";
import Header from "./Dashboard/Header";
import StatsCards from "./Dashboard/StatsCards";
import MeetingListView from "./Dashboard/MeetingListView";
import { MEETING_STATUS } from "../lib/constants";
type DashboardTab = "all" | "trash";

export default function DashboardState({
  onImport,
  onLive,
  onUseSample,
  onOpenMeeting,
  refreshSignal,
  onReprocess,
  onOpenDrive,
  onOpenBot
}: {
  onImport: (file: File, language: "vi" | "en", title?: string, objectives?: string) => Promise<void>;
  onLive: (language: "vi" | "en", title?: string, objectives?: string) => void;
  onUseSample: () => void;
  onOpenMeeting: (m: Meeting) => void;
  onReprocess: (m: Meeting) => void;
  onOpenDrive: () => void;
  onOpenBot: () => void;
  refreshSignal: number;
}) {
  const { user, login, logout } = useAuth();
  const { toast, confirm } = useGlobalUI();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);
  const currentTab = (searchParams.get("tab") === "trash" ? "trash" : "all") as DashboardTab;
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasShownDraftWarning = useRef(false);
  const [uploadLanguage, setUploadLanguage] = useState<"vi" | "en">("vi");
  const [liveLanguage, setLiveLanguage] = useState<"vi" | "en">("vi");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadObjectives, setUploadObjectives] = useState("");
  const [uploadLanguageState, setUploadLanguageState] = useState<"vi" | "en">("vi");
  const [showLiveSetupModal, setShowLiveSetupModal] = useState(false);
  const [liveTitle, setLiveTitle] = useState("");
  const [liveObjectives, setLiveObjectives] = useState("");
  const [isUploadLoading, setIsUploadLoading] = useState(false);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [liveLanguageState, setLiveLanguageState] = useState<"vi" | "en">("vi");

  const handleTabChange = useCallback((tab: DashboardTab) => {
    setSelectedIds([]);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("tab");
    else params.set("tab", "trash");
    router.replace(`/?${params.toString()}`);
  }, [searchParams, router]);

  const loadMeetings = useCallback(async () => {
    if (user) {
      setLoading(true);
      try {
        const { meetings: activeCloud, lastDoc: newLastDoc, hasMore: newHasMore } = await getMeetingsPaginated(user.uid, undefined, false);
        const cloudActive = activeCloud.filter(m => !m.isMinuteOnly);

        const { getAllMeetings } = await import("../lib/db");
        const allCloud = await getAllMeetings(user.uid);
        const cloudTrash = allCloud.filter(m => m.isDeleted);

        const { getAllDraftsMeta } = await import("../lib/indexedDB");
        const localDrafts = await getAllDraftsMeta(user.uid);

        const all = [...localDrafts, ...cloudActive, ...cloudTrash].sort((a, b) => b.createdAt - a.createdAt);
        setMeetings(all);
        setLastDoc(newLastDoc);
        setHasMore(newHasMore);

        if (localDrafts.length > 0 && !hasShownDraftWarning.current) {
          toast.info(`Bạn có ${localDrafts.length} bản nháp chưa lưu lên Cloud`);
          hasShownDraftWarning.current = true;
        }

      } catch (error) {
        console.error("Error loading meetings:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setMeetings([]);
    }
  }, [user, toast]);

  const loadMoreMeetings = useCallback(async () => {
    if (!user || !lastDoc || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const { meetings: moreMeetings, lastDoc: newLastDoc, hasMore: newHasMore } = await getMeetingsPaginated(user.uid, lastDoc, false);
      const filteredMore = moreMeetings.filter(m => !m.isMinuteOnly);
      setMeetings(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const uniqueNew = filteredMore.filter(m => !existingIds.has(m.id));
        return [...prev, ...uniqueNew];
      });
      setLastDoc(newLastDoc);
      setHasMore(newHasMore);
    } catch (error) {
      console.error("Error loading more meetings:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [user, lastDoc, hasMore, loadingMore]);

  useEffect(() => {
    loadMeetings();
  }, [refreshSignal, user, loadMeetings]);

  // --- ACTIONS ---
  const handleMoveToTrash = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: "Xóa cuộc họp?",
      message: "Cuộc họp sẽ được chuyển vào thùng rác.",
      confirmText: "Xóa",
      type: "danger",
    });

    if (isConfirmed) {

      const meetingToDelete = meetings.find(m => m.id === id);
      if (meetingToDelete?.status === MEETING_STATUS.DRAFT) {
        const { deleteDraft } = await import("../lib/indexedDB");
        await deleteDraft(id);
        toast.success("Đã xóa bản nháp vĩnh viễn");
        loadMeetings();
        return;
      }

      await toggleTrashMeeting(id, true);
      toast.success("Đã chuyển vào thùng rác");
      loadMeetings();
    }
  }, [meetings, confirm, toast, loadMeetings]);

  const handleRestore = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleTrashMeeting(id, false);
    toast.success("Đã khôi phục cuộc họp");
    loadMeetings();
  }, [loadMeetings, toast]);

  const handleDeleteForever = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: "Xóa vĩnh viễn?",
      message: "Hành động này không thể hoàn tác. Bạn chắc chứ?",
      confirmText: "Xóa vĩnh viễn",
      type: "danger",
    });
    if (isConfirmed) {
      // Logic xóa draft also
      const meetingToDelete = meetings.find(m => m.id === id);
      if (meetingToDelete?.status === MEETING_STATUS.DRAFT) {
        const { deleteDraft } = await import("../lib/indexedDB");
        await deleteDraft(id);
      } else {
        await deleteMeetingPermanent(id);
      }
      loadMeetings();
    }
  }, [meetings, confirm, toast, loadMeetings]);

  const handleFinalizeDraft = useCallback(async (e: React.MouseEvent, m: Meeting) => {
    e.stopPropagation();
    try {
      setIsFinalizing(m.id);
      toast.info("Đang đồng bộ bản nháp lên cloud...");

      const { getDraftFull, deleteDraft } = await import("../lib/indexedDB");
      const draft = await getDraftFull(m.id);
      if (!draft) {
        toast.error("Không tìm thấy dữ liệu bản nháp!");
        return;
      }

      const file = new File([draft.audioBlob], `${m.title}.webm`, { type: 'audio/webm' });

      const { uploadAudioToFirebase } = await import("../lib/api");
      const cloudUrl = await uploadAudioToFirebase(file, user?.uid || '');

      const finalMeeting = {
        ...draft.meta,
        audioUrl: cloudUrl,
        status: MEETING_STATUS.COMPLETED,
        jobId: undefined
      };

      const { saveMeeting } = await import("../lib/db");
      await saveMeeting(finalMeeting);
      await deleteDraft(m.id);

      toast.success("Đã gửi lên server thành công!");
      loadMeetings();
    } catch (err) {
      console.error(err);
      toast.error("Lỗi gửi lên server! " + (err as Error).message);
    } finally {
      setIsFinalizing(null);
    }
  }, [user, meetings, toast, loadMeetings]);

  const handleEmptyTrash = useCallback(async () => {
    const isConfirmed = await confirm({
      title: "Dọn dẹp thùng rác?",
      message: "Tất cả cuộc họp trong thùng rác sẽ bị xóa vĩnh viễn. Không thể hoàn tác.",
      confirmText: "Xóa tất cả",
      type: "danger",
    });
    if (isConfirmed) {
      const trashMeetings = meetings.filter(m => m.isDeleted);
      for (const m of trashMeetings) {
        if (m.status === MEETING_STATUS.DRAFT) {
          const { deleteDraft } = await import("../lib/indexedDB");
          await deleteDraft(m.id);
        } else {
          await deleteMeetingPermanent(m.id);
        }
      }
      setSelectedIds([]);
      loadMeetings();
    }
  }, [meetings, confirm, loadMeetings]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.length === 0) return;
    const isConfirmed = await confirm({
      title: `Xóa ${selectedIds.length} mục đã chọn?`,
      message: "Hành động này không thể hoàn tác.",
      confirmText: "Xóa",
      type: "danger",
    });
    if (isConfirmed) {
      for (const id of selectedIds) {
        const m = meetings.find(meeting => meeting.id === id);
        if (m) {
          if (m.status === MEETING_STATUS.DRAFT) {
            const { deleteDraft } = await import("../lib/indexedDB");
            await deleteDraft(m.id);
          } else {
            await deleteMeetingPermanent(m.id);
          }
        }
      }
      setSelectedIds([]);
      loadMeetings();
    }
  }, [selectedIds, meetings, confirm, loadMeetings]);

  const handleMoveSelectedToTrash = useCallback(async () => {
    if (selectedIds.length === 0) return;
    const isConfirmed = await confirm({
      title: `Chuyển ${selectedIds.length} mục vào thùng rác?`,
      message: "Các cuộc họp này sẽ được chuyển vào thùng rác.",
      confirmText: "Chuyển",
      type: "danger",
    });
    if (isConfirmed) {
      for (const id of selectedIds) {
        const m = meetings.find(meeting => meeting.id === id);
        if (m) {
          if (m.status === MEETING_STATUS.DRAFT) {
            const { deleteDraft } = await import("../lib/indexedDB");
            await deleteDraft(m.id);
          } else {
            await toggleTrashMeeting(m.id, true);
          }
        }
      }
      setSelectedIds([]);
      loadMeetings();
    }
  }, [selectedIds, meetings, confirm, loadMeetings]);

  // --- FILTERING ---
  const filteredMeetings = useMemo(() => meetings.filter((m) => {
    if (currentTab === "trash") return m.isDeleted;
    return !m.isDeleted;
  }), [meetings, currentTab]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredMeetings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMeetings.map(m => m.id));
    }
  }, [selectedIds, filteredMeetings]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <Header
        currentTab={currentTab}
        liveLanguage={liveLanguage}
        onLive={onLive}
        onOpenDrive={onOpenDrive}
        onOpenBot={onOpenBot}
        onLogout={logout}
      />

      {/* SCROLLABLE AREA */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
        {currentTab === "all" && (
            <StatsCards
              onFileSelected={(file) => {
                setSelectedFileForUpload(file);
                setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
                setUploadObjectives("");
                setUploadLanguageState(uploadLanguage);
              }}
              onLiveClick={() => {
                setLiveTitle(`Cuộc họp trực tiếp ${new Date().toLocaleDateString('vi-VN')}`);
                setLiveObjectives("");
                setLiveLanguageState(liveLanguage);
                setShowLiveSetupModal(true);
              }}
            />
          )}

          <MeetingListView
            meetings={filteredMeetings}
            currentTab={currentTab}
            selectedIds={selectedIds}
            loading={loading}
            loadingMore={loadingMore}
            isFinalizing={isFinalizing}
            hasMore={hasMore}
            onLoadMore={loadMoreMeetings}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpenMeeting={onOpenMeeting}
            onReprocess={onReprocess}
            onFinalizeDraft={handleFinalizeDraft}
            onMoveToTrash={handleMoveToTrash}
            onRestore={handleRestore}
            onDeleteForever={handleDeleteForever}
            onMoveSelectedToTrash={handleMoveSelectedToTrash}
            onDeleteSelected={handleDeleteSelected}
            onEmptyTrash={handleEmptyTrash}
            onNavigateToUpload={() => {
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = 'audio/*,video/*';
              fileInput.onchange = () => {
                const file = fileInput.files?.[0];
                if (file) {
                  setSelectedFileForUpload(file);
                  setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
                  setUploadObjectives("");
                  setUploadLanguageState(uploadLanguage);
                }
              };
              fileInput.click();
            }}
            onNavigateToLive={() => {
              setLiveTitle(`Cuộc họp trực tiếp ${new Date().toLocaleDateString('vi-VN')}`);
              setLiveObjectives("");
              setLiveLanguageState(liveLanguage);
              setShowLiveSetupModal(true);
            }}
          />
      </div>

      <RecordSetupModal
        mode="upload"
        isOpen={!!selectedFileForUpload}
        selectedFile={selectedFileForUpload}
        defaultTitle={uploadTitle}
        defaultObjectives={uploadObjectives}
        defaultLanguage={uploadLanguageState}
        loading={isUploadLoading}
        onTitleChange={setUploadTitle}
        onObjectivesChange={setUploadObjectives}
        onLanguageChange={setUploadLanguageState}
        onConfirm={async () => {
          setIsUploadLoading(true);
          try {
            if (selectedFileForUpload) {
              await onImport(selectedFileForUpload, uploadLanguageState, uploadTitle, uploadObjectives);
            }
          } finally {
            setIsUploadLoading(false);
          }
          setSelectedFileForUpload(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        onCancel={() => {
          setSelectedFileForUpload(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      <RecordSetupModal
        mode="live"
        isOpen={showLiveSetupModal}
        defaultTitle={liveTitle}
        defaultObjectives={liveObjectives}
        defaultLanguage={liveLanguageState}
        loading={isLiveLoading}
        onTitleChange={setLiveTitle}
        onObjectivesChange={setLiveObjectives}
        onLanguageChange={setLiveLanguageState}
        onConfirm={async () => {
          setIsLiveLoading(true);
          try {
            await onLive(liveLanguageState, liveTitle, liveObjectives);
          } finally {
            setIsLiveLoading(false);
          }
          setShowLiveSetupModal(false);
        }}
        onCancel={() => setShowLiveSetupModal(false)}
      />
    </div>
  );
}
