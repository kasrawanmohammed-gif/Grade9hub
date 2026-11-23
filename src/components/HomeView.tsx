import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookText,
  FileText,
  HelpCircle,
  Library,
  Megaphone,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { ApiError, apiFetch, isStaticBackendActive } from '../lib/api';
import {
  COMPETITION_UPDATED_EVENT,
  getCachedLeaderboard,
  getQueuedPointsSummary,
  saveCachedLeaderboard,
} from '../lib/competitionQueue';
import {
  createCloudAnnouncement,
  deleteCloudAnnouncement,
  saveCloudHeroBanners,
  subscribeCloudHeroBanners,
} from '../lib/cloudAccounts';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Announcement,
  Chapter,
  CompetitionLeaderboardResponse,
  TabId,
  User,
} from '../types';
import { HERO_SLIDES, type HeroSlide } from '../config/heroSlides';
import {
  HERO_BANNERS_CHANNEL_NAME,
  HERO_BANNERS_UPDATED_EVENT,
  broadcastHeroBannersUpdated,
  loadLocalHeroSlides,
  sanitizeHeroSlidesList,
  saveLocalHeroSlides,
} from '../lib/heroSlidesStore';
import { UserAvatar } from './UserAvatar';
import { HeroImageSlider } from './HeroImageSlider';
import { HeroBannerManagerModal } from './HeroBannerManagerModal';
import { formatUtcDate } from '../utils/dateFormat';

const TextbookPdfViewerModal = lazy(() =>
  import('./TextbookPdfViewerModal').then((m) => ({ default: m.TextbookPdfViewerModal }))
);
import {
  OFFICIAL_BOOK_FILENAME,
  OFFICIAL_BOOK_PDF_URL,
  getAttachmentDownloadHref,
  getOfficialBookChapterMeta,
} from '../lib/textbookCatalog';
import type { AppSettings } from '../types';

interface HomeViewProps {
  user: User;
  chapters: Chapter[];
  generalCount: number;
  announcements: Announcement[];
  unreadNotifications: number;
  leaderboardVersion?: number;
  appSettings?: AppSettings | null;
  onAppSettingsUpdated?: (settings: AppSettings) => void;
  onNavigate: (tab: TabId) => void;
  onSelectChapter: (chapterNumber: number | 'all') => void;
  onRefreshAnnouncements: () => Promise<void>;
  initialAnnouncementId?: number | null;
  onClearInitialAnnouncementId?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  chapters,
  generalCount,
  announcements,
  unreadNotifications,
  leaderboardVersion = 0,
  appSettings = null,
  onAppSettingsUpdated,
  onNavigate,
  onSelectChapter,
  onRefreshAnnouncements,
  initialAnnouncementId = null,
  onClearInitialAnnouncementId,
}) => {
  const { t, dir } = useLanguage();
  const canManageBanners = Boolean(user.isAdmin || user.role === 'teacher');
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
    const fromSettings = sanitizeHeroSlidesList(appSettings?.heroSlides);
    return fromSettings.length > 0 ? fromSettings : loadLocalHeroSlides();
  });
  const [showBannerManager, setShowBannerManager] = useState(false);
  const [bannerStatusNotice, setBannerStatusNotice] = useState<string | null>(null);
  const [showPublisher, setShowPublisher] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'announcement' | 'material'>('announcement');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcementNotice, setAnnouncementNotice] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardResponse | null>(null);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [showTextbookPreview, setShowTextbookPreview] = useState(false);
  const [highlightedAnnouncementId, setHighlightedAnnouncementId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!initialAnnouncementId || announcements.length === 0) return;
    const exists = announcements.some((item) => item.id === initialAnnouncementId);
    if (!exists) return;
    setHighlightedAnnouncementId(initialAnnouncementId);
    const frame = requestAnimationFrame(() => {
      const el = document.querySelector(
        `article[data-announcement-id="${initialAnnouncementId}"]`
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    onClearInitialAnnouncementId?.();
    const timer = setTimeout(() => {
      setHighlightedAnnouncementId((cur) => (cur === initialAnnouncementId ? null : cur));
    }, 3500);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [initialAnnouncementId, announcements, onClearInitialAnnouncementId]);

  const totalChapterQuestions = chapters.reduce((acc, c) => acc + c.question_count, 0);
  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const synced = sanitizeHeroSlidesList(appSettings?.heroSlides);
    if (synced.length > 0) {
      setHeroSlides(synced);
      saveLocalHeroSlides(synced);
    }
  }, [appSettings?.heroSlides]);

  useEffect(() => {
    const unsubCloud = subscribeCloudHeroBanners((cloudSlides) => {
      if (cloudSlides.length > 0) {
        setHeroSlides(cloudSlides);
        saveLocalHeroSlides(cloudSlides);
      }
    });

    const handleCustomUpdate = (e: Event) => {
      const detailSlides = sanitizeHeroSlidesList(
        (e as CustomEvent<{ slides?: HeroSlide[] }>)?.detail?.slides
      );
      if (detailSlides.length > 0) {
        setHeroSlides(detailSlides);
      }
    };
    window.addEventListener(HERO_BANNERS_UPDATED_EVENT, handleCustomUpdate);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(HERO_BANNERS_CHANNEL_NAME);
        channel.onmessage = (msg) => {
          const incomingSlides = sanitizeHeroSlidesList(msg.data?.slides);
          if (incomingSlides.length > 0) {
            setHeroSlides(incomingSlides);
            saveLocalHeroSlides(incomingSlides);
          }
        };
      }
    } catch {
      // ignore BroadcastChannel failures on Safari
    }

    return () => {
      unsubCloud();
      window.removeEventListener(HERO_BANNERS_UPDATED_EVENT, handleCustomUpdate);
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore close error
        }
      }
    };
  }, []);

  const handleSaveHeroSlides = async (
    nextSlides: HeroSlide[]
  ): Promise<{ ok: boolean; notice?: string }> => {
    const sanitized = sanitizeHeroSlidesList(nextSlides);
    const cleanSlides = sanitized.length > 0 ? sanitized : [...HERO_SLIDES];

    try {
      const res = await apiFetch<{
        ok: boolean;
        cloudSynced?: boolean;
        settings: AppSettings;
      }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ heroSlides: cleanSlides }),
      });
      const savedList = sanitizeHeroSlidesList(res?.settings?.heroSlides);
      const finalSlides = savedList.length > 0 ? savedList : cleanSlides;

      let cloudSynced = Boolean(res?.cloudSynced);
      if (!isStaticBackendActive()) {
        cloudSynced = await saveCloudHeroBanners(finalSlides).catch(() => false);
      }

      setHeroSlides(finalSlides);
      saveLocalHeroSlides(finalSlides);
      broadcastHeroBannersUpdated(finalSlides);
      if (res?.settings && onAppSettingsUpdated) {
        onAppSettingsUpdated(res.settings);
      }
      setBannerStatusNotice(
        isStaticBackendActive() && !cloudSynced
          ? t.home.bannerStorageFallbackMsg
          : t.home.bannerSavedMsg
      );
      return { ok: true };
    } catch (err) {
      const isAuthDenied = err instanceof ApiError && (err.status === 401 || err.status === 403);
      const [cloudOk, localResult] = await Promise.all([
        saveCloudHeroBanners(cleanSlides).catch(() => false),
        Promise.resolve(
          isAuthDenied ? { ok: false, slides: cleanSlides } : saveLocalHeroSlides(cleanSlides)
        ),
      ]);
      if (!cloudOk && !localResult.ok) {
        return {
          ok: false,
          notice:
            isAuthDenied && err instanceof Error && err.message
              ? err.message
              : t.home.bannerSaveFailedErr,
        };
      }
      setHeroSlides(localResult.slides);
      broadcastHeroBannersUpdated(localResult.slides);
      if (onAppSettingsUpdated) {
        onAppSettingsUpdated({
          allowStudentRegistration: appSettings?.allowStudentRegistration ?? true,
          communityEnabled: appSettings?.communityEnabled ?? true,
          communityPostingEnabled: appSettings?.communityPostingEnabled ?? true,
          aiTutorEnabled: appSettings?.aiTutorEnabled ?? true,
          defaultLanguage: appSettings?.defaultLanguage ?? 'en',
          maintenanceMessage: appSettings?.maintenanceMessage ?? '',
          heroSlides: localResult.slides,
          updatedAt: new Date().toISOString(),
        });
      }
      setBannerStatusNotice(cloudOk ? t.home.bannerSavedMsg : t.home.bannerStorageFallbackMsg);
      return { ok: true };
    }
  };

  const handleOpenBannerLink = (link: string): boolean => {
    const normalized = link.trim().replace(/\/+$/, '') || '/';
    const routeMap: Record<string, TabId> = {
      '/': 'home',
      '/home': 'home',
      '/community': 'community',
      '/competition': 'competition',
      '/multiple-choice': 'multiple-choice',
      '/quizzes': 'multiple-choice',
      '/textbooks-qa': 'textbooks-qa',
      '/textbooks': 'textbooks-qa',
      '/general-questions': 'general-questions',
      '/ask-teacher': 'ask-teacher',
      '/notifications': 'notifications',
      '/ai-studio': 'ai-studio',
      '/profile': 'profile',
      '/settings': 'settings',
      '/about': 'about',
    };
    const targetTab = routeMap[normalized];
    if (targetTab) {
      onNavigate(targetTab);
      return true;
    }
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    const loadTopScorers = async () => {
      const queued = await getQueuedPointsSummary(user.id);
      if (!cancelled) setPendingPoints(queued.totalPendingPoints);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedLeaderboard(user.id);
        if (!cancelled && cached) setLeaderboard(cached);
        return;
      }

      try {
        const data = await apiFetch<CompetitionLeaderboardResponse>('/api/competition/leaderboard');
        if (!cancelled) {
          setLeaderboard(data);
          void saveCachedLeaderboard(user.id, data);
        }
      } catch {
        const cached = await getCachedLeaderboard(user.id);
        if (!cancelled && cached) setLeaderboard(cached);
      }
    };

    void loadTopScorers();
    const handleCompEvent = () => void loadTopScorers();
    window.addEventListener(COMPETITION_UPDATED_EVENT, handleCompEvent);
    return () => {
      cancelled = true;
      window.removeEventListener(COMPETITION_UPDATED_EVENT, handleCompEvent);
    };
  }, [user.id, leaderboardVersion]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAnnouncementNotice(null);
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      setError(t.home.announcementValidationErr);
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', trimmedTitle);
      formData.append('content', trimmedContent);
      formData.append('type', type);
      if (file) {
        formData.append('file', file);
      }
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: formData,
      });
      if (!isStaticBackendActive()) {
        void createCloudAnnouncement({
          title: trimmedTitle,
          content: trimmedContent,
          type,
          authorName: user.name || 'Mr. Kasrawan',
        }).catch(() => null);
      }
      setTitle('');
      setContent('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowPublisher(false);
      setAnnouncementNotice(
        `${t.home.announcementPublishedMsg} ${t.home.announcementLiveDelivered}`
      );
      await onRefreshAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish update.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    setError(null);
    setAnnouncementNotice(null);
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      if (!isStaticBackendActive()) {
        void deleteCloudAnnouncement(id).catch(() => {});
      }
      setAnnouncementNotice(t.home.announcementDeletedMsg);
      await onRefreshAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Entry Hero / Banner Slider */}
      <div className="space-y-2">
        <HeroImageSlider
          slides={heroSlides}
          intervalMs={4500}
          pauseOnHover={true}
          externalPaused={showBannerManager}
          canManage={canManageBanners}
          onOpenLink={handleOpenBannerLink}
          onOpenManager={() => {
            setBannerStatusNotice(null);
            setShowBannerManager(true);
          }}
        />
        {bannerStatusNotice && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-medium text-[#1C1917]">
            <span>{bannerStatusNotice}</span>
            <button
              type="button"
              onClick={() => setBannerStatusNotice(null)}
              className="text-xs font-semibold text-[#6B1118] hover:underline cursor-pointer"
            >
              {t.brand.gotIt}
            </button>
          </div>
        )}
      </div>

      {/* 4-column Summary Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('multiple-choice')}
          className="text-start rounded-xl bg-white border border-[#E6DFD5] p-5 hover:border-[#6B1118]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#57534E]">
            <span className="text-xs font-medium">{t.home.cardModulesLabel}</span>
            <BookOpen className="w-4 h-4 text-[#6B1118]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1C1917] tabular-nums">
            {t.home.chaptersCount}
          </p>
          <p className="mt-1 text-xs text-[#57534E] tabular-nums">
            {totalChapterQuestions} {t.home.chapterQuestions}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('general-questions')}
          className="text-start rounded-xl bg-white border border-[#E6DFD5] p-5 hover:border-[#6B1118]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#57534E]">
            <span className="text-xs font-medium">{t.home.cardGeneralLabel}</span>
            <HelpCircle className="w-4 h-4 text-[#D9A62E]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1C1917] tabular-nums">{generalCount}</p>
          <p className="mt-1 text-xs text-[#57534E]">{t.home.generalDesc}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('notifications')}
          className="text-start rounded-xl bg-white border border-[#E6DFD5] p-5 hover:border-[#6B1118]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#57534E]">
            <span className="text-xs font-medium">{t.home.cardAlertsLabel}</span>
            <Megaphone className="w-4 h-4 text-[#6B1118]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1C1917] tabular-nums">
            {unreadNotifications}
          </p>
          <p className="mt-1 text-xs text-[#57534E]">{t.home.alertsDesc}</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ai-studio')}
          className="text-start rounded-xl bg-white border border-[#E6DFD5] p-5 hover:border-[#6B1118]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[#57534E]">
            <span className="text-xs font-medium">{t.home.cardStudioLabel}</span>
            <Sparkles className="w-4 h-4 text-[#D9A62E]" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-[#1C1917]">
            {t.brand.scienceStudio}
          </p>
          <p className="mt-1 text-xs text-[#57534E]">{t.home.studioDesc}</p>
        </button>
      </section>

      {/* Textbooks & Study Q&A Quick-Access Card */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-11 h-11 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
              <Library className="w-5 h-5 text-[#6B1118]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1C1917]">{t.home.textbooksCardTitle}</h3>
              <p className="text-sm text-[#57534E] mt-0.5 leading-relaxed">
                {t.home.textbooksCardSub}
              </p>
              <p className="mt-2 text-xs font-medium text-[#6B1118] tabular-nums">
                {t.home.chaptersCount} · {t.home.textbooksGuidesLabel} · {totalChapterQuestions + generalCount}+{' '}
                {t.home.textbooksQaLabel}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowTextbookPreview(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap shrink-0"
            >
              <BookText className="w-4 h-4 text-[#6B1118]" />
              <span>{t.textbooks.previewTextbookBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('textbooks-qa')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap shrink-0"
            >
              <Library className="w-4 h-4 text-[#E5B742]" />
              <span>{t.home.openTextbooksBtn}</span>
              <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
            </button>
          </div>
        </div>
      </section>

      {/* Top Scorers & Student Competition Quick-Access Card */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#D9A62E]" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1C1917]">{t.home.topScorersTitle}</h3>
              <p className="text-sm text-[#57534E] mt-0.5">{t.home.topScorersSub}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {user.role === 'student' && !user.isAdmin && leaderboard?.myStats && (
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs text-[#1C1917] tabular-nums">
                <span className="text-[#57534E]">{t.home.yourRankLabel}:</span>{' '}
                <strong className="text-[#6B1118]">
                  {leaderboard.myStats.rank ? `#${leaderboard.myStats.rank}` : '—'}
                </strong>{' '}
                ·{' '}
                <strong>
                  {leaderboard.myStats.totalPoints + pendingPoints} {t.home.ptsUnit}
                </strong>
                {pendingPoints > 0 && (
                  <span className="text-[#D9A62E] font-semibold">
                    {' '}
                    (+{pendingPoints} {t.home.pendingSyncShort})
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => onNavigate('competition')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[44px]"
            >
              <span>{t.home.viewLeaderboardBtn}</span>
              <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
            </button>
          </div>
        </div>

        {!leaderboard || leaderboard.topThree.length === 0 ? (
          <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-5 py-6 text-center text-sm text-[#57534E]">
            {t.home.noScorersYet}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {leaderboard.topThree.map((entry) => {
              const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
              const isMe = entry.userId === user.id || entry.isCurrentUser;
              return (
                <button
                  key={entry.userId}
                  type="button"
                  onClick={() => onNavigate('competition')}
                  className={`text-start rounded-xl border p-4 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isMe
                      ? 'border-[#6B1118]/50 bg-[#F9EFF0]'
                      : 'border-[#E6DFD5] bg-[#FAF8F5] hover:border-[#6B1118]/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl leading-none shrink-0" aria-hidden="true">
                      {medal}
                    </span>
                    <UserAvatar
                      name={entry.name}
                      avatarUrl={entry.avatar_url}
                      sizeClass="w-10 h-10"
                      textClass="text-xs"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1C1917] truncate">{entry.name}</p>
                      <p className="text-xs text-[#57534E] truncate tabular-nums">
                        {entry.grade || t.home.studentPortal} · {entry.accuracyPercent}%
                      </p>
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-base font-bold text-[#6B1118] tabular-nums">
                      {entry.totalPoints}
                    </p>
                    <p className="text-[11px] text-[#57534E]">{t.home.ptsUnit}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Announcements & Study Materials */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E6DFD5]">
          <div>
            <h3 className="text-xl font-bold text-[#1C1917]">{t.home.announcementsTitle}</h3>
            <p className="text-sm text-[#57534E] mt-0.5">{t.home.announcementsDesc}</p>
          </div>
          {(user.role === 'teacher' || user.isAdmin) && (
            <button
              type="button"
              onClick={() => setShowPublisher((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-[#E5B742]" />
              <span>{showPublisher ? t.home.closeFormBtn : t.home.publishBtn}</span>
            </button>
          )}
        </div>

        {(user.role === 'teacher' || user.isAdmin) && showPublisher && (
          <form
            onSubmit={handlePublish}
            className="mt-6 rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-5 space-y-4"
          >
            {error && (
              <p className="text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#DC2626]/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.home.titleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.home.titleLabel}
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.home.categoryLabel}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'announcement' | 'material')}
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                >
                  <option value="announcement">{t.home.announcementOpt}</option>
                  <option value="material">{t.home.materialOpt}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.home.messageLabel}
              </label>
              <textarea
                rows={3}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t.home.messageLabel}
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B1118] cursor-pointer rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 hover:border-[#6B1118]/40">
                <Paperclip className="w-4 h-4" />
                <span>{file ? file.name : t.home.attachOptional}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 cursor-pointer min-h-[44px]"
              >
                {submitting ? t.home.publishingNotify : t.home.publishNotifyBtn}
              </button>
            </div>
          </form>
        )}

        {announcementNotice && (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-2 text-sm text-[#065F46] bg-[#ECFDF5] border border-[#059669]/30 rounded-lg px-3.5 py-2"
          >
            <span>{announcementNotice}</span>
            <button
              type="button"
              onClick={() => setAnnouncementNotice(null)}
              className="text-xs font-semibold underline cursor-pointer"
            >
              {t.brand.gotIt}
            </button>
          </div>
        )}

        {error && !showPublisher && (
          <p className="mt-4 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#DC2626]/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-5 divide-y divide-[#E6DFD5]">
          {announcements.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#57534E]">
              {t.home.noAnnouncements}
            </div>
          ) : (
            announcements.map((item) => (
              <article
                key={item.id}
                data-announcement-id={item.id}
                className={`py-5 first:pt-2 last:pb-0 flex items-start justify-between gap-4 rounded-xl transition-colors ${
                  highlightedAnnouncementId === item.id
                    ? 'bg-[#F9EFF0]/70 px-3 ring-2 ring-[#6B1118]/50'
                    : ''
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#57534E]">
                    <span className="font-semibold text-[#6B1118]">
                      {item.type === 'material' ? t.home.materialOpt : t.home.announcementOpt}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.author_name || 'Mr. Kasrawan'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatUtcDate(item.created_at)}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-[#1C1917]">{item.title}</h4>
                  <p className="text-sm text-[#57534E] whitespace-pre-wrap leading-relaxed">
                    {item.content}
                  </p>
                  {item.attachment_url && item.attachment_name && (
                    <div className="pt-2">
                      {item.attachment_mime?.startsWith('image/') ? (
                        <a
                          href={item.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block rounded-xl overflow-hidden border border-[#E6DFD5] max-w-xs"
                        >
                          <img
                            src={item.attachment_url}
                            alt={item.attachment_name}
                            referrerPolicy="no-referrer"
                            className="max-h-48 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={getAttachmentDownloadHref(item.attachment_url, item.attachment_name)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118]/40"
                        >
                          <FileText className="w-4 h-4" />
                          <span>
                            {t.home.download} {item.attachment_name}
                          </span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {(user.role === 'teacher' || user.isAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncement(item.id)}
                    aria-label="Delete announcement"
                    className="p-2 text-[#57534E] hover:text-[#DC2626] rounded-lg cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      {/* Quick Jump into Chapters */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#1C1917]">{t.home.quickJumpTitle}</h3>
            <p className="text-sm text-[#57534E] mt-0.5">{t.home.quickJumpDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectChapter('all');
              onNavigate('multiple-choice');
            }}
            className="text-sm font-semibold text-[#6B1118] hover:underline cursor-pointer"
          >
            {t.home.startAllChapters}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {chapters.map((ch) => {
            const bookMeta = getOfficialBookChapterMeta(ch.chapter_number);
            return (
              <button
                key={ch.chapter_number}
                type="button"
                onClick={() => {
                  onSelectChapter(ch.chapter_number);
                  onNavigate('multiple-choice');
                }}
                className="text-start rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 hover:border-[#6B1118] hover:bg-white transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <p className="font-semibold text-[#6B1118] tabular-nums">
                    {t.home.chapterWord} {ch.chapter_number}
                  </p>
                  {bookMeta && (
                    <span className="text-[11px] font-medium text-[#57534E] tabular-nums">
                      p.{bookMeta.startPage}–{bookMeta.endPage}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-[#1C1917] truncate">
                  {ch.title}
                </p>
                <p className="mt-1 text-xs text-[#57534E] tabular-nums">
                  {ch.question_count}{' '}
                  {ch.question_count === 1 ? t.home.questionSingular : t.home.questionPlural}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {showBannerManager && canManageBanners && (
        <HeroBannerManagerModal
          slides={heroSlides}
          onSave={handleSaveHeroSlides}
          onClose={() => setShowBannerManager(false)}
        />
      )}

      {showTextbookPreview && (
        <Suspense fallback={null}>
          <TextbookPdfViewerModal
            url={OFFICIAL_BOOK_PDF_URL}
            title={t.textbooks.officialBookTitle}
            fileName={OFFICIAL_BOOK_FILENAME}
            initialPage={1}
            isOfficialBook={true}
            onClose={() => setShowTextbookPreview(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
