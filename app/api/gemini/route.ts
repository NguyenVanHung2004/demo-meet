// app/api/gemini/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, mode, dateContext, previousSummary,departments,teams } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Thiếu nội dung text" }, { status: 400 });
    }

    // Dùng model Flash cho tốc độ cao nhất
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let prompt = "";
    
     if (mode === "extract_json") {
      const deptListStr = departments?.join(", ") || "";
      const teamListStr = teams?.join(", ") || ""; // [MỚI]
      prompt = `
      Bạn là trợ lý AI chuyên trích xuất công việc (Action Item) từ biên bản cuộc họp.
      THÔNG TIN NGỮ CẢNH:
    - Thời gian diễn ra cuộc họp: ${dateContext || "Hôm nay"} (Hãy dùng ngày này làm mốc để tính toán các từ chỉ thời gian như 'ngày mai', 'thứ 6 tới').
    - Danh sách Phòng ban (Department): [${deptListStr}]
    - Danh sách Nhóm (Team): [${teamListStr}]
      NHIỆM VỤ: Phân tích đoạn hội thoại (Transcript) dưới đây và trích xuất danh sách các nhiệm vụ/công việc cần thực hiện (Action Items).
      QUY TẮC MAPPING (Ưu tiên từ trên xuống dưới):
      1. Nếu nhắc đến TÊN RIÊNG -> Điền "assignee".
      2. Nếu nhắc đến TEAM/Phòng cụ thể (VD: "Team Mobile", "Đội Web", ...) -> Điền field "team" (phải khớp chính xác danh sách Team ở trên).
      3. Nếu chỉ nhắc đến PHÒNG BAN chung (VD: "Phòng IT", "Kế toán") -> Điền field "department".(phải khớp chính xác danh sách Phòng ở trên).
      VĂN BẢN ĐẦU VÀO:
      "${text}"

      YÊU CẦU XỬ LÝ:
        1. Tìm các câu mệnh lệnh, lời hứa, hoặc kế hoạch cụ thể (Ví dụ: "Tôi sẽ gửi...", "Bạn hãy làm...", "Tuần sau phải xong...").
        2. Bỏ qua các câu chào hỏi, giới thiệu, hoặc chia sẻ cảm xúc chung chung.
        4. Nếu không tìm thấy bất kỳ nhiệm vụ cụ thể nào, hãy trả về mảng rỗng [].
      
      CẤU TRÚC JSON:
      [
        {
          "task": "Mô tả công việc ngắn gọn",
          "assignee": "Tên người được giao (Nếu không rõ ghi 'Chưa rõ')",
          "team": "Tên Team (nếu có) hoặc null",
          "department": "Tên Phòng (nếu có) hoặc null",
          "deadline": "YYYY-MM-DDTHH:mm (Hãy quy đổi các cụm từ như 'chiều nay 5h', 'thứ 2 tuần sau' thành định dạng ngày giờ cụ thể dựa trên mốc thời gian trên. Nếu không xác định được giờ thì để cuối ngày. Nếu không có deadline thì ghi 'Chưa rõ')"
        }
      ]
      QUAN TRỌNG: Chỉ trả về JSON Array thuần túy, không dùng Markdown \`\`\`json.
      `;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      const rawText = response.text();

      // Vì đã ép JSON Mode nên không cần replace markdown nữa, nhưng cứ để cho chắc
      const cleanText = rawText.replace(/```json|```/g, "").trim();
      
      return NextResponse.json({ summary: cleanText }); // Trả về text dạng chuỗi cho Client parse
    } else {
      // [PROMPT NÂNG CẤP] Cho tóm tắt tổng hợp (Full Summary)
      prompt = `
      Bạn là Thư Ký Cấp Cao chuyên nghiệp. Nhiệm vụ của bạn là tổng hợp biên bản cuộc họp từ văn bản thô (transcript), đảm bảo tính chính xác tuyệt đối của thông tin.

      YÊU CẦU CỐT LÕI (XỬ LÝ DỮ LIỆU):
      1.  **Bảo toàn nguyên vẹn số liệu:** Mọi dữ kiện định lượng (con số, ngày tháng, thời gian, chi phí, số lượng...) phải được trích xuất chính xác như trong transcript.
          * *Tuyệt đối không* tự ý làm tròn số (trừ khi được yêu cầu trong văn bản).
          * *Tuyệt đối không* suy đoán hay tự điền số liệu nếu transcript không nhắc đến.
      2.  **Tư duy tổng hợp:** Viết tóm tắt súc tích, tập trung vào kết quả và quyết định, nhưng phải lồng ghép chính xác các dữ kiện số liệu vào ngữ cảnh của câu.

      DỮ LIỆU ĐẦU VÀO:
      "${text}"

      YÊU CẦU ĐỊNH DẠNG ĐẦU RA (Markdown):

      # BIÊN BẢN TÓM TẮT CUỘC HỌP

      ## 1. TỔNG QUAN
      - **Mục đích:** (Tóm tắt mục tiêu chính của cuộc họp trong 1-2 dòng)

      ## 2. NỘI DUNG CHÍNH & THẢO LUẬN
      *(Tóm tắt theo chủ đề. Các con số và dữ kiện quan trọng cần được **Bôi đậm** để dễ đối chiếu)*

      - **[Chủ đề 1]:**
        - Diễn giải ý chính và các kết luận thống nhất...
        - Các thông số/dữ kiện đi kèm (nếu có)...

      - **[Chủ đề 2]:**
        - Diễn giải ý chính và các kết luận thống nhất...

      ## 3. TRANH LUẬN & GHI CHÚ QUAN TRỌNG
      *(Ghi lại các ý kiến trái chiều hoặc các điểm nhấn đặc biệt)*
      - **[Tên/Vai trò]:** [Nội dung quan điểm]

      ## 4. KẾT LUẬN & KẾ HOẠCH HÀNH ĐỘNG
      **Các quyết định đã chốt:**
        - [Quyết định 1]

      **Phân công nhiệm vụ (Action Items):**
        - [ ] **Ai làm?** - [Nhiệm vụ cụ thể] - [Deadline (ghi chính xác ngày/tháng nếu có)]

      LƯU Ý TRÌNH BÀY:
      - Văn phong khách quan, chuyên nghiệp.
      - Nếu transcript có thông tin mâu thuẫn (VD: Lúc đầu nói A, sau sửa thành B), hãy ghi nhận thông tin cuối cùng đã được chốt lại (B).
      `;
    }
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    return NextResponse.json({ summary });

  } catch (error: any) {
    const errorMessage = error.status === 503 
        ? "Hệ thống AI đang quá tải, vui lòng thử lại sau." 
        : (error.message || "Lỗi xử lý AI.");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}