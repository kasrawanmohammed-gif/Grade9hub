import { db } from './db.ts';

export interface SeedChapter4Question {
  chapterNumber: 4;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
}

export const CHAPTER_4_TITLE = 'Light';
export const CHAPTER_4_DESCRIPTION =
  'Light, Electromagnetic Spectrum & Reflection · Comprehensive Question Bank (67 Questions)';

export const CHAPTER_4_QUESTIONS: SeedChapter4Question[] = [
  {
    chapterNumber: 4,
    questionText: 'According to the first law of reflection, when light reflects from a surface:',
    optionA: 'The angle of incidence is greater than the angle of reflection',
    optionB: 'The angle of incidence is equal to the angle of reflection (θ = θ′)',
    optionC: 'The angle of incidence is always 90°',
    optionD: 'No angle is formed with the normal line',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which wave in the electromagnetic spectrum has the longest wavelength and lowest frequency?',
    optionA: 'Gamma rays',
    optionB: 'X-rays',
    optionC: 'Radio waves',
    optionD: 'Ultraviolet light',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText: 'How do we see objects around us according to modern scientific understanding?',
    optionA: 'Light emits from our eyes onto objects',
    optionB: 'Light falls on an object and reflects into our eyes',
    optionC: 'Objects generate their own magnetic fields',
    optionD: 'Sound waves carry images to the eyes',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'If the angle between two plane mirrors is 120°, how many images are formed?',
    optionA: '1',
    optionB: '2',
    optionC: '3',
    optionD: '4',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which electromagnetic wave helps the skin produce vitamin D and is used to sterilize medical tools, air, and water by destroying bacteria and inhibiting viruses?',
    optionA: 'Infrared (IR)',
    optionB: 'Ultraviolet (UV)',
    optionC: 'Radio waves',
    optionD: 'Microwaves',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'A solar cell converts light energy into:',
    optionA: 'Heat energy',
    optionB: 'Chemical energy',
    optionC: 'Sound energy',
    optionD: 'Electrical energy',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText: 'In a uniform medium (such as air), light travels in:',
    optionA: 'Zigzag paths',
    optionB: 'Curved circular arcs',
    optionC: 'Straight lines',
    optionD: 'Random spirals',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText: 'Why is the word “AMBULANCE” written in reverse on the front of an ambulance?',
    optionA:
      'Because of lateral inversion in plane mirrors—drivers see the letters properly in rearview mirrors',
    optionB: 'To reduce air resistance while driving',
    optionC: 'Because light travels backward in front of vehicles',
    optionD: 'To make it harder to read at night',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which wave in the electromagnetic spectrum has the shortest wavelength, highest frequency, and greatest energy?',
    optionA: 'Radio waves',
    optionB: 'Microwaves',
    optionC: 'Infrared waves',
    optionD: 'Gamma rays',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText: 'What is the difference between primary and secondary sources of light?',
    optionA: 'Primary sources reflect light; secondary sources emit light directly',
    optionB:
      'Primary sources emit light directly (e.g., Sun, candle); secondary sources reflect light (e.g., Moon, mirror)',
    optionC: 'Primary sources are always artificial; secondary sources are always natural',
    optionD: 'There is no difference between them',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'What is the angle between two plane mirrors if the number of images formed is 7?',
    optionA: '30°',
    optionB: '45°',
    optionC: '60°',
    optionD: '90°',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Which one of the following is NOT visible light?',
    optionA: 'Red',
    optionB: 'Blue',
    optionC: 'Indigo',
    optionD: 'Ultraviolet',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText: 'How do plants use light during photosynthesis?',
    optionA: 'They absorb sunlight and convert oxygen and food into carbon dioxide and water',
    optionB:
      'They absorb sunlight and convert carbon dioxide and water into food, releasing oxygen',
    optionC: 'They use light only to cool their leaves at night',
    optionD: 'They convert sunlight directly into mineral salts',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Visible light lies between which two regions of the electromagnetic spectrum?',
    optionA: 'Radio waves and microwaves',
    optionB: 'Infrared and ultraviolet waves',
    optionC: 'X-rays and gamma rays',
    optionD: 'Microwaves and X-rays',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the equation used to find the number of images (n) formed between two plane mirrors at an angle θ?',
    optionA: 'n = (360° / θ) − 1',
    optionB: 'n = (180° / θ) + 1',
    optionC: 'n = 360° × θ',
    optionD: 'n = θ − 1',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which color in the visible light spectrum has the longest wavelength and lowest frequency?',
    optionA: 'Violet',
    optionB: 'Blue',
    optionC: 'Red',
    optionD: 'Green',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText: 'Light is refracted (changes direction) when it:',
    optionA: 'Passes through air',
    optionB: 'Passes through water',
    optionC: 'Passes through glass',
    optionD: 'Passes from air into water',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is the source of gamma rays?',
    optionA: 'Nuclear reactions in the Sun',
    optionB: 'Supernova explosions',
    optionC: 'Radioactive materials',
    optionD: 'All of them are correct',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the effect of decreasing the angle between two plane mirrors on the number of images formed?',
    optionA: 'The number of images increases',
    optionB: 'The number of images decreases',
    optionC: 'The number of images stays at 1',
    optionD: 'No images are formed',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which two fields make up electromagnetic waves?',
    optionA: 'Electric field and magnetic field',
    optionB: 'Gravitational field and sound field',
    optionC: 'Thermal field and friction field',
    optionD: 'Static field and pressure field',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Foods sterilized by gamma rays are safe to eat because:',
    optionA: 'The rays pass through the food and do not remain in the food',
    optionB: 'The food turns into radioactive metal',
    optionC: 'Gamma rays stay trapped inside the food to keep it warm',
    optionD: 'Gamma rays add vitamins to the food',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'How many colors does white light consist of?',
    optionA: 'Five',
    optionB: 'Six',
    optionC: 'Seven',
    optionD: 'Eight',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText:
      'How many images are formed between two plane mirrors when the angle between them is 36°?',
    optionA: '5',
    optionB: '8',
    optionC: '9',
    optionD: '10',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText: 'At airports, which type of ray is used for detailed detection of bags and items?',
    optionA: 'X-rays',
    optionB: 'Radio waves',
    optionC: 'Microwaves',
    optionD: 'Infrared waves',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'The speed of light in a vacuum is:',
    optionA: '3 × 10⁶ m/s',
    optionB: '3 × 10⁷ m/s',
    optionC: '3 × 10⁵ km/s (3 × 10⁸ m/s)',
    optionD: '30 × 10⁸ m/s',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText:
      'How do specular (regular) reflection and diffuse reflection compare in terms of angles of incidence and reflected rays?',
    optionA:
      'Specular occurs on a smooth surface with equal angles and parallel rays; diffuse occurs on a rough surface with scattered rays',
    optionB: 'Specular occurs on rough paper; diffuse occurs on a smooth mirror',
    optionC: 'Both always produce parallel rays on any surface',
    optionD: 'Neither obeys the law of reflection',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'In which of the following is an infrared wave used?',
    optionA: 'Bone imaging',
    optionB: 'Thermal cameras',
    optionC: 'Radio broadcasting',
    optionD: 'Radar',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'Classify the following sources as natural or artificial: (a) Candle, (b) Sun, (c) Volcanoes, (d) Laser.',
    optionA: 'Natural: (a), (b); Artificial: (c), (d)',
    optionB: 'Natural: (b), (c); Artificial: (a), (d)',
    optionC: 'Natural: (b), (d); Artificial: (a), (c)',
    optionD: 'Natural: (a), (c); Artificial: (b), (d)',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'What does excessive exposure to X-rays do to the human body?',
    optionA: 'Can damage the DNA of living cells and increase the risk of cancer',
    optionB: 'Strengthens tooth enamel automatically',
    optionC: 'Produces vitamin D in the skin',
    optionD: 'Lowers blood sugar',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'To form the image of a point in a plane mirror, what is the minimum number of light rays needed?',
    optionA: '1 ray',
    optionB: '2 rays',
    optionC: '4 rays',
    optionD: '6 rays',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Compare the wavelengths of infrared, visible light, and ultraviolet rays:',
    optionA: 'Infrared > Visible light > Ultraviolet',
    optionB: 'Ultraviolet > Visible light > Infrared',
    optionC: 'Visible light > Infrared > Ultraviolet',
    optionD: 'All three have identical wavelengths',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which list shows the component colors of white light in order?',
    optionA: 'Red, orange, yellow, green, blue, indigo, violet',
    optionB: 'Violet, indigo, blue, green, yellow, orange, red',
    optionC: 'Red, yellow, orange, green, blue, violet, indigo',
    optionD: 'Red, orange, green, yellow, blue, indigo, violet',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is a property of an image formed by a plane mirror?',
    optionA: 'Real image that can be projected onto a screen',
    optionB:
      'Virtual, upright, same size as object, equal distance behind mirror, laterally inverted',
    optionC: 'Upside-down and smaller than the object',
    optionD: 'Located in front of the mirror on the object’s side',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Radio waves are used in:',
    optionA: 'Photography',
    optionB: 'Television broadcasting and AM/FM radio broadcasting',
    optionC: 'A lamp for natural muscle therapy',
    optionD: 'Camera for taking photos at night',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Compare the speed of light in a vacuum and in water:',
    optionA: 'Greater in water than in a vacuum',
    optionB: 'Greater in a vacuum than in water',
    optionC: 'Equal in a vacuum and in water',
    optionD: 'Zero in a vacuum',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Two devices that use microwaves are:',
    optionA: 'Microwave oven and radar (also satellites, Wi-Fi, mobile phones)',
    optionB: 'X-ray machine and ultraviolet lamp',
    optionC: 'Thermal camera and prism',
    optionD: 'Magnifying glass and solar cell',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'The two main types of mirrors by shape mentioned in the chapter are:',
    optionA: 'Plane mirrors and spherical mirrors',
    optionB: 'Concave lenses and convex lenses',
    optionC: 'Prism mirrors and laser mirrors',
    optionD: 'Flat mirrors and water mirrors',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'How do electromagnetic waves in the spectrum differ from one another?',
    optionA: 'They differ in wavelength, frequency, and energy',
    optionB: 'They differ in their speed through a vacuum',
    optionC: 'Some are mechanical waves and some are sound waves',
    optionD: 'They only exist in solids',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which choice gives a correct example of specular reflection and diffuse reflection?',
    optionA: 'Specular: smooth mirror; Diffuse: rough paper',
    optionB: 'Specular: rough paper; Diffuse: smooth mirror',
    optionC: 'Specular: muddy water; Diffuse: polished silver',
    optionD: 'Specular: brick wall; Diffuse: glass mirror',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'What are some harms of excessive mobile phone use noted under Physics and Health?',
    optionA:
      'Eye fatigue, dryness, redness, blurred vision, headaches, neck/back pain, and sleep disturbances',
    optionB: 'Instantaneous bone fractures',
    optionC: 'Increased vitamin D production',
    optionD: 'Improved night vision',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which group lists only natural light sources?',
    optionA: 'Sun, stars, volcanoes, bioluminescent organisms',
    optionB: 'Sun, electric bulb, candle, laser',
    optionC: 'Flashlight, stars, volcanoes, mirror',
    optionD: 'Candle, flashlight, laser, Moon',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'The electromagnetic spectrum is defined as:',
    optionA: 'Only the visible colors seen in a rainbow',
    optionB:
      'The arrangement of electromagnetic waves from the longest wavelength to the shortest wavelength',
    optionC: 'Sound waves arranged by loudness',
    optionD: 'Waves that travel only through metal wires',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which statement accurately gives two differences between ultraviolet rays and visible light?',
    optionA:
      'UV has shorter wavelengths and higher frequencies than visible light, and is outside human vision whereas visible light is seen by the eye',
    optionB: 'UV has longer wavelengths than visible light and is seen as red',
    optionC: 'Visible light cannot travel in vacuum whereas UV can',
    optionD: 'There is no difference in wavelength or frequency',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which choice lists three properties of light?',
    optionA:
      'Travels in straight lines in a uniform medium, reflects off surfaces, and refracts between media of different densities',
    optionB: 'Needs a material medium like air to move, has zero speed, and never disperses',
    optionC: 'Moves at 340 m/s, has no color components, and cannot reflect',
    optionD: 'Only travels in circles and never refracts',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which waves have the highest energy and lowest energy in the electromagnetic spectrum, respectively?',
    optionA: 'Highest: Radio waves; Lowest: Gamma rays',
    optionB: 'Highest: Gamma rays; Lowest: Radio waves',
    optionC: 'Highest: Visible light; Lowest: X-rays',
    optionD: 'Highest: Infrared; Lowest: Ultraviolet',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'How did humans in the past explain seeing objects, and how is it explained now?',
    optionA:
      'Past: light emits from eyes onto objects; Now: light falls on objects and reflects into our eyes',
    optionB: 'Past: objects emit sound to eyes; Now: eyes pull light inward',
    optionC: 'Past: light travels only at night; Now: light never reflects',
    optionD: 'Past and present explanations are identical',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Why are X-rays used to image human bones and screen luggage at airports?',
    optionA:
      'Because they have shorter wavelengths and higher frequencies than UV and can penetrate soft tissues/bags to show denser structures like bones',
    optionB: 'Because they are visible green light',
    optionC: 'Because they warm the skin like a blanket',
    optionD: 'Because they are sound waves',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which group lists only artificial light sources?',
    optionA: 'Electric bulb, flashlight, candle, laser',
    optionB: 'Sun, candle, flashlight, stars',
    optionC: 'Volcanoes, electric bulb, laser, fireflies',
    optionD: 'Stars, Moon, electric bulb, candle',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which choice gives four important roles of light in daily life?',
    optionA:
      'Cause of vision, photosynthesis in plants, heat/solar energy, and technology/communication (e.g., lasers, fibre optics)',
    optionB: 'Causing earthquakes, tides, seasons, and eclipses only',
    optionC: 'Making metals heavy, cold, solid, and magnetic',
    optionD: 'Replacing water, soil, wind, and air',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'When light passes from air into water, does it continue along its straight path, and why?',
    optionA: 'Yes, because water has the same optical density as air',
    optionB:
      'No, because it refracts (changes direction) when moving between media of different densities',
    optionC: 'Yes, because electromagnetic waves never bend',
    optionD: 'No, because light stops completely in water',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is an importance of light in medicine and health?',
    optionA:
      'Helps skin produce vitamin D from sunlight for bones, muscles, teeth, and immunity, and is used in medical devices like lasers',
    optionB: 'Replaces the need for sleep and nutrition',
    optionC: 'Prevents all bacterial growth without any radiation',
    optionD: 'Acts only as a decorative tool in hospitals',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'All waves in the electromagnetic spectrum travel through a vacuum at:',
    optionA: 'Different speeds depending on wavelength',
    optionB: 'The speed of light (3 × 10⁸ m/s)',
    optionC: 'Half the speed of sound',
    optionD: '300 m/s',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'Infrared (IR) waves lie between microwaves and visible light, and are used in:',
    optionA:
      'TV/AC/car remote controls, night thermal cameras, muscle therapy heat lamps, and drying car paint',
    optionB: 'Bone fracture imaging',
    optionC: 'Detecting counterfeit banknotes',
    optionD: 'Food sterilization in factories',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Light is an electromagnetic wave consisting of:',
    optionA: 'Sound and mechanical vibrations parallel to wave motion',
    optionB:
      'Electric and magnetic fields oscillating perpendicular to each other and to the direction of propagation',
    optionC: 'Only magnetic fields moving in circles',
    optionD: 'Longitudinal pressure waves in air',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which of the following is NOT one of the fundamental properties of light listed in the text?',
    optionA: 'Travels in straight lines in a uniform medium',
    optionB: 'Reflects when striking a surface',
    optionC: 'Refracts when passing between media of different densities',
    optionD: 'Travels faster in glass than in a vacuum',
    correctOption: 'D',
  },
  {
    chapterNumber: 4,
    questionText: 'Which type of electromagnetic wave helps the body produce Vitamin D in the skin?',
    optionA: 'Ultraviolet (UV)',
    optionB: 'Radio waves',
    optionC: 'Microwaves',
    optionD: 'X-rays',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the difference between primary and secondary sources of light? (Chapter Review Q16)',
    optionA:
      'Primary sources emit light directly (e.g., Sun, candle); secondary sources do not emit light directly but reflect light (e.g., Moon, mirror)',
    optionB: 'Primary sources are always cold; secondary sources are always hot',
    optionC: 'Primary sources only exist in water; secondary sources only exist in space',
    optionD: 'Primary sources are made of glass; secondary sources are made of wood',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following waves has the longest wavelength? (Chapter Review Q2)',
    optionA: 'Microwave',
    optionB: 'Radio wave',
    optionC: 'Infrared',
    optionD: 'X-ray',
    correctOption: 'B',
  },
  {
    chapterNumber: 4,
    questionText: 'A light wave is defined as a type of electromagnetic wave that:',
    optionA: 'Requires a solid medium to travel',
    optionB: 'Travels only through air',
    optionC: 'Can be seen by the eye',
    optionD: 'Moves slower than sound in a vacuum',
    correctOption: 'C',
  },
  {
    chapterNumber: 4,
    questionText: 'Ultraviolet light is also used in security technology to:',
    optionA: 'Detect counterfeit banknotes (bills) and forged documents',
    optionB: 'Transmit AM radio broadcasts across countries',
    optionC: 'Heat food in microwave ovens',
    optionD: 'Measure distance with radar pulses',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'In industry, gamma rays are used to:',
    optionA: 'Detect cracks and defects in metal materials',
    optionB: 'Dry paint on cars quickly',
    optionC: 'Power television remote controls',
    optionD: 'Illuminate streets at night',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'Most mirrors are made of glass whose back side is coated with a thin layer of metal, such as:',
    optionA: 'Silver or aluminum',
    optionB: 'Copper or iron',
    optionC: 'Lead or zinc',
    optionD: 'Carbon or sulfur',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'A ray of light that strikes a plane mirror perpendicularly (along the normal line) is reflected:',
    optionA: 'Back along the same path',
    optionB: 'Parallel to the mirror surface',
    optionC: 'At a 45° angle away from the normal',
    optionD: 'Directly through the mirror without reflection',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText: 'What is the wavelength range of visible light shown in the electromagnetic spectrum?',
    optionA: 'Greater than 400 nm and less than 700 nm',
    optionB: 'Greater than 30 cm',
    optionC: 'Greater than 0.0001 nm and less than 60 nm',
    optionD: 'Greater than 1 mm and less than 30 cm',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'In communication technology, which optical component is used to transmit data at the speed of light?',
    optionA: 'Fibre optics',
    optionB: 'Bimetallic strips',
    optionC: 'Galvanometers',
    optionD: 'Hydraulic pistons',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'Why must gamma rays be used under the supervision of specialists even though they have many benefits?',
    optionA: 'Because of their very high energy, they are dangerous to living organisms',
    optionB: 'Because they move too slowly to be controlled',
    optionC: 'Because they freeze nearby equipment',
    optionD: 'Because they only work in total darkness',
    correctOption: 'A',
  },
  {
    chapterNumber: 4,
    questionText:
      'If two plane mirrors are placed perpendicular to each other (θ = 90°), how many images are formed?',
    optionA: '2',
    optionB: '3',
    optionC: '4',
    optionD: '5',
    correctOption: 'B',
  },
];

export function seedChapter4IfNeeded(): void {
  const alreadySeeded = db
    .prepare("SELECT value FROM app_settings WHERE key = 'seeded_ch4_v1'")
    .get() as { value: string } | undefined;

  if (alreadySeeded?.value === 'true') {
    return;
  }

  const updateChapter = db.prepare(
    `UPDATE chapters SET title = ?, description = ?, updated_at = datetime('now')
     WHERE chapter_number = 4`
  );

  const checkExisting = db.prepare(
    `SELECT id FROM questions WHERE scope = 'chapter' AND chapter_number = ? AND question_text = ?`
  );

  const insertQuestion = db.prepare(
    `INSERT INTO questions (scope, chapter_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
     VALUES ('chapter', ?, ?, ?, ?, ?, ?, ?, '')`
  );

  const tx = db.transaction(() => {
    updateChapter.run(CHAPTER_4_TITLE, CHAPTER_4_DESCRIPTION);

    for (const q of CHAPTER_4_QUESTIONS) {
      const exists = checkExisting.get(q.chapterNumber, q.questionText);
      if (!exists) {
        insertQuestion.run(
          q.chapterNumber,
          q.questionText,
          q.optionA,
          q.optionB,
          q.optionC,
          q.optionD,
          q.correctOption
        );
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seeded_ch4_v1', 'true')"
    ).run();

    const students = db
      .prepare("SELECT id FROM users WHERE role = 'student'")
      .all() as Array<{ id: number }>;
    const insertNotif = db.prepare(
      `INSERT INTO notifications (user_id, title, body, category, link_tab)
       VALUES (?, ?, ?, 'question', 'multiple-choice')`
    );
    for (const st of students) {
      insertNotif.run(
        st.id,
        'Chapter 4 Questions Published',
        '67 questions for Chapter 4 (Light — Electromagnetic Spectrum & Reflection) are now available.'
      );
    }
  });

  tx();
}
