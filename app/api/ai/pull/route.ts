import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { model } = await req.json();
  if (!model) return NextResponse.json({ error: 'Missing model name' }, { status: 400 });

  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

  try {
    const res = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText || 'Failed to pull model' },
        { status: 500 }
      );
    }

    // Stream the pull progress
    if (res.body) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect to Ollama';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

