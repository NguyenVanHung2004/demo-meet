"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { subscribeToActiveMeetings, updateMeetingProcess } from "../lib/db";
import type { Meeting, Segment, Speaker } from "../lib/db";
import { deleteField } from "firebase/firestore";
import { checkJobStatusOnce } from "../lib/api";
import { parseTranscriptFile } from "../lib/parser";
import { formatWords, formatTranscriptText } from "../lib/utils";

export default function PollingManager({ onUpdate }: { onUpdate: () => void }) {
  const { user } = useAuth();
  // Ref để lưu danh sách các job đang active (từ Firestore)
  const activeJobsRef = useRef<Meeting[]>([]);

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


      const now = Date.now();
      for (const meeting of currentActiveJobs) {
        try {
        if (!meeting.jobId) continue;

        const jobStartedAt = meeting.jobStartedAt || meeting.createdAt;
        if (now - jobStartedAt > 30 * 60 * 1000) {
          await updateMeetingProcess(meeting.id, {
            status: 'failed',
            errorMessage: "Job vượt quá thời gian chờ (30 phút).",
            jobId: deleteField() as any
          });
          onUpdate();
          continue;
        }

        const jobData = await checkJobStatusOnce(meeting.jobId);

        // --- XỬ LÝ KHI THÀNH CÔNG ---
        if (jobData.status === 'COMPLETED') {
          if (jobData.output) {
            let finalSegments: Segment[] = [];
            let finalSpeakers: Speaker[] = [];

            // [LOGIC CŨ GIỮ NGUYÊN] Xử lý output JSON (Karaoke) hoặc Text
            const rawOutput = jobData.output;
            const rawSegments = Array.isArray(rawOutput.transcript)
              ? (rawOutput.transcript as Record<string, unknown>[])
              : rawOutput.segments;
            const jsonSegments: Record<string, unknown>[] | null =
              rawSegments || (Array.isArray(rawOutput) ? (rawOutput as Record<string, unknown>[]) : null);

            if (jsonSegments && jsonSegments.length > 0) {
              finalSegments = jsonSegments.map((s: Record<string, unknown>) => ({
                ...s,
                text: formatTranscriptText(s.text as string),
                words: formatWords((s.words || []) as any[])
              })) as Segment[];

              // Tạo Speaker giả lập từ ID
              const uniqueIds = Array.from(new Set(finalSegments.map((s: Segment) => s.speakerId)));
              const colors = [
                "bg-indigo-50 text-indigo-700 border-indigo-200",
                "bg-emerald-50 text-emerald-700 border-emerald-200",
                "bg-orange-50 text-orange-700 border-orange-200",
                "bg-pink-50 text-pink-700 border-pink-200"
              ];

              finalSpeakers = uniqueIds.map((id: string, index: number) => ({
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
                  const lightSegments = finalSegments.map((s: Segment) => {
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
        } catch (err) {
          console.error(`[Polling] Error processing meeting ${meeting.id}:`, err);
        }
      }
    };

    // Chạy mỗi 5s
    const intervalId = setInterval(checkRunPodStatus, 5000);

    return () => clearInterval(intervalId);
  }, [user, onUpdate]);

  return null;
}