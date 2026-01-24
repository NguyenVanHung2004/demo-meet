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
} from "lucide-react";
import { getAllMeetings, Meeting, saveMeeting } from "../lib/db";
import { useAuth } from "../context/AuthContext";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MinutesState() {
    const { user } = useAuth();
    const { toast } = useGlobalUI();
    const router = useRouter();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadMeetings = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const allMeetings = await getAllMeetings(user.uid);
            // Filter only meetings with summaries and not deleted
            const withSummaries = allMeetings.filter(m => m.summary && m.summary.trim().length > 0 && !m.isDeleted);
            setMeetings(withSummaries);
        } catch (error) {
            console.error("Error loading meetings:", error);
            toast.error("Không thể tải danh sách biên bản");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMeetings();
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
            loadMeetings();
        } catch (error) {
            console.error("Error importing file:", error);
            toast.error("Lỗi khi import file: " + (error as Error).message);
        }
    };

    const filteredMeetings = meetings.filter((m) => {
        const query = searchQuery.toLowerCase();
        return (
            m.title.toLowerCase().includes(query) ||
            m.summary?.toLowerCase().includes(query)
        );
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
        // Strip HTML tags and Markdown syntax
        let plainText = summary
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/#{1,6}\s/g, '')  // Remove # headings
            .replace(/\*\*(.+?)\*\*/g, '$1')  // Remove **bold**
            .replace(/\*(.+?)\*/g, '$1')  // Remove *italic*
            .replace(/^[-*+]\s/gm, '')  // Remove list markers
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();
        if (plainText.length <= maxLength) return plainText;
        return plainText.substring(0, maxLength) + "...";
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/"
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                    <FileText className="w-7 h-7 text-indigo-600" />
                                    Biên bản cuộc họp
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    Quản lý và chỉnh sửa biên bản các cuộc họp
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadMeetings}
                                disabled={loading}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Làm mới dữ liệu"
                            >
                                <RefreshCw className={`w-5 h-5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-md transition-all active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Import biên bản
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
                    <div className="mt-4 relative">
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
                                        <th className="px-6 py-4">Tên cuộc họp</th>
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
                                            onClick={() => router.push(`/minutes/${meeting.id}`)}
                                            className="group hover:bg-indigo-50/50 cursor-pointer transition-colors"
                                        >
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
                                                <p className="line-clamp-2">
                                                    {getSummaryPreview(meeting.summary || "")}
                                                </p>
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
                                    onClick={() => router.push(`/minutes/${meeting.id}`)}
                                    className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    <div className="flex items-start gap-3">
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
                                            <p className="text-sm text-slate-600 line-clamp-2">
                                                {getSummaryPreview(meeting.summary || "")}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
