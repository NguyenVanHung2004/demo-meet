"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FolderOpen, ClipboardList, User, FileText as FileTextIcon,
  Database, LogOut, Trash2
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PollingManager from "../components/PollingManager";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const navItemClass = (active: boolean) =>
    `px-4 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all font-medium ${
      active
        ? "bg-indigo-600 text-white shadow-md translate-x-1"
        : "hover:bg-slate-800 hover:text-white"
    }`;

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className="hidden md:flex w-64 bg-slate-900 text-slate-300 p-6 flex-col gap-8 shrink-0">
        <div className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg hover:rotate-12 transition-transform">
            AI
          </div>
          <span className="tracking-tight text-xl">Smart Meeting</span>
        </div>

        <nav className="space-y-2">
          <Link href="/" className={navItemClass(isActive("/"))}>
            <FolderOpen className="w-5 h-5" /> Tất cả cuộc họp
          </Link>
          <Link href="/tasks" className={navItemClass(isActive("/tasks"))}>
            <ClipboardList className="w-4 h-4" /> Quản lý Task
          </Link>
          <Link href="/team" className={navItemClass(isActive("/team"))}>
            <User className="w-4 h-4" /> Quản lý Nhân sự
          </Link>
          <Link href="/minutes" className={navItemClass(isActive("/minutes"))}>
            <FileTextIcon className="w-4 h-4" /> Biên bản họp
          </Link>
          <Link href="/training" className={navItemClass(isActive("/training"))}>
            <Database className="w-4 h-4" /> Dữ liệu huấn luyện
          </Link>
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors group"
          >
            <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            <span className="group-hover:text-red-100">Đăng xuất</span>
          </button>
          <div className="text-xs text-slate-500 text-center">© 2024 MeetNote AI</div>
        </div>
      </div>

      <main className="flex-1 overflow-hidden relative">
        <PollingManager onUpdate={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('dashboard-refresh'));
          }
        }} />
        {children}
      </main>
    </div>
  );
}
