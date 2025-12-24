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
        (m.status === 'transcribing') && m.jobId
      );

      if (activeJobs.length === 0) return;

      console.log(`Checking ${activeJobs.length} active jobs...`);

      for (const meeting of activeJobs) {
        if (!meeting.jobId) continue;

        const jobData = await checkJobStatusOnce(meeting.jobId);

        // 1. Xử lý khi Job Thành Công
        if (jobData.status === 'COMPLETED' && jobData.output) {
          
          let finalSegments: any[] = [];
          let finalSpeakers: any[] = [];
          let finalStatus: 'transcribed' | 'completed' = 'completed';

          // [MỚI] Ưu tiên check JSON Segments (Format mới cho Karaoke)
          // Backend trả về: { segments: [...] }
          const rawOutput = jobData.output;
          const jsonSegments = rawOutput.transcript || (Array.isArray(rawOutput) ? rawOutput : null);
          console.log(jsonSegments);
          if (jsonSegments && jsonSegments.length > 0) {
             console.log("✅ Polling: Nhận dữ liệu Karaoke xịn (JSON)");
             finalSegments = jsonSegments;

             // Tự tạo danh sách Speaker từ ID (vì backend chỉ trả về ID "SPEAKER_00")
             const uniqueIds = Array.from(new Set(finalSegments.map((s: any) => s.speakerId)));
             const colors = [
                "bg-indigo-50 text-indigo-700 border-indigo-200",
                "bg-emerald-50 text-emerald-700 border-emerald-200", 
                "bg-orange-50 text-orange-700 border-orange-200", 
                "bg-pink-50 text-pink-700 border-pink-200"
             ];
             
             finalSpeakers = uniqueIds.map((id: any, index) => ({
                 id: id,
                 name: `Người nói ${index + 1}`,
                 color: colors[index % colors.length]
             }));
          } 
          
          // [CŨ] Fallback: Nếu không có JSON thì mới thử tìm text (đề phòng chạy job cũ)
          else if (rawOutput.transcript) {
             console.log("⚠️ Polling: Dữ liệu cũ (Text thô)");
             const parsed = parseTranscriptFile(rawOutput.transcript);
             finalSegments = parsed.segments;
             finalSpeakers = parsed.speakers;
             finalStatus = 'transcribed';
          }

          // Cập nhật DB
          if (finalSegments.length > 0) {
              await updateMeetingProcess(meeting.id, {
                status: finalStatus, 
                segments: finalSegments, // <--- CÓ WORDS CHO KARAOKE
                speakers: finalSpeakers,
                duration: finalSegments[finalSegments.length - 1]?.end || 0,
                jobId: undefined // Xóa JobId để ngừng poll
             });
             onUpdate(); // Reload UI
          } else {
             console.error("Job xong nhưng không thấy dữ liệu:", jobData);
          }
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