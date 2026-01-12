"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const fetchMeetings = useCallback(() => {
    if (user) {
      // Load Meetings
      getAllMeetings(user.uid).then((data) => setMeetings(data.filter((m) => !m.isDeleted)));

      // Load Members (Để AI dùng ngầm)
      getMembers(user.uid).then((data) => setMembers(data));
    }
  }, [user]);

  // 3. SỬA USEEFFECT: Gọi hàm fetchMeetings vừa tạo
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

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
    const uniqueDepartments = Array.from(new Set(members.map(m => m.department).filter(Boolean)));
    const uniqueTeams = Array.from(new Set(members.map(m => m.team).filter(Boolean)));
    console.log(fullTranscript);
    setSelectedMeeting(meeting);
    setIsProcessing(true);
    console.log(uniqueDepartments);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullTranscript,
          mode: "extract_json",
          departments: uniqueDepartments,
          teams: uniqueTeams,
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
      // 🟢 LOGIC MAP TÊN/PHÒNG BAN -> EMAIL (FIX FINAL)
      const mappedTasks = rawTasks.map((t: any, index: number) => {
        // Hàm chuẩn hóa: Chuyển về chữ thường, giữ nguyên dấu tiếng Việt chuẩn NFC
        const normalize = (str: any) =>
          str ? String(str).normalize("NFC").toLowerCase().trim() : "";

        let detectedEmails: string[] = [];

        // --- BƯỚC 1: TÌM THEO TÊN RIÊNG (ASSIGNEE) ---
        const names = t.assignee
          ? t.assignee.split(/,|;| và | vs | and /).map((n: string) => n.trim())
          : [];

        // [FIX 1] Bổ sung danh xưng CÓ DẤU để replace chính xác
        const prefixes = [
          "ông ", "bà ", "anh ", "chị ", "em ", "sếp ", "bạn ", "cậu ", "cô ", "chú ", "bác ", // Có dấu
          "ong ", "ba ", "sep ", "ban ", "cau ", "co ", "chu ", "bac ", // Không dấu (phòng hờ)
          "mr ", "ms ", "mrs ", "to ", "nhom ", "doi ", "team "
        ];

        names.forEach((rawName: string) => {
          if (!rawName) return;
          let targetName = normalize(rawName);

          // Xóa danh xưng
          for (const p of prefixes) {
            if (targetName.startsWith(p)) {
              targetName = targetName.replace(p, "").trim();
              break; // Xóa xong 1 cái thì thôi
            }
          }

          // Bỏ qua các từ vô nghĩa nếu còn sót lại
          if (["chua ro", "moi nguoi", "ca phong", "all"].some(k => targetName === k)) return;

          // TÌM TRONG DB MEMBER
          const matchedMember = members.find(m => {
            const memName = normalize(m.name); // VD: "trần văn b"

            // [FIX 2] Logic so sánh thông minh hơn

            // Case A: Khớp chính xác 100% (VD: "b" == "b")
            if (memName === targetName) return true;

            // Case B: Khớp từng từ (Word Boundary) - Quan trọng cho tên ngắn như "B"
            // Tách "trần văn b" -> ["trần", "văn", "b"]. Nếu target là "b" -> KHỚP.
            const words = memName.split(" ");
            if (words.some(w => w === targetName)) return true;

            // Case C: Chứa nhau (chỉ áp dụng nếu tên tìm đủ dài để tránh khớp sai)
            // VD: "lan" khớp "nguyễn thị lan", nhưng "a" không được khớp "lan"
            if (targetName.length > 1 && memName.includes(targetName)) return true;

            return false;
          });

          if (matchedMember) {
            detectedEmails.push(matchedMember.email);
          }
        });

        // --- BƯỚC 2: TÌM THEO TEAM / DEPARTMENT ---
        let groupEmails: string[] = [];

        if (t.team) {
          const targetTeam = normalize(t.team);
          groupEmails = members
            .filter(m => normalize(m.team) === targetTeam)
            .map(m => m.email);
        }
        else if (t.department) {
          const targetDept = normalize(t.department);
          groupEmails = members
            .filter(m => normalize(m.department) === targetDept)
            .map(m => m.email);
        }

        // --- BƯỚC 3: QUYẾT ĐỊNH (Logic Thông Minh: Subset Merge) ---

        // Trường hợp 1: Có cả Người cụ thể VÀ Nhóm (Team/Dept)
        if (detectedEmails.length > 0 && groupEmails.length > 0) {

          // Kiểm tra xem những người được tìm thấy có thuộc nhóm này không?
          // (VD: Ông B có thuộc phòng IT không?)
          const isSubset = detectedEmails.every(email => groupEmails.includes(email));

          if (isSubset) {
            // Kịch bản 3: "Ông B bên IT" 
            // -> Ông B là con của IT -> Chỉ lấy ông B (Override)
            // Giữ nguyên detectedEmails
          } else {
            // Kịch bản 4: "Ông A (IT) phối hợp với Kế toán"
            // -> Ông A không thuộc Kế toán -> Lấy cả A và Kế toán (Merge)
            detectedEmails = [...detectedEmails, ...groupEmails];
          }
        }

        // Trường hợp 2: Chỉ có Nhóm (không tìm thấy tên riêng)
        else if (detectedEmails.length === 0 && groupEmails.length > 0) {

          // Check lại xem Assignee có keyword ám chỉ nhóm không để chắc ăn
          // (Tránh trường hợp AI hallucinations gán bừa Dept)
          const normAssignee = normalize(t.assignee);
          const groupKeywords = ["team", "doi", "nhom", "phong", "bo phan", "ben", "toan bo", "ca "];
          const isExplicitGroup = groupKeywords.some(k => normAssignee.includes(k));

          // Nếu Assignee là "Chưa rõ" hoặc có keyword nhóm -> Lấy cả nhóm
          if (detectedEmails.length === 0 || isExplicitGroup) {
            detectedEmails = groupEmails;
          }
        }

        // Xóa trùng lặp
        detectedEmails = [...new Set(detectedEmails)];

        return {
          id: index,
          task: t.task,
          assigneeName: t.assignee,
          email: detectedEmails,
          department: t.department,
          team: t.team,
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
          audioSrc={viewingMeeting.audioUrl || ""}
          initialData={viewingMeeting}
          onBack={() => {
            // Khi quay lại từ Editor, ta cần load lại dữ liệu mới nhất từ DB
            // để màn hình Detail hiển thị đúng nội dung vừa sửa.
            getMeetingById(viewingMeeting.id).then((updatedData) => {
              if (updatedData) setViewingMeeting(updatedData);
              setIsEditing(false); // Tắt chế độ sửa
              fetchMeetings();
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
        audioSrc={viewingMeeting.audioUrl || ""}
        onBack={() => {
          setViewingMeeting(null);
          fetchMeetings(); // 🟢 4. QUAN TRỌNG: Gọi lại API khi quay về danh sách
        }}
        onEdit={() => setIsEditing(true)} // 🟢 Bấm nút này để sang Editor
      />
    );
  }
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* HEADER ĐƠN GIẢN */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-bold text-slate-800">Danh sách cuộc họp cần xử lý</h2>
        </div>
        {/* Có thể thêm nút "Cấu hình nhân sự" ở đây để link sang trang khác nếu muốn */}
      </div>

      {/* CỘT PHẢI: LIST MEETING & EXTRACT */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
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
