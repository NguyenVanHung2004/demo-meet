"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Database, Play, Pause, DownloadCloud, Clock, Info } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getAllTrainingSamples, TrainingDataSample } from "../lib/trainingData";

export default function TrainingDataPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [samples, setSamples] = useState<TrainingDataSample[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, loading]);

  const fetchData = async () => {
    setIsLoadingData(true);
    const data = await getAllTrainingSamples();
    setSamples(data);
    setIsLoadingData(false);
  };

  const togglePlay = (sample: TrainingDataSample) => {
    if (playingId === sample.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(sample.audio_url);
      newAudio.onended = () => setPlayingId(null);
      newAudio.play();
      audioRef.current = newAudio;
      setPlayingId(sample.id);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) return <div className="p-8 text-center bg-slate-50 min-h-screen">Đang xác thực...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* HEADER */}
      <header className="bg-white border-b px-4 py-3 md:px-6 md:py-4 flex items-center justify-between sticky top-0 z-10 gap-2 shadow-sm">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full text-slate-500 transition shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-1.5 md:gap-2 truncate">
              <Database className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 shrink-0" />
              <span className="truncate">Training Data</span>
            </h1>
            <p className="text-[10px] md:text-xs text-slate-500 truncate hidden sm:block">
              Quản lý dữ liệu thu thập (Audio - Text) để huấn luyện mô hình ASR
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100">
            Tổng cộng: {samples.length} mẫu
          </div>
          {/* Button export JSONL nếu sau này cần */}
          <button
            onClick={() => {
              const dataStr = samples.map(s => JSON.stringify(s)).join("\\n");
              const blob = new Blob([dataStr], { type: "application/jsonl" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `training_data_${Date.now()}.jsonl`;
              a.click();
            }}
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 md:px-4 py-2 rounded-lg font-medium flex items-center gap-1.5 md:gap-2 text-sm shadow-sm transition"
          >
            <DownloadCloud className="w-4 h-4" /> <span className="hidden sm:inline">Export JSONL</span>
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 overflow-hidden flex flex-col gap-6">
        {/* Hướng dẫn sử dụng */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 items-start shrink-0">
          <div className="bg-blue-100/50 p-2.5 rounded-xl shrink-0 text-blue-600">
            <Info className="w-6 h-6" />
          </div>
          <div className="space-y-3 flex-1 text-sm text-slate-700">
            <h2 className="font-bold text-base text-slate-800">Hướng dẫn sử dụng Dữ liệu Huấn luyện</h2>
            <p>
              Hệ thống tự động thu thập các đoạn âm thanh và văn bản (đã được bạn chỉnh sửa chính xác)
              mỗi khi bạn nhấn <span className="font-semibold text-slate-800">Lưu biên bản</span>. Dữ liệu này được dùng để Fine-tune các mô hình ASR (Speech-to-Text).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="bg-white p-4 rounded-xl border border-blue-100/50 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-2">Định dạng Export (chuẩn Mozilla Common Voice )</h3>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 ml-1">
                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">audio_url</code>:
                    Link tải file âm thanh định dạng WAV (16-bit PCM), dùng để huấn luyện hoặc kiểm tra mô hình ASR
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">transcript</code>:
                    Nhãn văn bản chính xác (Ground Truth) tương ứng với nội dung audio
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">duration_seconds</code>:
                    Thời lượng đoạn âm thanh (tính bằng giây), hữu ích để lọc hoặc phân tích dataset
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">start_time</code>:
                    Thời điểm bắt đầu của segment trong file audio gốc (đơn vị: giây)
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">end_time</code>:
                    Thời điểm kết thúc của segment trong file audio gốc
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">original_asr</code>:
                    Kết quả nhận dạng ban đầu từ hệ thống ASR (trước khi được người dùng chỉnh sửa)
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">language</code>:
                    Ngôn ngữ của đoạn audio (ví dụ: "vi" cho tiếng Việt)
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">source</code>:
                    Nguồn dữ liệu, ví dụ <span className="italic">user_correction</span> nghĩa là transcript đã được người dùng chỉnh sửa
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">segment_id</code>:
                    ID của đoạn audio (segment) trong một meeting
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">meeting_id</code>:
                    ID của toàn bộ cuộc họp chứa segment này
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">created_at</code>:
                    Timestamp (milliseconds) thời điểm segment được tạo
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">audio_format</code>:
                    Định dạng file audio (ví dụ: wav)
                  </li>

                  <li>
                    <code className="bg-slate-100 text-pink-600 px-1 py-0.5 rounded">id</code>:
                    ID duy nhất của segment (thường là kết hợp giữa meeting_id và segment_id)
                  </li>
                </ul>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100/50 shadow-sm">
                <h3 className="font-semibold text-slate-800 mb-2">Cách thức Pipeline</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Dữ liệu có thể dùng cho nhiều mục đích. Bạn có thể tải thẳng file JSONL về, tải các file audio từ URL, sau đó chuẩn bị manifest để train các mô hình, có thể dùng để huấn luyện bất cứ mô hình ngôn ngữ nào.
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoadingData ? (
          <div className="text-center py-12 text-slate-400">Đang tải biểu dữ liệu...</div>
        ) : samples.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm mt-4">
            <Database className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 mb-2 font-medium">Chưa có dữ liệu huấn luyện nào được thu thập.</p>
            <p className="text-slate-400 text-sm">Chỉnh sửa và lưu transcript trong cuộc họp để đóng góp dữ liệu.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
            <div className="overflow-x-auto flex-1 h-0">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 min-w-[120px]">Audio Clip</th>
                    <th className="px-4 py-3 min-w-[400px]">Ground Truth</th>
                    <th className="px-4 py-3 w-40 text-right">Thu thập lúc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {samples.map((sample) => {
                    const isPlaying = playingId === sample.id;
                    return (
                      <tr key={sample.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-4 align-top">
                          <button
                            onClick={() => togglePlay(sample)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all shadow-sm ${isPlaying
                              ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                              }`}
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span className="font-mono text-xs font-semibold">{sample.duration_seconds}s</span>
                          </button>
                          <div className="text-[10px] text-slate-400 mt-2 font-mono truncate max-w-[100px]" title={sample.id}>
                            {sample.id.split('__')[1] || sample.id}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="text-slate-800 font-medium leading-relaxed">{sample.transcript}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 text-slate-500 text-xs">
                            <Clock className="w-3 h-3" />
                            {formatDate(sample.created_at)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
