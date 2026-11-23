import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Image as ImageIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { HERO_SLIDES, HeroSlide, getHeroSlideCopy } from '../config/heroSlides';
import { isSafeHeroSlideLink } from '../lib/heroSlidesStore';
import { useLanguage } from '../contexts/LanguageContext';
import { useSettings } from '../contexts/SettingsContext';

interface HeroImageSliderProps {
  slides?: HeroSlide[];
  intervalMs?: number;
  pauseOnHover?: boolean;
  externalPaused?: boolean;
  canManage?: boolean;
  onOpenManager?: () => void;
  onOpenLink?: (link: string) => boolean;
  className?: string;
}

export const HeroImageSlider: React.FC<HeroImageSliderProps> = ({
  slides = HERO_SLIDES,
  intervalMs = 4500,
  pauseOnHover = true,
  externalPaused = false,
  canManage = false,
  onOpenManager,
  onOpenLink,
  className = '',
}) => {
  const { t, language, dir } = useLanguage();
  const { settings } = useSettings();
  const safeSlides = slides.length > 0 ? slides : HERO_SLIDES;
  const totalSlides = safeSlides.length;
  const isRtl = dir === 'rtl';

  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [interactionTick, setInteractionTick] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPageHidden, setIsPageHidden] = useState(false);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(() => {
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const reduceMotion = systemPrefersReducedMotion || settings.reduceMotion;
  const isPaused =
    externalPaused || (pauseOnHover && isHovered) || isFocused || isPageHidden;

  useEffect(() => {
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onChange = (event: MediaQueryListEvent) => {
        setSystemPrefersReducedMotion(event.matches);
      };
      setSystemPrefersReducedMotion(media.matches);
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onChange);
        return () => {
          try {
            media.removeEventListener('change', onChange);
          } catch {
            // ignore
          }
        };
      }
      const legacyMedia = media as MediaQueryList & {
        addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
        removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
      };
      if (typeof legacyMedia.addListener === 'function') {
        legacyMedia.addListener(onChange);
        return () => {
          try {
            legacyMedia.removeListener?.(onChange);
          } catch {
            // ignore
          }
        };
      }
    } catch {
      // ignore matchMedia errors
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => setIsPageHidden(document.hidden);
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    setFailedIds({});
    if (activeIndex >= totalSlides && totalSlides > 0) {
      setActiveIndex(0);
      setPrevIndex(null);
    }
  }, [activeIndex, totalSlides, slides]);

  const goToIndex = useCallback(
    (targetIndex: number) => {
      if (totalSlides <= 1) return;
      const normalized = ((targetIndex % totalSlides) + totalSlides) % totalSlides;
      setInteractionTick((tick) => tick + 1);
      setActiveIndex((current) => {
        if (current === normalized) return current;
        setPrevIndex(current);
        return normalized;
      });
    },
    [totalSlides]
  );

  const handleNext = useCallback(() => {
    goToIndex(activeIndex + 1);
  }, [activeIndex, goToIndex]);

  const handlePrev = useCallback(() => {
    goToIndex(activeIndex - 1);
  }, [activeIndex, goToIndex]);

  // 4.5-second auto-advance whenever 2 or more slides are present, resetting cleanly on manual interaction
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) {
      return;
    }
    const safeInterval = Math.min(Math.max(intervalMs, 1500), 10000);
    const timer = window.setInterval(() => {
      setActiveIndex((current) => {
        setPrevIndex(current);
        return (current + 1) % totalSlides;
      });
    }, safeInterval);
    return () => window.clearInterval(timer);
  }, [totalSlides, isPaused, intervalMs, interactionTick]);

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
    didSwipeRef.current = false;
    if (totalSlides <= 1) return;
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (totalSlides <= 1 || touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current ?? 0;
    const deltaX = endX - touchStartXRef.current;
    const deltaY = endY - (touchStartYRef.current ?? endY);
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    didSwipeRef.current = true;
    if (deltaX < 0) {
      if (isRtl) handlePrev();
      else handleNext();
    } else {
      if (isRtl) handleNext();
      else handlePrev();
    }
  };

  const currentSlide = safeSlides[activeIndex];
  const currentCopy = currentSlide ? getHeroSlideCopy(currentSlide, language) : null;
  const currentSafeLink =
    currentSlide?.link && isSafeHeroSlideLink(currentSlide.link)
      ? currentSlide.link.trim()
      : null;
  const hasOverlayContent = Boolean(
    currentCopy?.caption || currentCopy?.subtitle || currentSafeLink
  );

  const handleSlideLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (didSwipeRef.current) {
      e.preventDefault();
      didSwipeRef.current = false;
      return;
    }
    if (!currentSafeLink) {
      e.preventDefault();
      return;
    }
    if (currentSafeLink.startsWith('/') && onOpenLink && onOpenLink(currentSafeLink)) {
      e.preventDefault();
    }
  };

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={t.home.heroSliderLabel}
      onMouseEnter={() => {
        if (pauseOnHover) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (pauseOnHover) setIsHovered(false);
      }}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full aspect-[16/9] md:aspect-auto md:h-[310px] lg:h-[360px] rounded-2xl sm:rounded-3xl overflow-hidden border border-[#6B1118]/20 dark:border-white/12 shadow-sm select-none bg-[radial-gradient(ellipse_at_68%_48%,#6B151D_0%,#470A10_58%,#32050A_100%)] dark:bg-[radial-gradient(ellipse_at_68%_48%,#4F0E15_0%,#2E060B_58%,#1F0306_100%)] ${className}`}
    >
      {/* Slides Layer */}
      {safeSlides.map((slide, index) => {
        const isActive = index === activeIndex;
        const isExiting = index === prevIndex && !isActive;
        const copy = getHeroSlideCopy(slide, language);
        const hasFailed = Boolean(failedIds[slide.id]);

        return (
          <div
            key={slide.id}
            aria-hidden={!isActive}
            className={`absolute inset-0 flex items-center justify-center ${
              reduceMotion ? 'transition-none' : 'transition-opacity duration-700 ease-out'
            } ${
              isActive ? 'opacity-100 z-[2]' : isExiting ? 'opacity-0 z-[1]' : 'opacity-0 z-0'
            }`}
          >
            {hasFailed ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-2 px-6 text-center bg-[radial-gradient(ellipse_at_top,_rgba(229,183,66,0.22),_rgba(107,17,24,0.85)_65%,_#32050A)]">
                <ImageIcon className="w-8 h-8 text-[#E5B742]/90" />
                <p className="text-xs sm:text-sm font-semibold text-white/90 max-w-md line-clamp-2">
                  {copy.caption || copy.subtitle || copy.alt}
                </p>
              </div>
            ) : (
              <div
                className={`h-full w-full flex items-center justify-center g9-banner-side-feather-md ${
                  !reduceMotion && isActive ? 'g9-banner-ken-burns' : ''
                } ${isPaused ? 'g9-banner-ken-burns-paused' : ''}`}
              >
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
                  className="h-full w-full object-cover md:object-contain dark:brightness-[0.94] dark:contrast-[1.03]"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Subtle Ambient Light Sheen */}
      {!reduceMotion && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[3] overflow-hidden"
        >
          <div
            className={`g9-banner-sheen h-full w-1/3 bg-gradient-to-r from-transparent via-[#FBF4DF]/10 to-transparent ${
              isPaused ? 'g9-banner-ken-burns-paused' : ''
            }`}
          />
        </div>
      )}

      {/* Optional Slide Link Cover (underneath controls/dots/manager button) */}
      {currentSafeLink && (
        <a
          href={currentSafeLink}
          target={currentSafeLink.startsWith('/') ? undefined : '_blank'}
          rel={currentSafeLink.startsWith('/') ? undefined : 'noopener noreferrer'}
          aria-label={
            currentCopy?.caption || currentCopy?.subtitle || t.home.bannerOpenLinkLabel
          }
          onClick={handleSlideLinkClick}
          className="absolute inset-0 z-[4] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E5B742]"
        />
      )}

      {/* Admin Quick Access Button */}
      {canManage && onOpenManager && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenManager();
          }}
          className="absolute top-3 end-3 z-[6] inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B742] cursor-pointer min-h-[36px] whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#E5B742] shrink-0" />
          <span>{t.home.manageBannersBtn}</span>
        </button>
      )}

      {/* Optional Slide Title, Subtitle & Link Affordance */}
      {hasOverlayContent && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pt-8 pb-3.5 sm:pb-4">
          <div className="flex items-end justify-between gap-3 max-w-full">
            <div className="min-w-0 space-y-0.5 text-start">
              {currentCopy?.caption && (
                <p className="text-xs sm:text-sm font-bold text-white drop-shadow-xs truncate">
                  {currentCopy.caption}
                </p>
              )}
              {currentCopy?.subtitle && (
                <p className="text-[11px] sm:text-xs text-white/85 drop-shadow-xs line-clamp-1">
                  {currentCopy.subtitle}
                </p>
              )}
            </div>
            {currentSafeLink && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-[#FDE68A] backdrop-blur-md shrink-0 whitespace-nowrap">
                <span>{t.home.bannerOpenLinkLabel}</span>
                <ArrowUpRight className="w-3 h-3 shrink-0" />
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
