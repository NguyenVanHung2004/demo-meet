import React from "react";
import { UploadCloud, Mic, Clock, FileText, Search, Plus } from "lucide-react";

export default function DashboardState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex h-full">
      <div className="w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-8 hidden md:flex">
        <div className="text-2xl font-bold text-white flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">AI</div>
          MeetNote
        </div>
        <nav className="space-y-2">
          <div className="px-4 py-2 bg-slate-800 text-white rounded-md cursor-pointer">Tất cả cuộc họp</div>
          <div className="px-4 py-2 hover:text-white cursor-pointer">Đã lưu trữ</div>
          <div className="px-4 py-2 hover:text-white cursor-pointer">Thùng rác</div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Cuộc họp của tôi</h1>
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input placeholder="Tìm kiếm..." className="pl-10 pr-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button className="bg-slate-200 p-2 rounded-full hover:bg-slate-300"><Plus className="w-5 h-5" /></button>
          </div>
        </header>

        {/* Empty State / Call to Action */}
        <div className="border-2 border-dashed border-slate-300 rounded-2xl h-[400px] flex flex-col items-center justify-center gap-6 bg-slate-50/50 hover:bg-slate-100 transition-colors">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
            <UploadCloud className="w-10 h-10 text-indigo-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-800">Bắt đầu phiên làm việc mới</h3>
            <p className="text-slate-500 mt-1">Tải lên file ghi âm hoặc dán link cuộc họp</p>
          </div>
          
          <button 
            onClick={onImport}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Load Audio Demo & Ghi biên bản
          </button>
          
          <p className="text-xs text-slate-400">Hỗ trợ: .mp3, .wav, .m4a (Max 500MB)</p>
        </div>

        {/* Recent Files (Fake) */}
        <div className="mt-10">
          <h3 className="font-semibold text-slate-700 mb-4">Gần đây</h3>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white border rounded-xl opacity-60">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><Mic className="w-5 h-5 text-slate-400"/></div>
                  <div>
                    <div className="font-medium text-slate-800">Weekly Sync Team Product {i}</div>
                    <div className="text-xs text-slate-400">2 ngày trước • 45 phút</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-green-50 text-green-700 text-xs rounded-full font-medium">Đã xử lý</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}