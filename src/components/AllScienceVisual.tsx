import React from 'react';

interface AllScienceVisualProps {
  className?: string;
}

export const AllScienceVisual: React.FC<AllScienceVisualProps> = ({ className = '' }) => {
  return (
    <div
      role="img"
      aria-label="Animated Grade 9 Science visual illustrating physics light refraction and waves, chemistry molecules and bonds, biology cells and DNA, and earth layers with planetary orbits"
      className={`relative w-full h-full overflow-hidden select-none bg-gradient-to-br from-[#F7F2EA] via-[#F2E9DD] to-[#EAE0D2] dark:from-[#1B1516] dark:via-[#22191B] dark:to-[#2A1D20] ${className}`}
    >
      {/* Soft ambient radial glows matching warm neutral & deep burgundy palette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -start-10 w-56 h-56 rounded-full bg-[#6B1118]/10 dark:bg-[#9E2A34]/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-14 -end-10 w-60 h-60 rounded-full bg-[#D9A62E]/15 dark:bg-[#E5B742]/12 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.45)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(107,17,24,0.16)_0%,transparent_72%)]"
      />

      <svg
        viewBox="0 0 480 320"
        preserveAspectRatio="xMidYMid meet"
        className="relative z-10 w-full h-full block text-[#1C1917] dark:text-[#F5F1EB]"
      >
        <defs>
          {/* Soft spectrum refraction gradient (Physics) */}
          <linearGradient id="g9PrismSpectrum" x1="0%" y1="0%" x2="100%" y2="25%">
            <stop offset="0%" stopColor="#E5B742" stopOpacity="0.45" />
            <stop offset="35%" stopColor="#C84B52" stopOpacity="0.34" />
            <stop offset="70%" stopColor="#3B827E" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#5B6CA8" stopOpacity="0.16" />
          </linearGradient>

          {/* Earth outer surface & cutaway mantle/core gradients */}
          <linearGradient id="g9EarthSurface" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B7A75" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#26545B" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="g9EarthMantle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8F222B" />
            <stop offset="100%" stopColor="#6B1118" />
          </linearGradient>
          <linearGradient id="g9EarthCore" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F1C95A" />
            <stop offset="100%" stopColor="#D9A62E" />
          </linearGradient>

          {/* Wave gradient */}
          <linearGradient id="g9WaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6B1118" stopOpacity="0.1" />
            <stop offset="35%" stopColor="#6B1118" stopOpacity="0.55" />
            <stop offset="68%" stopColor="#D9A62E" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#D9A62E" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Subtle geometric coordinate rings in background */}
        <g opacity="0.18" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="3 5">
          <circle cx="240" cy="158" r="76" />
          <circle cx="240" cy="158" r="126" />
        </g>

        {/* 1. PHYSICS (Bottom/Center Wave Sweep + Top-Left Prism & Light Refraction) */}
        <g className="g9-science-wave">
          <path
            d="M 16 266 C 68 242, 112 288, 166 266 C 218 244, 266 286, 320 264 C 372 242, 418 282, 468 258"
            fill="none"
            stroke="url(#g9WaveGrad)"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M 24 276 C 80 256, 126 296, 180 274 C 232 252, 278 294, 334 272 C 388 252, 428 286, 466 268"
            fill="none"
            stroke="url(#g9WaveGrad)"
            strokeWidth="1"
            strokeOpacity="0.6"
            strokeLinecap="round"
          />
        </g>

        <g transform="translate(88 86)">
          <g className="g9-science-float-slow">
            {/* Incoming warm light beam */}
            <line
              x1="-64"
              y1="8"
              x2="-10"
              y2="-2"
              stroke="#D9A62E"
              strokeWidth="2"
              strokeOpacity="0.75"
              strokeLinecap="round"
            />
            {/* Refracted soft spectrum fan */}
            <g className="g9-science-spectrum">
              <polygon
                points="12,-4 86,-22 86,20 14,8"
                fill="url(#g9PrismSpectrum)"
              />
              <line x1="13" y1="-2" x2="84" y2="-16" stroke="#E5B742" strokeWidth="1.25" strokeOpacity="0.65" />
              <line x1="14" y1="2" x2="86" y2="0" stroke="#B83B45" strokeWidth="1.25" strokeOpacity="0.58" />
              <line x1="13" y1="6" x2="84" y2="15" stroke="#3B827E" strokeWidth="1.2" strokeOpacity="0.52" />
            </g>
            {/* Glass-style triangular prism */}
            <polygon
              points="0,-28 26,18 -26,18"
              fill="currentColor"
              fillOpacity="0.06"
              stroke="currentColor"
              strokeOpacity="0.45"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <polygon
              points="0,-22 18,13 -18,13"
              fill="none"
              stroke="#D9A62E"
              strokeOpacity="0.35"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* 2. EARTH & SPACE SCIENCE (Center Cutaway Earth Layers + Planetary Orbits) */}
        <g transform="translate(240 158)">
          {/* Concentric orbital tracks */}
          <circle
            r="106"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1.1"
          />
          <circle
            r="72"
            fill="none"
            stroke="#D9A62E"
            strokeOpacity="0.3"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {/* Subtle tilted planetary ring */}
          <ellipse
            cx="0"
            cy="0"
            rx="56"
            ry="15"
            transform="rotate(-20)"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.18"
            strokeWidth="1"
          />

          {/* Orbiting planet 1 on outer ring (r=106) */}
          <g className="g9-science-orbit-cw">
            <g transform="translate(92 -53)">
              <circle r="5.5" fill="#D9A62E" />
              <circle r="9" fill="none" stroke="#D9A62E" strokeOpacity="0.32" strokeWidth="1" />
            </g>
          </g>

          {/* Orbiting moon 2 on inner ring (r=72) */}
          <g className="g9-science-orbit-ccw">
            <g transform="translate(-51 51)">
              <circle r="4.2" fill="#8F222B" className="dark:fill-[#F2A7AE]" />
            </g>
          </g>

          {/* Earth globe with clean cutaway showing Crust, Mantle & Core */}
          <circle r="38" fill="url(#g9EarthSurface)" />
          {/* Subtle atmospheric rim */}
          <circle r="43" fill="none" stroke="#3B7A75" strokeOpacity="0.28" strokeWidth="1.2" />
          {/* Continent silhouettes */}
          <path
            d="M -28 -12 C -20 -20, -8 -18, -6 -8 C -4 0, -14 6, -12 16 C -18 18, -28 10, -28 -12 Z"
            fill="#F4EFE8"
            fillOpacity="0.32"
          />
          <path
            d="M -18 22 C -10 20, -2 24, 4 30 C -4 34, -14 32, -18 22 Z"
            fill="#F4EFE8"
            fillOpacity="0.25"
          />

          {/* Earth layers cutaway wedge (upper-right quadrant) */}
          <path d="M 0 0 L 0 -38 A 38 38 0 0 1 38 0 Z" fill="#EFE9DF" fillOpacity="0.92" />
          <path d="M 0 0 L 0 -34 A 34 34 0 0 1 34 0 Z" fill="url(#g9EarthMantle)" />
          <path d="M 0 0 L 0 -20 A 20 20 0 0 1 20 0 Z" fill="#D97724" fillOpacity="0.92" />
          <path d="M 0 0 L 0 -10 A 10 10 0 0 1 10 0 Z" fill="url(#g9EarthCore)" />
          <circle r="38" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.25" />
        </g>

        {/* 3. CHEMISTRY (Top-Right Molecular Structure & Chemical Bonds) */}
        <g transform="translate(388 86)">
          <g className="g9-science-float-alt">
            {/* Connecting covalent bonds */}
            <g stroke="currentColor" strokeOpacity="0.38" strokeWidth="1.5" strokeLinecap="round">
              <polygon
                points="0,-24 21,-12 21,12 0,24 -21,12 -21,-12"
                fill="currentColor"
                fillOpacity="0.04"
              />
              {/* Double bond accents inside ring */}
              <line x1="-15" y1="-8" x2="-15" y2="8" strokeOpacity="0.45" />
              <line x1="2" y1="-18" x2="15" y2="-10" strokeOpacity="0.45" />
              <line x1="15" y1="10" x2="2" y2="18" strokeOpacity="0.45" />
              {/* Side branch bonds */}
              <line x1="21" y1="-12" x2="40" y2="-22" />
              <line x1="-21" y1="12" x2="-38" y2="22" />
              <line x1="0" y1="-24" x2="0" y2="-40" />
            </g>
            {/* Atom nodes */}
            <circle cx="0" cy="-24" r="4.5" fill="#6B1118" className="dark:fill-[#F2A7AE]" />
            <circle cx="21" cy="-12" r="4" fill="#D9A62E" />
            <circle cx="21" cy="12" r="4" fill="#6B1118" className="dark:fill-[#F2A7AE]" />
            <circle cx="0" cy="24" r="4.5" fill="#3B7A75" />
            <circle cx="-21" cy="12" r="4" fill="#D9A62E" />
            <circle cx="-21" cy="-12" r="4" fill="#6B1118" className="dark:fill-[#F2A7AE]" />
            {/* Outer bonded atoms */}
            <circle cx="40" cy="-22" r="5" fill="#F4EFE8" stroke="#6B1118" strokeWidth="1.5" className="dark:fill-[#2A1D20] dark:stroke-[#F2A7AE]" />
            <circle cx="-38" cy="22" r="4.5" fill="#F4EFE8" stroke="#D9A62E" strokeWidth="1.5" className="dark:fill-[#2A1D20]" />
            <circle cx="0" cy="-40" r="3.8" fill="#D9A62E" />
          </g>
        </g>

        {/* 4. BIOLOGY (Bottom-Left Living Cell & Bottom-Right DNA Double Helix) */}
        {/* Living Cell */}
        <g transform="translate(86 226)">
          <g className="g9-science-breathe">
            {/* Outer cell membrane */}
            <path
              d="M -28,-10 C -30,-26 -10,-32 8,-28 C 26,-24 34,-8 30,10 C 26,26 8,32 -10,28 C -26,24 -26,8 -28,-10 Z"
              fill="#3B7A75"
              fillOpacity="0.12"
              stroke="#3B7A75"
              strokeOpacity="0.58"
              strokeWidth="1.5"
            />
            {/* Inner cytoplasm dashed ring */}
            <path
              d="M -22,-8 C -23,-20 -8,-25 6,-22 C 20,-19 26,-6 23,8 C 20,20 6,25 -8,22 C -20,19 -21,6 -22,-8 Z"
              fill="none"
              stroke="#3B7A75"
              strokeOpacity="0.28"
              strokeWidth="0.9"
              strokeDasharray="2 3"
            />
            {/* Nucleus & nucleolus */}
            <circle cx="2" cy="0" r="11" fill="#6B1118" fillOpacity="0.2" stroke="#6B1118" strokeOpacity="0.65" strokeWidth="1.3" className="dark:stroke-[#F2A7AE]" />
            <circle cx="4" cy="-1" r="4.2" fill="#6B1118" fillOpacity="0.72" className="dark:fill-[#F2A7AE]" />
            {/* Mitochondria & organelles */}
            <ellipse cx="-14" cy="11" rx="5" ry="2.6" transform="rotate(-28 -14 11)" fill="#D9A62E" fillOpacity="0.65" />
            <circle cx="17" cy="-11" r="2.2" fill="#D9A62E" fillOpacity="0.7" />
          </g>
        </g>

        {/* DNA Double Helix */}
        <g transform="translate(392 222) rotate(22)">
          <g className="g9-science-float-slow">
            {/* Base-pair rungs */}
            <g stroke="currentColor" strokeOpacity="0.34" strokeWidth="1.25" strokeLinecap="round">
              <line x1="-11" y1="-34" x2="11" y2="-34" />
              <line x1="-13" y1="-20" x2="13" y2="-20" />
              <line x1="-7" y1="-7" x2="7" y2="-7" />
              <line x1="-7" y1="7" x2="7" y2="7" />
              <line x1="-13" y1="20" x2="13" y2="20" />
              <line x1="-11" y1="34" x2="11" y2="34" />
            </g>
            {/* Helix backbone 1 */}
            <path
              d="M -13,-42 C -13,-24 13,-14 13,0 C 13,14 -13,24 -13,42"
              fill="none"
              stroke="#6B1118"
              strokeWidth="2.1"
              strokeLinecap="round"
              className="dark:stroke-[#F2A7AE]"
            />
            {/* Helix backbone 2 */}
            <path
              d="M 13,-42 C 13,-24 -13,-14 -13,0 C -13,14 13,24 13,42"
              fill="none"
              stroke="#D9A62E"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            {/* Nucleotide dots */}
            <circle cx="-13" cy="-20" r="2.2" fill="#6B1118" className="dark:fill-[#F2A7AE]" />
            <circle cx="13" cy="20" r="2.2" fill="#D9A62E" />
            <circle cx="0" cy="0" r="2.3" fill="#3B7A75" />
          </g>
        </g>

        {/* Soft floating science particles */}
        <g className="g9-science-particles">
          <circle cx="164" cy="46" r="2" fill="#D9A62E" fillOpacity="0.65" />
          <circle cx="312" cy="42" r="1.8" fill="#6B1118" fillOpacity="0.5" className="dark:fill-[#F2A7AE]" />
          <circle cx="446" cy="146" r="2.2" fill="#D9A62E" fillOpacity="0.55" />
          <circle cx="34" cy="156" r="1.8" fill="#3B7A75" fillOpacity="0.55" />
          <circle cx="182" cy="288" r="2" fill="#6B1118" fillOpacity="0.45" className="dark:fill-[#F2A7AE]" />
          <circle cx="308" cy="286" r="1.9" fill="#D9A62E" fillOpacity="0.6" />
        </g>
      </svg>
    </div>
  );
};
