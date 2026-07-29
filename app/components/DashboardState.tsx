"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  getAllMeetings,
  Meeting,
  toggleTrashMeeting,
  deleteMeetingPermanent,
} from "../lib/db";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useAuth } from "../context/AuthContext";
import UploadModal from "./Dashboard/UploadModal";
import LiveSetupModal from "./Dashboard/LiveSetupModal";
import Sidebar from "./Dashboard/Sidebar";
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
  onImport: (file: File, language: "vi" | "en", title?: string, objectives?: string) => void;
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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<DashboardTab>("all");
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
  const [liveLanguageState, setLiveLanguageState] = useState<"vi" | "en">("vi");

  const handleTabChange = (tab: DashboardTab) => {
    setCurrentTab(tab);
    setSelectedIds([]);
  };

  const loadMeetings = async () => {
    if (user) {
      setLoading(true);
      try {
        // 1. Load Cloud Meetings (exclude minute-only imports)
        const allCloudMeetings = await getAllMeetings(user.uid);
        const cloudMeetings = allCloudMeetings.filter(m => !m.isMinuteOnly);

        // 2. Load Local Drafts
        const { getAllDraftsMeta } = await import("../lib/indexedDB");
        const localDrafts = await getAllDraftsMeta(user.uid);

        const all = [...localDrafts, ...cloudMeetings].sort((a, b) => b.createdAt - a.createdAt);
        setMeetings(all);

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
  };

  useEffect(() => {
    loadMeetings();
  }, [refreshSignal, user]);

  // --- ACTIONS ---
  const handleMoveToTrash = async (e: React.MouseEvent, id: string) => {
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
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleTrashMeeting(id, false);
    toast.success("Đã khôi phục cuộc họp");
    loadMeetings();
  };

  const handleDeleteForever = async (e: React.MouseEvent, id: string) => {
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
  };

  const handleFinalizeDraft = async (e: React.MouseEvent, m: Meeting) => {
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
  };

  const handleEmptyTrash = async () => {
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
  };

  const handleDeleteSelected = async () => {
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
  };

  const handleMoveSelectedToTrash = async () => {
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
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredMeetings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredMeetings.map(m => m.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // --- FILTERING ---
  const filteredMeetings = meetings.filter((m) => {
    if (currentTab === "trash") return m.isDeleted;
    return !m.isDeleted;
  });

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative font-sans">
      <Sidebar currentTab={currentTab} onTabChange={handleTabChange} onLogout={logout} />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
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
              uploadLanguage={uploadLanguage}
              liveLanguage={liveLanguage}
              onUploadLanguageChange={setUploadLanguage}
              onLiveLanguageChange={setLiveLanguage}
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
            isFinalizing={isFinalizing}
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
          />
      </div>

      </div>

      {selectedFileForUpload && (
        <UploadModal
          selectedFile={selectedFileForUpload}
          uploadTitle={uploadTitle}
          uploadObjectives={uploadObjectives}
          uploadLanguage={uploadLanguageState}
          onTitleChange={setUploadTitle}
          onObjectivesChange={setUploadObjectives}
          onLanguageChange={setUploadLanguageState}
          onConfirm={() => {
            onImport(selectedFileForUpload, uploadLanguageState, uploadTitle, uploadObjectives);
            setSelectedFileForUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          onCancel={() => {
            setSelectedFileForUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      )}
      {showLiveSetupModal && (
        <LiveSetupModal
          liveTitle={liveTitle}
          liveObjectives={liveObjectives}
          liveLanguage={liveLanguageState}
          onTitleChange={setLiveTitle}
          onObjectivesChange={setLiveObjectives}
          onLanguageChange={setLiveLanguageState}
          onConfirm={() => {
            onLive(liveLanguageState, liveTitle, liveObjectives);
            setShowLiveSetupModal(false);
          }}
          onCancel={() => setShowLiveSetupModal(false)}
        />
      )}
    </div>
  );
}
