import { db } from './db.ts';

interface SeedTextbookResource {
  chapterNumber: number | null;
  title: string;
  titleKu: string;
  titleAr: string;
  summary: string;
  summaryKu: string;
  summaryAr: string;
  keyFormulas: string;
  resourceType: 'textbook' | 'guide' | 'summary' | 'slides';
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
}

export const OFFICIAL_SCIENCE_TEXTBOOK_URL = '/assets/aistudio/Science_9_Book_2409ed82.pdf';

const OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE: SeedTextbookResource = {
  chapterNumber: null,
  title: 'Science — Grade 9 Official Student Textbook (306 Pages · Ch. 1–11)',
  titleKu: 'پەرتووکی فەرمی زانستی پۆلی ٩ (٣٠٦ لاپەڕە · بەشەکانی ١–١١)',
  titleAr: 'كتاب العلوم الرسمي للصف التاسع (٣٠٦ صفحة · الفصول ١–١١)',
  summary:
    'Official 306-page Grade 9 Science student textbook (Ministry of Education · Kurdistan Regional Government). Read and preview chapters 1–11 directly inside the app with zoom and chapter bookmarks, or download for offline study. International SI symbols (N, kg, m, s, m/s, m/s², J, W, °C, K) apply throughout.',
  summaryKu:
    'پەرتووکی فەرمی ٣٠٦ لاپەڕەیی زانستی پۆلی ٩ (وەزارەتی پەروەردەی حکومەتی هەرێمی کوردستان). هەموو بەشەکانی ١–١١ ڕاستەوخۆ لە ناو ئەپەکەدا ببینە و بخوێنەرەوە یان دایبەزێنە بۆ خوێندنی بێ ئینتەرنێت.',
  summaryAr:
    'الكتاب المدرسي الرسمي لمادة العلوم للصف التاسع (٣٠٦ صفحة — وزارة التربية في حكومة إقليم كوردستان). عاين الفصول ١–١١ مباشرة داخل التطبيق مع التكبير والانتقال السريع بين الفصول، أو نزّله للدراسة دون إنترنت.',
  keyFormulas: 'W = F · d (J)  |  P = W / Δt (W)  |  KE = ½ m v² (J)  |  GPE = m g h (J)  |  Q = m c ΔT (J)',
  resourceType: 'textbook',
  attachmentName: 'Science_9_Book.pdf',
  attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
  attachmentMime: 'application/pdf',
};

interface SeedStudyQA {
  chapterNumber: number;
  questionText: string;
  questionTextKu: string;
  questionTextAr: string;
  answerText: string;
  answerTextKu: string;
  answerTextAr: string;
  explanationText: string;
  explanationTextKu: string;
  explanationTextAr: string;
  sourceLabel: string;
}

const SEED_RESOURCES: SeedTextbookResource[] = [
  OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE,
  {
    chapterNumber: null,
    title: 'Grade 9 Science Complete Curriculum Textbook Guide (Chapters 1–11)',
    titleKu: 'ڕێبەری تەواوی پەرتووکی زانستی پۆلی ٩ (بەشەکانی ١–١١)',
    titleAr: 'دليل كتاب العلوم الشامل للصف التاسع (الفصول ١–١١)',
    summary:
      'Master reference for Grade 9 Science covering mechanics, simple machines, energy, heat, light, astronomy, genetics, human body systems, reproduction, acids & bases, and atomic energy. All physical quantities use strict international SI symbols (N, kg, m, s, m/s, m/s², J, W, °C, K).',
    summaryKu:
      'سەرچاوەی سەرەکی بۆ زانستی پۆلی ٩ کە میکانیک، ئامێرە سادەکان، وزە، گەرمی، ڕووناکی، ئەستێرەناسی، بۆماوەزانی، کۆئەندامەکانی لەش، زۆربوون، ترش و تفتەکان و وزەی ئەتۆمی دەگرێتەوە.',
    summaryAr:
      'المرجع الشامل لعلوم الصف التاسع، يغطي الميكانيكا والآلات البسيطة والطاقة والحرارة والضوء والفلك والوراثة وأجهزة الجسم والتكاثر والأحماض والقواعد والطاقة الذرية.',
    keyFormulas: 'W = F · d (J)  |  P = W / Δt (W)  |  KE = ½ m v² (J)  |  GPE = m g h (J)  |  Q = m c ΔT (J)',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 1,
    title: 'Chapter 1 Textbook: Work and Machines (PDF Pages 6–43)',
    titleKu: 'پەرتووکی بەشی ١: ئیش و ئامێرەکان (لاپەڕە ٦–٤٣)',
    titleAr: 'كتاب الفصل ١: الشغل والآلات (صفحات ٦–٤٣)',
    summary:
      'Section 1 covers scientific work (force acting along displacement), power as the rate of work or energy transfer, and SI units (1 J = 1 N·m, 1 W = 1 J/s). Section 2 explains simple machines (levers of classes 1, 2, 3, pulleys, inclined planes, wheel & axle, wedge, screw), mechanical advantage (MA = F_out / F_in), and machine efficiency.',
    summaryKu:
      'بەشی یەکەم باس لە ئیشی زانستی (هێز بە ئاراستەی لادان)، توانا وەک تێکڕای ئیش یان گواستنەوەی وزە، و یەکە نێودەوڵەتییەکان (1 J = 1 N·m, 1 W = 1 J/s) دەکات. بەشی دووەم ئامێرە سادەکان، سوودی میکانیکی و چوستی ئامێر ڕوون دەکاتەوە.',
    summaryAr:
      'يتناول القسم الأول الشغل العلمي والقدرة كمعدل بذل الشغل مع الوحدات الدولية (1 J = 1 N·m, 1 W = 1 J/s). ويوضح القسم الثاني الآلات البسيطة والفائدة الميكانيكية وكفاءة الآلة.',
    keyFormulas: 'W = F · d (J)  |  P = W / Δt (W)  |  MA = F_out / F_in  |  Efficiency = (W_out / W_in) × 100%',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 2,
    title: 'Chapter 2 Textbook: Energy (PDF Pages 44–76)',
    titleKu: 'پەرتووکی بەشی ٢: وزە (لاپەڕە ٤٤–٧٦)',
    titleAr: 'كتاب الفصل ٢: الطاقة (صفحات ٤٤–٧٦)',
    summary:
      'Explores kinetic energy (motion depending on mass in kg and speed squared in m/s), gravitational potential energy (GPE = m·g·h with g = 9.8 m/s²), elastic potential energy, total mechanical energy (ME = KE + PE), energy transformations, and energy resources.',
    summaryKu:
      'ڕوونکردنەوەی وزەی جووڵە (پشت دەبەستێت بە بارستایی بە kg و دووجای خێرایی بە m/s)، وزەی شاراوەی کێشکردن (GPE = m·g·h کاتێک g = 9.8 m/s²)، کۆی وزەی میکانیکی و یاسای پاراستنی وزە.',
    summaryAr:
      'يستعرض الطاقة الحركية والطاقة الكامنة الجاذبية (GPE = m·g·h حيث g = 9.8 m/s²) والطاقة الميكانيكية الكلية وتحولات الطاقة وقانون حفظ الطاقة.',
    keyFormulas: 'KE = ½ · m · v² (J)  |  GPE = m · g · h (J)  |  ME = KE + PE (J)  |  g = 9.8 m/s²',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 3,
    title: 'Chapter 3 Textbook: Heat & Temperature (PDF Pages 77–102)',
    titleKu: 'پەرتووکی بەشی ٣: گەرمی و پلەی گەرمی (لاپەڕە ٧٧–١٠٢)',
    titleAr: 'كتاب الفصل ٣: الحرارة ودرجة الحرارة (صفحات ٧٧–١٠٢)',
    summary:
      'Distinguishes temperature (average kinetic energy of particles measured in °C, °F, K) from thermal energy and heat flow. Covers conduction, convection, radiation, thermal conductors vs. insulators, and calorimetry calculations using specific heat Q = m·c·ΔT.',
    summaryKu:
      'جیاوازی نێوان پلەی گەرمی (°C, °F, K) و وزەی گەرمی، گەیاندن، هەڵگرتن و تیشکدانەوە، و هاوکێشەی گەرمی جۆری Q = m·c·ΔT.',
    summaryAr:
      'يميز بين درجة الحرارة (°C, °F, K) والطاقة الحرارية، ويشمل التوصيل والحمل والإشعاع، وحسابات السعة الحرارية النوعية Q = m·c·ΔT.',
    keyFormulas: 'Q = m · c · ΔT (J)  |  T(K) = T(°C) + 273  |  T(°F) = (9/5)·T(°C) + 32  |  c_water = 4,184 J/(kg·°C)',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 4,
    title: 'Chapter 4 Textbook: Light (PDF Pages 103–132)',
    titleKu: 'پەرتووکی بەشی ٤: ڕووناکی (لاپەڕە ١٠٣–١٣٢)',
    titleAr: 'كتاب الفصل ٤: الضوء (صفحات ١٠٣–١٣٢)',
    summary:
      'Covers the nature of light as electromagnetic waves, the electromagnetic spectrum, reflection and mirrors, refraction and lenses, color mixing and pigments, and optical instruments.',
    summaryKu:
      'باس لە سروشتی ڕووناکی وەک شەپۆلی کارۆموگناتیسی، شەبەنگی کارۆموگناتیسی، دانەوە و ئاوێنەکان، شکانەوە و هاوێنەکان و پێکهاتەی ڕەنگەکان دەکات.',
    summaryAr:
      'يتناول طبيعة الضوء كموجات كهرومغناطيسية، والطيف الكهرومغناطيسي، والانعكاس والمرايا، والانكسار والعدسات، وتكوّن الألوان.',
    keyFormulas: 'c = λ · f (3.0 × 10⁸ m/s)  |  θ_i = θ_r',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 5,
    title: 'Chapter 5 Textbook: Astronomy (PDF Pages 133–159)',
    titleKu: 'پەرتووکی بەشی ٥: ئەستێرەناسی (لاپەڕە ١٣٣–١٥٩)',
    titleAr: 'كتاب الفصل ٥: علم الفلك (صفحات ١٣٣–١٥٩)',
    summary:
      'Explores Earth in space, telescopes and space exploration, stars, galaxies, constellations, the life cycle of stars, and the formation and motion of the solar system.',
    summaryKu:
      'لێکۆڵینەوە لە زەوی لە بۆشایی ئاسماندا، تەلەسکۆپەکان، ئەستێرە و گەلەستێرەکان، سوڕی ژیانی ئەستێرەکان و پێکهاتنی کۆمەڵەی خۆر دەکات.',
    summaryAr:
      'يستعرض الأرض في الفضاء، والتلسكوبات، والنجوم والمجرات، ودورة حياة النجوم، وتكوّن المجموعة الشمسية.',
    keyFormulas: 'v = d / t  |  1 AU ≈ 1.50 × 10¹¹ m',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 6,
    title: 'Chapter 6 Textbook: Mendel and the Principles of Genetics (PDF Pages 160–190)',
    titleKu: 'پەرتووکی بەشی ٦: مەندڵ و بنەماکانی بۆماوەزانی (لاپەڕە ١٦٠–١٩٠)',
    titleAr: 'كتاب الفصل ٦: مندل ومبادئ علم الوراثة (صفحات ١٦٠–١٩٠)',
    summary:
      'Introduces Gregor Mendel’s pea-plant experiments, dominant and recessive traits, alleles, Punnett squares and genetic probability, meiosis, and how DNA and genes direct protein synthesis.',
    summaryKu:
      'تاقیکردنەوەکانی مەندڵ، سیفەتە زاڵ و بەزیوەکان، ئەلیلەکان، چوارگۆشەی پانێت، دابەشبوونی میۆزی و ڕۆڵی DNA لە بۆماوەزانیدا ڕوون دەکاتەوە.',
    summaryAr:
      'يقدم تجارب مندل الوراثية، والصفات السائدة والمتنحية، والأليلات، ومربع بانيت، والانقسام المنصف، ودور الحمض النووي DNA.',
    keyFormulas: 'Genotype · Phenotype · Punnett Probability Ratio (3:1, 1:2:1)',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 7,
    title: 'Chapter 7 Textbook: Body Organization and Structure (PDF Pages 191–217)',
    titleKu: 'پەرتووکی بەشی ٧: ڕێکخستن و پێکهاتەی لەش (لاپەڕە ١٩١–٢١٧)',
    titleAr: 'كتاب الفصل ٧: تنظيم الجسم وبنيته (صفحات ١٩١–٢١٧)',
    summary:
      'Covers levels of body organization (cells, tissues, organs, organ systems), homeostasis, the skeletal system (bones and joints), and the muscular system (skeletal, smooth, and cardiac muscles).',
    summaryKu:
      'ئاستەکانی ڕێکخستنی لەش (خانە، شانە، ئەندام، کۆئەندام)، هاوسەنگی ناوەکی، کۆئەندامی ئێسک و جومگەکان و کۆئەندامی ماسولکە دەگرێتەوە.',
    summaryAr:
      'يغطي مستويات تنظيم الجسم (الخلية، النسيج، العضو، الجهاز)، والاتزان الداخلي، والجهاز الهيكلي، والجهاز العضلي.',
    keyFormulas: 'Cells → Tissues → Organs → Organ Systems → Organism',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 8,
    title: 'Chapter 8 Textbook: Urinary & Nervous Systems (PDF Pages 218–238)',
    titleKu: 'پەرتووکی بەشی ٨: کۆئەندامی میز و کۆئەندامی دەمار (لاپەڕە ٢١٨–٢٣٨)',
    titleAr: 'كتاب الفصل ٨: الجهاز البولي والجهاز العصبي (صفحات ٢١٨–٢٣٨)',
    summary:
      'Examines kidney filtration, nephrons, and fluid balance in the urinary system, alongside neurons, nerve impulses, the central and peripheral nervous systems, and sensory organs.',
    summaryKu:
      'پاڵاوتنی گورچیلە و نیفرۆنەکان لە کۆئەندامی میزدا، لەگەڵ دەمارەخانە، ڕاگەیاندنی دەمار، کۆئەندامی دەماری ناوەندی و چێوەیی و هەستەوەرەکان.',
    summaryAr:
      'يتناول عمل الكليتين والنيفرونات في الجهاز البولي، والخلية العصبية، والسيال العصبي، والجهاز العصبي المركزي والطرفي وأعضاء الحس.',
    keyFormulas: 'Nephron Filtration · Neuron (Dendrite → Cell Body → Axon)',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 9,
    title: 'Chapter 9 Textbook: Reproduction and Development (PDF Pages 239–255)',
    titleKu: 'پەرتووکی بەشی ٩: زۆربوون و گەشەکردن (لاپەڕە ٢٣٩–٢٥٥)',
    titleAr: 'كتاب الفصل ٩: التكاثر والنمو (صفحات ٢٣٩–٢٥٥)',
    summary:
      'Compares asexual and sexual reproduction, examines male and female human reproductive systems, fertilization, embryonic and fetal development, and life stages.',
    summaryKu:
      'بەراوردکردنی زۆربوونی ناتۆخمە و تۆخمە، کۆئەندامی زاوزێی مرۆڤ، پیتاندن و قۆناغەکانی گەشەکردنی کۆرپەلە.',
    summaryAr:
      'يقارن بين التكاثر اللاجنسي والجنسي، ويشرح الجهاز التناسلي والإخصاب ومراحل نمو الجنين.',
    keyFormulas: 'Gametes (n) → Fertilization → Zygote (2n) → Embryo',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 10,
    title: 'Chapter 10 Textbook: Acids and Bases (PDF Pages 256–284)',
    titleKu: 'پەرتووکی بەشی ١٠: ترش و تفتەکان (لاپەڕە ٢٥٦–٢٨٤)',
    titleAr: 'كتاب الفصل ١٠: الأحماض والقواعد (صفحات ٢٥٦–٢٨٤)',
    summary:
      'Explores properties of acids and bases, hydrogen ions (H⁺) and hydroxide ions (OH⁻), the pH scale (0–14) and acid-base indicators, neutralization reactions, salts, and organic compounds.',
    summaryKu:
      'تایبەتمەندییەکانی ترش و تفت، ئایۆنەکانی H⁺ و OH⁻، پێوەری pH (٠–١٤)، کارلێکی هاوتابوون و خوێیەکان دەگرێتەوە.',
    summaryAr:
      'يستعرض خصائص الأحماض والقواعد، وأيونات H⁺ و OH⁻، ومقياس الرقم الهيدروجيني pH (0–14)، وتفاعلات التعادل والأملاح.',
    keyFormulas: 'pH < 7 (Acid)  |  pH = 7 (Neutral)  |  pH > 7 (Base)  |  Acid + Base → Salt + H₂O',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
  {
    chapterNumber: 11,
    title: 'Chapter 11 Textbook: Atomic Energy (PDF Pages 285–305)',
    titleKu: 'پەرتووکی بەشی ١١: وزەی ئەتۆمی (لاپەڕە ٢٨٥–٣٠٥)',
    titleAr: 'كتاب الفصل ١١: الطاقة الذرية (صفحات ٢٨٥–٣٠٥)',
    summary:
      'Covers radioactivity, alpha/beta/gamma decay, half-life calculations, nuclear fission and fusion reactions, nuclear reactors, and mass-energy equivalence.',
    summaryKu:
      'تیشکچالاکی، تیشکی ئەلفا و بێتا و گاما، نیوەتەمەن، کەرتبوون و یەکگرتنی ناوکی و هاوکێشەی وزە و بارستایی E = mc² ڕوون دەکاتەوە.',
    summaryAr:
      'يتناول النشاط الإشعاعي، وأشعة ألفا وبيتا وغاما، وعمر النصف، والانشطار والاندماج النووي، وتكافؤ الكتلة والطاقة.',
    keyFormulas: 'E = m · c² (J)  |  Half-life: N = N₀ · (½)^n',
    resourceType: 'textbook',
    attachmentName: 'Science_9_Book.pdf',
    attachmentUrl: OFFICIAL_SCIENCE_TEXTBOOK_URL,
    attachmentMime: 'application/pdf',
  },
];

const SEED_QA: SeedStudyQA[] = [
  // Chapter 1
  {
    chapterNumber: 1,
    questionText: 'When is scientific work done on an object, and when is zero work done even if a force is applied?',
    questionTextKu: 'کەی ئیشی زانستی لەسەر تەنێک دەکرێت، و کەی ئیش یەکسانە بە سفر تەنانەت ئەگەر هێزیش بخرێتە سەر؟',
    questionTextAr: 'متى يُبذل شغل علمي على جسم، ومتى يساوي الشغل صفراً رغم وجود قوة مؤثرة؟',
    answerText: 'Work is done only when an applied force causes displacement in the direction of the force (W = F · d). Zero work is done if displacement is 0 m or if the force is perpendicular (90°) to displacement.',
    answerTextKu: 'ئیش کاتێک دەکرێت کە هێز ببێتە هۆی لادانی تەنەکە بە هەمان ئاراستەی هێزەکە (W = F · d). ئیش سفرە ئەگەر لادان 0 m بێت یان هێزەکە ستوون بێت (90°) لەسەر ئاراستەی جووڵە.',
    answerTextAr: 'يُبذل الشغل فقط عندما تسبب القوة إزاحة باتجاهها (W = F · d). ويساوي صفراً إذا كانت الإزاحة 0 m أو كانت القوة عمودية (90°) على اتجاه الإزاحة.',
    explanationText: 'For example, carrying a heavy backpack horizontally at constant height exerts an upward force while displacement is horizontal (90°), so gravitational/lifting work is 0 J.',
    explanationTextKu: 'بۆ نموونە هەڵگرتنی جانتایەک بە ئاسۆیی: هێزەکە بەرەو سەرەوەیە بەڵام جووڵەکە ئاسۆییە (90°)، بۆیە ئیشی هەڵگرتنەکە 0 J دەبێت.',
    explanationTextAr: 'مثلاً عند حمل حقيبة أفقياً: القوة للأعلى بينما الإزاحة أفقية (90°)، لذا يكون الشغل المبذول 0 J.',
    sourceLabel: 'Chapter 1 · Core Concept',
  },
  {
    chapterNumber: 1,
    questionText: 'A motor lifts a 40 kg load vertically a distance of 6 m in 8 s (g = 9.8 m/s²). Calculate the work done and power output.',
    questionTextKu: 'ماتۆڕێک بارستاییەکی 40 kg بەرز دەکاتەوە بە بەرزی 6 m لە ماوەی 8 s دا (g = 9.8 m/s²). ئیشی ئەنجامدراو و توانای ماتۆڕەکە بدۆزەرەوە.',
    questionTextAr: 'يرفع محرك حمولة كتلتها 40 kg رأسياً مسافة 6 m خلال 8 s (g = 9.8 m/s²). احسب الشغل المبذول وقدرة المحرك.',
    answerText: 'W = 2,352 J and P = 294 W.',
    answerTextKu: 'W = 2,352 J و P = 294 W.',
    answerTextAr: 'W = 2,352 J و P = 294 W.',
    explanationText: 'Step 1: Force needed equals weight: F = m·g = 40 kg × 9.8 m/s² = 392 N. Step 2: Work W = F·d = 392 N × 6 m = 2,352 J. Step 3: Power P = W/Δt = 2,352 J / 8 s = 294 W.',
    explanationTextKu: 'هەنگاوی ١: هێز یەکسانە بە کێش F = m·g = 40 kg × 9.8 m/s² = 392 N. هەنگاوی ٢: ئیش W = F·d = 392 N × 6 m = 2,352 J. هەنگاوی ٣: توانا P = W/Δt = 2,352 J / 8 s = 294 W.',
    explanationTextAr: 'الخطوة ١: القوة اللازمة تساوي الوزن F = m·g = 40 kg × 9.8 m/s² = 392 N. الخطوة ٢: الشغل W = F·d = 392 N × 6 m = 2,352 J. الخطوة ٣: القدرة P = W/Δt = 2,352 J / 8 s = 294 W.',
    sourceLabel: 'Chapter 1 · Worked Example',
  },
  {
    chapterNumber: 1,
    questionText: 'Why is the real mechanical efficiency of any machine always less than 100%?',
    questionTextKu: 'بۆچی چوستی ڕاستەقینەی هیچ ئامێرێک ناگاتە 100%؟',
    questionTextAr: 'لماذا تكون الكفاءة الحقيقية لأي آلة أقل دائماً من 100%؟',
    answerText: 'Because friction converts part of the input work into thermal energy (heat), so useful output work (W_out) is always less than input work (W_in).',
    answerTextKu: 'چونکە هێزی لێکخشاندن بەشێک لە ئیشی پێدراو دەگۆڕێت بۆ وزەی گەرمی، بۆیە ئیشی بەرهەمهاتوو (W_out) هەمیشە کەمترە لە ئیشی پێدراو (W_in).',
    answerTextAr: 'لأن الاحتكاك يحوّل جزءاً من الشغل المبذول إلى طاقة حرارية، فيكون الشغل الناتج المفيد (W_out) أقل دائماً من الشغل الداخل (W_in).',
    explanationText: 'Lubricants reduce friction and raise efficiency closer to 100%, but friction can never be eliminated completely in physical machines.',
    explanationTextKu: 'چەورکردن لێکخشاندن کەم دەکاتەوە و چوستی زیاد دەکات، بەڵام لێکخشاندن هەرگیز بە تەواوی نامێنێت.',
    explanationTextAr: 'تقلل الزيوت التشحيمية الاحتكاك وترفع الكفاءة، لكن لا يمكن إلغاء الاحتكاك تماماً.',
    sourceLabel: 'Chapter 1 · Textbook Review',
  },

  // Chapter 2
  {
    chapterNumber: 2,
    questionText: 'How does doubling an object’s speed affect its kinetic energy compared to doubling its mass?',
    questionTextKu: 'دوو هێندەکردنی خێرایی تەنێک چ کاریگەرییەکی هەیە لەسەر وزەی جووڵە بە بەراورد بە دوو هێندەکردنی بارستایی؟',
    questionTextAr: 'كيف يؤثر مضاعفة سرعة جسم في طاقته الحركية مقارنةً بمضاعفة كتلته؟',
    answerText: 'Doubling mass doubles KE (2×), whereas doubling speed quadruples KE (4×) because kinetic energy depends on speed squared (KE = ½·m·v²).',
    answerTextKu: 'دوو هێندەکردنی بارستایی وزەی جووڵە دوو هێندە دەکات (2×)، بەڵام دوو هێندەکردنی خێرایی وزەی جووڵە چوار هێندە دەکات (4×) چونکە KE = ½·m·v².',
    answerTextAr: 'مضاعفة الكتلة تضاعف الطاقة الحركية (2×)، بينما مضاعفة السرعة تزيدها أربع مرات (4×) لأن الطاقة الحركية تتناسب مع مربع السرعة (KE = ½·m·v²).',
    explanationText: 'For a 2 kg ball: at 3 m/s, KE = 0.5 × 2 × 9 = 9 J. At 6 m/s (2× faster), KE = 0.5 × 2 × 36 = 36 J (4× greater).',
    explanationTextKu: 'بۆ تۆپێکی 2 kg: لە خێرایی 3 m/s وزەی جووڵە 9 J ـە، بەڵام لە 6 m/s دەبێتە 36 J.',
    explanationTextAr: 'لكرة كتلتها 2 kg: عند سرعة 3 m/s تكون KE = 9 J، وعند سرعة 6 m/s تصبح KE = 36 J.',
    sourceLabel: 'Chapter 2 · Core Concept',
  },
  {
    chapterNumber: 2,
    questionText: 'A 5 kg stone rests on a ledge 12 m above the ground (g = 9.8 m/s²). Find its GPE at the top and its KE just before hitting the ground.',
    questionTextKu: 'بەردێکی 5 kg لە بەرزی 12 m دایە لەسەر زەوی (g = 9.8 m/s²). وزەی شاراوەی لە لووتکە و وزەی جووڵەی ڕاستەوخۆ پێش بەرکەوتنی زەوی بدۆزەرەوە.',
    questionTextAr: 'حجر كتلته 5 kg موضوع على ارتفاع 12 m عن سطح الأرض (g = 9.8 m/s²). أوجد طاقته الكامنة في الأعلى وطاقته الحركية لحظة وصوله للأرض.',
    answerText: 'GPE at top = 588 J; KE just before impact = 588 J (ignoring air resistance).',
    answerTextKu: 'GPE لە لووتکە = 588 J؛ KE پێش بەرکەوتن = 588 J (بە پشتگوێخستنی بەرگری هەوا).',
    answerTextAr: 'الطاقة الكامنة في الأعلى = 588 J؛ والطاقة الحركية قبل ملامسة الأرض = 588 J (بإهمال مقاومة الهواء).',
    explanationText: 'GPE = m·g·h = 5 kg × 9.8 m/s² × 12 m = 588 J. By Conservation of Mechanical Energy, as h reaches 0 m, all 588 J of GPE transforms into KE.',
    explanationTextKu: 'GPE = m·g·h = 5 kg × 9.8 m/s² × 12 m = 588 J. بەپێی یاسای پاراستنی وزەی میکانیکی، کاتێک بەرزی دەبێتە 0 m هەموو 588 J دەگۆڕێت بۆ KE.',
    explanationTextAr: 'GPE = m·g·h = 5 kg × 9.8 m/s² × 12 m = 588 J. وبحسب قانون حفظ الطاقة، تتحول كل الـ 588 J إلى طاقة حركية عند مستوى الأرض.',
    sourceLabel: 'Chapter 2 · Worked Example',
  },

  // Chapter 3
  {
    chapterNumber: 3,
    questionText: 'What is the difference between temperature and heat in physics?',
    questionTextKu: 'جیاوازی نێوان پلەی گەرمی و گەرمی چییە لە فیزیادا؟',
    questionTextAr: 'ما الفرق بين درجة الحرارة والحرارة في الفيزياء؟',
    answerText: 'Temperature measures the average kinetic energy of particles (°C, °F, K), while heat is the transfer of thermal energy (J) between objects due to a temperature difference.',
    answerTextKu: 'پلەی گەرمی پێوانی ناوەندی وزەی جووڵەی گەردیلەکانە (°C, °F, K)، بەڵام گەرمی بریتییە لە گواستنەوەی وزەی گەرمی (J) لە تەنێکی گەرمترەوە بۆ تەنێکی ساردتر.',
    answerTextAr: 'درجة الحرارة هي مقياس متوسط الطاقة الحركية للجسيمات (°C, °F, K)، بينما الحرارة هي انتقال الطاقة الحرارية (J) بين الأجسام بسبب اختلاف درجة الحرارة.',
    explanationText: 'A large iceberg at 0 °C has more total thermal energy than a small cup of boiling water at 100 °C because it has vastly more particles, even though its temperature is lower.',
    explanationTextKu: 'چیایەکی سەهۆڵی گەورە لە 0 °C وزەی گەرمی گشتی زیاترە لە کوپێک ئاوی کوڵاو لە 100 °C چونکە ژمارەی گەردیلەکانی زۆر زیاترە.',
    explanationTextAr: 'جبل جليدي كبير عند 0 °C يمتلك طاقة حرارية كلية أكبر من كوب ماء مغلي عند 100 °C لأن عدد جسيماته أكبر بكثير.',
    sourceLabel: 'Chapter 3 · Core Concept',
  },
  {
    chapterNumber: 3,
    questionText: 'How much heat energy is required to warm 2 kg of water from 20 °C to 70 °C? (c_water = 4,184 J/(kg·°C))',
    questionTextKu: 'چەند وزەی گەرمی پێویستە بۆ گەرمکردنی 2 kg ئاو لە 20 °C بۆ 70 °C؟ (c = 4,184 J/(kg·°C))',
    questionTextAr: 'ما مقدار الطاقة الحرارية اللازمة لتسخين 2 kg من الماء من 20 °C إلى 70 °C؟ (c = 4,184 J/(kg·°C))',
    answerText: 'Q = 418,400 J (or 418.4 kJ).',
    answerTextKu: 'Q = 418,400 J (یان 418.4 kJ).',
    answerTextAr: 'Q = 418,400 J (أو 418.4 kJ).',
    explanationText: 'ΔT = 70 °C − 20 °C = 50 °C. Using Q = m·c·ΔT: Q = 2 kg × 4,184 J/(kg·°C) × 50 °C = 418,400 J.',
    explanationTextKu: 'ΔT = 70 °C − 20 °C = 50 °C. بە بەکارهێنانی Q = m·c·ΔT: Q = 2 kg × 4,184 J/(kg·°C) × 50 °C = 418,400 J.',
    explanationTextAr: 'ΔT = 70 °C − 20 °C = 50 °C. وبتطبيق Q = m·c·ΔT: Q = 2 kg × 4,184 J/(kg·°C) × 50 °C = 418,400 J.',
    sourceLabel: 'Chapter 3 · Worked Example',
  },
];

export function seedTextbooksIfNeeded(): void {
  const existingQa = db
    .prepare('SELECT COUNT(*) AS count FROM textbook_study_qa')
    .get() as { count: number };

  const insertRes = db.prepare(
    `INSERT INTO textbook_resources
     (chapter_number, title, title_ku, title_ar, summary, summary_ku, summary_ar, key_formulas, resource_type, attachment_name, attachment_url, attachment_mime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const txRes = db.transaction(() => {
    // 1. Ensure the full textbook resource (chapter_number IS NULL with PDF attachment) exists
    const existingGlobalPdf = db
      .prepare('SELECT id FROM textbook_resources WHERE chapter_number IS NULL AND attachment_url = ? LIMIT 1')
      .get(OFFICIAL_SCIENCE_TEXTBOOK_URL) as { id: number } | undefined;

    if (!existingGlobalPdf) {
      insertRes.run(
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.chapterNumber,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.title,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.titleKu,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.titleAr,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.summary,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.summaryKu,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.summaryAr,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.keyFormulas,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.resourceType,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.attachmentName ?? null,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.attachmentUrl ?? null,
        OFFICIAL_SCIENCE_TEXTBOOK_RESOURCE.attachmentMime ?? null
      );
    }

    // 2. Ensure the Complete Curriculum Guide (chapter_number IS NULL) also links the official PDF
    const nullGuideRows = db
      .prepare('SELECT id, attachment_url FROM textbook_resources WHERE chapter_number IS NULL')
      .all() as Array<{ id: number; attachment_url: string | null }>;

    if (nullGuideRows.length === 1) {
      const guide = SEED_RESOURCES[1];
      insertRes.run(
        guide.chapterNumber,
        guide.title,
        guide.titleKu,
        guide.titleAr,
        guide.summary,
        guide.summaryKu,
        guide.summaryAr,
        guide.keyFormulas,
        guide.resourceType,
        guide.attachmentName ?? null,
        guide.attachmentUrl ?? null,
        guide.attachmentMime ?? null
      );
    } else {
      for (const row of nullGuideRows) {
        if (!row.attachment_url) {
          db.prepare(
            `UPDATE textbook_resources
             SET attachment_name = ?, attachment_url = ?, attachment_mime = ?
             WHERE id = ?`
          ).run('Science_9_Book.pdf', OFFICIAL_SCIENCE_TEXTBOOK_URL, 'application/pdf', row.id);
        }
      }
    }

    // 3. Ensure every Chapter 1–11 has its official textbook resource pointing to Science_9_Book.pdf
    for (const r of SEED_RESOURCES) {
      if (typeof r.chapterNumber !== 'number') continue;
      const existingCh = db
        .prepare(
          `SELECT id, attachment_url
           FROM textbook_resources
           WHERE chapter_number = ? AND resource_type = 'textbook'
           ORDER BY id ASC
           LIMIT 1`
        )
        .get(r.chapterNumber) as { id: number; attachment_url: string | null } | undefined;

      if (!existingCh) {
        insertRes.run(
          r.chapterNumber,
          r.title,
          r.titleKu,
          r.titleAr,
          r.summary,
          r.summaryKu,
          r.summaryAr,
          r.keyFormulas,
          r.resourceType,
          r.attachmentName ?? null,
          r.attachmentUrl ?? null,
          r.attachmentMime ?? null
        );
      } else if (!existingCh.attachment_url) {
        db.prepare(
          `UPDATE textbook_resources
           SET attachment_name = ?, attachment_url = ?, attachment_mime = ?
           WHERE id = ?`
        ).run(
          r.attachmentName ?? 'Science_9_Book.pdf',
          r.attachmentUrl ?? OFFICIAL_SCIENCE_TEXTBOOK_URL,
          r.attachmentMime ?? 'application/pdf',
          existingCh.id
        );
      }
    }
  });
  txRes();

  if (existingQa.count === 0) {
    const insertQa = db.prepare(
      `INSERT INTO textbook_study_qa
       (chapter_number, question_text, question_text_ku, question_text_ar,
        answer_text, answer_text_ku, answer_text_ar,
        explanation_text, explanation_text_ku, explanation_text_ar, source_label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const txQa = db.transaction(() => {
      for (const q of SEED_QA) {
        insertQa.run(
          q.chapterNumber,
          q.questionText,
          q.questionTextKu,
          q.questionTextAr,
          q.answerText,
          q.answerTextKu,
          q.answerTextAr,
          q.explanationText,
          q.explanationTextKu,
          q.explanationTextAr,
          q.sourceLabel
        );
      }
    });
    txQa();
  }
}
