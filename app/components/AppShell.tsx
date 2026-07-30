"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Spinner from "./ui/Spinner";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileDrawer from "./MobileDrawer";
import { useAuth } from "@/app/context/AuthContext";
import PollingManager from "./PollingManager";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Spinner size="xl" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <MobileDrawer isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} title="Menu">
        <Sidebar forceOpen onNavigate={() => setMobileMenuOpen(false)} />
      </MobileDrawer>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <PollingManager onUpdate={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("dashboard-refresh"));
          }
        }} />

        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
