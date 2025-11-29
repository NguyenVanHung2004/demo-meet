// app/context/GlobalUIProvider.tsx
"use client";

import React, { createContext, useContext, useState, useRef, ReactNode } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// --- 1. TOAST TYPES ---
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// --- 2. CONFIRM TYPES ---
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

interface GlobalUIContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const GlobalUIContext = createContext<GlobalUIContextType | undefined>(undefined);

export const useGlobalUI = () => {
  const context = useContext(GlobalUIContext);
  if (!context) throw new Error("useGlobalUI must be used within GlobalUIProvider");
  return context;
};

export default function GlobalUIProvider({ children }: { children: ReactNode }) {
  // --- STATE TOAST ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // --- STATE CONFIRM ---
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // --- LOGIC TOAST ---
  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 3000); // Tự tắt sau 3s
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    info: (msg: string) => addToast(msg, 'info'),
    warning: (msg: string) => addToast(msg, 'warning'),
  };

  // --- LOGIC CONFIRM (Promise-based) ---
  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setConfirmState({ 
        isOpen: true, 
        options: { title: "Xác nhận", confirmText: "Đồng ý", cancelText: "Hủy", type: 'info', ...opts }, 
        resolve 
      });
    });
  };

  const handleConfirm = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <GlobalUIContext.Provider value={{ toast, confirm }}>
      {children}

      {/* --- RENDER TOASTS --- */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl shadow-lg shadow-slate-200 min-w-[300px] animate-in slide-in-from-right-full duration-300"
          >
            {t.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-blue-500 shrink-0" />}
            
            <p className="text-sm font-medium text-slate-700 flex-1">{t.message}</p>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* --- RENDER CONFIRM MODAL --- */}
      {confirmState && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center 
                ${confirmState.options.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {confirmState.options.type === 'danger' ? <AlertTriangle className="w-6 h-6"/> : <Info className="w-6 h-6"/>}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">{confirmState.options.title}</h3>
                <p className="text-slate-500 text-sm mt-1">{confirmState.options.message}</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={() => handleConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
                >
                  {confirmState.options.cancelText}
                </button>
                <button 
                  onClick={() => handleConfirm(true)}
                  className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl shadow-lg transition 
                    ${confirmState.options.type === 'danger' 
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                >
                  {confirmState.options.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </GlobalUIContext.Provider>
  );
}