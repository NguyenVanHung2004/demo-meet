"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Calendar,
    Clock,
    Edit2,
    Save,
    X,
    Loader2,
    Trash2,
} from "lucide-react";
import { getMeetingById, updateMeetingProcess } from "@/app/lib/db";
import { useAuth } from "@/app/context/AuthContext";
import { useGlobalUI } from "@/app/context/GlobalUIProvider";
import Link from "next/link";
import RichTextEditor from "@/app/components/RichTextEditor";

// Simple Markdown parser for common patterns
function parseMarkdown(text: string): string {
    if (!text) return "";

    let html = text;

    // Headers (### -> h3, ## -> h2, # -> h1)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold (**text** or __text__)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Unordered lists (- item or * item)
    html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}


export default function MinuteDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { toast, confirm } = useGlobalUI();
    const [meeting, setMeeting] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");
    const [saving, setSaving] = useState(false);

    const meetingId = params.id as string;

    useEffect(() => {
        const loadMeeting = async () => {
            if (!meetingId) return;
            setLoading(true);
            try {
                const data = await getMeetingById(meetingId);
                if (data) {
                    setMeeting(data);
                    // Convert Markdown to HTML for editing if it's not already HTML
                    const contentForEdit = data.summary?.startsWith('<')
                        ? data.summary
                        : parseMarkdown(data.summary || "");
                    setEditContent(contentForEdit);
                } else {
                    toast.error("Không tìm thấy biên bản");
                    router.push("/minutes");
                }
            } catch (error) {
                console.error("Error loading meeting:", error);
                toast.error("Lỗi khi tải biên bản");
            } finally {
                setLoading(false);
            }
        };

        loadMeeting();
    }, [meetingId]);

    const handleSave = async () => {
        if (!editContent.trim()) {
            toast.error("Nội dung biên bản không được để trống");
            return;
        }

        setSaving(true);
        try {
            await updateMeetingProcess(meetingId, { summary: editContent });
            setMeeting({ ...meeting, summary: editContent });
            setIsEditing(false);
            toast.success("Đã lưu biên bản");
        } catch (error) {
            console.error("Error saving summary:", error);
            toast.error("Lỗi khi lưu biên bản");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditContent(meeting?.summary || "");
        setIsEditing(false);
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: "Xóa biên bản",
            message: meeting.isMinuteOnly
                ? "Bạn có chắc muốn xóa biên bản này? Hành động này không thể hoàn tác."
                : "Bạn có chắc muốn xóa tóm tắt biên bản này?",
            confirmText: "Xóa",
            cancelText: "Hủy",
            type: "danger"
        });

        if (!confirmed) return;

        try {
            // If this is a minute-only import (no audio/transcript), delete the entire meeting
            // Otherwise, just clear the summary
            if (meeting.isMinuteOnly) {
                await updateMeetingProcess(meetingId, { isDeleted: true });
                toast.success("Đã xóa biên bản");
            } else {
                await updateMeetingProcess(meetingId, { summary: "" });
                toast.success("Đã xóa tóm tắt biên bản");
            }
            router.push("/minutes");
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Lỗi khi xóa biên bản");
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("vi-VN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (!meeting) {
        return null;
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <Link
                                href="/minutes"
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-600" />
                            </Link>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">
                                    {meeting.title}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        {formatDate(meeting.createdAt)}
                                    </span>
                                    {meeting.duration > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {formatDuration(meeting.duration)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={handleCancel}
                                        disabled={saving}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2 font-medium"
                                    >
                                        <X className="w-4 h-4" />
                                        <span className="hidden sm:inline">Hủy</span>
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 font-medium shadow-md"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        <span className="hidden sm:inline">Lưu</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleDelete}
                                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center gap-2 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Xóa</span>
                                    </button>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 shadow-md transition-all active:scale-95"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Chỉnh sửa</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-800">Nội dung biên bản</h2>
                    </div>

                    <div className="px-6 py-6">
                        {isEditing ? (
                            <div className="space-y-4">
                                <RichTextEditor
                                    content={editContent}
                                    onChange={setEditContent}
                                    placeholder="Nhập nội dung biên bản..."
                                />
                                <div className="pt-2 border-t border-slate-200">
                                    <span className="text-sm text-slate-500">
                                        {editContent.replace(/<[^>]*>/g, '').length} ký tự
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="summary-content">
                                <style jsx>{`
                                    .summary-content {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                                        font-size: 15px;
                                        line-height: 1.8;
                                        color: #334155;
                                    }
                                    .summary-content pre {
                                        white-space: pre-wrap;
                                        word-wrap: break-word;
                                        font-family: inherit;
                                        margin: 0;
                                        padding: 0;
                                        background: none;
                                        border: none;
                                    }
                                    .summary-content :global(h1) {
                                        font-size: 1.5em;
                                        font-weight: 700;
                                        margin-top: 1.5em;
                                        margin-bottom: 0.5em;
                                        color: #1e293b;
                                        border-bottom: 2px solid #e2e8f0;
                                        padding-bottom: 0.3em;
                                    }
                                    .summary-content :global(h2) {
                                        font-size: 1.3em;
                                        font-weight: 700;
                                        margin-top: 1.5em;
                                        margin-bottom: 0.5em;
                                        color: #1e293b;
                                    }
                                    .summary-content :global(h3) {
                                        font-size: 1.1em;
                                        font-weight: 600;
                                        margin-top: 1.2em;
                                        margin-bottom: 0.5em;
                                        color: #334155;
                                    }
                                    /* Add spacing between paragraphs */
                                    .summary-content :global(p) {
                                        margin-bottom: 1em;
                                        line-height: 1.8;
                                    }
                                    /* Style for lists */
                                    .summary-content :global(ul),
                                    .summary-content :global(ol) {
                                        margin: 1em 0;
                                        padding-left: 2em;
                                    }
                                    .summary-content :global(li) {
                                        margin-bottom: 0.5em;
                                        line-height: 1.6;
                                    }
                                    /* Style for bold text */
                                    .summary-content :global(strong) {
                                        font-weight: 600;
                                        color: #1e293b;
                                    }
                                    /* Style for italic text */
                                    .summary-content :global(em) {
                                        font-style: italic;
                                        color: #475569;
                                    }
                                `}</style>
                                <div
                                    className="summary-text"
                                    dangerouslySetInnerHTML={{ __html: meeting.summary.startsWith('<') ? meeting.summary : parseMarkdown(meeting.summary) }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
