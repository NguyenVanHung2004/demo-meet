"use client";
import { useCallback } from "react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { Meeting } from "../lib/db";
import { sanitizeHtml } from "../lib/sanitizeHtml";

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const fmtDate = (ts: number) => new Date(ts).toLocaleString("vi-VN");

interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

const parseInline = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2] !== undefined) tokens.push({ text: match[2], bold: true, italic: true });
    else if (match[3] !== undefined) tokens.push({ text: match[3], bold: true });
    else if (match[4] !== undefined) tokens.push({ text: match[4], italic: true });
    else if (match[5] !== undefined) tokens.push({ text: match[5], bold: true });
    else if (match[6] !== undefined) tokens.push({ text: match[6], italic: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }
  return tokens;
};

const tokensToRuns = (tokens: InlineToken[]): TextRun[] =>
  tokens.map((t) => new TextRun({ text: t.text, bold: t.bold, italics: t.italic }));

const stripMarkdownMarkers = (text: string): string =>
  text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

const parseMarkdownToDocx = (md: string): Paragraph[] => {
  const lines = md.split(/\r?\n/);
  const children: Paragraph[] = [];
  let listBuffer: Paragraph[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      children.push(...listBuffer);
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) {
      flushList();
      continue;
    }

    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const bullet = line.match(/^\s*([-*+])\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);

    if (h1) {
      flushList();
      children.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(h1[1]))), heading: HeadingLevel.HEADING_1 }));
    } else if (h2) {
      flushList();
      children.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(h2[1]))), heading: HeadingLevel.HEADING_2 }));
    } else if (h3) {
      flushList();
      children.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(h3[1]))), heading: HeadingLevel.HEADING_3 }));
    } else if (bullet) {
      listBuffer.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(bullet[2]))), bullet: { level: 0 } }));
    } else if (numbered) {
      listBuffer.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(numbered[1]))), numbering: { reference: "summary-list", level: 0 } }));
    } else {
      flushList();
      children.push(new Paragraph({ children: tokensToRuns(parseInline(stripMarkdownMarkers(line))) }));
    }
  }
  flushList();
  return children;
};

const parseHtmlToDocx = (html: string): Paragraph[] => {
  const doc = new DOMParser().parseFromString(sanitizeHtml(html), "text/html");
  const body = doc.body;
  const children: Paragraph[] = [];

  const BLOCK_TAGS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "ul", "ol", "li", "blockquote", "hr",
    "div", "section", "article", "table", "thead", "tbody", "tr", "td", "th",
  ]);

  const walk = (node: ChildNode): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) children.push(new Paragraph({ text }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim() || "";

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const levelMap: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          h1: HeadingLevel.HEADING_1,
          h2: HeadingLevel.HEADING_2,
          h3: HeadingLevel.HEADING_3,
          h4: HeadingLevel.HEADING_4,
          h5: HeadingLevel.HEADING_5,
          h6: HeadingLevel.HEADING_6,
        };
        children.push(new Paragraph({ text, heading: levelMap[tag] }));
        return;
      }
      case "p":
        if (text) children.push(new Paragraph({ text }));
        return;
      case "li": {
        const parentTag = el.parentElement?.tagName.toLowerCase();
        const prefix = parentTag === "ol" ? "1. " : "• ";
        if (text) children.push(new Paragraph({ text: `${prefix}${text}` }));
        return;
      }
      case "blockquote":
        if (text) children.push(new Paragraph({ children: [new TextRun({ text, italics: true })], indent: { left: 400 } }));
        return;
      case "hr":
      case "br":
        children.push(new Paragraph({ text: "" }));
        return;
      case "ul":
      case "ol":
        el.childNodes.forEach(walk);
        return;
      default: {
        const hasBlockChild = Array.from(el.children).some(
          (c) => BLOCK_TAGS.has(c.tagName.toLowerCase())
        );
        if (hasBlockChild) {
          el.childNodes.forEach(walk);
        } else if (text) {
          children.push(new Paragraph({ text }));
        }
        return;
      }
    }
  };

  body.childNodes.forEach(walk);
  return children;
};

const parseSummaryToDocx = (summary: string): Paragraph[] => {
  if (!summary.trim()) return [];
  if (summary.trimStart().startsWith("<")) {
    return parseHtmlToDocx(summary);
  }
  return parseMarkdownToDocx(summary);
};

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
      const summaryChildren = meeting.summary?.trim()
        ? parseSummaryToDocx(meeting.summary)
        : [new Paragraph({ children: [new TextRun({ text: "Chưa có biên bản tóm tắt.", italics: true, color: "64748B" })] })];

      const doc = new Document({
        numbering: {
          config: [
            {
              reference: "summary-list",
              levels: [
                {
                  level: 0,
                  format: "decimal",
                  text: "%1.",
                  alignment: AlignmentType.LEFT,
                },
              ],
            },
          ],
        },
        sections: [{
          properties: {},
          children: [
            new Paragraph({ text: meeting.title, heading: HeadingLevel.HEADING_1 }),
            new Paragraph({
              text: `Ngày: ${fmtDate(meeting.createdAt)} | Thời lượng: ${fmtTime(meeting.duration)}`,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...summaryChildren,
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
    let container: HTMLDivElement | null = null;
    try {
      if (!meeting.summary?.trim()) {
        toast.error("Chưa có biên bản để xuất PDF");
        return;
      }
      const html2pdf = (await import("html2pdf.js")).default;

      container = document.createElement("div");
      container.id = "meeting-summary-pdf-export";
      container.style.cssText =
        "position:fixed;top:0;left:0;width:794px;padding:32px;box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,sans-serif;line-height:1.7;color:#1e293b;font-size:13px;background:#ffffff;z-index:-1;pointer-events:none;";
      container.innerHTML = `
        <h1 style="font-size:22px;font-weight:700;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin:0 0 6px;">${meeting.title.replace(/</g, "&lt;")}</h1>
        <p style="text-align:center;color:#64748b;font-size:12px;margin:4px 0 24px;">Ngày: ${fmtDate(meeting.createdAt)} | Thời lượng: ${fmtTime(meeting.duration)}</p>
        <div>${sanitizeHtml(meeting.summary)}</div>
      `;
      document.body.appendChild(container);

      const scrollY = window.scrollY || 0;
      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename: `${meeting.title}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            scrollX: 0,
            scrollY: -scrollY,
            windowWidth: 794,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(container)
        .save();
      toast.success("Đã xuất file .pdf");
    } catch {
      toast.error("Lỗi khi xuất file .pdf");
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
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
