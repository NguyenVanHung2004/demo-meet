"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  UploadCloud, Mic, FileText, Clock, FileAudio, 
  Trash2, RotateCcw, FolderOpen, AlertCircle, Loader2, CheckCircle, XCircle, 
  Sparkles
} from "lucide-react";
import { 
  getAllMeetings, Meeting, 
  toggleTrashMeeting, deleteMeetingPermanent 
} from "../lib/db";
import { useGlobalUI } from "../context/GlobalUIProvider";

// Định nghĩa Tab hiển thị
type DashboardTab = 'all' | 'trash';

export default function DashboardState({ 
  onImport, onLive, onUseSample, onOpenMeeting, refreshSignal 
}: { 
  onImport: (file: File) => void, 
  onLive: () => void,
  onUseSample: () => void,
  onOpenMeeting: (m: Meeting) => void,
  refreshSignal: number 
}) {
  const { toast, confirm } = useGlobalUI(); // [MỚI]
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentTab, setCurrentTab] = useState<DashboardTab>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMeetings = () => {
    getAllMeetings().then(setMeetings);
  };

  useEffect(() => {
    loadMeetings();
  }, [refreshSignal]); // Reload khi có tín hiệu từ bên ngoài (Polling)

  // --- ACTIONS ---
  const handleMoveToTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // [MỚI] Dùng confirm xịn (có await)
    const isConfirmed = await confirm({
      title: "Xóa cuộc họp?",
      message: "Bạn có chắc chắn muốn chuyển cuộc họp này vào thùng rác không?",
      confirmText: "Xóa luôn",
      type: "danger"
    });

    if (isConfirmed) {
      await toggleTrashMeeting(id, true);
      toast.success("Đã chuyển vào thùng rác"); // Toast báo thành công
      loadMeetings();
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleTrashMeeting(id, false);
    loadMeetings();
  };

  const handleDeleteForever = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
     const isConfirmed = await confirm({
      title: "Xóa vĩnh viễn?",
      message: "Bạn có chắc chắn muốn chuyển cuộc họp này vĩnh viễn k?",
      confirmText: "Xóa luôn",
      type: "danger"
    });
    if (isConfirmed) {
      await deleteMeetingPermanent(id);
      loadMeetings();
    }
  };

  // --- RENDER HELPERS (Badge Trạng Thái) ---
  const getStatusBadge = (m: Meeting) => {
    switch (m.status) {
      case 'transcribing':
        return <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Đang ghi biên bản...</span>;
      case 'transcribed':
        return <span className="text-xs bg-orange-50 text-orange-600 px-2 py-1 rounded-full flex items-center gap-1"><FileText className="w-3 h-3"/> Đã ghi xong (Chờ tóm tắt)</span>;
      case 'summarizing':
        return <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3 animate-pulse"/> Đang tóm tắt...</span>;
      case 'completed':
        return <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Hoàn thành</span>;
      case 'failed':
        return <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Lỗi</span>;
      default:
        // Hỗ trợ hiển thị cho data cũ (nếu có)
        return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Không xác định</span>;
    }
  };

  // --- FILTERING ---
  const filteredMeetings = meetings.filter(m => {
    if (currentTab === 'trash') return m.isDeleted;
    return !m.isDeleted;
  });

  return (
    <div className="flex h-full">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-8 md:flex shrink-0">
         <div className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">AI</div>
          MeetNote
        </div>
        
        <nav className="space-y-2">
          <div 
            onClick={() => setCurrentTab('all')}
            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors ${currentTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <FolderOpen className="w-4 h-4" /> Tất cả cuộc họp
          </div>
          <div 
            onClick={() => setCurrentTab('trash')}
            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors ${currentTab === 'trash' ? 'bg-red-900/50 text-red-200 border border-red-900' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Trash2 className="w-4 h-4" /> Thùng rác
          </div>
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {currentTab === 'all' ? "Danh sách cuộc họp" : <span className="text-red-600">Thùng rác</span>}
          </h1>
        </header>

        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />

        {/* --- [KHÔI PHỤC] KHU VỰC UPLOAD & LIVE --- */}
        {currentTab === 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[250px] mb-10">
             
             {/* Nút 1: Upload File (Có link Demo bên trong) */}
             <div 
                onClick={() => fileInputRef.current?.click()} 
                className="relative border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition group shadow-sm"
             >
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-slate-700 block">Tải lên file ghi âm</span>
                  <span className="text-xs text-slate-400">Mp3, Wav</span>
                </div>
                
                {/* Link dùng Demo */}
                <div className="absolute bottom-4 pt-2 border-t border-slate-100 w-1/2 text-center">
                  <button onClick={(e) => { e.stopPropagation(); onUseSample(); }} className="text-xs font-bold text-indigo-500 hover:underline flex items-center justify-center gap-2 mx-auto">
                    <FileAudio className="w-3 h-3" /> Dùng file mẫu (Demo)
                  </button>
                </div>
             </div>

             {/* Nút 2: Live Recording (Đã khôi phục) */}
             <div 
                onClick={onLive} 
                className="border-2 border-dashed border-red-200 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white hover:bg-red-50 hover:border-red-300 cursor-pointer transition group shadow-sm"
             >
                <div className="p-3 bg-red-50 text-red-600 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Mic className="w-8 h-8" />
                </div>
                <span className="font-semibold text-slate-700">Ghi âm trực tiếp</span>
             </div>
          </div>
        )}

        {/* DANH SÁCH CUỘC HỌP */}
        <div className="space-y-3 pb-20">
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-10 text-slate-400 italic">Chưa có cuộc họp nào.</div>
            ) : (
              filteredMeetings.map((m) => {
                // Chỉ cho phép mở khi đã có Text (transcribed, summarizing, completed)
                const isInteractive = ['transcribed', 'summarizing', 'completed','failed'].includes(m.status);
                // Đang xử lý thì hiện icon xoay
                const isProcessing = ['transcribing', 'summarizing'].includes(m.status);

                return (
                  <div 
                    key={m.id} 
                    onClick={() => isInteractive && onOpenMeeting(m)}
                    className={`relative flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl transition-all group
                      ${isInteractive 
                        ? 'hover:shadow-lg hover:border-indigo-200 cursor-pointer' 
                        : 'opacity-70 cursor-not-allowed bg-slate-50'
                      }
                    `}
                  >
                    {/* Left Info */}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors 
                        ${isProcessing ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{m.title}</div>
                        <div className="text-xs text-slate-400 mt-1 flex gap-2 items-center">
                          <span>{new Date(m.createdAt).toLocaleDateString("vi-VN")}</span>
                          {/* Badge trạng thái */}
                          {getStatusBadge(m)}
                        </div>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2">
                      {currentTab === 'all' && (
                        <button onClick={(e) => handleMoveToTrash(e, m.id)} className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-full transition" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {currentTab === 'trash' && (
                        <>
                          <button onClick={(e) => handleRestore(e, m.id)} className="p-2 hover:bg-green-50 text-green-600 rounded-full" title="Khôi phục"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={(e) => handleDeleteForever(e, m.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-full" title="Xóa vĩnh viễn"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
        </div>
      </div>
    </div>
  );
}