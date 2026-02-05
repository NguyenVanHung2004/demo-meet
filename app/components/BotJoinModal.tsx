
"use client";

import { useState } from 'react';
import { Bot, Link as LinkIcon, X, Loader2, CheckCircle, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGlobalUI } from '../context/GlobalUIProvider';

export default function BotJoinModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user } = useAuth();
    const { toast } = useGlobalUI();
    const [meetingUrl, setMeetingUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [botId, setBotId] = useState<string | null>(null);

    const handleJoin = async () => {
        if (!meetingUrl) return toast.error("Vui lòng nhập link cuộc họp!");
        if (!user) return toast.error("Vui lòng đăng nhập!");

        // Kiểm tra URL sơ bộ
        if (!meetingUrl.includes("meet.google.com") && !meetingUrl.includes("zoom.us") && !meetingUrl.includes("teams.microsoft")) {
            // Cảnh báo nhẹ nhưng vẫn cho đi
            toast.info("Link có vẻ lạ, nhưng Bot sẽ thử vào...");
        }

        setLoading(true);
        try {
            const res = await fetch("/api/bots/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    meetingUrl,
                    userId: user.uid,
                    botName: "Thư Ký AI (Demo)"
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setBotId(data.botId);
                toast.success("Bot đã nhận lệnh! Hãy chờ 1-2 phút để Bot vào phòng.");
            } else {
                toast.error(`Lỗi: ${data.error || "Không thể mời bot"}`);
            }
        } catch (e) {
            console.error(e);
            toast.error("Lỗi kết nối server.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/20 transition">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                            <Bot className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-xl font-bold">Mời Bot Tham Gia</h2>
                    </div>
                    <p className="text-blue-100 text-sm">Bot sẽ tự động vào phòng họp, ghi âm và gỡ băng cho bạn.</p>
                </div>

                <div className="p-6 space-y-6">
                    {botId ? (
                        <div className="text-center space-y-4 py-4">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Đã gửi yêu cầu thành công!</h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    Bot ID: <span className="font-mono text-slate-700 bg-slate-100 px-1 rounded">{botId.split('-')[0]}...</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl text-sm text-left border border-slate-100">
                                <p className="font-bold text-slate-700 mb-2">👉 Bước tiếp theo:</p>
                                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                                    <li>Chờ 1-2 phút, Bot sẽ xuất hiện trong phòng họp.</li>
                                    <li>Chủ phòng (Host) cần <strong>Duyệt (Admit)</strong> cho Bot vào.</li>
                                    <li>Khi kết thúc họp, kết quả sẽ tự động hiện ở trang chủ.</li>
                                </ul>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                            >
                                Đóng cửa sổ
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Link cuộc họp (Google Meet / Zoom)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-3.5 text-slate-400">
                                            <LinkIcon className="w-5 h-5" />
                                        </div>
                                        <input
                                            value={meetingUrl}
                                            onChange={(e) => setMeetingUrl(e.target.value)}
                                            placeholder="https://meet.google.com/abc-xyz-..."
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium"
                                        />
                                    </div>
                                </div>

                                {/* LOCALHOST WARNING */}
                                {window.location.hostname === 'localhost' && (
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3">
                                        <div className="text-amber-500 shrink-0 mt-0.5">⚠️</div>
                                        <p className="text-xs text-amber-700 leading-relaxed">
                                            <strong>Đang chạy Localhost:</strong> Bot sẽ không thể trả kết quả về đây trừ khi bạn dùng <u>ngrok</u> để public cổng 3000.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleJoin}
                                disabled={loading}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Đang kết nối...</>
                                ) : (
                                    <><Video className="w-5 h-5" /> Mời Bot vào ngay</>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
