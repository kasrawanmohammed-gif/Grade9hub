import { GoogleGenAI } from '@google/genai';
import { db } from './db.ts';
import { CHAPTER_TRANSLATIONS, CHAPTER_1_TRANSLATIONS } from './translationsCh1.ts';
import { CHAPTER_2_TRANSLATIONS } from './translationsCh2.ts';
import { CHAPTER_3_TRANSLATIONS } from './translationsCh3.ts';
import { normalizeScientificUnits } from './unitSanitizer.ts';

export function populateTranslations123(): void {
  const alreadyDone = db
    .prepare("SELECT value FROM app_settings WHERE key = 'seeded_translations_123_v2'")
    .get() as { value: string } | undefined;

  if (alreadyDone?.value === 'true') {
    return;
  }

  const updateChapterStmt = db.prepare(
    `UPDATE chapters
     SET title_ku = ?, description_ku = ?, title_ar = ?, description_ar = ?
     WHERE chapter_number = ?`
  );

  const updateQuestionStmt = db.prepare(
    `UPDATE questions
     SET question_text_ku = ?,
         option_a_ku = ?,
         option_b_ku = ?,
         option_c_ku = ?,
         option_d_ku = ?,
         explanation_ku = ?,
         question_text_ar = ?,
         option_a_ar = ?,
         option_b_ar = ?,
         option_c_ar = ?,
         option_d_ar = ?,
         explanation_ar = ?
     WHERE scope = 'chapter'
       AND chapter_number = ?
       AND question_text = ?`
  );

  const updateByIdStmt = db.prepare(
    `UPDATE questions
     SET question_text_ku = ?,
         option_a_ku = ?,
         option_b_ku = ?,
         option_c_ku = ?,
         option_d_ku = ?,
         explanation_ku = ?,
         question_text_ar = ?,
         option_a_ar = ?,
         option_b_ar = ?,
         option_c_ar = ?,
         option_d_ar = ?,
         explanation_ar = ?
     WHERE id = ?`
  );

  const allQuestionTranslations = [
    ...CHAPTER_1_TRANSLATIONS,
    ...CHAPTER_2_TRANSLATIONS,
    ...CHAPTER_3_TRANSLATIONS,
  ];

  const tx = db.transaction(() => {
    for (const ch of CHAPTER_TRANSLATIONS) {
      updateChapterStmt.run(
        normalizeScientificUnits(ch.titleKu),
        normalizeScientificUnits(ch.descriptionKu),
        normalizeScientificUnits(ch.titleAr),
        normalizeScientificUnits(ch.descriptionAr),
        ch.chapterNumber
      );
    }

    for (const q of allQuestionTranslations) {
      updateQuestionStmt.run(
        normalizeScientificUnits(q.ku.questionText),
        normalizeScientificUnits(q.ku.optionA),
        normalizeScientificUnits(q.ku.optionB),
        normalizeScientificUnits(q.ku.optionC),
        normalizeScientificUnits(q.ku.optionD),
        normalizeScientificUnits(q.ku.explanation),
        normalizeScientificUnits(q.ar.questionText),
        normalizeScientificUnits(q.ar.optionA),
        normalizeScientificUnits(q.ar.optionB),
        normalizeScientificUnits(q.ar.optionC),
        normalizeScientificUnits(q.ar.optionD),
        normalizeScientificUnits(q.ar.explanation),
        q.chapterNumber,
        q.questionText
      );
    }

    // Non-destructive pass over all stored question rows to sanitize any legacy/custom localized units
    const existingRows = db
      .prepare(
        `SELECT id,
                question_text_ku, option_a_ku, option_b_ku, option_c_ku, option_d_ku, explanation_ku,
                question_text_ar, option_a_ar, option_b_ar, option_c_ar, option_d_ar, explanation_ar
         FROM questions`
      )
      .all() as Array<{
        id: number;
        question_text_ku: string;
        option_a_ku: string;
        option_b_ku: string;
        option_c_ku: string;
        option_d_ku: string;
        explanation_ku: string;
        question_text_ar: string;
        option_a_ar: string;
        option_b_ar: string;
        option_c_ar: string;
        option_d_ar: string;
        explanation_ar: string;
      }>;

    for (const row of existingRows) {
      const next = {
        question_text_ku: normalizeScientificUnits(row.question_text_ku || ''),
        option_a_ku: normalizeScientificUnits(row.option_a_ku || ''),
        option_b_ku: normalizeScientificUnits(row.option_b_ku || ''),
        option_c_ku: normalizeScientificUnits(row.option_c_ku || ''),
        option_d_ku: normalizeScientificUnits(row.option_d_ku || ''),
        explanation_ku: normalizeScientificUnits(row.explanation_ku || ''),
        question_text_ar: normalizeScientificUnits(row.question_text_ar || ''),
        option_a_ar: normalizeScientificUnits(row.option_a_ar || ''),
        option_b_ar: normalizeScientificUnits(row.option_b_ar || ''),
        option_c_ar: normalizeScientificUnits(row.option_c_ar || ''),
        option_d_ar: normalizeScientificUnits(row.option_d_ar || ''),
        explanation_ar: normalizeScientificUnits(row.explanation_ar || ''),
      };

      const changed =
        next.question_text_ku !== (row.question_text_ku || '') ||
        next.option_a_ku !== (row.option_a_ku || '') ||
        next.option_b_ku !== (row.option_b_ku || '') ||
        next.option_c_ku !== (row.option_c_ku || '') ||
        next.option_d_ku !== (row.option_d_ku || '') ||
        next.explanation_ku !== (row.explanation_ku || '') ||
        next.question_text_ar !== (row.question_text_ar || '') ||
        next.option_a_ar !== (row.option_a_ar || '') ||
        next.option_b_ar !== (row.option_b_ar || '') ||
        next.option_c_ar !== (row.option_c_ar || '') ||
        next.option_d_ar !== (row.option_d_ar || '') ||
        next.explanation_ar !== (row.explanation_ar || '');

      if (changed) {
        updateByIdStmt.run(
          next.question_text_ku,
          next.option_a_ku,
          next.option_b_ku,
          next.option_c_ku,
          next.option_d_ku,
          next.explanation_ku,
          next.question_text_ar,
          next.option_a_ar,
          next.option_b_ar,
          next.option_c_ar,
          next.option_d_ar,
          next.explanation_ar,
          row.id
        );
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seeded_translations_123_v2', 'true')"
    ).run();
  });

  tx();
}

export async function autoTranslateQuestionInBackground(questionId: number): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const row = db
    .prepare(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, explanation
       FROM questions WHERE id = ?`
    )
    .get(questionId) as
    | {
        id: number;
        question_text: string;
        option_a: string;
        option_b: string;
        option_c: string;
        option_d: string;
        explanation: string;
      }
    | undefined;

  if (!row) return;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const prompt = `Translate this Grade 9 physics/science multiple-choice question, all 4 options, and the explanation into both Kurdish Sorani (ku) and Modern Standard Arabic (ar).
CRITICAL SCIENTIFIC UNIT RULE:
- NEVER translate, transliterate, or convert any standard SI/scientific or mathematical unit symbol into Kurdish or Arabic letters or words (e.g., NEVER write کگم, كغم, كجم, م/چ, م/ث, نیوتن, نيوتن, جول, وات, واط, چرکە, ثوانٍ with measurements or options).
- Keep ALL unit symbols strictly in international Latin format: N, kg, g, mg, m, cm, mm, km, s, m/s, m/s², km/h, J, kJ, W, kW, Hz, Pa, kPa, °C, °F, K, N·m, J/(kg·°C), A, V, Ω.
- Keep ALL physical formulas (W = F · d, KE = 1/2 mv², Q = mcΔT) and numerical measurements with Western ASCII digits (0-9) and Latin units (e.g., "10 N", "5 m", "2000 kg", "10 m/s", "50 W", "4 s", "-40 °C").

Return ONLY valid JSON with keys:
{
  "ku": { "questionText": "", "optionA": "", "optionB": "", "optionC": "", "optionD": "", "explanation": "" },
  "ar": { "questionText": "", "optionA": "", "optionB": "", "optionC": "", "optionD": "", "explanation": "" }
}

Source:
Question: ${row.question_text}
A: ${row.option_a}
B: ${row.option_b}
C: ${row.option_c}
D: ${row.option_d}
Explanation: ${row.explanation || ''}`;

    const resp = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(resp.text || '{}') as {
      ku?: {
        questionText?: string;
        optionA?: string;
        optionB?: string;
        optionC?: string;
        optionD?: string;
        explanation?: string;
      };
      ar?: {
        questionText?: string;
        optionA?: string;
        optionB?: string;
        optionC?: string;
        optionD?: string;
        explanation?: string;
      };
    };

    if (parsed.ku?.questionText && parsed.ar?.questionText) {
      db.prepare(
        `UPDATE questions
         SET question_text_ku = ?, option_a_ku = ?, option_b_ku = ?, option_c_ku = ?, option_d_ku = ?, explanation_ku = ?,
             question_text_ar = ?, option_a_ar = ?, option_b_ar = ?, option_c_ar = ?, option_d_ar = ?, explanation_ar = ?
         WHERE id = ?`
      ).run(
        normalizeScientificUnits(parsed.ku.questionText || ''),
        normalizeScientificUnits(parsed.ku.optionA || ''),
        normalizeScientificUnits(parsed.ku.optionB || ''),
        normalizeScientificUnits(parsed.ku.optionC || ''),
        normalizeScientificUnits(parsed.ku.optionD || ''),
        normalizeScientificUnits(parsed.ku.explanation || ''),
        normalizeScientificUnits(parsed.ar.questionText || ''),
        normalizeScientificUnits(parsed.ar.optionA || ''),
        normalizeScientificUnits(parsed.ar.optionB || ''),
        normalizeScientificUnits(parsed.ar.optionC || ''),
        normalizeScientificUnits(parsed.ar.optionD || ''),
        normalizeScientificUnits(parsed.ar.explanation || ''),
        questionId
      );
    }
  } catch {
    // non-fatal background translation failure
  }
}

export async function autoTranslateChapterInBackground(chapterNumber: number): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return;

  const row = db
    .prepare('SELECT chapter_number, title, description FROM chapters WHERE chapter_number = ?')
    .get(chapterNumber) as
    | { chapter_number: number; title: string; description: string }
    | undefined;

  if (!row) return;

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const prompt = `Translate this Grade 9 science textbook chapter title and description into Kurdish Sorani (ku) and Arabic (ar). Preserve all international Latin SI unit symbols (N, kg, m, s, m/s, J, W, Hz, Pa, °C, etc.) and formulas without translating unit letters. Return ONLY valid JSON:
{
  "ku": { "title": "", "description": "" },
  "ar": { "title": "", "description": "" }
}
Title: ${row.title}
Description: ${row.description}`;

    const resp = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(resp.text || '{}') as {
      ku?: { title?: string; description?: string };
      ar?: { title?: string; description?: string };
    };

    if (parsed.ku?.title && parsed.ar?.title) {
      db.prepare(
        `UPDATE chapters
         SET title_ku = ?, description_ku = ?, title_ar = ?, description_ar = ?
         WHERE chapter_number = ?`
      ).run(
        normalizeScientificUnits(parsed.ku.title || ''),
        normalizeScientificUnits(parsed.ku.description || ''),
        normalizeScientificUnits(parsed.ar.title || ''),
        normalizeScientificUnits(parsed.ar.description || ''),
        chapterNumber
      );
    }
  } catch {
    // non-fatal background translation failure
  }
}
