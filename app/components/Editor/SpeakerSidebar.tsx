"use client";
import { Plus, Trash2, FileText } from "lucide-react";
import type { Speaker } from "@/app/lib/db";

interface SpeakerSidebarProps {
  speakers: Speaker[];
  onAddSpeaker: () => void;
  onUpdateSpeakerName: (id: string, name: string) => void;
  onDeleteSpeaker: (id: string) => void;
  onViewTranscript: () => void;
}

export default function SpeakerSidebar({
  speakers, onAddSpeaker, onUpdateSpeakerName, onDeleteSpeaker, onViewTranscript
}: SpeakerSidebarProps) {
  return (
    <div className="hidden md:flex w-72 border-r bg-slate-50 flex-col shrink-0">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-bold text-slate-700">Người tham gia</h3>
        <button onClick={onAddSpeaker} className="p-1 bg-white border hover:bg-indigo-50 rounded"><Plus className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {speakers.map(spk => (
          <div key={spk.id} className="bg-white p-3 rounded-lg border shadow-sm group">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${spk.color.split(' ')[0]}`}>{spk.name.charAt(0)}</div>
              <span className="text-xs font-mono text-slate-400 flex-1">{spk.id.split('_')[1]}</span>
              <button onClick={() => onDeleteSpeaker(spk.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition"><Trash2 className="w-3 h-3" /></button>
            </div>
            <input
              value={spk.name}
              onChange={(e) => onUpdateSpeakerName(spk.id, e.target.value)}
              className="w-full text-sm font-medium border-b border-transparent focus:border-indigo-500 outline-none bg-transparent"
              placeholder="Tên..."
            />
          </div>
        ))}
      </div>
      <div className="p-4 border-t">
        <button onClick={onViewTranscript} className="w-full py-2 bg-white border text-slate-600 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-slate-50">
          <FileText className="w-4 h-4" /> Xem toàn văn
        </button>
      </div>
    </div>
  );
}
