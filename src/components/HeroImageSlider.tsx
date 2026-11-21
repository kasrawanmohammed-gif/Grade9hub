import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HERO_SLIDES, HeroSlide, getHeroSlideCopy } from '../data/heroSlides';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatMsg } from '../i18n/translations';

interface HeroImageSliderProps {
  slides?: HeroSlide[];
  intervalMs?: number;
  heightClassName?: string;
  featherSidesOnDesktop?: boolean;
  topBar?: React.ReactNode;
  className?: string;
}

export const HeroImageSlider: React.FC<HeroImageSliderProps> = ({
  slides = HERO_SLIDES,
  intervalMs = 5500,
  heightClassName = 'min-h-[255px] sm:min-h-[325px] lg:min-h-[375px]',
  featherSidesOnDesktop = true,
  topBar,
  className = '',
}) => {
  const { t, language, dir } = useLanguage();
  const { settings } = useSettings();
  const totalSlides = slides.length;
  const isRtl = dir === 'rtl';

  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const touchStartXRef = useRef<number | null>(null);
  const reduceMotion = systemPrefersReducedMotion || settings.reduceMotion;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(event.matches);
    };
    setSystemPrefersReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsPageHidden(document.hidden);
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (activeIndex >= totalSlides && totalSlides > 0) {
      setActiveIndex(0);
      setPrevIndex(null);
    }
  }, [activeIndex, totalSlides]);

  const goToIndex = useCallback(
    (targetIndex: number, dirHint: 'next' | 'prev') => {
      if (totalSlides <= 1) return;
      const normalized = ((targetIndex % totalSlides) + totalSlides) % totalSlides;
      setActiveIndex((current) => {
        if (current === normalized) return current;
        setPrevIndex(current);
        setDirection(dirHint);
        return normalized;
      });
    },
    [totalSlides]
  );

  const handleNext = useCallback(() => {
    goToIndex(activeIndex + 1, 'next');
  }, [activeIndex, goToIndex]);

  const handlePrev = useCallback(() => {
    goToIndex(activeIndex - 1, 'prev');
  }, [activeIndex, goToIndex]);

  useEffect(() => {
    if (reduceMotion || totalSlides <= 1 || isHovered || isFocused || isPageHidden) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % totalSlides;
        setPrevIndex(current);
        setDirection('next');
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [reduceMotion, totalSlides, isHovered, isFocused, isPageHidden, intervalMs]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalSlides <= 1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isRtl) handlePrev();
      else handleNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isRtl) handleNext();
      else handlePrev();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (totalSlides <= 1) return;
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (totalSlides <= 1 || touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 36) return;

    if (deltaX < 0) {
      if (isRtl) handlePrev();
      else handleNext();
    } else {
      if (isRtl) handleNext();
      else handlePrev();
    }
  };

  const currentSlide = slides[activeIndex];
  const currentCopy = currentSlide ? getHeroSlideCopy(currentSlide, language) : null;
  const PrevChevron = isRtl ? ChevronRight : ChevronLeft;
  const NextChevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={t.home.heroSliderLabel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full overflow-hidden select-none ${heightClassName} ${className}`}
    >
      {/* Masked Slide Stage Blending Smoothly into Crimson/Burgundy Surface */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden ${
          featherSidesOnDesktop ? 'g9-hero-side-feather-lg' : ''
        }`}
      >
        <div className="relative h-full w-full g9-hero-slider-mask">
        {totalSlides === 0 ? (
          <div
            aria-hidden="true"
            className="h-full w-full bg-[radial-gradient(ellipse_at_top,_rgba(229,183,66,0.22),_rgba(107,17,24,0.85)_65%,_transparent)]"
          />
        ) : (
          slides.map((slide, index) => {
            const isActive = index === activeIndex;
            const isExiting = index === prevIndex && !isActive;
            const copy = getHeroSlideCopy(slide, language);
            const hasFailed = Boolean(failedIds[slide.id]);

            let transformClass = 'translate-x-0 scale-100';
            if (!reduceMotion) {
              if (isActive) {
                transformClass = 'translate-x-0 scale-[1.03]';
              } else if (isExiting) {
                const moveBack =
                  direction === 'next'
                    ? isRtl
                      ? 'translate-x-[3%]'
                      : '-translate-x-[3%]'
                    : isRtl
                    ? '-translate-x-[3%]'
                    : 'translate-x-[3%]';
                transformClass = `${moveBack} scale-100`;
              }
            }

            return (
              <div
                key={slide.id}
                aria-hidden={!isActive}
                className={`absolute inset-0 will-change-[opacity,transform] ${
                  reduceMotion
                    ? 'transition-none'
                    : 'transition-[opacity,transform] duration-700 ease-out'
                } ${
                  isActive
                    ? 'opacity-100 z-[2]'
                    : isExiting
                    ? 'opacity-0 z-[1]'
                    : 'opacity-0 z-0'
                } ${transformClass}`}
              >
                {hasFailed ? (
                  <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,_rgba(229,183,66,0.24),_rgba(107,17,24,0.82)_65%,_transparent)]" />
                ) : (
                  <img
                    src={slide.src}
                    alt={copy.alt}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedIds((prev) => ({ ...prev, [slide.id]: true }))
                    }
                    style={{
                      objectPosition: slide.objectPosition || 'center center',
                    }}
                    className="h-full w-full object-cover brightness-[0.94] contrast-[1.04] dark:brightness-[0.84] dark:contrast-[1.08]"
                  />
                )}
              </div>
            );
          })
        )}

        {/* Top Header Contrast Scrim + Lower Crimson Blend */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] g9-hero-slider-scrim"
        />
        </div>
      </div>

      {/* Crisp Top Bar & Clean Lower Slider Controls Above Seamless Edge */}
      <div
        className={`relative z-10 flex h-full flex-col justify-between px-4 pt-3.5 pb-9 sm:px-8 sm:pt-5 sm:pb-11 lg:px-10 lg:pb-12 ${heightClassName}`}
      >
        <div>{topBar}</div>

        {totalSlides > 1 && (
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <div className="min-w-0 flex-1">
              {currentCopy?.caption && (
                <p className="truncate text-[11px] sm:text-xs font-medium tracking-wide text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]">
                  {currentCopy.caption}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                aria-label={t.home.prevSlideBtn}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-black/30 text-white/95 backdrop-blur-md transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B742] cursor-pointer"
              >
                <PrevChevron className="h-4 w-4" />
              </button>

              <div
                className="flex items-center gap-0.5 rounded-lg border border-white/15 bg-black/25 px-2 py-0.5 backdrop-blur-md"
                role="tablist"
                aria-label={t.home.heroSliderLabel}
              >
                {slides.map((slide, index) => {
                  const isCurrent = index === activeIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      aria-label={formatMsg(t.home.goToSlideBtn, { n: index + 1 })}
                      onClick={() =>
                        goToIndex(index, index > activeIndex ? 'next' : 'prev')
                      }
                      className="inline-flex h-8 min-w-[16px] items-center justify-center px-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E5B742] rounded-full"
                    >
                      <span
                        className={`block h-1.5 rounded-full ${
                          reduceMotion ? '' : 'transition-all duration-300'
                        } ${
                          isCurrent
                            ? 'w-5 bg-[#E5B742]'
                            : 'w-1.5 bg-white/45 hover:bg-white/80'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleNext}
                aria-label={t.home.nextSlideBtn}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-black/30 text-white/95 backdrop-blur-md transition-colors hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B742] cursor-pointer"
              >
                <NextChevron className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
