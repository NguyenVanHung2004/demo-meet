"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  UploadCloud,
  Mic,
  FileText,
  Trash2,
  FolderOpen,
  AlertCircle,
  Loader2,
  CheckCircle,
  Sparkles,
  Search,
  Calendar,
  Clock,
  MoreVertical,
  RotateCcw,
  Wand2,
  LogOut,
  ClipboardList,
} from "lucide-react";
import {
  getAllMeetings,
  Meeting,
  toggleTrashMeeting,
  deleteMeetingPermanent,
} from "../lib/db";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
type DashboardTab = "all" | "trash";

export default function DashboardState({
  onImport,
  onLive,
  onUseSample,
  onOpenMeeting,
  refreshSignal,
  onReprocess,
}: {
  onImport: (file: File) => void;
  onLive: () => void;
  onUseSample: () => void;
  onOpenMeeting: (m: Meeting) => void;
  onReprocess: (m: Meeting) => void;
  refreshSignal: number;
}) {
  const { user, login, logout } = useAuth(); // [MỚI] Lấy thêm logout
  const { toast, confirm } = useGlobalUI();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [currentTab, setCurrentTab] = useState<DashboardTab>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const loadMeetings = () => {
    if (user) {
      // Truyền user.uid vào để chỉ lấy cuộc họp của người này
      getAllMeetings(user.uid).then(setMeetings);
    } else {
      setMeetings([]); // Chưa đăng nhập thì list rỗng
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [refreshSignal, user]);

  // --- ACTIONS ---
  const handleMoveToTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: "Xóa cuộc họp?",
      message: "Cuộc họp sẽ được chuyển vào thùng rác.",
      confirmText: "Xóa",
      type: "danger",
    });

    if (isConfirmed) {
      await toggleTrashMeeting(id, true);
      toast.success("Đã chuyển vào thùng rác");
      loadMeetings();
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await toggleTrashMeeting(id, false);
    toast.success("Đã khôi phục cuộc họp");
    loadMeetings();
  };

  const handleDeleteForever = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isConfirmed = await confirm({
      title: "Xóa vĩnh viễn?",
      message: "Hành động này không thể hoàn tác. Bạn chắc chứ?",
      confirmText: "Xóa vĩnh viễn",
      type: "danger",
    });
    if (isConfirmed) {
      await deleteMeetingPermanent(id);
      loadMeetings();
    }
  };

  // --- HELPER: Badge ---
  const getStatusBadge = (m: Meeting) => {
    switch (m.status) {
      case "transcribing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
            <Loader2 className="w-3 h-3 animate-spin" /> Đang xử lí
          </span>
        );
      case "transcribed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-100">
            <FileText className="w-3 h-3" /> Đã ghi xong{" "}
          </span>
        );
      case "summarizing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
            <Sparkles className="w-3 h-3 animate-pulse" /> Đang tóm tắt
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
            <CheckCircle className="w-3 h-3" /> Hoàn thành
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-100">
            <AlertCircle className="w-3 h-3" /> Lỗi
          </span>
        );
      default:
        return null;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // --- FILTERING ---
  const filteredMeetings = meetings.filter((m) => {
    if (currentTab === "trash") return m.isDeleted;
    return !m.isDeleted;
  });

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden relative font-sans">
      {/* SIDEBAR (Desktop Only) */}
      <div className="hidden md:flex w-64 bg-slate-900 text-slate-300 p-6 flex-col gap-8 shrink-0">
        <div className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg hover:rotate-12 transition-transform">
            AI
          </div>
          <span className="tracking-tight">MeetNote</span>
        </div>

        <nav className="space-y-2">
          <div
            onClick={() => setCurrentTab("all")}
            className={`px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium ${
              currentTab === "all"
                ? "bg-indigo-600 text-white shadow-md transform translate-x-1"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FolderOpen className="w-5 h-5" /> Tất cả cuộc họp
          </div>
          <Link
            href="/tasks"
            className="px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium"
          >
            <ClipboardList className="w-4 h-4" /> Quản lý Task
          </Link>
          <div
            onClick={() => setCurrentTab("trash")}
            className={`px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium ${
              currentTab === "trash"
                ? "bg-red-900/40 text-red-200 border border-red-900/50"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Trash2 className="w-5 h-5" /> Thùng rác
          </div>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          {/* [MỚI] Nút Đăng xuất Desktop */}
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors group"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            <span className="group-hover:text-red-100">Đăng xuất</span>
          </button>
          <div className="text-xs text-slate-500 text-center">
            © 2024 MeetNote AI
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* HEADER */}
        <header className="bg-white border-b px-4 py-3 md:px-8 md:py-4 flex justify-between items-center shrink-0 sticky top-0 z-20">
          <h1 className="text-lg md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            {currentTab === "all" ? (
              "Danh sách cuộc họp"
            ) : (
              <span className="text-red-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Thùng rác
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 md:gap-4">
            {/* [MỚI] Nút Đăng xuất Mobile (Chỉ hiện trên màn hình nhỏ) */}
            <button
              onClick={() => logout()}
              className="md:hidden p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={onUseSample}
              className="text-sm font-medium text-slate-500 hover:text-indigo-600 px-3 py-2"
            >
              Mẫu thử
            </button>
            <button
              onClick={onLive}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-all active:scale-95"
            >
              <Mic className="w-4 h-4" /> Ghi âm mới
            </button>
          </div>
        </header>

        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          />

          {/* ACTION GRID (Chỉ hiện khi ở tab All) */}
          {currentTab === "all" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
              {/* Upload Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative border border-dashed border-indigo-200 bg-white hover:border-indigo-400 rounded-xl p-4 md:p-6 flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 cursor-pointer transition-all duration-300 shadow-sm active:scale-[0.98]"
              >
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="text-left md:text-center">
                  <span className="font-bold text-slate-700 block text-sm md:text-lg">
                    Tải file lên
                  </span>
                  <span className="text-xs text-slate-400">
                    MP3, WAV (Max 100MB)
                  </span>
                </div>
              </div>

              {/* [FIX] Live Card - ĐÃ BỎ class 'md:hidden' để hiện cả trên Desktop & Mobile */}
              <div
                onClick={onLive}
                className="group border border-dashed border-red-200 bg-white hover:border-red-400 rounded-xl p-4 md:p-6 flex flex-row md:flex-col items-center justify-start md:justify-center gap-4 cursor-pointer transition-all duration-300 shadow-sm active:scale-[0.98]"
              >
                <div className="p-3 bg-red-50 text-red-600 rounded-full group-hover:scale-110 transition-transform">
                  <Mic className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="text-left md:text-center">
                  <span className="font-bold text-slate-700 block text-sm md:text-lg">
                    Ghi âm trực tiếp
                  </span>
                  <span className="text-xs text-slate-400">
                    Chuyển giọng nói thành văn bản
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* MEETING LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {filteredMeetings.length} Cuộc họp
              </h3>
            </div>

            {filteredMeetings.length === 0 ? (
              <div className="text-center py-12 md:py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  {currentTab === "all" ? (
                    <Calendar className="w-6 h-6 md:w-8 md:h-8" />
                  ) : (
                    <Trash2 className="w-6 h-6 md:w-8 md:h-8" />
                  )}
                </div>
                <p className="text-slate-500 font-medium text-sm">
                  Danh sách trống.
                </p>
              </div>
            ) : (
              <>
                {/* 1. DESKTOP VIEW: TABLE */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                      <tr>
                        <th className="px-6 py-4">Tên cuộc họp</th>
                        <th className="px-6 py-4">Thời lượng</th>
                        <th className="px-6 py-4">Ngày tạo</th>
                        <th className="px-6 py-4">Trạng thái</th>
                        <th className="px-6 py-4 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMeetings.map((m) => {
                        const isInteractive = [
                          "transcribed",
                          "summarizing",
                          "completed",
                          "failed",
                        ].includes(m.status);
                        return (
                          <tr
                            key={m.id}
                            onClick={() => isInteractive && onOpenMeeting(m)}
                            className={`group transition-colors ${
                              isInteractive
                                ? "hover:bg-indigo-50/50 cursor-pointer"
                                : "bg-slate-50 opacity-70"
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                                    m.status === "failed"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-indigo-100 text-indigo-600"
                                  }`}
                                >
                                  {m.title.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-700 group-hover:text-indigo-700 transition-colors line-clamp-1 max-w-[200px]">
                                  {m.title}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                              {formatDuration(m.duration)}
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-sm">
                              {new Date(m.createdAt).toLocaleDateString(
                                "vi-VN"
                              )}
                            </td>
                            <td className="px-6 py-4">{getStatusBadge(m)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {currentTab === "all" ? (
                                  <>
                                    {/* ✅ [MỚI] Nút xử lý lại (Chỉ hiện nếu trạng thái là completed/transcribed để tránh spam) */}
                                    {["completed", "transcribed"].includes(
                                      m.status
                                    ) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onReprocess(m);
                                        }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition"
                                        title="Tạo bản Transcript AI chính xác hơn"
                                      >
                                        <Wand2 className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) =>
                                        handleMoveToTrash(e, m.id)
                                      }
                                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => handleRestore(e, m.id)}
                                      className="p-2 hover:bg-green-50 text-green-600 rounded-full"
                                    >
                                      <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) =>
                                        handleDeleteForever(e, m.id)
                                      }
                                      className="p-2 hover:bg-red-50 text-red-600 rounded-full"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 2. MOBILE VIEW: CARDS */}
                <div className="md:hidden grid grid-cols-1 gap-3">
                  {filteredMeetings.map((m) => {
                    const isInteractive = [
                      "transcribed",
                      "summarizing",
                      "completed",
                      "failed",
                    ].includes(m.status);
                    return (
                      <div
                        key={m.id}
                        onClick={() => isInteractive && onOpenMeeting(m)}
                        className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all flex items-start gap-3 ${
                          !isInteractive && "opacity-75 bg-slate-50"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm ${
                            m.status === "failed"
                              ? "bg-red-100 text-red-600"
                              : m.status === "completed"
                              ? "bg-indigo-100 text-indigo-600"
                              : "bg-slate-200 text-slate-500"
                          }`}
                        >
                          {m.title.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-slate-800 truncate pr-2 text-sm">
                              {m.title}
                            </h4>
                            {currentTab === "all" && (
                              <button
                                onClick={(e) => handleMoveToTrash(e, m.id)}
                                className="p-1 text-slate-300 hover:text-red-500 -mt-1 -mr-2"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                              <Clock className="w-3 h-3" />{" "}
                              {formatDuration(m.duration)}
                            </span>
                            <span>
                              {new Date(m.createdAt).toLocaleDateString(
                                "vi-VN"
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            {getStatusBadge(m)}
                            {currentTab === "all" && (
                              <div className="flex gap-2">
                                {["completed", "transcribed"].includes(
                                  m.status
                                ) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onReprocess(m);
                                    }}
                                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"
                                  >
                                    <Wand2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            {currentTab === "trash" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => handleRestore(e, m.id)}
                                  className="p-1 bg-green-50 text-green-600 rounded"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => handleDeleteForever(e, m.id)}
                                  className="p-1 bg-red-50 text-red-600 rounded"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* --- MOBILE BOTTOM NAVIGATION --- */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex items-center justify-around pb-safe pt-2 z-30 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] h-16">
          <button
            onClick={() => setCurrentTab("all")}
            className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${
              currentTab === "all"
                ? "text-indigo-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <FolderOpen
              className={`w-6 h-6 ${currentTab === "all" && "fill-current"}`}
            />
            <span className="text-[10px] font-medium">Tất cả</span>
          </button>

          {/* Main Action: Record */}
          <Link
            href="/tasks"
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition ${
              pathname === "/tasks" ? "text-indigo-600" : "text-slate-400"
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            <span className="text-[10px] font-bold">Tasks</span>
          </Link>

          <button
            onClick={() => setCurrentTab("trash")}
            className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${
              currentTab === "trash"
                ? "text-red-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Trash2
              className={`w-6 h-6 ${currentTab === "trash" && "fill-current"}`}
            />
            <span className="text-[10px] font-medium">Thùng rác</span>
          </button>
        </div>
      </div>
    </div>
  );
}
