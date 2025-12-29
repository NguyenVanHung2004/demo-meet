// app/api/email/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🟢 Hàm Helper: Format ngày giờ cho đẹp (2025-12-26T17:00 -> 17:00 ngày 26/12/2025)
const formatDeadline = (isoString: string) => {
    if (!isoString || isoString === 'TBD' || isoString === 'Chưa rõ') return isoString;
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // Nếu không parse được thì trả về nguyên gốc
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return isoString;
    }
};

export async function POST(req: Request) {
  try {
    // 🟢 NHẬN THÊM meetingTitle TỪ FRONTEND
    const { tasks, meetingTitle } = await req.json();

    const tasksByEmail: Record<string, any[]> = {};
    tasks.forEach((task: any) => {
      if (task.email && Array.isArray(task.email)) {
          task.email.forEach((email: string) => {
              if (!tasksByEmail[email]) tasksByEmail[email] = [];
              // Push task vào danh sách của người này
              tasksByEmail[email].push(task); 
          });
      }
    });

    const sendPromises = Object.keys(tasksByEmail).map(async (email) => {
      const userTasks = tasksByEmail[email];
      
      const taskListHtml = userTasks.map((t: any, index: number) => `
        <div style="margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #4f46e5;">
          <div style="font-weight: bold; color: #1f2937; margin-bottom: 4px;">
             📌 Nhiệm vụ ${index + 1}: ${t.task}
          </div>
          <div style="font-size: 14px; color: #ef4444;">
             ⏰ Hạn chót: <b>${formatDeadline(t.deadline)}</b>
          </div>
        </div>
      `).join('');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">Phân công công việc mới</h2>
            
            <p>Xin chào,</p>
            <p>Bạn vừa được giao <b>${userTasks.length} nhiệm vụ</b> từ cuộc họp:</p>
            
            <div style="background-color: #e0e7ff; color: #3730a3; padding: 10px 15px; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
                📅 ${meetingTitle || "Cuộc họp không tên"}
            </div>

            ${taskListHtml}
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
            <p style="font-size: 12px; color: #666; text-align: center;">
                Email tự động từ AI Task Manager. Vui lòng không trả lời email này.
            </p>
        </div>
      `;

      return transporter.sendMail({
        from: '"AI Task Manager" <no-reply@taskmanager.com>',
        to: email,
        // 🟢 Tiêu đề mail cũng thêm tên cuộc họp cho dễ tìm
        subject: `[Task Mới] ${meetingTitle} - Bạn có ${userTasks.length} việc cần làm`,
        html: htmlContent,
      });
    });

    await Promise.all(sendPromises);
    return NextResponse.json({ success: true, count: Object.keys(tasksByEmail).length });

  } catch (error) {
    console.error("Lỗi gửi mail:", error);
    return NextResponse.json({ error: "Lỗi gửi mail" }, { status: 500 });
  }
}