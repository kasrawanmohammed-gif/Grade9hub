import curriculumData from './curriculumSnapshot.json';
import {
  AdminStudentPerformance,
  AdminUserRecord,
  Announcement,
  AppSettings,
  Chapter,
  CommunityDirectMessage,
  CommunityDmThread,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMessage,
  CommunityPeer,
  CommunityPost,
  CommunityReactionType,
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
  deleteCloudUserAsAdmin,
  fetchCloudAppSettings,
  fetchCloudRegisteredUsersAsAdmin,
  fetchFirestoreLeaderboard,
  MAIN_ADMIN_EMAIL,
  pullAllPeerPresence,
  pullCloudUserProfile,
  recordQuizAttemptToCloud,
  saveCloudAppSettings,
  syncCloudPeerPresence,
  syncCurrentUserToFirestore,
  updateCloudUserAsAdmin,
} from './cloudAccounts';
import { decryptAdminVaultWithPassword } from './recoveryVault';

const SESSION_TOKEN_KEY = 'grade9hub_session_token';
const CACHED_USER_KEY = 'grade9hub_cached_user';
const REMEMBER_ME_KEY = 'grade9hub_remember_me';
const STATIC_MODE_KEY = 'grade9hub_static_backend_mode';
const STATIC_PROFILES_KEY = 'grade9hub_static_profiles_v1';
const STATIC_STATS_KEY = 'grade9hub_static_stats_v1';
const STATIC_PRESENCE_KEY = 'grade9hub_static_presence_v1';
const STATIC_SETTINGS_KEY = 'grade9hub_static_settings_v1';
const STATIC_COMMUNITY_KEY = 'grade9hub_static_community_v1';
const PRESENCE_TTL_MS = 90_000;

const DEFAULT_APP_SETTINGS: AppSettings = {
  allowStudentRegistration: true,
  communityEnabled: true,
  communityPostingEnabled: true,
  aiTutorEnabled: true,
  defaultLanguage: 'en',
  maintenanceMessage: '',
};

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

  const resolvedRole: 'student' | 'teacher' = isMainAdmin
    ? 'teacher'
    : cloudProfile?.role === 'teacher' || prevProfile?.role === 'teacher'
    ? 'teacher'
    : 'student';
  const resolvedAdmin = isMainAdmin
    ? true
    : Boolean(cloudProfile?.isAdmin ?? prevProfile?.isAdmin ?? false);

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
    role: resolvedRole,
    isAdmin: resolvedAdmin,
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
    isRestricted: isMainAdmin
      ? false
      : Boolean(cloudProfile?.isRestricted ?? prevProfile?.isRestricted ?? false),
    restrictionReason: isMainAdmin
      ? ''
      : cloudProfile?.restrictionReason ?? prevProfile?.restrictionReason ?? '',
    lastLoginAt: nowIso,
    created_at: prevProfile?.created_at || nowIso,
  };
}

interface StaticPresenceEntry {
  online: boolean;
  section: string;
  updatedAt: number;
}

function updateStaticPresence(userId: number, online: boolean, section = 'home'): void {
  const all = readLocalJson<Record<string, StaticPresenceEntry>>(STATIC_PRESENCE_KEY, {});
  all[String(userId)] = {
    online,
    section: online ? section : '',
    updatedAt: Date.now(),
  };
  writeLocalJson(STATIC_PRESENCE_KEY, all);
}

function getLocalAppSettings(): AppSettings {
  const stored = readLocalJson<Partial<AppSettings>>(STATIC_SETTINGS_KEY, {});
  return {
    allowStudentRegistration:
      typeof stored.allowStudentRegistration === 'boolean'
        ? stored.allowStudentRegistration
        : DEFAULT_APP_SETTINGS.allowStudentRegistration,
    communityEnabled:
      typeof stored.communityEnabled === 'boolean'
        ? stored.communityEnabled
        : DEFAULT_APP_SETTINGS.communityEnabled,
    communityPostingEnabled:
      typeof stored.communityPostingEnabled === 'boolean'
        ? stored.communityPostingEnabled
        : DEFAULT_APP_SETTINGS.communityPostingEnabled,
    aiTutorEnabled:
      typeof stored.aiTutorEnabled === 'boolean'
        ? stored.aiTutorEnabled
        : DEFAULT_APP_SETTINGS.aiTutorEnabled,
    defaultLanguage:
      stored.defaultLanguage === 'ku' || stored.defaultLanguage === 'ar'
        ? stored.defaultLanguage
        : DEFAULT_APP_SETTINGS.defaultLanguage,
    maintenanceMessage:
      typeof stored.maintenanceMessage === 'string' ? stored.maintenanceMessage.slice(0, 300) : '',
    updatedAt: stored.updatedAt,
  };
}

function saveLocalAppSettings(patch: Partial<AppSettings>): AppSettings {
  const cur = getLocalAppSettings();
  const next: AppSettings = {
    allowStudentRegistration:
      typeof patch.allowStudentRegistration === 'boolean'
        ? patch.allowStudentRegistration
        : cur.allowStudentRegistration,
    communityEnabled:
      typeof patch.communityEnabled === 'boolean'
        ? patch.communityEnabled
        : cur.communityEnabled,
    communityPostingEnabled:
      typeof patch.communityPostingEnabled === 'boolean'
        ? patch.communityPostingEnabled
        : cur.communityPostingEnabled,
    aiTutorEnabled:
      typeof patch.aiTutorEnabled === 'boolean' ? patch.aiTutorEnabled : cur.aiTutorEnabled,
    defaultLanguage:
      patch.defaultLanguage === 'ku' || patch.defaultLanguage === 'ar' || patch.defaultLanguage === 'en'
        ? patch.defaultLanguage
        : cur.defaultLanguage,
    maintenanceMessage:
      typeof patch.maintenanceMessage === 'string'
        ? patch.maintenanceMessage.trim().slice(0, 300)
        : cur.maintenanceMessage,
    updatedAt: new Date().toISOString(),
  };
  writeLocalJson(STATIC_SETTINGS_KEY, next);
  return next;
}

interface StaticCommunityStore {
  posts: CommunityPost[];
  dms: CommunityDirectMessage[];
  groups: CommunityGroup[];
  groupMembers: Record<string, CommunityGroupMember[]>;
  groupMessages: Record<string, CommunityGroupMessage[]>;
}

function getStaticCommunityStore(): StaticCommunityStore {
  const raw = readLocalJson<Partial<StaticCommunityStore>>(STATIC_COMMUNITY_KEY, {});
  return {
    posts: Array.isArray(raw.posts) ? raw.posts : [],
    dms: Array.isArray(raw.dms) ? raw.dms : [],
    groups: Array.isArray(raw.groups) ? raw.groups : [],
    groupMembers: raw.groupMembers && typeof raw.groupMembers === 'object' ? raw.groupMembers : {},
    groupMessages: raw.groupMessages && typeof raw.groupMessages === 'object' ? raw.groupMessages : {},
  };
}

function saveStaticCommunityStore(store: StaticCommunityStore): void {
  writeLocalJson(STATIC_COMMUNITY_KEY, {
    posts: store.posts.slice(0, 100),
    dms: store.dms.slice(-300),
    groups: store.groups.slice(0, 40),
    groupMembers: store.groupMembers,
    groupMessages: store.groupMessages,
  });
}

async function buildMergedAccountsRegistry(): Promise<{
  users: Array<AdminUserRecord & { cloudUid?: string }>;
  peers: CommunityPeer[];
}> {
  const cached = getCachedUserLocal();
  const localProfiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
  const allStats = readLocalJson<Record<string, StoredStaticStats>>(STATIC_STATS_KEY, {});
  const localPresence = readLocalJson<Record<string, StaticPresenceEntry>>(STATIC_PRESENCE_KEY, {});
  const isPrivileged = Boolean(cached && (cached.role === 'teacher' || cached.isAdmin));

  const [cloudUsers, cloudPeers, cloudLeaderboard] = await Promise.all([
    isPrivileged ? fetchCloudRegisteredUsersAsAdmin().catch(() => []) : Promise.resolve([]),
    pullAllPeerPresence().catch(() => []),
    fetchFirestoreLeaderboard().catch(() => []),
  ]);

  const byId = new Map<number, AdminUserRecord & { cloudUid?: string }>();
  const emailToId = new Map<string, number>();
  const uidToId = new Map<string, number>();

  const upsertProfile = (entry: {
    id?: number;
    cloudUid?: string;
    name: string;
    email: string;
    role: 'student' | 'teacher';
    isAdmin: boolean;
    grade?: string;
    bio?: string;
    birthday?: string;
    avatar_url?: string;
    online?: boolean;
    currentSection?: string;
    isRestricted?: boolean;
    restrictionReason?: string;
    lastLoginAt?: string;
    lastActiveAt?: string;
    quizzesCompleted?: number;
    questionsAnswered?: number;
    correctAnswers?: number;
    avgScorePercent?: number;
    source?: 'local' | 'cloud';
    created_at?: string;
  }) => {
    const normEmail = (entry.email || '').trim().toLowerCase();
    const existingId =
      (normEmail && emailToId.get(normEmail)) ||
      (entry.cloudUid && uidToId.get(entry.cloudUid)) ||
      entry.id;
    const id =
      existingId ||
      stableNumericId(normEmail || entry.cloudUid || entry.name || String(Math.random()));
    if (normEmail) emailToId.set(normEmail, id);
    if (entry.cloudUid) uidToId.set(entry.cloudUid, id);

    const prev = byId.get(id);
    const stats = allStats[String(id)];
    const locPres = localPresence[String(id)];
    const locPresOnline =
      Boolean(locPres && locPres.online && Date.now() - locPres.updatedAt <= PRESENCE_TTL_MS);

    const quizzes = Math.max(
      Number(entry.quizzesCompleted || 0),
      Number(prev?.quizzesCompleted || 0),
      Number(stats?.quizzesCompleted || 0)
    );
    const correct = Math.max(
      Number(entry.correctAnswers || 0),
      Number(prev?.correctAnswers || 0),
      Number(stats?.correctAnswers || 0)
    );
    const answered = Math.max(
      Number(entry.questionsAnswered || 0),
      Number(prev?.questionsAnswered || 0),
      Number(stats?.questionsAnswered || 0),
      correct
    );
    const avgScore =
      answered > 0
        ? Math.round((Math.min(correct, answered) / answered) * 1000) / 10
        : Number(entry.avgScorePercent || prev?.avgScorePercent || 0);

    const isMain = normEmail === MAIN_ADMIN_EMAIL;
    const isMe = Boolean(cached && (cached.id === id || (normEmail && cached.email.toLowerCase() === normEmail)));
    const resolvedOnline = Boolean(entry.online || prev?.online || locPresOnline || isMe);

    byId.set(id, {
      id,
      cloudUid: entry.cloudUid || prev?.cloudUid,
      name: entry.name || prev?.name || 'Grade 9 Student',
      email: normEmail || prev?.email || '',
      role: isMain ? 'teacher' : entry.role || prev?.role || 'student',
      isAdmin: isMain || Boolean(entry.isAdmin || prev?.isAdmin),
      grade: entry.grade || prev?.grade || 'Grade 9',
      bio: entry.bio ?? prev?.bio ?? '',
      birthday: entry.birthday ?? prev?.birthday ?? '',
      avatar_url: entry.avatar_url || prev?.avatar_url || '',
      online: resolvedOnline,
      currentSection: resolvedOnline
        ? entry.currentSection || prev?.currentSection || locPres?.section || 'home'
        : '',
      isRestricted: isMain ? false : Boolean(entry.isRestricted ?? prev?.isRestricted ?? false),
      restrictionReason: isMain
        ? ''
        : entry.restrictionReason ?? prev?.restrictionReason ?? '',
      lastLoginAt: entry.lastLoginAt || prev?.lastLoginAt || '',
      lastActiveAt:
        entry.lastActiveAt ||
        prev?.lastActiveAt ||
        (locPres ? new Date(locPres.updatedAt).toISOString() : ''),
      quizzesCompleted: quizzes,
      questionsAnswered: answered,
      correctAnswers: correct,
      avgScorePercent: avgScore,
      aiTutorTurns: prev?.aiTutorTurns || 0,
      source: entry.source || prev?.source || 'local',
      created_at: entry.created_at || prev?.created_at || new Date().toISOString(),
    });
  };

  for (const cu of cloudUsers) {
    upsertProfile({
      id: cu.uid ? stableNumericId(cu.uid) : stableNumericId(cu.email),
      cloudUid: cu.uid,
      name: cu.name,
      email: cu.email,
      role: cu.role,
      isAdmin: cu.isAdmin,
      grade: cu.grade,
      bio: cu.bio,
      birthday: cu.birthday,
      avatar_url: cu.avatarUrl,
      isRestricted: cu.isRestricted,
      restrictionReason: cu.restrictionReason,
      lastLoginAt: cu.lastLoginAt,
      lastActiveAt: cu.lastActiveAt,
      quizzesCompleted: cu.quizzesCompleted,
      questionsAnswered: cu.correctAnswers,
      correctAnswers: cu.correctAnswers,
      source: 'cloud',
      created_at: cu.createdAtIso,
    });
  }

  for (const cp of cloudPeers) {
    const matchedByUid = uidToId.get(cp.uid);
    const targetId = matchedByUid || cp.numericId || stableNumericId(cp.uid);
    const existing = byId.get(targetId);
    upsertProfile({
      id: targetId,
      cloudUid: cp.uid,
      name: existing?.name || cp.name,
      email: existing?.email || '',
      role: existing?.role || cp.role,
      isAdmin: existing?.isAdmin ?? cp.isAdmin,
      grade: existing?.grade || cp.grade,
      bio: existing?.bio || cp.bio,
      avatar_url: existing?.avatar_url || cp.avatarUrl,
      online: cp.online,
      currentSection: cp.currentSection,
      isRestricted: existing?.isRestricted ?? cp.isRestricted,
      lastActiveAt: cp.lastActiveAtIso,
      source: 'cloud',
    });
  }

  for (const lb of cloudLeaderboard) {
    const targetId = uidToId.get(lb.uid) || stableNumericId(lb.uid);
    const existing = byId.get(targetId);
    upsertProfile({
      id: targetId,
      cloudUid: lb.uid,
      name: existing?.name || lb.name,
      email: existing?.email || '',
      role: 'student',
      isAdmin: false,
      grade: existing?.grade || lb.grade,
      avatar_url: existing?.avatar_url || lb.avatarUrl,
      quizzesCompleted: lb.quizzesCompleted,
      correctAnswers: lb.correctAnswers,
      questionsAnswered: lb.correctAnswers,
      source: 'cloud',
    });
  }

  for (const lp of Object.values(localProfiles)) {
    if (!lp?.email) continue;
    upsertProfile({
      id: lp.id,
      name: lp.name,
      email: lp.email,
      role: lp.role,
      isAdmin: Boolean(lp.isAdmin),
      grade: lp.grade,
      bio: lp.bio,
      birthday: lp.birthday,
      avatar_url: lp.avatar_url,
      isRestricted: lp.isRestricted,
      restrictionReason: lp.restrictionReason,
      lastLoginAt: lp.lastLoginAt,
      source: 'local',
      created_at: lp.created_at,
    });
  }

  if (cached) {
    upsertProfile({
      id: cached.id,
      cloudUid: auth.currentUser?.uid,
      name: cached.name,
      email: cached.email,
      role: cached.role,
      isAdmin: Boolean(cached.isAdmin),
      grade: cached.grade,
      bio: cached.bio,
      birthday: cached.birthday,
      avatar_url: cached.avatar_url,
      online: true,
      currentSection: localPresence[String(cached.id)]?.section || 'home',
      isRestricted: cached.isRestricted,
      restrictionReason: cached.restrictionReason,
      lastLoginAt: cached.lastLoginAt,
      lastActiveAt: new Date().toISOString(),
      source: auth.currentUser ? 'cloud' : 'local',
      created_at: cached.created_at,
    });
  }

  const users = Array.from(byId.values()).sort((a, b) => {
    if (Boolean(a.isAdmin) !== Boolean(b.isAdmin)) return a.isAdmin ? -1 : 1;
    if (a.role !== b.role) return a.role === 'teacher' ? -1 : 1;
    if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const peers: CommunityPeer[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    ...(isPrivileged && u.email ? { email: u.email } : {}),
    role: u.role,
    isAdmin: u.isAdmin,
    grade: u.grade,
    bio: u.bio || '',
    avatar_url: u.avatar_url || '',
    online: Boolean(u.online),
    currentSection: u.currentSection || '',
    lastActiveAt: u.lastActiveAt || '',
    lastLoginAt: u.lastLoginAt || '',
    isRestricted: Boolean(u.isRestricted),
  }));

  return { users, peers };
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
    const cached = getCachedUserLocal();
    if (cached) {
      updateStaticPresence(cached.id, false, '');
      void syncCloudPeerPresence(cached, false, '').catch(() => {});
    }
    return { ok: true };
  }

  // 5b. Local/Static Registration
  if (pathname === '/api/auth/register' && method === 'POST') {
    const settings = getLocalAppSettings();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    const birthday = String(body.birthday || '').trim();
    const grade = String(body.grade || 'Grade 9').trim();
    const isMainAdmin = email === MAIN_ADMIN_EMAIL;
    if (!isMainAdmin && !settings.allowStudentRegistration) {
      throw new StaticFallbackHttpError(
        'New student registration is currently paused by the administrator.',
        403
      );
    }
    if (name.length < 2) {
      throw new StaticFallbackHttpError('Please enter your full name (at least 2 characters).', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new StaticFallbackHttpError('Please enter a valid email address.', 400);
    }
    if (password.length < 6) {
      throw new StaticFallbackHttpError('Password must be at least 6 characters long.', 400);
    }
    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    if (profiles[email] && !isMainAdmin) {
      throw new StaticFallbackHttpError('An account with this email already exists. Please log in.', 409);
    }
    const nowIso = new Date().toISOString();
    const newUser: User = {
      id: profiles[email]?.id || stableNumericId(email),
      name,
      email,
      role: isMainAdmin ? 'teacher' : 'student',
      isAdmin: isMainAdmin,
      grade,
      bio: '',
      birthday,
      avatar_url: '',
      notif_prompt_status: '',
      notifications_enabled: true,
      isRestricted: false,
      restrictionReason: '',
      lastLoginAt: nowIso,
      created_at: profiles[email]?.created_at || nowIso,
    };
    const token = `local_${newUser.id}`;
    saveSessionAndCachedUser(newUser, token, true);
    updateStaticPresence(newUser.id, true, 'home');
    return { user: newUser, sessionToken: token };
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

    const skipSave = Boolean(body.skipSave);
    const currentUser = getCachedUserLocal();
    let pointsAwarded = 0;
    let totalPoints = 0;

    if (currentUser && currentUser.role === 'student' && !currentUser.isAdmin) {
      const stats = getUserStats(currentUser.id);
      if (!skipSave && !stats.answeredQuestionIds.includes(questionId)) {
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

  if (pathname === '/api/profile/avatar' && method === 'POST') {
    const currentUser = getCachedUserLocal();
    if (!currentUser) {
      throw new StaticFallbackHttpError('Not signed in.', 401);
    }
    const formData = options.body instanceof FormData ? options.body : null;
    const rawFile = formData ? formData.get('avatar') : null;
    if (!(rawFile instanceof File)) {
      throw new StaticFallbackHttpError('Please upload an image file (PNG, JPG, WebP, or GIF).', 400);
    }
    if (rawFile.size > 4 * 1024 * 1024) {
      throw new StaticFallbackHttpError('Profile picture must be smaller than 4 MB.', 400);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(rawFile);
    });
    if (!dataUrl) {
      throw new StaticFallbackHttpError('Unable to read uploaded profile picture.', 400);
    }
    const updated: User = { ...currentUser, avatar_url: dataUrl };
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

  if (pathname === '/api/profile' && method === 'DELETE') {
    const currentUser = getCachedUserLocal();
    if (!currentUser) {
      throw new StaticFallbackHttpError('Not signed in.', 401);
    }
    if (currentUser.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
      throw new StaticFallbackHttpError('The main administrator account cannot be deleted.', 403);
    }
    if (String(body.confirmationText || '').trim().toUpperCase() !== 'DELETE') {
      throw new StaticFallbackHttpError(
        'Please type DELETE to confirm permanent account deletion.',
        400
      );
    }
    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    delete profiles[currentUser.email.trim().toLowerCase()];
    writeLocalJson(STATIC_PROFILES_KEY, profiles);

    const allStats = readLocalJson<Record<string, StoredStaticStats>>(STATIC_STATS_KEY, {});
    delete allStats[String(currentUser.id)];
    writeLocalJson(STATIC_STATS_KEY, allStats);

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SESSION_TOKEN_KEY);
        window.localStorage.removeItem(CACHED_USER_KEY);
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
        window.sessionStorage.removeItem(CACHED_USER_KEY);
      }
    } catch {
      // ignore storage errors
    }
    return { ok: true };
  }

  if (pathname === '/api/presence/heartbeat' && method === 'POST') {
    const cached = getCachedUserLocal();
    const section = String(body.section || 'home').trim() || 'home';
    if (cached) {
      updateStaticPresence(cached.id, true, section);
      void syncCloudPeerPresence(cached, true, section).catch(() => {});
    }
    return { ok: true, online: true };
  }

  if (pathname === '/api/presence/offline' && method === 'POST') {
    const cached = getCachedUserLocal();
    if (cached) {
      updateStaticPresence(cached.id, false, '');
      void syncCloudPeerPresence(cached, false, '').catch(() => {});
    }
    return { ok: true, online: false };
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

  // 14b. App Settings (/api/settings/public, /api/admin/settings)
  if (pathname === '/api/settings/public' && method === 'GET') {
    const cloud = await fetchCloudAppSettings().catch(() => null);
    if (cloud) {
      writeLocalJson(STATIC_SETTINGS_KEY, cloud);
      return { settings: cloud };
    }
    return { settings: getLocalAppSettings() };
  }
  if (pathname === '/api/admin/settings' && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const cloud = await fetchCloudAppSettings().catch(() => null);
    if (cloud) {
      writeLocalJson(STATIC_SETTINGS_KEY, cloud);
      return { settings: cloud };
    }
    return { settings: getLocalAppSettings() };
  }
  if (pathname === '/api/admin/settings' && method === 'PUT') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const updated = saveLocalAppSettings(body as Partial<AppSettings>);
    await saveCloudAppSettings(updated).catch(() => false);
    return { ok: true, settings: updated };
  }

  // 15. Clean Read & Cloud-Backed Fallbacks for Announcements / Notifications / Messages / Community / Admin
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

  // 15a. Community Fallbacks with Live Online/Offline Status
  if (pathname === '/api/community/peers' && method === 'GET') {
    const viewer = getCachedUserLocal();
    const settings = getLocalAppSettings();
    if (viewer && viewer.role !== 'teacher' && !viewer.isAdmin && !settings.communityEnabled) {
      throw new StaticFallbackHttpError(
        'Student Community is currently disabled by the administrator.',
        403
      );
    }
    const { peers } = await buildMergedAccountsRegistry();
    return { peers };
  }

  if ((pathname === '/api/community/feed' || pathname === '/api/community/posts') && method === 'GET') {
    const viewer = getCachedUserLocal();
    const settings = getLocalAppSettings();
    if (viewer && viewer.role !== 'teacher' && !viewer.isAdmin && !settings.communityEnabled) {
      throw new StaticFallbackHttpError(
        'Student Community is currently disabled by the administrator.',
        403
      );
    }
    const q = String(search.get('q') || '').trim().toLowerCase();
    const chParam = search.get('chapter') ? Number(search.get('chapter')) : null;
    const store = getStaticCommunityStore();
    const { peers } = await buildMergedAccountsRegistry();
    const peerMap = new Map(peers.map((p) => [p.id, p]));

    const posts = store.posts
      .filter((p) => {
        if (chParam && p.chapter_number !== chParam) return false;
        if (q && !`${p.content} ${p.author_name}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((p) => ({
        ...p,
        author_online: Boolean(peerMap.get(p.author_id)?.online),
        comments: (p.comments || []).map((c) => ({
          ...c,
          author_online: Boolean(peerMap.get(c.author_id)?.online),
        })),
      }));
    return { posts };
  }

  if (pathname === '/api/community/posts' && method === 'POST') {
    const user = getCachedUserLocal();
    if (!user) throw new StaticFallbackHttpError('Not signed in.', 401);
    const settings = getLocalAppSettings();
    if (user.role !== 'teacher' && !user.isAdmin && (!settings.communityEnabled || !settings.communityPostingEnabled)) {
      throw new StaticFallbackHttpError('Community posting is currently paused by the administrator.', 403);
    }
    const formData = options.body instanceof FormData ? options.body : null;
    const content = formData
      ? String(formData.get('content') || '').trim()
      : String(body.content || '').trim();
    const rawCh = formData ? formData.get('chapterNumber') : body.chapterNumber;
    const chapterNumber = rawCh !== undefined && rawCh !== null && rawCh !== '' ? Number(rawCh) : null;
    if (!content) {
      throw new StaticFallbackHttpError('Please write an educational post.', 400);
    }
    const store = getStaticCommunityStore();
    const created: CommunityPost = {
      id: Date.now(),
      author_id: user.id,
      author_name: user.name,
      author_avatar_url: user.avatar_url || '',
      author_role: user.role,
      author_is_admin: Boolean(user.isAdmin),
      author_online: true,
      author_grade: user.grade || '',
      author_is_restricted: Boolean(user.isRestricted),
      chapter_number: chapterNumber,
      content,
      attachment_name: null,
      attachment_url: null,
      attachment_mime: null,
      created_at: new Date().toISOString(),
      reactionCounts: { like: 0, helpful: 0, celebrate: 0, insightful: 0 },
      totalReactions: 0,
      myReaction: null,
      comments: [],
    };
    store.posts.unshift(created);
    saveStaticCommunityStore(store);
    return { post: created };
  }

  const staticPostDeleteMatch = pathname.match(/^\/api\/community\/posts\/(\d+)$/);
  if (staticPostDeleteMatch && method === 'DELETE') {
    const postId = Number(staticPostDeleteMatch[1]);
    const store = getStaticCommunityStore();
    store.posts = store.posts.filter((p) => p.id !== postId);
    saveStaticCommunityStore(store);
    return { ok: true };
  }

  const staticCommentMatch = pathname.match(/^\/api\/community\/posts\/(\d+)\/comments$/);
  if (staticCommentMatch && method === 'POST') {
    const user = getCachedUserLocal();
    if (!user) throw new StaticFallbackHttpError('Not signed in.', 401);
    const postId = Number(staticCommentMatch[1]);
    const content = String(body.content || '').trim();
    if (!content) throw new StaticFallbackHttpError('Comment text is required.', 400);
    const store = getStaticCommunityStore();
    const post = store.posts.find((p) => p.id === postId);
    if (!post) throw new StaticFallbackHttpError('Post not found.', 404);
    const comment = {
      id: Date.now(),
      post_id: postId,
      author_id: user.id,
      author_name: user.name,
      author_avatar_url: user.avatar_url || '',
      author_role: user.role,
      author_is_admin: Boolean(user.isAdmin),
      author_online: true,
      content,
      created_at: new Date().toISOString(),
    };
    post.comments.push(comment);
    saveStaticCommunityStore(store);
    return { comment };
  }

  const staticReactMatch = pathname.match(/^\/api\/community\/posts\/(\d+)\/react$/);
  if (staticReactMatch && method === 'POST') {
    const postId = Number(staticReactMatch[1]);
    const reaction = String(body.reaction || 'like') as CommunityReactionType;
    const store = getStaticCommunityStore();
    const post = store.posts.find((p) => p.id === postId);
    if (!post) throw new StaticFallbackHttpError('Post not found.', 404);
    if (post.myReaction === reaction) {
      post.reactionCounts[reaction] = Math.max(0, (post.reactionCounts[reaction] || 1) - 1);
      post.myReaction = null;
    } else {
      if (post.myReaction) {
        post.reactionCounts[post.myReaction] = Math.max(0, (post.reactionCounts[post.myReaction] || 1) - 1);
      }
      post.reactionCounts[reaction] = (post.reactionCounts[reaction] || 0) + 1;
      post.myReaction = reaction;
    }
    post.totalReactions = Object.values(post.reactionCounts).reduce((a, b) => a + b, 0);
    saveStaticCommunityStore(store);
    return {
      reactionCounts: post.reactionCounts,
      totalReactions: post.totalReactions,
      myReaction: post.myReaction,
    };
  }

  if (pathname === '/api/community/dm/threads' && method === 'GET') {
    const viewer = getCachedUserLocal();
    const store = getStaticCommunityStore();
    const { peers } = await buildMergedAccountsRegistry();
    const threads: CommunityDmThread[] = peers
      .filter((p) => !viewer || p.id !== viewer.id)
      .map((p) => {
        const convo = viewer
          ? store.dms.filter(
              (m) =>
                (m.sender_id === viewer.id && m.recipient_id === p.id) ||
                (m.sender_id === p.id && m.recipient_id === viewer.id)
            )
          : [];
        const last = convo[convo.length - 1];
        return {
          peer_id: p.id,
          peer_name: p.name,
          peer_avatar_url: p.avatar_url,
          peer_role: p.role,
          peer_is_admin: p.isAdmin,
          peer_grade: p.grade,
          peer_online: p.online,
          peer_is_restricted: p.isRestricted,
          last_message_at: last?.created_at || null,
          last_message_text: last?.message_text || '',
          last_attachment_name: last?.attachment_name || null,
          unread_count: 0,
        };
      });
    return { threads };
  }

  const staticDmPeerMatch = pathname.match(/^\/api\/community\/dm\/(\d+)$/);
  if (staticDmPeerMatch) {
    const user = getCachedUserLocal();
    if (!user) throw new StaticFallbackHttpError('Not signed in.', 401);
    const peerId = Number(staticDmPeerMatch[1]);
    const store = getStaticCommunityStore();
    const { peers } = await buildMergedAccountsRegistry();
    const peerMap = new Map(peers.map((p) => [p.id, p]));
    if (method === 'GET') {
      const messages = store.dms
        .filter(
          (m) =>
            (m.sender_id === user.id && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === user.id)
        )
        .map((m) => ({
          ...m,
          sender_online: Boolean(peerMap.get(m.sender_id)?.online),
        }));
      return { messages };
    }
    if (method === 'POST') {
      const formData = options.body instanceof FormData ? options.body : null;
      const messageText = formData
        ? String(formData.get('messageText') || '').trim()
        : String(body.messageText || '').trim();
      if (!messageText) throw new StaticFallbackHttpError('Please write a message.', 400);
      const targetPeer = peerMap.get(peerId);
      const msg: CommunityDirectMessage = {
        id: Date.now(),
        sender_id: user.id,
        recipient_id: peerId,
        sender_name: user.name,
        sender_avatar_url: user.avatar_url || '',
        sender_role: user.role,
        sender_online: true,
        recipient_name: targetPeer?.name || 'Classmate',
        message_text: messageText,
        attachment_name: null,
        attachment_url: null,
        attachment_mime: null,
        is_read: 1,
        created_at: new Date().toISOString(),
      };
      store.dms.push(msg);
      saveStaticCommunityStore(store);
      return { message: msg };
    }
  }

  if (pathname === '/api/community/groups' && method === 'GET') {
    const store = getStaticCommunityStore();
    return { groups: store.groups };
  }

  if (pathname === '/api/community/groups' && method === 'POST') {
    const user = getCachedUserLocal();
    if (!user) throw new StaticFallbackHttpError('Not signed in.', 401);
    const name = String(body.name || '').trim();
    if (name.length < 2) throw new StaticFallbackHttpError('Group name must be at least 2 characters.', 400);
    const store = getStaticCommunityStore();
    const groupId = Date.now();
    const group: CommunityGroup = {
      id: groupId,
      name,
      description: String(body.description || '').trim(),
      is_public: body.isPublic !== false,
      created_by: user.id,
      creator_name: user.name,
      created_at: new Date().toISOString(),
      member_count: 1,
      message_count: 0,
      last_message_text: null,
      last_message_at: null,
      is_member: true,
    };
    store.groups.unshift(group);
    store.groupMembers[String(groupId)] = [
      {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url || '',
        role: user.role,
        is_admin: Boolean(user.isAdmin),
        grade: user.grade || 'Grade 9',
        group_role: 'owner',
        online: true,
      },
    ];
    saveStaticCommunityStore(store);
    return { groupId };
  }

  const staticGroupMsgsMatch = pathname.match(/^\/api\/community\/groups\/(\d+)\/messages$/);
  if (staticGroupMsgsMatch) {
    const user = getCachedUserLocal();
    if (!user) throw new StaticFallbackHttpError('Not signed in.', 401);
    const groupId = Number(staticGroupMsgsMatch[1]);
    const store = getStaticCommunityStore();
    const group = store.groups.find((g) => g.id === groupId);
    if (!group) throw new StaticFallbackHttpError('Group not found.', 404);
    const { peers } = await buildMergedAccountsRegistry();
    const peerMap = new Map(peers.map((p) => [p.id, p]));
    if (method === 'GET') {
      const members = (store.groupMembers[String(groupId)] || []).map((m) => ({
        ...m,
        online: Boolean(peerMap.get(m.id)?.online),
      }));
      const messages = (store.groupMessages[String(groupId)] || []).map((m) => ({
        ...m,
        sender_online: Boolean(peerMap.get(m.sender_id)?.online),
      }));
      return { group, members, messages };
    }
    if (method === 'POST') {
      const formData = options.body instanceof FormData ? options.body : null;
      const messageText = formData
        ? String(formData.get('messageText') || '').trim()
        : String(body.messageText || '').trim();
      if (!messageText) throw new StaticFallbackHttpError('Please write a message.', 400);
      const msg: CommunityGroupMessage = {
        id: Date.now(),
        group_id: groupId,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar_url: user.avatar_url || '',
        sender_role: user.role,
        sender_is_admin: Boolean(user.isAdmin),
        sender_online: true,
        message_text: messageText,
        attachment_name: null,
        attachment_url: null,
        attachment_mime: null,
        created_at: new Date().toISOString(),
      };
      if (!store.groupMessages[String(groupId)]) store.groupMessages[String(groupId)] = [];
      store.groupMessages[String(groupId)].push(msg);
      group.message_count += 1;
      group.last_message_text = messageText;
      group.last_message_at = msg.created_at;
      saveStaticCommunityStore(store);
      return { message: msg };
    }
  }

  // 15b. Admin Registered Accounts, Profile Inspection/Editing, Role, Restrict, Delete, Dashboard
  if (pathname === '/api/admin/users' && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const q = String(search.get('q') || '').trim().toLowerCase();
    const roleFilter = String(search.get('role') || 'all').toLowerCase();
    const statusFilter = String(search.get('status') || 'all').toLowerCase();
    const { users } = await buildMergedAccountsRegistry();
    const filtered = users.filter((u) => {
      if (roleFilter === 'student' && (u.role !== 'student' || u.isAdmin)) return false;
      if (roleFilter === 'teacher' && u.role !== 'teacher' && !u.isAdmin) return false;
      if (statusFilter === 'online' && !u.online) return false;
      if (statusFilter === 'offline' && u.online) return false;
      if (statusFilter === 'restricted' && !u.isRestricted) return false;
      if (q && !`${u.name} ${u.email} ${u.grade} ${u.bio || ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    return { users: filtered };
  }

  const adminUserDetailMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (adminUserDetailMatch && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminUserDetailMatch[1]);
    const { users } = await buildMergedAccountsRegistry();
    const target = users.find((u) => u.id === targetId);
    if (!target) {
      throw new StaticFallbackHttpError('User account not found.', 404);
    }
    const stats = getUserStats(target.id);
    const chapterMap = getChapterTitleMap('en');
    return {
      user: target,
      attempts: stats.attempts.slice(0, 20).map((a) => ({
        id: a.id,
        mode: a.mode,
        chapter_number: a.chapter_number,
        chapter_title: a.chapter_number ? chapterMap.get(a.chapter_number) || `Chapter ${a.chapter_number}` : null,
        total_questions: a.total_questions,
        correct_count: a.correct_count,
        score_percent: a.score_percent,
        created_at: a.created_at,
      })),
      recentActivity: [],
    };
  }

  if (adminUserDetailMatch && method === 'PUT') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminUserDetailMatch[1]);
    const acting = getCachedUserLocal();
    const { users } = await buildMergedAccountsRegistry();
    const target = users.find((u) => u.id === targetId);
    if (!target) {
      throw new StaticFallbackHttpError('User account not found.', 404);
    }
    const isMain = target.email.toLowerCase() === MAIN_ADMIN_EMAIL;
    const nextName =
      body.name !== undefined ? String(body.name || '').trim().slice(0, 120) : target.name;
    if (nextName.length < 2) {
      throw new StaticFallbackHttpError('Name must be at least 2 characters.', 400);
    }
    const requestedRole =
      body.role === 'teacher' ? 'teacher' : body.role === 'student' ? 'student' : target.role;
    if (isMain && requestedRole !== 'teacher') {
      throw new StaticFallbackHttpError(
        'The main administrator account (mohamdm791@gmail.com) cannot be demoted.',
        400
      );
    }
    if (acting && acting.id === targetId && requestedRole !== 'teacher') {
      throw new StaticFallbackHttpError('You cannot demote your own administrator account.', 400);
    }
    const nextAdmin = isMain
      ? true
      : body.isAdmin !== undefined
      ? Boolean(body.isAdmin) && requestedRole === 'teacher'
      : requestedRole === 'teacher';
    const nextGrade =
      body.grade !== undefined ? String(body.grade || '').trim().slice(0, 40) : target.grade;
    const nextBio =
      body.bio !== undefined ? String(body.bio || '').trim().slice(0, 500) : target.bio || '';
    const nextBirthday =
      body.birthday !== undefined ? String(body.birthday || '').trim() : target.birthday || '';
    const nextRestricted = isMain
      ? false
      : body.restricted !== undefined
      ? Boolean(body.restricted)
      : Boolean(target.isRestricted);
    const nextReason = nextRestricted
      ? String(body.reason ?? target.restrictionReason ?? '').trim().slice(0, 300)
      : '';

    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    if (target.email) {
      const existingLocal = profiles[target.email];
      profiles[target.email] = {
        id: target.id,
        name: nextName,
        email: target.email,
        role: isMain ? 'teacher' : requestedRole,
        isAdmin: nextAdmin,
        grade: nextGrade,
        bio: nextBio,
        birthday: nextBirthday,
        avatar_url: existingLocal?.avatar_url || target.avatar_url || '',
        notif_prompt_status: existingLocal?.notif_prompt_status || '',
        notifications_enabled: existingLocal?.notifications_enabled !== false,
        isRestricted: nextRestricted,
        restrictionReason: nextReason,
        lastLoginAt: target.lastLoginAt || '',
        created_at: target.created_at,
      };
      writeLocalJson(STATIC_PROFILES_KEY, profiles);
    }

    if (target.email || target.cloudUid) {
      await updateCloudUserAsAdmin({
        email: target.email,
        uid: target.cloudUid,
        name: nextName,
        grade: nextGrade,
        bio: nextBio,
        birthday: nextBirthday,
        role: isMain ? 'teacher' : requestedRole,
        isAdmin: nextAdmin,
        isRestricted: nextRestricted,
        restrictionReason: nextReason,
      }).catch(() => {});
    }

    return {
      ok: true,
      user: {
        ...target,
        name: nextName,
        grade: nextGrade,
        bio: nextBio,
        birthday: nextBirthday,
        role: isMain ? 'teacher' : requestedRole,
        isAdmin: nextAdmin,
        isRestricted: nextRestricted,
        restrictionReason: nextReason,
      },
    };
  }

  const adminRoleMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/role$/);
  if (adminRoleMatch && method === 'PUT') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminRoleMatch[1]);
    const acting = getCachedUserLocal();
    const { users } = await buildMergedAccountsRegistry();
    const target = users.find((u) => u.id === targetId);
    if (!target) throw new StaticFallbackHttpError('User account not found.', 404);
    if (target.email.toLowerCase() === MAIN_ADMIN_EMAIL) {
      throw new StaticFallbackHttpError(
        'The main administrator account (mohamdm791@gmail.com) cannot be demoted.',
        400
      );
    }
    const nextRole = body.role === 'teacher' ? 'teacher' : 'student';
    if (acting && acting.id === targetId && nextRole !== 'teacher') {
      throw new StaticFallbackHttpError('You cannot demote your own administrator account.', 400);
    }
    const nextAdmin = nextRole === 'teacher' && body.isAdmin !== false;
    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    if (target.email && profiles[target.email]) {
      profiles[target.email] = { ...profiles[target.email], role: nextRole, isAdmin: nextAdmin };
      writeLocalJson(STATIC_PROFILES_KEY, profiles);
    }
    await updateCloudUserAsAdmin({
      email: target.email,
      uid: target.cloudUid,
      role: nextRole,
      isAdmin: nextAdmin,
    }).catch(() => {});
    return { ok: true, role: nextRole, isAdmin: nextAdmin };
  }

  const adminRestrictMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/restrict$/);
  if (adminRestrictMatch && method === 'PUT') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminRestrictMatch[1]);
    const { users } = await buildMergedAccountsRegistry();
    const target = users.find((u) => u.id === targetId);
    if (!target) throw new StaticFallbackHttpError('User account not found.', 404);
    if (target.email.toLowerCase() === MAIN_ADMIN_EMAIL) {
      throw new StaticFallbackHttpError('The main administrator account cannot be restricted.', 400);
    }
    const restricted = Boolean(body.restricted);
    const reason = restricted ? String(body.reason || '').trim().slice(0, 300) : '';
    const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
    if (target.email && profiles[target.email]) {
      profiles[target.email] = {
        ...profiles[target.email],
        isRestricted: restricted,
        restrictionReason: reason,
      };
      writeLocalJson(STATIC_PROFILES_KEY, profiles);
    }
    await updateCloudUserAsAdmin({
      email: target.email,
      uid: target.cloudUid,
      isRestricted: restricted,
      restrictionReason: reason,
    }).catch(() => {});
    return { ok: true, restricted, reason };
  }

  if (adminUserDetailMatch && method === 'DELETE') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminUserDetailMatch[1]);
    const acting = getCachedUserLocal();
    if (acting && acting.id === targetId) {
      throw new StaticFallbackHttpError('You cannot delete your own active account.', 400);
    }
    const { users } = await buildMergedAccountsRegistry();
    const target = users.find((u) => u.id === targetId);
    if (target && target.email.toLowerCase() === MAIN_ADMIN_EMAIL) {
      throw new StaticFallbackHttpError(
        'The main administrator account (mohamdm791@gmail.com) cannot be deleted.',
        403
      );
    }
    if (target?.email) {
      const profiles = readLocalJson<Record<string, User>>(STATIC_PROFILES_KEY, {});
      delete profiles[target.email.toLowerCase()];
      writeLocalJson(STATIC_PROFILES_KEY, profiles);
    }
    const allStats = readLocalJson<Record<string, StoredStaticStats>>(STATIC_STATS_KEY, {});
    delete allStats[String(targetId)];
    writeLocalJson(STATIC_STATS_KEY, allStats);
    const presence = readLocalJson<Record<string, StaticPresenceEntry>>(STATIC_PRESENCE_KEY, {});
    delete presence[String(targetId)];
    writeLocalJson(STATIC_PRESENCE_KEY, presence);
    if (target?.email) {
      await deleteCloudUserAsAdmin(target.email, target.cloudUid).catch(() => {});
    }
    return { ok: true, deletedUserId: targetId };
  }

  if (pathname === '/api/admin/dashboard' && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const { users } = await buildMergedAccountsRegistry();
    const studentUsers = users.filter((u) => u.role === 'student' && !u.isAdmin);
    const students: AdminStudentPerformance[] = studentUsers.map((u) => {
      const quizzes = Number(u.quizzesCompleted || 0);
      const answered = Number(u.questionsAnswered || 0);
      const correct = Number(u.correctAnswers || 0);
      const accuracy =
        answered > 0 ? Math.round((Math.min(correct, answered) / answered) * 1000) / 10 : 0;
      const avgScore = Number(u.avgScorePercent || accuracy);
      const performanceScore =
        answered > 0 || quizzes > 0
          ? Math.round((avgScore * 0.55 + accuracy * 0.3 + Math.min(correct, 100) * 0.15) * 10) / 10
          : 0;
      const activityScore = quizzes * 10 + answered * 2 + Number(u.aiTutorTurns || 0) * 2;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        grade: u.grade,
        avatar_url: u.avatar_url || '',
        online: Boolean(u.online),
        currentSection: u.currentSection || '',
        lastActiveAt: u.lastActiveAt || '',
        lastLoginAt: u.lastLoginAt || '',
        isRestricted: Boolean(u.isRestricted),
        restrictionReason: u.restrictionReason || '',
        quizzesCompleted: quizzes,
        questionsAnswered: answered,
        correctAnswers: correct,
        accuracyPercent: accuracy,
        avgScorePercent: avgScore,
        bestScorePercent: avgScore,
        teacherMessagesCount: 0,
        aiTutorTurns: Number(u.aiTutorTurns || 0),
        performanceScore,
        activityScore,
      };
    });
    const activeStudents = students.filter((s) => s.online);
    const topSorted = [...students]
      .filter((s) => s.questionsAnswered > 0 || s.quizzesCompleted > 0)
      .sort((a, b) => b.performanceScore - a.performanceScore || b.correctAnswers - a.correctAnswers);
    const activeSorted = [...students]
      .filter((s) => s.activityScore > 0)
      .sort((a, b) => b.activityScore - a.activityScore);
    return {
      totalStudents: students.length,
      activeCount: activeStudents.length,
      activeStudents,
      topStudent: topSorted[0] || null,
      mostActiveStudent: activeSorted[0] || null,
      students,
      generatedAt: new Date().toISOString(),
    };
  }

  const adminStudentStatsMatch = pathname.match(/^\/api\/admin\/students\/(\d+)\/stats$/);
  if (adminStudentStatsMatch && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const targetId = Number(adminStudentStatsMatch[1]);
    const { users } = await buildMergedAccountsRegistry();
    const u = users.find((row) => row.id === targetId);
    if (!u) throw new StaticFallbackHttpError('Student not found.', 404);
    const stats = getUserStats(u.id);
    const chapterMap = getChapterTitleMap(normalizeLang(search.get('lang')));
    const quizzes = Math.max(Number(u.quizzesCompleted || 0), stats.quizzesCompleted);
    const answered = Math.max(Number(u.questionsAnswered || 0), stats.questionsAnswered);
    const correct = Math.max(Number(u.correctAnswers || 0), stats.correctAnswers);
    const accuracy = answered > 0 ? Math.round((Math.min(correct, answered) / answered) * 1000) / 10 : 0;
    return {
      student: {
        id: u.id,
        name: u.name,
        email: u.email,
        grade: u.grade,
        avatar_url: u.avatar_url || '',
        online: Boolean(u.online),
        currentSection: u.currentSection || '',
        lastActiveAt: u.lastActiveAt || '',
        lastLoginAt: u.lastLoginAt || '',
        isRestricted: Boolean(u.isRestricted),
        restrictionReason: u.restrictionReason || '',
        quizzesCompleted: quizzes,
        questionsAnswered: answered,
        correctAnswers: correct,
        accuracyPercent: accuracy,
        avgScorePercent: Number(u.avgScorePercent || accuracy),
        bestScorePercent: Number(u.avgScorePercent || accuracy),
        teacherMessagesCount: 0,
        aiTutorTurns: Number(u.aiTutorTurns || 0),
        performanceScore: accuracy,
        activityScore: quizzes * 10 + answered * 2,
      },
      attempts: stats.attempts.slice(0, 25).map((a) => ({
        id: a.id,
        mode: a.mode,
        chapter_number: a.chapter_number,
        chapter_title: a.chapter_number ? chapterMap.get(a.chapter_number) || `Chapter ${a.chapter_number}` : null,
        total_questions: a.total_questions,
        correct_count: a.correct_count,
        score_percent: a.score_percent,
        created_at: a.created_at,
      })),
    };
  }

  if (pathname === '/api/admin/search' && method === 'GET') {
    if (!isPrivilegedCachedUser()) {
      throw new StaticFallbackHttpError('Administrator privileges required.', 403);
    }
    const q = String(search.get('q') || '').trim().toLowerCase();
    const lang = normalizeLang(search.get('lang'));
    const chapterMap = getChapterTitleMap(lang);
    const { users } = await buildMergedAccountsRegistry();
    const students = users
      .filter((u) => u.role === 'student' && !u.isAdmin)
      .filter((u) => !q || `${u.name} ${u.email} ${u.grade}`.toLowerCase().includes(q))
      .slice(0, 20)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        grade: u.grade,
        avatar_url: u.avatar_url || '',
        online: Boolean(u.online),
        currentSection: u.currentSection || '',
        lastActiveAt: u.lastActiveAt || '',
        quizzesCompleted: Number(u.quizzesCompleted || 0),
        questionsAnswered: Number(u.questionsAnswered || 0),
        correctAnswers: Number(u.correctAnswers || 0),
        accuracyPercent: Number(u.avgScorePercent || 0),
        avgScorePercent: Number(u.avgScorePercent || 0),
        bestScorePercent: Number(u.avgScorePercent || 0),
        teacherMessagesCount: 0,
        aiTutorTurns: 0,
        performanceScore: 0,
        activityScore: 0,
      }));
    const chapters = snapshot.chapters
      .map((c) => localizeChapter(c, lang, 0))
      .filter((c) => !q || `${c.title} ${c.description}`.toLowerCase().includes(q));
    const questions = snapshot.questions
      .filter((item) => !q || `${item.question_text} ${item.question_text_ku || ''} ${item.question_text_ar || ''}`.toLowerCase().includes(q))
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        scope: item.scope,
        chapter_number: item.chapter_number,
        chapter_title: item.chapter_number ? chapterMap.get(item.chapter_number) || `Chapter ${item.chapter_number}` : null,
        question_text: localizeQuestionFields(item, lang, chapterMap).questionText,
        correct_option: item.correct_option,
      }));
    return { students, questions, chapters, messages: [] };
  }

  if (pathname === '/api/admin/community/overview' && method === 'GET') {
    const store = getStaticCommunityStore();
    const { users } = await buildMergedAccountsRegistry();
    return {
      overview: {
        postsCount: store.posts.length,
        commentsCount: store.posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0),
        reactionsCount: store.posts.reduce((sum, p) => sum + (p.totalReactions || 0), 0),
        dmCount: store.dms.length,
        groupCount: store.groups.length,
        groupMsgCount: Object.values(store.groupMessages).reduce((sum, arr) => sum + arr.length, 0),
        openReportsCount: 0,
        restrictedCount: users.filter((u) => u.isRestricted).length,
      },
    };
  }
  if (pathname === '/api/admin/community/reports' && method === 'GET') {
    return { reports: [] };
  }
  if (pathname === '/api/admin/community/dms' && method === 'GET') {
    return { conversations: [] };
  }
  if (pathname === '/api/admin/activity' && method === 'GET') {
    return { logs: [] };
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
