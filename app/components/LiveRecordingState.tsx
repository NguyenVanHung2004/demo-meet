"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, Activity } from "lucide-react";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import { requestSegmentSummary } from "../lib/api"; // [QUAN TRỌNG] Dùng API tóm tắt nhanh

type SummaryItem = {
  id: number;
  content: string;
  isLoading: boolean;
};
export default function LiveRecordingState({ 
  onFinish, 
  onBack 
}: { 
  onFinish: (text: string, audioUrl: string, finalSummary: string ) => void, 
  onBack: () => void 
}) {
  // --- STATE ---
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);  const [timer, setTimer] = useState(0);
  const [volume, setVolume] = useState(0);
  
  // Refs
  const summariesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  // [MỚI] Hàm xử lý khi Hook phát hiện ngắt đoạn (> 2s im lặng)
  // Hàm này sẽ được truyền vào startListening
  const handleSegmentEnd = async (segmentText: string) => {
    if (typeof segmentText !== 'string' || segmentText.trim().length < 5) return;

    const currentId = Date.now();
    console.log(`[${currentId}] Bắt đầu phân tích:`, segmentText); // LOG 1
    const safeText = segmentText || "";
    // 1. Thêm trạng thái Loading
    setSummaries(prev => [
      ...prev, 
      { 
        id: currentId, 
        content: `⏳ Đang phân tích: "${safeText.substring(0, 30)}..."`, 
        isLoading: true 
      }
    ]);

    try {
      // 2. Tạo một Promise Timeout để tránh bị treo mãi mãi
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 40000) // 20 giây timeout
      );

      // 3. Chạy đua: API vs Timeout (cái nào xong trước thì lấy)
      // Lưu ý: requestSegmentSummary phải trả về string text tóm tắt
      const summary = await Promise.race([
        requestSegmentSummary(segmentText), 
        timeoutPromise
      ]) as string;

      console.log(`[${currentId}] Thành công:`, summary); // LOG 2
      
      // 4. Update Thành công
      setSummaries(prev => prev.map(item => 
        item.id === currentId 
          ? { ...item, content: `${summary}`, isLoading: false }
          : item
      ));

    } catch (e: any) {
      console.error(`[${currentId}] Lỗi hoặc Timeout:`, e); // LOG 3

      // 5. Update Thất bại (Hiện text gốc)
      setSummaries(prev => prev.map(item => 
        item.id === currentId 
          ? { ...item, content: `${segmentText}`, isLoading: false } // Bỏ loading, hiện text gốc
          : item
      ));
    }
  };

  // Gọi Hook (Lấy các hàm cần thiết)
  const { text, interimText, isListening, startListening, stopListening } = useSpeechRecognition();

  // Tự động cuộn xuống cuối list tóm tắt
  useEffect(() => {
      summariesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [summaries]);

  // Đồng hồ đếm giờ
  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => setTimer((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  // --- LOGIC GHI ÂM ---
  const startRecordingSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 1. MediaRecorder (Ghi file âm thanh)
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      // 2. Visualizer (Hiệu ứng sóng âm)
      const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioContext();
      const analyzer = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      analyzer.fftSize = 32;
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateVolume = () => {
        analyzer.getByteFrequencyData(dataArray);
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setVolume(sum / dataArray.length);
        animationRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // 3. Bắt đầu nhận diện giọng nói
      // [QUAN TRỌNG] Truyền callback handleSegmentEnd vào đây
      startListening(handleSegmentEnd);

    } catch (err) {
      console.error("Lỗi Micro:", err);
      alert("Không thể truy cập Micro! Hãy kiểm tra quyền truy cập.");
    }
  };

  const stopRecordingSession = () => {
    stopListening(); // Dừng AI
    
    // Dừng Visualizer
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    // Dừng Ghi âm
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    
    // Tắt đèn Micro
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    
    setVolume(0);
  };

  const handleToggleRecord = () => {
    if (isListening) stopRecordingSession();
    else startRecordingSession();
  };

  const handleSaveAndProcess = () => {
    // 1. Dừng mọi thứ
    stopRecordingSession();
    
    // Đợi 1 chút để file audio đóng gói xong (quan trọng)
    setTimeout(() => {
        // --- XỬ LÝ AUDIO ---
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const createdAudioUrl = URL.createObjectURL(audioBlob);
        
        // --- XỬ LÝ TRANSCRIPT (Nội dung chi tiết) ---
        // Gộp text chính + text đang nói dở (interim)
        const fullTranscript = (text + " " + interimText).trim(); 

        // --- XỬ LÝ SUMMARY (Tóm tắt) ---
        // [QUAN TRỌNG] Gộp mảng các thẻ tóm tắt thành 1 đoạn văn hoàn chỉnh
        let finalSummary = summaries
            .map(item => item.content.trim()) // Lấy nội dung của từng thẻ
            .join(" "); // Nối lại bằng dấu cách

        // Nếu còn đoạn text đang nói dở (interim) chưa kịp gửi AI tóm tắt
        // Ta nối luôn text thô đó vào cuối bản tóm tắt cho đầy đủ
        if (interimText.trim()) {
            finalSummary += " " + interimText.trim();
        }

        console.log("✅ Meeting Note đã hoàn thành ngay lập tức!");

        // --- TRẢ KẾT QUẢ ---
        // Bạn cần sửa hàm onFinish ở component cha để nhận thêm tham số thứ 3 là summary
        onFinish(fullTranscript, createdAudioUrl, finalSummary); 
        
    }, 500);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const hasContent = text.trim().length > 0 || interimText.trim().length > 0;
  const finishedItems = summaries.filter(item => !item.isLoading);
  const loadingItems = summaries.filter(item => item.isLoading);
  return (
    // 1. ROOT: h-screen và overflow-hidden để chặn scroll toàn trang
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      
      {/* HEADER: Chiều cao cố định (h-16), không được co giãn (shrink-0) */}
      <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
         <div className="flex items-center gap-4">
             <button onClick={() => { stopRecordingSession(); onBack(); }} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <div className={`flex items-center gap-2 font-bold transition-colors ${isListening ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-600' : 'bg-slate-300'}`}></div>
                {isListening ? "Đang ghi âm..." : "Chờ ghi âm"}
             </div>
         </div>
         <button 
           onClick={handleSaveAndProcess}
           className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-lg transition-all"
         >
           <Save className="w-4 h-4" /> Dừng & Lưu
         </button>
      </div>

      {/* BODY WRAPPER: Chiếm hết phần còn lại (flex-1), chặn tràn ra ngoài (overflow-hidden) */}
      <div className="flex-1 p-6 overflow-hidden">
        
        {/* GRID CONTAINER: Ép chiều cao bằng 100% Body (h-full), chia 2 dòng đều nhau */}
        <div className="grid grid-rows-2 gap-6 h-full">
          
          {/* --- ROW 1: TOP SECTION (Visualizer + Transcript) --- */}
          {/* min-h-0 là CHÌA KHÓA để Grid không bị nở ra theo content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
            
            {/* VISUALIZER */}
            <div className="bg-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-lg relative overflow-hidden h-full">
               <h3 className="text-slate-400 text-sm font-medium flex items-center gap-2 shrink-0">
                 <Activity className="w-4 h-4" /> Tín hiệu Micro
               </h3>
               {/* Sóng âm */}
               <div className="flex items-center justify-center gap-1 h-32 shrink-0">
                 {[...Array(20)].map((_, i) => {
                   const height = isListening ? Math.min(100, Math.max(10, volume * (1 + Math.random()))) : 4;
                   return <div key={i} className="w-2 bg-indigo-500 rounded-full transition-all duration-75" style={{ height: `${height}%` }}></div>
                 })}
               </div>
               {/* Button */}
               <div className="flex justify-center items-center shrink-0">
                  <button 
                    onClick={handleToggleRecord}
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-slate-800 transition-transform hover:scale-105 ${isListening ? 'bg-yellow-500' : 'bg-red-600'}`}
                  >
                    {isListening ? <Pause className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
               </div>
            </div>

            {/* TRANSCRIPT */}
            <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col h-full min-h-0">
               <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wide mb-2 shrink-0">Hội thoại thời gian thực</h3>
               {/* flex-1 overflow-y-auto: Chỉ scroll nội dung bên trong ô này */}
               <div className="flex-1 overflow-y-auto font-mono text-sm leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border-inner whitespace-pre-wrap">
                  {text}
                  <span className="text-indigo-600 italic ml-1">{interimText}</span>
                  {isListening && <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 align-middle animate-pulse"></span>}
               </div>
            </div>
          </div>

          {/* --- ROW 2: BOTTOM SECTION (Live Summary) --- */}
          {/* h-full min-h-0: Ép ô này không được cao quá 50% màn hình */}
          <div className="bg-white rounded-2xl p-6 border shadow-sm flex flex-col h-full min-h-0">
             <h3 className="text-indigo-700 text-sm font-bold uppercase tracking-wide mb-4 flex items-center gap-2 shrink-0 border-b pb-2">
               <Sparkles className="w-4 h-4" /> Tóm tắt trực tiếp (Live Insights)
             </h3>

             {/* Khu vực cuộn chính */}
             <div className="flex-1 overflow-y-auto pr-2 scroll-smooth flex flex-col">
                
                {/* 1. Đoạn văn đã chốt */}
                <div className="text-slate-700 text-base leading-7 text-justify mb-4 shrink-0">
                   {finishedItems.map((item) => (
                      <span key={item.id} className="animate-in fade-in duration-700">
                         {item.content.replace('✨', '').trim() + " "}
                      </span>
                   ))}
                   {loadingItems.length === 0 && finishedItems.length > 0 && (
                       <span className="inline-block w-1.5 h-4 bg-indigo-500 ml-1 align-middle animate-pulse"></span>
                   )}
                </div>

                {/* 2. Thẻ đang Loading */}
                <div className="space-y-3 pt-2 border-t border-dashed border-slate-200 mt-auto shrink-0 pb-2">
                   {loadingItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 p-3 rounded-lg animate-in slide-in-from-bottom-2 fade-in duration-300">
                         <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0"></div>
                         <div className="flex-1 min-w-0">
                            <p className="text-indigo-700 text-sm font-medium truncate">Đang phân tích...</p>
                            <p className="text-indigo-400 text-xs truncate italic">{item.content.replace("⏳ Đang phân tích: ", "").replace('"', '')}</p>
                         </div>
                      </div>
                   ))}
                </div>
                
                {/* Neo để scroll */}
                <div ref={summariesEndRef} className="shrink-0 h-1" />
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}