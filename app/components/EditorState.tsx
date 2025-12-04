"use client";
import React, { useState, useRef, useEffect } from "react";
import { 
  Play, Pause, ChevronLeft, Save, Sparkles, X, 
  FileText, Copy, Check, Keyboard, Youtube, ArrowRight, 
  Plus, Trash2, Pencil // [MỚI] Thêm icon Pencil để sửa tên
} from "lucide-react";
import TranscriptRow from "./TranscriptRow";
import ReactMarkdown from 'react-markdown';
import { Meeting, saveMeeting, updateMeetingProcess, updateMeetingTitle } from "../lib/db"; 
import { requestSummary } from "../lib/api"; 
import { useGlobalUI } from "../context/GlobalUIProvider";

export default function EditorState({ 
  audioSrc, 
  initialData, 
  onBack,
  onSummarize
}: { 
  audioSrc: string, 
  initialData: Meeting, 
  onBack: () => void,
  onSummarize: (id: string, text: string) => void // Type cho prop mới
}) {
  // --- STATE ---
  const [showIntroModal, setShowIntroModal] = useState(true);

  const [segments, setSegments] = useState(initialData.segments);
  const [speakers, setSpeakers] = useState(initialData.speakers);

  // [STATE SỬA TIÊU ĐỀ]
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(initialData.title);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null); // Ref cho input sửa tên

  // Modal State
  const [showSummary, setShowSummary] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const { toast, confirm } = useGlobalUI();

  // Focus input khi bấm sửa tên
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  // --- ACTIONS ---
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "00:00";
    return new Date(time * 1000).toISOString().substr(14, 5);
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      const offsetTime = Math.max(0, time + 1.0); 
      audioRef.current.currentTime = offsetTime;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // --- LOGIC SỬA TIÊU ĐỀ ---
  const handleSaveTitle = async () => {
    if (!title.trim()) {
      setTitle(initialData.title); 
      setIsEditingTitle(false);
      return;
    }
    await updateMeetingTitle(initialData.id, title);
    setIsEditingTitle(false);
    toast.success("Đã đổi tên cuộc họp");
  };

  const handleCancelEdit = () => {
    setTitle(initialData.title);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') handleCancelEdit();
  };

  // --- LOGIC SPEAKER ---
  const handleAddSpeaker = () => {
    let nextIndex = speakers.length;
    let newId = `SPEAKER_${String(nextIndex).padStart(2, '0')}`;
    while (speakers.some(s => s.id === newId)) {
      nextIndex++;
      newId = `SPEAKER_${String(nextIndex).padStart(2, '0')}`;
    }
    const colors = [
      "bg-orange-50 text-orange-700 border-orange-200",
      "bg-teal-50 text-teal-700 border-teal-200",
      "bg-cyan-50 text-cyan-700 border-cyan-200",
      "bg-rose-50 text-rose-700 border-rose-200"
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    setSpeakers([...speakers, {
      id: newId,
      name: `Người mới ${nextIndex}`,
      color: randomColor
    }]);
  };

  const handleDeleteSpeaker = async (idToDelete: string) => {
    if (speakers.length <= 1) {
      toast.warning("Phải có ít nhất 1 người nói!");
      return;
    }
    const isConfirmed = await confirm({
        title: "Xóa người nói?",
        message: "Hành động này sẽ gán lại lời thoại của họ cho người đầu tiên.",
        type: "danger"
    });
    if (isConfirmed) {
      const fallbackSpeaker = speakers.find(s => s.id !== idToDelete) || speakers[0];
      const updatedSegments = segments.map(seg => {
        if (seg.speakerId === idToDelete) {
          return { ...seg, speakerId: fallbackSpeaker.id };
        }
        return seg;
      });
      setSegments(updatedSegments);
      setSpeakers(speakers.filter(s => s.id !== idToDelete));
      toast.success("Đã xóa người nói.");
    }
  }

  const handleUpdateSpeakerName = (id: string, newName: string) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  // --- LOGIC EDITOR ---
  const handleUpdateText = (segId: string, newText: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, text: newText } : s));
  };

  const handleChangeSpeaker = (segId: string, newSpeakerId: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, speakerId: newSpeakerId } : s));
  };

  const handleSplitSegment = (segId: string, cursorIndex: number) => {
    const idx = segments.findIndex(s => s.id === segId);
    if (idx === -1) return;
    const original = segments[idx];
    const originalDuration = original.end - original.start;
    const totalLength = original.text.length;
    const text1 = original.text.slice(0, cursorIndex).trim();
    const text2 = original.text.slice(cursorIndex).trim();
    let splitRatio = 0.5;
    if (totalLength > 0) splitRatio = cursorIndex / totalLength;
    const newMidTime = original.start + (originalDuration * splitRatio);

    const newSeg1 = { ...original, text: text1, end: newMidTime };
    const newSeg2 = { 
      id: Date.now().toString(), 
      speakerId: original.speakerId, 
      start: newMidTime, 
      end: original.end, 
      text: text2 
    };
    const newSegments = [...segments];
    newSegments[idx] = newSeg1;
    newSegments.splice(idx + 1, 0, newSeg2);
    setSegments(newSegments);
  };

  const handleMergeSegment = (currentId: string) => {
    const index = segments.findIndex(s => s.id === currentId);
    if (index <= 0) return;
    const currentSeg = segments[index];
    const prevSeg = segments[index - 1];
    const mergedPrevSeg = {
      ...prevSeg,
      text: (prevSeg.text + " " + currentSeg.text).trim(), 
      end: currentSeg.end 
    };
    const newSegments = [...segments];
    newSegments[index - 1] = mergedPrevSeg; 
    newSegments.splice(index, 1);           
    setSegments(newSegments);
  };

  const handleAddRow = (prevId: string) => {
    const index = segments.findIndex(s => s.id === prevId);
    if (index === -1) return;
    const prevSeg = segments[index];
    const newSeg = {
      id: Date.now().toString(),
      speakerId: prevSeg.speakerId,
      start: prevSeg.end,
      end: prevSeg.end + 2,
      text: ""
    };
    const newSegments = [...segments];
    newSegments.splice(index + 1, 0, newSeg);
    setSegments(newSegments);
    toast.info("Đã thêm dòng mới");
  };

  const handleTimeChange = (id: string, newStart: number) => {
    setSegments(prev => {
        const index = prev.findIndex(s => s.id === id);
        if (index === -1) return prev;
        const updated = [...prev];
        const current = { ...updated[index] };
        current.start = newStart;
        if (current.start >= current.end) {
            current.end = current.start + 2; 
        }
        if (index > 0) {
            const prevSeg = updated[index - 1];
            if (prevSeg.end > current.start) {
              prevSeg.end = current.start; 
            }
        }
        updated[index] = current;
        updated.sort((a, b) => a.start - b.start);
        return updated;
    });
  };

  // ✅ [SỬA] Hàm xử lý nút bấm
  const handleSummarize = () => {
    // 1. Chuẩn bị dữ liệu Text
    const fullTranscript = segments.map(seg => {
        const spkName = speakers.find(s => s.id === seg.speakerId)?.name || seg.speakerId;
        return `[${spkName}]: ${seg.text}`;
    }).join("\n");

    // 2. Giao việc cho Page chạy ngầm
    onSummarize(initialData.id, fullTranscript);
    
    // 3. Thông báo nhẹ
    toast.info("Đang xử lý ngầm... Bạn có thể làm việc khác.");

    // 4. THOÁT RA DASHBOARD LUÔN (Không cần chờ)
    onBack(); 
  };

  const handleSaveSummary = async () => {
    try {
      const updatedMeeting: Meeting = {
        ...initialData,
        title: title, // [QUAN TRỌNG] Lưu luôn tiêu đề mới nếu có sửa
        segments: segments,
        speakers: speakers,
        summary: summaryContent
      };
      await saveMeeting(updatedMeeting);
      toast.success("Đã lưu biên bản thành công!");
      setShowSummary(false);
    } catch (e) {
      toast.error("Lỗi khi lưu: " + e);
    }
  };

  const handleViewTranscript = () => {
    const fmt = (s: number) => new Date(s * 1000).toISOString().substr(14, 5);
    const fullText = segments.map(seg => {
      const speakerName = speakers.find(s => s.id === seg.speakerId)?.name || seg.speakerId;
      return `[${speakerName}] (${fmt(seg.start)} -> ${fmt(seg.end)}): ${seg.text}`;
    }).join("\n\n");
    setExportContent(fullText);
    setShowExportModal(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-white relative">
      
      {/* ------------------- INTRO MODAL ------------------- */}
      {showIntroModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transform scale-100 transition-all">
            <div className="bg-green-50 p-6 border-b border-green-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800">Xử lý hoàn tất!</h2>
                <p className="text-green-700 text-sm">AI đã tách người nói và ghi biên bản.</p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex items-start gap-4 p-4 bg-slate-50 border rounded-xl">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Youtube className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Nguồn dữ liệu</h3>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                    Audio demo được trích xuất từ Talkshow: <span className="font-medium italic">"VTV đặc biệt Gala Sách hay"</span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-indigo-500" /> Hướng dẫn chỉnh sửa
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Tách đoạn</span>
                      <kbd className="px-2 py-1 bg-slate-100 border rounded text-xs font-mono text-slate-500">Enter</kbd>
                    </div>
                    <p className="text-xs text-slate-500">Đặt chuột giữa câu và nhấn Enter.</p>
                  </div>
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Gộp đoạn</span>
                      <kbd className="px-2 py-1 bg-slate-100 border rounded text-xs font-mono text-slate-500">Backspace</kbd>
                    </div>
                    <p className="text-xs text-slate-500">Đặt chuột đầu dòng và nhấn Backspace.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setShowIntroModal(false)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
                Đã hiểu, bắt đầu Edit <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. LEFT SIDEBAR */}
      <div className="w-80 border-r bg-slate-50 flex flex-col z-20 shadow-lg">
        <div className="p-4 border-b bg-white">
          <button className="flex items-center text-slate-500 text-sm hover:text-slate-800 mb-4" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
          </button>
            
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-slate-800 text-lg">Người tham gia</h2>
            <button onClick={handleAddSpeaker} className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Đổi tên tại đây để cập nhật toàn bộ biên bản.</p>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
         {speakers.map(spk => (
          <div key={spk.id} className="bg-white p-3 rounded-lg border shadow-sm group relative transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${spk.color.split(" ")[0]}`}>
                {spk.name.charAt(0)}
              </div>
              <span className="text-xs font-mono text-slate-400 flex-1 truncate" title={spk.id}>{spk.id}</span>
              <button onClick={() => handleDeleteSpeaker(spk.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <input 
              className="w-full text-sm font-medium border-b border-transparent focus:border-indigo-500 outline-none bg-transparent pb-1"
              value={spk.name}
              onChange={(e) => handleUpdateSpeakerName(spk.id, e.target.value)}
              placeholder="Nhập tên thật..."
            />
          </div>
         ))}
        </div>
        <div className="p-4 border-t bg-white space-y-3">
          <button onClick={handleViewTranscript} className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all">
            <FileText className="w-5 h-5" /> Xem bản đầy đủ
          </button>
          <button onClick={handleSummarize} disabled={initialData.status === 'summarizing'} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200">
        <Sparkles className="w-5 h-5" />
            {initialData.status === 'summarizing' ? "Đang xử lý ngầm..." : "Gửi tóm tắt AI"}
          </button>
        </div>
      </div>

      {/* 2. MAIN EDITOR */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b flex items-center justify-between px-8 bg-white/90 backdrop-blur z-10 sticky top-0">
          
          {/* [PHẦN QUAN TRỌNG NHẤT: EDIT TIÊU ĐỀ Ở ĐÂY] */}
          <div className="flex-1 max-w-2xl mr-4">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 animate-in fade-in duration-200">
                <input 
                  ref={titleInputRef}
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveTitle} 
                  className="text-xl font-bold text-slate-800 bg-slate-50 border border-indigo-300 rounded px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onMouseDown={handleSaveTitle} className="p-1 text-green-600 hover:bg-green-50 rounded">
                   <Check className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h1 className="text-xl font-bold text-slate-700 truncate" title="Bấm để sửa tên">
                  {title}
                </h1>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600 p-1 rounded">
                   <Pencil className="w-4 h-4" />
                </span>
              </div>
            )}
          </div>

          <button onClick={handleSaveSummary} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
            <Save className="w-4 h-4" /> Lưu thay đổi
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pb-32 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6">
            {segments.map((seg) => {
              const currentSpeaker = speakers.find(s => s.id === seg.speakerId) || speakers[0];
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              return (
                <TranscriptRow 
                  key={seg.id}
                  segment={seg}
                  speaker={currentSpeaker}
                  allSpeakers={speakers}
                  isActive={isActive}
                  isAudioPlaying={isPlaying}
                  onTogglePlay={togglePlay}
                  onSeek={seekTo}
                  onTextChange={handleUpdateText}
                  onSpeakerChange={handleChangeSpeaker}
                  onSplit={handleSplitSegment}
                  onMerge={handleMergeSegment}
                  onAddRow={handleAddRow}
                  onTimeChange={handleTimeChange}
                />
              );
            })}
          </div>
        </div>

        {/* Footer Player */}
        <div className="h-24 bg-white border-t px-8 flex items-center gap-6 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-20">
            <button onClick={togglePlay} className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </button>
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full cursor-pointer relative overflow-hidden group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  if (duration > 0) seekTo(percent * duration);
                }}
              >
                <div className="absolute inset-0 bg-indigo-500 origin-left" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
              </div>
            </div>
            <audio 
              ref={audioRef} 
              src={audioSrc} 
              preload="metadata"
              onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)} 
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />
        </div>
      </div>

      {/* 3. MODAL SUMMARY */}
      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-indigo-50">
              <div className="flex items-center gap-2 text-indigo-800 font-bold text-lg">
                <Sparkles className="w-5 h-5" /> Kết quả Tóm tắt
              </div>
              <button onClick={() => setShowSummary(false)} className="p-2 hover:bg-white/50 rounded-full"><X className="w-5 h-5 text-indigo-900"/></button>
            </div>
            <div className="p-8 overflow-y-auto bg-white">
              <ReactMarkdown
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2" {...props} />,
                  ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-600" {...props} />,
                  li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                }}
              >
                {summaryContent}
              </ReactMarkdown>
            </div>
            <div className="p-4 border-t bg-white flex justify-end gap-2">
              <button onClick={() => setShowSummary(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
              <button onClick={handleSaveSummary} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                <Save className="w-4 h-4" /> Lưu biên bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL EXPORT */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                <FileText className="w-5 h-5 text-indigo-600" /> Biên bản chi tiết
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopy} className="px-3 py-1.5 text-sm bg-white border hover:bg-slate-50 rounded-lg flex items-center gap-2 transition">
                  {isCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  {isCopied ? "Đã copy" : "Copy"}
                </button>
                <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-slate-200 rounded-full">
                  <X className="w-5 h-5 text-slate-500"/>
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50/50">
              <textarea 
                readOnly
                className="w-full h-[60vh] p-4 bg-white border rounded-xl font-sans leading-relaxed text-sm text-slate-800 focus:outline-none resize-none shadow-sm"
                value={exportContent}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}