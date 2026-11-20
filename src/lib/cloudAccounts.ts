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
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { User } from '../types';
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
  const fbUser = auth.currentUser;
  if (
    !fbUser ||
    !fbUser.emailVerified ||
    (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL
  ) {
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

export async function pushSchoolAccountsAsAdmin(
  accounts: SchoolAccountMirrorRow[]
): Promise<number> {
  const fbUser = auth.currentUser;
  if (
    !fbUser ||
    !fbUser.emailVerified ||
    (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL
  ) {
    return 0;
  }

  await ensureMainAdminRegistryDoc();

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
    await deleteDoc(doc(db, 'users', fbUser.uid)).catch(() => {});
    await fbUser.delete().catch(() => {});
  } catch {
    // Non-fatal cleanup when offline or requiring recent login
  }
}

export async function deleteSchoolAccountMirrorByEmail(email: string): Promise<void> {
  const fbUser = auth.currentUser;
  if (
    !fbUser ||
    !fbUser.emailVerified ||
    (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL
  ) {
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

