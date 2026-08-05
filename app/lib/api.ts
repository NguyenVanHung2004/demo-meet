// app/lib/api.ts
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth } from "./firebase";
const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
const RUNPOD_ENDPOINT_ID = process.env.NEXT_PUBLIC_RUNPOD_ENDPOINT_ID;

interface SendTaskEmailResult {
  count: number;
  failures: number;
}

// Gửi email phân công nhiệm vụ (bắt buộc kèm Firebase ID token)
export const sendTaskEmails = async (
  tasks: { task: string; deadline: string; email: string[] }[],
  meetingTitle: string
): Promise<SendTaskEmailResult> => {
  const token = await auth.currentUser?.getIdToken().catch(() => null);
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch("/api/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tasks, meetingTitle }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error === "Unauthorized" || data?.error === "Invalid token"
        ? "AUTH_EXPIRED"
        : data?.error === "Too many requests"
        ? "RATE_LIMITED"
        : data?.error === "Server misconfigured"
        ? "SERVER_CONFIG"
        : "SERVER_ERROR";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return { count: data?.count ?? 0, failures: data?.failures ?? 0 };
};

// --- HÀM 1: GỠ BĂNG (Audio -> Text) - Dùng RunPod Async --
// 1. Upload file lên Firebase (Thay thế Vercel Blob)
export const uploadAudioToFirebase = (
  file: File, 
  userId: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const storageRef = ref(storage, `users/${userId}/uploads/${fileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Firebase Upload Error:", error);
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
};

// 2. Gọi RunPod (Chỉ gửi URL, server ko cần sửa gì cả)
export const startTranscriptionJob = async (audioUrl: string, language: "vi" | "en" = "vi"): Promise<string> => {
  const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        action: "transcribe",
        audio_url: audioUrl,
        language: language
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

// Gọi Gemini trả về Text luôn
export const requestSummary = async (text: string, templateStructure?: string, objectives?: string): Promise<string> => {
  try {

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        mode: "full", // Báo hiệu tóm tắt full
        templateStructure: templateStructure, // [NEW] Truyền cấu trúc template nếu có
        meetingObjectives: objectives // Truyền mục tiêu cuộc họp
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

export interface FillContext {
  summary?: string;
  speakers?: string[];
  objectives?: string;
}

export const requestFillPlaceholders = async (
  placeholders: string[],
  context?: FillContext
): Promise<Record<string, string>> => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "fill_placeholders",
      placeholders,
      context: context || {},
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Lỗi khi AI điền placeholder");
  }
  if (!data.summary) {
    throw new Error("AI không trả về kết quả.");
  }
  try {
    const parsed = JSON.parse(data.summary);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    throw new Error("AI trả về JSON không hợp lệ.");
  }
};

export interface DetectFillItem {
  marker: string;
  value: string;
}

export const requestDetectFill = async (
  text: string,
  context?: FillContext
): Promise<DetectFillItem[]> => {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "detect_fill",
      text,
      context: context || {},
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Lỗi khi AI phân tích file");
  }
  if (!data.summary) {
    throw new Error("AI không trả về kết quả.");
  }
  try {
    const parsed = JSON.parse(data.summary);
    if (Array.isArray(parsed)) {
      return parsed.filter((i) => i && typeof i.marker === "string" && i.marker.trim());
    }
    return [];
  } catch {
    throw new Error("AI trả về JSON không hợp lệ.");
  }
};

export interface RunPodJobStatus {
  id?: string;
  status: string;
  output?: {
    transcript?: string;
    segments?: Record<string, unknown>[];
    [key: string]: unknown;
  };
  error?: string;
  [key: string]: unknown;
}

// --- HÀM 4: CHECK TRẠNG THÁI JOB ---
export const checkJobStatusOnce = async (jobId: string): Promise<RunPodJobStatus> => {
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
export const startHybridTranscriptionJob = async (audioUrl: string, diarization: Record<string, unknown>[], language: "vi" | "en" = "vi"): Promise<string> => {
  try {
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
          diarization: diarization,
          language: language
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