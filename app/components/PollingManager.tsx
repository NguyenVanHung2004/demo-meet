"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getActiveTranscribingMeetings, subscribeToActiveMeetings, updateMeetingProcess } from "../lib/db";
import { checkJobStatusOnce } from "../lib/api";
import { parseTranscriptFile } from "../lib/parser";
import { deleteField } from "firebase/firestore";
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


      for (const meeting of currentActiveJobs) {
        if (!meeting.jobId) continue;

        // Hỏi trạng thái từ RunPod
        const jobData = await checkJobStatusOnce(meeting.jobId);

        // --- XỬ LÝ KHI THÀNH CÔNG ---
        if (jobData.status === 'COMPLETED') {
          if (jobData.output) {
            let finalSegments: any[] = [];
            let finalSpeakers: any[] = [];

            // [LOGIC CŨ GIỮ NGUYÊN] Xử lý output JSON (Karaoke) hoặc Text
            const rawOutput = jobData.output;
            const jsonSegments = rawOutput.transcript || rawOutput.segments || (Array.isArray(rawOutput) ? rawOutput : null);

            if (jsonSegments && jsonSegments.length > 0) {
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
              const formattedText = formatTranscriptText(rawOutput.transcript);
              const parsed = parseTranscriptFile(formattedText);
              finalSegments = parsed.segments;
              finalSpeakers = parsed.speakers;
            }

            // 3. Cập nhật vào Firestore (Sẽ trigger Listener ở trên -> Job biến mất khỏi list active)
            if (finalSegments.length > 0) {
              try {
                await updateMeetingProcess(meeting.id, {
                  status: 'transcribed',
                  segments: finalSegments,
                  speakers: finalSpeakers,
                  duration: finalSegments[finalSegments.length - 1]?.end || 0,
                  jobId: deleteField() as any
                });

                // Gọi onUpdate để refresh list ở Dashboard (nếu cần)
                onUpdate();
              } catch (error) {
                console.warn("⚠️ Firestore 1MB limit hit. Đang thử lược bỏ mảng words để giảm dung lượng...", error);
                try {
                  const lightSegments = finalSegments.map((s: any) => {
                    const { words, ...rest } = s;
                    return rest;
                  });

                  await updateMeetingProcess(meeting.id, {
                    status: 'transcribed',
                    segments: lightSegments,
                    speakers: finalSpeakers,
                    duration: lightSegments[lightSegments.length - 1]?.end || 0,
                    jobId: deleteField() as any
                  });
                  onUpdate();
                } catch (fallbackError) {
                  console.error("Vẫn lỗi sau khi giảm dung lượng:", fallbackError);
                  await updateMeetingProcess(meeting.id, {
                    status: 'failed',
                    errorMessage: "Bản ghi âm quá dài, vượt quá giới hạn bộ nhớ.",
                    jobId: deleteField() as any
                  });
                  onUpdate();
                }
              }
            } else {
              console.error("Job xong nhưng dữ liệu rỗng:", JSON.stringify(jobData, null, 2));

              await updateMeetingProcess(meeting.id, {
                status: 'failed',
                errorMessage: "Job Completed but Transcript Empty",
                jobId: deleteField() as any
              });
              onUpdate();
            }
          } else {
            // Trường hợp RunPod trả về COMPLETED nhưng không có output (do quá hạn / bị xóa trên server)
            console.error("Job COMPLETED nhưng mất output từ RunPod:", JSON.stringify(jobData, null, 2));
            await updateMeetingProcess(meeting.id, {
              status: 'failed',
              errorMessage: "Kết quả đã hết hạn trên server RunPod (Timeout).",
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