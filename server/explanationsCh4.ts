import { db } from './db.ts';

export const CHAPTER_4_EXPLANATIONS: Array<{
  chapterNumber: 4;
  questionText: string;
  explanation: string;
}> = [
  {
    chapterNumber: 4,
    questionText: 'According to the first law of reflection, when light reflects from a surface:',
    explanation:
      'The first law of reflection states that the angle of incidence (θ) measured from the normal line equals the angle of reflection (θ′): θ = θ′.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which wave in the electromagnetic spectrum has the longest wavelength and lowest frequency?',
    explanation:
      'Radio waves sit at the long-wavelength, low-frequency, low-energy end of the electromagnetic spectrum.',
  },
  {
    chapterNumber: 4,
    questionText: 'How do we see objects around us according to modern scientific understanding?',
    explanation:
      'Vision occurs when light from a source strikes an object and reflects off it into our eyes (or is emitted directly by a luminous source).',
  },
  {
    chapterNumber: 4,
    questionText: 'If the angle between two plane mirrors is 120°, how many images are formed?',
    explanation:
      'Using n = (360° / θ) − 1: n = (360° / 120°) − 1 = 3 − 1 = 2 images.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which electromagnetic wave helps the skin produce vitamin D and is used to sterilize medical tools, air, and water by destroying bacteria and inhibiting viruses?',
    explanation:
      'Ultraviolet (UV) radiation stimulates vitamin D synthesis in human skin and kills bacteria/viruses for medical, water, and air sterilization.',
  },
  {
    chapterNumber: 4,
    questionText: 'A solar cell converts light energy into:',
    explanation:
      'Photovoltaic (solar) cells convert incident light energy directly into electrical energy.',
  },
  {
    chapterNumber: 4,
    questionText: 'In a uniform medium (such as air), light travels in:',
    explanation:
      'Within any uniform (homogeneous) medium, light propagates in straight lines until it hits a boundary or another medium.',
  },
  {
    chapterNumber: 4,
    questionText: 'Why is the word “AMBULANCE” written in reverse on the front of an ambulance?',
    explanation:
      'Plane mirrors reverse images left-to-right (lateral inversion), so reversed lettering appears upright and readable in a driver’s rearview mirror.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which wave in the electromagnetic spectrum has the shortest wavelength, highest frequency, and greatest energy?',
    explanation:
      'Gamma rays have the shortest wavelengths, highest frequencies, and highest photon energies in the electromagnetic spectrum.',
  },
  {
    chapterNumber: 4,
    questionText: 'What is the difference between primary and secondary sources of light?',
    explanation:
      'Primary (luminous) sources produce and emit their own light (like the Sun or a candle), whereas secondary (illuminated) sources only reflect light from other sources (like the Moon or a mirror).',
  },
  {
    chapterNumber: 4,
    questionText: 'What is the angle between two plane mirrors if the number of images formed is 7?',
    explanation:
      'From n = (360° / θ) − 1: 7 = (360° / θ) − 1, so 360° / θ = 8, giving θ = 360° / 8 = 45°.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which one of the following is NOT visible light?',
    explanation:
      'Ultraviolet lies beyond violet outside human vision, whereas red, blue, and indigo are colors of the visible light spectrum.',
  },
  {
    chapterNumber: 4,
    questionText: 'How do plants use light during photosynthesis?',
    explanation:
      'During photosynthesis, plants absorb light energy to convert carbon dioxide (CO₂) and water (H₂O) into food (glucose) while releasing oxygen.',
  },
  {
    chapterNumber: 4,
    questionText: 'Visible light lies between which two regions of the electromagnetic spectrum?',
    explanation:
      'In the electromagnetic spectrum, visible light sits directly between lower-frequency infrared waves and higher-frequency ultraviolet waves.',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the equation used to find the number of images (n) formed between two plane mirrors at an angle θ?',
    explanation:
      'The number of images formed by two plane mirrors inclined at angle θ is given by n = (360° / θ) − 1.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which color in the visible light spectrum has the longest wavelength and lowest frequency?',
    explanation:
      'Red has the longest wavelength (~700 nm) and lowest frequency among visible colors, while violet has the shortest wavelength (~400 nm) and highest frequency.',
  },
  {
    chapterNumber: 4,
    questionText: 'Light is refracted (changes direction) when it:',
    explanation:
      'Refraction occurs when light crosses the boundary between two media of different optical densities (such as from air into water), changing its speed and direction.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is the source of gamma rays?',
    explanation:
      'Gamma rays are emitted by nuclear reactions in the Sun, supernova explosions, and radioactive materials.',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the effect of decreasing the angle between two plane mirrors on the number of images formed?',
    explanation:
      'Because n = (360° / θ) − 1, decreasing the angle θ increases 360° / θ and therefore increases the number of reflected images formed.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which two fields make up electromagnetic waves?',
    explanation:
      'Electromagnetic waves consist of oscillating electric and magnetic fields perpendicular to each other and to the wave propagation direction.',
  },
  {
    chapterNumber: 4,
    questionText: 'Foods sterilized by gamma rays are safe to eat because:',
    explanation:
      'Gamma rays pass completely through the food to destroy microbes and do not stay behind or make the food radioactive.',
  },
  {
    chapterNumber: 4,
    questionText: 'How many colors does white light consist of?',
    explanation:
      'White light is a mixture of seven spectrum colors: red, orange, yellow, green, blue, indigo, and violet.',
  },
  {
    chapterNumber: 4,
    questionText:
      'How many images are formed between two plane mirrors when the angle between them is 36°?',
    explanation:
      'Using n = (360° / θ) − 1: n = (360° / 36°) − 1 = 10 − 1 = 9 images.',
  },
  {
    chapterNumber: 4,
    questionText: 'At airports, which type of ray is used for detailed detection of bags and items?',
    explanation:
      'Airport security scanners use X-rays because they penetrate soft bag materials and reveal denser metal or hidden objects inside.',
  },
  {
    chapterNumber: 4,
    questionText: 'The speed of light in a vacuum is:',
    explanation:
      'In a vacuum, light and all electromagnetic waves travel at c = 3 × 10⁸ m/s, which equals 3 × 10⁵ km/s.',
  },
  {
    chapterNumber: 4,
    questionText:
      'How do specular (regular) reflection and diffuse reflection compare in terms of angles of incidence and reflected rays?',
    explanation:
      'Both obey θ = θ′ locally, but a smooth surface reflects parallel incident rays in parallel (specular reflection), whereas a rough surface scatters them in many directions (diffuse reflection).',
  },
  {
    chapterNumber: 4,
    questionText: 'In which of the following is an infrared wave used?',
    explanation:
      'Infrared radiation is emitted by warm objects, so thermal cameras detect infrared waves to form heat images.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Classify the following sources as natural or artificial: (a) Candle, (b) Sun, (c) Volcanoes, (d) Laser.',
    explanation:
      'The Sun and volcanoes occur in nature (natural sources), whereas candles and lasers are human-made (artificial sources).',
  },
  {
    chapterNumber: 4,
    questionText: 'What does excessive exposure to X-rays do to the human body?',
    explanation:
      'X-rays carry high ionizing energy that can damage cellular DNA upon excessive exposure and elevate cancer risk.',
  },
  {
    chapterNumber: 4,
    questionText:
      'To form the image of a point in a plane mirror, what is the minimum number of light rays needed?',
    explanation:
      'At least 2 diverging rays reflected from the mirror are traced backward behind the mirror so their intersection locates the virtual image point.',
  },
  {
    chapterNumber: 4,
    questionText: 'Compare the wavelengths of infrared, visible light, and ultraviolet rays:',
    explanation:
      'Wavelength decreases as frequency increases across the spectrum: Infrared (> 700 nm) > Visible light (400–700 nm) > Ultraviolet (< 400 nm).',
  },
  {
    chapterNumber: 4,
    questionText: 'Which list shows the component colors of white light in order?',
    explanation:
      'Ordered from longest to shortest wavelength, the seven colors of white light are: Red, orange, yellow, green, blue, indigo, violet.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is a property of an image formed by a plane mirror?',
    explanation:
      'A plane mirror always produces a virtual, upright image of the same size as the object, at an equal distance behind the mirror, and laterally inverted.',
  },
  {
    chapterNumber: 4,
    questionText: 'Radio waves are used in:',
    explanation:
      'Radio waves carry long-distance communication signals for AM/FM radio and television broadcasting.',
  },
  {
    chapterNumber: 4,
    questionText: 'Compare the speed of light in a vacuum and in water:',
    explanation:
      'Light travels fastest in a vacuum (3 × 10⁸ m/s) and slows down when passing through denser material media such as water or glass.',
  },
  {
    chapterNumber: 4,
    questionText: 'Two devices that use microwaves are:',
    explanation:
      'Microwaves are used both for heating food in microwave ovens and for radar, satellite links, Wi-Fi, and mobile communications.',
  },
  {
    chapterNumber: 4,
    questionText: 'The two main types of mirrors by shape mentioned in the chapter are:',
    explanation:
      'Mirrors are primarily classified by surface shape into plane (flat) mirrors and spherical (curved concave/convex) mirrors.',
  },
  {
    chapterNumber: 4,
    questionText: 'How do electromagnetic waves in the spectrum differ from one another?',
    explanation:
      'All electromagnetic waves travel at 3 × 10⁸ m/s in a vacuum, so they differ in wavelength, frequency, and energy.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which choice gives a correct example of specular reflection and diffuse reflection?',
    explanation:
      'A smooth mirror produces clean specular reflection, whereas rough paper scatters light in diffuse reflection.',
  },
  {
    chapterNumber: 4,
    questionText:
      'What are some harms of excessive mobile phone use noted under Physics and Health?',
    explanation:
      'Prolonged screen exposure causes eye fatigue, dryness, redness, blurred vision, headaches, neck/back strain, and disrupted sleep.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which group lists only natural light sources?',
    explanation:
      'The Sun, stars, volcanoes, and bioluminescent organisms emit light naturally without human manufacturing.',
  },
  {
    chapterNumber: 4,
    questionText: 'The electromagnetic spectrum is defined as:',
    explanation:
      'The electromagnetic spectrum orders all electromagnetic waves continuously from longest wavelength (radio waves) to shortest wavelength (gamma rays).',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which statement accurately gives two differences between ultraviolet rays and visible light?',
    explanation:
      'Ultraviolet waves have shorter wavelengths and higher frequencies than visible light and cannot be seen by the human eye.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which choice lists three properties of light?',
    explanation:
      'Light travels in straight lines in a uniform medium, reflects off surfaces according to θ = θ′, and refracts when entering a medium of different density.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which waves have the highest energy and lowest energy in the electromagnetic spectrum, respectively?',
    explanation:
      'Energy increases with frequency: gamma rays carry the highest energy while radio waves carry the lowest energy.',
  },
  {
    chapterNumber: 4,
    questionText: 'How did humans in the past explain seeing objects, and how is it explained now?',
    explanation:
      'Early theories assumed rays emitted from the eyes toward objects; modern optics shows external light strikes objects and reflects into our eyes.',
  },
  {
    chapterNumber: 4,
    questionText: 'Why are X-rays used to image human bones and screen luggage at airports?',
    explanation:
      'X-rays have shorter wavelengths and higher penetrating energy than UV, passing through soft tissue/luggage fabric while being absorbed by denser bone or metal.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which group lists only artificial light sources?',
    explanation:
      'Electric bulbs, flashlights, candles, and lasers are all man-made (artificial) sources of light.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which choice gives four important roles of light in daily life?',
    explanation:
      'Light enables human vision, drives photosynthesis in plants, provides heat/solar energy, and powers modern technologies like lasers and fibre optics.',
  },
  {
    chapterNumber: 4,
    questionText:
      'When light passes from air into water, does it continue along its straight path, and why?',
    explanation:
      'No—because water is optically denser than air, light changes speed at the boundary and refracts (bends).',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following is an importance of light in medicine and health?',
    explanation:
      'Sunlight enables vitamin D synthesis for healthy bones, teeth, muscles, and immunity, while focused light/lasers are used in medical procedures.',
  },
  {
    chapterNumber: 4,
    questionText: 'All waves in the electromagnetic spectrum travel through a vacuum at:',
    explanation:
      'Every electromagnetic wave—from radio waves to gamma rays—travels through a vacuum at the same speed: c = 3 × 10⁸ m/s.',
  },
  {
    chapterNumber: 4,
    questionText: 'Infrared (IR) waves lie between microwaves and visible light, and are used in:',
    explanation:
      'Infrared radiation is used in remote controls, thermal night-vision cameras, muscle-therapy heat lamps, and industrial paint drying.',
  },
  {
    chapterNumber: 4,
    questionText: 'Light is an electromagnetic wave consisting of:',
    explanation:
      'As a transverse electromagnetic wave, light consists of electric and magnetic fields oscillating perpendicular to each other and to the direction of travel.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Which of the following is NOT one of the fundamental properties of light listed in the text?',
    explanation:
      'Light actually slows down inside denser media like glass compared with a vacuum—it never travels faster in glass than in a vacuum.',
  },
  {
    chapterNumber: 4,
    questionText: 'Which type of electromagnetic wave helps the body produce Vitamin D in the skin?',
    explanation:
      'Ultraviolet (UV) rays in sunlight trigger vitamin D production in the skin.',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the difference between primary and secondary sources of light? (Chapter Review Q16)',
    explanation:
      'Primary sources generate and emit their own light (Sun, candle), while secondary sources reflect light that falls on them (Moon, mirror).',
  },
  {
    chapterNumber: 4,
    questionText: 'Which of the following waves has the longest wavelength? (Chapter Review Q2)',
    explanation:
      'Among microwaves, radio waves, infrared, and X-rays, radio waves have the longest wavelength.',
  },
  {
    chapterNumber: 4,
    questionText: 'A light wave is defined as a type of electromagnetic wave that:',
    explanation:
      'Visible light is the narrow band of electromagnetic waves detectable by the human eye.',
  },
  {
    chapterNumber: 4,
    questionText: 'Ultraviolet light is also used in security technology to:',
    explanation:
      'Security inks fluoresce under ultraviolet lamps, allowing quick detection of counterfeit banknotes and forged documents.',
  },
  {
    chapterNumber: 4,
    questionText: 'In industry, gamma rays are used to:',
    explanation:
      'High-penetration gamma rays inspect thick metal castings and welds to detect hidden cracks and structural defects.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Most mirrors are made of glass whose back side is coated with a thin layer of metal, such as:',
    explanation:
      'Standard mirrors coat the back surface of smooth glass with highly reflective silver or aluminum.',
  },
  {
    chapterNumber: 4,
    questionText:
      'A ray of light that strikes a plane mirror perpendicularly (along the normal line) is reflected:',
    explanation:
      'When a ray strikes along the normal, the angle of incidence is θ = 0°, so θ′ = 0° and it reflects straight back along the same path.',
  },
  {
    chapterNumber: 4,
    questionText:
      'What is the wavelength range of visible light shown in the electromagnetic spectrum?',
    explanation:
      'The human eye detects electromagnetic waves with wavelengths between approximately 400 nm (violet) and 700 nm (red).',
  },
  {
    chapterNumber: 4,
    questionText:
      'In communication technology, which optical component is used to transmit data at the speed of light?',
    explanation:
      'Fibre optic cables carry pulses of light via internal reflection to transmit high-speed communication data.',
  },
  {
    chapterNumber: 4,
    questionText:
      'Why must gamma rays be used under the supervision of specialists even though they have many benefits?',
    explanation:
      'Because gamma rays carry extremely high ionizing energy, uncontrolled exposure can severely damage living cells and organisms.',
  },
  {
    chapterNumber: 4,
    questionText:
      'If two plane mirrors are placed perpendicular to each other (θ = 90°), how many images are formed?',
    explanation:
      'Using n = (360° / θ) − 1: n = (360° / 90°) − 1 = 4 − 1 = 3 images.',
  },
];

export function populateMissingExplanations4(): void {
  const alreadyDone = db
    .prepare("SELECT value FROM app_settings WHERE key = 'seeded_explanations_ch4_v1'")
    .get() as { value: string } | undefined;

  if (alreadyDone?.value === 'true') {
    return;
  }

  const updateStmt = db.prepare(
    `UPDATE questions
     SET explanation = ?
     WHERE scope = 'chapter'
       AND chapter_number = ?
       AND question_text = ?
       AND (explanation IS NULL OR TRIM(explanation) = '')`
  );

  const tx = db.transaction(() => {
    for (const item of CHAPTER_4_EXPLANATIONS) {
      updateStmt.run(item.explanation, item.chapterNumber, item.questionText);
    }
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seeded_explanations_ch4_v1', 'true')"
    ).run();
  });

  tx();
}
