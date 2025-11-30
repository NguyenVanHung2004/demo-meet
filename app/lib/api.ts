// src/lib/api.ts
import { put, upload } from '@vercel/blob/client'; // [SỬA] Import thêm 'upload'
// 1. Lấy thông tin từ biến môi trường
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID;
const RUNPOD_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`;
const BLOB_TOKEN_SERVER = process.env.BLOB_READ_WRITE_TOKEN;
// --- HÀM 1: GỠ BĂNG (Upload Audio -> RunPod) ---
// (Giữ nguyên như cũ vì đã chuẩn)
export const uploadAudioFile = async (file: File): Promise<string> => {
  try {

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      throw new Error("❌ Lỗi: Thiếu cấu hình RunPod trong .env.local");
    }
    const payload = { 
        fileType: file.type,
        // Truyền token Vercel Blob vào đây
        blobToken: BLOB_TOKEN_SERVER || process.env.BLOB_READ_WRITE_TOKEN
    };
    console.log("🚀 [1/3] Upload file lên Vercel Blob...");
    const blob = await upload(file.name, file, {
      handleUploadUrl: '/api/upload', 
      clientPayload: JSON.stringify(payload),
      access: 'public'
    });
    
    console.log("✅ [2/3] Upload xong. Gửi RunPod xử lý...", blob.url);

    const response = await fetch(RUNPOD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          action: "transcribe", // Gọi chức năng gỡ băng
          audio_url: blob.url
        }
      })
    });

    const data = await response.json();
    console.log("--> Kết quả Gỡ băng:", data);

    if (data.status === "COMPLETED" && data.output) {
       return data.output.transcript || "Không có nội dung."; 
    } else {
       throw new Error("Lỗi xử lý từ RunPod: " + (data.error || JSON.stringify(data)));
    }

  } catch (error) {
    console.error("Lỗi Upload:", error);
    throw error;
  }
};

// --- HÀM 2: TÓM TẮT NHANH (Dùng cho Live Recording) ---
export const requestSegmentSummary = async (text: string): Promise<string> => {
  try {
      const response = await fetch(RUNPOD_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
          },
          body: JSON.stringify({
            input: {
              action: "summarize-segment", // [QUAN TRỌNG] Action dành cho đoạn ngắn
              text: text
            }
          })
      });
      
      const data = await response.json();
      if (data.status === "COMPLETED" && data.output) {
          return data.output.summary || "Lỗi tóm tắt.";
      }
      return "Lỗi phản hồi.";

  } catch (e) {
      console.error("Lỗi Live Summary:", e);
      return "Lỗi kết nối.";
  }
};

// --- HÀM 3: TÓM TẮT TỔNG HỢP (Dùng cho nút "Tóm tắt AI" ở Editor) ---
// [SỬA] Tách riêng ra để gọi action 'summarize'
export const requestSummary = async (text: string): Promise<string> => {
    try {
        console.log("📝 Gửi yêu cầu tóm tắt toàn bộ...");
        const response = await fetch(RUNPOD_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RUNPOD_API_KEY}`
            },
            body: JSON.stringify({
              input: {
                action: "summarize", // [QUAN TRỌNG] Action dành cho tóm tắt full
                text: text
              }
            })
        });
        
        const data = await response.json();
        console.log("--> Kết quả Tóm tắt Full:", data);

        if (data.status === "COMPLETED" && data.output) {
            return data.output.summary || "Không thể tóm tắt.";
        }
        return "Lỗi khi tóm tắt.";
  
    } catch (e) {
        console.error("Lỗi Full Summary:", e);
        throw e;
    }
};

// --- HÀM 4: CHECK TRẠNG THÁI JOB (Dùng cho PollingManager) ---
export const checkJobStatusOnce = async (jobId: string): Promise<any> => {
  try {
    // URL API check status của RunPod
    const statusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`;

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    
    // RunPod trả về object kiểu: { id: "...", status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED", output: ... }
    return data; 

  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái Job:", error);
    // Trả về null hoặc object lỗi để PollingManager không bị crash
    return { status: "FAILED", error: "Network error" };
  }
};