// app/api/gemini/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { text, mode, previousSummary } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Thiếu nội dung text" }, { status: 400 });
    }

    // Dùng model Flash cho tốc độ cao nhất
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let prompt = "";
    
     if (mode === "segment") {
      // [PROMPT NÂNG CẤP] Chống lặp ý + Tối ưu cho hội thoại
      prompt = `
      Bạn là chuyên gia ghi chép biên bản cuộc họp theo thời gian thực (Live-taker).
      Nhiệm vụ: Tóm tắt đoạn hội thoại mới nhất ("VĂN BẢN MỚI") để nối tiếp vào biên bản ("NGỮ CẢNH").

      QUY TRÌNH TƯ DUY (Không in ra):
      1. So sánh "VĂN BẢN MỚI" với "NGỮ CẢNH" xem có thông tin gì thực sự mới không.
      2. Nếu "VĂN BẢN MỚI" chỉ là lặp lại ý cũ, lời ậm ừ, hoặc các câu đệm vô nghĩa -> Bỏ qua.
      3. Nếu có ý mới -> Viết lại súc tích, ngắn gọn nhất có thể.

      YÊU CẦU ĐẦU RA (BẮT BUỘC):
      - Tuyệt đối KHÔNG nhắc lại những gì đã có trong "NGỮ CẢNH".
      - Chỉ xuất ra thông tin mới (Incremental Update).
      - Nếu đoạn văn bản vô nghĩa hoặc lặp hoàn toàn -> Trả về rỗng hoặc câu cực ngắn.
      - Không dùng các từ nối rườm rà như "Tiếp theo", "Sau đó", "Ông ấy nói rằng". Đi thẳng vào nội dung.
      - Giữ nguyên thuật ngữ chuyên ngành.

      -----
      NGỮ CẢNH (Những gì đã diễn ra trước đó):
      "${previousSummary || "Chưa có thông tin."}"
      
      VĂN BẢN MỚI (Cần xử lý):
      "${text}"
      -----
      `;
    } else {
      // [PROMPT NÂNG CẤP] Cho tóm tắt tổng hợp (Full Summary)
      prompt = `
      Bạn là Thư Ký Cấp Cao chuyên nghiệp. Nhiệm vụ của bạn là tổng hợp biên bản cuộc họp từ văn bản thô (transcript) được cung cấp dưới đây.
      
      MỤC TIÊU: Tạo ra một báo cáo súc tích, dễ đọc, tập trung vào kết quả thực tế, loại bỏ hoàn toàn các câu xã giao thừa thãi.

      DỮ LIỆU ĐẦU VÀO:
      "${text}"

      YÊU CẦU ĐỊNH DẠNG ĐẦU RA (Markdown):
      
      # BIÊN BẢN TÓM TẮT CUỘC HỌP
      
      ## 1. TỔNG QUAN
      - **Mục đích cuộc họp:** (Tóm tắt trong 1 câu)
      
      ## 2. CÁC ĐIỂM CHÍNH
      *(Tóm tắt theo chủ đề, không tường thuật theo trình tự thời gian. Dùng gạch đầu dòng)*
      - **[Chủ đề A]:** Các ý chính đã thảo luận...
      - **[Chủ đề B]:** Các ý chính đã thảo luận...
      
      ## 3. CHI TIẾT THẢO LUẬN
      *(Chỉ ghi lại những tranh luận quan trọng hoặc ý kiến đắt giá)*
      - 🗣️ **[Tên/Vai trò]:** [Quan điểm chính]
      
      ## 4. KẾT LUẬN & HÀNH ĐỘNG TIẾP THEO
       **Các quyết định đã chốt:**
         - [Quyết định 1]
         - [Quyết định 2]
         
       **Hành động cần làm (Action Items):**
         - [ ] **Ai làm?** - [Làm việc gì?] - [Deadline nếu có]

      LƯU Ý QUAN TRỌNG:
      - Sử dụng 100% Tiếng Việt chuẩn mực báo cáo.
      - Giữ nguyên thuật ngữ chuyên ngành (Tiếng Anh, tên riêng, mã dự án).
      - Trình bày thoáng, dễ nhìn (sử dụng Bold, Bullet points).
      `;
    }

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text();

    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}