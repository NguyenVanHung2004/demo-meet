"use client";

import React, { useState } from "react";
import LiveRecordingState from "./LiveRecordingState"; // Deepgram
import LiveRecordingGoogle from "./LiveRecordingGoogle"; // Google
import { Zap, Cloud } from "lucide-react";

export default function LiveModeSwitcher(props: any) {
  const [mode, setMode] = useState<'deepgram' | 'google'>('deepgram');
  const [isStarted, setIsStarted] = useState(false);

  if (isStarted) {
    if (mode === 'google') {
      return <LiveRecordingGoogle {...props} onBack={() => setIsStarted(false)} />;
    }
    return <LiveRecordingState {...props} onBack={() => setIsStarted(false)} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-8 p-4 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">Chọn chế độ Ghi âm</h2>
            <p className="text-slate-500 text-sm">Chọn công nghệ nhận dạng giọng nói phù hợp</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            {/* DEEPGRAM */}
            <button 
                onClick={() => { setMode('deepgram'); setIsStarted(true); }}
                className="group relative flex flex-col items-center gap-4 p-8 bg-white border-2 border-indigo-50 hover:border-indigo-500 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300"
            >
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-10 h-10" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-slate-800">Deepgram Nova-3</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md">Realtime</span>
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md">Diarization</span>
                    </div>
                    <p className="text-sm text-slate-500">Tách người nói tốt, chi phí rẻ.</p>
                </div>
            </button>

            {/* GOOGLE */}
            <button 
                onClick={() => { setMode('google'); setIsStarted(true); }}
                className="group relative flex flex-col items-center gap-4 p-8 bg-white border-2 border-orange-50 hover:border-orange-500 rounded-3xl shadow-sm hover:shadow-2xl transition-all duration-300"
            >
                <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Cloud className="w-10 h-10" />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-slate-800">Google Cloud STT</h3>
                    <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold uppercase rounded-md">Socket</span>
                        <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold uppercase rounded-md">Chính Xác</span>
                    </div>
                    <p className="text-sm text-slate-500">Độ chính xác cao, phản hồi nhanh.</p>
                </div>
            </button>
        </div>
    </div>
  );
}