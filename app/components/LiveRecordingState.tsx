"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Pause, ChevronLeft, Save, Sparkles, AlignLeft, Trash2, Loader2 } from "lucide-react";
import useDeepgram from "../hooks/useDeepgram";
import { requestSegmentSummary, uploadAudioToFirebase } from "../lib/api"; // [MỚI] Thêm api mới
import { saveMeeting } from "../lib/db"; // [MỚI]
import { useAuth } from "../context/AuthContext"; // [MỚI]
import useLocalTranscription from "../hooks/useLocalTranscription";

type SummaryItem = {
  id: number;
  content: string;
  isLoading: boolean;
};

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);

  // --- LOGIC TÓM TẮT THÔNG MINH ---
  const bufferTextRef = useRef("");
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordCountRef = useRef(0);

  // [MỚI] Ref theo dõi trạng thái Interim để "Snooze" timer
  const isInterimActiveRef = useRef(false);

  // 1. Hàm gọi API tóm tắt
  const flushBuffer = async (force: boolean = false) => {
    const content = bufferTextRef.current.trim();
    const minWords = force ? 2 : 10; // Giảm ngưỡng tối thiểu xuống 10 từ cho nhạy

    if (wordCountRef.current < minWords) return;

    // [QUAN TRỌNG] Kiểm tra nếu đang có chữ xám (đang nói dở) thì KHÔNG tóm tắt, mà hẹn lại sau
    if (!force && isInterimActiveRef.current) {
      console.log("✋ Đang nói dở (Interim) -> Hoãn tóm tắt thêm 2s...");
      // Hẹn giờ check lại sau 2s
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => flushBuffer(false), 2000);
      return;
    }

    console.log(`🚀 Gửi tóm tắt (${wordCountRef.current} từ)...`);

    // UI Loading
    const currentId = Date.now();
    const previewText = content.length > 50 ? content.substring(0, 50) + "..." : content;
    setSummaries(prev => [...prev, {
      id: currentId,
      content: `⏳ Đang xử lý: "${previewText}"`,
      isLoading: true
    }]);

    // Reset Buffer
    const textToProcess = content;
    bufferTextRef.current = "";
    wordCountRef.current = 0;

    try {
      const summary = await requestSegmentSummary(textToProcess);
      setSummaries(prev => prev.map(item =>
        item.id === currentId
          ? { ...item, content: summary || "Không có nội dung chính.", isLoading: false }
          : item
      ));
    } catch (e) {
      setSummaries(prev => prev.filter(item => item.id !== currentId));
    }
  };

  const handleDeepgramFinal = ({ speaker, content }: { speaker: number; content: string }) => {
    const formattedLine = `Speaker ${speaker}: ${content}`;
    bufferTextRef.current += (bufferTextRef.current ? "\n" : "") + formattedLine;

    const newWords = content.trim().split(/\s+/).length;
    wordCountRef.current += newWords;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // RULE 3: Tràn ly (>80 từ) -> Ép tóm tắt ngay
    if (wordCountRef.current > 80) {
      flushBuffer(true);
      return;
    }

    // [TINH CHỈNH TIMEOUT] 
    // - Đủ 30 từ -> Chờ 2s (Siêu nhanh)
    // - Ít từ -> Chờ 3s (Nhanh hơn nhiều so với 10s cũ)
    // Lý do: Nếu người ta đã ngắt lời 3s nghĩa là hết ý rồi, tóm tắt luôn đi.
    const isLongText = wordCountRef.current >= 30;
    const timeoutMs = isLongText ? 2000 : 3000;

    silenceTimerRef.current = setTimeout(() => {
      // Hết giờ chờ -> Gọi hàm flush
      // Lưu ý: Trong flushBuffer đã có logic check isInterimActiveRef để hoãn nếu cần
      flushBuffer();
    }, timeoutMs);
  };

  const { segments, interimContent, isListening, startListening, stopListening, resetTranscript } = useLocalTranscription(handleDeepgramFinal);

  // [LOGIC MỚI] Cập nhật cờ hiệu Interim
  useEffect(() => {
    const hasInterim = interimContent && interimContent.trim().length > 0;
    isInterimActiveRef.current = !!hasInterim;
  }, [interimContent]);

  // --- AUTO-SAVE LOGIC (ZIPFORMER BRANCH) ---
  const draftIdRef = useRef<string>(crypto.randomUUID());
  const lastSavedChunkIndexRef = useRef(0);

  // UseRef để access state mới nhất trong setInterval (tránh closure stale)
  const latestStateRef = useRef({ segments, summaries, timer, isListening: false });
  useEffect(() => {
    latestStateRef.current = { segments, summaries, timer, isListening };
  }, [segments, summaries, timer, isListening]);

  // Setup Auto-save Loop
  useEffect(() => {
    const interval = setInterval(async () => {
      // Chỉ save nếu đang nghe HOẶC có dữ liệu
      if (!latestStateRef.current.isListening && latestStateRef.current.timer === 0) return;

      try {
        // A. Save Metadata
        const { segments, summaries, timer } = latestStateRef.current;

        // Map segments sang format chuẩn DB
        const finalSegments = segments.map((s, idx) => ({
          id: `seg_${idx}`,
          start: s.words?.[0]?.start || 0,
          end: s.words?.[s.words.length - 1]?.end || 0,
          text: s.content,
          speakerId: `SPEAKER_${String(s.speaker).padStart(2, '0')}`,
          words: s.words || []
        }));

        const finalSummary = summaries.map(s => s.content).join("\n");

        const { saveDraftMeta, appendAudioChunks } = await import("../lib/indexedDB");

        await saveDraftMeta({
          id: draftIdRef.current,
          userId: user?.uid,
          title: `Bản nháp ${new Date().toLocaleString('vi-VN')}`,
          createdAt: Date.now(),
          duration: timer,
          segments: finalSegments,
          summary: finalSummary,
          speakers: [{ id: "SPEAKER_00", name: "Người nói (Live)", color: "bg-indigo-50 text-indigo-700" }],
          isDeleted: false
        });

        // B. Save Audio Chunks (Incremental)
        const currentChunks = audioChunksRef.current;
        const newChunks = currentChunks.slice(lastSavedChunkIndexRef.current);

        if (newChunks.length > 0) {
          await appendAudioChunks(draftIdRef.current, newChunks);
          lastSavedChunkIndexRef.current = currentChunks.length;
          console.log(`Auto-saved draft: ${newChunks.length} chunks`);
        }

      } catch (e) {
        console.error("Auto-save failed:", e);
      }
    }, 10000); // 10s

    return () => clearInterval(interval);
  }, [user]);

  // -----------------------------------------------------------
  // 👇👇👇 CHÈN CODE CẢNH BÁO TẮT TAB TẠI ĐÂY 👇👇👇
  // -----------------------------------------------------------
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
  }, [isListening, segments]); // [QUAN TRỌNG] Dependency array phải có 2 biến này
  // -----------------------------------------------------------

  // --- UI Stuff (Giữ nguyên) ---
  useEffect(() => { if (mobileTab === 'summary') summariesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [summaries, mobileTab]);
  useEffect(() => { if (mobileTab === 'transcript') transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [segments, interimContent, mobileTab]);
  useEffect(() => {
    let interval: any;
    if (isListening) interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isListening]);
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
  const startRecordingSession = async () => {
    try {
      // [CASE 1] NẾU ĐANG PAUSE -> RESUME LẠI
      if (streamRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume(); // Tiếp tục ghi vào file cũ
        startListening(streamRef.current, timer);
        setupVisualizer(streamRef.current); // Bật lại sóng nhạc
        return;
      }

      // [CASE 2] NẾU LÀ LẦN ĐẦU -> KHỞI TẠO MỚI
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // [FIX] Explicit MIME type for compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      console.log("Using MediaRecorder mimeType:", mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      // Đảm bảo không xóa audioChunksRef.current ở đây (bạn đã làm ở bước trước)

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      // Start with 1s timeslices for chunking
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;

      setupVisualizer(stream); // Gọi hàm visualizer đã tách
      startListening(stream, timer);
    } catch (err) { alert("Lỗi Micro: " + err); }
  };

  const stopRecordingSession = () => {
    stopListening(); // Tắt Deepgram để tiết kiệm tiền/băng thông

    // CHỈ PAUSE RECORDER, KHÔNG STOP HẲN
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }

    // Tắt visualizer
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setVolume(0);

    // QUAN TRỌNG: KHÔNG ĐƯỢC GỌI track.stop() Ở ĐÂY
    // Nếu gọi track.stop(), luồng mic sẽ chết và không resume được.
  };

  const handleToggleRecord = () => { isListening ? stopRecordingSession() : startRecordingSession(); };

  const handleClearTranscript = () => {
    if (confirm("Xóa toàn bộ?")) {
      resetTranscript();
      setSummaries([]);
      bufferTextRef.current = "";
      wordCountRef.current = 0;
    }
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

      // 2. Tạo File MP3 từ Blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
      const fileName = `Live Meeting ${new Date().toLocaleString('vi-VN').replace(/[:/]/g, '-')}.mp3`;
      const file = new File([audioBlob], fileName, { type: 'audio/mp3' });

      // 3. Upload lên Firebase Storage (Vẫn cần để nghe lại)
      const audioUrl = await uploadAudioToFirebase(file, user.uid);

      // --- [KHÁC BIỆT Ở ĐÂY] ---
      // KHÔNG GỌI RUNPOD NỮA. 
      // Lấy luôn dữ liệu từ biến 'segments' và 'summaries' có sẵn trên màn hình.

      // Chuẩn hóa segments từ Google STT sang format của DB
      const finalSegments = segments.map((s, idx) => ({
        id: `seg_${idx}_${Date.now()}`,
        start: s.words?.[0]?.start || 0,
        end: s.words?.[s.words.length - 1]?.end || 0,
        text: s.content,
        speakerId: `SPEAKER_${String(s.speaker).padStart(2, '0')}`,
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
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
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Thời gian</span>
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
          <div className="bg-slate-900 rounded-2xl p-4 md:p-6 shadow-lg shrink-0 flex items-center justify-between gap-4 md:flex-col md:justify-center md:h-64 transition-all">
            <div className="flex items-center justify-center gap-1 h-12 md:h-32 flex-1 md:w-full">
              {[...Array(20)].map((_, i) => {
                const height = isListening ? Math.min(100, Math.max(15, volume * (1 + Math.random()) * 2)) : 5;
                return <div key={i} className="w-1.5 md:w-2 bg-indigo-500 rounded-full transition-all duration-75" style={{ height: `${height}%` }}></div>
              })}
            </div>
            <button onClick={handleToggleRecord} className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white shadow-xl border-4 border-slate-800 transition-transform active:scale-95 shrink-0 ${isListening ? 'bg-yellow-500 animate-pulse' : 'bg-red-600'}`}>
              {isListening ? <Pause className="w-5 h-5 md:w-6 md:h-6" /> : <Mic className="w-5 h-5 md:w-6 md:h-6" />}
            </button>
          </div>

          {/* TRANSCRIPT */}
          <div className="flex md:hidden bg-slate-200 p-1 rounded-xl shrink-0">
            <MobileTabBtn active={mobileTab === 'transcript'} onClick={() => setMobileTab('transcript')} icon={AlignLeft} label="Hội thoại" />
            <MobileTabBtn active={mobileTab === 'summary'} onClick={() => setMobileTab('summary')} icon={Sparkles} label="Live Tóm tắt" />
          </div>
          <div className={`bg-white rounded-2xl border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden transition-all ${mobileTab === 'transcript' ? 'flex' : 'hidden md:flex'}`}>
            <div className="p-3 border-b bg-slate-50 flex items-center gap-2 shrink-0">
              <AlignLeft className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-600 uppercase">Nội dung chi tiết</span>
              <button onClick={handleClearTranscript} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
              {/* 1. Render các đoạn hội thoại */}
              {segments.map((seg, idx) => {
                // [MỚI] Kiểm tra xem đây có phải đoạn cuối cùng không?
                const isLastSegment = idx === segments.length - 1;
                // Nếu là đoạn cuối VÀ đang có chữ xám -> Hiển thị nối đuôi luôn
                const showInterimInline = isLastSegment && interimContent && interimContent.trim().length > 0;

                return (
                  <div key={idx} className={`flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 ${seg.speaker === 0 ? 'items-start' : 'items-end'}`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mx-2">
                      Speaker {seg.speaker}
                    </span>
                    <div className={`p-3 rounded-2xl max-w-[85%] ${seg.speaker === 0 ? 'bg-slate-50 border border-slate-100 rounded-tl-none' : 'bg-indigo-50 border border-indigo-100 rounded-tr-none'
                      }`}>
                      <p className="text-slate-800 leading-relaxed text-sm">
                        {seg.content}

                        {/* [MỚI] Nối chữ xám vào ngay đây */}
                        {showInterimInline && (
                          <span className="text-slate-400 italic ml-1">
                            {interimContent} ...
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* 2. Trường hợp đặc biệt: Chưa có đoạn nào (Mới bắt đầu) thì hiện chữ xám ở dòng riêng */}
              {segments.length === 0 && interimContent && (
                <div className="flex gap-3 opacity-75 mt-2">
                  <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0 flex items-center justify-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-dashed border-slate-300 shadow-sm max-w-[85%]">
                    <p className="text-slate-500 italic font-medium text-sm">{interimContent} ...</p>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} className="h-2" />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={`md:w-1/3 bg-white rounded-2xl border shadow-sm flex flex-col min-h-0 overflow-hidden transition-all ${mobileTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
          <div className="p-3 border-b bg-indigo-50 flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-800 uppercase">Live Insights (Tóm tắt)</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
            <div className="space-y-4">
              {summaries.filter(s => !s.isLoading).map((item) => (
                <div key={item.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0"></div>
                  <p className="text-slate-700 text-sm leading-relaxed text-justify">{item.content}</p>
                </div>
              ))}
              {summaries.filter(s => s.isLoading).map((item) => (
                <div key={item.id} className="flex gap-3 opacity-70">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-slate-300 animate-bounce shrink-0"></div>
                  <p className="text-slate-400 text-sm italic">{item.content}</p>
                </div>
              ))}
            </div>
            <div ref={summariesEndRef} className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}