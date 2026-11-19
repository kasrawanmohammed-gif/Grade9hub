import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from '@google/genai';

type TutorModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

const ALLOWED_MODELS = new Set<TutorModelId>([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 1400;
const CONCISE_SI_RULE =
  'Grade 9 Science Tutor rules: Be accurate, clear, and concise. Always use standard international Latin SI unit symbols (N, kg, g, m, cm, s, m/s, m/s², J, W, Hz, Pa, °C, K, A, V, Ω) and ASCII digits (0-9) even in Kurdish or Arabic replies.';

interface RawTurn {
  role?: string;
  text?: string;
}

function buildCleanHistory(rawHistory: unknown) {
  const recent = Array.isArray(rawHistory) ? rawHistory.slice(-MAX_HISTORY_TURNS) : [];
  const clean: Array<{ role: 'user' | 'model'; text: string }> = [];

  for (const item of recent) {
    const turn = (item || {}) as RawTurn;
    const rawText = String(turn.text || '').trim();
    if (!rawText) continue;
    const text =
      rawText.length > MAX_HISTORY_TURN_CHARS
        ? `${rawText.slice(0, MAX_HISTORY_TURN_CHARS)}…`
        : rawText;
    const role = turn.role === 'model' ? 'model' : 'user';
    if (clean.length === 0 && role !== 'user') continue;
    const prev = clean[clean.length - 1];
    if (prev && prev.role === role) {
      prev.text = `${prev.text}\n${text}`;
    } else {
      clean.push({ role, text });
    }
  }

  if (clean.length > 0 && clean[clean.length - 1].role === 'user') {
    clean.pop();
  }

  return clean.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));
}

function formatError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');
  if (raw.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      message: 'GEMINI_API_KEY is not configured in server secrets.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'The configured Gemini API key lacks permission for this model.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return {
      status: 429,
      message: 'Gemini API rate limit reached. Please wait a moment and try again.',
    };
  }
  return { status: 500, message: raw };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          'GEMINI_API_KEY is not configured in server secrets. Add GEMINI_API_KEY to your deployment environment variables.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: {
    model?: unknown;
    systemInstruction?: unknown;
    history?: unknown;
    message?: unknown;
    stream?: unknown;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rawModel = String(body?.model || 'gemini-4-hydrogen');
  const selectedModel: TutorModelId = ALLOWED_MODELS.has(rawModel as TutorModelId)
    ? (rawModel as TutorModelId)
    : 'gemini-4-hydrogen';

  const message = String(body?.message || '').trim();
  if (!message) {
    return new Response(JSON.stringify({ error: 'Please enter a message for the AI tutor.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedInstruction = String(body?.systemInstruction || '').trim().slice(0, 600);
  const combinedSystemInstruction = trimmedInstruction
    ? `${trimmedInstruction}\n${CONCISE_SI_RULE}`
    : CONCISE_SI_RULE;

  const formattedHistory = buildCleanHistory(body?.history);
  const wantsStream =
    Boolean(body?.stream) ||
    (request.headers.get('accept') || '').toLowerCase().includes('text/event-stream');

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  if (wantsStream) {
    try {
      const chat = ai.chats.create({
        model: selectedModel,
        config: {
          systemInstruction: combinedSystemInstruction,
          ...(selectedModel === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
        history: formattedHistory,
      });

      const streamResponse = await chat.sendMessageStream({ message });
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let sentAny = false;
          try {
            for await (const chunk of streamResponse) {
              const c = chunk as GenerateContentResponse;
              if (c.text) {
                sentAny = true;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ chunk: c.text, model: selectedModel })}\n\n`
                  )
                );
              }
            }
            if (!sentAny) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    chunk: 'I could not generate a response for that question.',
                    model: selectedModel,
                  })}\n\n`
                )
              );
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, model: selectedModel })}\n\n`)
            );
          } catch (err) {
            const formatted = formatError(err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: formatted.message })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    } catch (err) {
      const formatted = formatError(err);
      return new Response(JSON.stringify({ error: formatted.message }), {
        status: formatted.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const chat = ai.chats.create({
      model: selectedModel,
      config: {
        systemInstruction: combinedSystemInstruction,
        ...(selectedModel === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      },
      history: formattedHistory,
    });

    const response = await chat.sendMessage({ message });
    return new Response(
      JSON.stringify({
        reply: response.text?.trim() || 'I could not generate a response for that question.',
        model: selectedModel,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const formatted = formatError(err);
    return new Response(JSON.stringify({ error: formatted.message }), {
      status: formatted.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
