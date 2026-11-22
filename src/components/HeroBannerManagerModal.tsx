import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HERO_SLIDES, type HeroSlide } from '../config/heroSlides';
import {
  MAX_HERO_SLIDES,
  isSafeHeroSlideSrc,
  readAndCompressBannerFile,
} from '../lib/heroSlidesStore';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';

interface HeroBannerManagerModalProps {
  slides: HeroSlide[];
  onSave: (nextSlides: HeroSlide[]) => Promise<{ ok: boolean; notice?: string }>;
  onClose: () => void;
}

export const HeroBannerManagerModal: React.FC<HeroBannerManagerModalProps> = ({
  slides,
  onSave,
  onClose,
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftSlides, setDraftSlides] = useState<HeroSlide[]>(() =>
    slides.length > 0 ? [...slides] : [...HERO_SLIDES]
  );
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [altLabel, setAltLabel] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, saving]);

  const trimmedPreviewSrc = imageUrl.trim();
  const hasPreviewCandidate = Boolean(trimmedPreviewSrc) && isSafeHeroSlideSrc(trimmedPreviewSrc);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFormError(null);
    setUploadingFile(true);
    try {
      const dataUrl = await readAndCompressBannerFile(file);
      setImageUrl(dataUrl);
      setPreviewFailed(false);
      if (!altLabel.trim()) {
        const cleanedName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (cleanedName) {
          setAltLabel(cleanedName.slice(0, 120));
        }
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setFormError(
        code === 'IMAGE_TOO_LARGE'
          ? t.home.bannerFileTooLargeErr
          : t.home.bannerInvalidImageErr
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddSlide = () => {
    setFormError(null);
    const src = imageUrl.trim();
    if (!src) {
      setFormError(t.home.bannerEmptyUrlErr);
      return;
    }
    if (!isSafeHeroSlideSrc(src) || previewFailed) {
      setFormError(t.home.bannerInvalidImageErr);
      return;
    }
    if (draftSlides.length >= MAX_HERO_SLIDES) {
      setDraftSlides((prev) => prev.slice(0, MAX_HERO_SLIDES - 1));
    }

    const cleanCaption = caption.trim().slice(0, 140);
    const cleanAlt =
      altLabel.trim().slice(0, 180) ||
      cleanCaption ||
      `Grade 9 Science banner ${draftSlides.length + 1}`;

    const newSlide: HeroSlide = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      src,
      alt: cleanAlt,
      ...(cleanCaption ? { caption: cleanCaption } : {}),
      objectPosition: 'center center',
    };

    setDraftSlides((prev) => [...prev, newSlide]);
    setImageUrl('');
    setCaption('');
    setAltLabel('');
    setPreviewFailed(false);
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= draftSlides.length) return;
    setFormError(null);
    setDraftSlides((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const handleDelete = (index: number) => {
    if (draftSlides.length <= 1) {
      setFormError(t.home.bannerMinOneSlideMsg);
      return;
    }
    setFormError(null);
    setDraftSlides((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResetDefault = () => {
    setFormError(null);
    setDraftSlides([...HERO_SLIDES]);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const next = draftSlides.length > 0 ? draftSlides : [...HERO_SLIDES];
      const result = await onSave(next);
      if (result.ok) {
        onClose();
      } else {
        setFormError(result.notice || t.home.bannerStorageFallbackMsg);
      }
    } catch {
      setFormError(t.home.bannerStorageFallbackMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={t.home.bannerManagerTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="g9-animate-modal-pop w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] bg-white px-5 py-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
              <ImagePlus className="w-5 h-5 text-[#6B1118]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#1C1917] truncate">
                {t.home.bannerManagerTitle}
              </h3>
              <p className="text-xs text-[#57534E] mt-0.5 leading-relaxed">
                {t.home.bannerManagerSub}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            aria-label={t.home.bannerCancelBtn}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
          {formError && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#991B1B]">
              {formError}
            </div>
          )}

          {/* Add New Slide Box */}
          <section className="rounded-xl border border-[#E6DFD5] bg-white p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5 items-end">
              <div>
                <label
                  htmlFor="hero-banner-url"
                  className="block text-xs font-semibold text-[#1C1917] mb-1"
                >
                  {t.home.bannerUrlLabel}
                </label>
                <input
                  id="hero-banner-url"
                  type="text"
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    setPreviewFailed(false);
                    setFormError(null);
                  }}
                  placeholder={t.home.bannerUrlPlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[42px]"
                />
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  disabled={uploadingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>{t.home.bannerUploadBtn}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="hero-banner-caption"
                  className="block text-xs font-semibold text-[#1C1917] mb-1"
                >
                  {t.home.bannerCaptionLabel}
                </label>
                <input
                  id="hero-banner-caption"
                  type="text"
                  maxLength={140}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={t.home.bannerCaptionPlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[40px]"
                />
              </div>

              <div>
                <label
                  htmlFor="hero-banner-alt"
                  className="block text-xs font-semibold text-[#1C1917] mb-1"
                >
                  {t.home.bannerAltLabel}
                </label>
                <input
                  id="hero-banner-alt"
                  type="text"
                  maxLength={180}
                  value={altLabel}
                  onChange={(e) => setAltLabel(e.target.value)}
                  placeholder={t.home.bannerAltPlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[40px]"
                />
              </div>
            </div>

            {/* Live Image Preview */}
            {trimmedPreviewSrc && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-[#57534E]">
                  {t.home.bannerPreviewLabel}
                </span>
                <div className="relative h-32 w-full rounded-xl overflow-hidden border border-[#E6DFD5] bg-[#32050A] flex items-center justify-center">
                  {hasPreviewCandidate && !previewFailed ? (
                    <img
                      src={trimmedPreviewSrc}
                      alt={altLabel.trim() || t.home.bannerPreviewLabel}
                      referrerPolicy="no-referrer"
                      onLoad={() => setPreviewFailed(false)}
                      onError={() => setPreviewFailed(true)}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <p className="px-4 text-center text-xs font-medium text-white/85">
                      {t.home.bannerInvalidImageErr}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!trimmedPreviewSrc || previewFailed || uploadingFile}
                onClick={handleAddSlide}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-45 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
              >
                <Plus className="w-4 h-4 text-[#E5B742]" />
                <span>{t.home.bannerAddBtn}</span>
              </button>
            </div>
          </section>

          {/* Current Ordered Slides */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#1C1917]">{t.home.bannerCurrentTitle}</h4>
              <span className="text-xs font-medium text-[#57534E] tabular-nums">
                {formatMsg(t.home.bannerCountLabel, { count: draftSlides.length })}
              </span>
            </div>

            <div className="space-y-2">
              {draftSlides.map((slide, index) => {
                const isDefault = slide.id === HERO_SLIDES[0]?.id;
                return (
                  <div
                    key={slide.id}
                    className="flex items-center gap-3 rounded-xl border border-[#E6DFD5] bg-white p-2.5 sm:p-3"
                  >
                    <div className="h-14 w-24 sm:h-16 sm:w-28 rounded-lg overflow-hidden border border-[#E6DFD5] bg-[#32050A] shrink-0 flex items-center justify-center">
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-xs sm:text-sm font-semibold text-[#1C1917] truncate">
                        {slide.caption || slide.alt}
                      </p>
                      <p className="text-[11px] text-[#57534E] truncate tabular-nums">
                        #{index + 1}
                        {isDefault ? ` · ${t.home.bannerDefaultTag}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, -1)}
                        aria-label={t.home.bannerMoveUp}
                        title={t.home.bannerMoveUp}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118]/50 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === draftSlides.length - 1}
                        onClick={() => handleMove(index, 1)}
                        aria-label={t.home.bannerMoveDown}
                        title={t.home.bannerMoveDown}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118]/50 disabled:opacity-35 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(index)}
                        aria-label={t.home.bannerDeleteSlide}
                        title={t.home.bannerDeleteSlide}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#DC2626] hover:border-[#DC2626]/40 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sticky Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E6DFD5] bg-white px-4 py-3 sm:px-5 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.home.bannerResetDefault}</span>
          </button>

          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2 text-xs sm:text-sm font-semibold text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
            >
              {t.home.bannerCancelBtn}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl bg-[#6B1118] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-55 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
            >
              {saving ? t.home.bannerSavingBtn : t.home.bannerSaveBtn}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
