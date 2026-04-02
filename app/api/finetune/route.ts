import { NextResponse } from 'next/server';
import { collection, getDocs } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../lib/firebase";

// Cho phép trigger qua Cron Scheduler
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const RUNPOD_API_KEY = process.env.NEXT_PUBLIC_RUNPOD_API_KEY;
    const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_ENDPOINT_ID_FINE_TUNE;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO;

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return NextResponse.json({ error: "Missing RunPod API Key/Endpoint" }, { status: 500 });
    }

    console.log("[Finetune] 1. Fetching training data from Firestore...");
    const colRef = collection(db, "training_data");
    const snapshot = await getDocs(colRef);
    const samples = snapshot.docs.map(doc => doc.data());

    if (samples.length === 0) {
      return NextResponse.json({ message: "No training data available to finetune." });
    }

    console.log(`[Finetune] 2. Generaing JSONL for ${samples.length} samples...`);
    const jsonlContent = samples.map((sample: any) => JSON.stringify({
      audio_url: sample.audio_url,
      transcript: sample.transcript,
      duration_seconds: sample.duration_seconds
    })).join('\n');

    const timestamp = Date.now();
    const fileName = `finetune_exports/training_data_${timestamp}.jsonl`;
    const storageRef = ref(storage, fileName);

    console.log(`[Finetune] 3. Uploading to Firebase Storage: ${fileName}...`);
    await uploadString(storageRef, jsonlContent, 'raw', { contentType: 'application/jsonl' });
    const jsonlUrl = await getDownloadURL(storageRef);

    console.log(`[Finetune] 4. Triggering Runpod Finetune Job with URL: ${jsonlUrl}...`);
    const runpodPayload = {
      input: {
        action: "finetune", // Tùy chọn, thêm vào phòng hờ handler runpod dùng chung script
        jsonl_url: jsonlUrl,
        github_token: GITHUB_TOKEN,
        github_repo: GITHUB_REPO,
        num_epochs: 3
      }
    };

    const response = await fetch(`https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNPOD_API_KEY}`
      },
      body: JSON.stringify(runpodPayload)
    });

    const data = await response.json();

    if (data.id) {
      console.log(`[Finetune] ✅ Triggered Runpod successfully. Job ID: ${data.id}`);
      return NextResponse.json({
        success: true,
        jobId: data.id,
        samples_count: samples.length,
        jsonl_url: jsonlUrl
      });
    }

    throw new Error("RunPod Error: " + JSON.stringify(data));

  } catch (error: any) {
    console.error("[Finetune Error]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
