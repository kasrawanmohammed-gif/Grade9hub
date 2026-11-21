import React from 'react';

interface SuccessHeroBackdropProps {
  /** Height class for the upper scenic backdrop area */
  heightClassName?: string;
  /** Optional stage vertical offset tuning */
  stageOffsetClassName?: string;
  /** Feather left/right edges on wide desktop containers */
  featherSidesOnDesktop?: boolean;
}

export const HERO_BACKDROP_SRC = '/assets/aistudio/1795193684825_08209d2b.jpg';

export const SuccessHeroBackdrop: React.FC<SuccessHeroBackdropProps> = ({
  heightClassName = 'h-[300px] sm:h-[360px] lg:h-[410px]',
  stageOffsetClassName = 'mt-[-10%]',
  featherSidesOnDesktop = false,
}) => {
  return (
    <div
      aria-hidden="true"
      dir="ltr"
      className={`pointer-events-none select-none absolute top-0 inset-x-0 overflow-hidden g9-hero-backdrop-mask ${heightClassName}`}
    >
      {/* Centered panning scenic container; kept LTR so cliff/walker/SUCCESS coordinates stay exact in RTL */}
      <div
        className={`w-full h-full flex justify-center items-start ${
          featherSidesOnDesktop ? 'g9-hero-side-feather-lg' : ''
        }`}
      >
        <div
          className={`relative w-[112%] sm:w-[110%] max-w-[900px] shrink-0 aspect-[1000/920] g9-hero-pan ${stageOffsetClassName}`}
        >
          {/* Base scenic photograph */}
          <img
            src={HERO_BACKDROP_SRC}
            alt=""
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover block dark:brightness-[0.9] dark:contrast-[1.06]"
          />

          {/* Subtle canyon atmospheric glow behind the SUCCESS bridge */}
          <div
            className="absolute pointer-events-none mix-blend-screen g9-canyon-glow"
            style={{
              left: '22%',
              width: '56%',
              top: '33%',
              height: '26%',
              background:
                'radial-gradient(ellipse 52% 48% at 50% 45%, rgba(255, 206, 112, 0.36) 0%, rgba(242, 134, 48, 0.16) 52%, transparent 80%)',
            }}
          />

          {/* Synchronized dynamic golden light-sweep & top-rim glint across the "SUCCESS" word */}
          <div
            className="absolute pointer-events-none overflow-hidden"
            style={{
              left: '25.2%',
              width: '49.6%',
              top: '38.2%',
              height: '16.2%',
              WebkitMaskImage:
                'radial-gradient(ellipse 50% 48% at 50% 50%, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 100%)',
              maskImage:
                'radial-gradient(ellipse 50% 48% at 50% 50%, rgba(0,0,0,1) 42%, rgba(0,0,0,0) 100%)',
            }}
          >
            {/* Surface warm-gold sweep synced with sun arc */}
            <div
              className="absolute inset-y-0 -inset-x-[22%] mix-blend-screen g9-success-sweep"
              style={{
                background:
                  'radial-gradient(ellipse 38% 85% at 50% 34%, rgba(255, 248, 214, 0.56) 0%, rgba(255, 203, 96, 0.3) 38%, rgba(236, 132, 46, 0.1) 66%, transparent 92%)',
              }}
            />

            {/* Crisp upper-edge rim highlight gliding along the top contour of SUCCESS */}
            <div
              className="absolute top-0 inset-x-[-18%] h-[44%] mix-blend-screen blur-[3px] g9-success-rim"
              style={{
                background:
                  'radial-gradient(ellipse 34% 90% at 50% 25%, rgba(255, 252, 228, 0.72) 0%, rgba(255, 214, 120, 0.32) 48%, transparent 85%)',
              }}
            />
          </div>

          {/* Animated Sun: arc drift + rotating soft rays + glowing corona pulse */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: '50.17%',
              top: '26.39%',
              width: '40%',
              aspectRatio: '1 / 1',
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center g9-sun-arc">
              {/* Soft rotating golden sunbeams */}
              <div
                className="absolute inset-[10%] rounded-full mix-blend-screen g9-sun-rays"
                style={{
                  background:
                    'repeating-conic-gradient(from 0deg, rgba(255, 232, 165, 0.34) 0deg 8deg, transparent 10deg 26deg)',
                  WebkitMaskImage:
                    'radial-gradient(circle, rgba(0,0,0,0) 12%, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0) 70%)',
                  maskImage:
                    'radial-gradient(circle, rgba(0,0,0,0) 12%, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0) 70%)',
                }}
              />

              {/* Outer glowing warm halo */}
              <div
                className="absolute inset-0 rounded-full mix-blend-screen g9-sun-pulse"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255, 250, 224, 0.72) 0%, rgba(255, 222, 134, 0.42) 18%, rgba(247, 174, 72, 0.18) 42%, transparent 72%)',
                }}
              />

              {/* Bright inner sun core bloom */}
              <div
                className="absolute inset-[36%] rounded-full mix-blend-screen g9-sun-pulse"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255, 255, 245, 0.85) 0%, rgba(255, 236, 172, 0.35) 55%, transparent 100%)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Seamless top contrast scrim & lower crimson/burgundy dissolve */}
      <div className="absolute inset-0 g9-hero-crimson-fade" />
    </div>
  );
};
