import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { HERO_SLIDES, type HeroSlide } from '../config/heroSlides';
import {
  MAX_HERO_LINK_LENGTH,
  MAX_HERO_SLIDES,
  isSafeHeroSlideLink,
  isSafeHeroSlideSrc,
  normalizeHeroSlideLink,
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
  const { t, dir } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  const [draftSlides, setDraftSlides] = useState<HeroSlide[]>(() =>
    slides.length > 0 ? [...slides] : [...HERO_SLIDES]
  );
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [altLabel, setAltLabel] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasLocalEdits) {
      setDraftSlides(slides.length > 0 ? [...slides] : [...HERO_SLIDES]);
    }
  }, [slides, hasLocalEdits]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving && !uploadingFile) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, saving, uploadingFile]);

  const showError = (message: string) => {
    setFormError(message);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const trimmedPreviewSrc = imageUrl.trim();
  const hasPreviewCandidate = Boolean(trimmedPreviewSrc) && isSafeHeroSlideSrc(trimmedPreviewSrc);
  const editingIndex = editingSlideId
    ? draftSlides.findIndex((s) => s.id === editingSlideId)
    : -1;
  const isEditing = editingIndex >= 0;

  const clearEditorForm = () => {
    setEditingSlideId(null);
    setImageUrl('');
    setCaption('');
    setSubtitle('');
    setLinkUrl('');
    setAltLabel('');
    setPreviewFailed(false);
    setFormError(null);
  };

  const handleStartEdit = (slide: HeroSlide) => {
    setFormError(null);
    setEditingSlideId(slide.id);
    setImageUrl(slide.src || '');
    setCaption(slide.caption || '');
    setSubtitle(slide.subtitle || '');
    setLinkUrl(slide.link || '');
    setAltLabel(slide.alt || '');
    setPreviewFailed(false);
    scrollBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      showError(
        code === 'IMAGE_TOO_LARGE'
          ? t.home.bannerFileTooLargeErr
          : t.home.bannerInvalidImageErr
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const buildSlideListWithForm = (
    baseList: HeroSlide[]
  ): { ok: true; next: HeroSlide[]; committedPending: boolean } | { ok: false; error: string } => {
    const src = imageUrl.trim();
    const trimmedLink = linkUrl.trim();
    const hasFormContent =
      Boolean(src) ||
      Boolean(caption.trim()) ||
      Boolean(subtitle.trim()) ||
      Boolean(trimmedLink) ||
      Boolean(altLabel.trim());

    if (!isEditing && !hasFormContent) {
      return { ok: true, next: baseList, committedPending: false };
    }

    if (!src) {
      return { ok: false, error: t.home.bannerEmptyUrlErr };
    }
    if (!isSafeHeroSlideSrc(src) || previewFailed) {
      return { ok: false, error: t.home.bannerInvalidImageErr };
    }
    if (trimmedLink && !isSafeHeroSlideLink(trimmedLink)) {
      return { ok: false, error: t.home.bannerInvalidLinkErr };
    }

    const cleanCaption = caption.trim().slice(0, 140);
    const cleanSubtitle = subtitle.trim().slice(0, 160);
    const cleanLink = normalizeHeroSlideLink(trimmedLink);
    const cleanAlt =
      altLabel.trim().slice(0, 180) ||
      cleanCaption ||
      cleanSubtitle ||
      `Grade 9 Science banner ${baseList.length + 1}`;

    if (isEditing && editingSlideId) {
      const next = baseList.map((slide) => {
        if (slide.id !== editingSlideId) return slide;
        const updated: HeroSlide = {
          ...slide,
          src,
          alt: cleanAlt,
          objectPosition: slide.objectPosition || 'center center',
        };
        if (cleanCaption) updated.caption = cleanCaption;
        else delete updated.caption;
        if (cleanSubtitle) updated.subtitle = cleanSubtitle;
        else delete updated.subtitle;
        if (cleanLink) updated.link = cleanLink;
        else delete updated.link;
        return updated;
      });
      return { ok: true, next, committedPending: true };
    }

    if (baseList.length >= MAX_HERO_SLIDES) {
      return {
        ok: false,
        error: formatMsg(t.home.bannerMaxSlidesErr, { max: MAX_HERO_SLIDES }),
      };
    }

    const newSlide: HeroSlide = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      src,
      alt: cleanAlt,
      ...(cleanCaption ? { caption: cleanCaption } : {}),
      ...(cleanSubtitle ? { subtitle: cleanSubtitle } : {}),
      ...(cleanLink ? { link: cleanLink } : {}),
      objectPosition: 'center center',
    };

    return { ok: true, next: [...baseList, newSlide], committedPending: true };
  };

  const handleAddOrUpdateSlide = () => {
    setFormError(null);
    if (!imageUrl.trim()) {
      showError(t.home.bannerEmptyUrlErr);
      return;
    }
    const built = buildSlideListWithForm(draftSlides);
    if (!built.ok) {
      showError(built.error);
      return;
    }
    setDraftSlides(built.next);
    setHasLocalEdits(true);
    clearEditorForm();
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= draftSlides.length) return;
    setFormError(null);
    setHasLocalEdits(true);
    setDraftSlides((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const handleDelete = (index: number) => {
    if (draftSlides.length <= 1) {
      showError(t.home.bannerMinOneSlideMsg);
      return;
    }
    const targetId = draftSlides[index]?.id;
    setFormError(null);
    setHasLocalEdits(true);
    setDraftSlides((prev) => prev.filter((_, idx) => idx !== index));
    if (targetId && targetId === editingSlideId) {
      clearEditorForm();
    }
  };

  const handleResetDefault = () => {
    setFormError(null);
    setHasLocalEdits(true);
    clearEditorForm();
    setDraftSlides([...HERO_SLIDES]);
  };

  const handleSave = async () => {
    if (saving || uploadingFile) return;
    setFormError(null);

    const built = buildSlideListWithForm(draftSlides);
    if (!built.ok) {
      showError(built.error);
      return;
    }

    const next = built.next.length > 0 ? built.next : [...HERO_SLIDES];
    if (built.committedPending) {
      setDraftSlides(next);
      setHasLocalEdits(true);
      clearEditorForm();
    }

    setSaving(true);
    try {
      const result = await onSave(next);
      if (result.ok) {
        onClose();
      } else {
        showError(result.notice || t.home.bannerSaveFailedErr);
      }
    } catch {
      showError(t.home.bannerSaveFailedErr);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div
      dir={dir}
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-0 sm:p-5 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t.home.bannerManagerTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !uploadingFile) {
          onClose();
        }
      }}
    >
      <div className="g9-animate-modal-pop w-full sm:max-w-2xl max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] shadow-2xl overflow-hidden">
        {/* Sticky Modal Header */}
        <header className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] bg-white px-4 py-3.5 sm:px-5 sm:py-4 shrink-0">
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
            disabled={saving || uploadingFile}
            onClick={onClose}
            aria-label={t.home.bannerCancelBtn}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Modal Body */}
        <div
          ref={scrollBodyRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5"
        >
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-[#DC2626]/35 bg-[#FEF2F2] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#991B1B]"
            >
              {formError}
            </div>
          )}

          {/* Add or Edit Slide Box */}
          <section
            className={`rounded-xl border p-4 space-y-3.5 ${
              isEditing
                ? 'border-[#6B1118]/50 bg-[#FBF4DF]/45'
                : 'border-[#E6DFD5] bg-white'
            }`}
          >
            {isEditing && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E6DFD5]">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B1118]">
                  <Pencil className="w-3.5 h-3.5" />
                  <span>
                    {t.home.bannerEditingTitle} #{editingIndex + 1}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={clearEditorForm}
                  className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] underline cursor-pointer"
                >
                  {t.home.bannerCancelEditBtn}
                </button>
              </div>
            )}

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
                  accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  disabled={uploadingFile || saving}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[42px] whitespace-nowrap disabled:opacity-60"
                >
                  {uploadingFile ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {uploadingFile
                      ? t.home.bannerUploadingStatus
                      : isEditing
                      ? t.home.bannerReplacePhoto
                      : t.home.bannerUploadBtn}
                  </span>
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
                  htmlFor="hero-banner-subtitle"
                  className="block text-xs font-semibold text-[#1C1917] mb-1"
                >
                  {t.home.bannerSubtitleLabel}
                </label>
                <input
                  id="hero-banner-subtitle"
                  type="text"
                  maxLength={160}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder={t.home.bannerSubtitlePlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[40px]"
                />
              </div>

              <div>
                <label
                  htmlFor="hero-banner-link"
                  className="block text-xs font-semibold text-[#1C1917] mb-1"
                >
                  {t.home.bannerLinkLabel}
                </label>
                <input
                  id="hero-banner-link"
                  type="text"
                  maxLength={MAX_HERO_LINK_LENGTH}
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    setFormError(null);
                  }}
                  placeholder={t.home.bannerLinkPlaceholder}
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
                <div className="relative h-36 w-full rounded-xl overflow-hidden border border-[#E6DFD5] bg-[#32050A] flex items-center justify-center">
                  {hasPreviewCandidate && !previewFailed ? (
                    <>
                      <img
                        src={trimmedPreviewSrc}
                        alt={altLabel.trim() || t.home.bannerPreviewLabel}
                        referrerPolicy="no-referrer"
                        onLoad={() => setPreviewFailed(false)}
                        onError={() => setPreviewFailed(true)}
                        className="h-full w-full object-contain"
                      />
                      {(caption.trim() || subtitle.trim()) && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 py-2 text-start">
                          {caption.trim() && (
                            <p className="text-xs font-bold text-white truncate">
                              {caption.trim()}
                            </p>
                          )}
                          {subtitle.trim() && (
                            <p className="text-[11px] text-white/85 truncate">
                              {subtitle.trim()}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="px-4 text-center text-xs font-medium text-white/85">
                      {t.home.bannerInvalidImageErr}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={clearEditorForm}
                  className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
                >
                  {t.home.bannerCancelEditBtn}
                </button>
              )}
              <button
                type="button"
                disabled={!trimmedPreviewSrc || previewFailed || uploadingFile || saving}
                onClick={handleAddOrUpdateSlide}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-45 transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
              >
                {isEditing ? (
                  <Check className="w-4 h-4 text-[#E5B742]" />
                ) : (
                  <Plus className="w-4 h-4 text-[#E5B742]" />
                )}
                <span>{isEditing ? t.home.bannerUpdateSlideBtn : t.home.bannerAddBtn}</span>
              </button>
            </div>
          </section>

          {/* Current Ordered Slides */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#1C1917]">
                {t.home.bannerCurrentTitle}
              </h4>
              <span className="text-xs font-medium text-[#57534E] tabular-nums">
                {formatMsg(t.home.bannerCountLabel, { count: draftSlides.length })}
              </span>
            </div>

            <div className="space-y-2">
              {draftSlides.map((slide, index) => {
                const isDefault = slide.id === HERO_SLIDES[0]?.id;
                const isBeingEdited = slide.id === editingSlideId;
                return (
                  <div
                    key={slide.id}
                    className={`flex items-center gap-3 rounded-xl border p-2.5 sm:p-3 transition-colors ${
                      isBeingEdited
                        ? 'border-[#6B1118] bg-[#F9EFF0]/70'
                        : 'border-[#E6DFD5] bg-white'
                    }`}
                  >
                    <div className="h-14 w-24 sm:h-16 sm:w-28 rounded-lg overflow-hidden border border-[#E6DFD5] bg-[#32050A] shrink-0 flex items-center justify-center">
                      <img
                        src={slide.src}
                        alt={slide.alt}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5 text-start">
                      <p className="text-xs sm:text-sm font-semibold text-[#1C1917] truncate">
                        {slide.caption || slide.alt}
                      </p>
                      {slide.subtitle && (
                        <p className="text-[11px] text-[#57534E] truncate">
                          {slide.subtitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-[#57534E] tabular-nums">
                        <span>
                          #{index + 1}
                          {isDefault ? ` · ${t.home.bannerDefaultTag}` : ''}
                        </span>
                        {slide.link && (
                          <span className="inline-flex items-center gap-1 truncate text-[#6B1118]">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[140px]">{slide.link}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(slide)}
                        aria-label={t.home.bannerEditSlide}
                        title={t.home.bannerEditSlide}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                          isBeingEdited
                            ? 'border-[#6B1118] bg-[#6B1118] text-white'
                            : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118]/50'
                        }`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
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
        <footer className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E6DFD5] bg-white px-4 py-3 pb-safe sm:px-5 shrink-0">
          <button
            type="button"
            disabled={saving || uploadingFile}
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.home.bannerResetDefault}</span>
          </button>

          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              disabled={saving || uploadingFile}
              onClick={onClose}
              className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2 text-xs sm:text-sm font-semibold text-[#1C1917] hover:border-[#6B1118]/40 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap disabled:opacity-50"
            >
              {t.home.bannerCancelBtn}
            </button>
            <button
              type="button"
              disabled={saving || uploadingFile}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-55 transition-colors cursor-pointer min-h-[42px] whitespace-nowrap"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{saving ? t.home.bannerSavingBtn : t.home.bannerSaveBtn}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
