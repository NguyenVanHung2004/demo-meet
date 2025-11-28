"use client";

import React, { useState, useEffect } from "react";
import DashboardState from "./components/DashboardState";
import EditorState from "./components/EditorState";
import LiveRecordingState from "./components/LiveRecordingState";
import MeetingDetailState from "./components/MeetingDetailState"; 

import { saveMeeting, getAllMeetings, seedInitialData, Meeting } from "./lib/db";
import { parseTranscriptFile } from "./lib/parser";
import { RAW_TRANSCRIPT_FILE } from "./lib/mockData";

export type AppState = 'DASHBOARD' | 'PROCESSING' | 'EDITOR' | 'LIVE_RECORDING' | 'MEETING_DETAIL';

export default function Page() {
  const [currentState, setCurrentState] = useState<AppState>('DASHBOARD');
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Khởi tạo data mẫu
  useEffect(() => {
    seedInitialData();
  }, []);

  // ==========================================
  // 1. CÁC HÀM ĐIỀU HƯỚNG (NAVIGATION HANDLERS)
  // ==========================================

  // A. Vào thẳng Editor (Dùng cho Upload mới / Ghi âm xong)
  const handleDirectEdit = (meeting: Meeting) => {
    const url = URL.createObjectURL(meeting.audioBlob);
    setAudioUrl(url);
    setCurrentMeeting(meeting);
    setCurrentState('EDITOR');
  };

  // B. Vào xem chi tiết (Dùng cho mở file cũ từ Dashboard)
  const handleViewDetail = (meeting: Meeting) => {
    const url = URL.createObjectURL(meeting.audioBlob);
    setAudioUrl(url);
    setCurrentMeeting(meeting);
    setCurrentState('MEETING_DETAIL');
  };

  // C. Chuyển từ Detail sang Edit
  const handleSwitchToEdit = () => {
    setCurrentState('EDITOR');
  };

  // D. Quay lại Dashboard
  const handleBackToDashboard = () => {
    // Thu hồi URL blob để tránh leak memory
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setCurrentMeeting(null);
    setCurrentState('DASHBOARD');
  };

  // E. Quay lại từ Editor
  const handleBackFromEditor = () => {
      handleBackToDashboard();
  };

  // ==========================================
  // 2. LOGIC XỬ LÝ DỮ LIỆU
  // ==========================================

 // Flow 1: Upload File Thật (Thủ công)
  const handleFileUpload = async (file: File) => {
    // ... (Code cũ tạo segment trống) ...
    setCurrentState('PROCESSING');
    setTimeout(async () => {
      const newMeeting: Meeting = {
        id: `upload-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        createdAt: Date.now(),
        duration: 0,
        audioBlob: file,
        segments: [
          { id: "1", speakerId: "SPEAKER_00", start: 0, end: 10, text: "Audio đã tải lên. Bấm vào để ghi biên bản..." }
        ],
        speakers: [{ id: "SPEAKER_00", name: "Speaker A", color: "bg-blue-50 text-blue-700 border-blue-200" }],
        status: 'active'
      };
      await saveMeeting(newMeeting);
      handleDirectEdit(newMeeting);
    }, 1000);
  };

  // [MỚI] Flow 1.5: Dùng File Demo (Có AI)
  const handleStartDemo = async () => {
    setCurrentState('PROCESSING');
    
    setTimeout(async () => {
      // 1. Lấy file demo.mp3
      const res = await fetch("/demo.mp3");
      const blob = await res.blob();
      
      // 2. Lấy transcript xịn từ mockData
      const parsed = parseTranscriptFile(RAW_TRANSCRIPT_FILE);
      
      // 3. Tạo object
      const demoMeeting: Meeting = {
        id: `demo-${Date.now()}`, // Đánh dấu là demo
        title: "Talkshow: Tương lai ngành xuất bản (AI Processed)",
        createdAt: Date.now(),
        duration: 480,
        audioBlob: blob,
        
        // Dữ liệu xịn
        segments: parsed.segments,
        speakers: parsed.speakers,
        status: 'active'
      };
      
      // 4. Lưu và mở Edit
      await saveMeeting(demoMeeting);
      handleDirectEdit(demoMeeting); 
    }, 1500);
  };

  // Flow 2: Live Recording -> Vào thẳng Editor
  const handleFinishLive = async (recordedText: string, recordedAudioUrl: string) => {
    // ... Logic tạo object meeting (giữ nguyên) ...
    const words = recordedText.split(" ");
    const chunkSize = 20;
    const newSegments = [];
    let currentTime = 0;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunkText = words.slice(i, i + chunkSize).join(" ");
      const dur = chunkText.length * 0.05;
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
      speakers: [{ id: "SPEAKER_00", name: "Tôi (Ghi âm)", color: "bg-blue-50 text-blue-700 border-blue-200" }],
      status: 'active'
    };

    await saveMeeting(newMeeting);
    
    handleDirectEdit(newMeeting); // <--- [SỬA] Vào thẳng Edit
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      
      {currentState === 'DASHBOARD' && (
        <DashboardState 
          onImport={handleFileUpload} 
          onUseSample={handleStartDemo} // [MỚI] Truyền hàm này vào
          onLive={() => setCurrentState('LIVE_RECORDING')}
          onOpenMeeting={handleViewDetail} // <--- [SỬA] Mở file cũ thì vào Detail
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

      {/* Màn hình Chi Tiết (Chỉ xem) */}
      {currentState === 'MEETING_DETAIL' && currentMeeting && audioUrl && (
        <MeetingDetailState 
          meeting={currentMeeting}
          audioSrc={audioUrl}
          onBack={handleBackToDashboard} // Back về Dashboard
          onEdit={handleSwitchToEdit}    // Nút Edit -> Chuyển sang Editor
        />
      )}

      {/* Màn hình Editor (Chỉnh sửa) */}
      {currentState === 'EDITOR' && currentMeeting && audioUrl && (
        <EditorState 
          audioSrc={audioUrl} 
          initialData={currentMeeting} 
          onBack={handleBackFromEditor} // Back từ Editor -> Dashboard (có confirm)
        />
      )}
    </main>
  );
}