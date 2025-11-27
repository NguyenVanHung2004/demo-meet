"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { parseTranscriptFile } from "../lib/parser"; 
import { RAW_TRANSCRIPT_FILE, RAW_SUMMARY_FILE } from "../lib/mockData";
import { 
  Play, Pause, Wand2, ChevronLeft, Save, Sparkles, X, 
  FileText, Copy, Check, Info, Keyboard, Youtube, ArrowRight 
} from "lucide-react";
import TranscriptRow from "./TranscriptRow";
import ReactMarkdown from 'react-markdown';

export default function EditorState({ audioSrc }: { audioSrc: string }) {
  
  // --- STATE ---
  // [MỚI] Modal Hướng dẫn ban đầu (Mặc định là true để hiện lên ngay)
  const [showIntroModal, setShowIntroModal] = useState(true);

  // Parse dữ liệu
  const initialData = useMemo(() => {
    return parseTranscriptFile(RAW_TRANSCRIPT_FILE);
  }, []);

  const [segments, setSegments] = useState(initialData.segments);
  const [speakers, setSpeakers] = useState(initialData.speakers);
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Modal State
  const [showSummary, setShowSummary] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // --- ACTIONS (Giữ nguyên logic cũ) ---
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

  const handleUpdateSpeakerName = (id: string, newName: string) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

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

  const handleSummarize = () => {
    setIsSummarizing(true);
    setTimeout(() => {
      setIsSummarizing(false);
      let dynamicSummary = RAW_SUMMARY_FILE;
      speakers.forEach(spk => {
        const regex = new RegExp(spk.id, 'g');
        dynamicSummary = dynamicSummary.replace(regex, spk.name);
      });
      setSummaryContent(dynamicSummary);
      setShowSummary(true);
    }, 1500);
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
      
      {/* ----------------------------------------------------- */}
      {/* [MỚI] MODAL GIỚI THIỆU & HƯỚNG DẪN (Overlay)          */}
      {/* ----------------------------------------------------- */}
      {showIntroModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transform scale-100 transition-all">
            
            {/* Header: Thông báo thành công */}
            <div className="bg-green-50 p-6 border-b border-green-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-800">Xử lý hoàn tất!</h2>
                <p className="text-green-700 text-sm">AI đã tách người nói và gỡ băng thành công.
                </p>
                <p className="text-green-700 text-sm">
                  Note: Vì đây là chỉ là mock UI nên không gọi model thật, nhưng data mock là data thật đã chạy bởi model.
                </p>
              </div>
            </div>

            <div className="p-8 space-y-8">
              
              {/* Phần 1: Nguồn Audio */}
              <div className="flex items-start gap-4 p-4 bg-slate-50 border rounded-xl">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Youtube className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Nguồn dữ liệu</h3>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                    Audio demo này được trích xuất từ Talkshow: <span className="font-medium italic">"VTV đặc biệt Gala Sách hay - Đọc và thay đổi | Talkshow Đinh Tị Books
"</span> trên YouTube.
                    <br/>
                    <a 
                      href="https://www.youtube.com/watch?v=blwCA5aG1s0" // Bạn thay link thật vào đây nhé
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline text-xs font-medium inline-flex items-center gap-1"
                    >
                      Xem video gốc tại đây ↗
                    </a>
                  </p>
                </div>
              </div>

              {/* Phần 2: Hướng dẫn sử dụng (Grid) */}
              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Keyboard className="w-5 h-5 text-indigo-500" />
                  Hướng dẫn chỉnh sửa nhanh
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Item 1 */}
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Tách đoạn</span>
                      <kbd className="px-2 py-1 bg-slate-100 border rounded text-xs font-mono text-slate-500 group-hover:bg-white">Enter</kbd>
                    </div>
                    <p className="text-xs text-slate-500">Đặt chuột vào giữa câu và nhấn Enter để tách thành 2 dòng.</p>
                  </div>

                  {/* Item 2 */}
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Gộp đoạn</span>
                      <kbd className="px-2 py-1 bg-slate-100 border rounded text-xs font-mono text-slate-500 group-hover:bg-white">Backspace</kbd>
                    </div>
                    <p className="text-xs text-slate-500">Đặt chuột ở đầu dòng và nhấn Backspace để gộp lên trên.</p>
                  </div>

                  {/* Item 3 */}
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Đổi tên</span>
                      <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Sidebar</span>
                    </div>
                    <p className="text-xs text-slate-500">Nhập tên thật ở cột trái ("Sếp Tùng", "Khách hàng")...</p>
                  </div>

                  {/* Item 4 */}
                  <div className="p-4 border rounded-xl hover:border-indigo-300 transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700">Nghe lại</span>
                      <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Click</span>
                    </div>
                    <p className="text-xs text-slate-500">Bấm vào bất kỳ dòng chữ nào để Audio nhảy tới đó.</p>
                  </div>

                </div>
              </div>
            </div>

            {/* Footer: Button */}
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowIntroModal(false)}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
              >
                Đã hiểu, bắt đầu Edit <ArrowRight className="w-5 h-5" />
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ----------------------------------------------------- */}


      {/* 1. LEFT SIDEBAR */}
      <div className="w-80 border-r bg-slate-50 flex flex-col z-20 shadow-lg">
        <div className="p-4 border-b bg-white">
          <button className="flex items-center text-slate-500 text-sm hover:text-slate-800 mb-4">
            <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
          </button>
          <h2 className="font-bold text-slate-800 text-lg">Quản lý người nói</h2>
          <p className="text-xs text-slate-400 mt-1">Đổi tên tại đây để cập nhật toàn bộ biên bản.</p>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {speakers.map(spk => (
            <div key={spk.id} className="bg-white p-3 rounded-lg border shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${spk.color.split(" ")[0]}`}>
                  {spk.name.charAt(0)}
                </div>
                <span className="text-xs font-mono text-slate-400">{spk.id}</span>
              </div>
              <input 
                className="w-full text-sm font-medium border-b border-transparent focus:border-indigo-500 outline-none bg-transparent"
                value={spk.name}
                onChange={(e) => handleUpdateSpeakerName(spk.id, e.target.value)}
                placeholder="Nhập tên thật..."
              />
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-white space-y-3">
          <button 
            onClick={handleViewTranscript}
            className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all"
          >
            <FileText className="w-5 h-5" />
            Xem bản đầy đủ
          </button>
          <button 
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200"
          >
            {isSummarizing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {isSummarizing ? "Đang tóm tắt..." : "Gửi tóm tắt AI"}
          </button>
        </div>
      </div>

      {/* 2. MAIN EDITOR */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-16 border-b flex items-center justify-between px-8 bg-white/90 backdrop-blur z-10 sticky top-0">
          <h1 className="font-bold text-slate-700">Transcript Editor</h1>
          <div className="text-sm text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Đã lưu
          </div>
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
                />
              );
            })}
          </div>
        </div>

        <div className="h-24 bg-white border-t px-8 flex items-center gap-6 shadow-[0_-5px_20px_rgba(0,0,0,0.03)] z-20">
           <button onClick={togglePlay} className="w-12 h-12 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-105 transition">
             {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
           </button>
           <div className="flex-1 flex flex-col gap-2">
             <div className="flex justify-between text-xs font-medium text-slate-500">
               <span>{formatTime(currentTime)}</span>
               <span>{formatTime(duration)}</span>
             </div>
             <div 
               className="w-full h-2 bg-slate-100 rounded-full cursor-pointer relative overflow-hidden group"
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
           {/* [PHẦN SỬA ĐỔI] Nội dung Markdown render đẹp */}
          <div className="p-8 overflow-y-auto bg-white">
            <ReactMarkdown
              components={{
                // Tùy chỉnh style cho từng thẻ Markdown
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-indigo-700 mb-4 border-b pb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4 text-slate-600" {...props} />,
                li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                p: ({node, ...props}) => <p className="mb-3 text-slate-600 leading-relaxed" {...props} />,
              }}
            >
              {summaryContent}
            </ReactMarkdown>
          </div>
            <div className="p-4 border-t bg-white flex justify-end gap-2">
              <button onClick={() => setShowSummary(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                <Save className="w-4 h-4" /> Lưu biên bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL EXPORT TRANSCRIPT */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                <FileText className="w-5 h-5 text-indigo-600" /> 
                Biên bản chi tiết
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-sm bg-white border hover:bg-slate-50 rounded-lg flex items-center gap-2 transition"
                >
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
                className="w-full h-[60vh] p-4 bg-white border rounded-xl font-sans leading-relaxed text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-sm"
                value={exportContent}
              />
            </div>
            <div className="p-4 border-t bg-white flex justify-end">
              <button 
                onClick={() => setShowExportModal(false)} 
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}