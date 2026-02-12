// app/lib/api.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID;

// --- HÀM 1: GỠ BĂNG (Audio -> Text) - Dùng RunPod Async --
// 1. Upload file lên Firebase (Thay thế Vercel Blob)
export const uploadAudioToFirebase = async (file: File, userId: string): Promise<string> => {
  // Lưu vào folder riêng của user
  const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const storageRef = ref(storage, `users/${userId}/uploads/${fileName}`);

  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

// 2. Gọi RunPod (Chỉ gửi URL, server ko cần sửa gì cả)
export const startTranscriptionJob = async (audioUrl: string): Promise<string> => {
  const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        action: "transcribe",
        audio_url: audioUrl
      }
    })
  });

  const data = await response.json();
  if (data.id) return data.id;
  throw new Error("RunPod Error: " + JSON.stringify(data));
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
export const requestSummary = async (text: string, templateStructure?: string): Promise<string> => {
  try {
    console.log("📝 Gửi yêu cầu tóm tắt Full sang Gemini...");

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        mode: "full", // Báo hiệu tóm tắt full
        templateStructure: templateStructure // [NEW] Truyền cấu trúc template nếu có
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

// --- HÀM 5: HYBRID TRANSCRIPTION (RunPod Serverless) ---
export const startHybridTranscriptionJob = async (audioUrl: string, diarization: any[]): Promise<string> => {
  try {
    console.log("🔌 Calling RunPod for Hybrid Transcription...");
    const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify({
        input: {
          action: "transcribe_hybrid",
          audio_url: audioUrl,
          diarization: diarization
        }
      })
    });

    const data = await response.json();
    if (data.id) return data.id;
    throw new Error(`RunPod Error: ${JSON.stringify(data)}`);

  } catch (error) {
    console.warn("⚠️ Hybrid Transcription Failed:", error);
    throw error;
  }
};