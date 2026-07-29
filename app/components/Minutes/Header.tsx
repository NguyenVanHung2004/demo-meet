"use client";
import { useRef } from "react";
import {
  FileText, ArrowLeft, Plus, RefreshCw, FolderPlus, Search
} from "lucide-react";
import Link from "next/link";

interface MinutesHeaderProps {
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  onImport: (file: File) => void;
  onNewFolder: () => void;
}

export default function MinutesHeader({
  loading, searchQuery, onSearchChange,
  onRefresh, onImport, onNewFolder
}: MinutesHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Link href="/" className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-bold text-slate-800 flex items-center gap-1.5 md:gap-2 truncate">
                <FileText className="w-5 h-5 md:w-7 md:h-7 text-indigo-600 shrink-0" />
                <span className="truncate">Biên bản cuộc họp</span>
              </h1>
              <p className="text-[10px] md:text-sm text-slate-500 mt-0.5 md:mt-1 truncate hidden sm:block">
                Quản lý và chỉnh sửa biên bản các cuộc họp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onNewFolder}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 md:gap-2 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="text-sm md:text-base hidden sm:inline">Tạo thư mục</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 md:px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 md:gap-2 shadow-md transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm md:text-base whitespace-nowrap">Import biên bản</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.doc,.docx"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên cuộc họp hoặc nội dung..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>
    </header>
  );
}
