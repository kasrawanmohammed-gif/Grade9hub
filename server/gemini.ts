import { GoogleGenAI, GenerateContentResponse, ThinkingLevel, Type } from '@google/genai';
import sharp from 'sharp';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export type TutorModelId = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

const ALLOWED_TUTOR_MODELS = new Set<TutorModelId>([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

export interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err || 'Gemini API request failed.');
  let extracted = raw;
  try {
    const jsonStart = raw.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error?.message) {
        extracted = parsed.error.message;
      }
    }
  } catch {
    // keep raw string
  }

  if (raw.includes('GEMINI_API_KEY')) {
    return new Error('GEMINI_API_KEY is not configured. Please check Settings > Secrets to use Science AI Studio.');
  }
  if (raw.includes('404') || raw.includes('NOT_FOUND')) {
    return new Error(`The selected AI model is temporarily unavailable (${extracted}). Please try again.`);
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return new Error('The Gemini API key does not have permission for this model. Please verify Settings > Secrets.');
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return new Error('Gemini API rate limit or quota reached. Please wait a moment and try again.');
  }
  return new Error(extracted);
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    const isTransient =
      msg.includes('500') ||
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('ECONNRESET') ||
      msg.includes('fetch failed');
    if (!isTransient) throw err;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return await fn();
  }
}

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TURN_CHARS = 1400;
const CONCISE_SI_RULE =
  'Grade 9 Science Tutor rules: Be accurate, clear, and concise. Always use standard international Latin SI unit symbols (N, kg, g, m, cm, s, m/s, m/s², J, W, Hz, Pa, °C, K, A, V, Ω) and ASCII digits (0-9) even in Kurdish or Arabic replies.';

function prepareChatContext(params: {
  model: string;
  systemInstruction: string;
  history: ChatHistoryTurn[];
}) {
  const selectedModel: TutorModelId = ALLOWED_TUTOR_MODELS.has(params.model as TutorModelId)
    ? (params.model as TutorModelId)
    : 'gemini-4-hydrogen';

  const recentSlice = Array.isArray(params.history)
    ? params.history.slice(-MAX_HISTORY_TURNS)
    : [];

  // Ensure history alternates user -> model cleanly and never ends with a dangling user turn
  const cleanTurns: ChatHistoryTurn[] = [];
  for (const turn of recentSlice) {
    const rawText = String(turn?.text || '').trim();
    const text =
      rawText.length > MAX_HISTORY_TURN_CHARS
        ? `${rawText.slice(0, MAX_HISTORY_TURN_CHARS)}…`
        : rawText;
    const role = turn?.role === 'model' ? 'model' : 'user';
    if (!text) continue;
    if (cleanTurns.length === 0 && role !== 'user') continue;
    const prev = cleanTurns[cleanTurns.length - 1];
    if (prev && prev.role === role) {
      prev.text = `${prev.text}\n${text}`;
    } else {
      cleanTurns.push({ role, text });
    }
  }
  if (cleanTurns.length > 0 && cleanTurns[cleanTurns.length - 1].role === 'user') {
    cleanTurns.pop();
  }

  const formattedHistory = cleanTurns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));

  const trimmedInstruction = String(params.systemInstruction || '').trim().slice(0, 600);
  const combinedSystemInstruction = trimmedInstruction
    ? `${trimmedInstruction}\n${CONCISE_SI_RULE}`
    : CONCISE_SI_RULE;

  return {
    selectedModel,
    formattedHistory,
    combinedSystemInstruction,
  };
}

export async function runTutorChat(params: {
  model: string;
  systemInstruction: string;
  history: ChatHistoryTurn[];
  message: string;
}): Promise<{ reply: string; model: TutorModelId }> {
  const { selectedModel, formattedHistory, combinedSystemInstruction } = prepareChatContext(params);

  try {
    const ai = getClient();

    const response: GenerateContentResponse = await withRetry(async () => {
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

      return await chat.sendMessage({
        message: params.message,
      });
    });

    return {
      reply: response.text?.trim() || 'I could not generate a response for that question.',
      model: selectedModel,
    };
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export async function* runTutorChatStream(params: {
  model: string;
  systemInstruction: string;
  history: ChatHistoryTurn[];
  message: string;
}): AsyncGenerator<{ chunk?: string; model: TutorModelId }> {
  const { selectedModel, formattedHistory, combinedSystemInstruction } = prepareChatContext(params);

  try {
    const ai = getClient();

    const streamResponse = await withRetry(async () => {
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

      return await chat.sendMessageStream({
        message: params.message,
      });
    });

    for await (const chunk of streamResponse) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        yield { chunk: c.text, model: selectedModel };
      }
    }
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export type ImageSizeOption = '1K' | '2K' | '4K';
export type AspectRatioOption = '1:1' | '16:9' | '4:3' | '3:4' | '9:16';

function getDiagramDimensions(size: ImageSizeOption, ratio: AspectRatioOption): {
  vw: number;
  vh: number;
  outWidth: number;
  outHeight: number;
} {
  const baseLongSide = size === '4K' ? 3840 : size === '2K' ? 2048 : 1024;
  const aspectMap: Record<AspectRatioOption, [number, number]> = {
    '1:1': [1, 1],
    '16:9': [16, 9],
    '4:3': [4, 3],
    '3:4': [3, 4],
    '9:16': [9, 16],
  };
  const [rw, rh] = aspectMap[ratio];
  const outWidth = rw >= rh ? baseLongSide : Math.round((baseLongSide * rw) / rh);
  const outHeight = rh >= rw ? baseLongSide : Math.round((baseLongSide * rh) / rw);

  const vw = 1200;
  const vh = Math.round((vw * rh) / rw);
  return { vw, vh, outWidth, outHeight };
}

function sanitizeSvg(rawSvg: string, vw: number, vh: number): string {
  let svg = rawSvg.trim();
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start === -1 || end === -1) {
    throw new Error('Could not build a valid SVG diagram.');
  }
  svg = svg.slice(start, end + 6);

  // Strip dangerous or unsupported elements/attributes
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;');

  if (!/xmlns\s*=/.test(svg)) {
    svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/viewBox\s*=/.test(svg)) {
    svg = svg.replace('<svg', `<svg viewBox="0 0 ${vw} ${vh}"`);
  }
  svg = svg.replace(/<svg([^>]*)>/, (_match, attrs: string) => {
    const cleaned = attrs
      .replace(/\swidth\s*=\s*(['"])[^'"]*\1/i, '')
      .replace(/\sheight\s*=\s*(['"])[^'"]*\1/i, '');
    return `<svg${cleaned} width="${vw}" height="${vh}">`;
  });

  return svg;
}

export async function generateStudyImage(params: {
  prompt: string;
  imageSize: string;
  aspectRatio: string;
}): Promise<{ imageUrl: string; caption?: string }> {
  const allowedSizes = new Set<ImageSizeOption>(['1K', '2K', '4K']);
  const allowedRatios = new Set<AspectRatioOption>(['1:1', '16:9', '4:3', '3:4', '9:16']);

  const imageSize: ImageSizeOption = allowedSizes.has(params.imageSize as ImageSizeOption)
    ? (params.imageSize as ImageSizeOption)
    : '1K';
  const aspectRatio: AspectRatioOption = allowedRatios.has(params.aspectRatio as AspectRatioOption)
    ? (params.aspectRatio as AspectRatioOption)
    : '1:1';

  const { vw, vh, outWidth, outHeight } = getDiagramDimensions(imageSize, aspectRatio);

  try {
    const ai = getClient();

    const response = await withRetry(async () =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a clean, textbook-quality Grade 9 Science educational diagram as an SVG for the following request:
"${params.prompt}"

Requirements:
1. Root element must be <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">.
2. Fill the entire background with a solid crisp light canvas (<rect width="${vw}" height="${vh}" fill="#FAF8F5"/>) and a subtle framing border.
3. Include a clear bold title at the top, well-proportioned vector geometry (shapes, light rays, forces, arrows, circuits, apparatus, scales, formulas, etc.), distinct scientific color coding, and readable callout labels with leader lines.
4. Use ONLY safe standard SVG primitives (<rect>, <circle>, <ellipse>, <line>, <polyline>, <polygon>, <path>, <text>, <tspan>, <g>, <defs>, <marker>, <linearGradient>, <stop>) and font-family="Arial, Helvetica, sans-serif". Do NOT use <foreignObject>, <image>, or <script>.
5. Keep all elements and text strictly inside margins (x between 40 and ${vw - 40}, y between 40 and ${vh - 40}) with zero overlapping text.
6. Also return a short 1-2 sentence educational caption summarizing the science concept shown.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              svg: {
                type: Type.STRING,
                description: `Complete standalone SVG markup starting with <svg and ending with </svg> using viewBox="0 0 ${vw} ${vh}".`,
              },
              caption: {
                type: Type.STRING,
                description: 'Brief 1-2 sentence scientific caption explaining the diagram.',
              },
            },
            required: ['svg', 'caption'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim()) as {
      svg?: string;
      caption?: string;
    };

    if (!parsed.svg) {
      throw new Error('The AI diagram generator did not return a valid diagram. Try refining your prompt.');
    }

    const cleanSvg = sanitizeSvg(parsed.svg, vw, vh);
    let imageUrl: string;
    try {
      const pngBuffer = await sharp(Buffer.from(cleanSvg, 'utf8'), {
        density: Math.max(72, Math.round((72 * outWidth) / vw)),
      })
        .resize(outWidth, outHeight, { fit: 'fill' })
        .png({ compressionLevel: 8 })
        .toBuffer();
      imageUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    } catch {
      imageUrl = `data:image/svg+xml;base64,${Buffer.from(cleanSvg, 'utf8').toString('base64')}`;
    }

    return {
      imageUrl,
      caption: parsed.caption?.trim() || undefined,
    };
  } catch (err) {
    throw formatGeminiError(err);
  }
}

