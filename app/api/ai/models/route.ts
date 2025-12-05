import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

  try {
    const res = await fetch(`${host}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: errorText || 'Failed to fetch models' },
        { status: 500 }
      );
    }

    const data = await res.json();
    // Ollama returns { models: [...] } where each model has { name, ... }
    const models = data.models?.map((m: { name: string }) => m.name) || [];
    
    return NextResponse.json({ models });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect to Ollama';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

