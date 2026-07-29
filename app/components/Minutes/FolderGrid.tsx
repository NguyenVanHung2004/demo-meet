"use client";
import { Folder as FolderIcon } from "lucide-react";
import type { Folder } from "@/app/lib/db";

interface FolderGridProps {
  folders: Folder[];
  currentFolder: Folder | null;
  dragOverFolderId: string | null;
  onSelectFolder: (folder: Folder) => void;
  onDragOver: (e: React.DragEvent, folderId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderId: string) => void;
}

export default function FolderGrid({
  folders, currentFolder, dragOverFolderId,
  onSelectFolder, onDragOver, onDragLeave, onDrop
}: FolderGridProps) {
  if (currentFolder) return null;
  if (folders.length === 0) return null;

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <FolderIcon className="w-5 h-5 text-indigo-500" />
        Thư mục của bạn
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {folders.map(folder => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder)}
            onDragOver={(e) => onDragOver(e, folder.id)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, folder.id)}
            className={`bg-white p-4 rounded-xl shadow-sm border ${dragOverFolderId === folder.id ? "border-emerald-500 bg-emerald-50 scale-105" : "border-slate-200 hover:border-indigo-400"} hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group z-10`}
          >
            <FolderIcon className={`w-10 h-10 mb-2 transition-colors ${dragOverFolderId === folder.id ? "text-emerald-500 fill-emerald-100" : "text-indigo-400 group-hover:text-indigo-500 fill-indigo-50"}`} />
            <span className="font-medium text-slate-700 text-sm line-clamp-1 w-full" title={folder.name}>
              {folder.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
