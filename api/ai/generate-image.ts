import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

type AspectRatioOption = '1:1' | '16:9' | '4:3' | '3:4' | '9:16';

function getViewportDimensions(ratio: AspectRatioOption): { vw: number; vh: number } {
  const aspectMap: Record<AspectRatioOption, [number, number]> = {
    '1:1': [1, 1],
    '16:9': [16, 9],
    '4:3': [4, 3],
    '3:4': [3, 4],
    '9:16': [9, 16],
  };
  const [rw, rh] = aspectMap[ratio] || [1, 1];
  const vw = 1200;
  const vh = Math.round((vw * rh) / rw);
  return { vw, vh };
}

function sanitizeSvg(rawSvg: string, vw: number, vh: number): string {
  let svg = rawSvg.trim();
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start === -1 || end === -1) {
    throw new Error('Could not build a valid SVG diagram.');
  }
  svg = svg.slice(start, end + 6);
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

  let body: { prompt?: unknown; aspectRatio?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prompt = String(body?.prompt || '').trim();
  if (!prompt) {
    return new Response(
      JSON.stringify({
        error: 'Please describe the scientific diagram or illustration you want to generate.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawRatio = String(body?.aspectRatio || '1:1');
  const allowedRatios = new Set<AspectRatioOption>(['1:1', '16:9', '4:3', '3:4', '9:16']);
  const aspectRatio: AspectRatioOption = allowedRatios.has(rawRatio as AspectRatioOption)
    ? (rawRatio as AspectRatioOption)
    : '1:1';
  const { vw, vh } = getViewportDimensions(aspectRatio);

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Create a clean, textbook-quality Grade 9 Science educational diagram as an SVG for:
"${prompt}"
Requirements:
1. Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">.
2. Light background canvas (<rect width="${vw}" height="${vh}" fill="#FAF8F5"/>) and subtle border.
3. Bold title, clean scientific vector shapes/arrows/apparatus, distinct colors, readable callouts within margins (40..${vw - 40}, 40..${vh - 40}).
4. Safe standard SVG primitives only (no script, foreignObject, image).
5. Return 1-2 sentence caption.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            svg: { type: Type.STRING },
            caption: { type: Type.STRING },
          },
          required: ['svg', 'caption'],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim()) as {
      svg?: string;
      caption?: string;
    };
    if (!parsed.svg) {
      throw new Error('The AI diagram generator did not return a valid diagram.');
    }

    const cleanSvg = sanitizeSvg(parsed.svg, vw, vh);
    const base64Svg = Buffer.from(cleanSvg, 'utf8').toString('base64');

    return new Response(
      JSON.stringify({
        imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
        caption: parsed.caption?.trim() || undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Diagram generation failed.';
    let status = 500;
    let error = raw;
    if (raw.includes('GEMINI_API_KEY')) {
      status = 503;
      error = 'GEMINI_API_KEY is not configured in server secrets.';
    } else if (raw.includes('404') || raw.includes('NOT_FOUND')) {
      status = 404;
      error = 'The selected AI model is temporarily unavailable. Please try again.';
    } else if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
      status = 403;
      error = 'The configured Gemini API key lacks permission for this model.';
    } else if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
      status = 429;
      error = 'Gemini API rate limit reached. Please wait a moment and try again.';
    }
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
