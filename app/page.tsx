"use client";

import React, { useState, useEffect } from "react";
import DashboardState from "./components/DashboardState";
import EditorState from "./components/EditorState";
import LiveRecordingState from "./components/LiveRecordingState";
import MeetingDetailState from "./components/MeetingDetailState";
import PollingManager from "./components/PollingManager";
import { deleteField } from "firebase/firestore"; // [MỚI]
import {
  saveMeeting,
  seedInitialData,
  Meeting,
  updateMeetingProcess,
} from "./lib/db";
import {
  uploadAudioToFirebase,
  startTranscriptionJob,
  requestSummary,
} from "./lib/api";
import { useGlobalUI } from "./context/GlobalUIProvider";
import { useAuth } from "./context/AuthContext";
import DriveImportModal from "./components/DriveImportModal"; // [MỚI]
import BotJoinModal from "./components/BotJoinModal"; // [MỚI]
import LoginState from "./components/LoginState";
export type AppState =
  | "DASHBOARD"
  | "PROCESSING"
  | "EDITOR"
  | "LIVE_RECORDING"
  | "MEETING_DETAIL";

export default function Page() {
  const { user, loading } = useAuth();
  const [currentState, setCurrentState] = useState<AppState>("DASHBOARD");
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false); // [MỚI]
  const [isBotModalOpen, setIsBotModalOpen] = useState(false); // [MỚI]
  const [selectedLiveLanguage, setSelectedLiveLanguage] = useState<"vi" | "en">("vi");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // [MỚI] State theo dõi tiến trình upload
  const { toast, confirm } = useGlobalUI(); // [MỚI]
  useEffect(() => {
    const initData = async () => {
      if (user) {
        // Hàm seed giờ trả về true/false
        const added = await seedInitialData(user.uid);
        // Nếu có thêm mới data thì mới refresh UI
        if (added) {
          triggerRefresh();
          toast.success("Đã tạo dữ liệu mẫu!");
        }
      }
    };
    initData();
  }, [user]);
  // [MỚI] Auto open Drive modal if redirected back from Google
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('drive_connected') === 'true') {
      setIsDriveModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
      toast.success("Kết nối Google Drive thành công!");
    }
  }, []); // Run once on mount

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) {
    return <LoginState />;
  }
  // --- NAVIGATION ---
  const handleDirectEdit = async (meeting: Meeting) => {
    let url = meeting.audioUrl;

    // [LOGIC MỚI] Nếu là draft -> Lấy Blob từ IndexedDB
    if (meeting.status === 'draft') {
      try {
        const { getDraftFull } = await import("./lib/indexedDB");
        const fullDraft = await getDraftFull(meeting.id);
        if (fullDraft?.audioBlob) {
          console.log("Loaded draft blob:", fullDraft.audioBlob.size, fullDraft.audioBlob.type);
          url = URL.createObjectURL(fullDraft.audioBlob);
        }
      } catch (e) {
        console.error("Failed to load draft audio", e);
        toast.error("Không thể tải file ghi âm nháp!");
      }
    }

    setAudioUrl(url || "");
    setCurrentMeeting(meeting);
    setCurrentState("EDITOR");
  };

  const handleViewDetail = async (meeting: Meeting) => {
    let url = meeting.audioUrl;

    if (meeting.status === 'draft') {
      try {
        const { getDraftFull } = await import("./lib/indexedDB");
        const fullDraft = await getDraftFull(meeting.id);
        if (fullDraft?.audioBlob) {
          url = URL.createObjectURL(fullDraft.audioBlob);
        }
      } catch (e) {
        console.error("Failed to load draft audio", e);
      }
    }

    setAudioUrl(url || "");
    setCurrentMeeting(meeting);
    setCurrentState("MEETING_DETAIL");
  };

  const handleSwitchToEdit = () => {
    setCurrentState("EDITOR");
  };

  const handleBackToDashboard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setCurrentMeeting(null);
    setCurrentState("DASHBOARD");
  };

  const handleBackFromEditor = () => {
    handleBackToDashboard();
  };

  const triggerRefresh = () => setRefreshSignal((prev) => prev + 1);

  // --- LOGIC ---

  const handleFileUpload = async (file: File, language: "vi" | "en" = "vi") => {
    if (!user) return toast.error("Vui lòng đăng nhập!");

    const tempId = crypto.randomUUID();
    setUploadProgress(0);
    try {
      // 1. Upload lên Firebase Storage
      const url = await uploadAudioToFirebase(file, user.uid, (progress) => {
        setUploadProgress(progress);
      });

      setUploadProgress(null);
      // 2. Trigger RunPod để lấy Job ID
      const jobId = await startTranscriptionJob(url, language);

      // 3. Lưu Meeting vào Firestore
      // PollingManager sẽ tự quét job này dựa trên status 'transcribing'
      const newMeeting: Meeting = {
        id: tempId,
        userId: user.uid,
        jobId: jobId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        createdAt: Date.now(),
        duration: 0,
        audioUrl: url,    // URL string
        segments: [],
        speakers: [],
        status: 'transcribing',
        isDeleted: false,
        language: language
      };

      await saveMeeting(newMeeting);

      toast.success("Đã gửi yêu cầu xử lý! Hệ thống sẽ tự động cập nhật.");
      triggerRefresh();

    } catch (error) {
      console.error("Lỗi upload:", error);
      toast.error("Có lỗi xảy ra: " + (error as Error).message);
      setUploadProgress(null);
    }
  };
  // Flow 2: Demo Data
  const handleStartDemo = async () => {
    if (!user) return toast.error("Vui lòng đăng nhập!");
    await seedInitialData(user.uid);
    triggerRefresh();
    toast.success("Đã tạo dữ liệu mẫu!");
  };
  // Flow 3: Live Recording (Xử lý tại trình duyệt)
  const handleLiveStart = (language: "vi" | "en") => {
    setSelectedLiveLanguage(language);
    setCurrentState("LIVE_RECORDING");
  };

  // [CẬP NHẬT] Nhận thêm tham số dbSegments từ component con gửi lên
  const handleFinishLive = () => {
    toast.success("Đã lưu ghi âm!");
    setCurrentState('DASHBOARD');
    triggerRefresh();
  };

  // ✅ [MỚI] Hàm xử lý tóm tắt chạy ngầm (Fire-and-Forget)
  const handleBackgroundSummarize = async (
    meetingId: string,
    transcriptText: string,
    templateStructure?: string // [NEW] Nhận thêm structure
  ) => {
    // 1. Cập nhật trạng thái "Đang tóm tắt" ngay lập tức để Dashboard hiện icon xoay
    await updateMeetingProcess(meetingId, { status: "summarizing" });
    triggerRefresh();

    // 2. Chạy bất đồng bộ (KHÔNG await ở đây để không chặn UI)
    requestSummary(transcriptText, templateStructure)
      .then(async (summary) => {
        // Khi xong -> Lưu vào DB
        await updateMeetingProcess(meetingId, {
          status: "completed",
          summary: summary,
        });
        toast.success(
          `Đã tóm tắt xong cuộc họp: ${meetingId.split("-")[1] || "..."}`
        );
        triggerRefresh(); // Reload Dashboard
      })
      .catch(async (error) => {
        // Nếu lỗi
        console.error("Background Summary Error:", error);
        await updateMeetingProcess(meetingId, {
          status: "failed",
          errorMessage: error.message,
        });
        toast.error("Lỗi tóm tắt ngầm: " + error.message);
        triggerRefresh();
      });
  };
  // ✅ [MỚI] Hàm xử lý lại: Lấy audio cũ -> Đẩy vào quy trình Upload xịn
  // --- LOGIC 5: XỬ LÝ LẠI (REPROCESS) ---
  const handleReprocess = async (meeting: Meeting) => {
    // 1. Check quyền
    if (!user) return toast.error("Vui lòng đăng nhập!");

    // [FIX] Kiểm tra audioUrl thay vì audioBlob
    if (!meeting.audioUrl) {
      toast.error("Không tìm thấy file ghi âm gốc (URL).");
      return;
    }

    // 2. Hỏi xác nhận
    const isConfirmed = await confirm({
      title: "Xử lý lại?",
      message: "Hệ thống sẽ chạy lại AI cho file này. Dữ liệu cũ (Segments/Summary) sẽ bị ghi đè. Bạn có chắc chắn?",
      confirmText: "Chạy lại",
      type: "info"
    });

    if (!isConfirmed) return;

    try {
      toast.info("Đang gửi lệnh xử lý lại...");

      // 3. [TỐI ƯU] Tái sử dụng URL cũ, KHÔNG CẦN UPLOAD LẠI
      // Chỉ việc gọi RunPod với url đang có sẵn trên Firebase
      const newJobId = await startTranscriptionJob(meeting.audioUrl, (meeting as any).language ?? "vi");

      // 4. Cập nhật lại bản ghi cũ trong Firestore
      // Đưa về trạng thái 'transcribing' để PollingManager bắt đầu làm việc
      await updateMeetingProcess(meeting.id, {
        status: 'transcribing',
        jobId: newJobId,      // Gắn Job ID mới
        segments: [],         // Xóa dữ liệu cũ đi cho sạch
        summary: deleteField() as any,
        errorMessage: deleteField() as any
      });

      triggerRefresh();
      toast.success("Đã bắt đầu xử lý lại!");

    } catch (e) {
      console.error(e);
      toast.error("Lỗi khi xử lý lại: " + (e as Error).message);
    }
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <PollingManager onUpdate={triggerRefresh} />

      {currentState === "DASHBOARD" && (
        <DashboardState
          refreshSignal={refreshSignal}
          onImport={handleFileUpload}
          onUseSample={handleStartDemo}
          onLive={handleLiveStart}
          onOpenMeeting={handleViewDetail}
          onReprocess={handleReprocess}
          onOpenDrive={() => setIsDriveModalOpen(true)}
          onOpenBot={() => setIsBotModalOpen(true)} // [MỚI]
        />
      )}

      {/* --- MODALS --- */}
      <DriveImportModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onImportSuccess={triggerRefresh} // [MỚI] Pass refresh handler
      />
      <BotJoinModal
        isOpen={isBotModalOpen}
        onClose={() => setIsBotModalOpen(false)}
      />

      {/* --- UPLOAD PROGRESS WIDGET (NON-BLOCKING) --- */}
      {uploadProgress !== null && (
        <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-72 md:w-80 p-5">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-8 h-8 flex-shrink-0 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="flex-1">
                <h3 className="text-slate-800 font-bold text-sm">Đang tải file lên...</h3>
                <p className="text-slate-500 text-xs">Vui lòng không tắt trang</p>
              </div>
              <div className="text-sm font-bold text-indigo-600">{uploadProgress}%</div>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-300 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {currentState === "PROCESSING" && (
        <div className="flex flex-col items-center justify-center h-full space-y-6">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Đang xử lý dữ liệu...</p>
        </div>
      )}

      {currentState === "LIVE_RECORDING" && (
        <LiveRecordingState
          initialLanguage={selectedLiveLanguage}
          onFinish={handleFinishLive}
          onBack={() => setCurrentState("DASHBOARD")}
        />
      )}

      {currentState === "MEETING_DETAIL" && currentMeeting && audioUrl && (
        <MeetingDetailState
          meeting={currentMeeting}
          audioSrc={audioUrl}
          onBack={handleBackToDashboard}
          onEdit={handleSwitchToEdit}
        />
      )}

      {currentState === "EDITOR" && currentMeeting && audioUrl && (
        <EditorState
          audioSrc={audioUrl}
          initialData={currentMeeting}
          onBack={handleBackFromEditor}
          onSummarize={handleBackgroundSummarize}
        />
      )}
    </main>
  );
}
