import {
  getRedirectResult,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { AppSettings, User } from '../types';
import {
  applyFirebaseAuthPersistence,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';

export const MAIN_ADMIN_EMAIL = 'mohamdm791@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const PEER_ONLINE_TTL_MS = 90_000;

export interface CloudUserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  grade: string;
  bio: string;
  birthday: string;
  avatarUrl: string;
  notificationsEnabled: boolean;
  notifPromptStatus: '' | 'allowed' | 'denied';
  totalPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  isRestricted?: boolean;
  restrictionReason?: string;
  lastLoginAt?: string;
  lastActiveAt?: string;
}

export interface CloudQuizAttemptInput {
  mode: 'all_chapters' | 'chapter' | 'general';
  chapterNumber: number | null;
  totalQuestions: number;
  correctCount: number;
  scorePercent: number;
  pointsAwarded: number;
}

export interface SchoolAccountMirrorRow {
  accountKey?: string;
  email: string;
  name: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  passwordHash: string;
  grade: string;
  bio: string;
  birthday: string;
  avatarUrl: string;
  notifPromptStatus: '' | 'allowed' | 'denied';
  notificationsEnabled: boolean;
  createdAtIso: string;
}

export interface CloudPeerPresence {
  uid: string;
  numericId: number;
  name: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  grade: string;
  avatarUrl: string;
  bio: string;
  online: boolean;
  currentSection: string;
  isRestricted: boolean;
  lastActiveAtIso: string;
}

export interface CloudRegisteredAccount {
  uid?: string;
  accountKey?: string;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  grade: string;
  bio: string;
  birthday: string;
  avatarUrl: string;
  isRestricted: boolean;
  restrictionReason: string;
  totalPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
  lastLoginAt: string;
  lastActiveAt: string;
  createdAtIso: string;
}

function clampStr(raw: unknown, maxLen: number): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeAvatarForFirestore(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return '';
  if (s.length > 200000) return '';
  return s;
}

function sanitizeNotifStatus(raw: unknown): '' | 'allowed' | 'denied' {
  if (raw === 'allowed' || raw === 'denied') return raw;
  return '';
}

function clampNonNegInt(raw: unknown, maxVal: number): number {
  const n = Math.round(Number(raw) || 0);
  if (n < 0) return 0;
  return n > maxVal ? maxVal : n;
}

function stableNumericId(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (Math.abs(hash) % 900000000) + 100000;
}

function toIsoFromTimestampOrString(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate: () => Date }).toDate === 'function') {
    try {
      return (raw as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return '';
    }
  }
  return '';
}

export async function sha256AccountKey(email: string): Promise<string> {
  const norm = email.trim().toLowerCase();
  const data = new TextEncoder().encode(norm);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `acct_${hex.slice(0, 48)}`;
}

export interface SocialAuthIdentity {
  idToken: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
}

function isTrustedCloudAuthUser(fbUser: FirebaseUser | null): fbUser is FirebaseUser {
  return Boolean(fbUser && fbUser.emailVerified);
}

async function isCurrentUserCloudAdmin(): Promise<boolean> {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.emailVerified) return false;
  if ((fbUser.email || '').trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
    await ensureMainAdminRegistryDoc().catch(() => {});
    return true;
  }
  if (!VALID_ID_REGEX.test(fbUser.uid)) return false;
  try {
    const adminDoc = await getDoc(doc(db, 'admins', fbUser.uid));
    return adminDoc.exists();
  } catch {
    return false;
  }
}

async function formatFirebaseSocialIdentity(fbUser: FirebaseUser): Promise<SocialAuthIdentity> {
  const idToken = await fbUser.getIdToken();
  return {
    idToken,
    uid: fbUser.uid,
    email: (fbUser.email || '').trim().toLowerCase(),
    displayName: (fbUser.displayName || '').trim(),
    photoUrl: (fbUser.photoURL || '').trim(),
  };
}

export async function signInWithGoogleCloud(rememberMe = true): Promise<SocialAuthIdentity> {
  await applyFirebaseAuthPersistence(rememberMe);
  const cred = await signInWithPopup(auth, googleProvider);
  return formatFirebaseSocialIdentity(cred.user);
}

export async function consumePendingRedirectSignIn(): Promise<SocialAuthIdentity | null> {
  try {
    const res = await getRedirectResult(auth);
    if (!res?.user) return null;
    return formatFirebaseSocialIdentity(res.user);
  } catch {
    return null;
  }
}

export async function signOutFirebaseCloud(): Promise<void> {
  try {
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    }
  } catch {
    // ignore sign-out error
  }
}

export async function ensureMainAdminRegistryDoc(): Promise<void> {
  const fbUser = auth.currentUser;
  if (
    !fbUser ||
    !fbUser.emailVerified ||
    (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL
  ) {
    return;
  }
  const path = `admins/${fbUser.uid}`;
  try {
    const ref = doc(db, 'admins', fbUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        email: MAIN_ADMIN_EMAIL,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncAdminRegistryEntry(
  targetUid: string,
  targetEmail: string,
  grantAdmin: boolean
): Promise<void> {
  const fbUser = auth.currentUser;
  if (
    !fbUser ||
    !fbUser.emailVerified ||
    (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL
  ) {
    return;
  }
  const cleanUid = clampStr(targetUid, 128);
  const cleanEmail = clampStr(targetEmail, 180).toLowerCase();
  if (!VALID_ID_REGEX.test(cleanUid) || !cleanEmail || cleanEmail === MAIN_ADMIN_EMAIL) return;

  try {
    const ref = doc(db, 'admins', cleanUid);
    if (grantAdmin) {
      await setDoc(ref, {
        uid: cleanUid,
        email: cleanEmail,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(ref).catch(() => {});
    }
  } catch {
    // non-fatal admin allowlist sync
  }
}

export async function pullCloudUserProfile(uid: string): Promise<{
  profile: CloudUserProfile | null;
  attempts: CloudQuizAttemptInput[];
}> {
  if (!VALID_ID_REGEX.test(uid)) {
    return { profile: null, attempts: [] };
  }
  if (auth.currentUser && auth.currentUser.uid === uid && !isTrustedCloudAuthUser(auth.currentUser)) {
    return { profile: null, attempts: [] };
  }
  const userPath = `users/${uid}`;
  let profile: CloudUserProfile | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const d = snap.data();
      profile = {
        uid: String(d.uid || uid),
        name: clampStr(d.name || 'Grade 9 User', 120),
        email: clampStr(d.email || '', 180).toLowerCase(),
        role: d.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: Boolean(d.isAdmin),
        grade: clampStr(d.grade || '', 40),
        bio: clampStr(d.bio || '', 500),
        birthday: clampStr(d.birthday || '', 20),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        notificationsEnabled: d.notificationsEnabled !== false,
        notifPromptStatus: sanitizeNotifStatus(d.notifPromptStatus),
        totalPoints: clampNonNegInt(d.totalPoints, 1000000),
        quizzesCompleted: clampNonNegInt(d.quizzesCompleted, 100000),
        correctAnswers: clampNonNegInt(d.correctAnswers, 1000000),
        isRestricted: Boolean(d.isRestricted),
        restrictionReason: clampStr(d.restrictionReason || '', 300),
        lastLoginAt: clampStr(d.lastLoginAt || '', 64),
        lastActiveAt: clampStr(d.lastActiveAt || '', 64),
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  const attempts: CloudQuizAttemptInput[] = [];
  if (profile) {
    const attemptsPath = `users/${uid}/quiz_attempts`;
    try {
      const q = query(
        collection(db, 'users', uid, 'quiz_attempts'),
        where('userId', '==', uid)
      );
      const snaps = await getDocs(q);
      snaps.forEach((docSnap) => {
        const d = docSnap.data();
        const mode =
          d.mode === 'all_chapters' || d.mode === 'general' ? d.mode : 'chapter';
        const ch = Number(d.chapterNumber || 0);
        attempts.push({
          mode,
          chapterNumber: ch >= 1 && ch <= 11 ? ch : null,
          totalQuestions: clampNonNegInt(d.totalQuestions, 500),
          correctCount: clampNonNegInt(d.correctCount, 500),
          scorePercent: Math.max(0, Math.min(100, Number(d.scorePercent || 0))),
          pointsAwarded: clampNonNegInt(d.pointsAwarded, 1000),
        });
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, attemptsPath);
    }
  }

  return { profile, attempts };
}

export async function syncCloudPeerPresence(
  appUser: User | null | undefined,
  online: boolean,
  section = 'home'
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid) || !appUser) return;

  const isMainAdmin =
    (fbUser.email || '').trim().toLowerCase() === MAIN_ADMIN_EMAIL;
  const safeName =
    clampStr(appUser.name || fbUser.displayName || 'Grade 9 Student', 120) ||
    'Grade 9 Student';
  const validName = safeName.length >= 2 ? safeName : 'Grade 9 Student';
  const safeRole: 'student' | 'teacher' =
    isMainAdmin || appUser.role === 'teacher' ? 'teacher' : 'student';
  const safeAdmin = isMainAdmin || Boolean(appUser.isAdmin);
  const nowIso = new Date().toISOString();
  const ref = doc(db, 'peer_presence', fbUser.uid);

  try {
    const existing = await getDoc(ref).catch(() => null);
    const basePayload = {
      numericId: appUser.id || stableNumericId(fbUser.uid),
      name: validName,
      grade: clampStr(appUser.grade || '', 40),
      avatarUrl: sanitizeAvatarForFirestore(appUser.avatar_url),
      bio: clampStr(appUser.bio || '', 500),
      online: Boolean(online),
      currentSection: clampStr(online ? section : '', 40),
      lastActiveAtIso: nowIso,
      updatedAt: serverTimestamp(),
    };

    if (!existing || !existing.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        role: isMainAdmin ? 'teacher' : 'student',
        isAdmin: isMainAdmin,
        isRestricted: false,
        ...basePayload,
      });
    } else {
      const existingData = existing.data();
      const canUpdatePrivilege = await isCurrentUserCloudAdmin().catch(() => false);
      if (canUpdatePrivilege) {
        await setDoc(
          ref,
          {
            role: safeRole,
            isAdmin: safeAdmin,
            isRestricted: !isMainAdmin && Boolean(appUser.isRestricted),
            ...basePayload,
          },
          { merge: true }
        );
      } else {
        await setDoc(
          ref,
          {
            ...basePayload,
            role: existingData.role === 'teacher' ? 'teacher' : 'student',
            isAdmin: Boolean(existingData.isAdmin),
          },
          { merge: true }
        );
      }
    }
  } catch {
    // Non-fatal cloud presence update
  }
}

export async function pullAllPeerPresence(): Promise<CloudPeerPresence[]> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser)) {
    return [];
  }
  try {
    const q = query(
      collection(db, 'peer_presence'),
      where('role', 'in', ['student', 'teacher'])
    );
    const snaps = await getDocs(q);
    const now = Date.now();
    const list: CloudPeerPresence[] = [];
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      const updatedIso =
        toIsoFromTimestampOrString(d.updatedAt) || clampStr(d.lastActiveAtIso || '', 64);
      const updatedMs = updatedIso ? Date.parse(updatedIso) : 0;
      const isFresh = Number.isFinite(updatedMs) && updatedMs > 0 && now - updatedMs <= PEER_ONLINE_TTL_MS;
      const uid = clampStr(d.uid || docSnap.id, 128);
      if (!uid) return;
      list.push({
        uid,
        numericId: Number(d.numericId) || stableNumericId(uid),
        name: clampStr(d.name || 'Grade 9 Student', 120) || 'Grade 9 Student',
        role: d.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: Boolean(d.isAdmin),
        grade: clampStr(d.grade || '', 40),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        bio: clampStr(d.bio || '', 500),
        online: Boolean(d.online) && isFresh,
        currentSection: Boolean(d.online) && isFresh ? clampStr(d.currentSection || 'home', 40) : '',
        isRestricted: Boolean(d.isRestricted),
        lastActiveAtIso: clampStr(d.lastActiveAtIso || updatedIso, 64),
      });
    });
    return list;
  } catch {
    return [];
  }
}

export async function syncCurrentUserToFirestore(
  appUser: User,
  stats?: { totalPoints?: number; quizzesCompleted?: number; correctAnswers?: number }
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !fbUser.email) return;
  if (fbUser.email.trim().toLowerCase() !== appUser.email.trim().toLowerCase()) return;
  if (!VALID_ID_REGEX.test(fbUser.uid)) return;

  const isMainAdmin = fbUser.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
  if (isMainAdmin) {
    await ensureMainAdminRegistryDoc();
  }

  const safeName = clampStr(appUser.name || fbUser.displayName || 'Grade 9 User', 120);
  const safeValidName = safeName.length >= 2 ? safeName : 'Grade 9 User';
  const safeGrade = clampStr(appUser.grade || '', 40);
  const safeBio = clampStr(appUser.bio || '', 500);
  const safeBirthday = clampStr(appUser.birthday || '', 20);
  const safeAvatar = sanitizeAvatarForFirestore(appUser.avatar_url);
  const safeNotifEnabled = appUser.notifications_enabled !== false;
  const safeNotifPrompt = sanitizeNotifStatus(appUser.notif_prompt_status);
  const nowIso = new Date().toISOString();

  const userPath = `users/${fbUser.uid}`;
  const userRef = doc(db, 'users', fbUser.uid);

  let existingPoints = 0;
  let existingQuizzes = 0;
  let existingCorrect = 0;
  let docExists = false;

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      docExists = true;
      const d = snap.data();
      existingPoints = clampNonNegInt(d.totalPoints, 1000000);
      existingQuizzes = clampNonNegInt(d.quizzesCompleted, 100000);
      existingCorrect = clampNonNegInt(d.correctAnswers, 1000000);
    } else if (!isMainAdmin) {
      const revoked = await isCurrentUserCloudRevoked(fbUser.email, fbUser.uid).catch(() => false);
      if (revoked) {
        return;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  const nextPoints = Math.max(existingPoints, clampNonNegInt(stats?.totalPoints, 1000000));
  const nextQuizzes = Math.max(existingQuizzes, clampNonNegInt(stats?.quizzesCompleted, 100000));
  const nextCorrect = Math.max(existingCorrect, clampNonNegInt(stats?.correctAnswers, 1000000));

  try {
    if (!docExists) {
      await setDoc(userRef, {
        uid: fbUser.uid,
        name: safeValidName,
        email: fbUser.email.trim(),
        role: isMainAdmin ? 'teacher' : 'student',
        isAdmin: isMainAdmin,
        grade: safeGrade,
        bio: safeBio,
        birthday: safeBirthday,
        avatarUrl: safeAvatar,
        notificationsEnabled: safeNotifEnabled,
        notifPromptStatus: safeNotifPrompt,
        totalPoints: nextPoints,
        quizzesCompleted: nextQuizzes,
        correctAnswers: nextCorrect,
        isRestricted: false,
        restrictionReason: '',
        lastLoginAt: clampStr(appUser.lastLoginAt || nowIso, 64),
        lastActiveAt: nowIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        userRef,
        {
          name: safeValidName,
          grade: safeGrade,
          bio: safeBio,
          birthday: safeBirthday,
          avatarUrl: safeAvatar,
          notificationsEnabled: safeNotifEnabled,
          notifPromptStatus: safeNotifPrompt,
          totalPoints: nextPoints,
          quizzesCompleted: nextQuizzes,
          correctAnswers: nextCorrect,
          lastLoginAt: clampStr(appUser.lastLoginAt || nowIso, 64),
          lastActiveAt: nowIso,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, docExists ? OperationType.UPDATE : OperationType.CREATE, userPath);
  }

  if (!isMainAdmin && appUser.role === 'student') {
    const lbPath = `leaderboard_entries/${fbUser.uid}`;
    const lbRef = doc(db, 'leaderboard_entries', fbUser.uid);
    try {
      const lbSnap = await getDoc(lbRef);
      if (!lbSnap.exists()) {
        await setDoc(lbRef, {
          uid: fbUser.uid,
          name: safeValidName,
          grade: safeGrade,
          avatarUrl: safeAvatar,
          role: 'student',
          totalPoints: nextPoints,
          quizzesCompleted: nextQuizzes,
          correctAnswers: nextCorrect,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          lbRef,
          {
            name: safeValidName,
            grade: safeGrade,
            avatarUrl: safeAvatar,
            totalPoints: nextPoints,
            quizzesCompleted: nextQuizzes,
            correctAnswers: nextCorrect,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, lbPath);
    }
  }

  await syncCloudPeerPresence(appUser, true, 'home').catch(() => {});
}

export async function recordQuizAttemptToCloud(
  attempt: CloudQuizAttemptInput,
  updatedStats?: { totalPoints?: number; quizzesCompleted?: number; correctAnswers?: number },
  appUser?: User | null
): Promise<void> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !fbUser.email || !VALID_ID_REGEX.test(fbUser.uid)) return;

  const attemptId = `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `users/${fbUser.uid}/quiz_attempts/${attemptId}`;
  try {
    await setDoc(doc(db, 'users', fbUser.uid, 'quiz_attempts', attemptId), {
      userId: fbUser.uid,
      mode: attempt.mode,
      chapterNumber:
        attempt.chapterNumber && attempt.chapterNumber >= 1 && attempt.chapterNumber <= 11
          ? attempt.chapterNumber
          : 0,
      totalQuestions: clampNonNegInt(attempt.totalQuestions, 500),
      correctCount: clampNonNegInt(attempt.correctCount, 500),
      scorePercent: Math.max(0, Math.min(100, Number(attempt.scorePercent || 0))),
      pointsAwarded: clampNonNegInt(attempt.pointsAwarded, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  if (appUser) {
    await syncCurrentUserToFirestore(appUser, updatedStats);
  }
}

export async function pullAllSchoolAccountsAsAdmin(): Promise<SchoolAccountMirrorRow[]> {
  if (!(await isCurrentUserCloudAdmin())) {
    return [];
  }

  const results: SchoolAccountMirrorRow[] = [];
  const path = 'school_accounts';
  try {
    const q = query(
      collection(db, 'school_accounts'),
      where('role', 'in', ['student', 'teacher'])
    );
    const snaps = await getDocs(q);
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      const email = clampStr(d.email, 180).toLowerCase();
      const passwordHash = clampStr(d.passwordHash, 200);
      if (!email || !passwordHash) return;
      results.push({
        accountKey: clampStr(d.accountKey, 128),
        email,
        name: clampStr(d.name || 'Grade 9 Student', 120),
        role: d.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: Boolean(d.isAdmin),
        passwordHash,
        grade: clampStr(d.grade || '', 40),
        bio: clampStr(d.bio || '', 500),
        birthday: clampStr(d.birthday || '', 20),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        notifPromptStatus: sanitizeNotifStatus(d.notifPromptStatus),
        notificationsEnabled: d.notificationsEnabled !== false,
        createdAtIso: clampStr(d.createdAtIso || '', 64),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
  return results;
}

export async function fetchCloudRegisteredUsersAsAdmin(): Promise<CloudRegisteredAccount[]> {
  if (!(await isCurrentUserCloudAdmin())) {
    return [];
  }

  const byEmail = new Map<string, CloudRegisteredAccount>();

  try {
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['student', 'teacher'])
    );
    const snaps = await getDocs(q);
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      const email = clampStr(d.email, 180).toLowerCase();
      if (!email) return;
      const isMain = email === MAIN_ADMIN_EMAIL;
      byEmail.set(email, {
        uid: clampStr(d.uid || docSnap.id, 128),
        name: clampStr(d.name || 'Grade 9 Student', 120) || 'Grade 9 Student',
        email,
        role: isMain || d.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: isMain || Boolean(d.isAdmin),
        grade: clampStr(d.grade || '', 40),
        bio: clampStr(d.bio || '', 500),
        birthday: clampStr(d.birthday || '', 20),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        isRestricted: !isMain && Boolean(d.isRestricted),
        restrictionReason: clampStr(d.restrictionReason || '', 300),
        totalPoints: clampNonNegInt(d.totalPoints, 1000000),
        quizzesCompleted: clampNonNegInt(d.quizzesCompleted, 100000),
        correctAnswers: clampNonNegInt(d.correctAnswers, 1000000),
        lastLoginAt: clampStr(d.lastLoginAt || '', 64),
        lastActiveAt:
          clampStr(d.lastActiveAt || '', 64) || toIsoFromTimestampOrString(d.updatedAt),
        createdAtIso: toIsoFromTimestampOrString(d.createdAt) || new Date().toISOString(),
      });
    });
  } catch {
    // Non-fatal /users read; continue checking school_accounts
  }

  try {
    const q = query(
      collection(db, 'school_accounts'),
      where('role', 'in', ['student', 'teacher'])
    );
    const snaps = await getDocs(q);
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      const email = clampStr(d.email, 180).toLowerCase();
      if (!email) return;
      const isMain = email === MAIN_ADMIN_EMAIL;
      const existing = byEmail.get(email);
      if (existing) {
        existing.accountKey = clampStr(d.accountKey || docSnap.id, 128);
        if (!existing.grade && d.grade) existing.grade = clampStr(d.grade, 40);
        if (!existing.bio && d.bio) existing.bio = clampStr(d.bio, 500);
        if (!existing.birthday && d.birthday) existing.birthday = clampStr(d.birthday, 20);
        if (!existing.avatarUrl && d.avatarUrl) {
          existing.avatarUrl = sanitizeAvatarForFirestore(d.avatarUrl);
        }
        return;
      }
      byEmail.set(email, {
        accountKey: clampStr(d.accountKey || docSnap.id, 128),
        name: clampStr(d.name || 'Grade 9 Student', 120) || 'Grade 9 Student',
        email,
        role: isMain || d.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: isMain || Boolean(d.isAdmin),
        grade: clampStr(d.grade || '', 40),
        bio: clampStr(d.bio || '', 500),
        birthday: clampStr(d.birthday || '', 20),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        isRestricted: false,
        restrictionReason: '',
        totalPoints: 0,
        quizzesCompleted: 0,
        correctAnswers: 0,
        lastLoginAt: '',
        lastActiveAt: toIsoFromTimestampOrString(d.updatedAt),
        createdAtIso: clampStr(d.createdAtIso || '', 64) || new Date().toISOString(),
      });
    });
  } catch {
    // Non-fatal /school_accounts read
  }

  return Array.from(byEmail.values());
}

export async function updateCloudUserAsAdmin(params: {
  email: string;
  uid?: string;
  name?: string;
  grade?: string;
  bio?: string;
  birthday?: string;
  role?: 'student' | 'teacher';
  isAdmin?: boolean;
  isRestricted?: boolean;
  restrictionReason?: string;
}): Promise<void> {
  if (!(await isCurrentUserCloudAdmin())) return;
  const email = clampStr(params.email, 180).toLowerCase();
  const isMain = email === MAIN_ADMIN_EMAIL;

  let targetUid = clampStr(params.uid || '', 128);
  if (!targetUid && email) {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['student', 'teacher'])
      );
      const snaps = await getDocs(q);
      snaps.forEach((docSnap) => {
        const d = docSnap.data();
        if (String(d.email || '').trim().toLowerCase() === email) {
          targetUid = String(d.uid || docSnap.id);
        }
      });
    } catch {
      // ignore lookup error
    }
  }

  if (targetUid && VALID_ID_REGEX.test(targetUid)) {
    try {
      const userRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const d = snap.data();
        const nextRole: 'student' | 'teacher' = isMain
          ? 'teacher'
          : params.role || (d.role === 'teacher' ? 'teacher' : 'student');
        const nextAdmin = isMain
          ? true
          : params.isAdmin !== undefined
          ? Boolean(params.isAdmin)
          : nextRole === 'teacher';
        const nextName =
          clampStr(params.name !== undefined ? params.name : d.name, 120) || 'Grade 9 Student';
        const validName = nextName.length >= 2 ? nextName : 'Grade 9 Student';
        await setDoc(
          userRef,
          {
            name: validName,
            grade: clampStr(params.grade !== undefined ? params.grade : d.grade, 40),
            bio: clampStr(params.bio !== undefined ? params.bio : d.bio, 500),
            birthday: clampStr(params.birthday !== undefined ? params.birthday : d.birthday, 20),
            role: nextRole,
            isAdmin: nextAdmin,
            isRestricted: isMain
              ? false
              : params.isRestricted !== undefined
              ? Boolean(params.isRestricted)
              : Boolean(d.isRestricted),
            restrictionReason: isMain
              ? ''
              : clampStr(
                  params.restrictionReason !== undefined
                    ? params.restrictionReason
                    : d.restrictionReason,
                  300
                ),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await syncAdminRegistryEntry(targetUid, email, nextRole === 'teacher' && nextAdmin);

        const presenceRef = doc(db, 'peer_presence', targetUid);
        const presSnap = await getDoc(presenceRef).catch(() => null);
        if (presSnap && presSnap.exists()) {
          await setDoc(
            presenceRef,
            {
              name: validName,
              grade: clampStr(params.grade !== undefined ? params.grade : d.grade, 40),
              bio: clampStr(params.bio !== undefined ? params.bio : d.bio, 500),
              role: nextRole,
              isAdmin: nextAdmin,
              isRestricted: isMain
                ? false
                : params.isRestricted !== undefined
                ? Boolean(params.isRestricted)
                : Boolean(d.isRestricted),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        }
      }
    } catch {
      // ignore non-fatal /users admin update error
    }
  }

  if (email) {
    try {
      const accountKey = await sha256AccountKey(email);
      const acctRef = doc(db, 'school_accounts', accountKey);
      const acctSnap = await getDoc(acctRef);
      if (acctSnap.exists()) {
        const d = acctSnap.data();
        const nextRole: 'student' | 'teacher' = isMain
          ? 'teacher'
          : params.role || (d.role === 'teacher' ? 'teacher' : 'student');
        const nextAdmin = isMain
          ? true
          : params.isAdmin !== undefined
          ? Boolean(params.isAdmin)
          : nextRole === 'teacher';
        await setDoc(
          acctRef,
          {
            name: clampStr(params.name !== undefined ? params.name : d.name, 120) || 'Grade 9 Student',
            grade: clampStr(params.grade !== undefined ? params.grade : d.grade, 40),
            bio: clampStr(params.bio !== undefined ? params.bio : d.bio, 500),
            birthday: clampStr(params.birthday !== undefined ? params.birthday : d.birthday, 20),
            role: nextRole,
            isAdmin: nextAdmin,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch {
      // ignore non-fatal /school_accounts admin update error
    }
  }
}

export async function deleteCloudUserAsAdmin(email: string, uid?: string): Promise<void> {
  if (!(await isCurrentUserCloudAdmin())) return;
  const normalized = clampStr(email, 180).toLowerCase();
  if (!normalized || normalized === MAIN_ADMIN_EMAIL) return;

  let targetUid = clampStr(uid || '', 128);
  if (!targetUid) {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['student', 'teacher'])
      );
      const snaps = await getDocs(q);
      snaps.forEach((docSnap) => {
        const d = docSnap.data();
        if (String(d.email || '').trim().toLowerCase() === normalized) {
          targetUid = String(d.uid || docSnap.id);
        }
      });
    } catch {
      // ignore lookup error
    }
  }

  // Write revocation tombstones first so active sessions on other devices sign out immediately
  await writeCloudAccountRevocation(normalized, targetUid, 'account_deleted').catch(() => {});

  if (targetUid && VALID_ID_REGEX.test(targetUid)) {
    const q = query(
      collection(db, 'users', targetUid, 'quiz_attempts'),
      where('userId', '==', targetUid)
    );
    const attemptSnaps = await getDocs(q).catch(() => null);
    if (attemptSnaps) {
      for (const snap of attemptSnaps.docs) {
        await deleteDoc(snap.ref).catch(() => {});
      }
    }
    await deleteDoc(doc(db, 'leaderboard_entries', targetUid)).catch(() => {});
    await deleteDoc(doc(db, 'peer_presence', targetUid)).catch(() => {});
    await syncAdminRegistryEntry(targetUid, normalized, false).catch(() => {});
    await deleteDoc(doc(db, 'users', targetUid)).catch(() => {});
  }

  await deleteSchoolAccountMirrorByEmail(normalized).catch(() => {});
}

export async function pushSchoolAccountsAsAdmin(
  accounts: SchoolAccountMirrorRow[]
): Promise<number> {
  if (!(await isCurrentUserCloudAdmin())) {
    return 0;
  }

  let synced = 0;
  for (const acct of accounts) {
    const email = clampStr(acct.email, 180).toLowerCase();
    const passwordHash = clampStr(acct.passwordHash, 200);
    if (!email || !passwordHash) continue;

    const accountKey = await sha256AccountKey(email);
    const path = `school_accounts/${accountKey}`;
    const ref = doc(db, 'school_accounts', accountKey);

    try {
      const existingSnap = await getDoc(ref);
      const safeName = clampStr(acct.name || 'Grade 9 Student', 120) || 'Grade 9 Student';
      const payload = {
        name: safeName,
        role: acct.role === 'teacher' ? 'teacher' : 'student',
        isAdmin: Boolean(acct.isAdmin),
        passwordHash,
        grade: clampStr(acct.grade || '', 40),
        bio: clampStr(acct.bio || '', 500),
        birthday: clampStr(acct.birthday || '', 20),
        avatarUrl: sanitizeAvatarForFirestore(acct.avatarUrl),
        notifPromptStatus: sanitizeNotifStatus(acct.notifPromptStatus),
        notificationsEnabled: acct.notificationsEnabled !== false,
        createdAtIso: clampStr(acct.createdAtIso || '', 64),
        updatedAt: serverTimestamp(),
      };

      if (!existingSnap.exists()) {
        await setDoc(ref, {
          accountKey,
          email,
          ...payload,
        });
      } else {
        await setDoc(ref, payload, { merge: true });
      }
      synced += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
  return synced;
}

export interface CloudLeaderboardRow {
  uid: string;
  name: string;
  grade: string;
  avatarUrl: string;
  totalPoints: number;
  quizzesCompleted: number;
  correctAnswers: number;
}

export async function fetchFirestoreLeaderboard(): Promise<CloudLeaderboardRow[]> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser)) {
    return [];
  }
  try {
    const q = query(
      collection(db, 'leaderboard_entries'),
      where('role', '==', 'student')
    );
    const snaps = await getDocs(q);
    const rows: CloudLeaderboardRow[] = [];
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      rows.push({
        uid: String(d.uid || docSnap.id),
        name: clampStr(d.name || 'Grade 9 Student', 120) || 'Grade 9 Student',
        grade: clampStr(d.grade || '', 40),
        avatarUrl: sanitizeAvatarForFirestore(d.avatarUrl),
        totalPoints: clampNonNegInt(d.totalPoints, 1000000),
        quizzesCompleted: clampNonNegInt(d.quizzesCompleted, 100000),
        correctAnswers: clampNonNegInt(d.correctAnswers, 1000000),
      });
    });
    return rows;
  } catch {
    return [];
  }
}

export async function fetchCloudAppSettings(): Promise<AppSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'app_settings', 'global'));
    if (!snap.exists()) return null;
    const d = snap.data();
    const lang = d.defaultLanguage === 'ku' || d.defaultLanguage === 'ar' ? d.defaultLanguage : 'en';
    return {
      allowStudentRegistration: d.allowStudentRegistration !== false,
      communityEnabled: d.communityEnabled !== false,
      communityPostingEnabled: d.communityPostingEnabled !== false,
      aiTutorEnabled: d.aiTutorEnabled !== false,
      defaultLanguage: lang,
      maintenanceMessage: clampStr(d.maintenanceMessage || '', 300),
      updatedAt: toIsoFromTimestampOrString(d.updatedAt),
    };
  } catch {
    return null;
  }
}

export async function saveCloudAppSettings(settings: AppSettings): Promise<boolean> {
  if (!(await isCurrentUserCloudAdmin())) return false;
  try {
    await setDoc(doc(db, 'app_settings', 'global'), {
      settingId: 'global',
      scope: 'public',
      allowStudentRegistration: Boolean(settings.allowStudentRegistration),
      communityEnabled: Boolean(settings.communityEnabled),
      communityPostingEnabled: Boolean(settings.communityPostingEnabled),
      aiTutorEnabled: Boolean(settings.aiTutorEnabled),
      defaultLanguage:
        settings.defaultLanguage === 'ku' || settings.defaultLanguage === 'ar'
          ? settings.defaultLanguage
          : 'en',
      maintenanceMessage: clampStr(settings.maintenanceMessage || '', 300),
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function deleteOwnCloudAccountData(expectedEmail?: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!fbUser || !VALID_ID_REGEX.test(fbUser.uid)) return;
  if (
    expectedEmail &&
    fbUser.email &&
    fbUser.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
  ) {
    return;
  }

  try {
    const q = query(
      collection(db, 'users', fbUser.uid, 'quiz_attempts'),
      where('userId', '==', fbUser.uid)
    );
    const attemptSnaps = await getDocs(q).catch(() => null);
    if (attemptSnaps) {
      for (const snap of attemptSnaps.docs) {
        await deleteDoc(snap.ref).catch(() => {});
      }
    }
    await deleteDoc(doc(db, 'leaderboard_entries', fbUser.uid)).catch(() => {});
    await deleteDoc(doc(db, 'peer_presence', fbUser.uid)).catch(() => {});
    await deleteDoc(doc(db, 'users', fbUser.uid)).catch(() => {});
    await fbUser.delete().catch(() => {});
  } catch {
    // Non-fatal cleanup when offline or requiring recent login
  }
}

export async function deleteSchoolAccountMirrorByEmail(email: string): Promise<void> {
  if (!(await isCurrentUserCloudAdmin())) {
    return;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized === MAIN_ADMIN_EMAIL) return;
  try {
    const accountKey = await sha256AccountKey(normalized);
    await deleteDoc(doc(db, 'school_accounts', accountKey));
  } catch {
    // Ignore non-fatal cloud mirror cleanup failure
  }
}

// ---------------- ACCOUNT REVOCATION (CROSS-DEVICE IMMEDIATE LOGOUT) ----------------
const LOGIN_TS_STORAGE_KEY = 'grade9hub_login_ts';

export function recordFreshLoginTimestamp(ts: number = Date.now()): void {
  try {
    if (typeof window !== 'undefined') {
      const val = String(ts);
      window.localStorage.setItem(LOGIN_TS_STORAGE_KEY, val);
      window.sessionStorage.setItem(LOGIN_TS_STORAGE_KEY, val);
    }
  } catch {
    // ignore storage errors
  }
}

export function getFreshLoginTimestamp(): number {
  try {
    if (typeof window === 'undefined') return 0;
    const raw =
      window.localStorage.getItem(LOGIN_TS_STORAGE_KEY) ||
      window.sessionStorage.getItem(LOGIN_TS_STORAGE_KEY);
    const num = Number(raw || 0);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

function toMsFromFirestoreTimestamp(raw: unknown): number {
  const iso = toIsoFromTimestampOrString(raw);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function writeCloudAccountRevocation(
  email: string,
  targetUid?: string,
  reason: 'account_deleted' | 'account_disabled' = 'account_deleted'
): Promise<void> {
  if (!(await isCurrentUserCloudAdmin())) return;
  const normalized = clampStr(email, 180).toLowerCase();
  if (!normalized || normalized === MAIN_ADMIN_EMAIL) return;

  const accountKey = await sha256AccountKey(normalized);
  const cleanUid = clampStr(targetUid || '', 128);
  const hasValidUid = Boolean(cleanUid && VALID_ID_REGEX.test(cleanUid));

  try {
    await setDoc(doc(db, 'account_revocations', accountKey), {
      revocationKey: accountKey,
      accountKey,
      ...(hasValidUid ? { targetUid: cleanUid } : {}),
      reason,
      revokedAt: serverTimestamp(),
    });
  } catch {
    // non-fatal revocation tombstone write
  }

  if (hasValidUid) {
    const uidKey = `uid_${cleanUid}`;
    if (VALID_ID_REGEX.test(uidKey)) {
      try {
        await setDoc(doc(db, 'account_revocations', uidKey), {
          revocationKey: uidKey,
          targetUid: cleanUid,
          accountKey,
          reason,
          revokedAt: serverTimestamp(),
        });
      } catch {
        // non-fatal revocation tombstone write
      }
    }
  }
}

async function evaluateRevocationStatus(
  revokedAtMs: number,
  uid?: string
): Promise<boolean> {
  const loginTs = getFreshLoginTimestamp();
  if (uid && VALID_ID_REGEX.test(uid)) {
    const userSnap = await getDoc(doc(db, 'users', uid)).catch(() => null);
    if (userSnap && !userSnap.exists()) {
      return true;
    }
    if (userSnap && userSnap.exists()) {
      const createdMs = toMsFromFirestoreTimestamp(userSnap.data()?.createdAt);
      if (createdMs > 0 && revokedAtMs > createdMs + 2000) {
        return true;
      }
      if (createdMs > 0 && createdMs >= revokedAtMs) {
        return false;
      }
    }
  }
  if (!loginTs) return revokedAtMs > 0;
  return revokedAtMs >= loginTs - 10_000;
}

export async function isCurrentUserCloudRevoked(
  email?: string,
  uid?: string
): Promise<boolean> {
  const fbUser = auth.currentUser;
  const checkEmail = clampStr(email || fbUser?.email || '', 180).toLowerCase();
  const checkUid = clampStr(uid || fbUser?.uid || '', 128);
  if (!checkEmail && !checkUid) return false;
  if (checkEmail === MAIN_ADMIN_EMAIL) return false;
  if (!isTrustedCloudAuthUser(fbUser)) return false;

  try {
    if (checkUid && VALID_ID_REGEX.test(checkUid)) {
      const uidRevSnap = await getDoc(doc(db, 'account_revocations', `uid_${checkUid}`)).catch(() => null);
      if (uidRevSnap?.exists()) {
        const revMs = toMsFromFirestoreTimestamp(uidRevSnap.data()?.revokedAt);
        if (await evaluateRevocationStatus(revMs, checkUid)) {
          return true;
        }
      }
    }

    if (checkEmail) {
      const accountKey = await sha256AccountKey(checkEmail);
      const acctRevSnap = await getDoc(doc(db, 'account_revocations', accountKey)).catch(() => null);
      if (acctRevSnap?.exists()) {
        const revMs = toMsFromFirestoreTimestamp(acctRevSnap.data()?.revokedAt);
        if (await evaluateRevocationStatus(revMs, checkUid || undefined)) {
          return true;
        }
      }
    }
  } catch {
    // ignore transient lookup failures
  }

  return false;
}

export function subscribeCurrentUserAccountValidity(
  email: string,
  onRevoked: (reason: 'account_deleted' | 'account_disabled') => void
): () => void {
  const normalized = clampStr(email, 180).toLowerCase();
  if (!normalized || normalized === MAIN_ADMIN_EMAIL) {
    return () => {};
  }

  let disposed = false;
  let triggered = false;
  const unsubs: Array<() => void> = [];

  const fireOnce = (reason: 'account_deleted' | 'account_disabled' = 'account_deleted') => {
    if (disposed || triggered) return;
    triggered = true;
    onRevoked(reason);
  };

  const attach = async () => {
    await auth.authStateReady().catch(() => {});
    if (disposed) return;
    const fbUser = auth.currentUser;
    if (!isTrustedCloudAuthUser(fbUser)) return;
    if ((fbUser.email || '').trim().toLowerCase() !== normalized) return;

    let sawUserDoc = false;
    unsubs.push(
      onSnapshot(
        doc(db, 'users', fbUser.uid),
        (snap) => {
          if (disposed) return;
          if (snap.exists()) {
            sawUserDoc = true;
          } else if (sawUserDoc) {
            fireOnce('account_deleted');
          }
        },
        () => {}
      )
    );

    const uidKey = `uid_${fbUser.uid}`;
    if (VALID_ID_REGEX.test(uidKey)) {
      unsubs.push(
        onSnapshot(
          doc(db, 'account_revocations', uidKey),
          (snap) => {
            if (disposed || !snap.exists()) return;
            const d = snap.data();
            const revMs = toMsFromFirestoreTimestamp(d?.revokedAt);
            const reason = d?.reason === 'account_disabled' ? 'account_disabled' : 'account_deleted';
            void evaluateRevocationStatus(revMs, fbUser.uid).then((shouldKick) => {
              if (shouldKick) fireOnce(reason);
            });
          },
          () => {}
        )
      );
    }

    const accountKey = await sha256AccountKey(normalized);
    if (disposed) return;
    unsubs.push(
      onSnapshot(
        doc(db, 'account_revocations', accountKey),
        (snap) => {
          if (disposed || !snap.exists()) return;
          const d = snap.data();
          const revMs = toMsFromFirestoreTimestamp(d?.revokedAt);
          const reason = d?.reason === 'account_disabled' ? 'account_disabled' : 'account_deleted';
          void evaluateRevocationStatus(revMs, fbUser.uid).then((shouldKick) => {
            if (shouldKick) fireOnce(reason);
          });
        },
        () => {}
      )
    );
  };

  void attach();

  return () => {
    disposed = true;
    for (const unsub of unsubs) {
      try {
        unsub();
      } catch {
        // ignore unsubscribe error
      }
    }
  };
}

// ---------------- ATTACHMENT ENCODING FOR FIRESTORE (<= 260,000 CHARS) ----------------
const FIRESTORE_MAX_ATTACHMENT_CHARS = 250_000;

export async function encodeFileForFirestoreAttachment(file: File): Promise<{
  attachmentName: string;
  attachmentUrl: string;
  attachmentMime: string;
}> {
  const safeName = clampStr(file.name || 'attachment', 200) || 'attachment';
  const rawMime = clampStr(file.type || 'application/octet-stream', 120) || 'application/octet-stream';

  if (rawMime.startsWith('image/') && rawMime !== 'image/svg+xml') {
    try {
      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Invalid image'));
          el.src = objectUrl;
        });
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          for (const q of [0.8, 0.65, 0.5]) {
            const candidate = canvas.toDataURL('image/jpeg', q);
            if (candidate.length <= FIRESTORE_MAX_ATTACHMENT_CHARS) {
              return {
                attachmentName: safeName,
                attachmentUrl: candidate,
                attachmentMime: 'image/jpeg',
              };
            }
          }
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      // fall through to FileReader
    }
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read attachment file.'));
    reader.readAsDataURL(file);
  });

  if (!dataUrl || dataUrl.length > FIRESTORE_MAX_ATTACHMENT_CHARS) {
    throw new Error(
      'Attachment is too large for cloud sync (max ~180 KB for files or compressed images).'
    );
  }

  return {
    attachmentName: safeName,
    attachmentUrl: dataUrl,
    attachmentMime: rawMime,
  };
}

// ---------------- CLOUD ANNOUNCEMENTS & STUDY MATERIALS ----------------
export interface CloudAnnouncementRecord {
  announcementId: string;
  id: number;
  title: string;
  content: string;
  type: 'announcement' | 'material';
  authorUid: string;
  author_name: string;
  attachment_name: string | null;
  attachment_url: string | null;
  attachment_mime: string | null;
  created_at: string;
}

export async function fetchCloudAnnouncements(): Promise<CloudAnnouncementRecord[]> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser)) {
    return [];
  }
  try {
    const q = query(
      collection(db, 'announcements'),
      where('scope', '==', 'school')
    );
    const snaps = await getDocs(q);
    const list: CloudAnnouncementRecord[] = [];
    snaps.forEach((docSnap) => {
      const d = docSnap.data();
      const createdAt =
        clampStr(d.createdAtIso || '', 64) ||
        toIsoFromTimestampOrString(d.createdAt) ||
        new Date().toISOString();
      list.push({
        announcementId: clampStr(d.announcementId || docSnap.id, 128),
        id: Number(d.numericId) || stableNumericId(docSnap.id),
        title: clampStr(d.title || '', 200),
        content: clampStr(d.content || '', 8000),
        type: d.type === 'material' ? 'material' : 'announcement',
        authorUid: clampStr(d.authorUid || '', 128),
        author_name: clampStr(d.authorName || 'Mr. Kasrawan', 120) || 'Mr. Kasrawan',
        attachment_name: d.attachmentName ? clampStr(d.attachmentName, 200) : null,
        attachment_url: d.attachmentUrl ? clampStr(d.attachmentUrl, 260000) : null,
        attachment_mime: d.attachmentMime ? clampStr(d.attachmentMime, 120) : null,
        created_at: createdAt,
      });
    });
    list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
    return list;
  } catch {
    return [];
  }
}

export async function createCloudAnnouncement(params: {
  title: string;
  content: string;
  type: 'announcement' | 'material';
  authorName: string;
  attachment?: {
    attachmentName: string;
    attachmentUrl: string;
    attachmentMime: string;
  } | null;
}): Promise<CloudAnnouncementRecord | null> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid)) {
    return null;
  }
  const numericId = Date.now();
  const announcementId = `ann_${numericId}_${stableNumericId(fbUser.uid).toString(36)}`;
  const createdAtIso = new Date().toISOString();
  const safeTitle = clampStr(params.title, 200);
  const safeContent = clampStr(params.content, 8000);
  const safeAuthor = clampStr(params.authorName || 'Mr. Kasrawan', 120) || 'Mr. Kasrawan';

  if (!safeTitle || !safeContent) return null;

  const payload: Record<string, unknown> = {
    announcementId,
    numericId,
    scope: 'school',
    title: safeTitle,
    content: safeContent,
    type: params.type === 'material' ? 'material' : 'announcement',
    authorUid: fbUser.uid,
    authorName: safeAuthor,
    createdAtIso,
    createdAt: serverTimestamp(),
  };
  if (params.attachment?.attachmentUrl && params.attachment.attachmentUrl.length <= 260000) {
    payload.attachmentName = clampStr(params.attachment.attachmentName, 200);
    payload.attachmentUrl = params.attachment.attachmentUrl;
    payload.attachmentMime = clampStr(params.attachment.attachmentMime, 120);
  }

  try {
    await setDoc(doc(db, 'announcements', announcementId), payload);
    return {
      announcementId,
      id: numericId,
      title: safeTitle,
      content: safeContent,
      type: params.type === 'material' ? 'material' : 'announcement',
      authorUid: fbUser.uid,
      author_name: safeAuthor,
      attachment_name: (payload.attachmentName as string | undefined) || null,
      attachment_url: (payload.attachmentUrl as string | undefined) || null,
      attachment_mime: (payload.attachmentMime as string | undefined) || null,
      created_at: createdAtIso,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `announcements/${announcementId}`);
    return null;
  }
}

export async function deleteCloudAnnouncement(numericOrDocId: number | string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser)) return;

  try {
    const q = query(collection(db, 'announcements'), where('scope', '==', 'school'));
    const snaps = await getDocs(q);
    for (const snap of snaps.docs) {
      const d = snap.data();
      if (snap.id === String(numericOrDocId) || Number(d.numericId) === Number(numericOrDocId)) {
        await deleteDoc(snap.ref);
      }
    }
  } catch {
    // ignore cloud announcement delete errors
  }
}

// ---------------- CLOUD DIRECT MESSAGES ----------------
export interface CloudDirectMessageRecord {
  messageId: string;
  id: number;
  senderUid: string;
  recipientUid: string;
  senderNumericId: number;
  recipientNumericId: number;
  senderName: string;
  senderAvatarUrl: string;
  senderRole: 'student' | 'teacher';
  recipientName: string;
  messageText: string;
  attachmentName: string | null;
  attachmentUrl: string | null;
  attachmentMime: string | null;
  createdAtIso: string;
}

function mapDocToCloudDirectMessage(docId: string, d: Record<string, unknown>): CloudDirectMessageRecord {
  const createdAtIso =
    clampStr(d.createdAtIso || '', 64) ||
    toIsoFromTimestampOrString(d.createdAt) ||
    new Date().toISOString();
  return {
    messageId: clampStr(d.messageId || docId, 128),
    id: Number(d.numericId) || stableNumericId(docId),
    senderUid: clampStr(d.senderUid || '', 128),
    recipientUid: clampStr(d.recipientUid || '', 128),
    senderNumericId: Number(d.senderNumericId) || stableNumericId(String(d.senderUid || docId)),
    recipientNumericId:
      Number(d.recipientNumericId) || stableNumericId(String(d.recipientUid || docId)),
    senderName: clampStr(d.senderName || 'Classmate', 120) || 'Classmate',
    senderAvatarUrl: sanitizeAvatarForFirestore(d.senderAvatarUrl),
    senderRole: d.senderRole === 'teacher' ? 'teacher' : 'student',
    recipientName: clampStr(d.recipientName || 'Classmate', 120) || 'Classmate',
    messageText: clampStr(d.messageText || '', 4000),
    attachmentName: d.attachmentName ? clampStr(d.attachmentName, 200) : null,
    attachmentUrl: d.attachmentUrl ? clampStr(d.attachmentUrl, 260000) : null,
    attachmentMime: d.attachmentMime ? clampStr(d.attachmentMime, 120) : null,
    createdAtIso,
  };
}

export async function fetchCloudDirectMessages(): Promise<CloudDirectMessageRecord[]> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid)) {
    return [];
  }
  try {
    const q = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', fbUser.uid)
    );
    const snaps = await getDocs(q);
    const list: CloudDirectMessageRecord[] = [];
    snaps.forEach((docSnap) => {
      list.push(mapDocToCloudDirectMessage(docSnap.id, docSnap.data()));
    });
    list.sort((a, b) => Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso) || a.id - b.id);
    return list;
  } catch {
    return [];
  }
}

export function subscribeCloudDirectMessages(
  onMessagesChanged: (messages: CloudDirectMessageRecord[]) => void
): () => void {
  let disposed = false;
  let unsubSnap: (() => void) | null = null;

  const start = async () => {
    await auth.authStateReady().catch(() => {});
    if (disposed) return;
    const fbUser = auth.currentUser;
    if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid)) return;

    const q = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', fbUser.uid)
    );
    unsubSnap = onSnapshot(
      q,
      (snaps) => {
        if (disposed) return;
        const list: CloudDirectMessageRecord[] = [];
        snaps.forEach((docSnap) => {
          list.push(mapDocToCloudDirectMessage(docSnap.id, docSnap.data()));
        });
        list.sort((a, b) => Date.parse(a.createdAtIso) - Date.parse(b.createdAtIso) || a.id - b.id);
        onMessagesChanged(list);
      },
      () => {}
    );
  };

  void start();
  return () => {
    disposed = true;
    if (unsubSnap) {
      try {
        unsubSnap();
      } catch {
        // ignore unsubscribe error
      }
    }
  };
}

export async function sendCloudDirectMessage(params: {
  recipientUid: string;
  senderNumericId: number;
  recipientNumericId: number;
  senderName: string;
  senderAvatarUrl: string;
  senderRole: 'student' | 'teacher';
  recipientName: string;
  messageText: string;
  attachment?: {
    attachmentName: string;
    attachmentUrl: string;
    attachmentMime: string;
  } | null;
}): Promise<CloudDirectMessageRecord | null> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid)) {
    return null;
  }
  const recipientUid = clampStr(params.recipientUid, 128);
  if (!VALID_ID_REGEX.test(recipientUid) || recipientUid === fbUser.uid) {
    return null;
  }

  const numericId = Date.now();
  const messageId = `dm_${numericId}_${stableNumericId(fbUser.uid).toString(36)}`;
  const createdAtIso = new Date().toISOString();
  const safeText = clampStr(params.messageText, 4000);
  const safeSenderName = clampStr(params.senderName || 'Grade 9 Student', 120) || 'Grade 9 Student';
  const safeRecipientName =
    clampStr(params.recipientName || 'Classmate', 120) || 'Classmate';
  const safeAvatar = sanitizeAvatarForFirestore(params.senderAvatarUrl);

  const payload: Record<string, unknown> = {
    messageId,
    numericId,
    senderUid: fbUser.uid,
    recipientUid,
    participants: [fbUser.uid, recipientUid],
    senderNumericId: Math.max(1, Math.round(params.senderNumericId || 1)),
    recipientNumericId: Math.max(1, Math.round(params.recipientNumericId || 1)),
    senderName: safeSenderName,
    senderRole: params.senderRole === 'teacher' ? 'teacher' : 'student',
    recipientName: safeRecipientName,
    messageText: safeText,
    createdAtIso,
    createdAt: serverTimestamp(),
  };
  if (safeAvatar) {
    payload.senderAvatarUrl = safeAvatar;
  }
  if (params.attachment?.attachmentUrl && params.attachment.attachmentUrl.length <= 260000) {
    payload.attachmentName = clampStr(params.attachment.attachmentName, 200);
    payload.attachmentUrl = params.attachment.attachmentUrl;
    payload.attachmentMime = clampStr(params.attachment.attachmentMime, 120);
  }

  try {
    await setDoc(doc(db, 'direct_messages', messageId), payload);
    return mapDocToCloudDirectMessage(messageId, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `direct_messages/${messageId}`);
    return null;
  }
}

export async function deleteCloudDirectMessage(messageIdOrNumeric: number | string): Promise<void> {
  const fbUser = auth.currentUser;
  if (!isTrustedCloudAuthUser(fbUser) || !VALID_ID_REGEX.test(fbUser.uid)) return;
  try {
    const q = query(
      collection(db, 'direct_messages'),
      where('participants', 'array-contains', fbUser.uid)
    );
    const snaps = await getDocs(q);
    for (const snap of snaps.docs) {
      const d = snap.data();
      if (
        snap.id === String(messageIdOrNumeric) ||
        Number(d.numericId) === Number(messageIdOrNumeric)
      ) {
        await deleteDoc(snap.ref);
      }
    }
  } catch {
    // ignore cloud DM delete failures
  }
}

