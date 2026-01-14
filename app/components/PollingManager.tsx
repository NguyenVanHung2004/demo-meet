"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext"; // [MỚI]
import { getActiveTranscribingMeetings, updateMeetingProcess } from "../lib/db"; // [MỚI] import hàm getActive...
import { checkJobStatusOnce } from "../lib/api";
import { parseTranscriptFile } from "../lib/parser";
import { deleteField } from "firebase/firestore"; // [MỚI]
import { formatTranscriptText, formatWords } from "../lib/utils";

export default function PollingManager({ onUpdate }: { onUpdate: () => void }) {
  const { user } = useAuth(); // [MỚI] Lấy user hiện tại
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Nếu chưa đăng nhập thì không làm gì cả
    if (!user) return;

    const pollJobs = async () => {
      // 1. Chỉ lấy các meeting đang 'transcribing' của User này từ Firestore
      const activeJobs = await getActiveTranscribingMeetings(user.uid);

      if (activeJobs.length === 0) return;

      console.log(`🔄 Đang kiểm tra ${activeJobs.length} job đang chạy...`);

      for (const meeting of activeJobs) {
        if (!meeting.jobId) continue;

        // 2. Hỏi trạng thái từ RunPod
        const jobData = await checkJobStatusOnce(meeting.jobId);

        // --- XỬ LÝ KHI THÀNH CÔNG ---
        if (jobData.status === 'COMPLETED' && jobData.output) {

          let finalSegments: any[] = [];
          let finalSpeakers: any[] = [];
          let finalStatus: 'transcribed' | 'completed' = 'transcribed'; // Mặc định là transcribed

          // [LOGIC CŨ GIỮ NGUYÊN] Xử lý output JSON (Karaoke) hoặc Text
          const rawOutput = jobData.output;
          const jsonSegments = rawOutput.transcript || (Array.isArray(rawOutput) ? rawOutput : null);

          if (jsonSegments && jsonSegments.length > 0) {
            console.log("✅ Polling: Nhận dữ liệu Karaoke (JSON)");
            // [MOD] Format text
            // import { formatTranscriptText, formatWords } from "../lib/utils";
            finalSegments = jsonSegments.map((s: any) => ({
              ...s,
              text: formatTranscriptText(s.text),
              words: formatWords(s.words || []) // <--- Format Words
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

          // 3. Cập nhật vào Firestore
          if (finalSegments.length > 0) {
            await updateMeetingProcess(meeting.id, {
              status: finalStatus,
              segments: finalSegments,
              speakers: finalSpeakers,
              duration: finalSegments[finalSegments.length - 1]?.end || 0,
              jobId: deleteField() as any
            });

            // Gọi onUpdate để refresh list ở Dashboard (nếu cần)
            onUpdate();
          } else {
            console.error("Job xong nhưng dữ liệu rỗng:", jobData);
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

    // Chạy ngay lần đầu
    pollJobs();

    // [TỐI ƯU] Tăng lên 5s (5000ms) để đỡ tốn quota Firestore
    intervalRef.current = setInterval(pollJobs, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, onUpdate]); // Dependency: user thay đổi thì chạy lại

  return null;
}