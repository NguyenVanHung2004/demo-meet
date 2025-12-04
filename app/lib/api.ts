// app/lib/api.ts
import { upload } from '@vercel/blob/client'; 

const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID;

// URL RunPod cho tác vụ nặng (Gỡ băng & Tóm tắt Full)
const RUNPOD_URL_ASYNC = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`;

const BLOB_TOKEN_SERVER = process.env.BLOB_READ_WRITE_TOKEN;

// --- HÀM 1: GỠ BĂNG (Audio -> Text) - Dùng RunPod Async ---
export const uploadAudioFile = async (file: File): Promise<string> => {
  try {
    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) throw new Error("Thiếu config RunPod");

    const payload = { 
        fileType: file.type,
        blobToken: BLOB_TOKEN_SERVER || process.env.BLOB_READ_WRITE_TOKEN
    };
    
    console.log("🚀 Uploading to Vercel Blob...");
    const blob = await upload(file.name, file, {
      handleUploadUrl: '/api/upload', 
      clientPayload: JSON.stringify(payload),
      access: 'public'
    });
    
    console.log("🚀 Gửi yêu cầu Gỡ băng sang RunPod...");
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
    if (data.id) return data.id; 
    throw new Error("Lỗi RunPod: " + JSON.stringify(data));

  } catch (error) {
    console.error("Lỗi Upload:", error);
    throw error;
  }
};

// --- HÀM 2: TÓM TẮT NHANH (Text -> Summary) ---
// [SỬA] Dùng Gemini (Next.js API) để trả kết quả NGAY LẬP TỨC
export const requestSegmentSummary = async (text: string, previousSummary: string = ""): Promise<string> => {
  try {
      const response = await fetch('/api/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            previousSummary: previousSummary, // Gửi kèm ngữ cảnh
            mode: "segment" 
          })
      });
      
      const data = await response.json();
      if (data.summary) return data.summary;
      return "";

  } catch (e) {
      console.error("Lỗi Live Summary:", e);
      return "";
  }
};

// --- HÀM 3: TÓM TẮT TỔNG HỢP (Text -> Summary) ---
// [GIỮ NGUYÊN] Dùng RunPod (Qwen) để xử lý tác vụ nặng nền tảng
// export const requestSummary = async (text: string): Promise<string> => {
//     try {
//         console.log("📝 Gửi yêu cầu tóm tắt Full sang RunPod...");
//         const response = await fetch(RUNPOD_URL_ASYNC, {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json',
//               'Authorization': `Bearer ${RUNPOD_API_KEY}`
//             },
//             body: JSON.stringify({
//               input: {
//                 action: "summarize", // Gọi action tóm tắt của Qwen trên RunPod
//                 text: text
//               }
//             })
//         });
        
//         const data = await response.json();
//         // Trả về Job ID để PollingManager theo dõi
//         if (data.id) return data.id; 
        
//         throw new Error("Không lấy được Job ID tóm tắt.");
  
//     } catch (e) {
//         console.error("Lỗi Full Summary:", e);
//         throw e;
//     }
// };

// ✅ MỚI: Gọi Gemini trả về Text luôn
export const requestSummary = async (text: string): Promise<string> => {
    try {
        console.log("📝 Gửi yêu cầu tóm tắt Full sang Gemini...");
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              mode: "full" // Báo hiệu tóm tắt full
            })
        });
        
        const data = await response.json();
        
        if (data.summary) {
            return data.summary; // Trả về nội dung tóm tắt ngay
        }
        
        throw new Error("Gemini không trả về kết quả.");
  
    } catch (e) {
        console.error("Lỗi Full Summary:", e);
        throw e;
    }
};

// --- HÀM 4: CHECK TRẠNG THÁI JOB ---
export const checkJobStatusOnce = async (jobId: string): Promise<any> => {
  try {
    const statusUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/status/${jobId}`;
    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json"
      }
    });
    return await response.json(); 
  } catch (error) {
    console.error("Lỗi check status:", error);
    return { status: "FAILED", error: "Network error" };
  }
};