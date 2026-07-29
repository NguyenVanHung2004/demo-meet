"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderOpen, ClipboardList, User, FileText as FileTextIcon,
  Database, Trash2, LogOut
} from "lucide-react";

type DashboardTab = "all" | "trash";

interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, onTabChange, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const navItemClass = (active: boolean) =>
    `px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium ${
      active
        ? "bg-indigo-600 text-white shadow-md transform translate-x-1"
        : "hover:bg-slate-800 hover:text-white"
    }`;

  const trashItemClass =
    "px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium " +
    (currentTab === "trash"
      ? "bg-red-900/40 text-red-200 border border-red-900/50"
      : "hover:bg-slate-800 hover:text-white");

  return (
    <div className="hidden md:flex w-64 bg-slate-900 text-slate-300 p-6 flex-col gap-8 shrink-0">
      <div className="text-2xl font-bold text-white flex items-center gap-2">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg hover:rotate-12 transition-transform">
          AI
        </div>
        <span className="tracking-tight text-xl">Smart Meeting</span>
      </div>

      <nav className="space-y-2">
        <div onClick={() => onTabChange("all")} className={navItemClass(currentTab === "all")}>
          <FolderOpen className="w-5 h-5" /> Tất cả cuộc họp
        </div>
        <Link href="/tasks" className={navItemClass(false)}>
          <ClipboardList className="w-4 h-4" /> Quản lý Task
        </Link>
        <Link href="/team" className={navItemClass(false)}>
          <User className="w-4 h-4" /> Quản lý Nhân sự
        </Link>
        <Link href="/minutes" className={navItemClass(pathname === "/minutes")}>
          <FileTextIcon className="w-4 h-4" /> Biên bản họp
        </Link>
        <Link href="/training" className={navItemClass(pathname === "/training")}>
          <Database className="w-4 h-4" /> Dữ liệu huấn luyện
        </Link>
        <div onClick={() => onTabChange("trash")} className={trashItemClass}>
          <Trash2 className="w-5 h-5" /> Thùng rác
        </div>
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors group"
        >
          <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
          <span className="group-hover:text-red-100">Đăng xuất</span>
        </button>
        <div className="text-xs text-slate-500 text-center">© 2024 MeetNote AI</div>
      </div>
    </div>
  );
}
