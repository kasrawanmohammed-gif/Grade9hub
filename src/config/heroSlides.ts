import type { AppLanguage } from '../i18n/translations';
import physicsOpticsImg from '../assets/images/physics_optics_prism_hero_1794573933754.jpg';
import chemistryGlasswareImg from '../assets/images/chemistry_glassware_glow_1795269358476.jpg';
import mechanicsPendulumImg from '../assets/images/educator_science_desk_1794573934293.jpg';
import astronomyArmillaryImg from '../assets/images/astronomy_celestial_armillary_1795269358923.jpg';

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
  altKu?: string;
  altAr?: string;
  caption?: string;
  captionKu?: string;
  captionAr?: string;
  objectPosition?: string;
}

/**
 * Easy-to-extend configuration for the Home hero image slider.
 *
 * To add a new slide:
 * 1. Import an image from `../assets/images/...` (or use a `/assets/...` public path).
 * 2. Append or insert an entry below with `id`, `src`, `alt`, and optional `caption`.
 */
export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'physics-optics-prism',
    src: physicsOpticsImg,
    alt: 'Optical glass prism splitting warm light into a spectrum on a study table',
    altKu: 'پریزمێکی شووشەیی کە ڕووناکی گەرم دابەش دەکات بەسەر شەبەنگدا لەسەر مێزی خوێندن',
    altAr: 'منشور زجاجي بصري يحلل الضوء الدافئ إلى ألوان الطيف على طاولة الدراسة',
    caption: 'Optics & Light Spectrum',
    captionKu: 'ڕووناکی و شەبەنگی فیزیا',
    captionAr: 'البصريات وطيف الضوء',
    objectPosition: 'center 55%',
  },
  {
    id: 'chemistry-solutions-lab',
    src: chemistryGlasswareImg,
    alt: 'Laboratory flasks glowing with amber and ruby solutions under warm sunlight',
    altKu: 'شوشە و دەفری تاقیگەی کیمیا بە گیراوەی زێڕین و یاقووتی لەژێر تیشکی خۆردا',
    altAr: 'دوارق مخبرية متوهجة بمحاليل ذهبية وياقوتية تحت ضوء الشمس الدافئ',
    caption: 'Chemistry & Solutions Lab',
    captionKu: 'تاقیگەی کیمیا و گیراوەکان',
    captionAr: 'مختبر الكيمياء والمحاليل',
    objectPosition: 'center 52%',
  },
  {
    id: 'mechanics-harmonic-pendulum',
    src: mechanicsPendulumImg,
    alt: 'Brass harmonic pendulum, physics formulas, and magnifying glass on a study desk',
    altKu: 'بەندۆڵی مسین و یاساکانی فیزیا و عدەسەی گەورەکەر لەسەر مێزی خوێندن',
    altAr: 'بندول نحاسي ومعادلات فيزيائية وعدسة مكبرة على مكتب الدراسة',
    caption: 'Forces & Harmonic Motion',
    captionKu: 'هێز و جووڵەی هارمۆنی',
    captionAr: 'القوى والحركة التوافقية',
    objectPosition: 'center 42%',
  },
  {
    id: 'astronomy-celestial-instruments',
    src: astronomyArmillaryImg,
    alt: 'Classic brass telescope, armillary sphere, and open science notebook',
    altKu: 'تەلسکۆبی مسین و گۆی ئەستێرەناسی و دەفتەری زانست',
    altAr: 'تلسكوب نحاسي وكرة فلكية ودفتر علوم مفتوح',
    caption: 'Astronomy & Scientific Discovery',
    captionKu: 'ئەستێرەناسی و دۆزینەوەی زانستی',
    captionAr: 'علم الفلك والاكتشاف العلمي',
    objectPosition: 'center 45%',
  },
];

export function getHeroSlideCopy(
  slide: HeroSlide,
  language: AppLanguage
): { alt: string; caption?: string } {
  if (language === 'ku') {
    return {
      alt: slide.altKu || slide.alt,
      caption: slide.captionKu ?? slide.caption,
    };
  }
  if (language === 'ar') {
    return {
      alt: slide.altAr || slide.alt,
      caption: slide.captionAr ?? slide.caption,
    };
  }
  return {
    alt: slide.alt,
    caption: slide.caption,
  };
}
