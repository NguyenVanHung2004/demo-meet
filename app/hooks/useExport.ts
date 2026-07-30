"use client";
import { useCallback } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { Meeting } from "../lib/db";

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const fmtDate = (ts: number) => new Date(ts).toLocaleString("vi-VN");

export function useExport(meeting: Meeting, toast: { success: (m: string) => void; error: (m: string) => void }) {
  const exportTxt = useCallback(() => {
    try {
      const txt = meeting.segments
        .map((s) => `[${fmtTime(s.start)}] ${s.text}`)
        .join("\n");
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      saveAs(blob, `${meeting.title}.txt`);
      toast.success("Đã xuất file .txt");
    } catch {
      toast.error("Lỗi khi xuất file");
    }
  }, [meeting, toast]);

  const exportDocx = useCallback(async () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ text: meeting.title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Ngày: ${fmtDate(meeting.createdAt)} | Thời lượng: ${fmtTime(meeting.duration)}`, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            ...meeting.segments.map((s) =>
              new Paragraph({
                children: [
                  new TextRun({ text: `[${fmtTime(s.start)}] `, bold: true }),
                  new TextRun({ text: s.text }),
                ],
              })
            ),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meeting.title}.docx`);
      toast.success("Đã xuất file .docx");
    } catch {
      toast.error("Lỗi khi xuất file .docx");
    }
  }, [meeting, toast]);

  const exportPdf = useCallback(async () => {
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("meeting-content-export");
      if (!element) {
        toast.error("Không tìm thấy nội dung để xuất");
        return;
      }
      html2pdf().from(element).save(`${meeting.title}.pdf`);
      toast.success("Đã xuất file .pdf");
    } catch {
      toast.error("Lỗi khi xuất file .pdf");
    }
  }, [meeting, toast]);

  const downloadAudio = useCallback(async () => {
    if (!meeting.audioUrl) {
      toast.error("Không có file âm thanh");
      return;
    }
    try {
      const response = await fetch(meeting.audioUrl);
      const blob = await response.blob();
      saveAs(blob, `${meeting.title}.mp3`);
    } catch {
      toast.error("Lỗi khi tải audio");
    }
  }, [meeting, toast]);

  return { exportTxt, exportDocx, exportPdf, downloadAudio };
}
