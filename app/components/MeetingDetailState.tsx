"use client";

import React, { useCallback, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Meeting, updateMeetingProcess } from "../lib/db";
import type { Segment, Speaker } from "../lib/db";
import ReactMarkdown from "react-markdown";

import { Sparkles, User, Check } from "lucide-react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { useGlobalUI } from "../context/GlobalUIProvider";
import { useAuth } from "../context/AuthContext";
import { MeetingTemplate } from "../lib/templates";
import TemplateManagerModal from "./TemplateManagerModal";
import TranscriptRow from "./TranscriptRow";
import SummaryPanel from "./Meeting/SummaryPanel";
import TabSwitcher from "./Meeting/TabSwitcher";
import SpeakerFilter from "./Meeting/SpeakerFilter";
import MeetingHeader from "./Meeting/Header";
import MeetingAudioPlayer from "./Meeting/AudioPlayer";
import Breadcrumb from "./Breadcrumb";
export default function MeetingDetailState({
  meeting,
  audioSrc,
  onBack,
  onEdit,
  onSummarize,
  isReadOnly = false
}: {
  meeting: Meeting,
  audioSrc: string,
  onBack: () => void,
  onEdit: () => void,
  onSummarize?: (meeting: Meeting, text: string, templateStructure?: string) => void,
  isReadOnly?: boolean;
}) {
  const { toast, confirm } = useGlobalUI();
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(meeting.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');

  const [filteredSpeakerId, setFilteredSpeakerId] = useState<string | null>(null);

  // --- TEMPLATE STATE ---
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const handleShare = useCallback(async () => {
    const { generateMeetingShareToken } = await import('../lib/db');
    let shareId = meeting.shareToken;
    if (!shareId) {
      try {
        shareId = await generateMeetingShareToken(meeting.id);
        meeting.shareToken = shareId;
      } catch (e) {
        console.error("Lỗi sinh share token", e);
        shareId = meeting.id;
      }
    }
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Đã copy link chia sẻ: " + shareUrl);
  }, [meeting, toast]);

  const handleSummarizeRequest = useCallback((template: MeetingTemplate) => {
    if (!onSummarize) return;
    const fullText = meeting.segments.map((s: Segment) => {
      const name = meeting.speakers.find((sp: Speaker) => sp.id === s.speakerId)?.name || `Speaker ${s.speakerId.split('_')[1] || '00'}`;
      return `[${name}]: ${s.text}`;
    }).join("\n");
    onSummarize(meeting, fullText, template.structure);
    toast.info(`Đang tóm tắt theo mẫu: ${template.name}...`);
    setShowTemplateModal(false);
    onBack();
  }, [meeting, onSummarize, toast, onBack]);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number, y: number } | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // --- ACTIONS ---
  const scrollToSegment = useCallback((time: number) => {
    // Tìm segment gần nhất
    const segment = meeting.segments.find((s: Segment) => time >= s.start && (s.end ? time < s.end : time < s.start + 10))
      || [...meeting.segments].sort((a, b) => Math.abs(a.start - time) - Math.abs(b.start - time))[0];

    const targetTime = segment ? segment.start : time;

    // Cập nhật state để UI highlight segment (Karaoke)
    setCurrentTime(targetTime);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
    }

    // Thực hiện cuộn chỉ trong container cụ thể
    const element = document.getElementById(`segment-${targetTime}`);
    if (element && transcriptContainerRef.current) {
      const container = transcriptContainerRef.current;
      const targetScrollTop = element.offsetTop - (container.clientHeight / 4);

      // Cuộn trực tiếp bằng scrollTo, thử tắt smooth nếu vẫn bị lan truyền
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [meeting.segments]);

  // --- FORMATTERS ---
  const formatDate = useCallback((ts: number) => {
    return new Date(ts).toLocaleDateString("vi-VN", {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    if (!seconds || isNaN(seconds) || !Number.isFinite(seconds)) return "0p 0s";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}p ${s}s`;
  }, []);

  const formatTimeCode = useCallback((s: number) => {
    if (!s || isNaN(s) || !Number.isFinite(s)) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }, []);

  // Helper chọn màu Speaker
  const getActiveWordIndex = useCallback((segment: Segment) => {
    if (!isPlaying || !segment.words) return -1;
    return segment.words.findIndex(w => currentTime >= w.start && currentTime <= (w.end + 0.15));
  }, [currentTime, isPlaying]);

  const getSpeakerStyle = useCallback((speakerId: string) => {
    const id = parseInt(speakerId.split('_')[1] || '0');
    const colors = [
      'bg-indigo-100 text-indigo-700 ring-indigo-200',
      'bg-emerald-100 text-emerald-700 ring-emerald-200',
      'bg-orange-100 text-orange-700 ring-orange-200',
      'bg-pink-100 text-pink-700 ring-pink-200',
      'bg-cyan-100 text-cyan-700 ring-cyan-200',
    ];
    return colors[id % colors.length];
  }, []);

  // --- AUDIO CONTROL ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.playbackRate = playbackRate; // Đảm bảo rate đúng khi load mới
    }
  }, [audioSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;

    if (filteredSpeakerId && isPlaying) {
      const time = audioRef.current.currentTime;
      // Tìm xem hiện tại đang ở segment nào (dự phòng thêm 2s nếu end bị undefined)
      const currentSeg = meeting.segments.find(s => time >= s.start && time < (s.end || s.start + 2));

      if (currentSeg && currentSeg.speakerId === filteredSpeakerId) {
        // Đang nằm trong câu nói của người được lọc -> Bình thường
      } else {
        // Đang ở đoạn của người khác HOẶC đang ở khoảng trắng (gap)
        // Tìm câu gần nhất của người được lọc ở tương lai
        const nextTargetSeg = meeting.segments.find(s => s.start > time && s.speakerId === filteredSpeakerId);
        if (nextTargetSeg) {
          audioRef.current.currentTime = nextTargetSeg.start;
        } else {
          // Nếu không còn câu nào của người này nữa -> Tạm dừng
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }
    }

    setCurrentTime(audioRef.current.currentTime);
  }, [filteredSpeakerId, isPlaying, meeting.segments]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d)) setDuration(d);
    }
  }, []);

  // Helper logic for extracting smart copy format
  const getSmartCopyText = useCallback((selection: Selection, container: HTMLElement): string | null => {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

    const allSmartTexts = Array.from(container.querySelectorAll('.smart-copy-text')) as HTMLElement[];
    const selectedSegments = allSmartTexts.filter(el => selection.containsNode(el, true));

    if (selectedSegments.length === 0) return null;

    let resultText = "";

    // Thử lấy thời gian chính xác của từ đầu tiên được bôi đen
    let preciseStartTimestamp: string | null = null;
    try {
      const firstSelectedContainer = selectedSegments[0];
      if (firstSelectedContainer) {
        const allSpans = Array.from(firstSelectedContainer.querySelectorAll('span[data-word-start]')) as HTMLElement[];
        const firstSelectedSpan = allSpans.find(span => selection.containsNode(span, true));

        if (firstSelectedSpan) {
          const startSecs = parseFloat(firstSelectedSpan.getAttribute('data-word-start') || "0");
          const m = Math.floor(startSecs / 60);
          const sec = Math.floor(startSecs % 60);
          preciseStartTimestamp = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }
      }
    } catch (e) { }

    if (selectedSegments.length === 1) {
      // Trường hợp 1: Copy trong phạm vi 1 segment
      const el = selectedSegments[0];
      const speaker = el.getAttribute('data-speaker');
      const timestamp = preciseStartTimestamp || el.getAttribute('data-timestamp');
      // Dùng selection.toString() để lấy đúng phần text đang được bôi đen
      const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
      resultText = `[${timestamp}] ${speaker}: "${selectedText}"`;
    } else {
      // Trường hợp 2: Copy xuyên qua nhiều segment
      selectedSegments.forEach((el, idx) => {
        const speaker = el.getAttribute('data-speaker');
        const timestamp = (idx === 0 && preciseStartTimestamp) ? preciseStartTimestamp : el.getAttribute('data-timestamp');
        // Chuẩn hóa khoảng trắng để tránh lỗi "mất space"
        const content = (el.textContent || "").replace(/\s+/g, ' ').trim();
        resultText += `[${timestamp}] ${speaker}: "${content}"${idx < selectedSegments.length - 1 ? "\n" : ""}`;
      });
    }

    // Thêm thông tin nguồn
    const meetingTitle = meeting.title;
    const meetingDate = new Date(meeting.createdAt).toLocaleDateString('vi-VN');
    resultText += `\n\nNguồn: Biên bản họp ${meetingTitle} - ${meetingDate}`;

    return resultText;
  }, [meeting.title, meeting.createdAt]);

  // --- SMART COPY LOGIC (Auto Copy on MouseUp) ---
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;

    // Khi người dùng thả chuột sau khi bôi đen
    const handleMouseUp = async () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        if (!showCopySuccess) setTooltipPos(null);
        return;
      }

      if (!container.contains(selection.anchorNode)) {
        if (!showCopySuccess) setTooltipPos(null);
        return;
      }

      // 1. Tính toán vị trí hiển thị Tooltip
      let newTooltipPos = null;
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
          newTooltipPos = {
            x: rect.left + rect.width / 2,
            y: rect.top + window.scrollY
          };
        }
      } catch (e) {
        return;
      }

      // 2. Thực hiện auto-copy
      const text = getSmartCopyText(selection, container);
      if (text && newTooltipPos) {
        try {
          // Bắt buộc copy luôn không cần bấm nút
          await navigator.clipboard.writeText(text);
          setTooltipPos(newTooltipPos);
          setShowCopySuccess(true);
        } catch (err) {
          console.error("Auto copy failed:", err);
          setTooltipPos(newTooltipPos);
          setShowCopySuccess(false); // Hiện nút "Smart Copy" fallback nếu writeText bị chặn
        }
      }
    };

    // Chuột xuống = bắt đầu bôi cái mới => ẩn ngay tooltip cũ
    const handleMouseDown = () => {
      setTooltipPos(null);
      setShowCopySuccess(false);
    };

    // Ctrl+C thủ công bằng phím
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      const text = getSmartCopyText(selection, container);
      if (text) {
        e.preventDefault();
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', text);
        }
        setShowCopySuccess(true);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('copy', handleCopy);
    };
  }, [meeting.id, meeting.title, meeting.createdAt, getSmartCopyText]);

  const jumpToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const skipTime = useCallback((seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, [duration]);

  const togglePlaybackRate = useCallback(() => {
    const rates = [0.5, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIdx]);
  }, [playbackRate]);

  const handleDownloadAudio = useCallback(() => {
    // audioSrc là Blob URL, file-saver sẽ tải nó về máy
    saveAs(audioSrc, `${meeting.title.replace(/\s+/g, "_")}.mp3`);
  }, [audioSrc, meeting.title]);

  const handleExport = useCallback(() => {
    try {
      // 1. Tạo nội dung file
      let content = `TIÊU ĐỀ: ${meeting.title}\n`;
      content += `NGÀY: ${new Date(meeting.createdAt).toLocaleString('vi-VN')}\n`;
      content += `THỜI LƯỢNG: ${formatDuration(meeting.duration)}\n`;
      content += `------------------------------------------------\n\n`;

      if (meeting.summary) {
        const cleanSummary = meeting.summary.replace(/\[\d{1,2}:\d{2}(:\d{2})?\]\s*/g, '');
        content += `[TÓM TẮT AI]\n${cleanSummary}\n\n`;
        content += `------------------------------------------------\n\n`;
      }

      content += `[NỘI DUNG CHI TIẾT]\n`;
      meeting.segments.forEach(seg => {
        const time = formatTimeCode(seg.start);
        // const speaker = seg.speakerId.replace("SPEAKER_", "Speaker ");
        const matchedSpeaker = meeting.speakers.find(s => s.id === seg.speakerId);
        content += `[${time}] ${matchedSpeaker?.name}: ${seg.text}\n`;
      });

      // 2. Tạo Blob và tải về
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${meeting.title.replace(/\s+/g, "_")}_transcript.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Lỗi khi xuất file");
    }
  }, [meeting, formatTimeCode]);
  // 2. Xuất Biên bản (.docx) - Mới
  const handleExportDocx = useCallback(async () => {
    if (!meeting.summary) return alert("Chưa có nội dung tóm tắt để xuất!");

    try {
      const lines = meeting.summary.split('\n');
      const children: Paragraph[] = [];

      // --- TITLE ---
      children.push(
        new Paragraph({
          text: meeting.title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 } // Cách dưới 1 chút
        })
      );

      // --- METADATA ---
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Thời gian: ", bold: true }),
            new TextRun(new Date(meeting.createdAt).toLocaleString('vi-VN')),
          ],
          spacing: { after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Thời lượng: ", bold: true }),
            new TextRun(formatDuration(meeting.duration)),
          ],
          spacing: { after: 400 } // Cách đoạn dưới xa hơn
        }),
        new Paragraph({
          text: "BIÊN BẢN TÓM TẮT",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        })
      );

      // --- CONTENT PARSER ---
      lines.forEach(line => {
        // Xóa các mốc thời gian dạng [00:00] hoặc [00:00:00]
        const text = line.trim().replace(/\[\d{1,2}:\d{2}(:\d{2})?\]\s*/g, '');
        if (!text) return;

        if (text.startsWith('# ')) {
          // H1
          children.push(new Paragraph({
            text: text.replace('# ', ''),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }));
        } else if (text.startsWith('## ')) {
          // H2
          children.push(new Paragraph({
            text: text.replace('## ', ''),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
          }));
        } else if (text.startsWith('### ')) {
          // H3
          children.push(new Paragraph({
            text: text.replace('### ', ''),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 150, after: 100 }
          }));
        } else if (text.startsWith('* ') || text.startsWith('- ')) {
          // [FIX LỖI NHIỀU CHẤM]
          // 1. Xóa ký tự * hoặc - ở đầu
          const cleanText = text.replace(/^[*|-]\s+/, '');

          // 2. Xử lý in đậm (**text**)
          const parts = cleanText.split('**');
          const runs = parts.map((part, index) =>
            new TextRun({ text: part, bold: index % 2 !== 0 })
          );

          // 3. Tạo đoạn văn bình thường nhưng có THỤT LỀ (indent)
          // Thay vì dùng bullet: { level: 0 }
          children.push(new Paragraph({
            children: runs,
            indent: { left: 400 }, // Thụt vào khoảng 0.7cm (400 twips)
            spacing: { after: 100 } // Dãn dòng nhẹ
          }));
        } else {
          // Văn bản thường
          const parts = text.split('**');
          const runs = parts.map((part, index) =>
            new TextRun({ text: part, bold: index % 2 !== 0 })
          );
          children.push(new Paragraph({
            children: runs,
            spacing: { after: 200 }
          }));
        }
      });

      // Tạo Document
      const doc = new Document({
        sections: [{
          properties: {},
          children: children,
        }],
      });

      // Xuất file
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${meeting.title.replace(/\s+/g, "_")}_summary.docx`);
      // setShowExportMenu moved to MeetingHeader
    } catch (e) {
      console.error(e);
      alert("Lỗi khi tạo file DOCX");
    }
  }, [meeting, formatDuration]);

  // --- LOGIC XUẤT PDF (Đã Fix lỗi khoảng trắng lớn) ---
  const handleExportPdf = useCallback(async () => {
    if (!meeting.summary) return alert("Chưa có nội dung tóm tắt để xuất!");

    try {
      document.body.style.cursor = 'wait';

      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = document.getElementById('export-summary-content');
      if (!element) {
        document.body.style.cursor = 'default';
        return alert("Không tìm thấy nội dung");
      }

      // 1. Tạo bản sao (Clone)
      const clone = element.cloneNode(true) as HTMLElement;
      document.body.appendChild(clone);

      // 2. Thiết lập thông số kỹ thuật (Khổ A4)
      const A4_WIDTH_PX = 800;
      const A4_HEIGHT_PX = 1131; // (297mm / 210mm) * 800px

      clone.style.width = `${A4_WIDTH_PX}px`;
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      clone.style.opacity = '1';
      clone.style.backgroundColor = '#ffffff';

      // 3. THUẬT TOÁN DÀN TRANG (SMART PAGINATION)
      // Bỏ 'div', 'ul', 'ol' ra khỏi danh sách để tránh đẩy cả khối lớn đi.
      const selector = 'h1, h2, h3, h4, h5, h6, p, li, img, blockquote, pre, table';
      const children = Array.from(clone.querySelectorAll(selector)) as HTMLElement[];

      // Chờ render
      await new Promise(resolve => setTimeout(resolve, 50));

      for (const child of children) {
        if (!child.offsetParent) continue;

        // Bỏ qua nếu thẻ này nằm trong một thẻ 'li' hoặc 'table' khác đã được xử lý
        // (Tránh tính toán 2 lần cho cùng 1 nội dung)
        if (child.closest('li') !== child && child.closest('li') !== null) continue;

        const childTop = child.offsetTop;
        const childHeight = child.offsetHeight;
        const childBottom = childTop + childHeight;

        // Tính trang
        const startPage = Math.floor(childTop / A4_HEIGHT_PX) + 1;
        const endPage = Math.floor(childBottom / A4_HEIGHT_PX) + 1;

        // Nếu thẻ bị cắt ngang giữa 2 trang
        if (endPage > startPage) {
          // Tính vị trí đường cắt trang
          const pageBreakLine = startPage * A4_HEIGHT_PX;

          // Đẩy thẻ xuống trang tiếp theo (+30px lề trên cho đẹp)
          const pushDown = pageBreakLine - childTop + 30;

          child.style.marginTop = `${pushDown}px`;

          // [Tùy chọn] Nếu là tiêu đề (Hx), có thể đẩy thêm một chút để không sát mép
          if (/^H\d$/.test(child.tagName)) {
            child.style.marginTop = `${pushDown + 10}px`;
          }
        }
      }

      // 4. Chụp ảnh
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX
      });

      // 5. Dọn dẹp
      document.body.removeChild(clone);

      // 6. Tạo PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const totalPdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let heightLeft = totalPdfHeight;
      let position = 0;

      // Trang 1
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight);
      heightLeft -= pdfHeight;

      // Các trang sau
      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalPdfHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${meeting.title.replace(/\s+/g, "_")}_summary.pdf`);
      document.body.style.cursor = 'default';
      // setShowExportMenu moved to MeetingHeader

    } catch (e) {
      console.error(e);
      document.body.style.cursor = 'default';
      alert("Lỗi khi tạo PDF.");
    }
  }, [meeting, formatDuration]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans relative">
      {/* --- HIDDEN CONTENT FOR PDF EXPORT --- */}
      <div
        id="export-summary-content"
        className="fixed top-0 left-[-9999px] w-[800px] -z-50 opacity-0"
        style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif', padding: '60px', boxSizing: 'border-box' }}
      >
        <div>
          {/* Header File PDF */}
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '10px', color: '#000' }}>
              {meeting.title}
            </h1>
            <div style={{ fontSize: '14px', color: '#555', display: 'flex', justifyContent: 'center', gap: '20px' }}>
              <span> Thời gian {new Date(meeting.createdAt).toLocaleString('vi-VN')}</span>
              <span> Thời lượng {formatDuration(meeting.duration)}</span>
            </div>
          </div>

          {/* Nội dung tóm tắt - Đã bỏ dấu chấm và căn chỉnh đẹp */}
          <div className="prose prose-lg max-w-none text-justify" style={{ color: '#333' }}>
            <ReactMarkdown
              components={{
                // Tiêu đề
                h1: ({ node, ...props }) => <h1 style={{ color: '#111827', marginTop: '24px', marginBottom: '16px', fontSize: '20px', fontWeight: 'bold', pageBreakInside: 'avoid' }} {...props} />,
                h2: ({ node, ...props }) => <h2 style={{ color: '#4f46e5', marginTop: '20px', marginBottom: '12px', fontSize: '16px', fontWeight: 'bold', pageBreakInside: 'avoid' }} {...props} />,
                h3: ({ node, ...props }) => <h3 style={{ color: '#374151', marginTop: '16px', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', pageBreakInside: 'avoid' }} {...props} />,

                // Đoạn văn
                p: ({ node, ...props }) => {
                  // @ts-ignore
                  const isInList = node.parent?.tagName === 'li';
                  // Nếu nằm trong list thì dùng span để không vỡ layout Flex
                  if (isInList) {
                    return <span style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151' }} {...props} />
                  }
                  return <p style={{ color: '#374151', lineHeight: '1.6', fontSize: '14px', marginBottom: '10px' }} {...props} />
                },

                // UL: Bỏ chấm mặc định, thêm padding để thụt lề
                ul: ({ node, ...props }) => (
                  <ul style={{ padding: 0, margin: 0, paddingLeft: '15px', marginBottom: '10px', listStyle: 'none' }} {...props} />
                ),
                // OL: Bỏ số mặc định, thêm padding (Số sẽ tự render bằng logic bên dưới)
                ol: ({ node, ...props }) => (
                  <ol style={{ padding: 0, margin: 0, paddingLeft: '15px', marginBottom: '10px', listStyle: 'none', counterReset: 'item' }} {...props} />
                ),

                // LI: Xử lý dấu đầu dòng
                li: ({ node, ...props }) => {
                  // @ts-ignore
                  const isOrdered = node.parent?.tagName === 'ol';

                  return (
                    <li style={{
                      display: 'flex',
                      alignItems: 'flex-start', // Căn dòng chữ thẳng với đầu dòng
                      marginBottom: '6px',
                      counterIncrement: isOrdered ? 'item' : undefined
                    }}>
                      {/* LOGIC QUAN TRỌNG: 
                                        - Nếu là OL (có thứ tự) -> Hiện số (1. 2. 3.)
                                        - Nếu là UL (không thứ tự) -> Ẩn hoàn toàn (không hiện gì cả)
                                    */}
                      {isOrdered && (
                        <span style={{
                          width: '24px', // Cố định chiều rộng cột số
                          flexShrink: 0,
                          display: 'inline-block',
                          textAlign: 'left',
                          fontWeight: 'bold',
                          color: '#000',
                        }}>
                          <span style={{ content: 'counter(item) "."' }}></span>
                        </span>
                      )}

                      {/* Nội dung chính của dòng */}
                      <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>
                        {props.children}
                      </div>
                    </li>
                  );
                },
                strong: ({ node, ...props }) => <strong style={{ color: '#000000', fontWeight: 'bold' }} {...props} />
              }}
            >
              {meeting.summary ? meeting.summary.replace(/\[\d{1,2}:\d{2}(:\d{2})?\]\s*/g, '') : "Chưa có nội dung tóm tắt."}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/" },
          { label: meeting?.title || "Cuộc họp" },
        ]}
      />

      <MeetingHeader
        meeting={meeting}
        isReadOnly={isReadOnly}
        showTemplateBtn={!!onSummarize}
        onBack={onBack}
        onEdit={onEdit}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        onShare={handleShare}
        onDownloadAudio={handleDownloadAudio}
        onExportTxt={handleExport}
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        formatDate={formatDate}
        formatDuration={formatDuration}
      />

      <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 3. MAIN CONTENT (Có thể cuộn) */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

        {/* COLUMN 1: TRANSCRIPT */}
        <div
          ref={transcriptContainerRef}
          className={`flex-1 overflow-y-auto bg-white md:border-r ${activeTab === 'transcript' ? 'block' : 'hidden md:block'}`}
        >
          <SpeakerFilter
            speakers={meeting.speakers}
            filteredSpeakerId={filteredSpeakerId}
            onFilterChange={setFilteredSpeakerId}
          />

          <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 pb-32 relative">
            {meeting.segments.map((seg, idx) => {
              // Tạo object speaker chuẩn format cho TranscriptRow
              // 1. Tìm speaker tương ứng trong danh sách meeting.speakers
              const matchedSpeaker = meeting.speakers.find(s => s.id === seg.speakerId);

              // 2. Tạo object speaker (Ưu tiên lấy từ DB, nếu không thấy mới fallback về mặc định)
              const speakerInfo = {
                id: seg.speakerId,
                // Lấy tên từ DB, nếu null/undefined thì mới dùng logic "Speaker 01"
                name: matchedSpeaker ? matchedSpeaker.name : `Speaker ${seg.speakerId.split('_')[1] || '00'}`,
                // Lấy màu từ DB luôn cho đồng bộ với màn Edit
                color: matchedSpeaker ? matchedSpeaker.color : getSpeakerStyle(seg.speakerId)
              };

              return (
                <div
                  key={idx}
                  id={`segment-${seg.start}`}
                  className={filteredSpeakerId && seg.speakerId !== filteredSpeakerId ? 'opacity-30 grayscale transition-all duration-300' : 'transition-all duration-300'}
                >
                    <TranscriptRow
                      segment={seg}
                      speaker={speakerInfo}
                      allSpeakers={meeting.speakers}

                      isActive={currentTime >= seg.start && currentTime < (seg.end || seg.start + 10)}
                      isAudioPlaying={isPlaying}
                      activeWordIndex={getActiveWordIndex(seg)}

                      onTogglePlay={togglePlay}
                      onSeek={jumpToTime}

                      onTextChange={() => { }}
                      onSpeakerChange={() => { }}
                      onSplit={() => { }}
                      onMerge={() => { }}
                      onAddRow={() => { }}
                      onTimeChange={() => { }}
                    />
                </div>
              );
            })}

          </div>
        </div>

        <SummaryPanel
          meeting={meeting}
          isReadOnly={isReadOnly}
          activeTab={activeTab}
          onEdit={onEdit}
          onScrollToSegment={scrollToSegment}
        />

      </div>

      <MeetingAudioPlayer
        audioRef={audioRef}
        audioSrc={audioSrc}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onTogglePlay={togglePlay}
        onSkip={skipTime}
        onRateChange={togglePlaybackRate}
        onSeek={(t) => { setCurrentTime(t); if (audioRef.current) audioRef.current.currentTime = t; }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        formatTimeCode={formatTimeCode}
      />

      {/* Smart Copy Tooltip */}
      {tooltipPos && (
        <div
          className="fixed z-[100] -translate-x-1/2 -translate-y-full mb-3 shadow-2xl pointer-events-auto"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 12
          }}
        >
          {showCopySuccess ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-emerald-500/20 shadow-lg animate-in fade-in zoom-in-95 duration-200 border border-emerald-500">
              <Check className="w-4 h-4 text-white" />
              Đã copy
            </div>
          ) : (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                // Fallback nếu auto-copy failed
                const selection = window.getSelection();
                if (selection && transcriptContainerRef.current) {
                  const txt = getSmartCopyText(selection, transcriptContainerRef.current);
                  if (txt) {
                    await navigator.clipboard.writeText(txt);
                    setShowCopySuccess(true);
                  }
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 animate-in fade-in zoom-in-95 duration-200 border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Smart Copy
            </button>
          )}
          {/* Mũi tên trỏ xuống */}
          <div className={`w-2.5 h-2.5 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b ${showCopySuccess ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-900 border-slate-700'}`}></div>
        </div>
      )}

      {/* ------------------- TEMPLATE MANAGER MODAL ------------------- */}
      <TemplateManagerModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSelectTemplate={handleSummarizeRequest}
        actionText="Tóm tắt lại theo mẫu này"
        actionIcon="sparkles"
      />
    </div>
  );
}
