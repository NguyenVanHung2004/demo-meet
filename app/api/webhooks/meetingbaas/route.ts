
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { saveMeeting, Meeting, Speaker, Segment } from '@/app/lib/db';

// Force dynamic to prevent caching of webhook handling
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            console.error("[Webhook] Missing userId in query params");
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const body = await req.json();
        const { event, data } = body;

        console.log(`[Webhook] Received event: ${event} for Bot: ${data?.bot_id}`);

        if (event === 'failed') {
            console.error("[Webhook] Bot failed:", data.error);
            return NextResponse.json({ received: true });
        }

        if ((event === 'complete' || event === 'bot.completed') && data) {
            const { bot_id, speakers } = data;
            const mp4 = data.mp4;
            const transcript = data.transcript;

            // [FIX] Support V1 (mp4/transcript) and V2 (video/transcription url)
            const mp4Url = mp4 || data.video;
            let transcriptData = transcript;

            // If V2 returns a transcription URL, fetch it
            if (!transcriptData && data.transcription) {
                try {
                    console.log(`[Webhook] Fetching transcript from: ${data.transcription}`);
                    const tResponse = await fetch(data.transcription);
                    if (tResponse.ok) {
                        transcriptData = await tResponse.json();
                    }
                } catch (err) {
                    console.error("[Webhook] Failed to fetch transcript JSON:", err);
                }
            }

            // 1. Download MP4 File
            const fileName = `meetingbaas_${bot_id.split('-')[0]}.mp4`; // Shorten ID
            const uploadDir = path.join(process.cwd(), 'public', 'uploads');
            const filePath = path.join(uploadDir, fileName);

            // Ensure directory exists
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            console.log(`[Webhook] Downloading MP4 to ${filePath}...`);

            if (mp4Url) {
                try {
                    const response = await fetch(mp4Url);
                    if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

                    // Convert web ReadableStream to Node WritableStream
                    // @ts-ignore
                    const buffer = Buffer.from(await response.arrayBuffer());
                    fs.writeFileSync(filePath, buffer);
                    console.log("[Webhook] Download success!");
                } catch (err) {
                    console.error("[Webhook] Error downloading file:", err);
                }
            }

            // 2. Process Transcript -> Segments
            const mappedSegments: Segment[] = [];
            const speakerList: Speaker[] = (speakers || []).map((name: string, idx: number) => ({
                id: `SPEAKER_${idx.toString().padStart(2, '0')}`,
                name: name,
                color: "bg-indigo-100 text-indigo-700" // Default color
            }));

            // Helper to map speaker name back to our ID
            const getSpeakerId = (name: string) => {
                const s = speakerList.find(x => x.name === name);
                return s ? s.id : "SPEAKER_00";
            };

            if (transcriptData && Array.isArray(transcriptData)) {
                transcriptData.forEach((block: any) => {
                    // Block has { speaker: "Name", words: [...] }
                    // We can combine all words into one text or keep granule?
                    // Let's combine for readability as segments usually act as sentences/paragraphs

                    if (!block.words || block.words.length === 0) return;

                    const text = block.words.map((w: any) => w.word).join(" ");
                    const start = block.words[0].start;
                    const end = block.words[block.words.length - 1].end;

                    mappedSegments.push({
                        id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        speakerId: getSpeakerId(block.speaker),
                        text: text,
                        start: start,
                        end: end
                    });
                });
            }

            // 3. Save to DB
            const newMeeting: Meeting = {
                id: bot_id,
                userId: userId,
                title: `Meeting Report ${new Date().toLocaleDateString('vi-VN')}`, // Default title
                createdAt: Date.now(),
                duration: mappedSegments.length > 0 ? mappedSegments[mappedSegments.length - 1].end : 0,
                audioUrl: `/uploads/${fileName}`,
                segments: mappedSegments,
                speakers: speakerList,
                summary: "", // Will be generated later
                status: 'transcribed', // Ready for summary
                isDeleted: false
            };

            await saveMeeting(newMeeting);
            console.log(`[Webhook] Meeting saved: ${newMeeting.title}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[Webhook] Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
