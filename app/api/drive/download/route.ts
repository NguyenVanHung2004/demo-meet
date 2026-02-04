
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
        return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('google_access_token')?.value;

    if (!accessToken) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    try {
        const fetchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!fetchRes.ok) {
            throw new Error(`Drive Download Error: ${fetchRes.statusText}`);
        }

        // Stream the response back to the client
        return new NextResponse(fetchRes.body, {
            headers: {
                'Content-Type': fetchRes.headers.get('Content-Type') || 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileId}"`,
            }
        });

    } catch (error: any) {
        console.error("Download Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
