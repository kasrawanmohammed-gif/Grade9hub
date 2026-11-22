import { HERO_SLIDES, type HeroSlide } from '../config/heroSlides';

export const HERO_SLIDES_STORAGE_KEY = 'grade9hub_hero_slides_v1';
export const MAX_HERO_SLIDES = 12;
const MAX_DATA_URL_LENGTH = 900_000;

export function isSafeHeroSlideSrc(src: unknown): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  if (!trimmed || trimmed.length > MAX_DATA_URL_LENGTH) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return !/[\s<>"'`]/.test(trimmed);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
  if (
    /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function cleanShortText(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
  return cleaned || undefined;
}

export function sanitizeHeroSlidesList(raw: unknown): HeroSlide[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const sanitized: HeroSlide[] = [];

  for (let i = 0; i < raw.length && sanitized.length < MAX_HERO_SLIDES; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isSafeHeroSlideSrc(record.src)) continue;

    let id =
      cleanShortText(record.id, 80)?.replace(/[^a-zA-Z0-9_-]/g, '-') ||
      `slide-${Date.now()}-${i + 1}`;
    while (seenIds.has(id)) {
      id = `${id}-${sanitized.length + 1}`;
    }
    seenIds.add(id);

    const alt = cleanShortText(record.alt, 180) || 'Grade 9 Hub science showcase banner';
    const altKu = cleanShortText(record.altKu, 180);
    const altAr = cleanShortText(record.altAr, 180);
    const caption = cleanShortText(record.caption, 140);
    const captionKu = cleanShortText(record.captionKu, 140);
    const captionAr = cleanShortText(record.captionAr, 140);
    const objectPosition = cleanShortText(record.objectPosition, 40);

    sanitized.push({
      id,
      src: record.src.trim(),
      alt,
      ...(altKu ? { altKu } : {}),
      ...(altAr ? { altAr } : {}),
      ...(caption ? { caption } : {}),
      ...(captionKu ? { captionKu } : {}),
      ...(captionAr ? { captionAr } : {}),
      ...(objectPosition ? { objectPosition } : {}),
    });
  }

  return sanitized;
}

export function loadLocalHeroSlides(): HeroSlide[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [...HERO_SLIDES];
    }
    const raw = window.localStorage.getItem(HERO_SLIDES_STORAGE_KEY);
    if (!raw) return [...HERO_SLIDES];
    const parsed = JSON.parse(raw) as unknown;
    const clean = sanitizeHeroSlidesList(parsed);
    return clean.length > 0 ? clean : [...HERO_SLIDES];
  } catch {
    return [...HERO_SLIDES];
  }
}

export function saveLocalHeroSlides(slides: HeroSlide[]): {
  ok: boolean;
  slides: HeroSlide[];
} {
  const clean = sanitizeHeroSlidesList(slides);
  const next = clean.length > 0 ? clean : [...HERO_SLIDES];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(HERO_SLIDES_STORAGE_KEY, JSON.stringify(next));
    }
    return { ok: true, slides: next };
  } catch {
    return { ok: false, slides: next };
  }
}

export function resetLocalHeroSlides(): HeroSlide[] {
  const defaults = [...HERO_SLIDES];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(HERO_SLIDES_STORAGE_KEY);
    }
  } catch {
    // ignore storage removal errors
  }
  return defaults;
}

export function readAndCompressBannerFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type.toLowerCase())) {
      reject(new Error('INVALID_IMAGE_TYPE'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('IMAGE_TOO_LARGE'));
      return;
    }

    // Preserve animated GIFs or compact PNG/WebP files directly when well under quota
    if (
      (file.type === 'image/gif' && file.size <= 550 * 1024) ||
      (file.type !== 'image/gif' && file.size <= 160 * 1024)
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string' && isSafeHeroSlideSrc(reader.result)) {
          resolve(reader.result);
        } else {
          reject(new Error('IMAGE_READ_FAILED'));
        }
      };
      reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxWidth = 1440;
        const maxHeight = 760;
        const ratio = Math.min(1, maxWidth / img.width, maxHeight / img.height);
        const targetW = Math.max(1, Math.round(img.width * ratio));
        const targetH = Math.max(1, Math.round(img.height * ratio));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('IMAGE_READ_FAILED'));
          return;
        }
        ctx.fillStyle = '#470A10';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        URL.revokeObjectURL(objectUrl);

        let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        }
        if (!isSafeHeroSlideSrc(dataUrl)) {
          reject(new Error('IMAGE_TOO_LARGE'));
          return;
        }
        resolve(dataUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('IMAGE_READ_FAILED'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('IMAGE_READ_FAILED'));
    };
    img.src = objectUrl;
  });
}
