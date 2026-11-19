import { db } from './db.ts';

// Keyed by (chapter_number + question_text) so every seeded question gets an accurate physics explanation
const EXPLANATIONS: Array<{
  chapterNumber: 1 | 2 | 3;
  questionText: string;
  explanation: string;
}> = [
  // ================= CHAPTER 1: WORK, POWER, AND MACHINES =================
  {
    chapterNumber: 1,
    questionText: 'Which of the following conditions must be met for work to be done on an object?',
    explanation: 'In physics, mechanical work (W = F · d) requires both an applied force and a displacement of the object in the direction of that force. If the object does not move or moves perpendicular to the force, zero work is done.',
  },
  {
    chapterNumber: 1,
    questionText: 'What is the SI unit of work?',
    explanation: 'Work is measured in Joules (J), where 1 Joule equals 1 Newton-meter (1 N·m). Watt is the unit of power, Newton is force, and Pascal is pressure.',
  },
  {
    chapterNumber: 1,
    questionText: 'How much work is done when a force of 10 N pushes a box a distance of 5 m in the direction of the force?',
    explanation: 'Using the work formula W = F · d: W = 10 N × 5 m = 50 J.',
  },
  {
    chapterNumber: 1,
    questionText: 'Power is defined as:',
    explanation: 'Power (P = W / Δt) is the rate at which work is done or energy is transferred per unit of time.',
  },
  {
    chapterNumber: 1,
    questionText: 'If a machine does 200 J of work in 4 seconds, what is its power output?',
    explanation: 'Using P = W / Δt: P = 200 J / 4 s = 50 W (Watts). Note that 50 J has the wrong unit (energy/work, not power).',
  },
  {
    chapterNumber: 1,
    questionText: 'Is work being done on a briefcase as a person carries it horizontally at constant speed?',
    explanation: 'No mechanical work is done on the briefcase because the upward supporting force is perpendicular (90°) to the horizontal displacement.',
  },
  {
    chapterNumber: 1,
    questionText: 'What is the unit of power?',
    explanation: 'The SI unit of power is the Watt (W), equal to one Joule per second (1 J/s). Joule measures work/energy and Newton measures force.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which of the following equations is correct for power (P)?',
    explanation: 'Power equals work divided by time (P = W / Δt). Since W = F · d, substituting gives P = (F · d) / Δt. Therefore both (B) and (C) are correct.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which of the following equations is correct for work (W)?',
    explanation: 'Work equals force times displacement in the direction of force (W = F · d), and from P = W / Δt we also get W = P · Δt. Therefore both (A) and (B) are correct.',
  },
  {
    chapterNumber: 1,
    questionText: 'What is the primary purpose of using a simple machine?',
    explanation: 'Simple machines make work easier by changing the magnitude (size) or direction of an applied force—they do not reduce the total work required or create energy.',
  },
  {
    chapterNumber: 1,
    questionText: 'A lever is classified into first, second, or third class based on the relative positions of which three points?',
    explanation: 'Levers are classified as first, second, or third class depending on which of the three points—Load, Fulcrum, and Effort—lies in the middle.',
  },
  {
    chapterNumber: 1,
    questionText: 'Identify the class of lever where the fulcrum is located between the effort and the load (such as a seesaw).',
    explanation: 'In a first-class lever (such as a seesaw or scissors), the fulcrum sits between the applied effort and the load.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which class of levers has a force advantage that is always greater than one?',
    explanation: 'In a second-class lever, the load is between the fulcrum and the effort, so the effort arm is always longer than the load arm, giving a force advantage greater than 1.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which of the following is an everyday example of a second-class lever?',
    explanation: 'A wheelbarrow has the wheel (fulcrum) at the front, the load in the middle, and the effort at the handles—making it a second-class lever.',
  },
  {
    chapterNumber: 1,
    questionText: 'How does an inclined plane make work easier?',
    explanation: 'An inclined plane reduces the input force needed to raise a load by spreading that force over a longer ramp distance.',
  },
  {
    chapterNumber: 1,
    questionText: 'A wedge is a simple machine formed by joining __________, producing a sharp edge.',
    explanation: 'A wedge consists of two inclined planes joined back-to-back to form a sharp cutting or splitting edge.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which simple machine consists of two inclined planes placed back-to-back and is used to split or cut objects?',
    explanation: 'A wedge is formed from two back-to-back inclined planes designed to push materials apart when driven forward.',
  },
  {
    chapterNumber: 1,
    questionText: 'What type of simple machine is an axe blade or knife edge acting as?',
    explanation: 'An axe blade and knife edge are sharp wedges that convert downward force into outward splitting forces.',
  },
  {
    chapterNumber: 1,
    questionText: 'A wheel and axle is best described as:',
    explanation: 'A wheel and axle consists of two circular objects of different radii (the larger wheel and smaller axle) fixed together so they rotate around the same axis.',
  },
  {
    chapterNumber: 1,
    questionText: '__________ is a simple machine that consists of an inclined surface wrapped around a cylindrical shaft and is used to fasten objects by converting __________ motion into linear motion.',
    explanation: 'A screw is an inclined plane wrapped spirally around a cylinder; turning it converts rotational motion into strong linear fastening or lifting motion.',
  },
  {
    chapterNumber: 1,
    questionText: 'In a screw, the smaller the distance between the threads, the __________ force advantage will be __________.',
    explanation: 'Smaller spacing (pitch) between screw threads means a gentler spiral slope over more turns, producing a greater force advantage.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which of the following devices is an application of a screw?',
    explanation: 'Both jar lids and drill bits use spiral threads wrapped around a cylinder, making them practical applications of a screw.',
  },
  {
    chapterNumber: 1,
    questionText: 'The historical water screw (Archimedean screw) was invented by:',
    explanation: 'The ancient Greek scientist and mathematician Archimedes invented the Archimedean water screw to raise water for irrigation.',
  },
  {
    chapterNumber: 1,
    questionText: 'Which of the following are examples of compound machines?',
    explanation: 'A bicycle, robot, and automobile each combine multiple simple machines (levers, wheels and axles, screws, pulleys), so all of them are compound machines.',
  },
  {
    chapterNumber: 1,
    questionText: 'Force Advantage vs. Velocity Advantage in Simple Machines:',
    explanation: 'All three statements accurately summarize how inclined ramps (FA > 1), wheelbarrows (second-class lever, FA > 1), and third-class levers (VA > 1) operate.',
  },

  // ================= CHAPTER 2: ENERGY =================
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2024 - Term 1] An electrical battery converts chemical energy into:',
    explanation: 'Inside a battery, chemical reactions release electrons to produce electrical energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'Which of the following is classified as a NON-RENEWABLE energy resource?',
    explanation: 'Fossil fuels such as petroleum and coal take millions of years to form and cannot be replaced as quickly as they are consumed, unlike solar, wind, and hydroelectric energy.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2025 - Term 2] What is the kinetic energy of a car with a mass of 2000 kg moving at a speed of 10 m/s?',
    explanation: 'Using KE = 1/2 · m · v²: KE = 1/2 × 2000 kg × (10 m/s)² = 1000 × 100 = 100,000 J.',
  },
  {
    chapterNumber: 2,
    questionText: 'The kinetic energy of a moving body does NOT depend on:',
    explanation: 'Kinetic energy depends only on mass and speed (KE = 1/2 · m · v²); physical size or volume does not appear in the kinetic energy equation.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2023 - Term 1] What is the gravitational potential energy of a diver who weighs 500 N standing on a platform 10 m above water?',
    explanation: 'Using GPE = Weight × height (m·g·h): GPE = 500 N × 10 m = 5000 J.',
  },
  {
    chapterNumber: 2,
    questionText: "An engineer uses an elevator while a worker uses stairs to reach the 3rd floor. Assuming equal mass, whose potential energy is greater?",
    explanation: 'Gravitational potential energy (GPE = m·g·h) depends only on mass, gravity, and height—not the path taken. Because both reach the same floor with equal mass, their potential energies are equal.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2026 - Term 1] Which of the following relationships is the correct way to calculate kinetic energy?',
    explanation: 'The kinetic energy formula is one-half times mass times speed squared: KE = 1/2 m·v².',
  },
  {
    chapterNumber: 2,
    questionText: 'A bullet of mass 0.1 kg moves at 200 m/s. What is its kinetic energy?',
    explanation: 'Using KE = 1/2 · m · v²: KE = 1/2 × 0.1 kg × (200 m/s)² = 0.05 × 40,000 = 2000 J.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2024 - Term 2] When a rubber band is stretched, the energy stored in it as a result of shape change is:',
    explanation: 'Deforming an elastic object like a rubber band or spring stores elastic potential energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'Electrical energy is transferred across distances by means of:',
    explanation: 'Electrical energy travels across power grids through transmission lines and electromagnetic waves.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2025 - Term 1] Joules (J) is the unit of measurement for:',
    explanation: 'Work is a transfer of energy, so both energy and work are measured in Joules (J) in the SI system.',
  },
  {
    chapterNumber: 2,
    questionText: 'A boat and a ship move in a river at the exact same speed. Which one has greater kinetic energy?',
    explanation: 'Since KE = 1/2 · m · v² and both move at the same speed, the ship has greater kinetic energy because it has much greater mass.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2023 - Term 2] What is the gravitational potential energy of a book with a weight of 13 N at a height of 1.5 m?',
    explanation: 'Using GPE = Weight × height: GPE = 13 N × 1.5 m = 19.5 J.',
  },
  {
    chapterNumber: 2,
    questionText: 'An energy resource that is replaced by natural processes as fast as or faster than it is consumed is called:',
    explanation: 'Renewable energy resources (such as sunlight, wind, and flowing water) are continuously replenished by nature.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2026 - Term 1] What is the kinetic energy of a 1000 kg elephant running at a speed of 4 m/s?',
    explanation: 'Using KE = 1/2 · m · v²: KE = 1/2 × 1000 kg × (4 m/s)² = 500 × 16 = 8,000 J.',
  },
  {
    chapterNumber: 2,
    questionText: 'Which of the following is NOT considered a source of chemical energy?',
    explanation: 'A solar cell converts light (radiant) energy directly into electrical energy—it does not store chemical energy like crude oil, coal, or a battery.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2024 - Term 1] Which sentence describes a conversion from chemical energy to thermal energy?',
    explanation: 'Burning charcoal, burning coal for steam, and metabolizing food to maintain body warmth all convert stored chemical energy into thermal energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'Total energy in system is 1500 J. If light and sound account for 700 J, heat energy equals:',
    explanation: 'By conservation of energy: Heat energy = Total energy − (light + sound) = 1500 J − 700 J = 800 J.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2025 - Term 2] The gravitational potential energy of an object depends directly on:',
    explanation: 'Because GPE = (m·g) · h = Weight × Height, it depends directly on the object’s weight and its height above the reference level.',
  },
  {
    chapterNumber: 2,
    questionText: 'The amount of work done on a body depends on:',
    explanation: 'Work depends on the magnitude of the force, the magnitude of the displacement, and the angle/direction between force and displacement.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2023 - Term 1] Which of the following is a standard SI unit for Gravitational Potential energy (GPE)?',
    explanation: 'All forms of energy, including gravitational potential energy, are measured in Joules (J).',
  },
  {
    chapterNumber: 2,
    questionText: 'What type of energy is stored inside gasoline chemical bonds?',
    explanation: 'Gasoline stores chemical energy within its molecular bonds, which is released during combustion.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2024 - Term 2] When energy changes from one form to another, some of the energy always changes into:',
    explanation: 'Due to friction and resistance in real energy conversions, a portion of the energy is always transformed into thermal energy (heat).',
  },
  {
    chapterNumber: 2,
    questionText: 'A player has mass 40 kg and kinetic energy 500 J. What is the speed of the player?',
    explanation: 'From KE = 1/2 · m · v²: 500 = 1/2 × 40 × v² → 500 = 20 v² → v² = 25 → v = 5 m/s.',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2026 - Term 1] Which of the following physical statements is correct?',
    explanation: 'Energy is the capacity to do work, is expressed in Joules (J), and work equals energy transfer—so all three statements are correct.',
  },
  {
    chapterNumber: 2,
    questionText: 'What type of energy is stored in a compressed or stretched spring?',
    explanation: 'Compressing or stretching a spring stores elastic potential energy that is released when the spring returns to its original shape.',
  },
  {
    chapterNumber: 2,
    questionText: 'What happens to gravitational potential energy when elevation above ground increases?',
    explanation: 'Since GPE = m·g·h, increasing the height h increases the gravitational potential energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'Which statement best describes the relationship between work and energy?',
    explanation: 'Doing work on an object transfers energy to or from it, and both quantities share the SI unit of Joules (J).',
  },
  {
    chapterNumber: 2,
    questionText: '[Ministerial Exam 2025 - Term 1] The unit of measurement for kinetic energy (KE) in SI units is:',
    explanation: 'Kinetic energy is a form of mechanical energy and is measured in Joules (J).',
  },
  {
    chapterNumber: 2,
    questionText: 'When a ball is thrown vertically upward, what energy conversion takes place as it rises?',
    explanation: 'As the ball climbs and slows down, its kinetic energy is converted into gravitational potential energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'A box of mass 10 kg has PE = 300 J on a shelf. Height of shelf? (g = 10 m/s²)',
    explanation: 'Using PE = m·g·h: h = PE / (m·g) = 300 / (10 × 10) = 300 / 100 = 3 m.',
  },
  {
    chapterNumber: 2,
    questionText: 'Potential energy of a 12 kg bag held 1.5 m above ground? (g = 9.8 m/s²)',
    explanation: 'Using PE = m·g·h: PE = 12 kg × 9.8 m/s² × 1.5 m = 176.4 J.',
  },
  {
    chapterNumber: 2,
    questionText: 'What is the condition for conservation of energy in an isolated system?',
    explanation: 'In an isolated (closed) system, no energy enters or leaves from outside, so the total amount of energy remains constant.',
  },
  {
    chapterNumber: 2,
    questionText: 'Elastic potential energy is stored in an object when:',
    explanation: 'Elastic potential energy is stored whenever an elastic body changes shape—whether stretched (length increases) or compressed (length decreases).',
  },
  {
    chapterNumber: 2,
    questionText: 'The joule is the standard SI unit of measurement for:',
    explanation: 'The Joule (J) is the SI unit for both Work and Energy.',
  },
  {
    chapterNumber: 2,
    questionText: 'The kinetic energy of a body depends on:',
    explanation: 'From KE = 1/2 · m · v², kinetic energy depends on both the speed and the mass of the body.',
  },
  {
    chapterNumber: 2,
    questionText: 'Which of the following statements regarding energy is incorrect?',
    explanation: 'By the Law of Conservation of Energy, energy can neither be created nor destroyed—so claiming "Energy is created, but not destroyed" is incorrect.',
  },

  // ================= CHAPTER 3: HEAT & TEMPERATURE =================
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 1] What does temperature fundamentally measure in a substance?',
    explanation: 'Temperature is a measure of the average kinetic energy of the particles moving inside a substance.',
  },
  {
    chapterNumber: 3,
    questionText: 'When the particles of a substance move faster, what happens to its temperature?',
    explanation: 'Faster-moving particles have higher average kinetic energy, which directly means a higher temperature.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2025 - Term 2] Which of the following is NOT a unit of temperature?',
    explanation: 'Joule (J) is the unit of energy and heat, whereas °C, K, and °F are temperature scales.',
  },
  {
    chapterNumber: 3,
    questionText: 'What happens to the constituent particles of a solid object when its temperature increases?',
    explanation: 'Particles in a solid remain in fixed lattice positions, so heating them makes them vibrate faster around those positions.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2023 - Term 1] Why do civil engineers leave expansion gaps between sections of railway tracks and bridges?',
    explanation: 'Metals expand thermally in hot weather; leaving expansion gaps prevents rails and bridge decks from buckling.',
  },
  {
    chapterNumber: 3,
    questionText: 'Heat energy is naturally transferred spontaneously from:',
    explanation: 'Thermal energy flows naturally from regions of higher temperature (hot objects) to regions of lower temperature (cold objects).',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2026 - Term 1] Which of the following examples best demonstrates thermal expansion in gases?',
    explanation: 'Air inside a balloon is a gas; heating it increases particle speed and spacing, causing the balloon to expand.',
  },
  {
    chapterNumber: 3,
    questionText: 'Which of the following temperature values represents the HIGHEST temperature?',
    explanation: 'Converting all to Celsius: 100 °C = 100 °C, 100 °F ≈ 37.8 °C, 350 K = 76.85 °C, and 200 K = -73.15 °C. Thus 100 °C is highest.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 2] Two bodies at different temperatures are placed in thermal contact. Heat transfer continues until:',
    explanation: 'Heat flows from the warmer body to the cooler body until both reach the exact same temperature, known as thermal equilibrium.',
  },
  {
    chapterNumber: 3,
    questionText: 'A 1 kg piece of aluminum at 100 °C absorbs 900 J of heat. If its specific heat capacity is 900 J/(kg·°C), what is its final temperature?',
    explanation: 'Using Q = m·c·ΔT: ΔT = Q / (m·c) = 900 / (1 × 900) = 1 °C. Final temperature = 100 °C + 1 °C = 101 °C.',
  },
  {
    chapterNumber: 3,
    questionText: 'Why is human touch unreliable for determining the exact temperature of an object?',
    explanation: 'Human skin senses how fast heat enters or leaves the skin (rate of heat transfer), not the object’s true temperature.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2025 - Term 1] Why is the Celsius temperature scale referred to as a "centigrade" scale?',
    explanation: '"Centigrade" means 100 steps—the Celsius scale divides the interval between water’s freezing point (0 °C) and boiling point (100 °C) into 100 equal degrees.',
  },
  {
    chapterNumber: 3,
    questionText: 'Why can a mercury thermometer NOT be used to measure temperatures below -39 °C?',
    explanation: 'Mercury freezes into a solid at -39 °C, so it can no longer expand or contract as a liquid below that temperature.',
  },
  {
    chapterNumber: 3,
    questionText: 'What is a metallic (bimetallic) thermometer made of, and how does it operate?',
    explanation: 'A bimetallic strip bonds two different metals with different expansion rates; when heated, one expands more than the other, bending the strip to move the dial.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2023 - Term 2] What is -40 °C equal to in the Fahrenheit temperature scale?',
    explanation: 'Using T_F = (9/5) T_C + 32: T_F = (9/5)(-40) + 32 = -72 + 32 = -40 °F. Celsius and Fahrenheit meet at -40°.',
  },
  {
    chapterNumber: 3,
    questionText: 'Convert the boiling point of liquid hydrogen (-252.87 °C) to the Kelvin scale:',
    explanation: 'Using T_K = T_C + 273.0 (or + 273): -252.87 + 273 = 20.13 K.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2026 - Term 1] The melting point of gold is 1947 °F. What is this temperature in Kelvin?',
    explanation: 'First convert °F to °C: T_C = (5/9)(1947 − 32) = 1063.89 °C. Then T_K = 1063.89 + 273 = 1336.9 K.',
  },
  {
    chapterNumber: 3,
    questionText: 'What is the normal body temperature of a healthy human in °C and °F?',
    explanation: 'Normal healthy human body temperature is 37 °C, which equals (9/5)(37) + 32 = 98.6 °F.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 1] How much heat is absorbed by a 2 kg piece of iron heated from 20 °C to 50 °C? (c_iron = 448 J/kg·°C)',
    explanation: 'Using Q = m·c·ΔT: ΔT = 50 − 20 = 30 °C. Q = 2 × 448 × 30 = 26,880 J.',
  },
  {
    chapterNumber: 3,
    questionText: 'A piece of gold absorbs 208 J of heat, rising from 25 °C to 65 °C. What is its mass? (c_gold = 129 J/kg·°C)',
    explanation: 'Using m = Q / (c·ΔT): ΔT = 65 − 25 = 40 °C. m = 208 / (129 × 40) = 208 / 5160 ≈ 0.04 kg.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2025 - Term 2] An object absorbs 6750 J of heat, causing its temperature to rise by 15 °C. If mass is 0.5 kg, find its specific heat:',
    explanation: 'Using c = Q / (m·ΔT): c = 6750 / (0.5 × 15) = 6750 / 7.5 = 900 J/kg·°C.',
  },
  {
    chapterNumber: 3,
    questionText: 'An object has a temperature of 48 °F. What is its temperature in degrees Celsius (°C)?',
    explanation: 'Using T_C = (5/9)(T_F − 32): T_C = (5/9)(48 − 32) = (5/9)(16) = 80/9 ≈ 8.89 °C.',
  },
  {
    chapterNumber: 3,
    questionText: "[Ministerial Exam 2023 - Term 1] Express a child's body temperature of 38 °C in degrees Fahrenheit (°F):",
    explanation: 'Using T_F = (9/5) T_C + 32: T_F = (9/5)(38) + 32 = 68.4 + 32 = 100.4 °F.',
  },
  {
    chapterNumber: 3,
    questionText: 'What three quantities are required to calculate the amount of heat gained or lost by an object?',
    explanation: 'From Q = m·c·ΔT, calculating heat requires mass (m), specific heat capacity (c), and temperature change (ΔT).',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2026 - Term 1] Why is water widely used as a coolant in vehicle engines?',
    explanation: 'Water has an unusually high specific heat capacity (4186 J/kg·°C), allowing it to absorb large amounts of engine heat with only a modest rise in temperature.',
  },
  {
    chapterNumber: 3,
    questionText: 'What is the fundamental working principle behind alcohol, mercury, and liquid thermometers?',
    explanation: 'Liquid-in-glass thermometers operate via thermal expansion and contraction: the liquid column rises when heated and falls when cooled.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 2] An electric heater heats 2 kg of water, raising its temperature by 50 °C. Calculate energy used: (c = 4186 J/kg·°C)',
    explanation: 'Using Q = m·c·ΔT: Q = 2 × 4186 × 50 = 418,600 J.',
  },
  {
    chapterNumber: 3,
    questionText: 'A pool contains 4000 kg of water at 17 °C. Sunlight raises it to 19 °C. Calculate absorbed heat: (c = 4186 J/kg·°C)',
    explanation: 'Using Q = m·c·ΔT: ΔT = 19 − 17 = 2 °C. Q = 4000 × 4186 × 2 = 33,488,000 J.',
  },
  {
    chapterNumber: 3,
    questionText: 'Convert the freezing point of water (0 °C) into degrees Fahrenheit (°F):',
    explanation: 'Using T_F = (9/5)(0) + 32 = 32 °F.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2025 - Term 1] Convert the boiling point of water (373 K) into degrees Celsius (°C):',
    explanation: 'Using T_C = T_K − 273: T_C = 373 − 273 = 100 °C.',
  },
  {
    chapterNumber: 3,
    questionText: 'Why is an alcohol thermometer NOT suitable for measuring temperatures above 78 °C?',
    explanation: 'Alcohol boils at 78 °C, so above this temperature it vaporizes and cannot give accurate liquid-column readings.',
  },
  {
    chapterNumber: 3,
    questionText: 'Why does a swimming pool filled with cool water store more total thermal energy than a hot cup of coffee?',
    explanation: 'Total thermal energy depends on both particle kinetic energy and the total number of particles (mass). A swimming pool has vastly more water molecules than a cup of coffee.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2023 - Term 2] How much heat is released when 50 g (0.05 kg) of mercury cools from 130 °C to 20 °C? (c_mercury = 140 J/kg·°C)',
    explanation: 'Using Q = m·c·ΔT: ΔT = 130 − 20 = 110 °C. Q = 0.05 × 140 × 110 = 770 J.',
  },
  {
    chapterNumber: 3,
    questionText: 'Copper absorbs 1300 J of heat, causing a temperature rise of 10 °C. Find mass if c_copper = 387 J/kg·°C:',
    explanation: 'Using m = Q / (c·ΔT): m = 1300 / (387 × 10) = 1300 / 3870 ≈ 0.336 kg.',
  },
  {
    chapterNumber: 3,
    questionText: '2 kg of water is supplied with 8372 J of heat, reaching a final temperature of 50 °C. Find initial temperature: (c = 4186 J/kg·°C)',
    explanation: 'Official Answer Key: A (48 °C). Note: using Q = m·c·ΔT gives ΔT = 8372 / (2 × 4186) = 1 °C, which yields T_initial = 50 − 1 = 49 °C (B), while the provided Official Answer Key Grid records A (48 °C).',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 1] What is the equivalent of absolute zero (0 K) on the Celsius temperature scale?',
    explanation: 'Using T_C = T_K − 273.15: at 0 K, T_C = -273.15 °C (absolute zero).',
  },
  {
    chapterNumber: 3,
    questionText: 'Which state of matter expands the most when heated for a given increase in temperature?',
    explanation: 'Gas molecules have weak intermolecular forces and move freely, so gases expand much more than liquids or solids for the same temperature rise.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2025 - Term 2] Heat capacity depends on which two factors?',
    explanation: 'Heat capacity (C = m·c) is the product of an object’s mass (m) and its material’s specific heat capacity (c).',
  },
  {
    chapterNumber: 3,
    questionText: 'Convert 300 K to degrees Celsius (°C):',
    explanation: 'Using T_C = T_K − 273.15: T_C = 300 − 273.15 = 26.85 °C.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2026 - Term 1] If two objects are in thermal equilibrium, what can be stated about their net heat transfer?',
    explanation: 'Objects in thermal equilibrium are at the same temperature, so net heat transfer between them is zero.',
  },
  {
    chapterNumber: 3,
    questionText: 'What is 20 °C expressed in the Kelvin scale?',
    explanation: 'Using T_K = T_C + 273.15: T_K = 20 + 273.15 = 293.15 K.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2023 - Term 1] Which metal requires the LEAST amount of heat to raise the temperature of 1 kg by 1 °C?',
    explanation: 'Specific heat capacity is the heat needed per kg per °C. Lead has the lowest specific heat capacity (128 J/kg·°C), so it requires the least heat.',
  },
  {
    chapterNumber: 3,
    questionText: 'Convert 68 °F into degrees Celsius (°C):',
    explanation: 'Using T_C = (5/9)(68 − 32) = (5/9)(36) = 20 °C.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2024 - Term 2] When water freezes into ice, heat is:',
    explanation: 'Freezing is an exothermic phase change: water molecules lose thermal energy and release heat to the surroundings to form solid ice.',
  },
  {
    chapterNumber: 3,
    questionText: 'How much heat is required to raise the temperature of 0.1 kg of lead by 10 °C? (c_lead = 128 J/kg·°C)',
    explanation: 'Using Q = m·c·ΔT: Q = 0.1 × 128 × 10 = 128 J.',
  },
  {
    chapterNumber: 3,
    questionText: "[Ministerial Exam 2025 - Term 1] Thermal energy of a body is the sum of its particles':",
    explanation: 'Internal thermal energy includes both the kinetic energy of particle motion and the potential energy of intermolecular forces.',
  },
  {
    chapterNumber: 3,
    questionText: 'Why does blowing gently on hot soup cool it down?',
    explanation: 'Blowing moves warm, humid air away from the surface, accelerating convective heat loss and evaporation.',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2026 - Term 1] If 500 J of heat is added to 0.2 kg of a substance and its temperature rises by 5 °C, what is its specific heat capacity?',
    explanation: 'Using c = Q / (m·ΔT): c = 500 / (0.2 × 5) = 500 / 1 = 500 J/kg·°C.',
  },
  {
    chapterNumber: 3,
    questionText: 'A thermometer calibrated in Kelvin reads 310 K. What is this in human body temperature terms?',
    explanation: 'Using T_C = 310 − 273.15 = 36.85 °C, which corresponds to normal human body temperature (~37 °C).',
  },
  {
    chapterNumber: 3,
    questionText: '[Ministerial Exam 2023 - Term 2] Which relationship is correct for converting Celsius temperature (T_C) to Fahrenheit (T_F)?',
    explanation: 'The exact Celsius-to-Fahrenheit conversion equation is T_F = (9/5) T_C + 32.',
  },
];

export function populateMissingExplanations123(): void {
  const alreadyDone = db
    .prepare("SELECT value FROM app_settings WHERE key = 'seeded_explanations_123_v1'")
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
    for (const item of EXPLANATIONS) {
      updateStmt.run(item.explanation, item.chapterNumber, item.questionText);
    }
    db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('seeded_explanations_123_v1', 'true')"
    ).run();
  });

  tx();
}
