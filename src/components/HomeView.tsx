import React, { useEffect, useState } from 'react';
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
import { apiFetch } from '../lib/api';
import {
  COMPETITION_UPDATED_EVENT,
  getCachedLeaderboard,
  getQueuedPointsSummary,
  saveCachedLeaderboard,
} from '../lib/competitionQueue';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Announcement,
  Chapter,
  CompetitionLeaderboardResponse,
  TabId,
  User,
} from '../types';
import { UserAvatar } from './UserAvatar';
import { HeroImageSlider } from './HeroImageSlider';
import { TextbookPdfViewerModal } from './TextbookPdfViewerModal';
import { formatUtcDate } from '../utils/dateFormat';
import {
  OFFICIAL_BOOK_FILENAME,
  OFFICIAL_BOOK_PDF_URL,
  getAttachmentDownloadHref,
  getOfficialBookChapterMeta,
} from '../lib/textbookCatalog';

interface HomeViewProps {
  user: User;
  chapters: Chapter[];
  generalCount: number;
  announcements: Announcement[];
  unreadNotifications: number;
  leaderboardVersion?: number;
  onNavigate: (tab: TabId) => void;
  onSelectChapter: (chapterNumber: number | 'all') => void;
  onRefreshAnnouncements: () => Promise<void>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  chapters,
  generalCount,
  announcements,
  unreadNotifications,
  leaderboardVersion = 0,
  onNavigate,
  onSelectChapter,
  onRefreshAnnouncements,
}) => {
  const { t, dir } = useLanguage();
  const [showPublisher, setShowPublisher] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<'announcement' | 'material'>('announcement');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<CompetitionLeaderboardResponse | null>(null);
  const [pendingPoints, setPendingPoints] = useState(0);
  const [showTextbookPreview, setShowTextbookPreview] = useState(false);

  const totalChapterQuestions = chapters.reduce((acc, c) => acc + c.question_count, 0);
  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

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
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('type', type);
      if (file) {
        formData.append('file', file);
      }
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: formData,
      });
      setTitle('');
      setContent('');
      setFile(null);
      setShowPublisher(false);
      await onRefreshAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish update.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    setError(null);
    try {
      await apiFetch(`/api/announcements/${id}`, { method: 'DELETE' });
      await onRefreshAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete announcement.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Entry Hero / Banner Slider */}
      <HeroImageSlider pauseOnHover={true} />

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
                className="py-5 first:pt-2 last:pb-0 flex items-start justify-between gap-4"
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

      {showTextbookPreview && (
        <TextbookPdfViewerModal
          url={OFFICIAL_BOOK_PDF_URL}
          title={t.textbooks.officialBookTitle}
          fileName={OFFICIAL_BOOK_FILENAME}
          initialPage={1}
          isOfficialBook={true}
          onClose={() => setShowTextbookPreview(false)}
        />
      )}
    </div>
  );
};
