// app/components/LoginState.tsx
"use client";

import React from "react";
import { BrainCircuit, NotebookPen, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function LoginState() {
  const { login } = useAuth();

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-50 font-sans selection:bg-indigo-100">

      {/* 1. BACKGROUND DECORATION (Hiệu ứng nền) */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-200 via-slate-50 to-white opacity-70"></div>

      {/* Các khối màu bay bay (Blobs) */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-1/2 -right-24 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

      {/* 2. MAIN CARD */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-white/70 backdrop-blur-2xl border border-white/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">

          {/* Header Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="p-8 md:p-10 text-center">

            {/* Logo App */}
            <div className="mx-auto w-20 h-20 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-8 transform hover:scale-105 transition-transform duration-300">
              <NotebookPen className="w-10 h-10 text-white" />
            </div>

            {/* Title & Slogan */}
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">
              Smart Meeting Assistant
            </h1>
            <p className="text-slate-500 mb-8 text-sm md:text-base leading-relaxed">
              Biến cuộc họp thành văn bản & tóm tắt thông minh chỉ trong vài giây.
            </p>

            {/* Feature Badges (Trang trí thêm cho uy tín) */}
            <div className="flex justify-center gap-4 mb-10">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                <BrainCircuit className="w-3 h-3" /> AI Powered
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3" /> Fast
              </div>
            </div>

            {/* Google Login Button */}
            <button
              onClick={() => login()}
              className="w-full group relative flex items-center justify-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-300 hover:bg-slate-50 transition-all duration-200 active:scale-[0.98]"
            >
              {/* Google Logo SVG chuẩn */}
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="font-semibold text-slate-700 text-lg group-hover:text-indigo-600 transition-colors">
                Tiếp tục với Google
              </span>
            </button>

            <p className="mt-8 text-[10px] text-slate-400">
              Bằng việc tiếp tục, bạn đồng ý với Chính sách bảo mật & Điều khoản dịch vụ.
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-6 text-center text-slate-400 text-xs font-medium">
          © 2025 Smart Meeting Assistant. Product by You.
        </div>
      </div>
    </div>
  );
}