import type {
  CompetitionLeaderboardResponse,
  LeaderboardEntry,
  User,
} from '../types';
import {
  fetchCloudRegisteredUsersAsAdmin,
  fetchFirestoreLeaderboard,
  MAIN_ADMIN_EMAIL,
  pullAllPeerPresence,
  sha256AccountKey,
} from './cloudAccounts';
import {
  compareLeaderboardEntries,
  computeCompetitionMedal,
  computeFairScoreMetrics,
} from './competitionScoring';
import { auth } from './firebase';
import { isStaticHostMode } from './staticFallback';

function stableNumericId(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 900000000) + 100000;
}

function isRealFirebaseUid(uid?: string): boolean {
  return Boolean(uid && !uid.startsWith('acct_') && !uid.includes('@'));
}

export async function mergeCloudStudentsIntoLeaderboard(
  base: CompetitionLeaderboardResponse,
  viewer: User
): Promise<CompetitionLeaderboardResponse> {
  if (isStaticHostMode()) {
    return base;
  }

  await auth.authStateReady().catch(() => {});
  const fbUser = auth.currentUser;
  const hasTrustedCloudAuth = Boolean(
    fbUser &&
      (fbUser.emailVerified ||
        fbUser.providerData?.some((provider) => provider.providerId === 'facebook.com'))
  );
  const isPrivileged =
    hasTrustedCloudAuth && (viewer.role === 'teacher' || Boolean(viewer.isAdmin));

  const [cloudRows, cloudPeers, cloudAdminUsers, viewerAcctKey] = await Promise.all([
    fetchFirestoreLeaderboard().catch(() => []),
    hasTrustedCloudAuth ? pullAllPeerPresence().catch(() => []) : Promise.resolve([]),
    isPrivileged ? fetchCloudRegisteredUsersAsAdmin().catch(() => []) : Promise.resolve([]),
    viewer.email ? sha256AccountKey(viewer.email).catch(() => '') : Promise.resolve(''),
  ]);

  if (
    cloudRows.length === 0 &&
    cloudPeers.length === 0 &&
    cloudAdminUsers.length === 0
  ) {
    return base;
  }

  const byKey = new Map<
    string,
    LeaderboardEntry & { uid?: string; hasQuestionsAnswered?: boolean }
  >();
  const uidToKey = new Map<string, string>();
  const idToKey = new Map<number, string>();
  const nameToKey = new Map<string, string>();

  const hasDistinctRealUid = (candidateKey: string, incomingUid?: string): boolean => {
    if (!isRealFirebaseUid(incomingUid)) return false;
    const candidate = byKey.get(candidateKey);
    return Boolean(
      candidate &&
        isRealFirebaseUid(candidate.uid) &&
        candidate.uid !== incomingUid
    );
  };

  const upsert = (
    item: Partial<LeaderboardEntry> & {
      name: string;
      hasQuestionsAnswered?: boolean;
      uid?: string;
    }
  ) => {
    const cleanName = (item.name || 'Grade 9 Student').trim() || 'Grade 9 Student';
    const normName = cleanName.toLowerCase();
    const numericId =
      item.userId ||
      (item.uid ? stableNumericId(item.uid) : stableNumericId(normName));

    let key = item.uid ? uidToKey.get(item.uid) : undefined;
    if (!key && item.userId) {
      const idCandidate = idToKey.get(item.userId);
      if (idCandidate && !hasDistinctRealUid(idCandidate, item.uid)) {
        key = idCandidate;
      }
    }
    if (!key && normName !== 'grade 9 student') {
      const nameCandidate = nameToKey.get(normName);
      if (nameCandidate && !hasDistinctRealUid(nameCandidate, item.uid)) {
        key = nameCandidate;
      }
    }

    if (!key) {
      key = item.uid ? `cloud:${item.uid}` : `local:${numericId}`;
    }

    const prev = byKey.get(key);
    const totalPoints = Math.max(prev?.totalPoints ?? 0, Number(item.totalPoints || 0));
    const quizPoints = Math.max(prev?.quizPoints ?? 0, Number(item.quizPoints || 0));
    const activityPoints = Math.max(
      prev?.activityPoints ?? 0,
      Number(item.activityPoints || 0)
    );
    const quizzesCompleted = Math.max(
      prev?.quizzesCompleted ?? 0,
      Number(item.quizzesCompleted || 0)
    );
    const correctAnswers = Math.max(
      prev?.correctAnswers ?? 0,
      Number(item.correctAnswers || 0)
    );
    const questionsAnswered = Math.max(
      prev?.questionsAnswered ?? 0,
      Number(item.questionsAnswered || 0)
    );
    const hasQuestionsAnswered = Boolean(
      prev?.hasQuestionsAnswered || item.hasQuestionsAnswered
    );
    const resolvedUid = isRealFirebaseUid(item.uid)
      ? item.uid
      : prev?.uid || item.uid;

    const next: LeaderboardEntry & { uid?: string; hasQuestionsAnswered?: boolean } = {
      uid: resolvedUid,
      rank: 0,
      userId: prev?.userId || numericId,
      name: cleanName.length >= (prev?.name.length || 0) ? cleanName : prev!.name,
      grade: item.grade || prev?.grade || '',
      avatar_url: item.avatar_url || prev?.avatar_url || '',
      online: Boolean(prev?.online || item.online),
      totalPoints,
      fairScore: 0,
      quizPoints: quizPoints || Math.max(0, totalPoints - activityPoints),
      activityPoints,
      quizzesCompleted,
      correctAnswers,
      questionsAnswered,
      accuracyPercent: 0,
      badge: null,
      isCurrentUser: Boolean(prev?.isCurrentUser || item.isCurrentUser),
      hasQuestionsAnswered,
    };

    byKey.set(key, next);
    if (next.uid) uidToKey.set(next.uid, key);
    if (item.uid) uidToKey.set(item.uid, key);
    idToKey.set(next.userId, key);
    if (normName !== 'grade 9 student' && !nameToKey.has(normName)) {
      nameToKey.set(normName, key);
    }
  };

  for (const row of base.leaderboard) {
    upsert({
      ...row,
      hasQuestionsAnswered: row.questionsAnswered > 0,
    });
  }

  for (const cr of cloudRows) {
    const isMe = Boolean(
      (fbUser && cr.uid === fbUser.uid) ||
        (viewerAcctKey && cr.uid === viewerAcctKey) ||
        (viewer.role === 'student' &&
          !viewer.isAdmin &&
          !isRealFirebaseUid(cr.uid) &&
          cr.name.trim().toLowerCase() === viewer.name.trim().toLowerCase())
    );
    upsert({
      uid: cr.uid,
      name: cr.name,
      grade: cr.grade,
      avatar_url: cr.avatarUrl,
      online: isMe,
      totalPoints: cr.totalPoints,
      quizPoints: cr.quizPoints,
      activityPoints: cr.activityPoints,
      quizzesCompleted: cr.quizzesCompleted,
      correctAnswers: cr.correctAnswers,
      questionsAnswered: cr.questionsAnswered,
      hasQuestionsAnswered: cr.hasQuestionsAnswered,
      isCurrentUser: isMe,
    });
  }

  for (const cu of cloudAdminUsers) {
    if (cu.role !== 'student' || cu.isAdmin) continue;
    if (cu.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) continue;
    upsert({
      uid: cu.uid || cu.accountKey || cu.email,
      name: cu.name,
      grade: cu.grade,
      avatar_url: cu.avatarUrl,
      totalPoints: cu.totalPoints,
      quizPoints: cu.quizPoints,
      activityPoints: cu.activityPoints,
      quizzesCompleted: cu.quizzesCompleted,
      correctAnswers: cu.correctAnswers,
      questionsAnswered: cu.questionsAnswered ?? cu.correctAnswers,
      hasQuestionsAnswered: typeof cu.questionsAnswered === 'number' && cu.questionsAnswered > 0,
      isCurrentUser: Boolean(fbUser && cu.uid && cu.uid === fbUser.uid),
    });
  }

  for (const cp of cloudPeers) {
    if (cp.role !== 'student' || cp.isAdmin) continue;
    const isMe = Boolean(fbUser && cp.uid === fbUser.uid);
    upsert({
      uid: cp.uid,
      userId: cp.numericId,
      name: cp.name,
      grade: cp.grade,
      avatar_url: cp.avatarUrl,
      online: cp.online || isMe,
      isCurrentUser: isMe,
    });
  }

  const merged: LeaderboardEntry[] = Array.from(byKey.values()).map((entry) => {
    const preMetrics = computeFairScoreMetrics({
      totalPoints: entry.totalPoints,
      quizPoints: entry.quizPoints,
      activityPoints: entry.activityPoints,
      quizzesCompleted: entry.quizzesCompleted,
      correctAnswers: entry.correctAnswers,
      questionsAnswered: entry.questionsAnswered,
      legacyMissingQuestionsAnswered: !entry.hasQuestionsAnswered,
    });
    const derivedActivity = entry.quizzesCompleted * 10 + preMetrics.questionsAnswered * 2;
    const derivedQuizPts = preMetrics.correctAnswers * 10 + entry.quizzesCompleted * 25;
    const activityPoints = Math.max(entry.activityPoints, derivedActivity);
    const quizPoints = Math.max(entry.quizPoints, derivedQuizPts);
    const totalPoints = Math.max(entry.totalPoints, quizPoints + activityPoints);
    const metrics = computeFairScoreMetrics({
      totalPoints,
      quizPoints,
      activityPoints,
      quizzesCompleted: entry.quizzesCompleted,
      correctAnswers: preMetrics.correctAnswers,
      questionsAnswered: preMetrics.questionsAnswered,
      legacyMissingQuestionsAnswered: !entry.hasQuestionsAnswered,
    });
    return {
      rank: 0,
      userId: entry.userId,
      name: entry.name,
      grade: entry.grade,
      avatar_url: entry.avatar_url,
      online: entry.online,
      totalPoints,
      fairScore: metrics.fairScore,
      quizPoints,
      activityPoints,
      quizzesCompleted: entry.quizzesCompleted,
      correctAnswers: metrics.correctAnswers,
      questionsAnswered: metrics.questionsAnswered,
      accuracyPercent: metrics.accuracyPercent,
      badge: null,
      isCurrentUser: entry.isCurrentUser,
    };
  });

  merged.sort(compareLeaderboardEntries);
  merged.forEach((entry, idx) => {
    entry.rank = idx + 1;
    entry.badge = computeCompetitionMedal(entry.rank);
  });

  const meEntry = merged.find((e) => e.userId === viewer.id || e.isCurrentUser) || null;

  return {
    ...base,
    leaderboard: merged,
    topThree: merged.slice(0, 3),
    myStats: {
      ...base.myStats,
      rank: meEntry?.rank ?? base.myStats.rank,
      totalPoints: meEntry ? meEntry.totalPoints : base.myStats.totalPoints,
      fairScore: meEntry?.fairScore ?? base.myStats.fairScore ?? 0,
      quizPoints: meEntry ? meEntry.quizPoints : base.myStats.quizPoints,
      activityPoints: meEntry ? meEntry.activityPoints : base.myStats.activityPoints,
      quizzesCompleted: meEntry ? meEntry.quizzesCompleted : base.myStats.quizzesCompleted,
      correctAnswers: meEntry ? meEntry.correctAnswers : base.myStats.correctAnswers,
      questionsAnswered: meEntry?.questionsAnswered ?? base.myStats.questionsAnswered ?? 0,
      accuracyPercent: meEntry ? meEntry.accuracyPercent : base.myStats.accuracyPercent,
      badge: meEntry?.badge ?? base.myStats.badge,
      totalStudents: merged.length,
    },
  };
}
