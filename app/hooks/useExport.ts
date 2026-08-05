"use client";
import { useCallback } from "react";
import { saveAs } from "file-saver";
import { Meeting } from "../lib/db";
import { escapeHtml, summaryToHtml } from "../lib/docx/pdfRenderer";
import { buildSummaryDocx, parseSummaryToDocx } from "../lib/docx/parser";

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
      const nodes = parseSummaryToDocx(meeting.summary || "");
      const blob = await buildSummaryDocx(
        meeting.title,
        `Ngày: ${fmtDate(meeting.createdAt)} | Thời lượng: ${fmtTime(meeting.duration)}`,
        nodes
      );
      saveAs(blob, `${meeting.title}.docx`);
      toast.success("Đã xuất file .docx");
    } catch {
      toast.error("Lỗi khi xuất file .docx");
    }
  }, [meeting, toast]);

  const exportPdf = useCallback(async () => {
    let overlay: HTMLDivElement | null = null;
    try {
      if (!meeting.summary?.trim()) {
        toast.error("Chưa có biên bản để xuất PDF");
        return;
      }
      const html2pdf = (await import("html2pdf.js")).default;

      overlay = document.createElement("div");
      overlay.id = "meeting-summary-pdf-export";
      overlay.style.cssText =
        "position:fixed;inset:0;background:#e2e8f0;z-index:99999;overflow:auto;display:flex;justify-content:center;padding:24px;";
      overlay.innerHTML = `
        <div id="meeting-summary-pdf-content" style="width:794px;background:#ffffff;padding:40px 48px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.7;color:#1e293b;font-size:13px;">
          <h1 style="font-size:22px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin:0 0 6px;">${escapeHtml(meeting.title)}</h1>
          <p style="text-align:center;color:#64748b;font-size:12px;margin:4px 0 24px;">Ngày: ${fmtDate(meeting.createdAt)} | Thời lượng: ${fmtTime(meeting.duration)}</p>
          <div>${summaryToHtml(meeting.summary)}</div>
        </div>
      `;
      document.body.appendChild(overlay);

      const content = document.getElementById("meeting-summary-pdf-content") as HTMLDivElement;

      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename: `${meeting.title}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(content)
        .save();
      toast.success("Đã xuất file .pdf");
    } catch {
      toast.error("Lỗi khi xuất file .pdf");
    } finally {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
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
