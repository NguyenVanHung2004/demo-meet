"use client";

import React, { useEffect, useState, useRef } from "react";
import { 
  UploadCloud, Mic, FileText, Clock, FileAudio, 
  Archive, Trash2, RotateCcw, FolderOpen, AlertCircle
} from "lucide-react";
import { 
  getAllMeetings, Meeting, MeetingStatus, 
  updateMeetingStatus, deleteMeetingPermanent 
} from "../lib/db";

export default function DashboardState({ 
  onImport, 
  onLive, 
  onUseSample,
  onOpenMeeting 
}: { 
  onImport: (file: File) => void, 
  onLive: () => void,
  onUseSample: () => void,
  onOpenMeeting: (m: Meeting) => void 
}) {
  
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentTab, setCurrentTab] = useState<MeetingStatus>('active'); // [MỚI] Quản lý Tab
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm load dữ liệu
  const loadMeetings = () => {
    getAllMeetings().then(setMeetings);
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  // [MỚI] Xử lý hành động
  const handleMoveToTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Chuyển cuộc họp này vào thùng rác?")) {
      await updateMeetingStatus(id, 'trash');
      loadMeetings();
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await updateMeetingStatus(id, 'archived');
    loadMeetings();
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await updateMeetingStatus(id, 'active');
    loadMeetings();
  };

  const handleDeleteForever = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Hành động này không thể hoàn tác. Xóa vĩnh viễn?")) {
      await deleteMeetingPermanent(id);
      loadMeetings();
    }
  };

  // Helper
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) onImport(e.target.files[0]);
  };

  const triggerFileUpload = () => fileInputRef.current?.click();

  // Lọc danh sách theo Tab
  const filteredMeetings = meetings.filter(m => {
    // Nếu data cũ chưa có status thì coi là active
    const status = m.status || 'active';
    return status === currentTab;
  });

  return (
    <div className="flex h-full">
      {/* 1. SIDEBAR */}
      <div className="w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-8 hidden md:flex shrink-0">
         <div className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">AI</div>
          MeetNote
        </div>
        
        <nav className="space-y-2">
          <div 
            onClick={() => setCurrentTab('active')}
            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors ${currentTab === 'active' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <FolderOpen className="w-4 h-4" /> Tất cả cuộc họp
          </div>
          <div 
            onClick={() => setCurrentTab('archived')}
            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors ${currentTab === 'archived' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Archive className="w-4 h-4" /> Đã lưu trữ
          </div>
          <div 
            onClick={() => setCurrentTab('trash')}
            className={`px-4 py-2 rounded-md cursor-pointer flex items-center gap-3 transition-colors ${currentTab === 'trash' ? 'bg-red-900/50 text-red-200 border border-red-900' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Trash2 className="w-4 h-4" /> Thùng rác
          </div>
        </nav>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 p-8 overflow-y-auto bg-slate-50">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            {currentTab === 'active' && "Cuộc họp của tôi"}
            {currentTab === 'archived' && <span className="flex items-center gap-2 text-indigo-700"><Archive /> Kho lưu trữ</span>}
            {currentTab === 'trash' && <span className="flex items-center gap-2 text-red-600"><Trash2 /> Thùng rác</span>}
          </h1>
        </header>

        <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileChange} />

        {/* CHỈ HIỆN CÁC NÚT TẠO MỚI KHI Ở TAB ACTIVE */}
        {currentTab === 'active' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[300px] mb-10">
             {/* Nút Upload */}
             <div onClick={triggerFileUpload} className="relative border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition group shadow-sm">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <span className="font-semibold text-slate-700 block">Tải lên file ghi âm</span>
                  <span className="text-xs text-slate-400">Mp3, Wav (Max 500MB)</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 w-1/2 text-center">
                  <button onClick={(e) => { e.stopPropagation(); onUseSample(); }} className="text-sm font-bold text-indigo-600 hover:underline flex items-center justify-center gap-5 mx-auto">
                    <FileAudio className="w-3 h-3" /> Dùng audio đã chuẩn bị sẵn.
                  </button>
                </div>
             </div>

             {/* Nút Live */}
             <div onClick={onLive} className="border-2 border-dashed border-red-200 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white hover:bg-red-50 hover:border-red-300 cursor-pointer transition group shadow-sm">
                <div className="p-3 bg-red-50 text-red-600 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors">
                  <Mic className="w-8 h-8" />
                </div>
                <span className="font-semibold text-slate-700">Ghi âm trực tiếp</span>
             </div>
          </div>
        )}

        {/* DANH SÁCH LISTING */}
        <div>
          <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> 
            {currentTab === 'active' ? "Gần đây" : `Danh sách (${filteredMeetings.length})`}
          </h3>
          
          <div className="space-y-3 pb-20">
            {filteredMeetings.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-xl text-slate-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Không có dữ liệu nào ở đây.</p>
              </div>
            ) : (
              filteredMeetings.map((m) => (
                <div 
                  key={m.id} 
                  onClick={() => onOpenMeeting(m)}
                  className="relative flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-lg hover:border-indigo-200 cursor-pointer transition-all group"
                >
                  {/* Left Info */}
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors 
                      ${currentTab === 'trash' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-indigo-700">{m.title}</div>
                      <div className="text-xs text-slate-400 mt-1 flex gap-2">
                        <span>{formatDate(m.createdAt)}</span>
                        {m.id.startsWith('demo') && <span className="bg-indigo-100 text-indigo-700 px-1.5 rounded">Demo</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions (Chỉ hiện khi hover) */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    
                    {/* Nút cho Tab Active */}
                    {currentTab === 'active' && (
                      <>
                        <button 
                          onClick={(e) => handleArchive(e, m.id)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full" 
                          title="Lưu trữ"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleMoveToTrash(e, m.id)}
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full" 
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Nút cho Tab Archived */}
                    {currentTab === 'archived' && (
                      <>
                        <button 
                          onClick={(e) => handleRestore(e, m.id)}
                          className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-full" 
                          title="Khôi phục"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleMoveToTrash(e, m.id)}
                          className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full" 
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Nút cho Tab Trash */}
                    {currentTab === 'trash' && (
                      <>
                        <button 
                          onClick={(e) => handleRestore(e, m.id)}
                          className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-full" 
                          title="Khôi phục lại"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteForever(e, m.id)}
                          className="p-2 hover:bg-red-600 hover:text-white text-red-500 rounded-full bg-red-50" 
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}