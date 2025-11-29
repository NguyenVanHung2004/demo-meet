// app/lib/api.ts

const API_URL = "http://localhost:8000/api/v1";

export interface JobStatus {
  job_id: string;
  status: "queued" | "processing" | "done" | "failed";
  result?: string;
  error?: string;
}

// 1. Gửi file Audio lên Server
export const uploadAudioFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  return data.job_id;
};

// 2. Gửi Text lên để Tóm tắt
export const requestSummary = async (text: string): Promise<string> => {
  const res = await fetch(`${API_URL}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript_text: text }),
  });

  if (!res.ok) throw new Error("Summary request failed");
  const data = await res.json();
  return data.job_id;
};

// 3. Hàm Polling (Hỏi liên tục xem xong chưa)
export const pollJobResult = async (jobId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/jobs/${jobId}`);
        const data: JobStatus = await res.json();

        console.log(`Job ${jobId}: ${data.status}`);

        if (data.status === "done" && data.result) {
          clearInterval(interval);
          resolve(data.result);
        } else if (data.status === "failed") {
          clearInterval(interval);
          reject(data.error || "Unknown error");
        }
      } catch (e) {
        clearInterval(interval);
        reject(e);
      }
    }, 2000); // Hỏi mỗi 2 giây
  });
};
export const checkJobStatusOnce = async (jobId: string): Promise<JobStatus> => {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}`);
    if (!res.ok) throw new Error("Network error");
    return await res.json();
  } catch (e) {
    return { job_id: jobId, status: "failed", error: "Không thể kết nối Server" };
  }
};