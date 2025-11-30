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

  // Flow 1: Upload File (Gửi Server xử lý ngầm)
  const handleFileUpload = async (file: File) => {
    try {
      console.log("--> Uploading to Python...");
      const jobId = await uploadAudioFile(file);
      
      const newMeeting: Meeting = {
        id: `job-${jobId}`,
        jobId: jobId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        createdAt: Date.now(),
        duration: 0, 
        audioBlob: file,
        segments: [],
        speakers: [],
        status: 'transcribing', // Upload thì phải chờ Server xử lý -> Transcribing
        isDeleted: false
      };

      await saveMeeting(newMeeting);
      toast.info("Đã tải lên! Hệ thống sẽ xử lý ngầm.");
      triggerRefresh();
      setCurrentState('DASHBOARD');

    } catch (error) {
      console.error("Lỗi xử lý:", error);
      toast.error("Có lỗi khi upload: " + error);
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
    // Giả lập tách đoạn đơn giản cho Live text
    const words = recordedText.split(" ");
    const chunkSize = 20;
    const newSegments = [];
    let currentTime = 0;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkText = words.slice(i, i + chunkSize).join(" ");
      const dur = chunkText.length * 0.05; // Ước lượng thời gian
      newSegments.push({
        id: i.toString(),
        speakerId: "SPEAKER_00",
        start: currentTime,
        end: currentTime + dur,
        text: chunkText
      });
      currentTime += dur;
    }

    const res = await fetch(recordedAudioUrl);
    const blob = await res.blob();

    const newMeeting: Meeting = {
      id: `rec-${Date.now()}`,
      title: `Ghi âm trực tiếp ${new Date().toLocaleTimeString()}`,
      createdAt: Date.now(),
      duration: currentTime,
      audioBlob: blob,
      segments: newSegments,
      summary: finalSummary,
      speakers: [{ id: "SPEAKER_00", name: "Tôi (Ghi âm)", color: "bg-blue-50 text-blue-700 border-blue-200" }],
      
      // [SỬA LẠI Ở ĐÂY]
      // Vì ghi âm trực tiếp đã có text ngay lập tức (từ Web Speech API)
      // Nên trạng thái là 'transcribed' (Đã có biên bản) luôn.
      status: 'completed', 
      isDeleted: false,
    };

    await saveMeeting(newMeeting);
    
    // Chuyển thẳng vào màn hình Editor để sửa luôn
    handleViewDetail(newMeeting); 
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
        />
      )}
    </main>
  );
}