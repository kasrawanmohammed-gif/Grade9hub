export type SupportedLang = 'en' | 'ku' | 'ar';

export function buildWrongOptionExplanation(params: {
  questionText: string;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  selectedOptionText: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  correctOptionText: string;
  trueExplanation: string;
  lang?: SupportedLang;
}): string {
  const {
    questionText,
    selectedOption,
    selectedOptionText,
    correctOption,
    correctOptionText,
    trueExplanation,
    lang = 'en',
  } = params;

  const qLower = questionText.toLowerCase();
  const selLower = selectedOptionText.toLowerCase();
  const corrLower = correctOptionText.toLowerCase();

  // ---------------- KURDISH SORANI ----------------
  if (lang === 'ku') {
    if (
      corrLower.includes('both') ||
      corrLower.includes('all of') ||
      corrLower.includes('هەردوو') ||
      corrLower.includes('هەموو')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») تەواو نییە چونکە زیاتر لە وەڵامێک لێرەدا ڕاستە — هەڵبژاردنی ${correctOption} («${correctOptionText}») هەموو وەڵامە دروستەکان لەخۆدەگرێت.`;
    }
    if (
      selLower.includes('هیچ کام') ||
      selLower.includes('هەموویان') ||
      selLower.includes('none of') ||
      selLower.includes('all of')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە ${
        selLower.includes('هیچ') || selLower.includes('none')
          ? `هەڵبژاردنی ${correctOption} («${correctOptionText}») لە ڕاستیدا وەڵامە دروستەکەیە.`
          : 'هەموو هەڵبژاردنەکان لەگەڵ مەرجی پرسیارەکەدا ناگونجێن.'
      }`;
    }

    if (selLower.includes('وات') || selLower.includes('watt') || /\bw\b/.test(selLower)) {
      if (!qLower.includes('توانا') && !qLower.includes('power')) {
        return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە وات (W) یەکەی پێوانی توانایە (خێرایی ئەنجامدانی ئیش)، نەک ئەو بڕەی لە پرسیارەکەدا داواکراوە.`;
      }
    }
    if (selLower.includes('جول') || selLower.includes('joule') || /\bj\b/.test(selLower)) {
      if (qLower.includes('توانا') || qLower.includes('power')) {
        return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە جول (J) یەکەی ئیش و وزەیە، لەکاتێکدا توانا بە وات (W = J/s) دەپێورێت.`;
      }
      if (qLower.includes('هێز') || qLower.includes('force')) {
        return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە جول (J) یەکەی ئیش و وزەیە، بەڵام هێز بە نیوتن (N) دەپێورێت.`;
      }
    }
    if (selLower.includes('نیوتن') || selLower.includes('newton') || /\bn\b/.test(selLower)) {
      if (
        !qLower.includes('هێز') &&
        !qLower.includes('کێش') &&
        !qLower.includes('force') &&
        !qLower.includes('weight')
      ) {
        return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە نیوتن (N) یەکەی پێوانی هێز یان کێشە، نەک ئەو بڕەی لە پرسیارەکەدا داواکراوە.`;
      }
    }
    if (selLower.includes('پاسکاڵ') || selLower.includes('pascal')) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە پاسکاڵ (Pa) یەکەی پێوانی پەستانە (N/m²)، نەک ئەو بڕەی لێرەدا پرسیاری لەسەر کراوە.`;
    }

    if (
      (selLower.includes('وزەی جووڵە') || selLower.includes('kinetic')) &&
      !corrLower.includes('جووڵە') &&
      !corrLower.includes('kinetic')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە وزەی جووڵە پەیوەستە بە جووڵەی تەنەکە (1/2 mv²)، نەک ئەو جۆرە وزەیەی لە پرسیارەکەدا باسکراوە.`;
    }
    if (
      (selLower.includes('وزەی مات') || selLower.includes('وزەی شاوڵی') || selLower.includes('potential')) &&
      !corrLower.includes('مات') &&
      !corrLower.includes('potential')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە وزەی مات وزەی پاشەکەوتکراوە بەهۆی شوێن یان شێوەوە، لەکاتێکدا پرسیارەکە ئاماژە بە «${correctOptionText}» دەکات.`;
    }

    if (
      (selLower.includes('پلەی یەکەم') || selLower.includes('first')) &&
      !corrLower.includes('یەکەم')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە لە نوێڵی پلەی یەکەمدا خاڵی پاڵپشت (تەوەرە) دەکەوێتە نێوان هێز و بارەوە.`;
    }
    if (
      (selLower.includes('پلەی دووەم') || selLower.includes('second')) &&
      !corrLower.includes('دووەم')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە لە نوێڵی پلەی دووەمدا بارەکە دەکەوێتە نێوان تەوەرە و هێزی کارپێکراوەوە.`;
    }
    if (
      (selLower.includes('پلەی سێیەم') || selLower.includes('third')) &&
      !corrLower.includes('سێیەم')
    ) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە لە نوێڵی پلەی سێیەمدا هێز دەکەوێتە نێوان تەوەرە و بارەوە.`;
    }

    if (/^[\d.,\s+-]+(\s*[a-zA-Z°/%²³·()]+)?$/.test(selectedOptionText.trim())) {
      return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە جێبەجێکردنی هاوکێشە و یەکە ڕاستەکان ئەنجامەکەی ناکاتە ${selectedOptionText}. ${trueExplanation}`;
    }

    return `هەڵبژاردنی ${selectedOption} («${selectedOptionText}») هەڵەیە چونکە لەگەڵ بنەما زانستییەکەی پرسیارەکەدا ناگونجێت: ${trueExplanation}`;
  }

  // ---------------- ARABIC ----------------
  if (lang === 'ar') {
    if (
      corrLower.includes('both') ||
      corrLower.includes('all of') ||
      corrLower.includes('كلا') ||
      corrLower.includes('جميع')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») غير مكتمل لأن أكثر من إجابة صحيحة هنا — الخيار ${correctOption} («${correctOptionText}») يشمل جميع الإجابات الصحيحة.`;
    }
    if (
      selLower.includes('لا شيء') ||
      selLower.includes('جميع ما سبق') ||
      selLower.includes('none of') ||
      selLower.includes('all of')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») غير صحيح لأن ${
        selLower.includes('لا شيء') || selLower.includes('none')
          ? `الخيار ${correctOption} («${correctOptionText}») هو الإجابة الصحيحة فعلاً.`
          : 'ليست كل الخيارات المذكورة تحقق الشرط المطلوب في السؤال.'
      }`;
    }

    if (selLower.includes('واط') || selLower.includes('watt') || /\bw\b/.test(selLower)) {
      if (!qLower.includes('قدرة') && !qLower.includes('power')) {
        return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن الواط (W) هو وحدة قياس القدرة (معدل إنجاز الشغل)، وليس الكمية المطلوبة في هذا السؤال.`;
      }
    }
    if (selLower.includes('جول') || selLower.includes('joule') || /\bj\b/.test(selLower)) {
      if (qLower.includes('قدرة') || qLower.includes('power')) {
        return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن الجول (J) يقيس الشغل أو الطاقة، بينما تُقاس القدرة بالواط (W = J/s).`;
      }
      if (qLower.includes('قوة') || qLower.includes('force')) {
        return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن الجول (J) يقيس الشغل والطاقة، بينما تُقاس القوة بالنيوتن (N).`;
      }
    }
    if (selLower.includes('نيوتن') || selLower.includes('newton') || /\bn\b/.test(selLower)) {
      if (
        !qLower.includes('قوة') &&
        !qLower.includes('وزن') &&
        !qLower.includes('force') &&
        !qLower.includes('weight')
      ) {
        return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن النيوتن (N) يقيس القوة أو الوزن، وليس الكمية المطلوبة هنا.`;
      }
    }
    if (selLower.includes('باسكال') || selLower.includes('pascal')) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن الباسكال (Pa) هو وحدة الضغط (N/m²)، وليس الكمية المقصودة في السؤال.`;
    }

    if (
      (selLower.includes('حركية') || selLower.includes('kinetic')) &&
      !corrLower.includes('حركية') &&
      !corrLower.includes('kinetic')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن الطاقة الحركية هي طاقة الجسم المتحرك (1/2 mv²)، وليست نوع الطاقة المطلوب في السؤال.`;
    }
    if (
      (selLower.includes('وضع') || selLower.includes('كامن') || selLower.includes('potential')) &&
      !corrLower.includes('وضع') &&
      !corrLower.includes('كامن') &&
      !corrLower.includes('potential')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن طاقة الوضع هي طاقة مخزّنة بسبب الموقع أو الشكل، بينما يشير السؤال إلى «${correctOptionText}».`;
    }

    if (
      (selLower.includes('النوع الأول') || selLower.includes('first')) &&
      !corrLower.includes('الأول')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن نقطة الارتكاز في رافعة النوع الأول تقع بين القوة والمقاومة.`;
    }
    if (
      (selLower.includes('النوع الثاني') || selLower.includes('second')) &&
      !corrLower.includes('الثاني')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن المقاومة (الحمل) في رافعة النوع الثاني تقع بين نقطة الارتكاز والقوة.`;
    }
    if (
      (selLower.includes('النوع الثالث') || selLower.includes('third')) &&
      !corrLower.includes('الثالث')
    ) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن القوة المبذولة في رافعة النوع الثالث تقع بين نقطة الارتكاز والمقاومة.`;
    }

    if (/^[\d.,\s+-]+(\s*[a-zA-Z°/%²³·()]+)?$/.test(selectedOptionText.trim())) {
      return `الخيار ${selectedOption} («${selectedOptionText}») خاطئ لأن تطبيق القانون والوحدات الصحيحة لا يعطي ${selectedOptionText}. ${trueExplanation}`;
    }

    return `الخيار ${selectedOption} («${selectedOptionText}») غير صحيح لأنه لا يتوافق مع المبدأ العلمي المطلوب في السؤال: ${trueExplanation}`;
  }

  // ---------------- ENGLISH ----------------
  // 1. Both (X) and (Y) / All of the above / None of the above cases
  if (corrLower.includes('both') || corrLower.includes('all of the above') || corrLower.includes('all of them')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is incomplete because more than one choice is true here—${correctOption} ("${correctOptionText}") correctly includes all valid answers.`;
  }
  if (selLower.includes('none of the above') || selLower.includes('all of the above')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is incorrect because ${
      selLower.includes('none')
        ? `Option ${correctOption} ("${correctOptionText}") is actually correct.`
        : 'not all of the listed options satisfy the condition in the question.'
    }`;
  }

  // 2. Unit / Quantity mismatches (Joule, Watt, Newton, Pascal)
  if (selLower.includes('watt') || /\bw\b/.test(selLower)) {
    if (!qLower.includes('power')) {
      return `Option ${selectedOption} ("${selectedOptionText}") is wrong because the Watt (W) is the unit of power (rate of doing work), not the quantity asked in this question.`;
    }
  }
  if (selLower.includes('joule') || /\bj\b/.test(selLower)) {
    if (qLower.includes('power')) {
      return `Option ${selectedOption} ("${selectedOptionText}") is wrong because Joules (J) measure work or energy, whereas power is measured in Watts (W = J/s).`;
    }
    if (qLower.includes('force')) {
      return `Option ${selectedOption} ("${selectedOptionText}") is wrong because Joules (J) measure work/energy, whereas force is measured in Newtons (N).`;
    }
  }
  if (selLower.includes('newton') || /\bn\b/.test(selLower)) {
    if (!qLower.includes('force') && !qLower.includes('weight')) {
      return `Option ${selectedOption} ("${selectedOptionText}") is wrong because Newtons (N) measure force or weight, not the quantity requested here.`;
    }
  }
  if (selLower.includes('pascal')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because Pascal (Pa) is the SI unit of pressure (N/m²), not what this question asks for.`;
  }

  // 3. Heat transfer modes
  if (selLower.includes('conduction') && !corrLower.includes('conduction')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because conduction transfers heat through direct particle-to-particle collisions in solids, not by the mechanism described here.`;
  }
  if (selLower.includes('convection') && !corrLower.includes('convection')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because convection transfers heat through moving currents of fluids (liquids or gases), which does not match this situation.`;
  }
  if (selLower.includes('radiation') && !corrLower.includes('radiation')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because thermal radiation transfers energy via electromagnetic waves (even across empty space), rather than the process asked here.`;
  }

  // 4. Energy types
  if (selLower.includes('kinetic energy') && !corrLower.includes('kinetic')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because kinetic energy is energy of motion (1/2 mv²), not the form of energy described in this question.`;
  }
  if (selLower.includes('potential energy') && !corrLower.includes('potential')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because potential energy is stored energy due to position or state, whereas the question refers to ${correctOptionText}.`;
  }
  if ((selLower.includes('solar') || selLower.includes('wind') || selLower.includes('hydro')) && qLower.includes('non-renewable')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because ${selectedOptionText} is naturally replenished and classified as a renewable energy resource.`;
  }
  if ((selLower.includes('coal') || selLower.includes('oil') || selLower.includes('petroleum') || selLower.includes('natural gas')) && qLower.includes('renewable') && !qLower.includes('non-renewable')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because fossil fuels take millions of years to form and are non-renewable.`;
  }

  // 5. Simple machine classes & definitions
  if (selLower.includes('first-class') || selLower.includes('first class')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because in a first-class lever the fulcrum is in the middle between the effort and the load.`;
  }
  if (selLower.includes('second-class') || selLower.includes('second class')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because in a second-class lever the load sits between the fulcrum and the effort.`;
  }
  if (selLower.includes('third-class') || selLower.includes('third class')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because in a third-class lever the effort is applied between the fulcrum and the load.`;
  }

  // 6. Opposite trends
  if (selLower.includes('remain stationary') || selLower.includes('zero displacement') || selLower.includes('does not move')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because if an object does not move (d = 0), then W = F · d = 0 and no mechanical work is done.`;
  }
  if (selLower.includes('perpendicular') && !corrLower.includes('perpendicular')) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because a force perpendicular (90°) to displacement does zero mechanical work.`;
  }
  if (
    (selLower.includes('increase') && corrLower.includes('decrease')) ||
    (selLower.includes('decreases') && corrLower.includes('increases')) ||
    (selLower.includes('larger') && corrLower.includes('smaller')) ||
    (selLower.includes('smaller') && corrLower.includes('larger'))
  ) {
    return `Option ${selectedOption} ("${selectedOptionText}") describes the opposite relationship—here the correct behavior is "${correctOptionText}".`;
  }

  // 7. Numeric distractors
  if (/^[\d.,\s+-]+(\s*[a-zA-Z°/%²³·]+)?$/.test(selectedOptionText.trim())) {
    return `Option ${selectedOption} ("${selectedOptionText}") is wrong because applying the correct formula and units does not yield ${selectedOptionText}. ${trueExplanation}`;
  }

  return `Option ${selectedOption} ("${selectedOptionText}") is incorrect because it does not match the scientific principle required by the question: ${trueExplanation}`;
}
