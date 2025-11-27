"use client";

import React, { useState } from "react";
import DashboardState from "./components/DashboardState";
import EditorState from "./components/EditorState";

export type AppState = 'DASHBOARD' | 'PROCESSING' | 'EDITOR';

export default function Page() {
  const [currentState, setCurrentState] = useState<AppState>('DASHBOARD');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Flow: Người dùng chọn Audio từ Dashboard
  const handleStartDemo = () => {
    // Giả lập load file demo
    setAudioUrl("/demo.mp3"); 
    // Chuyển sang màn hình giả lập đang xử lý (Transcribing...)
    setCurrentState('PROCESSING');
    
    // Giả lập delay 2 giây cho nó "thật" rồi vào Editor
    setTimeout(() => {
      setCurrentState('EDITOR');
    }, 2500);
  };

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900">
      {currentState === 'DASHBOARD' && (
        <DashboardState onImport={handleStartDemo} />
      )}

      {currentState === 'PROCESSING' && (
        <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in duration-500">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-slate-800">Đang ghi biên bản(Transcribing)...</h2>
            <p className="text-slate-500">Đang phân tách người nói và chuyển đổi giọng nói thành văn bản.</p>
          </div>
        </div>
      )}

      {currentState === 'EDITOR' && audioUrl && (
        <EditorState audioSrc={audioUrl} />
      )}
    </main>
  );
}