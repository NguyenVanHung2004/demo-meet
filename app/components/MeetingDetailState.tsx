"use client";

import React, { useState, useRef, useEffect } from "react";
import { Meeting } from "../lib/db";
import ReactMarkdown from 'react-markdown';
import {
  Play, Pause, ChevronLeft, Edit3, Calendar,
  Clock, Download, FileText, Sparkles, User, AlignLeft, Share2,
  FileType, Music
} from "lucide-react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import TranscriptRow from "./TranscriptRow";
export default function MeetingDetailState({
  meeting,
  audioSrc,
  onBack,
  onEdit
}: {
  meeting: Meeting,
  audioSrc: string,
  onBack: () => void,
  onEdit: () => void
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(meeting.duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript');

  // State cho menu xuất file
  const [showExportMenu, setShowExportMenu] = useState(false);

  // --- AUDIO CONTROL ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [audioSrc]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (Number.isFinite(d)) setDuration(d);
    }
  };

  const jumpToTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // [MỚI] Hàm tải Audio
  const handleDownloadAudio = () => {
    // audioSrc là Blob URL, file-saver sẽ tải nó về máy
    saveAs(audioSrc, `${meeting.title.replace(/\s+/g, "_")}.mp3`);
    setShowExportMenu(false);
  };

  // --- LOGIC XUẤT FILE (MỚI) ---
  const handleExport = () => {
    try {
      // 1. Tạo nội dung file
      let content = `TIÊU ĐỀ: ${meeting.title}\n`;
      content += `NGÀY: ${new Date(meeting.createdAt).toLocaleString('vi-VN')}\n`;
      content += `THỜI LƯỢNG: ${formatDuration(meeting.duration)}\n`;
      content += `------------------------------------------------\n\n`;

      if (meeting.summary) {
        content += `[TÓM TẮT AI]\n${meeting.summary}\n\n`;
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
  };
  // 2. Xuất Biên bản (.docx) - Mới
  const handleExportDocx = async () => {
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
        const text = line.trim();
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
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
      alert("Lỗi khi tạo file DOCX");
    }
  };

  // --- LOGIC XUẤT PDF (Đã Fix lỗi khoảng trắng lớn) ---
  const handleExportPdf = async () => {
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
      // [QUAN TRỌNG] Chỉ chọn các thẻ "lá" (leaf nodes) để xử lý cắt trang.
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
      setShowExportMenu(false);

    } catch (e) {
      console.error(e);
      document.body.style.cursor = 'default';
      alert("Lỗi khi tạo PDF.");
    }
  };
  // --- FORMATTERS ---
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("vi-VN", {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !Number.isFinite(seconds)) return "0p 0s";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}p ${s}s`;
  };

  const formatTimeCode = (s: number) => {
    if (!s || isNaN(s) || !Number.isFinite(s)) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Helper chọn màu Speaker
  const getSpeakerStyle = (speakerId: string) => {
    const id = parseInt(speakerId.split('_')[1] || '0');
    const colors = [
      'bg-indigo-100 text-indigo-700 ring-indigo-200',
      'bg-emerald-100 text-emerald-700 ring-emerald-200',
      'bg-orange-100 text-orange-700 ring-orange-200',
      'bg-pink-100 text-pink-700 ring-pink-200',
      'bg-cyan-100 text-cyan-700 ring-cyan-200',
    ];
    return colors[id % colors.length];
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans relative">
      {/* --- HIDDEN CONTENT FOR PDF EXPORT --- */}
      <div
        id="export-summary-content"
        className="fixed top-0 left-[-9999px] w-[800px] p-16 -z-50 opacity-0"
        style={{ backgroundColor: '#ffffff', color: '#000000', fontFamily: 'Arial, Helvetica, sans-serif' }}
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
              {meeting.summary || "Chưa có nội dung tóm tắt."}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* 1. HEADER */}
      <div className="bg-white border-b px-4 py-3 md:px-6 md:py-4 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition shrink-0">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold text-slate-800 truncate pr-2">{meeting.title}</h1>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(meeting.createdAt)}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDuration(meeting.duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 relative">
          {/* EXPORT DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2 md:px-4 md:py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> <span className="hidden md:inline">Tải xuống</span>
            </button>

            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <button onClick={handleDownloadAudio} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 font-medium border-b border-slate-50">
                    <Music className="w-4 h-4 text-pink-500" /> Audio
                  </button>
                  <button onClick={handleExport} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 text-slate-700 border-b border-slate-50">
                    <FileText className="w-4 h-4 text-slate-400" /> Nội dung thô (.txt)
                  </button>
                  <button onClick={handleExportDocx} className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 flex items-center gap-3 text-indigo-700 font-medium">
                    <FileType className="w-4 h-4" /> Bản tóm tắt (.docx)
                  </button>
                  <button onClick={handleExportPdf} className="w-full text-left px-4 py-3 text-sm hover:bg-orange-50 flex items-center gap-3 text-orange-700 font-medium">
                    <FileType className="w-4 h-4" /> Bản tóm tắt (.pdf)
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={onEdit}
            className="px-3 py-2 md:px-5 md:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-md shadow-indigo-200 flex items-center gap-2 transition"
          >
            <Edit3 className="w-4 h-4" /> <span className="hidden md:inline">Sửa</span>
          </button>
        </div>
      </div>

      {/* 2. TABS NAVIGATION (Sticky) - Chỉ hiện trên Mobile */}
      <div className="md:hidden flex bg-white border-b sticky top-0 z-10 shrink-0">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border-b-2 
            ${activeTab === 'transcript' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <AlignLeft className="w-4 h-4" /> Nội dung
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all border-b-2
            ${activeTab === 'summary' ? 'border-orange-500 text-orange-700 bg-orange-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
        >
          <Sparkles className="w-4 h-4" /> Tóm tắt
        </button>
      </div>

      {/* 3. MAIN CONTENT (Có thể cuộn) */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">

        {/* COLUMN 1: TRANSCRIPT */}
        <div className={`flex-1 overflow-y-auto bg-white md:border-r scroll-smooth ${activeTab === 'transcript' ? 'block' : 'hidden md:block'}`}>
          <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6 pb-32">
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
                <TranscriptRow
                  key={idx}
                  segment={seg}
                  speaker={speakerInfo}
                  allSpeakers={meeting.speakers} // Truyền danh sách speaker (nếu có)

                  // Truyền biến quan trọng để Karaoke hoạt động
                  isActive={currentTime >= seg.start && currentTime < (seg.end || seg.start + 10)}
                  isAudioPlaying={isPlaying}
                  currentTime={currentTime} // <--- QUAN TRỌNG NHẤT

                  onTogglePlay={togglePlay}
                  onSeek={jumpToTime}

                  // Vì đây là trang Xem (Read-only), ta truyền hàm rỗng cho các chức năng sửa
                  // Nếu muốn sửa, người dùng sẽ bấm nút "Sửa" trên Header để sang trang EditorState
                  onTextChange={() => { }}
                  onSpeakerChange={() => { }}
                  onSplit={() => { }}
                  onMerge={() => { }}
                  onAddRow={() => { }}
                  onTimeChange={() => { }}
                />
              );
            })}

          </div>
        </div>

        {/* COLUMN 2: SUMMARY & METADATA */}
        <div className={`md:w-[400px] bg-slate-50 flex flex-col shrink-0 ${activeTab === 'summary' ? 'flex flex-1' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-32">

            {/* Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-5">
              <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-orange-50">
                <Sparkles className="w-4 h-4" /> AI Tóm tắt
              </h3>
              {meeting.summary ? (
                <div className="prose prose-sm text-slate-700 prose-headings:text-indigo-700 prose-strong:text-slate-900 leading-relaxed text-justify max-w-none">
                  <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Sparkles className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm italic">Chưa có tóm tắt nào.</p>
                  <button onClick={onEdit} className="mt-3 text-xs text-indigo-600 hover:underline font-medium">Tạo ngay trong Edit</button>
                </div>
              )}
            </div>

            {/* Metadata (Desktop Only) */}
            <div className="bg-white rounded-xl shadow-sm border p-5 hidden md:block">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Metadata</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-mono font-medium text-slate-700">{formatTimeCode(meeting.duration)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-100 pb-2">
                  <span className="text-slate-500">Segments</span>
                  <span className="font-mono font-medium text-slate-700">{meeting.segments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Format</span>
                  <span className="font-mono font-medium uppercase text-slate-700">AUDIO</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* 4. FOOTER AUDIO PLAYER (Sticky Bottom) */}
      <div className="bg-white border-t p-3 md:p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-3 md:gap-4">
          <button
            onClick={togglePlay}
            className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition shadow-lg shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 pl-1" />}
          </button>

          <div className="flex-1 flex flex-col justify-center gap-1">
            <div className="flex justify-between text-[10px] md:text-xs font-medium text-slate-500">
              <span>{formatTimeCode(currentTime)}</span>
              <span>{formatTimeCode(duration)}</span>
            </div>

            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentTime(t);
                if (audioRef.current) audioRef.current.currentTime = t;
              }}
              className="w-full h-1.5 md:h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
            />
          </div>

          <audio
            ref={audioRef}
            src={audioSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      </div>

    </div>
  );
}