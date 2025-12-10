// app/components/PollingManager.tsx
"use client";

import { useEffect, useRef } from "react";
import { getAllMeetings, updateMeetingProcess } from "../lib/db";
import { checkJobStatusOnce } from "../lib/api";
import { parseTranscriptFile } from "../lib/parser";

export default function PollingManager({ onUpdate }: { onUpdate: () => void }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      const allMeetings = await getAllMeetings();
      
      // [FIX] Chỉ lọc các meeting đang 'transcribing' (Gỡ băng).
      // Bỏ 'summarizing' vì Gemini xử lý trực tiếp, không cần poll.
      const activeJobs = allMeetings.filter(m => 
        m.status === 'transcribing' && m.jobId
      );

      if (activeJobs.length === 0) return;

      console.log(`Checking ${activeJobs.length} active transcription jobs...`);

      for (const meeting of activeJobs) {
        if (!meeting.jobId) continue;

        const jobData = await checkJobStatusOnce(meeting.jobId);

        // 1. Xử lý khi Job Thành Công
        if (jobData.status === 'COMPLETED' && jobData.output) {
          
          // CASE: Vừa ghi biên bản xong (Audio -> Text)
          // [SỬA] Lấy transcript từ jobData.output.transcript
          const transcriptText = jobData.output.transcript || "";
            
          if (transcriptText) {
              const parsed = parseTranscriptFile(transcriptText);
              await updateMeetingProcess(meeting.id, {
                status: 'transcribed', 
                segments: parsed.segments,
                speakers: parsed.speakers,
                duration: parsed.segments[parsed.segments.length - 1]?.end || 0,
                jobId: undefined // [QUAN TRỌNG] Xóa JobId để ngừng poll
              });
          } else {
              console.error("Không tìm thấy transcript trong output:", jobData.output);
              // Có thể xử lý lỗi nhẹ ở đây nếu muốn
          }
          
          // [ĐÃ XÓA] Logic check 'summarizing' cũ

          onUpdate(); // Reload UI
        } 
        
        // 2. Xử lý khi Job Thất Bại
        else if (jobData.status === 'failed') {
          await updateMeetingProcess(meeting.id, {
            status: 'failed',
            errorMessage: jobData.error || "Lỗi không xác định",
            jobId: undefined
          });
          onUpdate();
        }
      }
    }, 3000); // 3 giây quét 1 lần

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onUpdate]);

  return null;
}