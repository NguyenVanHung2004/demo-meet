"use client";

import React, { useState, useEffect } from "react";
import DashboardState from "./components/DashboardState";
import EditorState from "./components/EditorState";
import LiveRecordingState from "./components/LiveRecordingState";
import MeetingDetailState from "./components/MeetingDetailState"; 
import PollingManager from "./components/PollingManager";

import { saveMeeting, seedInitialData, Meeting } from "./lib/db";
import { parseTranscriptFile } from "./lib/parser";
import { RAW_TRANSCRIPT_FILE } from "./lib/mockData";
import { uploadAudioFile } from "./lib/api"; 
import { useGlobalUI } from "./context/GlobalUIProvider";
import { requestSummary } from "./lib/api"; // Import hàm gọi Gemini
import { updateMeetingProcess } from "./lib/db"; // Import hàm update DB

export type AppState = 'DASHBOARD' | 'PROCESSING' | 'EDITOR' | 'LIVE_RECORDING' | 'MEETING_DETAIL';

export default function Page() {
  const [currentState, setCurrentState] = useState<AppState>('DASHBOARD');
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const { toast, confirm } = useGlobalUI(); // [MỚI]
  useEffect(() => {
    seedInitialData();
  }, []);

  // --- NAVIGATION ---
  const handleDirectEdit = (meeting: Meeting) => {
    const url = URL.createObjectURL(meeting.audioBlob);
    setAudioUrl(url);
    setCurrentMeeting(meeting);
    setCurrentState('EDITOR');
  };

  const handleViewDetail = (meeting: Meeting) => {
    const url = URL.createObjectURL(meeting.audioBlob);
    setAudioUrl(url);
    setCurrentMeeting(meeting);
    setCurrentState('MEETING_DETAIL');
  };

  const handleSwitchToEdit = () => {
    setCurrentState('EDITOR');
  };

  const handleBackToDashboard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setCurrentMeeting(null);
    setCurrentState('DASHBOARD');
  };

  const handleBackFromEditor = () => {
      handleBackToDashboard();
  };

  const triggerRefresh = () => setRefreshSignal(prev => prev + 1);

  // --- LOGIC ---

  const handleFileUpload = async (file: File) => {
      // 1. Tạo ID tạm thời
      const tempId = `job-${Date.now()}`;

      // 2. [QUAN TRỌNG] Tạo object Meeting và hiển thị ngay lập tức
      const newMeeting: Meeting = {
        id: tempId,
        jobId: undefined, // Chưa có Job ID thật, sẽ update sau
        title: file.name.replace(/\.[^/.]+$/, ""), // Tên file bỏ đuôi
        createdAt: Date.now(),
        duration: 0, 
        audioBlob: file,
        segments: [],
        speakers: [],
        status: 'transcribing', // Set trạng thái đang xử lý ngay
        isDeleted: false
      };

      // Lưu vào DB -> UI Dashboard sẽ tự động cập nhật nhờ PollingManager hoặc triggerRefresh
      await saveMeeting(newMeeting);
      triggerRefresh(); 
      toast.info("Đang tải lên và xử lý...");

      try {
        console.log("--> Uploading to Python...");
        
        // 3. Gọi API Upload (Hàm này giờ đã trả về Job ID thay vì text)
        const runpodJobId = await uploadAudioFile(file);
        
        console.log("--> Nhận Job ID:", runpodJobId);

        // 4. Update lại meeting trong DB với Job ID thật để PollingManager bắt đầu làm việc
        // (Lưu ý: PollingManager của bạn sẽ quét các meeting có status='transcribing' và có jobId)
        const updatedMeeting = { 
          ...newMeeting, 
          id: `job-${runpodJobId}`, // [Tùy chọn] Có thể đổi ID meeting theo JobID hoặc giữ ID cũ
          jobId: runpodJobId 
        };

        // Xóa bản ghi tạm cũ (nếu bạn đổi ID) hoặc chỉ cần update bản ghi cũ
        // Ở đây để đơn giản ta update bản ghi cũ:
        await saveMeeting({ ...newMeeting, jobId: runpodJobId });
        
        // Nếu bạn muốn đổi ID meeting thành job-id của runpod thì cần xóa cái cũ đi:
        // await deleteMeetingPermanent(tempId);
        // await saveMeeting(updatedMeeting);

        toast.success("Đã gửi yêu cầu xử lý! Bạn có thể làm việc khác.");
        triggerRefresh();

      } catch (error) {
        console.error("Lỗi xử lý:", error);
        toast.error("Có lỗi khi upload: " + error);
        
        // Update trạng thái lỗi cho meeting
        await saveMeeting({ 
          ...newMeeting, 
          status: 'failed', 
          errorMessage: (error as Error).message 
        });
        triggerRefresh();
      }
    };
  // Flow 2: Demo Data
  const handleStartDemo = async () => {
    setCurrentState('PROCESSING');
    setTimeout(async () => {
      const res = await fetch("/demo.mp3");
      const blob = await res.blob();
      const parsed = parseTranscriptFile(RAW_TRANSCRIPT_FILE);
      
      const demoMeeting: Meeting = {
        id: `demo-${Date.now()}`,
        title: "Talkshow: Tương lai ngành xuất bản (AI Processed)",
        createdAt: Date.now(),
        duration: 480,
        audioBlob: blob,
        segments: parsed.segments,
        speakers: parsed.speakers,
        status: 'transcribed', // Demo coi như đã xử lý xong
        isDeleted: false
      };
      
      await saveMeeting(demoMeeting);
      handleDirectEdit(demoMeeting); 
    }, 1500);
  };

  // Flow 3: Live Recording (Xử lý tại trình duyệt)
  const handleFinishLive = async (recordedText: string, recordedAudioUrl: string, finalSummary: string) => {
    
    // [SỬA LỖI] Thay vì chia theo số từ (word count), ta chia theo dòng (newline)
    // Logic này tôn trọng việc bạn ngắt nghỉ lúc ghi âm
    const lines = recordedText.split("\n").filter(line => line.trim() !== "");
    
    const newSegments = lines.map((line, index) => {
        // Ước lượng thời gian (giả lập): mỗi câu khoảng 3-5 giây
        // Vì Web Speech API không trả về thời gian thực của từng câu
        const start = index * 5;
        const end = start + 5;
        
        // Làm sạch text: Xóa dấu gạch đầu dòng "- " nếu có
        const cleanText = line.trim().replace(/^- /, "");

        return {
            id: index.toString(),
            speakerId: "SPEAKER_00", // Mặc định là 1 người
            start: start,
            end: end,
            text: cleanText
        };
    });

    const res = await fetch(recordedAudioUrl);
    const blob = await res.blob();

    const newMeeting: Meeting = {
      id: `rec-${Date.now()}`,
      title: `Ghi âm trực tiếp ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      duration: newSegments.length * 5, // Tổng thời gian ước lượng
      audioBlob: blob,
      segments: newSegments, // [QUAN TRỌNG] Dùng segments đã chia theo dòng
      summary: finalSummary,
      speakers: [{ id: "SPEAKER_00", name: "Tôi (Ghi âm)", color: "bg-blue-50 text-blue-700 border-blue-200" }],
      
      status: 'completed', 
      isDeleted: false,
    };

    await saveMeeting(newMeeting);
    
    // Chuyển thẳng vào màn hình Editor để sửa luôn
    handleViewDetail(newMeeting); 
  };
  
    // ✅ [MỚI] Hàm xử lý tóm tắt chạy ngầm (Fire-and-Forget)
  const handleBackgroundSummarize = async (meetingId: string, transcriptText: string) => {
      // 1. Cập nhật trạng thái "Đang tóm tắt" ngay lập tức để Dashboard hiện icon xoay
      await updateMeetingProcess(meetingId, { status: 'summarizing' });
      triggerRefresh(); 
      
      // 2. Chạy bất đồng bộ (KHÔNG await ở đây để không chặn UI)
      requestSummary(transcriptText)
        .then(async (summary) => {
            // Khi xong -> Lưu vào DB
            await updateMeetingProcess(meetingId, {
                status: 'completed',
                summary: summary
            });
            toast.success(`Đã tóm tắt xong cuộc họp: ${meetingId.split('-')[1] || '...'}`);
            triggerRefresh(); // Reload Dashboard
        })
        .catch(async (error) => {
            // Nếu lỗi
            console.error("Background Summary Error:", error);
            await updateMeetingProcess(meetingId, {
                status: 'failed',
                errorMessage: error.message
            });
            toast.error("Lỗi tóm tắt ngầm: " + error.message);
            triggerRefresh();
        });
  };
  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      <PollingManager onUpdate={triggerRefresh} />
      
      {currentState === 'DASHBOARD' && (
        <DashboardState 
          refreshSignal={refreshSignal}
          onImport={handleFileUpload} 
          onUseSample={handleStartDemo}
          onLive={() => setCurrentState('LIVE_RECORDING')}
          onOpenMeeting={handleViewDetail}
        />
      )}

      {currentState === 'PROCESSING' && (
         <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-600 font-medium">Đang xử lý dữ liệu...</p>
         </div>
      )}

      {currentState === 'LIVE_RECORDING' && (
        <LiveRecordingState 
          onFinish={handleFinishLive} 
          onBack={() => setCurrentState('DASHBOARD')} 
        />
      )}

      {currentState === 'MEETING_DETAIL' && currentMeeting && audioUrl && (
        <MeetingDetailState 
          meeting={currentMeeting}
          audioSrc={audioUrl}
          onBack={handleBackToDashboard}
          onEdit={handleSwitchToEdit}
        />
      )}

      {currentState === 'EDITOR' && currentMeeting && audioUrl && (
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