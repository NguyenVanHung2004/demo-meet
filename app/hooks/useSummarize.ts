"use client";
import { useCallback } from "react";
import { Meeting, updateMeetingProcess } from "../lib/db";
import { MEETING_STATUS } from "../lib/constants";
import { uploadAudioToFirebase, requestSummary } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useGlobalUI } from "../context/GlobalUIProvider";

export function useSummarize(onRefresh?: () => void) {
  const { user } = useAuth();
  const { toast } = useGlobalUI();

  return useCallback(async (
    meeting: Meeting,
    transcriptText: string,
    templateStructure?: string
  ) => {
    const isDraft = meeting.status === MEETING_STATUS.DRAFT;
    const meetingId = meeting.id;

    if (isDraft) {
      toast.info("Đang đồng bộ bản nháp lên Cloud trước khi tóm tắt...");
      try {
        const { getDraftFull } = await import("../lib/indexedDB");
        const draftFull = await getDraftFull(meetingId);
        if (draftFull) {
          const file = new File(
            [draftFull.audioBlob],
            `${draftFull.meta.title}.webm`,
            { type: "audio/webm" }
          );
          const url = await uploadAudioToFirebase(file, user?.uid || "");

          const finalMeeting = {
            ...draftFull.meta,
            audioUrl: url,
            status: MEETING_STATUS.SUMMARIZING,
            jobId: undefined,
          };
          const { saveMeeting } = await import("../lib/db");
          await saveMeeting(finalMeeting);
        }
      } catch (err) {
        toast.error("Lỗi đồng bộ bản nháp: " + (err as Error).message);
        return;
      }
    } else {
      await updateMeetingProcess(meetingId, { status: MEETING_STATUS.SUMMARIZING });
    }

    onRefresh?.();

    try {
      const summary = await requestSummary(
        transcriptText,
        templateStructure,
        meeting.objectives,
        meeting.createdAt,
        meeting.duration
      );

      await updateMeetingProcess(meetingId, {
        status: MEETING_STATUS.COMPLETED,
        summary: summary,
      });

      if (isDraft) {
        try {
          const { deleteDraft } = await import("../lib/indexedDB");
          await deleteDraft(meetingId);
        } catch (cleanupErr) {
          console.warn("Không thể xóa draft local:", cleanupErr);
        }
      }

      toast.success(`Đã tóm tắt xong cuộc họp!`);
    } catch (error) {
      console.error("Background Summary Error:", error);
      await updateMeetingProcess(meetingId, {
        status: MEETING_STATUS.FAILED,
        errorMessage: (error as Error).message,
      });
      toast.error("Lỗi tóm tắt ngầm: " + (error as Error).message);
    } finally {
      onRefresh?.();
    }
  }, [user, toast, onRefresh]);
}
