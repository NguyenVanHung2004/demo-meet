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
      // [PROMPT MỚI CỦA BẠN] + Kết hợp Context
      prompt = `
      Bạn là chuyên gia phân tích hội thoại. Hãy thực hiện các bước sau trong tư duy (không in ra):
      
      1. Đọc phần "NGỮ CẢNH" (nếu có) để nắm bắt mạch câu chuyện và các đối tượng đã được nhắc đến.
      2. Phân tích "VĂN BẢN MỚI":
         - Xác định các thực thể: Ai? Ở đâu? Thời gian nào? Làm gì?
         - Loại bỏ thông tin nhiễu (than vãn, cười đùa, chi tiết thừa, lặp từ).
         - Sắp xếp lại trình tự thời gian cho hợp lý.
      
      YÊU CẦU ĐẦU RA BẮT BUỘC:
      - Chỉ ghi ra văn bản được tóm tắt ngắn gọn (1-2 câu).
      - Tuyệt đối KHÔNG có output gì thêm (không in ra các bước tư duy, không giải thích).
      - Giữ nguyên thuật ngữ chuyên ngành (Tiếng Anh, tên riêng).
      
      -----
      NGỮ CẢNH (Đã diễn ra trước đó):
      "${previousSummary || "Chưa có thông tin."}"
      
      VĂN BẢN MỚI (Cần xử lý):
      "${text}"
      -----
      `;
    } else {
      // Prompt cho tóm tắt tổng hợp (Full Summary) - Giữ nguyên
      prompt = `
      Bạn là Thư Ký Cấp Cao. Hãy tóm tắt biên bản cuộc họp sau đây một cách chuyên nghiệp.
      
      Dữ liệu đầu vào:
      "${text}"

      Yêu cầu định dạng Markdown:
      # BIÊN BẢN TÓM TẮT CUỘC HỌP
      ## 1. TỔNG QUAN
      (Mục đích và không khí cuộc họp)
      ## 2. NỘI DUNG CHI TIẾT
      (Trình bày theo từng người nói hoặc chủ đề. Nêu rõ ai nói gì)
      ## 3. KẾT LUẬN & HÀNH ĐỘNG

      Lưu ý: Sử dụng 100% Tiếng Việt, giữ thuật ngữ chuyên ngành.
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