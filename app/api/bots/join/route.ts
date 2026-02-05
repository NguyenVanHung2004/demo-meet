
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { meetingUrl, botName, botImage, userId } = await req.json();

        if (!meetingUrl) {
            return NextResponse.json({ error: "Missing meetingUrl" }, { status: 400 });
        }
        if (!userId) {
            return NextResponse.json({ error: "Missing userId" }, { status: 400 });
        }

        const apiKey = process.env.MEETINGBAAS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "Server missing MEETINGBAAS_API_KEY" }, { status: 500 });
        }

        // Tự động nhận diện URL (Localhost vs Vercel vs Production)
        let appUrl = process.env.NEXT_PUBLIC_APP_URL;

        // Nếu không có APP_URL thủ công, thử lấy từ biến môi trường Vercel (chưa bao gồm https://)
        if (!appUrl && process.env.VERCEL_URL) {
            appUrl = `https://${process.env.VERCEL_URL}`;
        }

        // Nếu vẫn không có (chạy local chưa config), thử lấy từ Request Origin
        if (!appUrl) {
            const host = req.headers.get("host"); // VD: localhost:3000
            const protocol = host?.includes("localhost") ? "http" : "https";
            appUrl = host ? `${protocol}://${host}` : "http://localhost:3000";
        }

        // const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const webhookUrl = `${appUrl}/api/webhooks/meetingbaas?userId=${userId}`;

        console.log("Dispatching Bot to:", meetingUrl);
        console.log("Webhook Return Addr:", webhookUrl);

        const response = await fetch("https://api.meetingbaas.com/v2/bots", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-meeting-baas-api-key": apiKey,
            },
            body: JSON.stringify({
                meeting_url: meetingUrl,
                bot_name: botName || "DemoMeet Bot",
                bot_image: botImage || "https://i.imgur.com/8f1c8C6.png", // Ảnh Bot mặc định
                recording_mode: "speaker_view", // Hoặc "gallery_view"
                entry_message: "Hello, I am recording this meeting for notes.", // [FIX] Sửa bot_entry_message -> entry_message
                speech_to_text: {
                    provider: "Default", // Dùng provider mặc định của họ
                },
                automatic_leave: {
                    waiting_room_timeout: 600, // 10 phút chờ
                },
                webhook_url: webhookUrl, // Quan trọng: Webhook để nhận kết quả
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetails;
            try {
                errorDetails = JSON.parse(errorText);
            } catch (e) {
                errorDetails = errorText; // Use raw text if not JSON
            }
            console.error("MeetingBaas Error:", response.status, errorDetails);
            return NextResponse.json({
                error: "Failed to join meeting",
                details: errorDetails,
                statusCode: response.status
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({ success: true, botId: data.bot_id });

    } catch (error: any) {
        console.error("Internal Error:", error);
        return NextResponse.json({
            error: "Internal Server Error",
            details: error?.message || String(error),
            stack: error?.stack
        }, { status: 500 });
    }
}
