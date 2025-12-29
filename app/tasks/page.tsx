"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Calendar,
  CheckCircle,
  Send,
  Loader2,
  ArrowRightFromLine,
  Eye,
  RotateCcw,
  Mail, // Icon thư cho trạng thái đã gửi
  Clock, // Icon đồng hồ cho trạng thái chờ
} from "lucide-react";
import { useRouter } from "next/navigation";
import { updateMeetingProcess } from "../lib/db";
// 1. IMPORT USEAUTH ĐỂ LẤY USER ID THẬT
import { useAuth } from "../context/AuthContext";
import { useGlobalUI } from "../context/GlobalUIProvider";
import {
  Meeting,
  Member,
  getMembers,
  saveMember,
  deleteMember,
  getAllMeetings,
  getMeetingById,
} from "../lib/db";
import MeetingDetailState from "../components/MeetingDetailState";
// Interface nội bộ
interface TaskItem {
  id: number;
  task: string;
  assigneeName: string;
  email: string[];
  deadline: string;
}
import EditorState from "../components/EditorState";
export default function TaskManagerPage() {
  // 2. LẤY USER TỪ CONTEXT (Thay vì hardcode "user_demo")
  const { user, loading } = useAuth(); // loading để chờ check login xong
  const router = useRouter();
  const { toast, confirm } = useGlobalUI();
  const [members, setMembers] = useState<Member[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [viewingMeeting, setViewingMeeting] = useState<Meeting | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  // State form thêm member
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  // State xử lý
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<TaskItem[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  // 🟢 HÀM XỬ LÝ TÓM TẮT (Truyền vào EditorState)
  const handleSummarize = async (meetingId: string, fullText: string) => {
    try {
      toast.info("Đang gửi yêu cầu tóm tắt...");

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          mode: "summarize", // Đảm bảo API của bạn xử lý mode này
        }),
      });

      const data = await response.json();

      // Cập nhật vào DB
      await updateMeetingProcess(meetingId, { summary: data.summary });

      // Cập nhật UI ngay lập tức
      if (viewingMeeting && viewingMeeting.id === meetingId) {
        setViewingMeeting({ ...viewingMeeting, summary: data.summary });
      }

      toast.success("Đã cập nhật tóm tắt mới!");
    } catch (e) {
      toast.error("Lỗi khi tóm tắt.");
    }
  };
  // 3. LOAD DATA KHI CÓ USER
  useEffect(() => {
    // Chỉ load khi đã xác thực user thành công
    if (user) {
      setMembers(getMembers());
      getAllMeetings(user.uid) // <-- Truyền user.uid thật vào đây
        .then((data) => {
          // Lọc bỏ các cuộc họp đã xóa (nếu cần)
          setMeetings(data.filter((m) => !m.isDeleted));
        })
        .catch((err) => console.error("Lỗi load meeting:", err));
    }
  }, [user]); // Chạy lại khi user thay đổi

  // --- LOGIC MEMBER ---
  const handleAddMember = () => {
    if (!newName || !newEmail) return;
    const newMember: Member = {
      id: Date.now().toString(),
      name: newName,
      email: newEmail,
    };
    saveMember(newMember);
    setMembers(getMembers());
    setNewName("");
    setNewEmail("");
  };

  // ...
  const handleDeleteMember = async (email: string) => {
    // 🟢 SỬA: Dùng confirm từ useGlobalUI
    const isConfirmed = await confirm({
      title: "Xóa danh bạ",
      message: "Bạn có chắc chắn muốn xóa thành viên này không?",
      confirmText: "Xóa luôn",
      type: "danger",
    });

    if (isConfirmed) {
      deleteMember(email);
      setMembers(getMembers());
      toast.success("Đã xóa thành viên thành công!"); // 🟢 Thêm thông báo
    }
  };

  // --- LOGIC AI EXTRACT ---
  const handleExtractActionItems = async (meeting: Meeting) => {
    if (meeting.actionItems && meeting.actionItems.length > 0) {
      const isConfirmed = await confirm({
        title: "Cảnh báo làm lại",
        message:
          "Cuộc họp này đã có dữ liệu task. Việc trích xuất lại sẽ XÓA các chỉnh sửa cũ.\n\nBạn có chắc chắn muốn làm lại không?",
        confirmText: "Đồng ý làm lại",
        type: "danger", // Hiện icon đỏ cảnh báo
      });

      // Nếu người dùng bấm Hủy -> Dừng hàm luôn
      if (!isConfirmed) return;
    }
    if (!meeting.segments)
      return alert("Cuộc họp này chưa có nội dung transcript!");
    const fullTranscript = meeting.segments
      ? meeting.segments
          .map((seg) => {
            // 1. Xác định ID người nói trong segment (tuỳ interface của bạn là .speaker hay .speakerId)
            // (Thường pyannote trả về key là 'speaker', nhưng bạn dùng 'speakerId' thì cứ theo interface của bạn)
            const speakerKey = seg.speakerId;

            // 2. Tìm object Speaker tương ứng trong danh sách đã edit tên
            const matchedSpeaker = meeting.speakers.find(
              (s) => s.id === speakerKey
            );

            // 3. Ưu tiên lấy tên thật (name), nếu không thấy thì lấy ID gốc
            const displayName = matchedSpeaker
              ? matchedSpeaker.name
              : speakerKey;

            return `${displayName}: ${seg.text}`;
          })
          .join("\n")
      : "";
    console.log(fullTranscript);
    setSelectedMeeting(meeting);
    setIsProcessing(true);

    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullTranscript,
          mode: "extract_json",
          // 🟢 PROMPT MỚI: Dạy AI phân biệt Sếp và Nhân viên
          prompt_instruction: `
            Bạn là thư ký chuyên nghiệp. Hãy trích xuất Action Items.
            QUY TẮC VỀ NGƯỜI THỰC HIỆN (assignee):
            1. Nếu giao cho nhiều người: Liệt kê tên ngăn cách bằng dấu phẩy (VD: "Hùng, Nam").
            2. Nếu giao cho "cả team" hoặc "mọi người": 
               -> Liệt kê tên các nhân viên thực thi.
               -> TUYỆT ĐỐI KHÔNG điền tên người ra lệnh (Sếp) vào (trừ khi họ tự nhận).
            3. Ví dụ: Sếp Tuấn bảo "Các em Hùng, Lan làm báo cáo nhé" -> Assignee: "Hùng, Lan".
        `,
          dateContext: new Date(meeting.createdAt).toLocaleString("vi-VN"),
        }),
      });
      const data = await response.json();

      const jsonMatch = data.summary.match(/\[[\s\S]*\]/);

      let cleanJson = "[]";
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      } else {
        // Fallback: Nếu AI trả về object {} thay vì array [], thử tìm {}
        const objectMatch = data.summary.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          cleanJson = `[${objectMatch[0]}]`;
        }
      }

      // Parse JSON
      let rawTasks;
      try {
        rawTasks = JSON.parse(cleanJson);
      } catch (error) {
        console.error("JSON Parse Error:", error);
        console.log("Bad String:", data.summary);
        return toast.error("AI trả về dữ liệu lỗi. Hãy thử lại!");
      }

      // 🟢 LOGIC MAP TÊN -> EMAIL (Để pre-pick trong dropdown)
      const mappedTasks = rawTasks.map((t: any, index: number) => {
        let detectedEmails: string[] = [];

        // 1. Tách chuỗi tên AI trả về. VD: "Hùng, Nam" -> ["Hùng", "Nam"]
        const names = t.assignee
            ? t.assignee.split(/,| và | vs | and /).map((n: string) => n.trim())
            : [];
        
        // 2. Duyệt qua từng tên để tìm trong danh bạ
        names.forEach((name: string) => {
            if(!name) return;

            // Tìm nhân viên có tên gần giống nhất
            const matchedMember = members.find(m => 
                m.name.toLowerCase().includes(name.toLowerCase()) || 
                name.toLowerCase().includes(m.name.toLowerCase())
            );

            if (matchedMember) {
                detectedEmails.push(matchedMember.email);
            }
        });

        // 3. Fallback: Nếu AI bảo "Team" mà không tìm được ai -> Chọn hết
        if (detectedEmails.length === 0 && (t.assignee.toLowerCase().includes("team") || t.assignee.toLowerCase().includes("mọi người"))) {
             detectedEmails = members.map(m => m.email);
        }

        // 4. Xóa trùng lặp
        detectedEmails = [...new Set(detectedEmails)];

        return {
          id: index,
          task: t.task,
          assigneeName: t.assignee, // Tên hiển thị (để tham khảo)
          email: detectedEmails,    // 🟢 Mảng email đã tìm được (Sẽ hiển thị tick xanh)
          deadline: t.deadline,
        };
      });

      //   setExtractedTasks(mappedTasks);
      await updateMeetingProcess(meeting.id, {
        actionItems: mappedTasks,
        actionStatus: "draft",
      });
      router.push(`/tasks/${meeting.id}`);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi đọc dữ liệu từ AI. Hãy thử lại!");
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. HIỂN THỊ LOADING NẾU CHƯA ĐĂNG NHẬP XONG
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );

  // Nếu không có user thì yêu cầu đăng nhập (hoặc redirect)
  if (!user)
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-slate-500">
          Vui lòng đăng nhập để sử dụng tính năng này.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Về trang chủ
        </Link>
      </div>
    );
  if (viewingMeeting) {
    // TRƯỜNG HỢP 1: ĐANG SỬA (EDITOR)
    if (isEditing) {
      return (
        <EditorState
          audioSrc={viewingMeeting.audioUrl}
          initialData={viewingMeeting}
          onBack={() => {
            // Khi quay lại từ Editor, ta cần load lại dữ liệu mới nhất từ DB
            // để màn hình Detail hiển thị đúng nội dung vừa sửa.
            getMeetingById(viewingMeeting.id).then((updatedData) => {
              if (updatedData) setViewingMeeting(updatedData);
              setIsEditing(false); // Tắt chế độ sửa
            });
          }}
          onSummarize={handleSummarize}
        />
      );
    }

    // TRƯỜNG HỢP 2: ĐANG XEM (DETAIL)
    return (
      <MeetingDetailState
        meeting={viewingMeeting}
        audioSrc={viewingMeeting.audioUrl}
        onBack={() => setViewingMeeting(null)} // Quay về danh sách
        onEdit={() => setIsEditing(true)} // 🟢 Bấm nút này để sang Editor
      />
    );
  }
  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans">
      {/* CỘT TRÁI: DANH BẠ */}
      <div className="w-full md:w-80 bg-white border-r flex flex-col p-4 md:p-6 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-bold text-slate-800">Nhân Sự</h2>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 space-y-3">
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
            placeholder="Tên (VD: Hùng)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-indigo-500"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button
            onClick={handleAddMember}
            disabled={!newName || !newEmail}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Thêm
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {members.map((m) => (
            <div
              key={m.email}
              className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm group hover:border-indigo-200 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {m.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {m.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteMember(m.email)}
                className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-center text-slate-400 text-xs mt-4">Trống.</p>
          )}
        </div>
      </div>

      {/* CỘT PHẢI: LIST MEETING & EXTRACT */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">
            Trích xuất công việc từ biên bản
          </h2>

          <div className="grid gap-4">
            {meetings.map((meeting) => {
              // 🟢 KHAI BÁO BIẾN TRẠNG THÁI
              const hasData =
                meeting.actionItems && meeting.actionItems.length > 0;
              const isSent = meeting.actionStatus === "sent";
              const isProcessingThis =
                isProcessing && selectedMeeting?.id === meeting.id;

              return (
                <div
                  key={meeting.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <h3
                      onClick={() => setViewingMeeting(meeting)}
                      className="font-bold text-lg text-slate-800 hover:text-indigo-600 hover:underline cursor-pointer transition-colors flex items-center gap-2 group"
                    >
                      {meeting.title}
                      <Eye className="w-4 h-4 opacity-0 group-hover:opacity-50 text-indigo-400" />
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />{" "}
                        {new Date(meeting.createdAt).toLocaleString("vi-VN")}
                      </span>

                      {/* HIỂN THỊ BADGE TRẠNG THÁI */}
                      {isSent ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                          <Mail className="w-3 h-3" /> Đã gửi mail
                        </span>
                      ) : hasData ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          <CheckCircle className="w-3 h-3" /> Đã xử lý
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <Clock className="w-3 h-3" /> Chưa xử lý
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 🟢 LOGIC NÚT BẤM MỚI */}
                  <div className="flex items-center gap-2">
                    {hasData ? (
                      <>
                        {/* Nút 1: Xem chi tiết (Chính) */}
                        <button
                          onClick={() => router.push(`/tasks/${meeting.id}`)}
                          className="px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 flex items-center gap-2 transition"
                        >
                          <Eye className="w-4 h-4" /> Xem chi tiết
                        </button>

                        {/* Nút 2: Làm lại (Phụ) */}
                        <button
                          onClick={() => handleExtractActionItems(meeting)}
                          disabled={isProcessing}
                          title="Trích xuất lại (Xóa dữ liệu cũ)"
                          className="p-2.5 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg hover:bg-red-50 transition"
                        >
                          {isProcessingThis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    ) : (
                      /* Nút 3: Trích xuất (Khi chưa có dữ liệu) */
                      <button
                        onClick={() => handleExtractActionItems(meeting)}
                        disabled={!meeting.segments || isProcessing}
                        className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        {isProcessingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ArrowRightFromLine className="w-4 h-4" />
                        )}
                        {isProcessingThis ? "Đang xử lý..." : "Trích xuất Task"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {meetings.length === 0 && (
              <p className="text-center text-slate-500 mt-10">
                Không tìm thấy cuộc họp nào (hoặc đang tải).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}