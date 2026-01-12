"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, AlignLeft, Trash2, Cloud, Loader2, User } from "lucide-react";
import useGoogleCloud from "../hooks/useGoogleCloud";
import { requestSegmentSummary, uploadAudioToFirebase } from "../lib/api"; // [MỚI] Thêm api mới
import { saveMeeting } from "../lib/db"; // [MỚI]
import { useAuth } from "../context/AuthContext"; // [MỚI]

type SummaryItem = { id: number; content: string; isLoading: boolean; };

const MobileTabBtn = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition-all ${active ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100"
      }`}
  >
    <Icon className="w-4 h-4" /> {label}
  </button>
);

export default function LiveRecordingState({
  onFinish, onBack
}: {
  onFinish: () => void,
  onBack: () => void
}) {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [timer, setTimer] = useState(0);
  const [volume, setVolume] = useState(0);
  const [mobileTab, setMobileTab] = useState<'transcript' | 'summary'>('transcript');
  const [isUploading, setIsUploading] = useState(false); // [MỚI] State loading khi upload
  const summariesEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // --- LOGIC TÓM TẮT ---
  const handleSegmentEnd = async (segmentText: string) => {
    if (!segmentText || segmentText.length < 20) return;
    const currentId = Date.now();
    // Cắt ngắn text preview
    const preview = segmentText.length > 40 ? segmentText.substring(0, 40) + "..." : segmentText;

    setSummaries(prev => [...prev, { id: currentId, content: `⏳ Đang tóm tắt: "${preview}"`, isLoading: true }]);

    try {
      const summary = await requestSegmentSummary(segmentText);
      if (!summary || summary.trim().length === 0) {
        setSummaries(prev => prev.filter(item => item.id !== currentId));
        return;
      }
      setSummaries(prev => prev.map(item => item.id === currentId ? { ...item, content: summary, isLoading: false } : item));
    } catch (e) {
      setSummaries(prev => prev.filter(item => item.id !== currentId));
    }
  };

  const {
    segments, interimText,
    isListening, isConnected, isConnecting,
    startListening, stopListening, resetTranscript
  } = useGoogleCloud(handleSegmentEnd);

  // Auto Scroll
  useEffect(() => { if (mobileTab === 'summary') summariesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [summaries, mobileTab]);
  useEffect(() => { if (mobileTab === 'transcript') transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [segments, interimText, mobileTab]);

  useEffect(() => {
    let interval: any;
    if (isListening) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);

  // 1. TÁCH VISUALIZER RA HÀM RIÊNG (để gọi lại được khi Resume)
  const setupVisualizer = (stream: MediaStream) => {
    const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
    const audioCtx = new AudioContext();
    const analyzer = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyzer);
    analyzer.fftSize = 32;
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    const updateVolume = () => {
      analyzer.getByteFrequencyData(dataArray);
      let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      setVolume(sum / dataArray.length);
      animationRef.current = requestAnimationFrame(updateVolume);
    };
    updateVolume();
  };
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Logic: Nếu đang ghi âm (isListening) HOẶC đã có nội dung (segments > 0)
      // thì chặn người dùng tắt tab
      if (isListening || segments.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Dòng này bắt buộc để hiện popup trên Chrome/Edge
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function: Gỡ sự kiện khi component bị hủy (để tránh lỗi memory leak)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isListening, segments]);
  const startRecordingSession = async () => {
    try {
      // 2. LOGIC RESUME (NẾU ĐANG TẠM DỪNG)
      if (streamRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume(); // Tiếp tục ghi vào file cũ
        setupVisualizer(streamRef.current);

        // Truyền thời gian hiện tại vào để làm offset
        startListening(streamRef.current, timer);
        return;
      }

      // 3. LOGIC START NEW (MỚI TINH)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detect supported mimeType
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'; // Safari case?
      }
      console.log("Using MediaRecorder mimeType:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // console.log("Data available:", e.data.size, e.data.type);
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start(1000); // Collect data every 1s (Important for streaming/chunks)
      mediaRecorderRef.current = mediaRecorder;

      setupVisualizer(stream);

      // Bắt đầu với offset = 0 (hoặc timer hiện tại)
      startListening(stream, timer);
    } catch (err) { alert("Lỗi Micro: " + err); }
  };

  // --- AUTO SAVE LOGIC ---
  const draftIdRef = useRef<string>(crypto.randomUUID());
  const savedChunkCountRef = useRef<number>(0);

  // Refs to hold latest state (to avoid resetting interval)
  const latestStateRef = useRef({ segments, summaries, user, timer, isListening });
  useEffect(() => {
    latestStateRef.current = { segments, summaries, user, timer, isListening };
  }, [segments, summaries, user, timer, isListening]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const { segments, summaries, user, timer, isListening } = latestStateRef.current; // Read from Ref

      // Chỉ lưu nếu đang ghi âm hoặc có dữ liệu
      if (!isListening && segments.length === 0) return;
      if (!user) return;

      console.log("Triggering Auto-save for draft:", draftIdRef.current); // LOG

      const currentDraftId = draftIdRef.current;

      // 1. Lưu Metadata
      const draftMeta = {
        id: currentDraftId,
        userId: user.uid,
        title: `Draft ${new Date().toLocaleTimeString('vi-VN')}`,
        createdAt: Date.now(),
        duration: timer,
        audioUrl: "",
        status: 'draft',
        segments: segments.map(s => ({
          id: s.id.toString(),
          start: s.words?.[0]?.start || 0,
          end: s.words?.[s.words.length - 1]?.end || 0,
          text: s.text,
          speakerId: "SPEAKER_00",
          words: s.words || []
        })),
        speakers: [{ id: "SPEAKER_00", name: "Người nói (Live)", color: "bg-indigo-50 text-indigo-700" }],
        summary: summaries.map(s => s.content).join("\n"),
        isDeleted: false
      };

      try {
        await import("../lib/indexedDB").then(mod => mod.saveDraftMeta(draftMeta as any));
      } catch (e) { console.error("Auto-save meta failed", e); }

      // 2. Lưu Audio Chunks (Incremental)
      const allChunks = audioChunksRef.current;
      const newChunks = allChunks.slice(savedChunkCountRef.current);

      if (newChunks.length > 0) {
        try {
          await import("../lib/indexedDB").then(mod => mod.appendAudioChunks(currentDraftId, newChunks));
          savedChunkCountRef.current = allChunks.length;
          console.log(`Saved ${newChunks.length} new audio chunks`); // LOG
        } catch (e) { console.error("Auto-save audio failed", e); }
      }

    }, 10000); // 10s

    return () => clearInterval(interval);
  }, []); // Empty dependency -> Interval runs forever until unmount

  useEffect(() => {
    const interval = setInterval(async () => {
      // Chỉ lưu nếu đang ghi âm hoặc có dữ liệu
      if (!isListening && segments.length === 0) return;
      if (!user) return; // Cần user để gắn ID

      const currentDraftId = draftIdRef.current;

      // 1. Lưu Metadata
      const draftMeta = {
        id: currentDraftId,
        userId: user.uid,
        title: `Draft ${new Date().toLocaleTimeString('vi-VN')}`, // Title tạm
        createdAt: Date.now(), // Sẽ bị ghi đè, thực ra nên giữ nguyên created gốc. Nhưng đây là draft update liên tục.
        duration: timer,
        audioUrl: "", // Không có URL thật
        status: 'draft',
        segments: segments.map(s => ({
          id: s.id.toString(),
          start: s.words?.[0]?.start || 0,
          end: s.words?.[s.words.length - 1]?.end || 0,
          text: s.text,
          speakerId: "SPEAKER_00",
          words: s.words || []
        })),
        speakers: [{ id: "SPEAKER_00", name: "Người nói (Live)", color: "bg-indigo-50 text-indigo-700" }],
        summary: summaries.map(s => s.content).join("\n"),
        isDeleted: false
      };

      try {
        await import("../lib/indexedDB").then(mod => mod.saveDraftMeta(draftMeta as any)); // as any vì db.ts chưa nhận diện draft 100% khớp nếu check type chặt
      } catch (e) { console.error("Auto-save meta failed", e); }

      // 2. Lưu Audio Chunks (Incremental)
      const allChunks = audioChunksRef.current;
      const newChunks = allChunks.slice(savedChunkCountRef.current);

      if (newChunks.length > 0) {
        try {
          await import("../lib/indexedDB").then(mod => mod.appendAudioChunks(currentDraftId, newChunks));
          savedChunkCountRef.current = allChunks.length;
        } catch (e) { console.error("Auto-save audio failed", e); }
      }

    }, 10000); // 10s

    return () => clearInterval(interval);
  }, [isListening, segments, user, timer, summaries]); // Dependencies cần thiết


  const stopRecordingSession = () => {
    stopListening(); // Tắt kết nối Google
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    // 4. CHỈ PAUSE RECORDER, KHÔNG STOP HẲN
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }

    // 🔴 BỎ DÒNG NÀY (Không tắt mic ở đây, để còn resume được)
    // streamRef.current?.getTracks().forEach(track => track.stop());

    setVolume(0);
  };

  const handleToggleRecord = () => {
    if (isConnecting || !isConnected) return;
    isListening ? stopRecordingSession() : startRecordingSession();
  };

  const handleSaveAndProcess = async () => {
    if (!user) return alert("Vui lòng đăng nhập!");

    // 1. Dừng ghi âm
    stopRecordingSession();
    // Tắt hẳn mọi thứ tại đây
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setIsUploading(true);

    try {
      // Chờ 1 chút để chunks được đẩy hết vào mảng
      await new Promise(r => setTimeout(r, 500));

      // 2. Tạo File WebM từ Blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const fileName = `Live Meeting ${new Date().toLocaleString('vi-VN').replace(/[:/]/g, '-')}.webm`;
      const file = new File([audioBlob], fileName, { type: 'audio/webm' });

      // 3. Upload lên Firebase Storage (Vẫn cần để nghe lại)
      const audioUrl = await uploadAudioToFirebase(file, user.uid);

      // --- [KHÁC BIỆT Ở ĐÂY] ---
      // KHÔNG GỌI RUNPOD NỮA. 
      // Lấy luôn dữ liệu từ biến 'segments' và 'summaries' có sẵn trên màn hình.

      // Chuẩn hóa segments từ Google STT sang format của DB
      const finalSegments = segments.map(s => ({
        id: s.id.toString(),
        start: s.words?.[0]?.start || 0,
        end: s.words?.[s.words.length - 1]?.end || 0,
        text: s.text,
        speakerId: "SPEAKER_00", // Google Live web không phân biệt được người nói, mặc định là 1 người
        words: s.words || []
      }));

      // Ghép tóm tắt lại thành 1 chuỗi
      const finalSummary = summaries.map(s => s.content).join("\n");

      // 4. Lưu vào Firestore với trạng thái COMPLETED (Xong luôn)
      await saveMeeting({
        id: crypto.randomUUID(),
        userId: user.uid,
        title: fileName.replace(".mp3", ""),
        createdAt: Date.now(),
        duration: timer,
        audioUrl: audioUrl,

        // [QUAN TRỌNG] Không có jobId, trạng thái là completed
        jobId: undefined,
        status: 'completed',

        segments: finalSegments, // Lưu text live
        summary: finalSummary,   // Lưu summary live
        speakers: [{ id: "SPEAKER_00", name: "Người nói (Live)", color: "bg-indigo-50 text-indigo-700" }],
        isDeleted: false
      });

      // 5. Xong -> Quay về Dashboard
      onFinish();

    } catch (e) {
      console.error(e);
      alert("Lỗi khi lưu: " + (e as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  // 5. CẬP NHẬT HÀM XÓA ĐỂ CLEAR DATA CŨ
  const handleClearTranscript = () => {
    if (confirm("Xóa toàn bộ nội dung?")) {
      resetTranscript();
      setSummaries([]);
      audioChunksRef.current = []; // Reset file ghi âm tại đây
      setTimer(0);
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">

      {/* HEADER */}
      <div className="h-14 md:h-16 bg-white border-b flex items-center justify-between px-4 md:px-6 shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (isListening || segments.length > 0) {
                // Nếu đang ghi âm hoặc đã có dữ liệu -> Gọi hàm Lưu
                handleSaveAndProcess();
              } else {
                // Nếu chưa có gì -> Quay lại bình thường
                onBack();
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
            disabled={isUploading} // Khóa nút khi đang lưu để tránh lỗi
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col">
            <span className="text-xs text-indigo-500 font-bold uppercase tracking-wider flex items-center gap-1">
              {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Cloud className="w-3 h-3" />} Google Mode
            </span>
            <span className="text-sm md:text-base font-mono font-bold text-slate-700">{formatTime(timer)}</span>
          </div>
        </div>
        <button
          onClick={handleSaveAndProcess}
          disabled={isUploading}
          className={`px-3 py-1.5 md:px-4 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 shadow-lg transition-all ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span className="hidden md:inline">Dừng & Lưu</span>
              <span className="md:hidden">Lưu</span>
            </>
          )}
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-4 gap-4 md:gap-6">

        {/* LEFT COLUMN */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">

          {/* VISUALIZER */}
          <div className="bg-slate-900 rounded-2xl p-4 md:p-6 shadow-lg shrink-0 flex items-center justify-between gap-4 md:flex-col md:justify-center md:h-64 transition-all relative">
            <div className="flex items-center justify-center gap-1 h-12 md:h-32 flex-1 md:w-full">
              {[...Array(20)].map((_, i) => {
                const height = isListening ? Math.min(100, Math.max(15, volume * (1 + Math.random()) * 2)) : 5;
                return <div key={i} className={`w-1.5 md:w-2 rounded-full transition-all duration-75 ${isConnected ? 'bg-indigo-500' : 'bg-slate-700'}`} style={{ height: `${height}%` }}></div>
              })}
            </div>
            <button
              onClick={handleToggleRecord}
              disabled={isConnecting || !isConnected}
              className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 transition-all shrink-0
                    ${isConnecting
                  ? 'bg-slate-600 border-slate-700 cursor-wait'
                  : isListening
                    ? 'bg-yellow-500 animate-pulse border-slate-800'
                    : 'bg-red-600 hover:bg-red-700 border-slate-800 active:scale-95'
                }
                  `}
            >
              {isConnecting ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : isListening ? <Pause className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              {isConnecting ? <span className="text-xs text-yellow-400 font-medium animate-pulse flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Đang kết nối...</span> : isConnected ? <span className="text-[10px] text-green-400 font-medium opacity-80">● Máy chủ sẵn sàng</span> : <span className="text-xs text-red-400 font-medium">Mất kết nối</span>}
            </div>
          </div>

          {/* TRANSCRIPT UI */}
          <div className="flex md:hidden bg-slate-200 p-1 rounded-xl shrink-0">
            <MobileTabBtn active={mobileTab === 'transcript'} onClick={() => setMobileTab('transcript')} icon={AlignLeft} label="Hội thoại" />
            <MobileTabBtn active={mobileTab === 'summary'} onClick={() => setMobileTab('summary')} icon={Sparkles} label="Live Tóm tắt" />
          </div>

          <div className={`bg-white rounded-2xl border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden transition-all ${mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'}`}>
            <div className="p-3 border-b bg-slate-50 flex items-center gap-2 shrink-0">
              <AlignLeft className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Nội dung (Google STT)</span>
              <button onClick={handleClearTranscript} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors ml-auto"><Trash2 className="w-4 h-4" /></button>
            </div>

            {/* [THAY ĐỔI] Giao diện Chat Bubble */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm bg-slate-50/50">
              {segments.map((seg) => (
                <div key={seg.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 font-bold text-xs mt-1 shadow-sm">
                    Tôi
                  </div>

                  {/* Bubble */}
                  <div className="flex-1 max-w-[85%]">
                    <div className="text-[10px] text-slate-400 mb-1 ml-1 flex items-center gap-2">
                      <span>{new Date(seg.id).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm text-slate-800 leading-relaxed text-sm">
                      {seg.text}
                    </div>
                  </div>
                </div>
              ))}

              {/* Chữ đang nói (Interim) - Hiệu ứng Typing */}
              {interimText && (
                <div className="flex gap-3 animate-pulse opacity-80">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none border border-transparent shadow-none max-w-[85%]">
                    <p className="text-slate-500 italic font-medium text-sm">{interimText} ...</p>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} className="h-2" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (SUMMARY) */}
        <div className={`md:w-1/3 bg-white rounded-2xl border shadow-sm flex flex-col min-h-0 overflow-hidden transition-all ${mobileTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
          <div className="p-3 border-b bg-indigo-50 flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-800 uppercase">Live Insights</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth space-y-4">
            {summaries.filter(s => !s.isLoading).map((item) => (
              <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                <p className="text-slate-700 text-sm leading-relaxed text-justify">{item.content}</p>
              </div>
            ))}
            {summaries.filter(s => s.isLoading).map((item) => (
              <div key={item.id} className="flex gap-3 opacity-70 bg-slate-50 p-3 rounded-xl border border-slate-100 border-dashed">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 animate-bounce shrink-0"></div>
                <p className="text-slate-400 text-sm italic">{item.content}</p>
              </div>
            ))}
            <div ref={summariesEndRef} className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}