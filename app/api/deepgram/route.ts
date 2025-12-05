import { createClient } from "@deepgram/sdk";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.DEEPGRAM_API_KEY || !process.env.DEEPGRAM_PROJECT_ID) {
    return NextResponse.json({ error: "Thiếu cấu hình API Key hoặc Project ID" }, { status: 500 });
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const projectId = process.env.DEEPGRAM_PROJECT_ID; // Lấy luôn từ env, không cần gọi API hỏi nữa

  try {
    // Chỉ gọi đúng 1 API để tạo key -> Nhanh hơn gấp đôi
    const { result: newKey, error: keyError } = await deepgram.manage.createProjectKey(projectId, {
      comment: "Temporary User Key",
      scopes: ["usage:write"],
      tags: ["nextjs-streaming"],
      expiration_date: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    if (keyError) throw keyError;
    if (!newKey) throw new Error("Empty key response");

    return NextResponse.json({ key: newKey.key });
    
  } catch (error) {
    console.error("Deepgram Error:", error);
    return NextResponse.json({ error: "Lỗi tạo key" }, { status: 500 });
  }
}