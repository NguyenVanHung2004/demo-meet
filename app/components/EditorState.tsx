"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Play, Pause, ChevronLeft, Save, Sparkles, X, 
  FileText, Copy, Check, Keyboard, ArrowRight, 
  Plus, Trash2, Pencil, Type, Eye, Users // [MỚI] Thêm icon Users
} from "lucide-react";
import TranscriptRow from "./TranscriptRow"; 
import { Meeting, saveMeeting, updateMeetingTitle } from "../lib/db"; 
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
  onSummarize: (id: string, text: string) => void
}) {
  // --- STATE ---
  const [showIntroModal, setShowIntroModal] = useState(true);
  const [segments, setSegments] = useState(initialData.segments);
  const [speakers, setSpeakers] = useState(initialData.speakers);

  // Edit Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(initialData.title);
  
  // Audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showSummary, setShowSummary] = useState(false); 
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSpeakerModal, setShowSpeakerModal] = useState(false); // [MỚI] Modal quản lý speaker mobile
  const [exportContent, setExportContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mobile Tabs
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  const { toast, confirm } = useGlobalUI();

  // Focus input title
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  // --- ACTIONS (Giữ nguyên logic cũ) ---
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "00:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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
      audioRef.current.currentTime = Math.max(0, time);
      if(!isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
      }
    }
  };

  // Logic Title
  const handleSaveTitle = async () => {
    if (!title.trim()) {
      setTitle(initialData.title); 
      setIsEditingTitle(false);
      return;
    }
    const updatedMeeting = { ...initialData, title: title };
    await saveMeeting(updatedMeeting);
    setIsEditingTitle(false);
    toast.success("Đã đổi tên cuộc họp");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') { setTitle(initialData.title); setIsEditingTitle(false); }
  };

  // Logic Speakers
  const handleAddSpeaker = () => {
    let nextIndex = speakers.length;
    let newId = `SPEAKER_${String(nextIndex).padStart(2, '0')}`;
    while (speakers.some(s => s.id === newId)) {
      nextIndex++;
      newId = `SPEAKER_${String(nextIndex).padStart(2, '0')}`;
    }
    const colors = [
      "bg-indigo-50 text-indigo-700 border-indigo-200",
      "bg-emerald-50 text-emerald-700 border-emerald-200",
      "bg-orange-50 text-orange-700 border-orange-200",
      "bg-pink-50 text-pink-700 border-pink-200"
    ];
    setSpeakers([...speakers, {
      id: newId,
      name: `Người mới ${nextIndex}`,
      color: colors[Math.floor(Math.random() * colors.length)]
    }]);
  };

  const handleDeleteSpeaker = async (idToDelete: string) => {
    if (speakers.length <= 1) return toast.warning("Giữ lại ít nhất 1 người!");
    const isConfirmed = await confirm({
        title: "Xóa người nói?",
        message: "Lời thoại sẽ được gán cho người đầu tiên.",
        type: "danger"
    });
    if (isConfirmed) {
      const fallback = speakers.find(s => s.id !== idToDelete) || speakers[0];
      const updatedSegments = segments.map(seg => seg.speakerId === idToDelete ? { ...seg, speakerId: fallback.id } : seg);
      setSegments(updatedSegments);
      setSpeakers(speakers.filter(s => s.id !== idToDelete));
      toast.success("Đã xóa người nói.");
    }
  }

  const handleUpdateSpeakerName = (id: string, newName: string) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  // Logic Editor
  const handleUpdateText = (segId: string, newText: string) => setSegments(prev => prev.map(s => s.id === segId ? { ...s, text: newText } : s));
  const handleChangeSpeaker = (segId: string, newId: string) => setSegments(prev => prev.map(s => s.id === segId ? { ...s, speakerId: newId } : s));
  
  const handleSplitSegment = (segId: string, cursorIndex: number) => {
    const idx = segments.findIndex(s => s.id === segId);
    if (idx === -1) return;
    const original = segments[idx];
    const duration = original.end - original.start;
    const splitRatio = original.text.length > 0 ? cursorIndex / original.text.length : 0.5;
    const newMidTime = original.start + (duration * splitRatio);

    const newSeg1 = { ...original, text: original.text.slice(0, cursorIndex).trim(), end: newMidTime };
    const newSeg2 = { id: Date.now().toString(), speakerId: original.speakerId, start: newMidTime, end: original.end, text: original.text.slice(cursorIndex).trim() };
    
    const newSegments = [...segments];
    newSegments[idx] = newSeg1;
    newSegments.splice(idx + 1, 0, newSeg2);
    setSegments(newSegments);
  };

  const handleMergeSegment = (currentId: string) => {
    const index = segments.findIndex(s => s.id === currentId);
    if (index <= 0) return;
    const current = segments[index];
    const prev = segments[index - 1];
    const merged = { ...prev, text: (prev.text + " " + current.text).trim(), end: current.end };
    const newSegments = [...segments];
    newSegments[index - 1] = merged;
    newSegments.splice(index, 1);
    setSegments(newSegments);
  };

  const handleAddRow = (prevId: string) => {
    const index = segments.findIndex(s => s.id === prevId);
    if (index === -1) return;
    const prev = segments[index];
    const newSeg = { id: Date.now().toString(), speakerId: prev.speakerId, start: prev.end, end: prev.end + 2, text: "" };
    const newSegments = [...segments];
    newSegments.splice(index + 1, 0, newSeg);
    setSegments(newSegments);
  };

  const handleTimeChange = (id: string, newStart: number) => {
    setSegments(prev => {
        const idx = prev.findIndex(s => s.id === id);
        if (idx === -1) return prev;
        const updated = [...prev];
        const current = { ...updated[idx] };
        current.start = newStart;
        if (current.start >= current.end) current.end = current.start + 2;
        if (idx > 0 && updated[idx-1].end > current.start) updated[idx-1].end = current.start;
        updated[idx] = current;
        return updated.sort((a, b) => a.start - b.start);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updatedMeeting = { 
        ...initialData, 
        segments: segments,
        speakers: speakers, // Lưu cả danh sách người nói
        title: title
    };
    await saveMeeting(updatedMeeting);
    setTimeout(() => { setIsSaving(false); toast.success("Đã lưu thành công!"); }, 500);
  };

  const handleSummarizeRequest = () => {
    const fullText = segments.map(s => `[${speakers.find(sp => sp.id === s.speakerId)?.name}]: ${s.text}`).join("\n");
    onSummarize(initialData.id, fullText);
    toast.info("Đang tóm tắt ngầm...");
    onBack();
  };

  const handleViewTranscript = () => {
    const txt = segments.map(s => {
        const name = speakers.find(sp => sp.id === s.speakerId)?.name;
        return `[${formatTime(s.start)}] ${name}: ${s.text}`;
    }).join("\n\n");
    setExportContent(txt);
    setShowExportModal(true);
  };

  return (
    <div className="flex flex-col h-screen bg-white relative font-sans text-slate-900">
      
      {/* ------------------- SPEAKER MODAL (MOBILE) ------------------- */}
      {showSpeakerModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full sm:max-w-md h-[70vh] sm:h-auto rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" /> Quản lý người nói
                    </h3>
                    <button onClick={() => setShowSpeakerModal(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500"/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {speakers.map(spk => (
                        <div key={spk.id} className="bg-white p-3 rounded-lg border shadow-sm flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${spk.color.split(' ')[0]}`}>
                                {spk.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-slate-400 font-mono mb-1">{spk.id}</div>
                                <input 
                                    value={spk.name} 
                                    onChange={(e) => handleUpdateSpeakerName(spk.id, e.target.value)}
                                    className="w-full text-sm font-medium border-b border-slate-200 focus:border-indigo-500 outline-none bg-transparent pb-1"
                                    placeholder="Nhập tên..."
                                />
                            </div>
                            <button onClick={() => handleDeleteSpeaker(spk.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t bg-slate-50">
                    <button onClick={handleAddSpeaker} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                        <Plus className="w-5 h-5" /> Thêm người mới
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* ------------------- HEADER ------------------- */}
      <div className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-white shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
             <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                <ChevronLeft className="w-5 h-5" />
             </button>
             
             {/* Edit Title Logic */}
             <div className="flex-1 min-w-0">
                {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                        <input 
                            ref={titleInputRef}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleSaveTitle}
                            className="text-sm md:text-lg font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded w-full focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button onMouseDown={handleSaveTitle} className="text-green-600"><Check className="w-5 h-5"/></button>
                    </div>
                ) : (
                    <div className="group flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                        <h1 className="font-bold text-slate-800 text-sm md:text-lg truncate max-w-[150px] md:max-w-md" title={title}>{title}</h1>
                        <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                )}
                <p className="text-[10px] md:text-xs text-slate-400 hidden md:block">Chế độ chỉnh sửa chi tiết</p>
             </div>
        </div>

        <div className="flex gap-2">
            {/* [MỚI] Nút Quản lý Speaker cho Mobile */}
            <button 
                onClick={() => setShowSpeakerModal(true)} 
                className="md:hidden flex items-center justify-center p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
                <Users className="w-5 h-5" />
            </button>

            <button onClick={handleSummarizeRequest} className="hidden md:flex items-center gap-2 px-3 py-1.5 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg text-sm font-medium transition-colors border border-orange-200">
                <Sparkles className="w-4 h-4" /> Tóm tắt lại
            </button>
            <button onClick={handleSave} disabled={isSaving} className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg text-sm font-medium shadow-md transition-all ${isSaving ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                <Save className="w-4 h-4" /> <span className="hidden md:inline">{isSaving ? "Đã lưu" : "Lưu"}</span>
            </button>
        </div>
      </div>

      {/* ------------------- MOBILE TABS ------------------- */}
      <div className="md:hidden flex bg-white border-b sticky top-0 z-10 shrink-0">
         <button onClick={() => setMobileTab('edit')} className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 border-b-2 ${mobileTab === 'edit' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
            <Type className="w-4 h-4" /> Soạn thảo
         </button>
         <button onClick={() => setMobileTab('preview')} className={`flex-1 py-3 text-xs font-bold uppercase flex items-center justify-center gap-2 border-b-2 ${mobileTab === 'preview' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
            <Eye className="w-4 h-4" /> Xem trước
         </button>
      </div>

      {/* ------------------- BODY LAYOUT ------------------- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR (Speakers) - Desktop Only */}
        <div className="hidden md:flex w-72 border-r bg-slate-50 flex-col shrink-0">
            <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Người tham gia</h3>
                <button onClick={handleAddSpeaker} className="p-1 bg-white border hover:bg-indigo-50 rounded"><Plus className="w-4 h-4"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {speakers.map(spk => (
                    <div key={spk.id} className="bg-white p-3 rounded-lg border shadow-sm group">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${spk.color.split(' ')[0]}`}>{spk.name.charAt(0)}</div>
                            <span className="text-xs font-mono text-slate-400 flex-1">{spk.id.split('_')[1]}</span>
                            <button onClick={() => handleDeleteSpeaker(spk.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition"><Trash2 className="w-3 h-3"/></button>
                        </div>
                        <input 
                            value={spk.name} 
                            onChange={(e) => handleUpdateSpeakerName(spk.id, e.target.value)}
                            className="w-full text-sm font-medium border-b border-transparent focus:border-indigo-500 outline-none bg-transparent"
                            placeholder="Tên..."
                        />
                    </div>
                ))}
            </div>
            <div className="p-4 border-t">
                <button onClick={handleViewTranscript} className="w-full py-2 bg-white border text-slate-600 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-slate-50">
                    <FileText className="w-4 h-4" /> Xem toàn văn
                </button>
            </div>
        </div>

        {/* MAIN EDITOR AREA */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 scroll-smooth relative">
            <div className="max-w-3xl mx-auto min-h-full bg-white border-x shadow-sm pb-32">
                
                {/* MODE: EDIT */}
                {mobileTab === 'edit' && (
                    <div className="p-4 md:p-8 space-y-2">
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
                )}

                {/* MODE: PREVIEW (Read Only) */}
                {mobileTab === 'preview' && (
                    <div className="p-6 md:p-10 prose prose-indigo max-w-none">
                        {segments.map((s, i) => {
                             const name = speakers.find(sp => sp.id === s.speakerId)?.name;
                             return (
                                <p key={i} className="mb-4 text-justify">
                                    <strong className="text-slate-800">{name}:</strong> {s.text}
                                </p>
                             )
                        })}
                    </div>
                )}
            </div>
        </div>

      </div>
      
      {/* ------------------- FOOTER PLAYER ------------------- */}
      <div className="h-20 bg-white border-t px-4 md:px-8 flex items-center gap-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20 shrink-0">
         <button onClick={togglePlay} className="w-10 h-10 md:w-12 md:h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg shrink-0">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
         </button>
         
         <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] md:text-xs font-medium text-slate-500">
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

         {/* Mobile Extra Action */}
         <div className="md:hidden">
             <button onClick={handleSummarizeRequest} className="p-2 bg-orange-100 text-orange-600 rounded-full">
                 <Sparkles className="w-5 h-5" />
             </button>
         </div>

         <audio 
            ref={audioRef} 
            src={audioSrc} 
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)} 
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
         />
      </div>

      {/* ------------------- MODALS CŨ ------------------- */}
      {showIntroModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 m-4">
            <div className="flex items-center gap-3 mb-4 text-green-600">
                <Check className="w-8 h-8 p-1 bg-green-100 rounded-full" />
                <h2 className="text-xl font-bold">Sẵn sàng chỉnh sửa!</h2>
            </div>
            <p className="text-slate-600 mb-6">Sử dụng các phím tắt để thao tác nhanh hơn:</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 border rounded-lg bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase">Tách câu</span>
                    <div className="font-mono text-indigo-600 font-bold mt-1">Enter</div>
                </div>
                <div className="p-3 border rounded-lg bg-slate-50">
                    <span className="text-xs font-bold text-slate-500 uppercase">Gộp câu</span>
                    <div className="font-mono text-indigo-600 font-bold mt-1">Backspace</div>
                </div>
            </div>
            <button onClick={() => setShowIntroModal(false)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition">
                Bắt đầu ngay
            </button>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl h-[80vh] rounded-2xl shadow-xl flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">Xuất văn bản</h3>
                    <button onClick={() => setShowExportModal(false)}><X className="w-5 h-5 text-slate-400"/></button>
                </div>
                <textarea className="flex-1 p-4 font-mono text-sm resize-none focus:outline-none" readOnly value={exportContent} />
                <div className="p-4 border-t flex justify-end">
                    <button onClick={() => { navigator.clipboard.writeText(exportContent); toast.success("Copied!"); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex gap-2"><Copy className="w-4 h-4"/> Copy</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}