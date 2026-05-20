"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    FileText,
    Search,
    ArrowLeft,
    Calendar,
    Clock,
    ChevronRight,
    Loader2,
    Plus,
    RefreshCw,
    Square,
    CheckSquare,
    MessageSquare,
    X,
    Send,
    Trash2,
    Sparkles,
    Folder as FolderIcon,
    FolderPlus,
    FolderOpen,
    MoreVertical,
    Check
} from "lucide-react";
import { getAllMeetings, Meeting, saveMeeting, Folder, getFolders, saveFolder, updateMeetingFolder } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useRouter } from "next/navigation";
import AIChatModal from "./AIChatModal";
import Link from "next/link";
import ReactMarkdown from "react-markdown"; // Optional for rendering MD answer

export default function MinutesState() {
    const { user } = useAuth();
    const { toast } = useGlobalUI();
    const router = useRouter();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 🟢 SELECTION & QA STATE
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAIChat, setShowAIChat] = useState(false);

    // 🟢 FOLDER STATE
    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [showMoveDropdown, setShowMoveDropdown] = useState(false);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

    const toggleSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [allMeetings, allFolders] = await Promise.all([
                getAllMeetings(user.uid),
                getFolders(user.uid)
            ]);
            // Filter only meetings with summaries and not deleted
            const withSummaries = allMeetings.filter(m => m.summary && m.summary.trim().length > 0 && !m.isDeleted);
            setMeetings(withSummaries);
            setFolders(allFolders);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Không thể tải dữ liệu");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [user]);


    const handleImportFile = async (file: File) => {
        if (!user) return;

        const allowedTypes = [
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(file.type)) {
            toast.error("Chỉ hỗ trợ file .txt, .doc, .docx");
            return;
        }

        try {
            toast.info("Đang xử lý file...");

            let content = "";

            if (file.type === "text/plain") {
                content = await file.text();
            } else {
                // For .doc/.docx files, use mammoth
                const mammoth = (await import("mammoth")).default;
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                content = result.value;

                if (result.messages.length > 0) {
                    console.warn("Mammoth warnings:", result.messages);
                }
            }

            if (!content.trim()) {
                toast.error("File không có nội dung");
                return;
            }

            // Extract title from first line or use filename
            const lines = content.split("\n").filter(l => l.trim());
            const title = lines[0]?.trim() || file.name.replace(/\.[^/.]+$/, "");
            const summary = content;

            const newMeeting: Meeting = {
                id: crypto.randomUUID(),
                userId: user.uid,
                title: title.substring(0, 100), // Limit title length
                createdAt: Date.now(),
                duration: 0,
                segments: [],
                speakers: [],
                summary: summary,
                status: "completed",
                isDeleted: false,
                isMinuteOnly: true, // Flag this as imported minute, not a real meeting
            };

            await saveMeeting(newMeeting);
            toast.success("Đã import biên bản thành công!");
            loadData();
        } catch (error) {
            console.error("Error importing file:", error);
            toast.error("Lỗi khi import file: " + (error as Error).message);
        }
    };

    const handleCreateFolder = async () => {
        if (!user || !newFolderName.trim()) return;
        try {
            const newFolder: Folder = {
                id: crypto.randomUUID(),
                userId: user.uid,
                name: newFolderName.trim(),
                createdAt: Date.now()
            };
            await saveFolder(user.uid, newFolder);
            toast.success("Tạo thư mục thành công");
            setNewFolderName("");
            setShowNewFolderModal(false);
            loadData();
        } catch (e) {
            toast.error("Lỗi khi tạo thư mục");
        }
    };

    const handleMoveToFolder = async (folderId: string | null) => {
        if (selectedIds.size === 0) return;
        try {
            toast.info("Đang chuyển...");
            const promises = Array.from(selectedIds).map(id => updateMeetingFolder(id, folderId));
            await Promise.all(promises);
            toast.success("Đã chuyển biên bản");
            setSelectedIds(new Set());
            setShowMoveDropdown(false);
            loadData();
        } catch (e) {
            toast.error("Lỗi khi chuyển thư mục");
        }
    };

    const handleDragDropMove = async (meetingId: string, folderId: string) => {
        try {
            toast.info("Đang chuyển...");
            await updateMeetingFolder(meetingId, folderId);
            toast.success("Đã chuyển biên bản");
            if (selectedIds.has(meetingId)) {
                const newSet = new Set(selectedIds);
                newSet.delete(meetingId);
                setSelectedIds(newSet);
            }
            loadData();
        } catch (e) {
            toast.error("Lỗi khi chuyển thư mục");
        }
    };

    const cleanText = (text: string) => {
        if (!text) return "";
        return text
            // HTML Entities
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            // Thêm dấu cách trước khi xóa block tags để tránh chữ bị dính vào nhau (VD: </p><p> -> khoảng cách)
            .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, ' </$1>')
            .replace(/<br\s*\/?>/gi, ' ')
            // Xóa HTML tags
            .replace(/<[^>]*>/g, '')
            // Xóa Markdown
            .replace(/#{1,6}\s/g, '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/^[-*+]\s/gm, '')
            // Xóa khoảng trắng thừa
            .replace(/\s+/g, ' ')
            .trim();
    };

    const filteredMeetings = meetings.filter((m) => {
        const query = searchQuery.trim().toLowerCase().normalize('NFC');
        const titleMatch = m.title.toLowerCase().normalize('NFC').includes(query);
        const summaryMatch = cleanText(m.summary || "").toLowerCase().normalize('NFC').includes(query);
        const matchesSearch = titleMatch || summaryMatch;
        const matchesFolder = currentFolder 
            ? m.folderId === currentFolder.id 
            : (!m.folderId || m.folderId === "");
        return matchesSearch && matchesFolder;
    });

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const getSummaryPreview = (summary: string) => {
        const maxLength = 150;
        let plainText = cleanText(summary);
        if (plainText.length <= maxLength) return plainText;
        return plainText.substring(0, maxLength) + "...";
    };

    // 🟢 HÀM MỚI: TẠO SNIPPET HIGHLIGHT KHI SEARCH
    const getHighlightedSnippet = (content: string, query: string): string => {
        if (!query.trim()) return getSummaryPreview(content);

        // 1. Clean content (giống preview)
        const plainText = cleanText(content);

        // 2. Tìm vị trí match case-insensitive
        const lowerText = plainText.toLowerCase().normalize('NFC');
        const lowerQuery = query.toLowerCase().trim().normalize('NFC');
        const index = lowerText.indexOf(lowerQuery);

        // Nếu không tìm thấy (có thể match ở title), trả về preview thường
        if (index === -1) return getSummaryPreview(content);

        // 3. Trích xuất window text (60 ký tự trước, 100 sau)
        const start = Math.max(0, index - 60);
        const end = Math.min(plainText.length, index + lowerQuery.length + 100);

        let snippet = plainText.substring(start, end);

        // Highlight từ khóa
        // Dùng replace với regex case-insensitive, giữ nguyên case gốc của text
        const regex = new RegExp(`(${lowerQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        snippet = snippet.replace(regex, '<mark class="bg-yellow-200 text-slate-900 rounded-sm px-0.5">$1</mark>');

        // Thêm ellipsis nếu cắt bớt
        if (start > 0) snippet = "..." + snippet;
        if (end < plainText.length) snippet = snippet + "...";

        return snippet;
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                        <div className="flex items-center gap-2 md:gap-4 min-w-0">
                            <Link
                                href="/"
                                className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div className="min-w-0">
                                <h1 id="tour-minutes-title" className="text-lg md:text-2xl font-bold text-slate-800 flex items-center gap-1.5 md:gap-2 truncate">
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
                                onClick={loadData}
                                disabled={loading}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Làm mới dữ liệu"
                            >
                                <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                id="tour-minutes-folder"
                                onClick={() => setShowNewFolderModal(true)}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 md:gap-2 shadow-sm transition-all active:scale-95 shrink-0"
                            >
                                <FolderPlus className="w-4 h-4" />
                                <span className="text-sm md:text-base hidden sm:inline">Tạo thư mục</span>
                            </button>
                            <button
                                id="tour-minutes-import"
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
                                onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
                            />
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div id="tour-minutes-search" className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên cuộc họp hoặc nội dung..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                
                {/* 📂 Folders Section (Only show at root) */}
                {!loading && !currentFolder && folders.length > 0 && (
                    <div className="mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 id="tour-minutes-folders" className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FolderIcon className="w-5 h-5 text-indigo-500" />
                            Thư mục của bạn
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {folders.map(folder => (
                                <div 
                                    key={folder.id} 
                                    onClick={() => setCurrentFolder(folder)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverFolderId(folder.id);
                                    }}
                                    onDragLeave={() => setDragOverFolderId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragOverFolderId(null);
                                        const meetingId = e.dataTransfer.getData("meetingId");
                                        if (meetingId) {
                                            handleDragDropMove(meetingId, folder.id);
                                        }
                                    }}
                                    className={`bg-white p-4 rounded-xl shadow-sm border ${dragOverFolderId === folder.id ? 'border-emerald-500 bg-emerald-50 scale-105' : 'border-slate-200 hover:border-indigo-400'} hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center group z-10`}
                                >
                                    <FolderIcon className={`w-10 h-10 mb-2 transition-colors ${dragOverFolderId === folder.id ? 'text-emerald-500 fill-emerald-100' : 'text-indigo-400 group-hover:text-indigo-500 fill-indigo-50'}`} />
                                    <span className="font-medium text-slate-700 text-sm line-clamp-1 w-full" title={folder.name}>
                                        {folder.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 📂 Current Folder Header */}
                {!loading && currentFolder && (
                    <div className="mb-6 flex items-center justify-between animate-in fade-in slide-in-from-left-4 duration-500">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setCurrentFolder(null)}
                                className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors bg-slate-100"
                                title="Quay lại"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FolderOpen className="w-6 h-6 text-indigo-500 fill-indigo-50" />
                                {currentFolder.name}
                            </h2>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="space-y-4">
                        {/* Desktop: Table Skeleton */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Tên cuộc họp</th>
                                        <th className="px-6 py-4">Ngày tạo</th>
                                        <th className="px-6 py-4">Thời lượng</th>
                                        <th className="px-6 py-4">Nội dung</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="px-6 py-4">
                                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 bg-slate-200 rounded w-24"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-4 bg-slate-200 rounded w-16"></div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-2">
                                                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                                                    <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="h-8 w-8 bg-slate-200 rounded"></div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: Card Skeleton */}
                        <div className="md:hidden space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 space-y-3">
                                            <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                                            <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                                            <div className="space-y-2 mt-4">
                                                <div className="h-3 bg-slate-100 rounded w-full"></div>
                                                <div className="h-3 bg-slate-100 rounded w-4/5"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : filteredMeetings.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <FileText className="w-8 h-8" />
                        </div>
                        <p className="text-slate-500 font-medium">
                            {searchQuery
                                ? "Không tìm thấy biên bản phù hợp"
                                : "Chưa có biên bản nào. Hãy import hoặc tạo cuộc họp mới!"}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Desktop: Table View */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th id="tour-minutes-select" className="px-6 py-4">Tên cuộc họp</th>
                                        <th className="px-6 py-4">Ngày tạo</th>
                                        <th className="px-6 py-4">Thời lượng</th>
                                        <th className="px-6 py-4">Nội dung</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredMeetings.map((meeting) => (
                                        <tr
                                            key={meeting.id}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData("meetingId", meeting.id);
                                                e.dataTransfer.effectAllowed = "move";
                                            }}
                                            onClick={() => {
                                                const url = `/minutes/${meeting.id}${searchQuery ? `?highlight=${encodeURIComponent(searchQuery)}` : ''}`;
                                                router.push(url);
                                            }}
                                            className="group hover:bg-indigo-50/50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={(e) => toggleSelection(meeting.id, e)} 
                                                    className="tour-checkbox-btn text-slate-400 hover:text-indigo-600 transition-colors"
                                                >
                                                    {selectedIds.has(meeting.id) ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <Square className="w-5 h-5" />}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-xs">
                                                        {meeting.title.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-slate-700 group-hover:text-indigo-700 transition-colors line-clamp-1 max-w-[250px]">
                                                        {meeting.title}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {formatDate(meeting.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 font-mono text-sm">
                                                {meeting.duration > 0 ? formatDuration(meeting.duration) : "-"}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm max-w-md">
                                                <div className="text-slate-600 line-clamp-2"
                                                    dangerouslySetInnerHTML={{
                                                        __html: searchQuery
                                                            ? getHighlightedSnippet(meeting.summary || "", searchQuery)
                                                            : getSummaryPreview(meeting.summary || "")
                                                    }}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile: Card View */}
                        <div className="md:hidden space-y-3">
                            {filteredMeetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("meetingId", meeting.id);
                                        e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onClick={() => {
                                        const url = `/minutes/${meeting.id}${searchQuery ? `?highlight=${encodeURIComponent(searchQuery)}` : ''}`;
                                        router.push(url);
                                    }}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
                                        <button onClick={(e) => toggleSelection(meeting.id, e)} className="mt-1 shrink-0">
                                            {selectedIds.has(meeting.id) ? <CheckSquare className="w-6 h-6 text-indigo-600" /> : <Square className="w-6 h-6 text-slate-300" />}
                                        </button>
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 font-bold text-sm">
                                            {meeting.title.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-slate-800 mb-1 line-clamp-1">
                                                {meeting.title}
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(meeting.createdAt).toLocaleDateString("vi-VN")}
                                                </span>
                                                {meeting.duration > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDuration(meeting.duration)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-slate-600 line-clamp-2"
                                                dangerouslySetInnerHTML={{
                                                    __html: searchQuery
                                                        ? getHighlightedSnippet(meeting.summary || "", searchQuery)
                                                        : getSummaryPreview(meeting.summary || "")
                                                }}
                                            />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* 🟢 FLOATING ACTION PANEL */}
            {selectedIds.size > 0 && (
                <div id="tour-minutes-ai-panel" className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-full shadow-xl flex items-center gap-3 md:gap-6 z-50 animate-in slide-in-from-bottom-4 transition-all hover:scale-105 cursor-default w-[90%] md:w-auto max-w-sm md:max-w-none justify-between md:justify-start">
                    <span className="font-semibold text-xs md:text-sm whitespace-nowrap"><span className="hidden sm:inline">Đã chọn </span>{selectedIds.size}</span>
                    <div className="h-4 md:h-6 w-px bg-slate-700"></div>
                    <button
                        onClick={() => setShowAIChat(true)}
                        className="flex items-center gap-1.5 md:gap-2 text-indigo-300 hover:text-white transition-colors font-bold text-xs md:text-sm whitespace-nowrap"
                    >
                        <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Hỏi AI
                    </button>
                    
                    <div className="relative">
                        <button
                            onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                            className="flex items-center gap-1.5 md:gap-2 text-emerald-300 hover:text-white transition-colors font-bold text-xs md:text-sm whitespace-nowrap"
                        >
                            <FolderOpen className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            <span className="hidden sm:inline">Chuyển vào...</span>
                            <span className="sm:hidden">Di chuyển</span>
                        </button>
                        {showMoveDropdown && folders.length > 0 && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in slide-in-from-bottom-2 text-slate-800">
                                <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Chọn thư mục</div>
                                {folders.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => handleMoveToFolder(f.id)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                                    >
                                        <FolderIcon className="w-4 h-4 text-slate-400" />
                                        <span className="truncate">{f.name}</span>
                                    </button>
                                ))}
                                <div className="h-px bg-slate-100 my-1"></div>
                                <button
                                    onClick={() => handleMoveToFolder(null)}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Đưa ra ngoài (Gỡ khỏi thư mục)
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-4 md:h-6 w-px bg-slate-700"></div>

                    {/* Clear selection */}
                    <button
                        onClick={() => {
                            setSelectedIds(new Set());
                            setShowMoveDropdown(false);
                        }}
                        className="text-slate-500 hover:text-white transition-colors ml-1 md:ml-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* 🟢 AI CHAT MODAL */}
            <AIChatModal
                isOpen={showAIChat}
                onClose={() => setShowAIChat(false)}
                contextText={meetings.filter(m => selectedIds.has(m.id)).map(m => `
--- DOCUMENT ID: ${m.id} | TITLE: ${m.title} (${new Date(m.createdAt).toLocaleDateString()}) ---
${m.summary}
---------------------------------------------
`).join("\n\n")}
                contextCount={selectedIds.size}
                onClearContext={() => {
                    setShowAIChat(false);
                    setSelectedIds(new Set());
                }}
            />
            {/* 🟢 NEW FOLDER MODAL */}
            {showNewFolderModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">Tạo thư mục mới</h3>
                            <button onClick={() => setShowNewFolderModal(false)} className="text-slate-400 hover:bg-slate-100 p-2 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tên thư mục</label>
                                <input
                                    type="text"
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="Nhập tên thư mục..."
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-800"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateFolder();
                                    }}
                                />
                            </div>
                        </div>
                        <div className="p-6 pt-0 flex justify-end gap-3">
                            <button onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Hủy</button>
                            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-2 rounded-lg font-medium shadow-md transition-all">Tạo</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
