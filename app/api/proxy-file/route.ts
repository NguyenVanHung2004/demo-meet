
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
        return new NextResponse('Missing URL parameter', { status: 400 });
    }

    try {
        // Fetch the remote file (server-side, bypassing CORS)
        const response = await fetch(url);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch remote file: ${response.statusText}`, { status: response.status });
        }

        // Stream the body directly to the client
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
                'Cache-Control': 'no-cache',
            },
        });
    } catch (error) {
        console.error('[Proxy] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
