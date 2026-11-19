import curriculumData from '../data/curriculumSnapshot.json';
import {
  Announcement,
  Chapter,
  CompetitionLeaderboardResponse,
  CompetitionMedal,
  CompetitionPointEvent,
  CurriculumStudyQA,
  LeaderboardEntry,
  Question,
  QuizAnswerCheckResult,
  QuizAttempt,
  QuizQuestionResult,
  QuizSubmissionResponse,
  TextbookResource,
  TextbooksQAResponse,
  TextbookStudyQA,
  User,
} from '../types';
import { auth } from './firebase';
import {
  CloudUserProfile,
  fetchFirestoreLeaderboard,
  MAIN_ADMIN_EMAIL,
  pullCloudUserProfile,
  recordQuizAttemptToCloud,
  syncCurrentUserToFirestore,
} from './cloudAccounts';
import { decryptAdminVaultWithPassword } from './recoveryVault';

const SESSION_TOKEN_KEY = 'grade9hub_session_token';
const CACHED_USER_KEY = 'grade9hub_cached_user';
const REMEMBER_ME_KEY = 'grade9hub_remember_me';
const STATIC_MODE_KEY = 'grade9hub_static_backend_mode';
const STATIC_PROFILES_KEY = 'grade9hub_static_profiles_v1';
const STATIC_STATS_KEY = 'grade9hub_static_stats_v1';

type SupportedLang = 'en' | 'ku' | 'ar';

interface SnapshotChapter {
  chapter_number: number;
  title: string;
  description: string;
  title_ku?: string | null;
  description_ku?: string | null;
  title_ar?: string | null;
  description_ar?: string | null;
  updated_at: string;
}

interface SnapshotQuestion {
  id: number;
  scope: 'chapter' | 'general';
  chapter_number: number | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  question_text_ku?: string | null;
  option_a_ku?: string | null;
  option_b_ku?: string | null;
  option_c_ku?: string | null;
  option_d_ku?: string | null;
  explanation_ku?: string | null;
  question_text_ar?: string | null;
  option_a_ar?: string | null;
  option_b_ar?: string | null;
  option_c_ar?: string | null;
  option_d_ar?: string | null;
  explanation_ar?: string | null;
  created_at: string;
}

interface SnapshotResource {
  id: number;
  chapter_number: number | null;
  title: string;
  summary: string;
  key_formulas: string;
  resource_type: 'textbook' | 'guide' | 'summary' | 'slides';
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  external_url: string | null;
  title_ku?: string | null;
  summary_ku?: string | null;
  title_ar?: string | null;
  summary_ar?: string | null;
  created_at: string;
}

interface SnapshotStudyQa {
  id: number;
  chapter_number: number;
  question_text: string;
  answer_text: string;
  explanation_text: string;
  source_label: string;
  question_text_ku?: string | null;
  answer_text_ku?: string | null;
  explanation_text_ku?: string | null;
  question_text_ar?: string | null;
  answer_text_ar?: string | null;
  explanation_text_ar?: string | null;
  created_at: string;
}

interface CurriculumSnapshot {
  chapters: SnapshotChapter[];
  questions: SnapshotQuestion[];
  resources: SnapshotResource[];
  studyQa: SnapshotStudyQa[];
}

interface StoredStaticStats {
  totalPoints: number;
  quizPoints: number;
  activityPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  questionsAnswered: number;
  answeredQuestionIds: number[];
  attempts: Array<{
    id: number;
    mode: 'all_chapters' | 'chapter' | 'general';
    chapter_number: number | null;
    total_questions: number;
    correct_count: number;
    score_percent: number;
    created_at: string;
  }>;
  events: CompetitionPointEvent[];
}

const snapshot = curriculumData as CurriculumSnapshot;

const COMPETITION_RULES = {
  correctAnswer: 10,
  quizCompleted: 25,
  highScore80Bonus: 15,
  perfectScoreBonus: 30,
  curriculumActivity: 5,
};

let staticModeDetected = false;

export function isStaticHostMode(): boolean {
  if (staticModeDetected) return true;
  try {
    return (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(STATIC_MODE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function markStaticHostMode(): void {
  staticModeDetected = true;
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(STATIC_MODE_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

export class StaticFallbackHttpError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'StaticFallbackHttpError';
    this.status = status;
    this.data = data;
  }
}

function stableNumericId(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 900000000) + 100000;
}

function formatDisplayNameFromEmail(email: string): string {
  const localPart = (email.split('@')[0] || '').trim();
  const cleaned = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, 48);
  return cleaned.length >= 2 ? cleaned : 'Grade 9 Student';
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function readRememberMeStatic(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false';
  } catch {
    return true;
  }
}

function saveSessionAndCachedUser(
  user: User,
  token: string,
  rememberMe: boolean = readRememberMeStatic()
): void {
  try {
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(user);
      if (rememberMe) {
        window.localStorage.setItem(SESSION_TOKEN_KEY, token);
        window.localStorage.setItem(CACHED_USER_KEY, serialized);
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
        window.sessionStorage.removeItem(CACHED_USER_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        window.sessionStorage.setItem(CACHED_USER_KEY, serialized);
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
        window.localStorage.removeItem(CACHED_USER_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
  const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
  profiles[user.email.trim().toLowerCase()] = user;
  writeLocalJson(STATIC_PROFILES_KEY, profiles);
}

function getCachedUserLocal(): User | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw =
      window.localStorage.getItem(CACHED_USER_KEY) ||
      window.sessionStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function getSessionTokenLocal(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem(SESSION_TOKEN_KEY) ||
      window.sessionStorage.getItem(SESSION_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

function getUserStats(userId: number): StoredStaticStats {
  const all = readLocalJson<Record<string, StoredStaticStats>>(STATIC_STATS_KEY, {});
  return (
    all[String(userId)] || {
      totalPoints: 0,
      quizPoints: 0,
      activityPoints: 0,
      quizzesCompleted: 0,
      correctAnswers: 0,
      questionsAnswered: 0,
      answeredQuestionIds: [],
      attempts: [],
      events: [],
    }
  );
}

function saveUserStats(userId: number, stats: StoredStaticStats): void {
  const all = readLocalJson<Record<string, StoredStaticStats>>(STATIC_STATS_KEY, {});
  all[String(userId)] = {
    ...stats,
    attempts: stats.attempts.slice(0, 60),
    events: stats.events.slice(0, 80),
  };
  writeLocalJson(STATIC_STATS_KEY, all);
}

function normalizeLang(raw: string | null | undefined): SupportedLang {
  if (raw === 'ku' || raw === 'ar') return raw;
  return 'en';
}

function localizeChapter(row: SnapshotChapter, lang: SupportedLang, questionCount: number): Chapter {
  let title = row.title;
  let description = row.description;
  if (lang === 'ku') {
    title = (row.title_ku || '').trim() || (/^Chapter \d+$/i.test(row.title) ? `بەشی ${row.chapter_number}` : row.title);
    description = (row.description_ku || '').trim() || row.description;
  } else if (lang === 'ar') {
    title = (row.title_ar || '').trim() || (/^Chapter \d+$/i.test(row.title) ? `الفصل ${row.chapter_number}` : row.title);
    description = (row.description_ar || '').trim() || row.description;
  }
  return {
    chapter_number: row.chapter_number,
    title,
    description,
    raw_title: row.title,
    raw_description: row.description,
    updated_at: row.updated_at,
    question_count: questionCount,
  };
}

function getChapterTitleMap(lang: SupportedLang): Map<number, string> {
  const map = new Map<number, string>();
  for (const ch of snapshot.chapters) {
    map.set(ch.chapter_number, localizeChapter(ch, lang, 0).title);
  }
  return map;
}

function localizeQuestionFields(
  q: SnapshotQuestion,
  lang: SupportedLang,
  chapterMap: Map<number, string>
) {
  const chapterTitle = q.chapter_number ? chapterMap.get(q.chapter_number) || `Chapter ${q.chapter_number}` : null;
  if (lang === 'ku') {
    return {
      chapterTitle,
      questionText: (q.question_text_ku || '').trim() || q.question_text,
      optionA: (q.option_a_ku || '').trim() || q.option_a,
      optionB: (q.option_b_ku || '').trim() || q.option_b,
      optionC: (q.option_c_ku || '').trim() || q.option_c,
      optionD: (q.option_d_ku || '').trim() || q.option_d,
      explanation: (q.explanation_ku || '').trim() || q.explanation,
    };
  }
  if (lang === 'ar') {
    return {
      chapterTitle,
      questionText: (q.question_text_ar || '').trim() || q.question_text,
      optionA: (q.option_a_ar || '').trim() || q.option_a,
      optionB: (q.option_b_ar || '').trim() || q.option_b,
      optionC: (q.option_c_ar || '').trim() || q.option_c,
      optionD: (q.option_d_ar || '').trim() || q.option_d,
      explanation: (q.explanation_ar || '').trim() || q.explanation,
    };
  }
  return {
    chapterTitle,
    questionText: q.question_text,
    optionA: q.option_a,
    optionB: q.option_b,
    optionC: q.option_c,
    optionD: q.option_d,
    explanation: q.explanation,
  };
}

function getOptionText(
  loc: ReturnType<typeof localizeQuestionFields>,
  opt: 'A' | 'B' | 'C' | 'D'
): string {
  if (opt === 'A') return loc.optionA;
  if (opt === 'B') return loc.optionB;
  if (opt === 'C') return loc.optionC;
  return loc.optionD;
}

function isPrivilegedCachedUser(): boolean {
  const cached = getCachedUserLocal();
  return Boolean(cached && (cached.role === 'teacher' || cached.isAdmin));
}

function buildFirebaseAppUser(
  uid: string,
  fbEmail: string,
  fbName: string,
  fbPhoto: string,
  emailVerified: boolean,
  cloudProfile: Partial<CloudUserProfile> | null
): User {
  const email =
    (fbEmail || cloudProfile?.email || '').trim().toLowerCase() ||
    `google_${uid}@grade9hub.local`;
  const isMainAdmin = emailVerified && email === MAIN_ADMIN_EMAIL;
  const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
  const prevProfile = profiles[email];
  const nowIso = new Date().toISOString();

  const name =
    (cloudProfile?.name || prevProfile?.name || fbName || (isMainAdmin ? 'Mr. Kasrawan' : formatDisplayNameFromEmail(email)))
      .trim()
      .slice(0, 120) || 'Grade 9 Student';

  const avatarCandidate =
    cloudProfile?.avatarUrl || prevProfile?.avatar_url || fbPhoto || '';

  return {
    id: prevProfile?.id || stableNumericId(uid),
    name,
    email,
    role: isMainAdmin ? 'teacher' : 'student',
    isAdmin: isMainAdmin,
    grade: cloudProfile?.grade || prevProfile?.grade || 'Grade 9',
    bio:
      cloudProfile?.bio ||
      prevProfile?.bio ||
      (isMainAdmin
        ? 'Science Teacher | Web Developer passionate about Grade 9 science education and building interactive educational tools.'
        : ''),
    birthday: cloudProfile?.birthday || prevProfile?.birthday || '',
    avatar_url: avatarCandidate,
    notif_prompt_status:
      cloudProfile?.notifPromptStatus ?? prevProfile?.notif_prompt_status ?? '',
    notifications_enabled:
      cloudProfile?.notificationsEnabled !== undefined
        ? cloudProfile.notificationsEnabled
        : prevProfile?.notifications_enabled !== false,
    isRestricted: false,
    restrictionReason: '',
    lastLoginAt: nowIso,
    created_at: prevProfile?.created_at || nowIso,
  };
}

function computeMedal(rank: number): CompetitionMedal {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

async function buildLeaderboardResponse(): Promise<CompetitionLeaderboardResponse> {
  const currentUser = getCachedUserLocal();
  const myStats = currentUser ? getUserStats(currentUser.id) : getUserStats(0);
  const cloudRows = await fetchFirestoreLeaderboard().catch(() => []);

  const entries: LeaderboardEntry[] = [];
  const seenNames = new Set<string>();
  const currentFbUid = auth.currentUser?.uid || '';

  for (const row of cloudRows) {
    const isMe = Boolean(
      (currentFbUid && row.uid === currentFbUid) ||
        (currentUser && row.name.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
    );
    const totalPoints = isMe ? Math.max(row.totalPoints, myStats.totalPoints) : row.totalPoints;
    const quizzesCompleted = isMe
      ? Math.max(row.quizzesCompleted, myStats.quizzesCompleted)
      : row.quizzesCompleted;
    const correctAnswers = isMe
      ? Math.max(row.correctAnswers, myStats.correctAnswers)
      : row.correctAnswers;
    const questionsAnswered = isMe
      ? Math.max(correctAnswers, myStats.questionsAnswered)
      : correctAnswers;
    const accuracyPercent =
      questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;

    seenNames.add(row.uid);
    entries.push({
      rank: 0,
      userId: stableNumericId(row.uid),
      name: row.name,
      grade: row.grade || 'Grade 9',
      avatar_url: row.avatarUrl,
      online: isMe,
      totalPoints,
      quizPoints: totalPoints,
      activityPoints: 0,
      quizzesCompleted,
      correctAnswers,
      questionsAnswered,
      accuracyPercent,
      badge: null,
      isCurrentUser: isMe,
    });
  }

  if (currentUser && currentUser.role === 'student' && !currentUser.isAdmin) {
    const alreadyPresent = entries.some((e) => e.isCurrentUser);
    if (!alreadyPresent) {
      const accuracyPercent =
        myStats.questionsAnswered > 0
          ? Math.round((myStats.correctAnswers / myStats.questionsAnswered) * 100)
          : 0;
      entries.push({
        rank: 0,
        userId: currentUser.id,
        name: currentUser.name,
        grade: currentUser.grade || 'Grade 9',
        avatar_url: currentUser.avatar_url || '',
        online: true,
        totalPoints: myStats.totalPoints,
        quizPoints: myStats.quizPoints,
        activityPoints: myStats.activityPoints,
        quizzesCompleted: myStats.quizzesCompleted,
        correctAnswers: myStats.correctAnswers,
        questionsAnswered: myStats.questionsAnswered,
        accuracyPercent,
        badge: null,
        isCurrentUser: true,
      });
    }
  }

  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
    return a.name.localeCompare(b.name);
  });

  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
    entry.badge = computeMedal(entry.rank);
  });

  const meEntry = entries.find((e) => e.isCurrentUser);
  const myAccuracy =
    myStats.questionsAnswered > 0
      ? Math.round((myStats.correctAnswers / myStats.questionsAnswered) * 100)
      : 0;

  return {
    leaderboard: entries,
    topThree: entries.slice(0, 3),
    myStats: {
      rank: meEntry ? meEntry.rank : null,
      totalPoints: meEntry ? meEntry.totalPoints : myStats.totalPoints,
      quizPoints: myStats.quizPoints,
      activityPoints: myStats.activityPoints,
      quizzesCompleted: meEntry ? meEntry.quizzesCompleted : myStats.quizzesCompleted,
      correctAnswers: meEntry ? meEntry.correctAnswers : myStats.correctAnswers,
      accuracyPercent: myAccuracy,
      badge: meEntry ? meEntry.badge : null,
      totalStudents: Math.max(entries.length, 1),
    },
    recentEvents: myStats.events.slice(0, 25),
    rules: COMPETITION_RULES,
    generatedAt: new Date().toISOString(),
  };
}

function parseBody(options: RequestInit): Record<string, unknown> {
  if (!options.body || typeof options.body !== 'string') return {};
  try {
    return (JSON.parse(options.body) as Record<string, unknown>) || {};
  } catch {
    return {};
  }
}

export async function handleStaticApiFallback(
  rawUrl: string,
  options: RequestInit = {}
): Promise<unknown> {
  markStaticHostMode();
  const method = String(options.method || 'GET').toUpperCase();
  const parsed = new URL(rawUrl, 'http://localhost');
  const pathname = parsed.pathname;
  const search = parsed.searchParams;
  const body = parseBody(options);

  // 1. Auth Recovery Status
  if (pathname === '/api/auth/recovery-status') {
    return { dbEmpty: false };
  }

  // 2. Session Check (/api/auth/me)
  if (pathname === '/api/auth/me') {
    const cached = getCachedUserLocal();
    const token = getSessionTokenLocal();
    if (cached && token) {
      return { user: cached, sessionToken: token, dbEmpty: false };
    }
    await auth.authStateReady().catch(() => {});
    const fbUser = auth.currentUser;
    if (fbUser && fbUser.emailVerified) {
      const { profile } = await pullCloudUserProfile(fbUser.uid).catch(() => ({
        profile: null,
        attempts: [],
      }));
      const appUser = buildFirebaseAppUser(
        fbUser.uid,
        fbUser.email || '',
        fbUser.displayName || '',
        fbUser.photoURL || '',
        fbUser.emailVerified,
        profile
      );
      const nextToken = `fb_${fbUser.uid}`;
      saveSessionAndCachedUser(appUser, nextToken);
      return { user: appUser, sessionToken: nextToken, dbEmpty: false };
    }
    return { user: null, dbEmpty: false };
  }

  // 3. Firebase Google Sign-In (/api/auth/firebase-login)
  if (pathname === '/api/auth/firebase-login' && method === 'POST') {
    await auth.authStateReady().catch(() => {});
    const fbUser = auth.currentUser;
    if (!fbUser) {
      throw new StaticFallbackHttpError(
        'Google sign-in session could not be verified. Please try again.',
        401
      );
    }
    const rememberMe = body.rememberMe !== false;
    const cloudProfile = (body.cloudProfile as Partial<CloudUserProfile> | null) || null;
    const appUser = buildFirebaseAppUser(
      fbUser.uid,
      fbUser.email || '',
      fbUser.displayName || '',
      fbUser.photoURL || '',
      fbUser.emailVerified,
      cloudProfile
    );
    const nextToken = `fb_${fbUser.uid}`;
    saveSessionAndCachedUser(appUser, nextToken, rememberMe);

    const stats = getUserStats(appUser.id);
    if (cloudProfile?.totalPoints && cloudProfile.totalPoints > stats.totalPoints) {
      stats.totalPoints = cloudProfile.totalPoints;
      stats.quizPoints = cloudProfile.totalPoints;
      stats.quizzesCompleted = Math.max(
        stats.quizzesCompleted,
        Number(cloudProfile.quizzesCompleted || 0)
      );
      stats.correctAnswers = Math.max(
        stats.correctAnswers,
        Number(cloudProfile.correctAnswers || 0)
      );
      saveUserStats(appUser.id, stats);
    }

    return {
      user: appUser,
      sessionToken: nextToken,
      stats: {
        totalPoints: stats.totalPoints,
        quizzesCompleted: stats.quizzesCompleted,
        correctAnswers: stats.correctAnswers,
      },
    };
  }

  // 4. Email & Password Login (/api/auth/login)
  if (pathname === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const rememberMe = body.rememberMe !== false;
    if (!email || !password) {
      throw new StaticFallbackHttpError('Email and password are required.', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new StaticFallbackHttpError('Please enter a valid email address.', 400);
    }

    if (email === MAIN_ADMIN_EMAIL) {
      const decrypted = await decryptAdminVaultWithPassword(email, password).catch(() => null);
      if (!decrypted) {
        throw new StaticFallbackHttpError(
          'Please click "Continue with Google" below to sign in to the administrator account.',
          401
        );
      }
      const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
      const prevAdmin = profiles[email];
      const nowIso = new Date().toISOString();
      const adminUser: User = {
        id: prevAdmin?.id || stableNumericId(email),
        name: prevAdmin?.name || 'Mr. Kasrawan',
        email,
        role: 'teacher',
        isAdmin: true,
        grade: prevAdmin?.grade || 'Grade 9',
        bio:
          prevAdmin?.bio ||
          'Science Teacher | Web Developer passionate about Grade 9 science education and building interactive educational tools.',
        birthday: prevAdmin?.birthday || '',
        avatar_url: prevAdmin?.avatar_url || '',
        notif_prompt_status: prevAdmin?.notif_prompt_status || '',
        notifications_enabled: prevAdmin?.notifications_enabled !== false,
        isRestricted: false,
        restrictionReason: '',
        lastLoginAt: nowIso,
        created_at: prevAdmin?.created_at || nowIso,
      };
      const token = `local_admin_${stableNumericId(email)}`;
      saveSessionAndCachedUser(adminUser, token, rememberMe);
      return { user: adminUser, sessionToken: token };
    }

    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    const prev = profiles[email];
    const nowIso = new Date().toISOString();
    const studentUser: User = {
      id: prev?.id || stableNumericId(email),
      name: prev?.name || formatDisplayNameFromEmail(email),
      email,
      role: 'student',
      isAdmin: false,
      grade: prev?.grade || 'Grade 9',
      bio: prev?.bio || '',
      birthday: prev?.birthday || '',
      avatar_url: prev?.avatar_url || '',
      notif_prompt_status: prev?.notif_prompt_status || '',
      notifications_enabled: prev?.notifications_enabled !== false,
      isRestricted: false,
      restrictionReason: '',
      lastLoginAt: nowIso,
      created_at: prev?.created_at || nowIso,
    };
    const token = `local_${stableNumericId(email)}`;
    saveSessionAndCachedUser(studentUser, token, rememberMe);
    return { user: studentUser, sessionToken: token };
  }

  // 5. Logout
  if (pathname === '/api/auth/logout' && method === 'POST') {
    return { ok: true };
  }

  // 6. Forgot password on static host
  if (pathname.startsWith('/api/auth/forgot-password/')) {
    throw new StaticFallbackHttpError(
      'Email password reset requires the backend server. Students can sign in directly or use Google Sign-In.',
      400
    );
  }

  // 7. Chapters (/api/chapters)
  if (pathname === '/api/chapters') {
    const lang = normalizeLang(search.get('lang'));
    const countsByCh = new Map<number, number>();
    let generalCount = 0;
    for (const q of snapshot.questions) {
      if (q.scope === 'general') {
        generalCount += 1;
      } else if (typeof q.chapter_number === 'number') {
        countsByCh.set(q.chapter_number, (countsByCh.get(q.chapter_number) || 0) + 1);
      }
    }
    const chapters = snapshot.chapters.map((c) =>
      localizeChapter(c, lang, countsByCh.get(c.chapter_number) || 0)
    );
    return { chapters, generalCount };
  }

  // 8. Questions (/api/questions)
  if (pathname === '/api/questions' && method === 'GET') {
    const lang = normalizeLang(search.get('lang'));
    const mode = search.get('mode') || 'all_chapters';
    const chapterNum = Number(search.get('chapterNumber') || 0);
    const chapterMap = getChapterTitleMap(lang);
    const privileged = isPrivilegedCachedUser();

    const filtered = snapshot.questions.filter((q) => {
      if (mode === 'general') return q.scope === 'general';
      if (mode === 'chapter' && chapterNum >= 1) {
        return q.scope === 'chapter' && q.chapter_number === chapterNum;
      }
      return q.scope === 'chapter';
    });

    const questions: Question[] = filtered.map((q) => {
      const loc = localizeQuestionFields(q, lang, chapterMap);
      const base: Question = {
        id: q.id,
        scope: q.scope,
        chapter_number: q.chapter_number,
        chapter_title: loc.chapterTitle,
        question_text: loc.questionText,
        option_a: loc.optionA,
        option_b: loc.optionB,
        option_c: loc.optionC,
        option_d: loc.optionD,
        created_at: q.created_at,
      };
      if (privileged) {
        base.correct_option = q.correct_option;
        base.explanation = loc.explanation;
        base.raw_question_text = q.question_text;
        base.raw_option_a = q.option_a;
        base.raw_option_b = q.option_b;
        base.raw_option_c = q.option_c;
        base.raw_option_d = q.option_d;
        base.raw_explanation = q.explanation;
      }
      return base;
    });

    return { questions };
  }

  // 9. Check single answer (/api/quizzes/check-answer)
  if (pathname === '/api/quizzes/check-answer' && method === 'POST') {
    const questionId = Number(body.questionId);
    const selectedOption = String(body.selectedOption || '').toUpperCase() as 'A' | 'B' | 'C' | 'D';
    const lang = normalizeLang(String(body.lang || 'en'));
    const q = snapshot.questions.find((item) => item.id === questionId);
    if (!q) {
      throw new StaticFallbackHttpError('Question not found.', 404);
    }
    const chapterMap = getChapterTitleMap(lang);
    const loc = localizeQuestionFields(q, lang, chapterMap);
    const isCorrect = selectedOption === q.correct_option;

    const currentUser = getCachedUserLocal();
    let pointsAwarded = 0;
    let totalPoints = 0;

    if (currentUser && currentUser.role === 'student' && !currentUser.isAdmin) {
      const stats = getUserStats(currentUser.id);
      if (!stats.answeredQuestionIds.includes(questionId)) {
        stats.answeredQuestionIds.push(questionId);
        stats.questionsAnswered += 1;
        if (isCorrect) {
          stats.correctAnswers += 1;
          pointsAwarded = COMPETITION_RULES.correctAnswer;
          stats.quizPoints += pointsAwarded;
          stats.totalPoints += pointsAwarded;
          stats.events.unshift({
            id: Date.now(),
            event_key: `q-${questionId}-${Date.now()}`,
            event_type: 'correct_answer',
            points: pointsAwarded,
            chapter_number: q.chapter_number,
            details: 'Correct quiz answer',
            created_at: new Date().toISOString(),
          });
        }
        saveUserStats(currentUser.id, stats);
        void syncCurrentUserToFirestore(currentUser, {
          totalPoints: stats.totalPoints,
          quizzesCompleted: stats.quizzesCompleted,
          correctAnswers: stats.correctAnswers,
        }).catch(() => {});
      }
      totalPoints = stats.totalPoints;
    }

    const res: QuizAnswerCheckResult = {
      questionId,
      selectedOption,
      selectedOptionText: getOptionText(loc, selectedOption),
      correctOption: q.correct_option,
      correctOptionText: getOptionText(loc, q.correct_option),
      isCorrect,
      explanation: loc.explanation,
      pointsAwarded,
      totalPoints,
    };
    return res;
  }

  // 10. Submit full quiz (/api/quizzes/submit)
  if (pathname === '/api/quizzes/submit' && method === 'POST') {
    const mode =
      body.mode === 'all_chapters' || body.mode === 'general' ? body.mode : 'chapter';
    const chapterNumber =
      typeof body.chapterNumber === 'number' ? body.chapterNumber : null;
    const answers = (body.answers || {}) as Record<string, string>;
    const lang = normalizeLang(String(body.lang || 'en'));
    const skipSave = Boolean(body.skipSave);
    const chapterMap = getChapterTitleMap(lang);

    const targetQuestions = snapshot.questions.filter((q) => {
      if (mode === 'general') return q.scope === 'general';
      if (mode === 'chapter' && chapterNumber) {
        return q.scope === 'chapter' && q.chapter_number === chapterNumber;
      }
      return q.scope === 'chapter';
    });

    let correctCount = 0;
    const results: QuizQuestionResult[] = targetQuestions.map((q) => {
      const loc = localizeQuestionFields(q, lang, chapterMap);
      const selected = String(answers[String(q.id)] || '').toUpperCase() || null;
      const isCorrect = selected === q.correct_option;
      if (isCorrect) correctCount += 1;
      return {
        questionId: q.id,
        chapterNumber: q.chapter_number,
        chapterTitle: loc.chapterTitle,
        questionText: loc.questionText,
        optionA: loc.optionA,
        optionB: loc.optionB,
        optionC: loc.optionC,
        optionD: loc.optionD,
        selectedOption: selected,
        correctOption: q.correct_option,
        isCorrect,
        explanation: loc.explanation,
      };
    });

    const totalQuestions = targetQuestions.length;
    const scorePercent =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const currentUser = getCachedUserLocal();
    let pointsAwarded = 0;
    let totalPoints = 0;

    if (!skipSave && currentUser) {
      const stats = getUserStats(currentUser.id);
      if (currentUser.role === 'student' && !currentUser.isAdmin) {
        pointsAwarded = COMPETITION_RULES.quizCompleted;
        if (scorePercent === 100) {
          pointsAwarded += COMPETITION_RULES.perfectScoreBonus;
        } else if (scorePercent >= 80) {
          pointsAwarded += COMPETITION_RULES.highScore80Bonus;
        }
        stats.quizzesCompleted += 1;
        stats.quizPoints += pointsAwarded;
        stats.totalPoints += pointsAwarded;
        stats.events.unshift({
          id: Date.now(),
          event_key: `quiz-${mode}-${chapterNumber ?? 'all'}-${Date.now()}`,
          event_type: 'quiz_completed',
          points: pointsAwarded,
          chapter_number: chapterNumber,
          details: `Completed ${mode} quiz (${scorePercent}%)`,
          created_at: new Date().toISOString(),
        });
      }
      stats.attempts.unshift({
        id: Date.now(),
        mode,
        chapter_number: chapterNumber,
        total_questions: totalQuestions,
        correct_count: correctCount,
        score_percent: scorePercent,
        created_at: new Date().toISOString(),
      });
      saveUserStats(currentUser.id, stats);
      totalPoints = stats.totalPoints;

      void recordQuizAttemptToCloud(
        {
          mode,
          chapterNumber,
          totalQuestions,
          correctCount,
          scorePercent,
          pointsAwarded,
        },
        {
          totalPoints: stats.totalPoints,
          quizzesCompleted: stats.quizzesCompleted,
          correctAnswers: stats.correctAnswers,
        },
        currentUser
      ).catch(() => {});
    }

    const res: QuizSubmissionResponse = {
      totalQuestions,
      correctCount,
      scorePercent,
      results,
      pointsAwarded,
      totalPoints,
    };
    return res;
  }

  // 11. Quiz History (/api/quizzes/history)
  if (pathname === '/api/quizzes/history') {
    const lang = normalizeLang(search.get('lang'));
    const chapterMap = getChapterTitleMap(lang);
    const currentUser = getCachedUserLocal();
    const stats = currentUser ? getUserStats(currentUser.id) : null;
    const attempts: QuizAttempt[] = (stats?.attempts || []).map((a) => ({
      ...a,
      chapter_title: a.chapter_number ? chapterMap.get(a.chapter_number) || null : null,
    }));
    return { attempts };
  }

  // 12. Textbooks & Study Q/A (/api/textbooks-qa)
  if (pathname === '/api/textbooks-qa') {
    const lang = normalizeLang(search.get('lang'));
    const countsByCh = new Map<number, number>();
    for (const q of snapshot.questions) {
      if (q.scope === 'chapter' && typeof q.chapter_number === 'number') {
        countsByCh.set(q.chapter_number, (countsByCh.get(q.chapter_number) || 0) + 1);
      }
    }
    const chapters = snapshot.chapters.map((c) =>
      localizeChapter(c, lang, countsByCh.get(c.chapter_number) || 0)
    );
    const chapterMap = getChapterTitleMap(lang);

    const resources: TextbookResource[] = snapshot.resources.map((r) => ({
      id: r.id,
      chapter_number: r.chapter_number,
      title:
        lang === 'ku'
          ? (r.title_ku || '').trim() || r.title
          : lang === 'ar'
          ? (r.title_ar || '').trim() || r.title
          : r.title,
      summary:
        lang === 'ku'
          ? (r.summary_ku || '').trim() || r.summary
          : lang === 'ar'
          ? (r.summary_ar || '').trim() || r.summary
          : r.summary,
      key_formulas: r.key_formulas,
      resource_type: r.resource_type,
      attachment_name: r.attachment_name,
      attachment_url: r.attachment_url,
      attachment_mime: r.attachment_mime,
      external_url: r.external_url,
      created_at: r.created_at,
      raw_title: r.title,
      raw_summary: r.summary,
    }));

    const studyQa: TextbookStudyQA[] = snapshot.studyQa.map((s) => ({
      id: s.id,
      chapter_number: s.chapter_number,
      question_text:
        lang === 'ku'
          ? (s.question_text_ku || '').trim() || s.question_text
          : lang === 'ar'
          ? (s.question_text_ar || '').trim() || s.question_text
          : s.question_text,
      answer_text:
        lang === 'ku'
          ? (s.answer_text_ku || '').trim() || s.answer_text
          : lang === 'ar'
          ? (s.answer_text_ar || '').trim() || s.answer_text
          : s.answer_text,
      explanation_text:
        lang === 'ku'
          ? (s.explanation_text_ku || '').trim() || s.explanation_text
          : lang === 'ar'
          ? (s.explanation_text_ar || '').trim() || s.explanation_text
          : s.explanation_text,
      source_label: s.source_label,
      created_at: s.created_at,
      raw_question_text: s.question_text,
      raw_answer_text: s.answer_text,
      raw_explanation_text: s.explanation_text,
    }));

    const curriculumQa: CurriculumStudyQA[] = snapshot.questions.map((q) => {
      const loc = localizeQuestionFields(q, lang, chapterMap);
      return {
        id: q.id,
        scope: q.scope,
        chapter_number: q.chapter_number,
        chapter_title: loc.chapterTitle,
        question_text: loc.questionText,
        option_a: loc.optionA,
        option_b: loc.optionB,
        option_c: loc.optionC,
        option_d: loc.optionD,
        correct_option: q.correct_option,
        correct_option_text: getOptionText(loc, q.correct_option),
        explanation: loc.explanation,
        created_at: q.created_at,
      };
    });

    const resp: TextbooksQAResponse = {
      chapters,
      resources,
      studyQa,
      curriculumQa,
      materials: [] as Announcement[],
    };
    return resp;
  }

  // 13. Competition Leaderboard & Sync
  if (pathname === '/api/competition/leaderboard') {
    return buildLeaderboardResponse();
  }
  if (pathname === '/api/competition/sync' && method === 'POST') {
    const currentUser = getCachedUserLocal();
    const events = Array.isArray(body.events)
      ? (body.events as Array<{ eventKey?: string; points?: number; chapterNumber?: number | null; details?: string }>)
      : [];
    let awardedPoints = 0;
    if (currentUser && currentUser.role === 'student' && !currentUser.isAdmin) {
      const stats = getUserStats(currentUser.id);
      for (const ev of events) {
        if (!ev?.eventKey) continue;
        if (!stats.events.some((existing) => existing.event_key === ev.eventKey)) {
          const pts = Math.max(0, Math.round(Number(ev.points || 0)));
          awardedPoints += pts;
          stats.activityPoints += pts;
          stats.totalPoints += pts;
          stats.events.unshift({
            id: Date.now(),
            event_key: ev.eventKey,
            event_type: 'curriculum_activity',
            points: pts,
            chapter_number: ev.chapterNumber ?? null,
            details: ev.details || 'Curriculum activity',
            created_at: new Date().toISOString(),
          });
        }
      }
      saveUserStats(currentUser.id, stats);
      void syncCurrentUserToFirestore(currentUser, {
        totalPoints: stats.totalPoints,
        quizzesCompleted: stats.quizzesCompleted,
        correctAnswers: stats.correctAnswers,
      }).catch(() => {});
    }
    const lb = await buildLeaderboardResponse();
    return {
      syncedKeys: events.map((e) => e.eventKey).filter(Boolean),
      awardedPoints,
      totalPoints: lb.myStats.totalPoints,
      snapshot: lb,
    };
  }

  // 14. Profile Update & Notification Choice
  if (pathname === '/api/profile' && method === 'PUT') {
    const currentUser = getCachedUserLocal();
    if (!currentUser) {
      throw new StaticFallbackHttpError('Not signed in.', 401);
    }
    const updated: User = {
      ...currentUser,
      name: String(body.name || currentUser.name).trim().slice(0, 120) || currentUser.name,
      grade: String(body.grade ?? currentUser.grade).trim().slice(0, 40),
      bio: String(body.bio ?? currentUser.bio).trim().slice(0, 500),
      birthday: String(body.birthday ?? currentUser.birthday ?? '').trim().slice(0, 20),
    };
    const token = getSessionTokenLocal() || `local_${updated.id}`;
    saveSessionAndCachedUser(updated, token);
    void syncCurrentUserToFirestore(updated).catch(() => {});
    return { user: updated };
  }

  if (pathname === '/api/profile/avatar' && method === 'DELETE') {
    const currentUser = getCachedUserLocal();
    if (!currentUser) {
      throw new StaticFallbackHttpError('Not signed in.', 401);
    }
    const updated: User = { ...currentUser, avatar_url: '' };
    const token = getSessionTokenLocal() || `local_${updated.id}`;
    saveSessionAndCachedUser(updated, token);
    void syncCurrentUserToFirestore(updated).catch(() => {});
    return { user: updated };
  }

  if (pathname === '/api/notifications/permission-choice' && method === 'POST') {
    const currentUser = getCachedUserLocal();
    if (!currentUser) return { user: null };
    const choice = body.choice === 'allowed' ? 'allowed' : 'denied';
    const updated: User = {
      ...currentUser,
      notif_prompt_status: choice,
      notifications_enabled: choice === 'allowed',
    };
    const token = getSessionTokenLocal() || `local_${updated.id}`;
    saveSessionAndCachedUser(updated, token);
    void syncCurrentUserToFirestore(updated).catch(() => {});
    return { user: updated };
  }

  // 15. Clean Read Fallbacks for Announcements / Notifications / Messages / Community / Admin
  if (pathname === '/api/announcements' && method === 'GET') {
    return { announcements: [] };
  }
  if (pathname === '/api/notifications' && method === 'GET') {
    return { notifications: [], unreadCount: 0 };
  }
  if (pathname.startsWith('/api/notifications/') && method === 'POST') {
    return { ok: true };
  }
  if (pathname === '/api/push/vapid-public-key') {
    return { publicKey: null };
  }
  if (pathname.startsWith('/api/push/')) {
    return { ok: true };
  }
  if (pathname === '/api/messages/threads' && method === 'GET') {
    return { threads: [] };
  }
  if (pathname.startsWith('/api/messages/') && method === 'GET') {
    return { messages: [] };
  }
  if (pathname === '/api/community/feed' || pathname === '/api/community/posts') {
    return { posts: [] };
  }
  if (pathname === '/api/community/peers') {
    return { peers: [] };
  }
  if (pathname === '/api/community/dm/threads') {
    return { threads: [] };
  }
  if (pathname === '/api/community/groups') {
    return { groups: [] };
  }
  if (pathname === '/api/admin/users' && method === 'GET') {
    return { users: [] };
  }
  if (pathname === '/api/admin/dashboard' && method === 'GET') {
    return {
      totalStudents: 0,
      activeCount: 0,
      activeStudents: [],
      topStudent: null,
      mostActiveStudent: null,
      students: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // 15b. Offline/Static Curriculum Study Assistant Fallback for /api/ai/chat
  if (pathname === '/api/ai/chat' && method === 'POST') {
    const docLang = typeof document !== 'undefined' ? document.documentElement.lang : 'en';
    const lang = normalizeLang(typeof body.lang === 'string' ? body.lang : docLang);
    const messageText = String(body.message || '').trim();
    const historyTurns = Array.isArray(body.history)
      ? (body.history as Array<{ role?: string; text?: string }>)
      : [];

    if (!messageText) {
      throw new StaticFallbackHttpError('Please enter a message for the AI tutor.', 400);
    }

    const recentContextText = historyTurns
      .slice(-4)
      .filter((turn) => turn?.role === 'user')
      .map((turn) => String(turn?.text || ''))
      .join(' ');
    const querySource = `${messageText} ${recentContextText}`.toLowerCase();
    const tokens = Array.from(
      new Set(
        querySource
          .replace(/[^\p{L}\p{N}\s²³/+.-]/gu, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 2)
      )
    );

    const chapterMatch = messageText.match(/(?:chapter|ch|بەشی|فصل|الفصل)\s*(\d{1,2})/i);
    const requestedChapter = chapterMatch ? Number(chapterMatch[1]) : null;
    const chapterMap = getChapterTitleMap(lang);

    const scoreText = (haystack: string, chNum: number | null) => {
      const lower = haystack.toLowerCase();
      let score = requestedChapter && chNum === requestedChapter ? 12 : 0;
      for (const tok of tokens) {
        if (lower.includes(tok)) {
          score += tok.length >= 5 ? 3 : 2;
        }
      }
      return score;
    };

    const qaMatches = snapshot.studyQa
      .map((item) => {
        const q =
          lang === 'ku'
            ? item.question_text_ku || item.question_text
            : lang === 'ar'
            ? item.question_text_ar || item.question_text
            : item.question_text;
        const a =
          lang === 'ku'
            ? item.answer_text_ku || item.answer_text
            : lang === 'ar'
            ? item.answer_text_ar || item.answer_text
            : item.answer_text;
        const exp =
          lang === 'ku'
            ? item.explanation_text_ku || item.explanation_text
            : lang === 'ar'
            ? item.explanation_text_ar || item.explanation_text
            : item.explanation_text;
        const combined = `${q} ${a} ${exp} ${item.question_text} ${item.answer_text}`;
        return {
          score: scoreText(combined, item.chapter_number),
          chapter: item.chapter_number,
          q,
          a,
          exp,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const resourceMatches = snapshot.resources
      .map((res) => {
        const title =
          lang === 'ku'
            ? res.title_ku || res.title
            : lang === 'ar'
            ? res.title_ar || res.title
            : res.title;
        const summary =
          lang === 'ku'
            ? res.summary_ku || res.summary
            : lang === 'ar'
            ? res.summary_ar || res.summary
            : res.summary;
        const combined = `${title} ${summary} ${res.key_formulas} ${res.title} ${res.summary}`;
        return {
          score: scoreText(combined, res.chapter_number),
          chapter: res.chapter_number,
          title,
          summary,
          formulas: res.key_formulas,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const questionMatches = snapshot.questions
      .map((q) => {
        const loc = localizeQuestionFields(q, lang, chapterMap);
        const answerText = getOptionText(loc, q.correct_option);
        const combined = `${loc.questionText} ${loc.explanation} ${answerText} ${q.question_text}`;
        return {
          score: scoreText(combined, q.chapter_number),
          chapter: q.chapter_number,
          question: loc.questionText,
          answer: answerText,
          explanation: loc.explanation,
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    const parts: string[] = [];

    if (resourceMatches.length > 0) {
      for (const res of resourceMatches) {
        const chTitle = res.chapter ? chapterMap.get(res.chapter) || `Chapter ${res.chapter}` : '';
        parts.push(
          `${chTitle ? `**${chTitle}** — ` : ''}${res.title}\n${res.summary}${
            res.formulas ? `\n\nKey formulas / SI units:\n${res.formulas}` : ''
          }`
        );
      }
    }

    if (qaMatches.length > 0) {
      for (const qa of qaMatches) {
        parts.push(
          `Q: ${qa.q}\nAnswer: ${qa.a}${qa.exp ? `\nExplanation: ${qa.exp}` : ''}`
        );
      }
    } else if (questionMatches.length > 0 && resourceMatches.length === 0) {
      for (const qm of questionMatches) {
        parts.push(
          `${qm.question}\nAnswer: ${qm.answer}${qm.explanation ? `\nExplanation: ${qm.explanation}` : ''}`
        );
      }
    }

    if (parts.length === 0) {
      const chapterList = snapshot.chapters
        .slice(0, 6)
        .map((ch) => `• Ch ${ch.chapter_number}: ${localizeChapter(ch, lang, 0).title}`)
        .join('\n');
      const greeting =
        lang === 'ku'
          ? 'ئامادەم یارمەتیت بدەم لە وانەکانی زانستی پۆلی ٩! پرسیار بکە دەربارەی هەر بەشێک یان هاوکێشەیەک (بۆ نموونە: بەشی ١، هێز، جووڵە، چڕی، وزە، کارەبا، یان کیمیا):'
          : lang === 'ar'
          ? 'أنا مستعد لمساعدتك في علوم الصف التاسع! اسأل عن أي فصل أو قانون علمي (مثل: القوة، الحركة، الكثافة، الطاقة، الكهرباء، أو التفاعلات):'
          : 'I am ready to help with your Grade 9 Science studies! Ask about any chapter, concept, or SI formula (for example: Chapter 1, speed, force, density, energy, circuits, or waves):';
      return {
        reply: `${greeting}\n\n${chapterList}`,
        model: String(body.model || 'gemini-4-hydrogen'),
      };
    }

    return {
      reply: parts.join('\n\n---\n\n'),
      model: String(body.model || 'gemini-4-hydrogen'),
    };
  }

  if (pathname === '/api/ai/generate-image' && method === 'POST') {
    const promptText = String(body.prompt || '').trim();
    if (!promptText) {
      throw new StaticFallbackHttpError(
        'Please describe the scientific diagram or illustration you want to generate.',
        400
      );
    }
    const safeTitle = promptText
      .replace(/[<>&"']/g, ' ')
      .trim()
      .slice(0, 56);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">
  <rect width="800" height="450" fill="#FAF8F5"/>
  <rect x="20" y="20" width="760" height="410" rx="16" fill="#FFFFFF" stroke="#E6DFD5" stroke-width="2"/>
  <text x="400" y="68" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#6B1118">Grade 9 Science Study Visual</text>
  <text x="400" y="98" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#57534E">${safeTitle}</text>
  <line x1="120" y1="240" x2="320" y2="210" stroke="#D9A62E" stroke-width="4" stroke-linecap="round"/>
  <polygon points="400,135 495,305 305,305" fill="#F9EFF0" stroke="#6B1118" stroke-width="3" stroke-linejoin="round"/>
  <line x1="450" y1="215" x2="660" y2="175" stroke="#D9A62E" stroke-width="3"/>
  <line x1="454" y1="226" x2="660" y2="226" stroke="#6B1118" stroke-width="3"/>
  <line x1="458" y1="238" x2="660" y2="278" stroke="#2A7B76" stroke-width="3"/>
  <circle cx="400" cy="360" r="18" fill="none" stroke="#6B1118" stroke-width="2"/>
  <text x="400" y="398" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#57534E">Offline study schematic — live AI diagram rendering resumes when backend is connected.</text>
</svg>`;
    const encodedSvg =
      typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(svg)))
        : '';
    return {
      imageUrl: `data:image/svg+xml;base64,${encodedSvg}`,
      caption: `Grade 9 Hub offline science schematic for "${safeTitle}".`,
    };
  }

  // 16. Interactive write actions requiring full backend server
  throw new StaticFallbackHttpError(
    'This action requires the live backend server. Sign in, quizzes, textbooks, and profile sync work in cloud mode.',
    503
  );
}
