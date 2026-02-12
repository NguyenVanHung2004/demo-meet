"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext"; // [MỚI]
import { getActiveTranscribingMeetings, subscribeToActiveMeetings, updateMeetingProcess } from "../lib/db"; // [MỚI] import hàm subscribe...
import { checkJobStatusOnce } from "../lib/api";
import { parseTranscriptFile } from "../lib/parser";
import { deleteField } from "firebase/firestore"; // [MỚI]
import { formatTranscriptText, formatWords } from "../lib/utils";

export default function PollingManager({ onUpdate }: { onUpdate: () => void }) {
  const { user } = useAuth();
  // Ref để lưu danh sách các job đang active (từ Firestore)
  const activeJobsRef = useRef<any[]>([]);

  // 1. LISTEN: Lắng nghe danh sách job 'transcribing' từ Firestore (Real-time)
  useEffect(() => {
    if (!user) return;

    // Hàm subscribe trả về unsubscribe funtion
    const unsubscribe = subscribeToActiveMeetings(user.uid, (meetings) => {
      console.log(`📡 Real-time update: ${meetings.length} active jobs`);
      activeJobsRef.current = meetings;
    });

    return () => unsubscribe();
  }, [user]);

  // 2. POLLING: Định kỳ hỏi RunPod trạng thái của các job đang active
  useEffect(() => {
    if (!user) return;

    const checkRunPodStatus = async () => {
      const currentActiveJobs = activeJobsRef.current;
      if (currentActiveJobs.length === 0) return;

      console.log(`🔄 Polling RunPod for ${currentActiveJobs.length} jobs...`);

      for (const meeting of currentActiveJobs) {
        if (!meeting.jobId) continue;

        // Hỏi trạng thái từ RunPod
        const jobData = await checkJobStatusOnce(meeting.jobId);

        // --- XỬ LÝ KHI THÀNH CÔNG ---
        if (jobData.status === 'COMPLETED' && jobData.output) {

          let finalSegments: any[] = [];
          let finalSpeakers: any[] = [];

          // [LOGIC CŨ GIỮ NGUYÊN] Xử lý output JSON (Karaoke) hoặc Text
          const rawOutput = jobData.output;
          // [FIX] Support output.segments format from Hybrid Pipeline
          const jsonSegments = rawOutput.transcript || rawOutput.segments || (Array.isArray(rawOutput) ? rawOutput : null);

          if (jsonSegments && jsonSegments.length > 0) {
            console.log("✅ Polling: Nhận dữ liệu Karaoke (JSON)");
            finalSegments = jsonSegments.map((s: any) => ({
              ...s,
              text: formatTranscriptText(s.text),
              words: formatWords(s.words || [])
            }));

            // Tạo Speaker giả lập từ ID
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
          // Fallback: Text thô
          else if (rawOutput.transcript) {
            console.log("⚠️ Polling: Dữ liệu Text thô");
            const formattedText = formatTranscriptText(rawOutput.transcript);
            const parsed = parseTranscriptFile(formattedText);
            finalSegments = parsed.segments;
            finalSpeakers = parsed.speakers;
          }

          // 3. Cập nhật vào Firestore (Sẽ trigger Listener ở trên -> Job biến mất khỏi list active)
          if (finalSegments.length > 0) {
            await updateMeetingProcess(meeting.id, {
              status: 'transcribed', // [FIX] Luôn về transcribed trước
              segments: finalSegments,
              speakers: finalSpeakers,
              duration: finalSegments[finalSegments.length - 1]?.end || 0,
              jobId: deleteField() as any
            });

            // Gọi onUpdate để refresh list ở Dashboard (nếu cần)
            onUpdate();
          } else {
            console.error("Job xong nhưng dữ liệu rỗng:", JSON.stringify(jobData, null, 2));

            // [FIX] Nếu không có dữ liệu -> Đánh dấu Failed để thoát vòng lặp
            await updateMeetingProcess(meeting.id, {
              status: 'failed',
              errorMessage: "Job Completed but Transcript Empty",
              jobId: deleteField() as any
            });
            onUpdate();
          }
        }

        // --- XỬ LÝ KHI THẤT BẠI ---
        else if (jobData.status === 'FAILED' || jobData.status === 'failed') {
          await updateMeetingProcess(meeting.id, {
            status: 'failed',
            errorMessage: jobData.error || "Lỗi RunPod không xác định",
            jobId: deleteField() as any
          });
          onUpdate();
        }
      }
    };

    // Chạy mỗi 5s
    const intervalId = setInterval(checkRunPodStatus, 5000);

    return () => clearInterval(intervalId);
  }, [user, onUpdate]);

  return null;
}