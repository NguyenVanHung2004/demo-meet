// src/lib/api.ts
import { put, upload } from '@vercel/blob/client'; // [SỬA] Import thêm 'upload'
// 1. Lấy thông tin từ biến môi trường
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID;
const RUNPOD_URL_ASYNC = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;
const RUNPOD_URL = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`;
const BLOB_TOKEN_SERVER = process.env.BLOB_READ_WRITE_TOKEN;
// --- HÀM 1: GỠ BĂNG (Upload Audio -> RunPod) ---
// (Giữ nguyên như cũ vì đã chuẩn)
export const uploadAudioFile = async (file: File): Promise<string> => {
  try {
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      throw new Error("❌ Lỗi: Thiếu cấu hình RunPod trong .env.local");
    }

    // 1. Upload lên Vercel Blob
    const payload = { 
        fileType: file.type,
        blobToken: BLOB_TOKEN_SERVER || process.env.BLOB_READ_WRITE_TOKEN
    };
    console.log("🚀 [1/3] Upload file lên Vercel Blob...");
    
    const blob = await upload(file.name, file, {
      handleUploadUrl: '/api/upload', 
      clientPayload: JSON.stringify(payload),
      access: 'public'
    });
    
    console.log("✅ [2/3] Upload xong. Gửi RunPod xử lý (Async)...", blob.url);

    // 2. Gửi request sang RunPod (Dùng URL ASYNC)
    const response = await fetch(RUNPOD_URL_ASYNC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          action: "transcribe", 
          audio_url: blob.url
        }
      })
    });

    const data = await response.json();
    console.log("--> RunPod Job Created:", data);

    // [QUAN TRỌNG] RunPod Async trả về { id: "job-id-..." } ngay lập tức
    if (data.id) {
       return data.id; 
    } else {
       throw new Error("Không lấy được Job ID từ RunPod: " + JSON.stringify(data));
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
        console.log("📝 Gửi yêu cầu tóm tắt toàn bộ (Async)...");
        const response = await fetch(RUNPOD_URL_ASYNC, { // <-- Đổi thành ASYNC
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RUNPOD_API_KEY}`
            },
            body: JSON.stringify({
              input: {
                action: "summarize",
                text: text
              }
            })
        });
        
        const data = await response.json();
        console.log("--> RunPod Summary Job Created:", data);

        // Trả về Job ID ngay lập tức thay vì chờ kết quả
        if (data.id) {
            return data.id; 
        }
        throw new Error("Không lấy được Job ID tóm tắt.");
  
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