import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CloudUpload,
  History,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  COMPETITION_UPDATED_EVENT,
  flushCompetitionQueue,
  getCachedLeaderboard,
  getQueuedPointsSummary,
  QueuedPointsSummary,
  saveCachedLeaderboard,
} from '../lib/competitionQueue';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';
import {
  CompetitionLeaderboardResponse,
  CompetitionMedal,
  LeaderboardEntry,
  TabId,
  User,
} from '../types';
import type { LiveCommunityEvent } from './CommunityView';
import { UserAvatar } from './UserAvatar';
import { formatUtcDate } from '../utils/dateFormat';

interface CompetitionViewProps {
  user: User;
  leaderboardVersion: number;
  liveEvent?: LiveCommunityEvent | null;
  onNavigate: (tab: TabId) => void;
}

const DEFAULT_RULES = {
  correctAnswer: 10,
  quizCompleted: 25,
  highScore80Bonus: 15,
  perfectScoreBonus: 30,
  curriculumActivity: 5,
};

function getMedalEmoji(badge: CompetitionMedal | number): string {
  if (badge === 'gold' || badge === 1) return '🥇';
  if (badge === 'silver' || badge === 2) return '🥈';
  if (badge === 'bronze' || badge === 3) return '🥉';
  return '';
}

export const CompetitionView: React.FC<CompetitionViewProps> = ({
  user,
  leaderboardVersion,
  liveEvent,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [data, setData] = useState<CompetitionLeaderboardResponse | null>(null);
  const [livePresenceMap, setLivePresenceMap] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState<QueuedPointsSummary>({
    count: 0,
    totalPendingPoints: 0,
    events: [],
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [usingCachedOffline, setUsingCachedOffline] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const refreshPending = useCallback(async () => {
    const summary = await getQueuedPointsSummary(user.id);
    setPending(summary);
    return summary;
  }, [user.id]);

  const loadLeaderboard = useCallback(async () => {
    await refreshPending();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await getCachedLeaderboard(user.id);
      if (cached) {
        setData(cached);
        setUsingCachedOffline(true);
      }
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch<CompetitionLeaderboardResponse>('/api/competition/leaderboard');
      setData(res);
      setLivePresenceMap({});
      setUsingCachedOffline(false);
      await saveCachedLeaderboard(user.id, res);
    } catch {
      const cached = await getCachedLeaderboard(user.id);
      if (cached) {
        setData(cached);
        setUsingCachedOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshPending, user.id]);

  const handleManualSync = useCallback(async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    setSyncNotice(null);
    try {
      const result = await flushCompetitionQueue(user.id);
      if (result.snapshot) {
        setData(result.snapshot);
        setUsingCachedOffline(false);
      } else {
        await loadLeaderboard();
      }
      await refreshPending();
      if (result.syncedCount > 0) {
        setSyncNotice(
          formatMsg(t.competition.syncedSuccessMsg, {
            pts: result.awardedPoints,
          })
        );
      }
    } finally {
      setSyncing(false);
    }
  }, [isOnline, loadLeaderboard, refreshPending, syncing, t.competition.syncedSuccessMsg, user.id]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard, leaderboardVersion]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void (async () => {
        setSyncing(true);
        try {
          const result = await flushCompetitionQueue(user.id);
          if (result.syncedCount > 0) {
            setSyncNotice(
              formatMsg(t.competition.syncedSuccessMsg, {
                pts: result.awardedPoints,
              })
            );
          }
          await loadLeaderboard();
        } finally {
          setSyncing(false);
        }
      })();
    };
    const onOffline = () => {
      setIsOnline(false);
      void loadLeaderboard();
    };
    const onQueueUpdate = () => {
      void refreshPending();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(COMPETITION_UPDATED_EVENT, onQueueUpdate);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(COMPETITION_UPDATED_EVENT, onQueueUpdate);
    };
  }, [loadLeaderboard, refreshPending, t.competition.syncedSuccessMsg, user.id]);

  useEffect(() => {
    if (!liveEvent || liveEvent.type !== 'community:presence' || !liveEvent.payload) return;
    const p = liveEvent.payload as { userId?: number; online?: boolean };
    if (typeof p.userId !== 'number') return;
    setLivePresenceMap((prev) => ({ ...prev, [p.userId!]: Boolean(p.online) }));
  }, [liveEvent]);

  const isEntryOnline = useCallback(
    (entry: LeaderboardEntry) =>
      entry.userId in livePresenceMap ? livePresenceMap[entry.userId] : Boolean(entry.online),
    [livePresenceMap]
  );

  const rules = data?.rules || DEFAULT_RULES;

  // Overlay any unsynced local offline points so student sees immediate feedback
  const displayedLeaderboard = useMemo<LeaderboardEntry[]>(() => {
    const base = data?.leaderboard || [];
    if (pending.totalPendingPoints <= 0 || isPrivileged) {
      return base;
    }

    let foundMe = false;
    const withPending = base.map((entry) => {
      if (entry.userId === user.id || entry.isCurrentUser) {
        foundMe = true;
        return {
          ...entry,
          totalPoints: entry.totalPoints + pending.totalPendingPoints,
        };
      }
      return entry;
    });

    if (!foundMe) {
      withPending.push({
        rank: withPending.length + 1,
        userId: user.id,
        name: user.name,
        grade: user.grade || '',
        avatar_url: user.avatar_url || '',
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
        totalPoints: (data?.myStats?.totalPoints ?? 0) + pending.totalPendingPoints,
        quizPoints: data?.myStats?.quizPoints ?? 0,
        activityPoints: data?.myStats?.activityPoints ?? 0,
        quizzesCompleted: data?.myStats?.quizzesCompleted ?? 0,
        correctAnswers: data?.myStats?.correctAnswers ?? 0,
        questionsAnswered: data?.myStats?.correctAnswers ?? 0,
        accuracyPercent: data?.myStats?.accuracyPercent ?? 0,
        badge: null,
        isCurrentUser: true,
      });
    }

    withPending.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.accuracyPercent !== a.accuracyPercent) return b.accuracyPercent - a.accuracyPercent;
      return a.name.localeCompare(b.name);
    });

    return withPending.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
      badge: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : null,
    }));
  }, [data?.leaderboard, data?.myStats, isPrivileged, pending.totalPendingPoints, user.avatar_url, user.grade, user.id, user.name]);

  const topThree = useMemo(() => displayedLeaderboard.slice(0, 3), [displayedLeaderboard]);

  const myRow = useMemo(
    () => displayedLeaderboard.find((item) => item.userId === user.id || item.isCurrentUser) || null,
    [displayedLeaderboard, user.id]
  );

  const effectiveMyStats = useMemo(() => {
    const base = data?.myStats;
    const totalPoints = (myRow?.totalPoints ?? base?.totalPoints ?? 0) + (!myRow && !isPrivileged ? pending.totalPendingPoints : 0);
    return {
      rank: myRow?.rank ?? base?.rank ?? null,
      totalPoints,
      quizPoints: base?.quizPoints ?? 0,
      activityPoints: base?.activityPoints ?? 0,
      quizzesCompleted: base?.quizzesCompleted ?? 0,
      accuracyPercent: base?.accuracyPercent ?? 0,
      badge: myRow?.badge ?? base?.badge ?? null,
      totalStudents: displayedLeaderboard.length || base?.totalStudents || 0,
    };
  }, [data?.myStats, displayedLeaderboard.length, isPrivileged, myRow, pending.totalPendingPoints]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return displayedLeaderboard;
    return displayedLeaderboard.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.grade && s.grade.toLowerCase().includes(q))
    );
  }, [displayedLeaderboard, search]);

  const recentEvents = data?.recentEvents || [];

  const getEventTypeLabel = (eventType: string) => {
    if (eventType === 'correct_answer') return t.competition.eventCorrectAnswer;
    if (eventType === 'quiz_completed') return t.competition.eventQuizCompleted;
    return t.competition.eventCurriculumActivity;
  };

  return (
    <div className="space-y-6">
      {/* Header & Hybrid Sync Status Bar */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-[#D9A62E]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] [text-wrap:balance]">
                {t.competition.title}
              </h2>
              <p className="text-sm text-[#57534E] mt-1 max-w-2xl">
                {t.competition.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {syncing ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#6B1118]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t.competition.syncingBadge}</span>
              </div>
            ) : !isOnline ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#D9A62E]/45 bg-[#FEFCE8] px-3.5 py-2 text-xs font-semibold text-[#92400E]">
                <WifiOff className="w-3.5 h-3.5" />
                <span>
                  {formatMsg(t.competition.offlineQueuedBadge, {
                    count: pending.count,
                    pts: pending.totalPendingPoints,
                  })}
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-3.5 py-2 text-xs font-semibold text-[#065F46]">
                <Wifi className="w-3.5 h-3.5" />
                <span>{t.competition.onlineLiveBadge}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => (pending.count > 0 && isOnline ? handleManualSync() : loadLeaderboard())}
              disabled={syncing || !isOnline}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] disabled:opacity-50 transition-colors cursor-pointer min-h-[38px]"
            >
              {pending.count > 0 && isOnline ? (
                <>
                  <CloudUpload className="w-3.5 h-3.5 text-[#6B1118]" />
                  <span>{t.competition.syncNowBtn}</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-[#6B1118]" />
                  <span>{t.competition.syncNowBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pending Offline Points Banner */}
        {pending.count > 0 && (
          <div className="rounded-xl border border-[#D9A62E]/40 bg-[#FAF8F5] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#1C1917]">
              <CloudUpload className="w-4 h-4 text-[#D9A62E] shrink-0" />
              <span>
                {formatMsg(t.competition.pendingPointsNotice, {
                  count: pending.count,
                  pts: pending.totalPendingPoints,
                })}
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncing}
                className="rounded-lg bg-[#6B1118] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer"
              >
                {syncing ? t.competition.syncingBadge : t.competition.syncNowBtn}
              </button>
            )}
          </div>
        )}

        {syncNotice && (
          <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-3 flex items-center gap-2 text-xs sm:text-sm font-medium text-[#065F46]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        {usingCachedOffline && (
          <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-3 flex items-center gap-2 text-xs sm:text-sm text-[#57534E]">
            <WifiOff className="w-4 h-4 text-[#D9A62E] shrink-0" />
            <span>{t.competition.cachedOfflineNotice}</span>
          </div>
        )}

        {isPrivileged && (
          <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-3 text-xs sm:text-sm text-[#57534E]">
            {t.competition.teacherViewNotice}
          </div>
        )}

        {/* Student Standing Summary */}
        {!isPrivileged && (
          <div className="pt-2 border-t border-[#E6DFD5]">
            <p className="text-xs font-semibold text-[#6B1118] mb-3">
              {t.competition.yourStandingTitle}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4">
                <p className="text-xs text-[#57534E]">{t.competition.rankLabel}</p>
                <p className="mt-1.5 text-2xl font-bold text-[#1C1917] tabular-nums flex items-center gap-1.5">
                  {effectiveMyStats.badge && (
                    <span aria-hidden="true">{getMedalEmoji(effectiveMyStats.badge)}</span>
                  )}
                  <span>
                    {effectiveMyStats.rank
                      ? `#${effectiveMyStats.rank}`
                      : t.competition.unrankedLabel}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#57534E] tabular-nums">
                  {effectiveMyStats.totalStudents} {t.competition.allStudentsTitle}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4">
                <p className="text-xs text-[#57534E]">{t.competition.totalPointsLabel}</p>
                <p className="mt-1.5 text-2xl font-bold text-[#6B1118] tabular-nums">
                  {effectiveMyStats.totalPoints}{' '}
                  <span className="text-sm font-semibold">{t.competition.ptsUnit}</span>
                </p>
                <p className="mt-1 text-xs text-[#57534E] tabular-nums">
                  {pending.totalPendingPoints > 0
                    ? `+${pending.totalPendingPoints} ${t.competition.syncReadyBadge}`
                    : t.competition.onlineLiveBadge}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4">
                <p className="text-xs text-[#57534E]">{t.competition.quizPointsLabel}</p>
                <p className="mt-1.5 text-2xl font-bold text-[#1C1917] tabular-nums">
                  {effectiveMyStats.quizPoints}
                </p>
                <p className="mt-1 text-xs text-[#57534E] tabular-nums">
                  {t.competition.activityPointsLabel}: {effectiveMyStats.activityPoints}
                </p>
              </div>

              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4">
                <p className="text-xs text-[#57534E]">{t.competition.accuracyLabel}</p>
                <p className="mt-1.5 text-2xl font-bold text-[#1C1917] tabular-nums">
                  {effectiveMyStats.accuracyPercent}%
                </p>
                <p className="mt-1 text-xs text-[#57534E] tabular-nums">
                  {effectiveMyStats.quizzesCompleted} {t.competition.quizzesLabel}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Top 3 Champions Podium */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-[#1C1917]">{t.competition.podiumTitle}</h3>
            <p className="text-sm text-[#57534E] mt-0.5">{t.competition.podiumSub}</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('multiple-choice')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[40px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E5B742]" />
            <span>{t.nav.multipleChoice}</span>
          </button>
        </div>

        {loading && topThree.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#57534E]">
            {t.quiz.loadingQuestions}
          </div>
        ) : topThree.length === 0 ? (
          <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-8 text-center space-y-2">
            <Trophy className="w-9 h-9 text-[#D9A62E] mx-auto" />
            <p className="text-sm text-[#57534E]">{t.competition.noStudentsYet}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {topThree.map((entry) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;
              const orderClass = isFirst
                ? 'md:order-2'
                : isSecond
                ? 'md:order-1'
                : 'md:order-3';
              const placeLabel = isFirst
                ? t.competition.firstPlace
                : isSecond
                ? t.competition.secondPlace
                : t.competition.thirdPlace;
              const medal = getMedalEmoji(entry.rank);
              const surfaceClass = isFirst
                ? 'bg-[#6B1118] text-white border-[#6B1118] md:pb-8'
                : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6DFD5]';

              return (
                <div
                  key={entry.userId}
                  className={`rounded-2xl border p-5 flex flex-col items-center text-center transition-colors ${orderClass} ${surfaceClass}`}
                >
                  <div className="text-3xl leading-none mb-2" aria-hidden="true">
                    {medal}
                  </div>
                  <p
                    className={`text-xs font-bold tracking-wide mb-3 ${
                      isFirst ? 'text-[#E5B742]' : 'text-[#6B1118]'
                    }`}
                  >
                    {placeLabel}
                  </p>

                  <div className="relative">
                    <UserAvatar
                      name={entry.name}
                      avatarUrl={entry.avatar_url}
                      sizeClass={isFirst ? 'w-16 h-16' : 'w-14 h-14'}
                      textClass="text-lg"
                      borderClass={isFirst ? 'border-2 border-[#E5B742]' : 'border-2 border-[#D9A62E]'}
                      fallbackClass={isFirst ? 'bg-white text-[#6B1118]' : 'bg-[#6B1118] text-white'}
                    />
                    {isEntryOnline(entry) && (
                      <span
                        title={t.askTeacher.onlineLabel}
                        aria-label={t.askTeacher.onlineLabel}
                        className={`absolute bottom-0 end-0 w-3.5 h-3.5 rounded-full bg-[#059669] ring-2 ${
                          isFirst ? 'ring-[#6B1118]' : 'ring-[#FAF8F5] dark:ring-[#272222]'
                        }`}
                      />
                    )}
                  </div>

                  <h4 className="mt-3 text-base font-bold max-w-full truncate">
                    {entry.name}
                    {entry.userId === user.id ? ` (${t.competition.youBadge})` : ''}
                  </h4>
                  <p
                    className={`text-xs mt-0.5 truncate max-w-full ${
                      isFirst ? 'text-[#FBF4DF]/80' : 'text-[#57534E]'
                    }`}
                  >
                    {entry.grade || t.home.studentPortal}
                  </p>

                  <p
                    className={`mt-3 text-2xl font-bold tabular-nums ${
                      isFirst ? 'text-[#E5B742]' : 'text-[#6B1118]'
                    }`}
                  >
                    {entry.totalPoints}{' '}
                    <span className="text-xs font-semibold">{t.competition.ptsUnit}</span>
                  </p>

                  <p
                    className={`mt-1 text-xs tabular-nums ${
                      isFirst ? 'text-[#FBF4DF]/85' : 'text-[#57534E]'
                    }`}
                  >
                    {entry.quizzesCompleted} {t.competition.quizzesLabel} · {entry.accuracyPercent}%
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Full Student Rankings Table */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-7 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-[#1C1917]">
            {t.competition.allStudentsTitle}{' '}
            <span className="text-sm font-medium text-[#57534E] tabular-nums">
              ({filteredStudents.length})
            </span>
          </h3>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.competition.searchPlaceholder}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-9 pe-3.5 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#57534E]">
            {t.competition.noStudentsYet}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-[#E6DFD5] text-xs font-semibold text-[#57534E]">
                  <th className="py-3 px-3 text-start w-16">{t.competition.rankCol}</th>
                  <th className="py-3 px-3 text-start">{t.competition.studentCol}</th>
                  <th className="py-3 px-3 text-end hidden sm:table-cell">
                    {t.competition.quizzesCol}
                  </th>
                  <th className="py-3 px-3 text-end hidden sm:table-cell">
                    {t.competition.accuracyCol}
                  </th>
                  <th className="py-3 px-3 text-end">{t.competition.pointsCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFD5]">
                {filteredStudents.map((entry) => {
                  const isMe = entry.userId === user.id || entry.isCurrentUser;
                  const medal = getMedalEmoji(entry.rank);
                  return (
                    <tr
                      key={entry.userId}
                      className={isMe ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5] transition-colors'}
                    >
                      <td className="py-3.5 px-3 text-sm font-bold tabular-nums text-[#1C1917]">
                        {medal ? (
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden="true" className="text-base">
                              {medal}
                            </span>
                            <span>#{entry.rank}</span>
                          </span>
                        ) : (
                          `#${entry.rank}`
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <UserAvatar
                              name={entry.name}
                              avatarUrl={entry.avatar_url}
                              sizeClass="w-9 h-9"
                              textClass="text-xs"
                            />
                            {isEntryOnline(entry) && (
                              <span
                                title={t.askTeacher.onlineLabel}
                                aria-label={t.askTeacher.onlineLabel}
                                className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-[#059669] ring-2 ring-white dark:ring-[#1E1A1A]"
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#1C1917] truncate">
                              {entry.name}
                              {isMe && (
                                <span className="ms-1.5 text-xs font-bold text-[#6B1118]">
                                  · {t.competition.youBadge}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[#57534E] truncate">
                              {entry.grade || t.home.studentPortal}
                              <span className="sm:hidden tabular-nums">
                                {' '}
                                · {entry.quizzesCompleted} {t.competition.quizzesLabel} ·{' '}
                                {entry.accuracyPercent}%
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-sm text-end text-[#57534E] tabular-nums hidden sm:table-cell">
                        {entry.quizzesCompleted}
                      </td>
                      <td className="py-3.5 px-3 text-sm text-end text-[#57534E] tabular-nums hidden sm:table-cell">
                        {entry.accuracyPercent}%
                      </td>
                      <td className="py-3.5 px-3 text-sm font-bold text-end text-[#6B1118] tabular-nums whitespace-nowrap">
                        {entry.totalPoints} {t.competition.ptsUnit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Scoring Rules & Recent Point Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-[#D9A62E]" />
            <h3 className="text-lg font-bold text-[#1C1917]">
              {t.competition.pointsRulesTitle}
            </h3>
          </div>

          <ul className="space-y-2.5 text-sm text-[#1C1917]">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5">
              <span>{t.competition.ruleCorrectAnswer}</span>
              <span className="font-bold text-[#6B1118] tabular-nums shrink-0">
                +{rules.correctAnswer} {t.competition.ptsUnit}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5">
              <span>{t.competition.ruleQuizCompleted}</span>
              <span className="font-bold text-[#6B1118] tabular-nums shrink-0">
                +{rules.quizCompleted} {t.competition.ptsUnit}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5">
              <span>{t.competition.ruleHighScore}</span>
              <span className="font-bold text-[#6B1118] tabular-nums shrink-0">
                +{rules.highScore80Bonus} {t.competition.ptsUnit}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5">
              <span>{t.competition.rulePerfectScore}</span>
              <span className="font-bold text-[#6B1118] tabular-nums shrink-0">
                +{rules.perfectScoreBonus} {t.competition.ptsUnit}
              </span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5">
              <span>{t.competition.ruleCurriculumActivity}</span>
              <span className="font-bold text-[#6B1118] tabular-nums shrink-0">
                +{rules.curriculumActivity} {t.competition.ptsUnit}
              </span>
            </li>
          </ul>

          <p className="text-xs text-[#57534E] leading-relaxed pt-1">
            {t.competition.offlineNote}
          </p>
        </div>

        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#6B1118]" />
            <h3 className="text-lg font-bold text-[#1C1917]">
              {t.competition.recentHistoryTitle}
            </h3>
          </div>

          {pending.events.length === 0 && recentEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#57534E]">
              {t.competition.noHistoryYet}
            </div>
          ) : (
            <div className="divide-y divide-[#E6DFD5]">
              {pending.events
                .slice()
                .reverse()
                .map((ev) => (
                  <div
                    key={ev.eventKey}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1C1917] truncate">
                        {getEventTypeLabel(ev.eventType)} · {t.competition.syncReadyBadge}
                      </p>
                      <p className="text-xs text-[#57534E] truncate">{ev.details}</p>
                    </div>
                    <span className="text-sm font-bold text-[#D9A62E] tabular-nums shrink-0">
                      +{ev.points} {t.competition.ptsUnit}
                    </span>
                  </div>
                ))}

              {recentEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1917] truncate">
                      {getEventTypeLabel(ev.event_type)}
                    </p>
                    <p className="text-xs text-[#57534E] truncate">
                      {ev.details} ·{' '}
                      <span className="tabular-nums">
                        {formatUtcDate(ev.created_at)}
                      </span>
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[#059669] tabular-nums shrink-0">
                    +{ev.points} {t.competition.ptsUnit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
