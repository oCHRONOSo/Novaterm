import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { prompt, model, stream, maxTokens } = await req.json();
  if (!prompt) return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });

  // Use 127.0.0.1 instead of localhost to avoid IPv6 issues, or use the configured host
  const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  
  // Add instruction for concise responses and limit tokens
  const maxTokensLimit = maxTokens || 150; // Default to 150 tokens (~100-120 words)
  const enhancedPrompt = `Please provide a minimal and concrete response. Be concise and to the point.\n\n${prompt}`;
  
  const body = {
    model: model || 'deepseek-coder:6.7b', // Default model
    prompt: enhancedPrompt,
    stream: stream !== false, // Default to true for streaming
    options: {
      num_predict: maxTokensLimit, // Limit the maximum number of tokens to generate
    },
  };

  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMessage = 'AI request failed';
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorText || 'AI request failed';
      } catch {
        errorMessage = errorText || 'AI request failed';
      }
      
      console.error('Ollama API error:', {
        status: res.status,
        statusText: res.statusText,
        error: errorMessage,
        host,
        model: body.model,
      });
      
      // Provide helpful error message for missing blob files or tensor errors
      let userFriendlyError = errorMessage;
      if (
        errorMessage.includes('CreateFile') || 
        errorMessage.includes('blobs') || 
        errorMessage.includes('sha256') ||
        errorMessage.includes('wrong number of tensors') ||
        errorMessage.includes('done_getting_tensors') ||
        errorMessage.includes('tensor')
      ) {
        userFriendlyError = `Model files appear to be corrupted or incomplete. Please re-pull the model:\n\n1. Click "Install Model" button above\n2. Enter: ${body.model}\n3. Click "Install Model" to re-download\n\nOr use command line: ollama pull ${body.model}`;
      }
      
      return NextResponse.json({ 
        error: userFriendlyError,
        details: `Status: ${res.status} ${res.statusText}`,
        originalError: errorMessage,
      }, { status: 500 });
    }

    // If streaming, pipe the response through
    if (body.stream && res.body) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming fallback
    const data = await res.json();
    
    if (!data.response) {
      console.error('Ollama response missing response field:', data);
      return NextResponse.json({ 
        error: 'Invalid response from AI service',
        details: 'Response object missing "response" field',
      }, { status: 500 });
    }
    
    return NextResponse.json({ response: data.response });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI error';
    console.error('Ollama fetch error:', err);
    return NextResponse.json({ 
      error: message,
      details: err instanceof Error ? err.stack : 'Unknown error',
    }, { status: 500 });
  }
}

