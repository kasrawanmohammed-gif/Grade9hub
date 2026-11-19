const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٫': '.',
  '٬': ',',
};

export function toAsciiDigits(numStr: string): string {
  return numStr.replace(/[٠-٩۰-۹٫٬]/g, (ch) => ARABIC_INDIC_MAP[ch] ?? ch);
}

const NUM_RE = '([+-]?[0-9٠-٩۰-۹]+(?:[.,٫][0-9٠-٩۰-۹]+)*)';

/**
 * Ensures physical & mathematical unit symbols stay in strict international
 * Latin SI format (N, kg, g, m, cm, s, m/s, m/s², J, W, Hz, Pa, °C, °F, K)
 * in Kurdish and Arabic text without corrupting prose sentences.
 */
export function normalizeScientificUnits(text: string): string {
  if (!text) return text;

  let out = text;

  // 1. Compound transliterated/localized unit abbreviations (safe anywhere)
  out = out
    .replace(/م\s*\/\s*[چث]\s*(?:²|\^2|2)/g, 'm/s²')
    .replace(/م\s*\/\s*[چث]/g, 'm/s')
    .replace(/(?:کم|كم)\s*\/\s*[سچک]/g, 'km/h')
    .replace(/نيوتن\s*[·.\-]\s*متر|نیوتن\s*[·.\-]\s*مەتر/g, 'N·m')
    .replace(/جول\s*\/\s*(?:\(\s*)?(?:کگم|كغم|كجم)\s*[·.]\s*°\s*([CF])(?:\s*\))?/g, 'J/(kg·°$1)')
    .replace(/(?<![\p{L}\p{N}])(?:کگم|كغم|كجم)(?![\p{L}\p{N}])/gu, 'kg');

  // 2. Numeric quantities paired with translated/transliterated unit words -> ASCII digits + Latin SI symbol
  const quantityReplacements: Array<[RegExp, (num: string, suffix?: string) => string]> = [
    // kg
    [
      new RegExp(`${NUM_RE}\\s*(?:کگم|كغم|كجم|کیلۆگرام|كيلوغرام|كيلوجرام|کيلۆگرام)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} kg`,
    ],
    // g
    [
      new RegExp(`${NUM_RE}\\s*(?:گرام|جرام|غراماً|جراماً)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} g`,
    ],
    // mg
    [
      new RegExp(`${NUM_RE}\\s*(?:ملیگرام|ملليغرام|ملغ|ملجم)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} mg`,
    ],
    // km
    [
      new RegExp(`${NUM_RE}\\s*(?:کیلۆمەتر|كيلومتر|كيلومتراً|كم)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} km`,
    ],
    // cm
    [
      new RegExp(`${NUM_RE}\\s*(?:سەنتیمەتر|سنتیمەتر|سنتيمتر|سنتيمتراً|سم)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} cm`,
    ],
    // mm
    [
      new RegExp(`${NUM_RE}\\s*(?:ملیمەتر|ملليمتر|ملليمتراً|مم)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} mm`,
    ],
    // m (meters)
    [
      new RegExp(`${NUM_RE}\\s*(?:مەتر|متر(?:اً)?)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} m`,
    ],
    // N (Newtons)
    [
      new RegExp(`${NUM_RE}\\s*(?:نیوتنە|نیوتن|نيوتن(?:اً)?)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} N`,
    ],
    // J (Joules)
    [
      new RegExp(`${NUM_RE}\\s*(?:جولە|جول(?:اً)?)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} J`,
    ],
    // W (Watts)
    [
      new RegExp(`${NUM_RE}\\s*(?:واتە|وات|واط(?:اً)?)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} W`,
    ],
    // Pa (Pascals)
    [
      new RegExp(`${NUM_RE}\\s*(?:پاسکاڵە|پاسکاڵ|باسكال)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} Pa`,
    ],
    // Hz (Hertz)
    [
      new RegExp(`${NUM_RE}\\s*(?:هێرتز|هيرتز|هرتز)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} Hz`,
    ],
    // K (Kelvin)
    [
      new RegExp(`${NUM_RE}\\s*(?:کڵڤن|كلڤن|كلفن)(?![\\p{L}])`, 'gu'),
      (n) => `${toAsciiDigits(n)} K`,
    ],
    // s (seconds) - preserve Kurdish locative suffix "-دا" when present
    [
      new RegExp(`${NUM_RE}\\s*(?:چرکەدا|چرکە|ثوانٍ|ثواني|ثانية)(?![\\p{L}])`, 'gu'),
      (n, fullMatch) =>
        fullMatch && fullMatch.includes('چرکەدا') ? `${toAsciiDigits(n)} s دا` : `${toAsciiDigits(n)} s`,
    ],
  ];

  for (const [regex, formatter] of quantityReplacements) {
    out = out.replace(regex, (fullMatch, numStr: string) => formatter(numStr, fullMatch));
  }

  // 3. Arabic/Kurdish digits directly paired with Latin SI unit symbols -> ASCII digits + Latin unit
  out = out.replace(
    new RegExp(
      `${NUM_RE}\\s*(°\\s*[CF]|m\\/s²|m\\/s\\^2|m\\/s|km\\/h|N·m|J\\/\\(kg·°[CF]\\)|J\\/kg·°[CF]|J\\/s|N\\/m²|kg|mg|km|cm|mm|Hz|Pa|kJ|kW|kPa|m|g|s|N|J|W|K|A|V|Ω)(?![A-Za-z\\p{L}])`,
      'gu'
    ),
    (_m, numStr: string, unit: string) => `${toAsciiDigits(numStr)} ${unit.replace(/\s+/g, '')}`
  );

  return out;
}
