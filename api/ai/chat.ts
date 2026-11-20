import { GoogleGenAI, GenerateContentResponse, ThinkingLevel } from '@google/genai';

type TutorModelId = 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen';

const DEFAULT_MODEL: TutorModelId = 'gemini-3.1-flash-lite';
const ALLOWED_MODELS = new Set<TutorModelId>([
  'gemini-3.1-flash-lite',
  'gemini-4-hydrogen',
]);

const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_TURN_CHARS = 650;
const MAX_MESSAGE_CHARS = 2000;
const MAX_SYSTEM_INSTRUCTION_CHARS = 240;
const UPSTREAM_IDLE_TIMEOUT_MS = 24000;
const KEEPALIVE_INTERVAL_MS = 4000;

const CONCISE_SI_RULE =
  'Grade 9 Science Tutor: give clear, concise answers (about 120-200 words unless asked for more). Use Latin SI symbols (N, kg, m, s, m/s, m/s², J, W, Hz, Pa, °C, K, A, V, Ω) and digits 0-9.';

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

function buildChatConfig(selectedModel: TutorModelId, systemInstruction: string, abortSignal?: AbortSignal) {
  if (selectedModel === 'gemini-3.1-flash-lite') {
    return {
      systemInstruction,
      maxOutputTokens: 700,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      ...(abortSignal ? { abortSignal } : {}),
    };
  }
  return {
    systemInstruction,
    maxOutputTokens: 1200,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    ...(abortSignal ? { abortSignal } : {}),
  };
}

function formatError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');
  let extracted = raw;
  try {
    const jsonStart = raw.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string };
      };
      if (parsed?.error?.message) {
        extracted = parsed.error.message;
      }
    }
  } catch {
    // keep raw message
  }

  if (raw.includes('GEMINI_API_KEY')) {
    return {
      status: 503,
      message: 'GEMINI_API_KEY is not configured in server secrets.',
    };
  }
  if (
    raw.toLowerCase().includes('timed out') ||
    raw.toLowerCase().includes('timeout') ||
    (err instanceof DOMException && err.name === 'AbortError')
  ) {
    return {
      status: 504,
      message: 'The AI response timed out. Please try again or use Gemini 3.1 Flash Lite.',
    };
  }
  if (raw.includes('404') || raw.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: `The selected AI model is temporarily unavailable (${extracted}). Please try again.`,
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
  return { status: 500, message: extracted };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204 });
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

  const rawModel = String(body?.model || DEFAULT_MODEL);
  const selectedModel: TutorModelId = ALLOWED_MODELS.has(rawModel as TutorModelId)
    ? (rawModel as TutorModelId)
    : DEFAULT_MODEL;

  const message = String(body?.message || '').trim().slice(0, MAX_MESSAGE_CHARS);
  if (!message) {
    return new Response(JSON.stringify({ error: 'Please enter a message for the AI tutor.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedInstruction = String(body?.systemInstruction || '')
    .trim()
    .slice(0, MAX_SYSTEM_INSTRUCTION_CHARS);
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
    const encoder = new TextEncoder();
    const upstreamController = new AbortController();
    let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    let clientAborted = false;

    const cleanup = () => {
      if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
        keepaliveTimer = null;
      }
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const onRequestAbort = () => {
      clientAborted = true;
      cleanup();
      upstreamController.abort();
    };
    request.signal?.addEventListener('abort', onRequestAbort, { once: true });

    const stream = new ReadableStream({
      async start(controller) {
        let sentAny = false;
        let closed = false;

        const safeEnqueue = (chunkText: string) => {
          if (closed || clientAborted) return;
          try {
            controller.enqueue(encoder.encode(chunkText));
          } catch {
            // stream already closed
          }
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          cleanup();
          request.signal?.removeEventListener('abort', onRequestAbort);
          try {
            controller.close();
          } catch {
            // already closed
          }
        };

        const resetIdleTimer = () => {
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => {
            timedOut = true;
            upstreamController.abort();
          }, UPSTREAM_IDLE_TIMEOUT_MS);
        };

        // Flush stream headers + opening comment immediately so Vercel starts streaming at 0ms
        safeEnqueue(`: stream-open\n\n`);
        keepaliveTimer = setInterval(() => {
          safeEnqueue(`: ping\n\n`);
        }, KEEPALIVE_INTERVAL_MS);
        resetIdleTimer();

        try {
          const chat = ai.chats.create({
            model: selectedModel,
            config: buildChatConfig(
              selectedModel,
              combinedSystemInstruction,
              upstreamController.signal
            ),
            history: formattedHistory,
          });

          const streamResponse = await chat.sendMessageStream({
            message,
            config: { abortSignal: upstreamController.signal },
          });

          for await (const chunk of streamResponse) {
            if (clientAborted || timedOut) break;
            resetIdleTimer();
            const c = chunk as GenerateContentResponse;
            if (c.text) {
              sentAny = true;
              safeEnqueue(
                `data: ${JSON.stringify({ chunk: c.text, model: selectedModel })}\n\n`
              );
            }
          }

          if (timedOut) {
            safeEnqueue(
              `data: ${JSON.stringify({
                error: 'The AI response timed out. Please try again or use Gemini 3.1 Flash Lite.',
              })}\n\n`
            );
            return;
          }

          if (!clientAborted) {
            if (!sentAny) {
              safeEnqueue(
                `data: ${JSON.stringify({
                  chunk: 'I could not generate a response for that question.',
                  model: selectedModel,
                })}\n\n`
              );
            }
            safeEnqueue(
              `data: ${JSON.stringify({ done: true, model: selectedModel })}\n\n`
            );
          }
        } catch (err) {
          if (!clientAborted) {
            const formatted = timedOut
              ? {
                  message:
                    'The AI response timed out. Please try again or use Gemini 3.1 Flash Lite.',
                }
              : formatError(err);
            safeEnqueue(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
          }
        } finally {
          safeClose();
        }
      },
      cancel() {
        onRequestAbort();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const nonStreamController = new AbortController();
  const nonStreamTimer = setTimeout(() => nonStreamController.abort(), UPSTREAM_IDLE_TIMEOUT_MS);
  const onAbort = () => nonStreamController.abort();
  request.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const chat = ai.chats.create({
      model: selectedModel,
      config: buildChatConfig(selectedModel, combinedSystemInstruction, nonStreamController.signal),
      history: formattedHistory,
    });

    const response = await chat.sendMessage({
      message,
      config: { abortSignal: nonStreamController.signal },
    });
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
  } finally {
    clearTimeout(nonStreamTimer);
    request.signal?.removeEventListener('abort', onAbort);
  }
}
