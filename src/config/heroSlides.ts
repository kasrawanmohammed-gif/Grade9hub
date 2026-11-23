import type { AppLanguage } from '../i18n/translations';

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
  altKu?: string;
  altAr?: string;
  caption?: string;
  captionKu?: string;
  captionAr?: string;
  subtitle?: string;
  subtitleKu?: string;
  subtitleAr?: string;
  link?: string;
  objectPosition?: string;
}

/**
 * Easy-to-extend configuration for the Home banner slider.
 *
 * To add more slides in the future, append entries below with:
 * `{ id: 'unique-id', src: '/assets/...', alt: '...', caption?: '...', subtitle?: '...', link?: '...' }`.
 * When 2 or more slides exist, smooth auto-advance, prev/next controls,
 * and indicator dots appear automatically.
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'science-learning-hub-trilingual',
    src: '/assets/aistudio/1795270867141_47645629.jpg',
    alt: 'Grade 9 Hub — Science Learning Hub trilingual banner in English, Kurdish, and Arabic',
    altKu: 'ناوەندی پۆلی ٩ — پۆستەری ناوەندی فێربوونی زانست بە ئینگلیزی و کوردی و عەرەبی',
    altAr: 'مركز الصف التاسع — لافتة مركز تعلّم العلوم بالإنجليزية والكردية والعربية',
    objectPosition: 'center center',
  },
];

export function getHeroSlideCopy(
  slide: HeroSlide,
  language: AppLanguage
): { alt: string; caption?: string; subtitle?: string } {
  if (language === 'ku') {
    return {
      alt: slide.altKu || slide.alt,
      caption: slide.captionKu ?? slide.caption,
      subtitle: slide.subtitleKu ?? slide.subtitle,
    };
  }
  if (language === 'ar') {
    return {
      alt: slide.altAr || slide.alt,
      caption: slide.captionAr ?? slide.caption,
      subtitle: slide.subtitleAr ?? slide.subtitle,
    };
  }
  return {
    alt: slide.alt,
    caption: slide.caption,
    subtitle: slide.subtitle,
  };
}
