// app/api/gemini/route.ts
import { NextResponse } from "next/server";

const API_KEY = process.env.OPEN_CODE_GO_API_KEY || "";
const BASE_URL = "https://opencode.ai/zen/go/v1";
const MODEL = "mimo-v2.5";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(prompt: string, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 8192,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(`API error: ${response.status} ${response.statusText} — ${errorBody}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    } catch (error: any) {
      if (attempt < retries) {
        await delay(1000 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry failed");
}

export async function POST(req: Request) {
  try {
    const { text, mode, dateContext, previousSummary, departments, teams, question, history, templateStructure, meetingObjectives } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Thiếu nội dung text" }, { status: 400 });
    }

    let prompt = "";

    if (mode === "extract_json") {
      const deptListStr = departments?.join(", ") || "";
      const teamListStr = teams?.join(", ") || "";
      prompt = `
      Bạn là trợ lý AI chuyên trích xuất công việc (Action Item) từ biên bản cuộc họp.
      THÔNG TIN NGỮ CẢNH:
      - Thời gian diễn ra cuộc họp: ${dateContext || "Hôm nay"} (Hãy dùng ngày này làm mốc để tính toán các từ chỉ thời gian như 'ngày mai', 'thứ 6 tới').
      - Danh sách Phòng ban (Department): [${deptListStr}]
      - Danh sách Nhóm (Team): [${teamListStr}]
      NHIỆM VỤ: Phân tích đoạn hội thoại (Transcript) dưới đây và trích xuất danh sách các nhiệm vụ/công việc cần thực hiện SAU CUỘC HỌP (Action Items).
      
      ⚠️ QUAN TRỌNG - CHỈ TRÍCH XUẤT CÔNG VIỆC SAU CUỘC HỌP:
      - ✅ BẮT BUỘC bao gồm: Các nhiệm vụ cần làm SAU KHI cuộc họp kết thúc (Ví dụ: "Tôi sẽ gửi báo cáo vào thứ 2", "Anh X hãy chuẩn bị tài liệu cho buổi họp tiếp theo", "Tuần sau phải hoàn thành...")
      - ❌ LOẠI TRỪ hoàn toàn: Các hoạt động ĐANG DIỄN RA TRONG cuộc họp (Ví dụ: "Chúng ta đang thảo luận về...", "Tôi đang trình bày...", "Hãy cùng xem qua...", "Bây giờ chúng ta sẽ nói về...")
      
      QUY TẮC MAPPING (Ưu tiên từ trên xuống dưới):
      1. Nếu nhắc đến TÊN RIÊNG -> Điền "assignee".
      2. Nếu nhắc đến TEAM/Phòng cụ thể (VD: "Team Mobile", "Đội Web", ...) -> Điền field "team" (phải khớp chính xác danh sách Team ở trên).
      3. Nếu chỉ nhắc đến PHÒNG BAN chung (VD: "Phòng IT", "Kế toán") -> Điền field "department".(phải khớp chính xác danh sách Phòng ở trên).
      
      VĂN BẢN ĐẦU VÀO:
      "${text}"

      YÊU CẦU XỬ LÝ:
        1. CHỈ tìm các công việc cần làm SAU cuộc họp: lời hứa, cam kết, kế hoạch hành động (Ví dụ: "Tôi sẽ gửi...", "Bạn hãy làm...", "Tuần sau phải xong...", "Deadline là...").
        2. BỎ QUA hoàn toàn:
           - Các hoạt động đang diễn ra TRONG cuộc họp (thảo luận, trình bày, chia sẻ ý kiến...)
           - Câu chào hỏi, giới thiệu, cảm xúc chung chung
           - Các câu mô tả tình trạng hiện tại không kèm cam kết hành động
        3. Nếu không tìm thấy bất kỳ nhiệm vụ SAU CUỘC HỌP nào, hãy trả về mảng rỗng [].
      
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
      const rawText = await generateWithRetry(prompt);
      const cleanText = rawText.replace(/```json|```/g, "").trim();
      return NextResponse.json({ summary: cleanText });
    } else if (mode === "segment") {
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
    } else if (mode === "qa") {
      const historyStr = history?.map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join("\n") || "";

      prompt = `
      Bạn là trợ lý AI thông minh, chuyên trả lời câu hỏi dựa trên biên bản cuộc họp.
      
      NGỮ CẢNH (Nội dung các cuộc họp đã chọn):
      ---------------------
      ${text}
      ---------------------

      LỊCH SỬ TRÒ CHUYỆN TRƯỚC ĐÓ:
      ${historyStr}

      CÂU HỎI MỚI NHẤT CỦA NGƯỜI DÙNG:
      "${question}"

      YÊU CẦU TRẢ LỜI:
      1. Trả lời chính xác, ngắn gọn, súc tích dựa trên ngữ cảnh được cung cấp.
      2. Nếu thông tin không có trong ngữ cảnh, hãy nói "Tôi không tìm thấy thông tin này trong các biên bản đã chọn."
      3. TRÍCH DẪN (BẮT BUỘC): 
         - Khi tham khảo thông tin, hãy chèn link trích dẫn ngay sau câu đó.
         - Cú pháp BẮT BUỘC: [[ID_CUỘC_HỌP|Đoạn văn bản trích dẫn ngắn]].
         - ID lấy từ dòng header "DOCUMENT ID: ...".
         - Ví dụ: "Theo báo cáo, doanh thu tăng trưởng mạnh [[meeting-id-123|doanh thu tăng 20%]]."
         - ⚠️ LƯU Ý QUAN TRỌNG: Đoạn trích dẫn (phần sau dấu |) phải COPY-PASTE CHÍNH XÁC 100% từ văn bản gốc, không được thay đổi bất kỳ ký tự nào, kể cả dấu câu. Nếu sửa đổi, tính năng tìm kiếm sẽ bị lỗi.
      4. Sử dụng format Markdown cho câu trả lời dễ đọc (bold, list...).
      `;
    } else {
      const structureInstruction = templateStructure || `
      # BIÊN BẢN TÓM TẮT CUỘC HỌP

      ## 1. TỔNG QUAN
      - [00:00] **Mục đích:** (Tóm tắt mục tiêu chính của cuộc họp trong 1-2 dòng)

      ## 2. NỘI DUNG CHÍNH & THẢO LUẬN
      - [mm:ss] **[Chủ đề 1]:**
        - Diễn giải ý chính và các kết luận thống nhất...
        - Các thông số/dữ kiện đi kèm (nếu có)...

      ## 3. TRANH LUẬN & GHI CHÚ QUAN TRỌNG
      *(Ghi lại các ý kiến trái chiều hoặc các điểm nhấn đặc biệt)*
      - [mm:ss] **[Tên/Vai trò]:** [Nội dung quan điểm]

      ## 4. KẾT LUẬN & KẾ HOẠCH HÀNH ĐỘNG
      **Các quyết định đã chốt:**
        - [mm:ss] [Quyết định 1]

      **Phân công nhiệm vụ (Action Items):**
        - [ ] **Ai làm?** - [Nhiệm vụ cụ thể] - [Deadline (ghi chính xác ngày/tháng nếu có)]
      `;

      const objectivesPrompt = meetingObjectives
        ? `\n🎯 MỤC TIÊU CUỘC HỌP (TRỌNG TÂM CẦN BÁM SÁT):\nNgười dùng yêu cầu bạn đặc biệt tập trung tóm tắt và làm nổi bật các nội dung/thảo luận/quyết định có liên quan đến các mục tiêu dưới đây:\n"""\n${meetingObjectives}\n"""\n`
        : "";

      prompt = `
      Bạn là Thư Ký Cấp Cao chuyên nghiệp. Nhiệm vụ của bạn là tổng hợp biên bản cuộc họp từ văn bản thô (transcript), đảm bảo tính chính xác tuyệt đối của thông tin.
      ${objectivesPrompt}
      YÊU CẦU CỐT LÕI (XỬ LÝ DỮ LIỆU):
      1.  **Bảo toàn nguyên vẹn số liệu:** Mọi dữ kiện định lượng (con số, ngày tháng, thời gian, chi phí, số lượng...) phải được trích xuất chính xác như trong transcript. 
        Lưu ý: Transcript là dạng văn nói (speech-to-text), nên các số thường bị viết thành từ ngữ âm tiếng Việt. 
        Ví dụ: năm hai không hai tư -> nên chuyển thành 2024; phiên bản vê một -> nên chuyển thành phiên bản v1.
          * *Tuyệt đối không* tự ý làm tròn số (trừ khi được yêu cầu trong văn bản).
          * *Tuyệt đối không* suy đoán hay tự điền số liệu nếu transcript không nhắc đến.
      2.  **Tư duy tổng hợp:** Viết tóm tắt súc tích, tập trung vào kết quả và quyết định, nhưng phải lồng ghép chính xác các dữ kiện số liệu vào ngữ cảnh của câu.
      3.  **Gắn mốc thời gian (Timestamp):** Đây là yêu cầu BẮT BUỘC. Hãy chèn mốc thời gian bắt đầu của ý kiến hoặc chủ đề đó theo định dạng [mm:ss] (ví dụ: [01:23], [10:05]) vào đầu mỗi gạch đầu dòng hoặc tiêu đề mục lục nếu có thể. Điều này giúp người dùng dễ dàng đối chiếu với bản ghi âm.
      ${meetingObjectives ? `4.  **Định hướng nội dung theo mục tiêu:** Ưu tiên trích xuất và làm sâu sắc thêm các chi tiết liên quan đến "MỤC TIÊU CUỘC HỌP" đã nêu trên.` : ""}

      DỮ LIỆU ĐẦU VÀO:
      "${text}"

      YÊU CẦU ĐỊNH DẠNG ĐẦU RA (Markdown):
      Hãy viết biên bản dựa trên cấu trúc (Template) sau đây:
      
      ${structureInstruction}

      LƯU Ý TRÌNH BÀY:
      - Văn phong khách quan, chuyên nghiệp.
      - Tuân thủ chặt chẽ cấu trúc đề bài (các mục H1, H2...).
      - Mỗi ý chính hoặc mục thảo luận nên có mốc thời gian [mm:ss] đi kèm.
      - Nếu transcript có thông tin mâu thuẫn (VD: Lúc đầu nói A, sau sửa thành B), hãy ghi nhận thông tin cuối cùng đã được chốt lại (B).
      `;
    }

    const summary = await generateWithRetry(prompt);
    return NextResponse.json({ summary });

  } catch (error: any) {
    console.error("Gemini route error:", error);
    const errorMessage = error.status === 503
      ? "Hệ thống AI đang quá tải, vui lòng thử lại sau."
      : (error.message || "Lỗi xử lý AI.");
    return NextResponse.json({ error: errorMessage, detail: error.message }, { status: 500 });
  }
}
