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
      
      // Lọc các meeting đang có job chạy (transcribing HOẶC summarizing)
      const activeJobs = allMeetings.filter(m => 
        (m.status === 'transcribing' || m.status === 'summarizing') && m.jobId
      );

      if (activeJobs.length === 0) return;

      console.log(`Checking ${activeJobs.length} active jobs...`);

      for (const meeting of activeJobs) {
        if (!meeting.jobId) continue;

        const jobData = await checkJobStatusOnce(meeting.jobId);

        // 1. Xử lý khi Job Thành Công
        if (jobData.status === 'COMPLETED' && jobData.output) {
          
          // CASE A: Vừa ghi biên bản xong (Audio -> Text)
          if (meeting.status === 'transcribing') {
             // [SỬA] Lấy transcript từ jobData.output.transcript
             const transcriptText = jobData.output.transcript || "";
             
             if (transcriptText) {
                 const parsed = parseTranscriptFile(transcriptText);
                 await updateMeetingProcess(meeting.id, {
                    status: 'transcribed', 
                    segments: parsed.segments,
                    speakers: parsed.speakers,
                    duration: parsed.segments[parsed.segments.length - 1]?.end || 0,
                    jobId: undefined // Xóa JobId để ngừng poll
                 });
             } else {
                 console.error("Không tìm thấy transcript trong output:", jobData.output);
             }
          }
          
          // CASE B: Vừa tóm tắt xong (Text -> Summary)
          else if (meeting.status === 'summarizing') {
            const summaryText = jobData.output.summary || "";
            await updateMeetingProcess(meeting.id, {
              status: 'completed', // Chuyển sang trạng thái "Hoàn thành"
              summary: summaryText,
              jobId: undefined
          });
          }

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
    }, 3000); // 3 giây quét 1 lần cho nhanh

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onUpdate]);

  return null;
}