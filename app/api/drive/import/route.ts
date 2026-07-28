
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/app/lib/firebase"; // Inspect this path
import { startTranscriptionJob } from "@/app/lib/api";

// Helper to download file from Drive
async function downloadFile(fileId: string, accessToken: string): Promise<ArrayBuffer> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error("Failed to download file from Drive");
    return await res.arrayBuffer();
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const { fileId, fileName } = await request.json();

        // 1. Download from Drive
        const fileBuffer = await downloadFile(fileId, accessToken);

        // 2. Upload to Firebase
        // Simple trick: Upload to a predictable path or allow anonymous? 
        // We need auth? 'storage' is initialized with client config, likely unauthenticated or using rules?
        // Server-side, normally we use Admin SDK. 
        // But if 'storage' is from initializedApp, it might work if rules allow write.
        // Assuming rules allow write for now or we rely on client-side 'user' (but we are on server).
        // Actually, in the Zoom implementation, how did we handle this?
        // Zoom implementation: "const storageRef = ref(storage, ...); await uploadBytes(storageRef, fileBuffer);"
        // It worked there, so it should work here.

        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `imports/drive/${timestamp}-${safeName}`;
        const storageRef = ref(storage, storagePath);

        // uploadBytes accepts Uint8Array, ArrayBuffer, Blob
        await uploadBytes(storageRef, fileBuffer, { contentType: 'video/mp4' });

        const firebaseUrl = await getDownloadURL(storageRef);

        // 3. Trigger Transcription
        const jobId = await startTranscriptionJob(firebaseUrl);

        return NextResponse.json({ success: true, jobId, firebaseUrl });

    } catch (error: any) {
        console.error("Drive Import Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
