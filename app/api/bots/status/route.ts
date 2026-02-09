
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMeetingById, Meeting, Speaker, Segment } from '@/app/lib/db';

// Force dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const botId = searchParams.get('botId');
        const userId = searchParams.get('userId');

        if (!botId || !userId) {
            return NextResponse.json({ error: "Missing botId or userId" }, { status: 400 });
        }

        const apiKey = process.env.MEETINGBAAS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server missing API Key" }, { status: 500 });
        }

        // 1. Check MeetingBaas Status
        const response = await fetch(`https://api.meetingbaas.com/v2/bots/${botId}`, {
            headers: { "x-meeting-baas-api-key": apiKey }
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch bot status" }, { status: response.status });
        }

        const data = await response.json();
        console.log(`[Polling] Raw BaaS Response for ${botId}:`, JSON.stringify(data));

        const botData = data.data || data; // Fallback just in case
        if (!botData || !botData.status) {
            console.error("[Polling] Invalid Bot Data:", botData);
            return NextResponse.json({ status: "error", error: "Invalid BaaS Response" });
        }
        const status = botData.status;

        // Check for failure: Call ended but never joined (Not Admitted / Timeout)
        // [RELAXED] Tạm bỏ check joined_at vì có trường hợp Bot vào rồi nhưng joined_at vẫn null
        /* if (botData.status === 'call_ended' && !botData.joined_at) {
            console.error("[Polling] Bot failed to join (joined_at is null)", botData);
            return NextResponse.json({
                status: 'failed',
                error: "Bot không vào được phòng (Có thể chưa được duyệt)."
            });
        } */

        // 2. If 'completed', try to save (Idempotent)
        if (status === 'completed' || status === 'call_ended') {
            console.log(`[Polling] Bot ${botId} completed. Processing data...`);

            const { mp4, video, mp3, audio, transcript, transcription, speakers } = botData;

            // Prioritize Audio -> Video
            const mediaUrl = mp3 || audio || video || mp4;

            // Detect extension from URL or default
            let extension = 'mp4';
            if (mediaUrl) {
                const urlPath = new URL(mediaUrl).pathname;
                const ext = path.extname(urlPath).replace('.', '');
                if (ext) extension = ext;
                else if (mp3 || audio) extension = 'mp3';
            }

            // [FIX] Nếu không có mediaUrl -> Đang xử lý media
            if (!mediaUrl) {
                if (status === 'call_ended') {
                    console.log("[Polling] Call ended but assets not ready. Waiting...");
                    return NextResponse.json({ status: 'processing', saved: false });
                }

                // Nếu status là 'completed' mà vẫn không có file -> Lỗi thật
                console.error("[Polling] Completed but no assets found:", botData);
                return NextResponse.json({
                    status: 'failed',
                    error: "Lỗi dữ liệu: Ghi âm không tồn tại."
                });
            }

            // [FIX] Kiểm tra trạng thái Transcription (nếu đang chạy thì chờ tiếp)
            if (botData.transcription_status === 'transcribing' || botData.transcription_status === 'queued') {
                console.log("[Polling] Transcription is processing...");
                return NextResponse.json({ status: 'transcribing', saved: false });
            }

            let transcriptData = transcript;

            // [FIX] Prioritize Raw Transcription (contains Word Timestamps) -> Then Transcription
            const transcriptUrl = botData.transcription || botData.raw_transcription;

            if (!transcriptData && transcriptUrl) {
                try {
                    console.log(`[Polling] Fetching transcript from: ${transcriptUrl}`);
                    const tResponse = await fetch(transcriptUrl);
                    if (tResponse.ok) {
                        transcriptData = await tResponse.json();
                    }
                } catch (err) {
                    console.error("[Polling] Failed to fetch transcript JSON:", err);
                }
            }

            // [VERCEL FIX] Không tải file về server -> Trả link S3 cho Client tự xử lý
            const finalAudioUrl = mediaUrl;

            // Map Segments
            let mappedSegments: Segment[] = [];

            // Generate initial speaker list from Bot Data
            let speakerList: Speaker[] = (speakers || []).map((s: any, idx: number) => ({
                id: `SPEAKER_${idx.toString().padStart(2, '0')}`,
                name: s.name || `Speaker ${idx + 1}`,
                color: "bg-indigo-100 text-indigo-700"
            }));

            // Helper to find or add speaker
            const getSpeakerId = (name: string) => {
                let sp = speakerList.find(x => x.name === name);
                if (!sp) {
                    // Auto-add new speaker if found in transcript but not in bot data
                    const newId = `SPEAKER_${speakerList.length.toString().padStart(2, '0')}`;
                    sp = { id: newId, name: name || "Unknown Speaker", color: "bg-gray-100 text-gray-700" };
                    speakerList.push(sp);
                }
                return sp.id;
            };

            // Parsing Logic
            // 1. Gladia Raw Format (User Provided): { transcriptions: [ { transcription: { utterances: [...] } } ] }
            if (transcriptData && Array.isArray(transcriptData.transcriptions) && transcriptData.transcriptions.length > 0) {
                const utterances = transcriptData.transcriptions[0]?.transcription?.utterances || [];

                utterances.forEach((utt: any) => {
                    const speakerName = (typeof utt.speaker !== 'undefined') ? `Speaker ${utt.speaker}` : "Unknown Speaker";
                    mappedSegments.push({
                        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        speakerId: getSpeakerId(String(utt.speaker) || speakerName),
                        text: utt.text,
                        start: utt.start,
                        end: utt.end,
                        words: Array.isArray(utt.words) ? utt.words.map((w: any) => ({
                            word: w.word,
                            start: w.start,
                            end: w.end,
                            confidence: w.confidence
                        })) : []
                    });
                });
            }
            // 2. Gladia V1 Format: { result: { utterances: [...] } }
            else if (transcriptData && transcriptData.result && Array.isArray(transcriptData.result.utterances)) {
                transcriptData.result.utterances.forEach((utt: any) => {
                    mappedSegments.push({
                        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        speakerId: getSpeakerId(utt.speaker),
                        text: utt.text,
                        start: utt.start,
                        end: utt.end,
                        words: Array.isArray(utt.words) ? utt.words.map((w: any) => ({
                            word: w.word,
                            start: w.start,
                            end: w.end,
                            confidence: w.confidence
                        })) : []
                    });
                });
            }
            // 3. Simple Array Format
            else if (transcriptData && Array.isArray(transcriptData)) {
                transcriptData.forEach((block: any) => {
                    if (!block.words || block.words.length === 0) return;
                    mappedSegments.push({
                        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        speakerId: getSpeakerId(block.speaker),
                        text: block.words.map((w: any) => w.word).join(" "),
                        start: block.words[0].start,
                        end: block.words[block.words.length - 1].end,
                        words: block.words
                    });
                });
            }

            // [NEW] Merge Consecutive Segments from the same Speaker
            if (mappedSegments.length > 0) {
                const merged: Segment[] = [];
                let current = mappedSegments[0];

                for (let i = 1; i < mappedSegments.length; i++) {
                    const next = mappedSegments[i];

                    // If same speaker and gap is small (e.g., < 2 seconds), merge them
                    // Or strictly same speaker? Usually same speaker is enough.
                    if (next.speakerId === current.speakerId) {
                        current.text += " " + next.text;
                        current.end = next.end;
                        // Merge words if they exist
                        if (next.words && next.words.length > 0) {
                            current.words = (current.words || []).concat(next.words);
                        }
                    } else {
                        merged.push(current);
                        current = next;
                    }
                }
                merged.push(current);
                mappedSegments = merged;
            }

            // Construct Meeting Object (BUT DO NOT SAVE)
            const meetingData: Meeting = {
                id: botId,
                userId: userId,
                title: `Meeting Report ${new Date().toLocaleDateString('vi-VN')}`,
                createdAt: Date.now(),
                duration: mappedSegments.length > 0 ? mappedSegments[mappedSegments.length - 1].end : botData.duration_seconds || 0,
                audioUrl: finalAudioUrl, // [FIX] Trả về link S3 để Client tự upload lên Firebase
                segments: mappedSegments,
                speakers: speakerList,
                summary: "",
                status: 'transcribed',
                isDeleted: false
            };

            return NextResponse.json({
                status: 'completed',
                shouldSave: true,
                meetingData: meetingData
            });
        }

        // Return current status if not complete
        return NextResponse.json({ status: status, saved: false });

    } catch (error: any) {
        console.error("[Polling] Error:", error);
        return NextResponse.json({ error: "Internal Error", details: error.message }, { status: 500 });
    }
}
