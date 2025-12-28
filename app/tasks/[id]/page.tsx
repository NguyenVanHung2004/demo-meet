"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation"; // Lấy ID từ URL
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Send,
  Trash2,
  Plus,
  Calendar,
  User,
  Clock,
  CheckCircle,
} from "lucide-react";
import {
  getMeetingById,
  updateMeetingProcess,
  getMembers,
  Member,
  TaskItem,
} from "@/app/lib/db"; // Import đúng đường dẫn
import { useAuth } from "@/app/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useGlobalUI } from "@/app/context/GlobalUIProvider";
export default function ActionItemPage() {
  const { id } = useParams(); // Lấy ID meeting
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [isSendingMail, setIsSendingMail] = useState(false);
  const { toast, confirm } = useGlobalUI();
  useEffect(() => {
    // Nếu check auth xong (authLoading = false) mà không có user -> Về trang chủ
    if (!authLoading && !user) {
        router.push("/");
    }
  }, [user, authLoading, router]);
  // 1. Load dữ liệu từ DB
  useEffect(() => {
    if (!id || authLoading || !user) return;
    setMembers(getMembers()); // Load danh bạ

    getMeetingById(id as string).then((meeting) => {
      if (meeting) {
        setMeetingTitle(meeting.title);
        // Load task đã lưu nháp lúc nãy
        setTasks(meeting.actionItems || []);
      }
      setLoading(false);
    });
  }, [id]);

  // 2. Hàm Lưu lại (Save Draft)
  const handleSave = async () => {
    await updateMeetingProcess(id as string, { actionItems: tasks });
    alert("Đã lưu nháp thành công!");
  };

  // 3. Hàm Gửi Mail
  const handleSendMail = async () => {
    // Lọc task có email hợp lệ
    const validTasks = tasks.filter((t) => t.email && t.email.includes("@"));

    if (validTasks.length === 0) {
      return toast.error("Không có nhiệm vụ nào được gán email hợp lệ!");
    }

    // Xác nhận trước khi gửi
    const confirmSend = await confirm({
      title: "Gửi Email",
      message: `Bạn chuẩn bị gửi thông báo cho ${
        new Set(validTasks.map((t) => t.email)).size
      } người với tổng cộng ${validTasks.length} nhiệm vụ. Tiếp tục?`,
      confirmText: "Gửi ngay",
      type: "info",
    });

    if (!confirmSend) return;

    setIsSendingMail(true);

    try {
      // Gọi API Backend
      const response = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tasks: validTasks,
                meetingTitle: meetingTitle
            })
        });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Đã gửi thành công cho ${data.count} người!`);

        // Cập nhật trạng thái 'sent' vào DB
        await updateMeetingProcess(id as string, { actionStatus: "sent" });

        router.push("/tasks");
      } else {
        throw new Error("API Error");
      }
    } catch (e) {
      console.error(e);
      toast.error("Gửi mail thất bại. Vui lòng kiểm tra lại cấu hình server.");
    } finally {
      setIsSendingMail(false);
    }
  };
  if (loading)
    return <div className="p-10 text-center">Đang tải dữ liệu...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER HEADER STICKY */}
      <div className="bg-white border-b sticky top-0 z-20 px-4 py-4 md:px-8 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/tasks"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-800 line-clamp-1">
              Phân công: {meetingTitle}
            </h1>
            <p className="text-xs text-slate-500 hidden md:block">
              Hãy rà soát kỹ trước khi gửi email.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 text-slate-600 bg-white border border-slate-300 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">Lưu nháp</span>
          </button>
          <button
            onClick={handleSendMail}
            disabled={isSendingMail} // Disable khi đang gửi
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSendingMail ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Đang gửi...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Gửi Email</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* BODY - RESPONSIVE */}
      <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4 w-[40%]">Nhiệm vụ</th>
                <th className="px-4 py-4 w-[25%]">Người nhận</th>
                <th className="px-4 py-4 w-[20%]">Deadline</th>
                <th className="px-4 py-4 w-[5%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task, idx) => (
                <tr key={idx} className="hover:bg-indigo-50/10 transition">
                  <td className="px-6 py-4 align-top">
                    <textarea
                      value={task.task}
                      rows={2}
                      onChange={(e) => {
                        const newT = [...tasks];
                        newT[idx].task = e.target.value;
                        setTasks(newT);
                      }}
                      className="w-full border-none focus:ring-0 resize-none bg-transparent p-0 text-slate-700 font-medium placeholder-slate-300"
                      placeholder="Nhập nội dung..."
                    />
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-col gap-2">
                      {/* AI Suggestion Badge */}

                      <select
                        value={task.email}
                        onChange={(e) => {
                          const newT = [...tasks];
                          newT[idx].email = e.target.value;
                          setTasks(newT);
                        }}
                        className={`w-full p-2 rounded border text-sm ${
                          !task.email
                            ? "border-red-300 bg-red-50"
                            : "border-slate-200"
                        }`}
                      >
                        <option value="">-- Chọn --</option>
                        {members.map((m) => (
                          <option key={m.email} value={m.email}>
                            {m.name} ({m.email})
                          </option>
                        ))}
                      </select>
                      {task.assigneeName && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded w-fit border border-slate-200">
                          AI gợi ý: {task.assigneeName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <input
                      type="datetime-local"
                      value={task.deadline === "Chưa rõ" ? "" : task.deadline}
                      onChange={(e) => {
                        const newT = [...tasks];
                        newT[idx].deadline = e.target.value;
                        setTasks(newT);
                      }}
                      className="w-full p-2 border border-slate-200 rounded text-sm text-slate-600"
                    />
                  </td>
                  <td className="px-4 py-4 align-middle text-center">
                    <button
                      onClick={() =>
                        setTasks(tasks.filter((_, i) => i !== idx))
                      }
                      className="text-slate-300 hover:text-red-500 p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-4 pb-20">
          {tasks.map((task, idx) => (
            <div
              key={idx}
              className="bg-white p-4 rounded-xl border shadow-sm space-y-3 relative"
            >
              <button
                onClick={() => setTasks(tasks.filter((_, i) => i !== idx))}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase">
                  Nhiệm vụ
                </label>
                <textarea
                  value={task.task}
                  rows={3}
                  onChange={(e) => {
                    const newT = [...tasks];
                    newT[idx].task = e.target.value;
                    setTasks(newT);
                  }}
                  className="w-full mt-1 p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">
                    Người nhận
                  </label>
                  <select
                    value={task.email}
                    onChange={(e) => {
                      const newT = [...tasks];
                      newT[idx].email = e.target.value;
                      setTasks(newT);
                    }}
                    className={`w-full mt-1 p-2 rounded border text-sm ${
                      !task.email
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200"
                    }`}
                  >
                    <option value="">Chọn...</option>
                    {members.map((m) => (
                      <option key={m.email} value={m.email}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {task.assigneeName && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Gợi ý: {task.assigneeName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase">
                    Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={task.deadline === "Chưa rõ" ? "" : task.deadline}
                    onChange={(e) => {
                      const newT = [...tasks];
                      newT[idx].deadline = e.target.value;
                      setTasks(newT);
                    }}
                    className="w-full mt-1 p-2 border border-slate-200 rounded text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ADD BUTTON */}
        <button
          onClick={() =>
            setTasks([
              ...tasks,
              {
                id: Date.now(),
                task: "",
                assigneeName: "",
                email: "",
                deadline: "",
              },
            ])
          }
          className="mt-6 w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Thêm nhiệm vụ thủ công
        </button>
      </div>
    </div>
  );
}
