"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, FileText, ClipboardList, Users, Database, LogOut,
  ChevronsLeft, ChevronsRight, NotebookPen, Trash2
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import { useGlobalUI } from "@/app/context/GlobalUIProvider";
import { cn } from "@/app/lib/cn";
import SidebarNavItem from "./SidebarNavItem";
import Avatar from "./ui/Avatar";
import Tooltip from "./ui/Tooltip";

const STORAGE_KEY = "sidebar-collapsed";

const NAV_ITEMS = [
  {
    group: "Quản lý",
    items: [
      { href: "/", icon: <Home className="w-4 h-4" />, label: "Dashboard" },
      { href: "/minutes", icon: <FileText className="w-4 h-4" />, label: "Biên bản họp" },
      { href: "/tasks", icon: <ClipboardList className="w-4 h-4" />, label: "Quản lý Task" },
    ],
  },
  {
    group: "Hệ thống",
    items: [
      { href: "/team", icon: <Users className="w-4 h-4" />, label: "Nhân sự" },
      { href: "/training", icon: <Database className="w-4 h-4" />, label: "Dữ liệu huấn luyện" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  // Handle tab query param for trash
  if (href.startsWith("/?tab=")) {
    const tab = href.split("=")[1];
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return pathname === "/" && params.get("tab") === tab;
  }
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

interface SidebarProps {
  onNavigate?: () => void;
  forceOpen?: boolean;
}

export default function Sidebar({ onNavigate, forceOpen = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toast } = useGlobalUI();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      toast.error("Lỗi khi đăng xuất");
    }
  };

  const allNavItems = [
    ...NAV_ITEMS,
    {
      group: "Khác",
      items: [
        { href: "/?tab=trash", icon: <Trash2 className="w-4 h-4" />, label: "Thùng rác" },
      ],
    },
  ];

  return (
    <aside className={cn(
      "bg-white border-r border-slate-200 flex flex-col shrink-0",
      "transition-all duration-200",
      forceOpen || !collapsed ? "w-64" : "w-16",
      "hidden md:flex"
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-4 border-b border-slate-200 shrink-0">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
          <NotebookPen className="w-5 h-5 text-white" />
        </div>
        {(forceOpen || !collapsed) && (
          <span className="font-bold text-slate-800 tracking-tight truncate">Smart Meeting</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {allNavItems.map((group) => (
          <div key={group.group}>
            {(forceOpen || !collapsed) && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const handleClick = onNavigate
                  ? () => { onNavigate(); }
                  : undefined;
                const link = (
                  <SidebarNavItem
                    {...item}
                    isActive={active}
                    onClick={handleClick}
                  />
                );
                if (collapsed && !forceOpen) {
                  return (
                    <Tooltip key={item.href} content={item.label} side="right">
                      {link}
                    </Tooltip>
                  );
                }
                return <div key={item.href}>{link}</div>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-3 space-y-2">
        {user && (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            collapsed && !forceOpen ? "justify-center" : ""
          )}>
            <Avatar
              name={user.displayName || user.email || "U"}
              size="sm"
              colorScheme={{ bg: "bg-primary-100", text: "text-primary-700" }}
            />
            {(forceOpen || !collapsed) && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {user.displayName || "User"}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            )}
          </div>
        )}

        {collapsed && !forceOpen ? (
          <Tooltip content="Đăng xuất" side="right">
            <button onClick={handleLogout} className="w-full p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </button>
          </Tooltip>
        ) : (
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        )}

        {!forceOpen && (
          <button onClick={toggleCollapsed} className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors" aria-label={collapsed ? "Mở rộng" : "Thu gọn"}>
            {collapsed ? <ChevronsRight className="w-3.5 h-3.5" /> : <ChevronsLeft className="w-3.5 h-3.5" />}
            {!collapsed && <span>Thu gọn</span>}
          </button>
        )}

        {(forceOpen || !collapsed) && (
          <p className="text-[10px] text-slate-400 text-center pt-2">© 2025 Smart Meeting</p>
        )}
      </div>
    </aside>
  );
}
