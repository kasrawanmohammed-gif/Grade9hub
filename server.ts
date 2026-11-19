import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import sharp from 'sharp';
import { WebSocketServer, WebSocket } from 'ws';
import {
  BOOTSTRAP_PENDING_HASH,
  checkpointDatabase,
  db,
  ensureMainAdminPermissions,
  getRealUserCount,
  TEACHER_EMAIL,
  uploadsDir,
} from './server/db.ts';
import {
  AccountPassportPayload,
  BackupRow,
  LATEST_RECOVERY_FILENAME,
  buildPortableBackupPayload,
  createFullBackup,
  ensureHydratedFromPersistentBackupSync,
  flushPendingRecoverySnapshotSync,
  getDatabaseHealthStats,
  initBackupAndRecovery,
  listBackups,
  restoreFromBackupPayload,
  restoreFromServerBackupFile,
  restoreMissingUserFromPersistentBackupSync,
  restoreUserPassportRecord,
  sanitizeBackupFilename,
  scheduleAutoRecoverySnapshot,
  writeRecoverySnapshotSync,
} from './server/backup.ts';
import {
  decryptSignedJson,
  encryptSignedJson,
  hashToken,
  signSessionJwt,
  verifySessionJwt,
} from './server/authSecret.ts';
import { seedChapters1To3IfNeeded } from './server/seedChapters123.ts';
import { populateMissingExplanations123 } from './server/explanations123.ts';
import {
  populateTranslations123,
  autoTranslateQuestionInBackground,
  autoTranslateChapterInBackground,
} from './server/populateTranslations.ts';
import { buildWrongOptionExplanation, SupportedLang } from './server/wrongOptionExplainer.ts';
import { sendVerificationCodeEmail, isSmtpConfigured } from './server/email.ts';
import { getPublicVapidKey, sendPushToAllStudents, sendPushToUser } from './server/push.ts';
import { runTutorChat, generateStudyImage } from './server/gemini.ts';
import { registerCommunityRoutes, logStudentActivity } from './server/communityRoutes.ts';
import { normalizeScientificUnits } from './server/unitSanitizer.ts';
import { seedTextbooksIfNeeded } from './server/seedTextbooks.ts';
import { verifyFirebaseIdToken } from './server/firebaseVerify.ts';

function normalizeLang(raw: unknown): SupportedLang {
  if (raw === 'ku' || raw === 'ar') return raw;
  return 'en';
}

interface RawChapterRow {
  chapter_number: number;
  title: string;
  description: string;
  title_ku?: string;
  description_ku?: string;
  title_ar?: string;
  description_ar?: string;
  updated_at: string;
  question_count?: number;
}

function pickLocalizedChapter(row: RawChapterRow, lang: SupportedLang) {
  let title = row.title;
  let description = row.description;
  if (lang === 'ku') {
    title = (row.title_ku || '').trim() || `بەشی ${row.chapter_number}: ${row.title}`;
    if (row.title_ku?.trim()) {
      title = row.title_ku.trim();
    } else if (/^Chapter \d+$/i.test(row.title.trim())) {
      title = `بەشی ${row.chapter_number}`;
    }
    description = (row.description_ku || '').trim() || row.description;
  } else if (lang === 'ar') {
    title = (row.title_ar || '').trim() || row.title;
    if (row.title_ar?.trim()) {
      title = row.title_ar.trim();
    } else if (/^Chapter \d+$/i.test(row.title.trim())) {
      title = `الفصل ${row.chapter_number}`;
    }
    description = (row.description_ar || '').trim() || row.description;
  }
  return {
    chapter_number: row.chapter_number,
    title,
    description,
    raw_title: row.title,
    raw_description: row.description,
    updated_at: row.updated_at,
    question_count: row.question_count ?? 0,
  };
}

interface RawQuestionRow {
  id: number;
  scope: 'chapter' | 'general';
  chapter_number: number | null;
  chapter_title: string | null;
  chapter_title_ku?: string | null;
  chapter_title_ar?: string | null;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  question_text_ku?: string;
  option_a_ku?: string;
  option_b_ku?: string;
  option_c_ku?: string;
  option_d_ku?: string;
  explanation_ku?: string;
  question_text_ar?: string;
  option_a_ar?: string;
  option_b_ar?: string;
  option_c_ar?: string;
  option_d_ar?: string;
  explanation_ar?: string;
  created_at: string;
}

function getLocalizedQuestionFields(row: RawQuestionRow, lang: SupportedLang) {
  if (lang === 'ku') {
    return {
      chapterTitle:
        (row.chapter_title_ku || '').trim() ||
        (row.chapter_number ? `بەشی ${row.chapter_number}` : row.chapter_title),
      questionText: normalizeScientificUnits((row.question_text_ku || '').trim() || row.question_text),
      optionA: normalizeScientificUnits((row.option_a_ku || '').trim() || row.option_a),
      optionB: normalizeScientificUnits((row.option_b_ku || '').trim() || row.option_b),
      optionC: normalizeScientificUnits((row.option_c_ku || '').trim() || row.option_c),
      optionD: normalizeScientificUnits((row.option_d_ku || '').trim() || row.option_d),
      explanation: normalizeScientificUnits((row.explanation_ku || '').trim() || row.explanation),
    };
  }
  if (lang === 'ar') {
    return {
      chapterTitle:
        (row.chapter_title_ar || '').trim() ||
        (row.chapter_number ? `الفصل ${row.chapter_number}` : row.chapter_title),
      questionText: normalizeScientificUnits((row.question_text_ar || '').trim() || row.question_text),
      optionA: normalizeScientificUnits((row.option_a_ar || '').trim() || row.option_a),
      optionB: normalizeScientificUnits((row.option_b_ar || '').trim() || row.option_b),
      optionC: normalizeScientificUnits((row.option_c_ar || '').trim() || row.option_c),
      optionD: normalizeScientificUnits((row.option_d_ar || '').trim() || row.option_d),
      explanation: normalizeScientificUnits((row.explanation_ar || '').trim() || row.explanation),
    };
  }
  return {
    chapterTitle: row.chapter_title,
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    explanation: row.explanation,
  };
}

function serializeQuestionForClient(
  row: RawQuestionRow,
  lang: SupportedLang,
  isPrivileged: boolean
) {
  const loc = getLocalizedQuestionFields(row, lang);
  const base = {
    id: row.id,
    scope: row.scope,
    chapter_number: row.chapter_number,
    chapter_title: loc.chapterTitle,
    question_text: loc.questionText,
    option_a: loc.optionA,
    option_b: loc.optionB,
    option_c: loc.optionC,
    option_d: loc.optionD,
    created_at: row.created_at,
  };
  if (!isPrivileged) {
    return base;
  }
  return {
    ...base,
    correct_option: row.correct_option,
    explanation: loc.explanation,
    raw_question_text: row.question_text,
    raw_option_a: row.option_a,
    raw_option_b: row.option_b,
    raw_option_c: row.option_c,
    raw_option_d: row.option_d,
    raw_explanation: row.explanation,
  };
}

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  grade: string;
  bio: string;
  birthday: string;
  avatar_url: string;
  notif_prompt_status: 'allowed' | 'denied' | '';
  notifications_enabled: boolean;
  isRestricted: boolean;
  restrictionReason: string;
  lastLoginAt: string;
  created_at: string;
}

interface DbUserRow {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'teacher';
  is_admin?: number;
  grade: string;
  bio: string;
  birthday?: string;
  avatar_url?: string;
  notif_prompt_status?: string;
  notifications_enabled?: number;
  is_restricted?: number;
  restriction_reason?: string;
  last_login_at?: string;
  created_at: string;
}

const USER_SELECT_COLS =
  'id, name, email, role, is_admin, grade, bio, birthday, avatar_url, notif_prompt_status, notifications_enabled, is_restricted, restriction_reason, last_login_at, created_at';

function serializeAuthUser(row: DbUserRow): AuthUser {
  const isMainAdmin = row.email.toLowerCase() === TEACHER_EMAIL.toLowerCase();
  const promptStatus =
    row.notif_prompt_status === 'allowed' || row.notif_prompt_status === 'denied'
      ? row.notif_prompt_status
      : '';
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: isMainAdmin ? 'teacher' : row.role,
    isAdmin: isMainAdmin || Boolean(row.is_admin),
    grade: row.grade,
    bio: row.bio,
    birthday: row.birthday || '',
    avatar_url: row.avatar_url || '',
    notif_prompt_status: promptStatus,
    notifications_enabled: row.notifications_enabled !== 0,
    isRestricted: Boolean(row.is_restricted),
    restrictionReason: row.restriction_reason || '',
    lastLoginAt: row.last_login_at || '',
    created_at: row.created_at,
  };
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

const SESSION_COOKIE = 'majquiz_session';
const SESSION_TTL_DAYS = 90;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max attachment size
  },
});

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return forwardedProto === 'https';
}

function extractSessionTokens(req: Request): string[] {
  const tokens: string[] = [];
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) tokens.push(bearer);
  }
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (cookieToken && typeof cookieToken === 'string' && !tokens.includes(cookieToken)) {
    tokens.push(cookieToken);
  }
  return tokens;
}

function extractSessionToken(req: Request): string | undefined {
  return extractSessionTokens(req)[0];
}

function extractTokenFromCookieHeader(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function buildAccountPassportForUser(userId: number): string | null {
  const row = db
    .prepare(
      `SELECT id, name, email, password_hash, role, is_admin, grade, bio, birthday, avatar_url,
              notif_prompt_status, notifications_enabled, ai_tutor_turns, last_login_at,
              last_active_at, created_at, is_restricted, restriction_reason, restricted_at
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | (DbUserRow & {
        password_hash: string;
        ai_tutor_turns?: number;
        last_active_at?: string;
        restricted_at?: string;
      })
    | undefined;

  if (!row || !row.password_hash || row.password_hash === BOOTSTRAP_PENDING_HASH) {
    return null;
  }

  const quizAttempts = db
    .prepare(
      `SELECT mode, chapter_number, total_questions, correct_count, score_percent, answers_json, created_at
       FROM quiz_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 200`
    )
    .all(userId) as BackupRow[];

  const questionAnswers = db
    .prepare(
      `SELECT question_id, is_correct, created_at
       FROM student_question_answers WHERE user_id = ? ORDER BY id DESC LIMIT 500`
    )
    .all(userId) as BackupRow[];

  const competitionEvents = db
    .prepare(
      `SELECT event_key, event_type, points, chapter_number, details, created_at
       FROM competition_point_events WHERE user_id = ? ORDER BY id DESC LIMIT 500`
    )
    .all(userId) as BackupRow[];

  const isMainAdmin = row.email.toLowerCase() === TEACHER_EMAIL.toLowerCase();
  const payload: AccountPassportPayload = {
    v: 1,
    issuedAt: new Date().toISOString(),
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      password_hash: row.password_hash,
      role: isMainAdmin ? 'teacher' : row.role,
      is_admin: isMainAdmin ? 1 : Number(row.is_admin ? 1 : 0),
      grade: row.grade || '',
      bio: row.bio || '',
      birthday: row.birthday || '',
      avatar_url: row.avatar_url || '',
      notif_prompt_status: row.notif_prompt_status || '',
      notifications_enabled: row.notifications_enabled === 0 ? 0 : 1,
      ai_tutor_turns: Number(row.ai_tutor_turns || 0),
      last_login_at: row.last_login_at || '',
      last_active_at: row.last_active_at || '',
      created_at: row.created_at,
      is_restricted: Number(row.is_restricted ? 1 : 0),
      restriction_reason: row.restriction_reason || '',
      restricted_at: row.restricted_at || '',
    },
    quiz_attempts: [...quizAttempts].reverse(),
    student_question_answers: [...questionAnswers].reverse(),
    competition_point_events: [...competitionEvents].reverse(),
  };

  return encryptSignedJson('user-passport', payload);
}

function createSessionForUser(userId: number): { token: string; expiresAt: Date } {
  const row = db
    .prepare('SELECT id, email, role, is_admin FROM users WHERE id = ?')
    .get(userId) as { id: number; email: string; role: 'student' | 'teacher'; is_admin: number } | undefined;

  if (!row) {
    throw new Error('Cannot create session for missing user.');
  }

  const isMainAdmin = row.email.toLowerCase() === TEACHER_EMAIL.toLowerCase();
  const { token, expiresAt } = signSessionJwt({
    userId: row.id,
    email: row.email,
    role: isMainAdmin ? 'teacher' : row.role,
    isAdmin: isMainAdmin || Boolean(row.is_admin),
    ttlDays: SESSION_TTL_DAYS,
  });

  db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt.toISOString()
  );
  return { token, expiresAt };
}

function setSessionCookie(req: Request, res: Response, token: string, expiresAt: Date): void {
  const isHttps = isHttpsRequest(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    expires: expiresAt,
    path: '/',
  });
}

function isTokenRevoked(token: string): boolean {
  try {
    const found = db
      .prepare('SELECT 1 AS revoked FROM revoked_sessions WHERE token_hash = ?')
      .get(hashToken(token)) as { revoked: number } | undefined;
    return Boolean(found);
  } catch {
    return false;
  }
}

function resolveSessionToken(token?: string): {
  user?: AuthUser;
  needsPassportRestore?: boolean;
  revoked?: boolean;
} {
  if (!token) return {};
  if (isTokenRevoked(token)) return { revoked: true };

  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_admin, u.grade, u.bio, u.birthday, u.avatar_url,
              u.notif_prompt_status, u.notifications_enabled, u.is_restricted, u.restriction_reason,
              u.last_login_at, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token) as (DbUserRow & { password_hash: string; expires_at: string }) | undefined;

  if (row) {
    if (row.password_hash === BOOTSTRAP_PENDING_HASH) {
      restoreMissingUserFromPersistentBackupSync(row.email);
      const healed = db
        .prepare(`SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE id = ?`)
        .get(row.id) as (DbUserRow & { password_hash: string }) | undefined;
      if (healed && healed.password_hash !== BOOTSTRAP_PENDING_HASH) {
        return { user: serializeAuthUser(healed) };
      }
      return { needsPassportRestore: true };
    }
    const expiryMs = new Date(row.expires_at).getTime();
    if (expiryMs < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return {};
    }

    // Sliding renewal: refresh 90-day expiration when fewer than 45 days remain
    const halfWindowMs = (SESSION_TTL_DAYS / 2) * 24 * 60 * 60 * 1000;
    if (expiryMs - Date.now() < halfWindowMs) {
      const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token = ?').run(
        nextExpiry.toISOString(),
        token
      );
    }

    if (
      row.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() &&
      (row.role !== 'teacher' || !row.is_admin)
    ) {
      db.prepare("UPDATE users SET role = 'teacher', is_admin = 1 WHERE id = ?").run(row.id);
      row.role = 'teacher';
      row.is_admin = 1;
    }

    return { user: serializeAuthUser(row) };
  }

  // Zero-Logout Fallback: Verify stateless HMAC-signed session JWT across server/DB rebuilds & URL changes
  const jwtPayload = verifySessionJwt(token);
  if (!jwtPayload) {
    return {};
  }

  let userRow = db
    .prepare(
      `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`
    )
    .get(jwtPayload.email) as (DbUserRow & { password_hash: string }) | undefined;

  if (!userRow || userRow.password_hash === BOOTSTRAP_PENDING_HASH) {
    if (restoreMissingUserFromPersistentBackupSync(jwtPayload.email)) {
      userRow = db
        .prepare(
          `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`
        )
        .get(jwtPayload.email) as (DbUserRow & { password_hash: string }) | undefined;
    }
  }

  if (!userRow || userRow.password_hash === BOOTSTRAP_PENDING_HASH) {
    return { needsPassportRestore: true };
  }

  if (
    userRow.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() &&
    (userRow.role !== 'teacher' || !userRow.is_admin)
  ) {
    db.prepare("UPDATE users SET role = 'teacher', is_admin = 1 WHERE id = ?").run(userRow.id);
    userRow.role = 'teacher';
    userRow.is_admin = 1;
  }

  const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userRow.id,
    nextExpiry.toISOString()
  );
  return { user: serializeAuthUser(userRow) };
}

function getAuthenticatedUserByToken(token?: string): AuthUser | undefined {
  return resolveSessionToken(token).user;
}

function getAuthenticatedUserWithMeta(req: Request): {
  user?: AuthUser;
  needsPassportRestore: boolean;
  sessionRevoked: boolean;
} {
  let needsPassportRestore = false;
  let sessionRevoked = false;
  for (const token of extractSessionTokens(req)) {
    const resolved = resolveSessionToken(token);
    if (resolved.user) {
      return { user: resolved.user, needsPassportRestore: false, sessionRevoked: false };
    }
    if (resolved.revoked) {
      sessionRevoked = true;
    }
    if (resolved.needsPassportRestore) {
      needsPassportRestore = true;
    }
  }
  return { needsPassportRestore, sessionRevoked };
}

function getAuthenticatedUser(req: Request): AuthUser | undefined {
  return getAuthenticatedUserWithMeta(req).user;
}

// ---------------- REAL-TIME PRESENCE & EDUCATIONAL RANKINGS ----------------
const activeUserSockets = new Map<number, Set<WebSocket>>();
const userActiveSection = new Map<number, string>();
const adminDashboardSockets = new Set<WebSocket>();

const ALLOWED_PRESENCE_SECTIONS = new Set([
  'home',
  'community',
  'competition',
  'multiple-choice',
  'textbooks-qa',
  'general-questions',
  'ask-teacher',
  'notifications',
  'ai-studio',
  'profile',
  'settings',
  'about',
  'admin-dashboard',
]);

interface StudentStatsRow {
  id: number;
  name: string;
  email: string;
  grade: string;
  avatar_url: string;
  last_active_at: string;
  last_login_at: string;
  is_restricted: number;
  restriction_reason: string;
  ai_tutor_turns: number;
  quizzes_completed: number;
  quiz_questions_total: number;
  quiz_correct_total: number;
  avg_score_percent: number;
  best_score_percent: number;
  live_answered_count: number;
  live_correct_count: number;
  teacher_messages_count: number;
  latest_quiz_at: string | null;
  latest_message_at: string | null;
}

function buildStudentPerformanceList() {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.grade, u.avatar_url, u.last_active_at, u.last_login_at,
              u.is_restricted, u.restriction_reason, u.ai_tutor_turns,
              COALESCE(qa.quizzes_completed, 0) AS quizzes_completed,
              COALESCE(qa.quiz_questions_total, 0) AS quiz_questions_total,
              COALESCE(qa.quiz_correct_total, 0) AS quiz_correct_total,
              COALESCE(qa.avg_score_percent, 0) AS avg_score_percent,
              COALESCE(qa.best_score_percent, 0) AS best_score_percent,
              qa.latest_quiz_at AS latest_quiz_at,
              COALESCE(sqa.live_answered_count, 0) AS live_answered_count,
              COALESCE(sqa.live_correct_count, 0) AS live_correct_count,
              COALESCE(tm.teacher_messages_count, 0) AS teacher_messages_count,
              tm.latest_message_at AS latest_message_at
       FROM users u
       LEFT JOIN (
         SELECT user_id,
                COUNT(*) AS quizzes_completed,
                SUM(total_questions) AS quiz_questions_total,
                SUM(correct_count) AS quiz_correct_total,
                ROUND(AVG(score_percent), 1) AS avg_score_percent,
                ROUND(MAX(score_percent), 1) AS best_score_percent,
                MAX(created_at) AS latest_quiz_at
         FROM quiz_attempts
         GROUP BY user_id
       ) qa ON qa.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*) AS live_answered_count,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS live_correct_count
         FROM student_question_answers
         GROUP BY user_id
       ) sqa ON sqa.user_id = u.id
       LEFT JOIN (
         SELECT sender_id,
                COUNT(*) AS teacher_messages_count,
                MAX(created_at) AS latest_message_at
         FROM teacher_messages
         WHERE sender_role = 'student'
         GROUP BY sender_id
       ) tm ON tm.sender_id = u.id
       WHERE u.role = 'student' AND u.is_admin = 0`
    )
    .all() as StudentStatsRow[];

  return rows.map((r) => {
    const questionsAnswered = Math.max(r.live_answered_count, r.quiz_questions_total);
    const correctAnswers = Math.max(r.live_correct_count, r.quiz_correct_total);
    const accuracyPercent =
      questionsAnswered > 0
        ? Math.round((Math.min(correctAnswers, questionsAnswered) / questionsAnswered) * 1000) / 10
        : r.avg_score_percent;

    const avgScorePercent = r.quizzes_completed > 0 ? r.avg_score_percent : accuracyPercent;
    const bestScorePercent = r.quizzes_completed > 0 ? r.best_score_percent : accuracyPercent;

    // Performance index weighting quiz scores, answer accuracy, and correct answer volume
    const performanceScore =
      questionsAnswered > 0 || r.quizzes_completed > 0
        ? Math.round(
            (avgScorePercent * 0.55 +
              accuracyPercent * 0.3 +
              Math.min(correctAnswers, 100) * 0.15) *
              10
          ) / 10
        : 0;

    // Activity score reflecting quizzes completed, questions answered, teacher questions, and AI study turns
    const activityScore =
      r.quizzes_completed * 10 +
      questionsAnswered * 2 +
      r.teacher_messages_count * 3 +
      r.ai_tutor_turns * 2;

    const online = activeUserSockets.has(r.id);
    const currentSection = online ? userActiveSection.get(r.id) || 'home' : '';
    const lastActiveAt =
      [r.last_active_at, r.latest_quiz_at, r.latest_message_at]
        .filter((v): v is string => Boolean(v && v.trim()))
        .sort()
        .pop() || '';

    return {
      id: r.id,
      name: r.name,
      email: r.email,
      grade: r.grade,
      avatar_url: r.avatar_url || '',
      online,
      currentSection,
      lastActiveAt,
      lastLoginAt: r.last_login_at || '',
      isRestricted: Boolean(r.is_restricted),
      restrictionReason: r.restriction_reason || '',
      quizzesCompleted: r.quizzes_completed,
      questionsAnswered,
      correctAnswers,
      accuracyPercent,
      avgScorePercent,
      bestScorePercent,
      teacherMessagesCount: r.teacher_messages_count,
      aiTutorTurns: r.ai_tutor_turns,
      performanceScore,
      activityScore,
    };
  });
}

function computeAdminDashboardSnapshot() {
  const students = buildStudentPerformanceList();

  const activeStudents = students
    .filter((s) => s.online)
    .sort((a, b) => a.name.localeCompare(b.name));

  const topCandidates = students.filter(
    (s) => s.questionsAnswered > 0 || s.quizzesCompleted > 0
  );
  topCandidates.sort(
    (a, b) =>
      b.performanceScore - a.performanceScore ||
      b.avgScorePercent - a.avgScorePercent ||
      b.correctAnswers - a.correctAnswers ||
      b.quizzesCompleted - a.quizzesCompleted
  );
  const topStudent = topCandidates[0] || null;

  const activeCandidates = students.filter((s) => s.activityScore > 0);
  activeCandidates.sort(
    (a, b) =>
      b.activityScore - a.activityScore ||
      b.questionsAnswered - a.questionsAnswered ||
      b.quizzesCompleted - a.quizzesCompleted ||
      Number(b.online) - Number(a.online)
  );
  const mostActiveStudent = activeCandidates[0] || null;

  const sortedStudents = [...students].sort(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      b.performanceScore - a.performanceScore ||
      b.activityScore - a.activityScore ||
      a.name.localeCompare(b.name)
  );

  return {
    totalStudents: students.length,
    activeCount: activeStudents.length,
    activeStudents,
    topStudent,
    mostActiveStudent,
    students: sortedStudents,
    generatedAt: new Date().toISOString(),
  };
}

function touchUserActivity(userId: number): void {
  db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(userId);
}

function broadcastAdminDashboard(): void {
  if (adminDashboardSockets.size === 0) return;
  const payload = JSON.stringify({
    type: 'admin:dashboard',
    payload: computeAdminDashboardSnapshot(),
  });
  for (const client of adminDashboardSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastToUser(userId: number, event: unknown): void {
  const set = activeUserSockets.get(userId);
  if (!set || set.size === 0) return;
  const raw = JSON.stringify(event);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function broadcastToAllUsers(event: unknown): void {
  if (activeUserSockets.size === 0) return;
  const raw = JSON.stringify(event);
  for (const set of activeUserSockets.values()) {
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }
}

function broadcastToAdmins(event: unknown): void {
  if (adminDashboardSockets.size === 0) return;
  const raw = JSON.stringify(event);
  for (const client of adminDashboardSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

// ---------------- STUDENT COMPETITION & LEADERBOARD HELPERS ----------------
const COMPETITION_RULES = {
  correctAnswer: 10,
  quizCompleted: 25,
  highScore80Bonus: 15,
  perfectScoreBonus: 30,
  curriculumActivity: 5,
};

function getUserCompetitionTotal(userId: number): number {
  const row = db
    .prepare('SELECT COALESCE(SUM(points), 0) AS total FROM competition_point_events WHERE user_id = ?')
    .get(userId) as { total: number } | undefined;
  return Number(row?.total || 0);
}

function awardCompetitionPoints(params: {
  userId: number;
  eventKey: string;
  eventType: 'correct_answer' | 'quiz_completed' | 'curriculum_activity';
  points: number;
  chapterNumber?: number | null;
  details?: string;
  createdAt?: string;
  skipBroadcast?: boolean;
}): { awarded: number; totalPoints: number } {
  const target = db
    .prepare('SELECT id, role, is_admin FROM users WHERE id = ?')
    .get(params.userId) as { id: number; role: string; is_admin: number } | undefined;

  if (!target || target.role !== 'student' || target.is_admin) {
    return { awarded: 0, totalPoints: 0 };
  }

  const safePoints = Math.max(0, Math.min(100, Math.round(Number(params.points) || 0)));
  if (safePoints <= 0 || !params.eventKey) {
    return { awarded: 0, totalPoints: getUserCompetitionTotal(params.userId) };
  }

  const res = db
    .prepare(
      `INSERT OR IGNORE INTO competition_point_events
         (user_id, event_key, event_type, points, chapter_number, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(
      params.userId,
      params.eventKey.slice(0, 140),
      params.eventType,
      safePoints,
      params.chapterNumber ?? null,
      String(params.details || '').slice(0, 200),
      params.createdAt || null
    );

  const totalPoints = getUserCompetitionTotal(params.userId);
  const awarded = res.changes > 0 ? safePoints : 0;

  if (awarded > 0 && !params.skipBroadcast) {
    broadcastToAllUsers({
      type: 'leaderboard:update',
      payload: { userId: params.userId, pointsAwarded: awarded, totalPoints },
    });
  }

  return { awarded, totalPoints };
}

function buildCompetitionLeaderboard(viewerUserId: number) {
  const rows = db
    .prepare(
      `SELECT u.id, u.name, u.grade, u.avatar_url, u.last_active_at,
              COALESCE(SUM(e.points), 0) AS total_points,
              COALESCE(SUM(CASE WHEN e.event_type IN ('correct_answer', 'quiz_completed') THEN e.points ELSE 0 END), 0) AS quiz_points,
              COALESCE(SUM(CASE WHEN e.event_type = 'curriculum_activity' THEN e.points ELSE 0 END), 0) AS activity_points,
              COALESCE((SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.user_id = u.id), 0) AS quizzes_completed,
              COALESCE((SELECT COUNT(*) FROM student_question_answers sqa WHERE sqa.user_id = u.id), 0) AS questions_answered,
              COALESCE((SELECT SUM(CASE WHEN sqa.is_correct = 1 THEN 1 ELSE 0 END) FROM student_question_answers sqa WHERE sqa.user_id = u.id), 0) AS correct_answers
       FROM users u
       LEFT JOIN competition_point_events e ON e.user_id = u.id
       WHERE u.role = 'student' AND u.is_admin = 0 AND u.password_hash != ?
       GROUP BY u.id`
    )
    .all(BOOTSTRAP_PENDING_HASH) as Array<{
    id: number;
    name: string;
    grade: string;
    avatar_url: string;
    last_active_at: string;
    total_points: number;
    quiz_points: number;
    activity_points: number;
    quizzes_completed: number;
    questions_answered: number;
    correct_answers: number;
  }>;

  const sorted = [...rows].sort(
    (a, b) =>
      b.total_points - a.total_points ||
      b.correct_answers - a.correct_answers ||
      b.quizzes_completed - a.quizzes_completed ||
      a.name.localeCompare(b.name)
  );

  const leaderboard = sorted.map((r, idx) => {
    const rank = idx + 1;
    const accuracyPercent =
      r.questions_answered > 0
        ? Math.round((Math.min(r.correct_answers, r.questions_answered) / r.questions_answered) * 1000) / 10
        : 0;
    const badge = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
    return {
      rank,
      userId: r.id,
      name: r.name,
      grade: r.grade || '',
      avatar_url: r.avatar_url || '',
      online: activeUserSockets.has(r.id),
      totalPoints: Number(r.total_points || 0),
      quizPoints: Number(r.quiz_points || 0),
      activityPoints: Number(r.activity_points || 0),
      quizzesCompleted: Number(r.quizzes_completed || 0),
      correctAnswers: Number(r.correct_answers || 0),
      questionsAnswered: Number(r.questions_answered || 0),
      accuracyPercent,
      badge,
      isCurrentUser: r.id === viewerUserId,
    };
  });

  const meEntry = leaderboard.find((e) => e.userId === viewerUserId) || null;
  const recentEvents = db
    .prepare(
      `SELECT id, event_key, event_type, points, chapter_number, details, created_at
       FROM competition_point_events
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 20`
    )
    .all(viewerUserId) as Array<{
    id: number;
    event_key: string;
    event_type: string;
    points: number;
    chapter_number: number | null;
    details: string;
    created_at: string;
  }>;

  return {
    leaderboard,
    topThree: leaderboard.slice(0, 3),
    myStats: {
      rank: meEntry?.rank ?? null,
      totalPoints: meEntry ? meEntry.totalPoints : getUserCompetitionTotal(viewerUserId),
      quizPoints: meEntry?.quizPoints ?? 0,
      activityPoints: meEntry?.activityPoints ?? 0,
      quizzesCompleted: meEntry?.quizzesCompleted ?? 0,
      correctAnswers: meEntry?.correctAnswers ?? 0,
      accuracyPercent: meEntry?.accuracyPercent ?? 0,
      badge: meEntry?.badge ?? null,
      totalStudents: leaderboard.length,
    },
    recentEvents,
    rules: COMPETITION_RULES,
    generatedAt: new Date().toISOString(),
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { user, needsPassportRestore } = getAuthenticatedUserWithMeta(req);
  if (!user) {
    res.status(401).json({
      error: 'Authentication required. Please log in.',
      ...(needsPassportRestore
        ? { needsPassportRestore: true, dbEmpty: getRealUserCount() === 0 }
        : {}),
    });
    return;
  }
  req.user = user;
  next();
}

function requireTeacher(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { user, needsPassportRestore } = getAuthenticatedUserWithMeta(req);
  if (!user) {
    res.status(401).json({
      error: 'Authentication required.',
      ...(needsPassportRestore
        ? { needsPassportRestore: true, dbEmpty: getRealUserCount() === 0 }
        : {}),
    });
    return;
  }
  if (user.role !== 'teacher' && !user.isAdmin) {
    res.status(403).json({ error: 'Administrator or teacher permissions required.' });
    return;
  }
  req.user = user;
  next();
}

function notifyAllStudents(params: {
  title: string;
  body: string;
  category: 'announcement' | 'question' | 'chapter' | 'material';
  linkTab: string;
}): void {
  const students = db
    .prepare("SELECT id FROM users WHERE role = 'student'")
    .all() as Array<{ id: number }>;

  const insertNotif = db.prepare(
    `INSERT INTO notifications (user_id, title, body, category, link_tab)
     VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const st of students) {
      insertNotif.run(st.id, params.title, params.body, params.category, params.linkTab);
    }
  });
  tx();

  void sendPushToAllStudents({
    title: params.title,
    body: params.body,
    url: '/',
    tag: `grade9hub-${params.category}`,
  });
}

function notifySingleUser(params: {
  userId: number;
  title: string;
  body: string;
  category: 'announcement' | 'question' | 'chapter' | 'material' | 'reply';
  linkTab: string;
}): void {
  db.prepare(
    `INSERT INTO notifications (user_id, title, body, category, link_tab)
     VALUES (?, ?, ?, ?, ?)`
  ).run(params.userId, params.title, params.body, params.category, params.linkTab);

  void sendPushToUser(params.userId, {
    title: params.title,
    body: params.body,
    url: '/',
    tag: `grade9hub-${params.category}`,
  });
}

async function compactAvatarToBase64(rawBuffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'image/svg+xml') {
    throw new Error('SVG files are not allowed for profile pictures. Please upload PNG, JPG, or WebP.');
  }
  try {
    const compacted = await sharp(rawBuffer)
      .rotate()
      .resize(256, 256, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toBuffer();
    return `data:image/webp;base64,${compacted.toString('base64')}`;
  } catch {
    if (rawBuffer.length <= 512 * 1024) {
      return `data:${mimeType};base64,${rawBuffer.toString('base64')}`;
    }
    throw new Error('Could not process this image file. Please try a standard PNG or JPG photo.');
  }
}

async function migrateDiskAvatarsToBase64(): Promise<void> {
  const diskAvatarRows = db
    .prepare("SELECT id, avatar_url FROM users WHERE avatar_url LIKE '/uploads/%'")
    .all() as Array<{ id: number; avatar_url: string }>;

  if (diskAvatarRows.length === 0) return;

  let changed = false;
  for (const row of diskAvatarRows) {
    const filename = path.basename(row.avatar_url);
    const fullPath = path.join(uploadsDir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const buf = fs.readFileSync(fullPath);
        const ext = path.extname(filename).toLowerCase();
        const mime =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';
        const dataUri = await compactAvatarToBase64(buf, mime);
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(dataUri, row.id);
        changed = true;
        try {
          fs.unlinkSync(fullPath);
        } catch {
          // ignore
        }
      } catch {
        // leave intact or clear if unreadable
      }
    } else {
      // Ephemeral /uploads file was wiped on rebuild; clear broken path so clean initials fallback renders
      db.prepare("UPDATE users SET avatar_url = '' WHERE id = ?").run(row.id);
      changed = true;
    }
  }

  if (changed) {
    checkpointDatabase();
  }
}

async function startServer() {
  await initBackupAndRecovery();
  if (getRealUserCount() === 0) {
    ensureHydratedFromPersistentBackupSync();
  }
  db.prepare("DELETE FROM sessions WHERE julianday(expires_at) < julianday('now')").run();
  seedChapters1To3IfNeeded();
  populateMissingExplanations123();
  populateTranslations123();
  seedTextbooksIfNeeded();
  await migrateDiskAvatarsToBase64();
  checkpointDatabase();
  writeRecoverySnapshotSync('startup-ready');

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(cookieParser());

  // Request-level guard: if SQLite users table is ever empty (e.g. rebuild/URL swap/restart),
  // immediately hydrate from src/data/persistent_backup.json before handling ANY API request.
  app.use('/api', (_req: Request, _res: Response, next: NextFunction) => {
    try {
      if (getRealUserCount() === 0) {
        ensureHydratedFromPersistentBackupSync();
      }
    } catch (err) {
      console.warn('[Recovery Middleware] Hydration check warning:', err);
    }
    next();
  });

  // Keep WAL flushed, recovery snapshot fresh, and admin browser vault synced after any successful mutating API request
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.path.startsWith('/api/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !req.path.startsWith('/api/admin/backups') &&
      !(req.method === 'DELETE' && req.path.startsWith('/api/admin/users/')) &&
      req.path !== '/api/auth/logout'
    ) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          scheduleAutoRecoverySnapshot('auto-mutation');
          broadcastToAdmins({ type: 'admin:vault_dirty' });
        }
      });
    }
    next();
  });

  // Serve uploaded attachments cleanly; never fall through to SPA HTML on missing upload files
  app.use('/uploads', express.static(uploadsDir), (_req: Request, res: Response) => {
    res.status(404).end();
  });

  // Download route forcing attachment disposition when requested
  app.get('/api/uploads/download/:filename', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(uploadsDir, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Attachment not found.' });
      return;
    }
    const originalName = typeof req.query.name === 'string' && req.query.name.trim()
      ? path.basename(req.query.name.trim())
      : safeName;
    res.download(fullPath, originalName);
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, smtpConfigured: isSmtpConfigured() });
  });

  // ---------------- AUTHENTICATION ----------------
  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    const tokens = extractSessionTokens(req);
    let activeToken: string | undefined;
    let user: AuthUser | undefined;
    let needsPassportRestore = false;
    let sessionRevoked = false;

    for (const candidate of tokens) {
      const resolved = resolveSessionToken(candidate);
      if (resolved.user) {
        activeToken = candidate;
        user = resolved.user;
        break;
      }
      if (resolved.revoked) {
        sessionRevoked = true;
      }
      if (resolved.needsPassportRestore) {
        needsPassportRestore = true;
      }
    }

    if (!user) {
      res.json({
        user: null,
        dbEmpty: getRealUserCount() === 0,
        needsPassportRestore,
        sessionRevoked,
      });
      return;
    }

    if (activeToken) {
      const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
        activeToken,
        user.id,
        nextExpiry.toISOString()
      );
      setSessionCookie(req, res, activeToken, nextExpiry);
    }

    res.json({
      user,
      sessionToken: activeToken,
      accountPassport: buildAccountPassportForUser(user.id),
    });
  });

  app.post('/api/auth/restore-passport', (req: Request, res: Response) => {
    const sessionToken =
      String(req.body?.sessionToken || '').trim() || extractSessionToken(req) || '';
    const passportToken = String(req.body?.passport || '').trim();

    if (!sessionToken || !passportToken) {
      res.status(400).json({ error: 'Session token and encrypted account passport are required.' });
      return;
    }

    if (isTokenRevoked(sessionToken)) {
      res.status(401).json({ error: 'Session has been logged out.' });
      return;
    }

    const jwtPayload = verifySessionJwt(sessionToken);
    if (!jwtPayload) {
      res.status(401).json({ error: 'Session token is invalid or expired.' });
      return;
    }

    const passportData = decryptSignedJson<AccountPassportPayload>('user-passport', passportToken);
    if (!passportData || passportData.v !== 1 || !passportData.user?.email) {
      res.status(400).json({ error: 'Encrypted account passport is invalid.' });
      return;
    }

    if (passportData.user.email.trim().toLowerCase() !== jwtPayload.email.trim().toLowerCase()) {
      res.status(403).json({ error: 'Account passport does not match the active session user.' });
      return;
    }

    try {
      const restoredId = restoreUserPassportRecord(passportData);
      const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
        sessionToken,
        restoredId,
        nextExpiry.toISOString()
      );
      db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(restoredId);
      setSessionCookie(req, res, sessionToken, nextExpiry);

      const restoredRow = db
        .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
        .get(restoredId) as DbUserRow | undefined;

      if (!restoredRow) {
        res.status(500).json({ error: 'Failed to load restored user account.' });
        return;
      }

      checkpointDatabase();
      writeRecoverySnapshotSync('passport-session-resume');

      res.json({
        ok: true,
        restored: true,
        user: serializeAuthUser(restoredRow),
        sessionToken,
        accountPassport: buildAccountPassportForUser(restoredId),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to restore account passport.';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword =
      req.body?.confirmPassword !== undefined ? String(req.body.confirmPassword) : undefined;
    const birthday = String(req.body?.birthday || '').trim();
    const grade = String(req.body?.grade || '').trim();

    if (name.length < 2) {
      res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      res.status(400).json({ error: 'Please enter a valid birthday date (YYYY-MM-DD).' });
      return;
    }

    const existing = db
      .prepare('SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email) as { id: number; password_hash: string } | undefined;

    const isMainAdmin = email === TEACHER_EMAIL.toLowerCase();
    const claimingPendingAdmin =
      Boolean(existing) &&
      existing!.password_hash === BOOTSTRAP_PENDING_HASH &&
      isMainAdmin;

    if (existing && !claimingPendingAdmin) {
      res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
      return;
    }

    const role: 'student' | 'teacher' = isMainAdmin ? 'teacher' : 'student';
    const isAdminFlag = isMainAdmin ? 1 : 0;

    const passwordHash = await bcrypt.hash(password, 10);
    const bio =
      role === 'teacher'
        ? 'Science Teacher | Web Developer passionate about Grade 9 science education and building interactive educational tools.'
        : '';

    let userId: number;
    if (claimingPendingAdmin && existing) {
      db.prepare(
        `UPDATE users
         SET name = ?, password_hash = ?, role = 'teacher', is_admin = 1, grade = ?, bio = ?, birthday = ?,
             last_login_at = datetime('now'), last_active_at = datetime('now')
         WHERE id = ?`
      ).run(name, passwordHash, grade, bio, birthday, existing.id);
      userId = existing.id;
    } else {
      const result = db
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, is_admin, grade, bio, birthday)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(name, email, passwordHash, role, isAdminFlag, grade, bio, birthday);
      userId = Number(result.lastInsertRowid);
      db.prepare(
        "UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?"
      ).run(userId);
    }

    ensureMainAdminPermissions();
    logStudentActivity(
      userId,
      'register',
      role === 'teacher' ? 'Registered administrator account' : 'Created student account',
      'user',
      userId
    );
    const createdRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(userId) as DbUserRow;
    const user = serializeAuthUser(createdRow);

    // Create a welcome notification for newly registered student
    if (role === 'student') {
      db.prepare(
        `INSERT INTO notifications (user_id, title, body, category, link_tab)
         VALUES (?, ?, ?, 'announcement', 'home')`
      ).run(
        userId,
        'Welcome to Grade 9 Hub',
        'Your account is ready. Explore the 11 chapters, General Questions, Student Community, Ask Your Teacher, and Science AI Studio.'
      );
    }

    const { token, expiresAt } = createSessionForUser(userId);
    setSessionCookie(req, res, token, expiresAt);
    checkpointDatabase();
    writeRecoverySnapshotSync('user-register');

    res.status(201).json({
      user,
      sessionToken: token,
      accountPassport: buildAccountPassportForUser(userId),
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const clientPassportToken =
      typeof req.body?.passport === 'string' ? req.body.passport.trim() : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    let row = db
      .prepare(
        `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`
      )
      .get(email) as (DbUserRow & { password_hash: string }) | undefined;

    if (!row || row.password_hash === BOOTSTRAP_PENDING_HASH) {
      // First check tracked server-side persistent backup (survives URL changes & container rebuilds)
      if (restoreMissingUserFromPersistentBackupSync(email)) {
        row = db
          .prepare(
            `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`
          )
          .get(email) as (DbUserRow & { password_hash: string }) | undefined;
      }
    }

    const isPrivilegedAccount =
      email === TEACHER_EMAIL.toLowerCase() ||
      Boolean(row && (row.role === 'teacher' || row.is_admin));

    if (isPrivilegedAccount) {
      if (!row || row.password_hash === BOOTSTRAP_PENDING_HASH) {
        // Universal client-side auto-recovery: if server DB lost this account across a container reset,
        // decrypt & verify the user's server-signed encrypted passport and bcrypt password hash before restoring!
        let restoredViaPassport = false;
        if (clientPassportToken) {
          const passportData = decryptSignedJson<AccountPassportPayload>(
            'user-passport',
            clientPassportToken
          );
          if (
            passportData &&
            passportData.v === 1 &&
            passportData.user?.email?.trim().toLowerCase() === email &&
            passportData.user.password_hash &&
            passportData.user.password_hash !== BOOTSTRAP_PENDING_HASH
          ) {
            const passportPasswordOk = await bcrypt.compare(
              password,
              passportData.user.password_hash
            );
            if (passportPasswordOk) {
              restoreUserPassportRecord(passportData);
              row = db
                .prepare(
                  `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`
                )
                .get(email) as (DbUserRow & { password_hash: string }) | undefined;
              restoredViaPassport = Boolean(row && row.password_hash !== BOOTSTRAP_PENDING_HASH);
            }
          }
        }

        if (!restoredViaPassport) {
          const dbEmpty = getRealUserCount() === 0;
          res.status(401).json({
            error: 'Invalid email or password.',
            dbEmpty,
            bootstrapPending: row?.password_hash === BOOTSTRAP_PENDING_HASH,
          });
          return;
        }
      } else if (row.password_hash.startsWith('!FIREBASE_GOOGLE_LINKED!')) {
        res.status(401).json({
          error:
            'This account uses Google Sign-In. Please click "Continue with Google" above or use Forgot Password to set an email password.',
          dbEmpty: false,
          googleLinkedOnly: true,
        });
        return;
      } else {
        const matches = await bcrypt.compare(password, row.password_hash);
        if (!matches) {
          res.status(401).json({ error: 'Invalid email or password.', dbEmpty: false });
          return;
        }
      }
    } else if (!row || row.password_hash === BOOTSTRAP_PENDING_HASH) {
      // Instant student login: automatically initialize/create a student account on the fly
      const localPart = email.split('@')[0] || '';
      const cleanedName = localPart
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
        .slice(0, 48);
      const derivedName = cleanedName.length >= 2 ? cleanedName : 'Grade 9 Student';
      const passwordHash = await bcrypt.hash(password, 10);

      let userId: number;
      if (row && row.password_hash === BOOTSTRAP_PENDING_HASH) {
        db.prepare(
          `UPDATE users
           SET name = CASE WHEN LENGTH(TRIM(name)) >= 2 THEN name ELSE ? END,
               password_hash = ?,
               role = 'student',
               is_admin = 0,
               last_login_at = datetime('now'),
               last_active_at = datetime('now')
           WHERE id = ?`
        ).run(derivedName, passwordHash, row.id);
        userId = row.id;
      } else {
        const result = db
          .prepare(
            `INSERT INTO users (name, email, password_hash, role, is_admin, grade, bio, birthday)
             VALUES (?, ?, ?, 'student', 0, '', '', '')`
          )
          .run(derivedName, email, passwordHash);
        userId = Number(result.lastInsertRowid);
        db.prepare(
          `INSERT INTO notifications (user_id, title, body, category, link_tab)
           VALUES (?, ?, ?, 'announcement', 'home')`
        ).run(
          userId,
          'Welcome to Grade 9 Hub',
          'Your account is ready. Explore the 11 chapters, General Questions, Student Community, Ask Your Teacher, and Science AI Studio.'
        );
        logStudentActivity(userId, 'register', 'Created student account', 'user', userId);
      }

      row = db
        .prepare(
          `SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE id = ?`
        )
        .get(userId) as (DbUserRow & { password_hash: string }) | undefined;
    }

    if (!row) {
      res.status(500).json({ error: 'Unable to initialize student session.' });
      return;
    }

    if (
      row.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() &&
      (row.role !== 'teacher' || !row.is_admin)
    ) {
      db.prepare("UPDATE users SET role = 'teacher', is_admin = 1 WHERE id = ?").run(row.id);
      row.role = 'teacher';
      row.is_admin = 1;
    }

    const { token, expiresAt } = createSessionForUser(row.id);
    setSessionCookie(req, res, token, expiresAt);
    db.prepare("UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?").run(
      row.id
    );
    logStudentActivity(row.id, 'login', 'Signed in to Grade 9 Hub', 'user', row.id);
    const freshRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(row.id) as DbUserRow;
    checkpointDatabase();
    writeRecoverySnapshotSync('user-login');

    res.json({
      user: serializeAuthUser(freshRow),
      sessionToken: token,
      accountPassport: buildAccountPassportForUser(row.id),
    });
  });

  app.post('/api/auth/firebase-login', async (req: Request, res: Response) => {
    const idToken = String(req.body?.idToken || '').trim();
    const cloudProfile = (req.body?.cloudProfile || null) as {
      name?: string;
      grade?: string;
      bio?: string;
      birthday?: string;
      avatarUrl?: string;
      notificationsEnabled?: boolean;
      notifPromptStatus?: string;
      totalPoints?: number;
    } | null;
    const cloudAttempts = Array.isArray(req.body?.cloudAttempts)
      ? (req.body.cloudAttempts as Array<{
          mode?: string;
          chapterNumber?: number | null;
          totalQuestions?: number;
          correctCount?: number;
          scorePercent?: number;
          pointsAwarded?: number;
        }>)
      : [];

    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token is required.' });
      return;
    }

    let identity;
    try {
      identity = await verifyFirebaseIdToken(idToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify social sign-in token.';
      res.status(401).json({ error: msg });
      return;
    }

    const isFacebook = identity.provider === 'facebook.com';
    const providerLabel = isFacebook ? 'Facebook' : 'Google';
    const markerPrefix = isFacebook ? '!FIREBASE_FACEBOOK_LINKED!' : '!FIREBASE_GOOGLE_LINKED!';

    const email = identity.email.trim().toLowerCase();
    const isMainAdmin = identity.emailVerified && email === TEACHER_EMAIL.toLowerCase();
    const safeRole: 'student' | 'teacher' = isMainAdmin ? 'teacher' : 'student';
    const isAdminFlag = isMainAdmin ? 1 : 0;

    if (!identity.emailVerified && email === TEACHER_EMAIL.toLowerCase()) {
      res.status(401).json({ error: 'Verified email is required to access this administrator account.' });
      return;
    }

    let row = db
      .prepare(`SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`)
      .get(email) as (DbUserRow & { password_hash: string }) | undefined;

    if (!row || row.password_hash === BOOTSTRAP_PENDING_HASH) {
      restoreMissingUserFromPersistentBackupSync(email);
      row = db
        .prepare(`SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`)
        .get(email) as (DbUserRow & { password_hash: string }) | undefined;
    }

    if (row && !identity.emailVerified && (row.is_admin || row.role === 'teacher')) {
      res.status(401).json({ error: 'Verified email is required to access this teacher account.' });
      return;
    }

    const preferredName =
      String(
        cloudProfile?.name ||
          identity.name ||
          (isMainAdmin
            ? 'Mr. Kasrawan'
            : email.startsWith('fb_')
            ? 'Facebook Student'
            : email.split('@')[0])
      )
        .trim()
        .slice(0, 120) || 'Grade 9 User';
    const cloudAvatar = String(cloudProfile?.avatarUrl || '').trim();
    const fallbackBio = isMainAdmin
      ? 'Science Teacher | Web Developer passionate about Grade 9 science education and building interactive educational tools.'
      : '';

    let userId: number;
    if (!row) {
      const markerHash = `${markerPrefix}${crypto.randomUUID()}`;
      const inserted = db
        .prepare(
          `INSERT INTO users (
             name, email, password_hash, role, is_admin, grade, bio, birthday, avatar_url,
             notif_prompt_status, notifications_enabled, last_login_at, last_active_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .run(
          preferredName,
          email,
          markerHash,
          safeRole,
          isAdminFlag,
          String(cloudProfile?.grade || '').slice(0, 40),
          String(cloudProfile?.bio || fallbackBio).slice(0, 500),
          String(cloudProfile?.birthday || '').slice(0, 20),
          cloudAvatar.startsWith('data:image/') ? cloudAvatar : '',
          cloudProfile?.notifPromptStatus === 'allowed' || cloudProfile?.notifPromptStatus === 'denied'
            ? cloudProfile.notifPromptStatus
            : '',
          cloudProfile?.notificationsEnabled === false ? 0 : 1
        );
      userId = Number(inserted.lastInsertRowid);
      logStudentActivity(
        userId,
        'register',
        isMainAdmin
          ? `Signed in as administrator with ${providerLabel}`
          : `Created student account with ${providerLabel}`,
        'user',
        userId
      );
      if (safeRole === 'student') {
        db.prepare(
          `INSERT INTO notifications (user_id, title, body, category, link_tab)
           VALUES (?, ?, ?, 'announcement', 'home')`
        ).run(
          userId,
          'Welcome to Grade 9 Hub',
          `Your ${providerLabel} account is ready. Your progress and account are safely backed up across updates.`
        );
      }
    } else if (row.password_hash === BOOTSTRAP_PENDING_HASH) {
      const markerHash = `${markerPrefix}${crypto.randomUUID()}`;
      db.prepare(
        `UPDATE users
         SET name = ?, password_hash = ?, role = ?, is_admin = ?,
             grade = COALESCE(NULLIF(?, ''), grade),
             bio = COALESCE(NULLIF(?, ''), bio),
             birthday = COALESCE(NULLIF(?, ''), birthday),
             avatar_url = CASE WHEN ? != '' AND avatar_url = '' THEN ? ELSE avatar_url END,
             last_login_at = datetime('now'), last_active_at = datetime('now')
         WHERE id = ?`
      ).run(
        preferredName,
        markerHash,
        safeRole,
        isAdminFlag,
        String(cloudProfile?.grade || '').slice(0, 40),
        String(cloudProfile?.bio || fallbackBio).slice(0, 500),
        String(cloudProfile?.birthday || '').slice(0, 20),
        cloudAvatar.startsWith('data:image/') ? cloudAvatar : '',
        cloudAvatar.startsWith('data:image/') ? cloudAvatar : '',
        row.id
      );
      userId = row.id;
    } else {
      userId = row.id;
      const nextAvatar =
        cloudAvatar.startsWith('data:image/') && (!row.avatar_url || row.avatar_url.startsWith('/uploads/'))
          ? cloudAvatar
          : row.avatar_url || '';
      db.prepare(
        `UPDATE users
         SET role = ?, is_admin = ?,
             avatar_url = ?,
             grade = COALESCE(NULLIF(grade, ''), ?),
             bio = COALESCE(NULLIF(bio, ''), ?),
             birthday = COALESCE(NULLIF(birthday, ''), ?),
             last_login_at = datetime('now'), last_active_at = datetime('now')
         WHERE id = ?`
      ).run(
        isMainAdmin ? 'teacher' : row.role,
        isMainAdmin ? 1 : row.is_admin ? 1 : 0,
        nextAvatar,
        String(cloudProfile?.grade || '').slice(0, 40),
        String(cloudProfile?.bio || '').slice(0, 500),
        String(cloudProfile?.birthday || '').slice(0, 20),
        userId
      );
      logStudentActivity(userId, 'login', `Signed in via ${providerLabel}`, 'user', userId);
    }

    // Merge cloud competition points if SQLite has fewer points (e.g., after container rebuild)
    const cloudPoints = Math.max(0, Math.round(Number(cloudProfile?.totalPoints || 0)));
    const currentPoints = getUserCompetitionTotal(userId);
    if (!isMainAdmin && cloudPoints > currentPoints) {
      const diff = cloudPoints - currentPoints;
      db.prepare(
        `INSERT OR IGNORE INTO competition_point_events
           (user_id, event_key, event_type, points, chapter_number, details)
         VALUES (?, ?, 'curriculum_activity', ?, NULL, 'Restored from Firebase Cloud')`
      ).run(userId, `cloud-restore-${userId}-${cloudPoints}`, diff);
    }

    if (cloudAttempts.length > 0) {
      const existingCountRow = db
        .prepare('SELECT COUNT(*) AS cnt FROM quiz_attempts WHERE user_id = ?')
        .get(userId) as { cnt: number };
      if ((existingCountRow?.cnt || 0) === 0) {
        const insertAttempt = db.prepare(
          `INSERT INTO quiz_attempts (user_id, mode, chapter_number, total_questions, correct_count, score_percent, answers_json)
           VALUES (?, ?, ?, ?, ?, ?, '{}')`
        );
        for (const a of cloudAttempts.slice(0, 100)) {
          const mode =
            a.mode === 'all_chapters' || a.mode === 'general' ? a.mode : 'chapter';
          const chNum =
            a.chapterNumber && a.chapterNumber >= 1 && a.chapterNumber <= 11
              ? Number(a.chapterNumber)
              : null;
          insertAttempt.run(
            userId,
            mode,
            chNum,
            Number(a.totalQuestions || 0),
            Number(a.correctCount || 0),
            Number(a.scorePercent || 0)
          );
        }
      }
    }

    ensureMainAdminPermissions();
    const { token, expiresAt } = createSessionForUser(userId);
    setSessionCookie(req, res, token, expiresAt);
    const freshRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(userId) as DbUserRow;
    checkpointDatabase();
    writeRecoverySnapshotSync('firebase-google-login');

    const compTotal = getUserCompetitionTotal(userId);
    const quizStatsRow = db
      .prepare(
        `SELECT COALESCE(COUNT(*), 0) AS quizzes, COALESCE(SUM(correct_count), 0) AS correct
         FROM quiz_attempts WHERE user_id = ?`
      )
      .get(userId) as { quizzes: number; correct: number } | undefined;

    res.json({
      user: serializeAuthUser(freshRow),
      sessionToken: token,
      accountPassport: buildAccountPassportForUser(userId),
      stats: {
        totalPoints: compTotal,
        quizzesCompleted: Number(quizStatsRow?.quizzes || 0),
        correctAnswers: Number(quizStatsRow?.correct || 0),
      },
    });
  });

  app.get('/api/auth/facebook/url', (req: Request, res: Response) => {
    const fbAppId = String(process.env.FACEBOOK_APP_ID || '').trim();
    const fbAppSecret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
    let firebaseProjectId = 'gen-lang-client-0277416465';
    try {
      const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
        if (parsed.projectId) firebaseProjectId = parsed.projectId;
      }
    } catch {
      // ignore config read error
    }

    if (!fbAppId || !fbAppSecret) {
      res.json({ configured: false, firebaseProjectId });
      return;
    }

    const baseUrl = String(process.env.APP_URL || `${req.protocol}://${req.get('host')}`)
      .trim()
      .replace(/\/+$/, '');
    const redirectUri = `${baseUrl}/auth/facebook/callback`;
    const stateToken = encryptSignedJson('fb-oauth-state', {
      nonce: crypto.randomUUID(),
      exp: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: fbAppId,
      redirect_uri: redirectUri,
      state: stateToken,
      scope: 'public_profile',
      response_type: 'code',
      display: 'popup',
    });

    res.json({
      configured: true,
      firebaseProjectId,
      url: `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`,
    });
  });

  app.get(['/auth/facebook/callback', '/auth/facebook/callback/'], async (req: Request, res: Response) => {
    const sendPopupResult = (payload: Record<string, unknown>) => {
      const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Facebook Sign-In</title></head>
  <body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF8F5;color:#1C1917;">
    <p>Completing Facebook sign-in...</p>
    <script>
      (function () {
        var data = ${safeJson};
        if (window.opener) {
          window.opener.postMessage(data, '*');
          window.close();
        } else {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`);
    };

    try {
      const fbAppId = String(process.env.FACEBOOK_APP_ID || '').trim();
      const fbAppSecret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
      if (!fbAppId || !fbAppSecret) {
        sendPopupResult({ type: 'FACEBOOK_OAUTH_ERROR', error: 'Facebook OAuth is not configured on the server.' });
        return;
      }

      const errorDesc = String(req.query?.error_description || req.query?.error || '').trim();
      if (errorDesc) {
        sendPopupResult({ type: 'FACEBOOK_OAUTH_ERROR', error: errorDesc });
        return;
      }

      const code = String(req.query?.code || '').trim();
      const state = String(req.query?.state || '').trim();
      const statePayload = decryptSignedJson<{ nonce?: string; exp?: number }>('fb-oauth-state', state);
      if (!code || !statePayload || !statePayload.exp || statePayload.exp < Date.now()) {
        sendPopupResult({ type: 'FACEBOOK_OAUTH_ERROR', error: 'Invalid or expired Facebook sign-in state.' });
        return;
      }

      const baseUrl = String(process.env.APP_URL || `${req.protocol}://${req.get('host')}`)
        .trim()
        .replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/auth/facebook/callback`;

      const tokenParams = new URLSearchParams({
        client_id: fbAppId,
        redirect_uri: redirectUri,
        client_secret: fbAppSecret,
        code,
      });
      const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`);
      const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
      if (!tokenRes.ok || !tokenJson.access_token) {
        sendPopupResult({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: tokenJson.error?.message || 'Unable to exchange Facebook authorization code.',
        });
        return;
      }

      const profileRes = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenJson.access_token)}`
      );
      const profileJson = (await profileRes.json()) as {
        id?: string;
        name?: string;
        email?: string;
        error?: { message?: string };
      };
      if (!profileRes.ok || !profileJson.id) {
        sendPopupResult({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: profileJson.error?.message || 'Unable to read Facebook profile.',
        });
        return;
      }

      const fbUid = String(profileJson.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const rawEmail = String(profileJson.email || '').trim().toLowerCase();
      const email = rawEmail || `fb_${fbUid}@facebook.grade9hub.local`;
      const displayName = String(profileJson.name || 'Facebook Student').trim().slice(0, 120) || 'Facebook Student';

      if (email === TEACHER_EMAIL.toLowerCase()) {
        sendPopupResult({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: 'Please use Google Sign-In or password for administrator access.',
        });
        return;
      }

      let row = db
        .prepare(`SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`)
        .get(email) as (DbUserRow & { password_hash: string }) | undefined;

      if (!row || row.password_hash === BOOTSTRAP_PENDING_HASH) {
        restoreMissingUserFromPersistentBackupSync(email);
        row = db
          .prepare(`SELECT ${USER_SELECT_COLS}, password_hash FROM users WHERE LOWER(email) = LOWER(?)`)
          .get(email) as (DbUserRow & { password_hash: string }) | undefined;
      }

      if (row && (row.is_admin || row.role === 'teacher')) {
        sendPopupResult({
          type: 'FACEBOOK_OAUTH_ERROR',
          error: 'Please use Google Sign-In or password for teacher access.',
        });
        return;
      }

      let userId: number;
      if (!row) {
        const markerHash = `!FIREBASE_FACEBOOK_LINKED!${crypto.randomUUID()}`;
        const inserted = db
          .prepare(
            `INSERT INTO users (name, email, password_hash, role, is_admin, grade, bio, birthday, last_login_at, last_active_at)
             VALUES (?, ?, ?, 'student', 0, '', '', '', datetime('now'), datetime('now'))`
          )
          .run(displayName, email, markerHash);
        userId = Number(inserted.lastInsertRowid);
        logStudentActivity(userId, 'register', 'Created student account with Facebook', 'user', userId);
        db.prepare(
          `INSERT INTO notifications (user_id, title, body, category, link_tab)
           VALUES (?, ?, ?, 'announcement', 'home')`
        ).run(
          userId,
          'Welcome to Grade 9 Hub',
          'Your Facebook account is ready. Explore the 11 chapters, General Questions, and Student Community.'
        );
      } else {
        userId = row.id;
        db.prepare("UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?").run(
          userId
        );
        logStudentActivity(userId, 'login', 'Signed in via Facebook', 'user', userId);
      }

      const { token, expiresAt } = createSessionForUser(userId);
      setSessionCookie(req, res, token, expiresAt);
      const freshRow = db.prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`).get(userId) as DbUserRow;
      checkpointDatabase();
      writeRecoverySnapshotSync('facebook-oauth-login');

      sendPopupResult({
        type: 'FACEBOOK_OAUTH_SUCCESS',
        user: serializeAuthUser(freshRow),
        sessionToken: token,
        accountPassport: buildAccountPassportForUser(userId),
      });
    } catch (err) {
      sendPopupResult({
        type: 'FACEBOOK_OAUTH_ERROR',
        error: err instanceof Error ? err.message : 'Facebook sign-in failed.',
      });
    }
  });

  app.post('/api/admin/cloud-sync', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const incomingAccounts = Array.isArray(req.body?.cloudAccounts)
      ? (req.body.cloudAccounts as Array<{
          email?: string;
          name?: string;
          role?: string;
          isAdmin?: boolean;
          passwordHash?: string;
          grade?: string;
          bio?: string;
          birthday?: string;
          avatarUrl?: string;
          notifPromptStatus?: string;
          notificationsEnabled?: boolean;
          createdAtIso?: string;
        }>)
      : [];

    let restoredCount = 0;
    const tx = db.transaction(() => {
      for (const acct of incomingAccounts) {
        const email = String(acct.email || '').trim().toLowerCase();
        const pwHash = String(acct.passwordHash || '').trim();
        if (!email || !pwHash || pwHash === BOOTSTRAP_PENDING_HASH) continue;

        const isMain = email === TEACHER_EMAIL.toLowerCase();
        const safeRole: 'student' | 'teacher' = isMain
          ? 'teacher'
          : acct.role === 'teacher'
          ? 'teacher'
          : 'student';
        const safeAdmin = isMain ? 1 : acct.isAdmin ? 1 : 0;

        const existing = db
          .prepare('SELECT id, password_hash, avatar_url FROM users WHERE LOWER(email) = LOWER(?)')
          .get(email) as { id: number; password_hash: string; avatar_url: string } | undefined;

        if (!existing) {
          db.prepare(
            `INSERT INTO users (
               name, email, password_hash, role, is_admin, grade, bio, birthday, avatar_url,
               notif_prompt_status, notifications_enabled, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now')))`
          ).run(
            String(acct.name || 'Grade 9 Student').slice(0, 120),
            email,
            pwHash,
            safeRole,
            safeAdmin,
            String(acct.grade || '').slice(0, 40),
            String(acct.bio || '').slice(0, 500),
            String(acct.birthday || '').slice(0, 20),
            String(acct.avatarUrl || ''),
            acct.notifPromptStatus === 'allowed' || acct.notifPromptStatus === 'denied'
              ? acct.notifPromptStatus
              : '',
            acct.notificationsEnabled === false ? 0 : 1,
            String(acct.createdAtIso || '').slice(0, 64)
          );
          restoredCount += 1;
        } else if (existing.password_hash === BOOTSTRAP_PENDING_HASH) {
          db.prepare(
            `UPDATE users
             SET name = ?, password_hash = ?, role = ?, is_admin = ?, grade = ?, bio = ?,
                 birthday = ?, avatar_url = ?
             WHERE id = ?`
          ).run(
            String(acct.name || 'Mr. Kasrawan').slice(0, 120),
            pwHash,
            safeRole,
            safeAdmin,
            String(acct.grade || '').slice(0, 40),
            String(acct.bio || '').slice(0, 500),
            String(acct.birthday || '').slice(0, 20),
            String(acct.avatarUrl || ''),
            existing.id
          );
          restoredCount += 1;
        } else {
          const cloudAvatar = String(acct.avatarUrl || '');
          if (
            cloudAvatar.startsWith('data:image/') &&
            (!existing.avatar_url || existing.avatar_url.startsWith('/uploads/'))
          ) {
            db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(cloudAvatar, existing.id);
          }
        }
      }
      ensureMainAdminPermissions();
    });

    tx();
    checkpointDatabase();
    if (restoredCount > 0) {
      writeRecoverySnapshotSync('cloud-accounts-sync');
    }

    const allUsers = db
      .prepare(
        `SELECT email, name, role, is_admin, password_hash, grade, bio, birthday, avatar_url,
                notif_prompt_status, notifications_enabled, created_at
         FROM users
         WHERE password_hash != ?`
      )
      .all(BOOTSTRAP_PENDING_HASH) as Array<{
      email: string;
      name: string;
      role: 'student' | 'teacher';
      is_admin: number;
      password_hash: string;
      grade: string;
      bio: string;
      birthday: string;
      avatar_url: string;
      notif_prompt_status: string;
      notifications_enabled: number;
      created_at: string;
    }>;

    res.json({
      ok: true,
      restoredCount,
      localAccounts: allUsers.map((u) => ({
        email: u.email,
        name: u.name,
        role: u.role,
        isAdmin: Boolean(u.is_admin),
        passwordHash: u.password_hash,
        grade: u.grade || '',
        bio: u.bio || '',
        birthday: u.birthday || '',
        avatarUrl: u.avatar_url || '',
        notifPromptStatus:
          u.notif_prompt_status === 'allowed' || u.notif_prompt_status === 'denied'
            ? u.notif_prompt_status
            : '',
        notificationsEnabled: u.notifications_enabled !== 0,
        createdAtIso: u.created_at || '',
      })),
    });
  });

  app.get('/api/auth/recovery-status', (_req: Request, res: Response) => {
    const userCount = getRealUserCount();
    res.json({
      dbEmpty: userCount === 0,
      userCount,
    });
  });

  app.post('/api/auth/recover-from-vault', async (req: Request, res: Response) => {
    const mainAdminPending = Boolean(
      db
        .prepare('SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) AND password_hash = ?')
        .get(TEACHER_EMAIL, BOOTSTRAP_PENDING_HASH)
    );
    if (getRealUserCount() > 0 && !mainAdminPending) {
      res.status(409).json({
        error: 'Database already contains active user accounts. Please log in normally or use Admin Dashboard > Backups.',
      });
      return;
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const backup = req.body?.backup as {
      format?: string;
      tables?: { users?: Array<Record<string, unknown>> };
    } | undefined;

    if (!email || !password) {
      res.status(400).json({ error: 'Administrator email and password are required to verify backup recovery.' });
      return;
    }

    if (!backup || backup.format !== 'grade9hub-backup-v1' || !Array.isArray(backup.tables?.users)) {
      res.status(400).json({ error: 'Invalid Grade 9 Hub backup format.' });
      return;
    }

    const targetBackupUser = backup.tables.users.find(
      (u) => String(u.email || '').trim().toLowerCase() === email
    );

    if (!targetBackupUser) {
      res.status(401).json({ error: 'This email address was not found in the provided backup.' });
      return;
    }

    const isPrivilegedBackupUser =
      String(targetBackupUser.role || '') === 'teacher' ||
      Boolean(targetBackupUser.is_admin) ||
      email === TEACHER_EMAIL.toLowerCase();

    if (!isPrivilegedBackupUser) {
      res.status(403).json({ error: 'Only an administrator or teacher account can authorize full database recovery.' });
      return;
    }

    const storedHash = String(targetBackupUser.password_hash || '');
    const passwordMatches = storedHash ? await bcrypt.compare(password, storedHash) : false;
    if (!passwordMatches) {
      res.status(401).json({ error: 'Invalid email or password for the backup administrator account.' });
      return;
    }

    try {
      const result = await restoreFromBackupPayload(backup, 'merge');
      const restoredRow = db
        .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE LOWER(email) = LOWER(?)`)
        .get(email) as DbUserRow | undefined;

      if (!restoredRow) {
        res.status(500).json({ error: 'Backup restored, but administrator account could not be loaded.' });
        return;
      }

      if (
        restoredRow.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() &&
        (restoredRow.role !== 'teacher' || !restoredRow.is_admin)
      ) {
        db.prepare("UPDATE users SET role = 'teacher', is_admin = 1 WHERE id = ?").run(restoredRow.id);
        restoredRow.role = 'teacher';
        restoredRow.is_admin = 1;
      }

      const { token, expiresAt } = createSessionForUser(restoredRow.id);
      setSessionCookie(req, res, token, expiresAt);
      db.prepare("UPDATE users SET last_login_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?").run(
        restoredRow.id
      );
      logStudentActivity(
        restoredRow.id,
        'login',
        `Recovered ${result.restoredCounts.users} accounts from backup vault`,
        'user',
        restoredRow.id
      );
      const freshRow = db
        .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
        .get(restoredRow.id) as DbUserRow;
      checkpointDatabase();
      writeRecoverySnapshotSync('vault-recovery');

      res.json({
        ok: true,
        recovered: true,
        user: serializeAuthUser(freshRow),
        sessionToken: token,
        accountPassport: buildAccountPassportForUser(restoredRow.id),
        restoredCounts: result.restoredCounts,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore backup.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/auth/auto-restore-session', async (req: Request, res: Response) => {
    if (getRealUserCount() > 0) {
      res.status(409).json({ error: 'Database already contains active accounts.' });
      return;
    }

    const sessionToken = String(req.body?.sessionToken || '').trim() || extractSessionToken(req) || '';
    const backup = req.body?.backup as {
      format?: string;
      tables?: {
        users?: Array<Record<string, unknown>>;
        sessions?: Array<Record<string, unknown>>;
      };
    } | undefined;

    if (!sessionToken || sessionToken.length < 16 || isTokenRevoked(sessionToken)) {
      res.status(400).json({ error: 'Active session token is required for automatic session resume.' });
      return;
    }

    if (
      !backup ||
      backup.format !== 'grade9hub-backup-v1' ||
      !Array.isArray(backup.tables?.users) ||
      !Array.isArray(backup.tables?.sessions)
    ) {
      res.status(400).json({ error: 'Invalid backup payload.' });
      return;
    }

    const jwtPayload = verifySessionJwt(sessionToken);
    const matchingSession = backup.tables.sessions.find(
      (s) => String(s.token || '') === sessionToken
    );

    if (!matchingSession && !jwtPayload) {
      res.status(401).json({ error: 'Session token not found in encrypted recovery backup.' });
      return;
    }

    if (matchingSession) {
      const expiresAtMs = new Date(String(matchingSession.expires_at || '')).getTime();
      if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
        res.status(401).json({ error: 'Saved session has expired.' });
        return;
      }
    }

    const backupUser = matchingSession
      ? backup.tables.users.find((u) => Number(u.id) === Number(matchingSession.user_id))
      : backup.tables.users.find(
          (u) => String(u.email || '').trim().toLowerCase() === jwtPayload?.email.toLowerCase()
        );
    if (!backupUser) {
      res.status(401).json({ error: 'Session user not found in backup.' });
      return;
    }

    const backupEmail = String(backupUser.email || '').trim().toLowerCase();
    const isPrivilegedBackupUser =
      String(backupUser.role || '') === 'teacher' ||
      Boolean(backupUser.is_admin) ||
      backupEmail === TEACHER_EMAIL.toLowerCase();

    if (!isPrivilegedBackupUser) {
      res.status(403).json({ error: 'Administrator session required for full database resume.' });
      return;
    }

    try {
      const result = await restoreFromBackupPayload(backup, 'merge');
      const restoredUser = getAuthenticatedUserByToken(sessionToken);
      if (!restoredUser) {
        res.status(500).json({ error: 'Database restored, but session could not be resumed.' });
        return;
      }

      const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      db.prepare('INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
        sessionToken,
        restoredUser.id,
        nextExpiry.toISOString()
      );
      setSessionCookie(req, res, sessionToken, nextExpiry);
      db.prepare("UPDATE users SET last_active_at = datetime('now') WHERE id = ?").run(restoredUser.id);
      checkpointDatabase();
      writeRecoverySnapshotSync('auto-session-resume');

      res.json({
        ok: true,
        restored: true,
        user: restoredUser,
        sessionToken,
        accountPassport: buildAccountPassportForUser(restoredUser.id),
        restoredCounts: result.restoredCounts,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume session from vault.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const cookieToken = req.cookies?.[SESSION_COOKIE];
    const headerToken = extractSessionToken(req);
    const actingUser = getAuthenticatedUserByToken(headerToken || cookieToken);
    if (actingUser) {
      logStudentActivity(actingUser.id, 'logout', 'Logged out of Grade 9 Hub', 'user', actingUser.id);
    }
    const revoke = (tok?: string) => {
      if (!tok || typeof tok !== 'string') return;
      db.prepare('DELETE FROM sessions WHERE token = ?').run(tok);
      db.prepare('INSERT OR IGNORE INTO revoked_sessions (token_hash) VALUES (?)').run(hashToken(tok));
    };
    revoke(cookieToken);
    if (headerToken && headerToken !== cookieToken) {
      revoke(headerToken);
    }
    const isHttps = isHttpsRequest(req);
    res.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });
    checkpointDatabase();
    writeRecoverySnapshotSync('user-logout');
    res.json({ ok: true });
  });

  // ---------------- FORGOT PASSWORD (GMAIL VERIFICATION) ----------------
  app.post('/api/auth/forgot-password/request', async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid registered email address.' });
      return;
    }

    const user = db
      .prepare('SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email) as { id: number; name: string; email: string } | undefined;

    if (!user) {
      res.status(404).json({ error: 'No account found with that email address.' });
      return;
    }

    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Mark previous unused codes for this email as used
    db.prepare('UPDATE password_resets SET used = 1 WHERE LOWER(email) = LOWER(?) AND used = 0').run(email);
    db.prepare(
      'INSERT INTO password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)'
    ).run(email, codeHash, expiresAt);

    const emailResult = await sendVerificationCodeEmail(user.email, user.name, code);
    if (!emailResult.sent) {
      res.status(503).json({
        error: emailResult.error || 'Could not send verification email.',
        smtpConfigured: emailResult.configured,
      });
      return;
    }

    res.json({
      ok: true,
      message: `A 6-digit verification code has been sent to ${user.email}.`,
    });
  });

  app.post('/api/auth/forgot-password/verify', (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    if (!email || !/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Please enter your email and the 6-digit verification code.' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const record = db
      .prepare(
        `SELECT id, expires_at FROM password_resets
         WHERE LOWER(email) = LOWER(?) AND code_hash = ? AND used = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get(email, codeHash) as { id: number; expires_at: string } | undefined;

    if (!record) {
      res.status(400).json({ error: 'Invalid verification code.' });
      return;
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'This verification code has expired. Request a new code.' });
      return;
    }

    db.prepare('UPDATE password_resets SET verified = 1 WHERE id = ?').run(record.id);
    res.json({ ok: true, verified: true });
  });

  app.post('/api/auth/forgot-password/reset', async (req: Request, res: Response) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const record = db
      .prepare(
        `SELECT id, expires_at, verified FROM password_resets
         WHERE LOWER(email) = LOWER(?) AND code_hash = ? AND used = 0 AND verified = 1
         ORDER BY id DESC LIMIT 1`
      )
      .get(email, codeHash) as { id: number; expires_at: string; verified: number } | undefined;

    if (!record) {
      res.status(400).json({ error: 'Please verify your 6-digit code before resetting your password.' });
      return;
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?)').run(passwordHash, email);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(record.id);
    db.prepare(
      'DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE LOWER(email) = LOWER(?))'
    ).run(email);
    checkpointDatabase();
    writeRecoverySnapshotSync('password-reset');

    res.json({ ok: true, message: 'Your password has been updated. You can now log in.' });
  });

  // ---------------- PROFILE ----------------
  app.put('/api/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const name = String(req.body?.name ?? user.name).trim();
    const grade = String(req.body?.grade ?? user.grade).trim();
    const bio = String(req.body?.bio ?? user.bio).trim();
    const birthday = String(req.body?.birthday ?? user.birthday).trim();
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }

    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      res.status(400).json({ error: 'Please enter a valid birthday date (YYYY-MM-DD).' });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      const row = db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(user.id) as { password_hash: string };
      const valid = await bcrypt.compare(currentPassword, row.password_hash);
      if (!valid) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      const newHash = await bcrypt.hash(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);
      const currentToken = extractSessionToken(req);
      if (currentToken) {
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(
          user.id,
          currentToken
        );
      }
    }

    db.prepare('UPDATE users SET name = ?, grade = ?, bio = ?, birthday = ? WHERE id = ?').run(
      name,
      grade,
      bio,
      birthday,
      user.id
    );

    const updatedRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(user.id) as DbUserRow;
    checkpointDatabase();
    writeRecoverySnapshotSync('profile-update');

    res.json({
      user: serializeAuthUser(updatedRow),
      accountPassport: buildAccountPassportForUser(user.id),
    });
  });

  app.post(
    '/api/profile/avatar',
    requireAuth,
    upload.single('avatar'),
    async (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      if (!req.file) {
        res.status(400).json({ error: 'Please choose an image file to upload.' });
        return;
      }

      const tempPath = req.file.path;
      const cleanupTemp = () => {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      };

      if (!req.file.mimetype.startsWith('image/')) {
        cleanupTemp();
        res.status(400).json({ error: 'Only image files (PNG, JPG, WebP, GIF) are allowed.' });
        return;
      }

      let nextUrl = '';
      try {
        const rawBuffer = fs.readFileSync(tempPath);
        nextUrl = await compactAvatarToBase64(rawBuffer, req.file.mimetype);
      } catch (err) {
        cleanupTemp();
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Unable to process image upload.',
        });
        return;
      } finally {
        cleanupTemp();
      }

      if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
        const oldPath = path.join(uploadsDir, path.basename(user.avatar_url));
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch {
            // ignore
          }
        }
      }

      db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(nextUrl, user.id);

      const updatedRow = db
        .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
        .get(user.id) as DbUserRow;
      broadcastAdminDashboard();
      checkpointDatabase();
      writeRecoverySnapshotSync('avatar-update');

      res.json({
        user: serializeAuthUser(updatedRow),
        accountPassport: buildAccountPassportForUser(user.id),
      });
    }
  );

  app.delete('/api/profile/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/')) {
      const oldPath = path.join(uploadsDir, path.basename(user.avatar_url));
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          // ignore
        }
      }
    }

    db.prepare("UPDATE users SET avatar_url = '' WHERE id = ?").run(user.id);
    const updatedRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(user.id) as DbUserRow;
    broadcastAdminDashboard();
    checkpointDatabase();
    writeRecoverySnapshotSync('avatar-remove');

    res.json({
      user: serializeAuthUser(updatedRow),
      accountPassport: buildAccountPassportForUser(user.id),
    });
  });

  // ---------------- ADMIN USER & PERMISSION MANAGEMENT ----------------
  app.get('/api/admin/users', requireTeacher, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT id, name, email, role, is_admin, grade, created_at
         FROM users
         ORDER BY is_admin DESC, CASE WHEN role = 'teacher' THEN 0 ELSE 1 END, id DESC`
      )
      .all() as DbUserRow[];

    res.json({
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() ? 'teacher' : r.role,
        isAdmin: r.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() || Boolean(r.is_admin),
        grade: r.grade,
        created_at: r.created_at,
      })),
    });
  });

  app.put('/api/admin/users/:id/role', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const targetId = Number(req.params.id);
    const target = db
      .prepare('SELECT id, email, role, is_admin FROM users WHERE id = ?')
      .get(targetId) as { id: number; email: string; role: string; is_admin: number } | undefined;

    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    if (target.email.toLowerCase() === TEACHER_EMAIL.toLowerCase()) {
      res.status(400).json({ error: 'The main administrator account (mohamdm791@gmail.com) cannot be demoted.' });
      return;
    }

    const nextRole = req.body?.role === 'teacher' ? 'teacher' : 'student';
    const nextAdmin = nextRole === 'teacher' && req.body?.isAdmin !== false ? 1 : 0;

    db.prepare('UPDATE users SET role = ?, is_admin = ? WHERE id = ?').run(
      nextRole,
      nextAdmin,
      targetId
    );
    checkpointDatabase();
    writeRecoverySnapshotSync('admin-role-update');

    res.json({ ok: true, role: nextRole, isAdmin: Boolean(nextAdmin) });
  });

  app.delete('/api/admin/users/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const requester = req.user!;
    const targetId = Number(req.params.id);
    const target = db
      .prepare('SELECT id, email FROM users WHERE id = ?')
      .get(targetId) as { id: number; email: string } | undefined;

    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if (target.email.toLowerCase() === TEACHER_EMAIL.toLowerCase()) {
      res.status(400).json({ error: 'The main administrator account cannot be deleted.' });
      return;
    }
    if (target.id === requester.id) {
      res.status(400).json({ error: 'You cannot delete your own active account.' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    checkpointDatabase();
    writeRecoverySnapshotSync('admin-delete-user', { allowUserRemoval: true });
    broadcastAdminDashboard();
    res.json({ ok: true });
  });

  // ---------------- ADMIN ANALYTICS, ACTIVE PRESENCE & SEARCH ----------------
  app.get('/api/admin/dashboard', requireTeacher, (_req: AuthenticatedRequest, res: Response) => {
    res.json(computeAdminDashboardSnapshot());
  });

  app.get('/api/admin/students/:id/stats', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const studentId = Number(req.params.id);
    const lang = normalizeLang(req.query.lang);
    const allStudents = buildStudentPerformanceList();
    const student = allStudents.find((s) => s.id === studentId);

    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const attemptRows = db
      .prepare(
        `SELECT qa.id, qa.mode, qa.chapter_number,
                c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar,
                qa.total_questions, qa.correct_count, qa.score_percent, qa.created_at
         FROM quiz_attempts qa
         LEFT JOIN chapters c ON c.chapter_number = qa.chapter_number
         WHERE qa.user_id = ?
         ORDER BY qa.id DESC
         LIMIT 25`
      )
      .all(studentId) as Array<{
      id: number;
      mode: 'all_chapters' | 'chapter' | 'general';
      chapter_number: number | null;
      chapter_title: string | null;
      chapter_title_ku?: string | null;
      chapter_title_ar?: string | null;
      total_questions: number;
      correct_count: number;
      score_percent: number;
      created_at: string;
    }>;

    const attempts = attemptRows.map((a) => ({
      id: a.id,
      mode: a.mode,
      chapter_number: a.chapter_number,
      chapter_title:
        lang === 'ku'
          ? (a.chapter_title_ku || '').trim() || a.chapter_title
          : lang === 'ar'
          ? (a.chapter_title_ar || '').trim() || a.chapter_title
          : a.chapter_title,
      total_questions: a.total_questions,
      correct_count: a.correct_count,
      score_percent: a.score_percent,
      created_at: a.created_at,
    }));

    res.json({ student, attempts });
  });

  app.get('/api/admin/search', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const rawQ = String(req.query.q || '').trim();
    const lang = normalizeLang(req.query.lang);

    if (!rawQ) {
      res.json({ students: [], questions: [], chapters: [], messages: [] });
      return;
    }

    const needle = rawQ.toLowerCase();
    const likePattern = `%${rawQ}%`;

    const students = buildStudentPerformanceList()
      .filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.email.toLowerCase().includes(needle) ||
          s.grade.toLowerCase().includes(needle)
      )
      .slice(0, 12);

    const chapterRows = db
      .prepare(
        `SELECT c.chapter_number, c.title, c.description,
                c.title_ku, c.description_ku, c.title_ar, c.description_ar,
                c.updated_at,
                COUNT(q.id) AS question_count
         FROM chapters c
         LEFT JOIN questions q ON q.scope = 'chapter' AND q.chapter_number = c.chapter_number
         WHERE c.title LIKE ? OR c.description LIKE ?
            OR c.title_ku LIKE ? OR c.description_ku LIKE ?
            OR c.title_ar LIKE ? OR c.description_ar LIKE ?
            OR CAST(c.chapter_number AS TEXT) = ?
         GROUP BY c.chapter_number
         ORDER BY c.chapter_number ASC
         LIMIT 11`
      )
      .all(
        likePattern,
        likePattern,
        likePattern,
        likePattern,
        likePattern,
        likePattern,
        rawQ.replace(/\D/g, '') || '-1'
      ) as RawChapterRow[];

    const chapters = chapterRows.map((row) => pickLocalizedChapter(row, lang));

    const questionRows = db
      .prepare(
        `SELECT q.id, q.scope, q.chapter_number,
                c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar,
                q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation,
                q.question_text_ku, q.option_a_ku, q.option_b_ku, q.option_c_ku, q.option_d_ku, q.explanation_ku,
                q.question_text_ar, q.option_a_ar, q.option_b_ar, q.option_c_ar, q.option_d_ar, q.explanation_ar,
                q.created_at
         FROM questions q
         LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
         WHERE q.question_text LIKE ? OR q.option_a LIKE ? OR q.option_b LIKE ? OR q.option_c LIKE ? OR q.option_d LIKE ? OR q.explanation LIKE ?
            OR q.question_text_ku LIKE ? OR q.option_a_ku LIKE ? OR q.option_b_ku LIKE ? OR q.option_c_ku LIKE ? OR q.option_d_ku LIKE ? OR q.explanation_ku LIKE ?
            OR q.question_text_ar LIKE ? OR q.option_a_ar LIKE ? OR q.option_b_ar LIKE ? OR q.option_c_ar LIKE ? OR q.option_d_ar LIKE ? OR q.explanation_ar LIKE ?
         ORDER BY q.id DESC
         LIMIT 15`
      )
      .all(
        likePattern, likePattern, likePattern, likePattern, likePattern, likePattern,
        likePattern, likePattern, likePattern, likePattern, likePattern, likePattern,
        likePattern, likePattern, likePattern, likePattern, likePattern, likePattern
      ) as RawQuestionRow[];

    const questions = questionRows.map((row) => {
      const loc = getLocalizedQuestionFields(row, lang);
      return {
        id: row.id,
        scope: row.scope,
        chapter_number: row.chapter_number,
        chapter_title: loc.chapterTitle,
        question_text: loc.questionText,
        correct_option: row.correct_option,
      };
    });

    const messages = db
      .prepare(
        `SELECT m.id, m.student_id, st.name AS student_name,
                sender.name AS sender_name, m.sender_role,
                m.message_text, m.attachment_name, m.created_at
         FROM teacher_messages m
         JOIN users st ON st.id = m.student_id
         JOIN users sender ON sender.id = m.sender_id
         WHERE m.message_text LIKE ?
            OR m.attachment_name LIKE ?
            OR st.name LIKE ?
            OR sender.name LIKE ?
         ORDER BY m.id DESC
         LIMIT 15`
      )
      .all(likePattern, likePattern, likePattern, likePattern);

    res.json({ students, questions, chapters, messages });
  });

  // ---------------- DATABASE BACKUP & RECOVERY ----------------
  app.get('/api/admin/backups', requireTeacher, (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      stats: getDatabaseHealthStats(),
      backups: listBackups(),
    });
  });

  app.post('/api/admin/backups', requireTeacher, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await createFullBackup('manual', {
        saveTimestampedDb: true,
        saveTimestampedJson: true,
        forceSnapshot: true,
      });
      res.status(201).json({
        ok: true,
        dbFilename: result.dbFilename,
        jsonFilename: result.jsonFilename,
        counts: result.payload.counts,
        stats: getDatabaseHealthStats(),
        backups: listBackups(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create backup.',
      });
    }
  });

  app.get('/api/admin/backups/export', requireTeacher, (_req: AuthenticatedRequest, res: Response) => {
    const payload = buildPortableBackupPayload('manual-download');
    const dateSlug = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="grade9hub-backup-${dateSlug}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  });

  app.get(
    '/api/admin/backups/download/:filename',
    requireTeacher,
    (req: AuthenticatedRequest, res: Response) => {
      const fullPath = sanitizeBackupFilename(req.params.filename);
      if (!fullPath) {
        res.status(404).json({ error: 'Backup file not found.' });
        return;
      }
      res.download(fullPath, path.basename(fullPath));
    }
  );

  app.post(
    '/api/admin/backups/restore',
    requireTeacher,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
        const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : '';
        const backupPayload = req.body?.backup;

        let result;
        if (filename) {
          result = await restoreFromServerBackupFile(filename, mode);
        } else if (backupPayload) {
          result = await restoreFromBackupPayload(backupPayload, mode);
        } else {
          res.status(400).json({ error: 'Please select a server backup or upload a backup JSON file.' });
          return;
        }

        broadcastAdminDashboard();
        res.json({
          ok: true,
          mode: result.mode,
          restoredCounts: result.restoredCounts,
          safetyBackupFile: result.safetyBackupFile,
          stats: getDatabaseHealthStats(),
          backups: listBackups(),
        });
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to restore backup.',
        });
      }
    }
  );

  app.delete(
    '/api/admin/backups/:filename',
    requireTeacher,
    (req: AuthenticatedRequest, res: Response) => {
      const fullPath = sanitizeBackupFilename(req.params.filename);
      if (!fullPath) {
        res.status(404).json({ error: 'Backup file not found.' });
        return;
      }
      if (path.basename(fullPath) === LATEST_RECOVERY_FILENAME) {
        res.status(400).json({ error: 'The active automatic recovery snapshot cannot be deleted.' });
        return;
      }
      fs.unlinkSync(fullPath);
      res.json({
        ok: true,
        stats: getDatabaseHealthStats(),
        backups: listBackups(),
      });
    }
  );

  // ---------------- CHAPTERS (1..11) ----------------
  app.get('/api/chapters', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const lang = normalizeLang(req.query.lang);
    const rows = db
      .prepare(
        `SELECT c.chapter_number, c.title, c.description,
                c.title_ku, c.description_ku, c.title_ar, c.description_ar,
                c.updated_at,
                COUNT(q.id) AS question_count
         FROM chapters c
         LEFT JOIN questions q ON q.scope = 'chapter' AND q.chapter_number = c.chapter_number
         GROUP BY c.chapter_number
         ORDER BY c.chapter_number ASC`
      )
      .all() as RawChapterRow[];

    const chapters = rows.map((row) => pickLocalizedChapter(row, lang));

    const generalCountRow = db
      .prepare("SELECT COUNT(*) AS count FROM questions WHERE scope = 'general'")
      .get() as { count: number };

    res.json({ chapters, generalCount: generalCountRow.count });
  });

  app.put('/api/chapters/:chapterNumber', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const chapterNumber = Number(req.params.chapterNumber);
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 11) {
      res.status(400).json({ error: 'Chapter number must be between 1 and 11.' });
      return;
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Chapter title is required.' });
      return;
    }

    db.prepare(
      `UPDATE chapters
       SET title = ?, description = ?, title_ku = '', description_ku = '', title_ar = '', description_ar = '', updated_at = datetime('now')
       WHERE chapter_number = ?`
    ).run(title, description, chapterNumber);

    void autoTranslateChapterInBackground(chapterNumber);

    notifyAllStudents({
      title: `Chapter ${chapterNumber} Updated`,
      body: `Mr. Kasrawan updated Chapter ${chapterNumber}: "${title}".`,
      category: 'chapter',
      linkTab: 'multiple-choice',
    });

    const updated = db
      .prepare('SELECT * FROM chapters WHERE chapter_number = ?')
      .get(chapterNumber);
    res.json({ chapter: updated });
  });

  // ---------------- QUESTIONS & QUIZZES ----------------
  app.get('/api/questions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const mode = String(req.query.mode || 'chapter');
    const lang = normalizeLang(req.query.lang);
    const chapterNumber = req.query.chapterNumber ? Number(req.query.chapterNumber) : null;

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    const selectCols = `
      q.id, q.scope, q.chapter_number,
      c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar,
      q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation,
      q.question_text_ku, q.option_a_ku, q.option_b_ku, q.option_c_ku, q.option_d_ku, q.explanation_ku,
      q.question_text_ar, q.option_a_ar, q.option_b_ar, q.option_c_ar, q.option_d_ar, q.explanation_ar,
      q.created_at
    `;

    let rows: RawQuestionRow[] = [];

    if (mode === 'all_chapters') {
      rows = db
        .prepare(
          `SELECT ${selectCols}
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           WHERE q.scope = 'chapter'
           ORDER BY q.chapter_number ASC, q.id ASC`
        )
        .all() as RawQuestionRow[];
    } else if (mode === 'general') {
      rows = db
        .prepare(
          `SELECT ${selectCols}
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           WHERE q.scope = 'general'
           ORDER BY q.id ASC`
        )
        .all() as RawQuestionRow[];
    } else if (chapterNumber && chapterNumber >= 1 && chapterNumber <= 11) {
      rows = db
        .prepare(
          `SELECT ${selectCols}
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           WHERE q.scope = 'chapter' AND q.chapter_number = ?
           ORDER BY q.id ASC`
        )
        .all(chapterNumber) as RawQuestionRow[];
    } else if (isPrivileged) {
      rows = db
        .prepare(
          `SELECT ${selectCols}
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           ORDER BY q.scope ASC, q.chapter_number ASC, q.id ASC`
        )
        .all() as RawQuestionRow[];
    }

    res.json({
      questions: rows.map((row) => serializeQuestionForClient(row, lang, isPrivileged)),
    });
  });

  app.post('/api/questions', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const scope = req.body?.scope === 'general' ? 'general' : 'chapter';
    const chapterNumber =
      scope === 'chapter' ? Number(req.body?.chapterNumber) : null;

    if (scope === 'chapter' && (!Number.isInteger(chapterNumber) || chapterNumber! < 1 || chapterNumber! > 11)) {
      res.status(400).json({ error: 'Chapter number must be between 1 and 11.' });
      return;
    }

    const questionText = String(req.body?.questionText || '').trim();
    const optionA = String(req.body?.optionA || '').trim();
    const optionB = String(req.body?.optionB || '').trim();
    const optionC = String(req.body?.optionC || '').trim();
    const optionD = String(req.body?.optionD || '').trim();
    const correctOption = String(req.body?.correctOption || '').trim().toUpperCase();
    const explanation = String(req.body?.explanation || '').trim();

    if (!questionText || !optionA || !optionB || !optionC || !optionD) {
      res.status(400).json({ error: 'Question text and all four options (A, B, C, D) are required.' });
      return;
    }
    if (!['A', 'B', 'C', 'D'].includes(correctOption)) {
      res.status(400).json({ error: 'Correct option must be A, B, C, or D.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO questions (scope, chapter_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        scope,
        chapterNumber,
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        explanation,
        user.id
      );

    const newId = Number(result.lastInsertRowid);
    void autoTranslateQuestionInBackground(newId);

    const targetLabel = scope === 'general' ? 'General Questions' : `Chapter ${chapterNumber}`;
    notifyAllStudents({
      title: `New Question in ${targetLabel}`,
      body: `Mr. Kasrawan added a new question to ${targetLabel}.`,
      category: 'question',
      linkTab: scope === 'general' ? 'general-questions' : 'multiple-choice',
    });

    const created = db.prepare('SELECT * FROM questions WHERE id = ?').get(newId);
    res.status(201).json({ question: created });
  });

  app.post('/api/questions/bulk', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const items = Array.isArray(req.body?.questions) ? req.body.questions : [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Please provide at least one question to import.' });
      return;
    }

    const insertStmt = db.prepare(
      `INSERT INTO questions (scope, chapter_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const chaptersAffected = new Set<string>();
    const insertedIds: number[] = [];

    const tx = db.transaction(() => {
      for (const item of items) {
        const scope = item.scope === 'general' ? 'general' : 'chapter';
        const chapterNumber = scope === 'chapter' ? Number(item.chapterNumber) : null;
        if (scope === 'chapter' && (!Number.isInteger(chapterNumber) || chapterNumber! < 1 || chapterNumber! > 11)) {
          throw new Error('All chapter questions must belong to Chapter 1–11.');
        }
        const qt = String(item.questionText || '').trim();
        const a = String(item.optionA || '').trim();
        const b = String(item.optionB || '').trim();
        const c = String(item.optionC || '').trim();
        const d = String(item.optionD || '').trim();
        const corr = String(item.correctOption || '').trim().toUpperCase();
        const exp = String(item.explanation || '').trim();

        if (!qt || !a || !b || !c || !d || !['A', 'B', 'C', 'D'].includes(corr)) {
          throw new Error('Each question requires full text, options A-D, and a valid correct answer (A, B, C, or D).');
        }

        const r = insertStmt.run(scope, chapterNumber, qt, a, b, c, d, corr, exp, user.id);
        insertedIds.push(Number(r.lastInsertRowid));
        chaptersAffected.add(scope === 'general' ? 'General Questions' : `Chapter ${chapterNumber}`);
      }
    });

    try {
      tx();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Bulk import failed.' });
      return;
    }

    for (const qId of insertedIds) {
      void autoTranslateQuestionInBackground(qId);
    }

    const summary = Array.from(chaptersAffected).join(', ');
    notifyAllStudents({
      title: `${items.length} New Questions Added`,
      body: `Mr. Kasrawan published ${items.length} new questions in ${summary}.`,
      category: 'question',
      linkTab: 'multiple-choice',
    });

    res.status(201).json({ ok: true, count: items.length });
  });

  app.put('/api/questions/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const scope = req.body?.scope === 'general' ? 'general' : 'chapter';
    const chapterNumber = scope === 'chapter' ? Number(req.body?.chapterNumber) : null;
    if (scope === 'chapter' && (!Number.isInteger(chapterNumber) || chapterNumber! < 1 || chapterNumber! > 11)) {
      res.status(400).json({ error: 'Chapter number must be between 1 and 11.' });
      return;
    }

    const questionText = String(req.body?.questionText || '').trim();
    const optionA = String(req.body?.optionA || '').trim();
    const optionB = String(req.body?.optionB || '').trim();
    const optionC = String(req.body?.optionC || '').trim();
    const optionD = String(req.body?.optionD || '').trim();
    const correctOption = String(req.body?.correctOption || '').trim().toUpperCase();
    const explanation = String(req.body?.explanation || '').trim();

    if (!questionText || !optionA || !optionB || !optionC || !optionD || !['A', 'B', 'C', 'D'].includes(correctOption)) {
      res.status(400).json({ error: 'Valid question text, options A-D, and correct option are required.' });
      return;
    }

    db.prepare(
      `UPDATE questions
       SET scope = ?, chapter_number = ?, question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, explanation = ?,
           question_text_ku = '', option_a_ku = '', option_b_ku = '', option_c_ku = '', option_d_ku = '', explanation_ku = '',
           question_text_ar = '', option_a_ar = '', option_b_ar = '', option_c_ar = '', option_d_ar = '', explanation_ar = '',
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(scope, chapterNumber, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, id);

    void autoTranslateQuestionInBackground(id);

    const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    res.json({ question: updated });
  });

  app.delete('/api/questions/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/quizzes/check-answer', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const questionId = Number(req.body?.questionId);
    const selectedOption = String(req.body?.selectedOption || '').trim().toUpperCase();
    const lang = normalizeLang(req.body?.lang);

    if (!Number.isInteger(questionId) || !['A', 'B', 'C', 'D'].includes(selectedOption)) {
      res.status(400).json({ error: 'Valid question ID and answer choice (A, B, C, or D) are required.' });
      return;
    }

    const q = db
      .prepare(
        `SELECT id, scope, chapter_number, NULL AS chapter_title,
                question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
                question_text_ku, option_a_ku, option_b_ku, option_c_ku, option_d_ku, explanation_ku,
                question_text_ar, option_a_ar, option_b_ar, option_c_ar, option_d_ar, explanation_ar,
                created_at
         FROM questions
         WHERE id = ?`
      )
      .get(questionId) as RawQuestionRow | undefined;

    if (!q) {
      res.status(404).json({ error: 'Question not found.' });
      return;
    }

    const loc = getLocalizedQuestionFields(q, lang);

    const optionMap: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: loc.optionA,
      B: loc.optionB,
      C: loc.optionC,
      D: loc.optionD,
    };

    const isCorrect = selectedOption === q.correct_option;
    const correctOptionText = optionMap[q.correct_option];
    const selectedOptionText = optionMap[selectedOption as 'A' | 'B' | 'C' | 'D'];
    const storedExplanation = (loc.explanation || '').trim();
    const fallbackExplanation =
      lang === 'ku'
        ? `هەڵبژاردنی ${q.correct_option} («${correctOptionText}») وەڵامە دروستەکەی ئەم پرسیارەیە.`
        : lang === 'ar'
        ? `الخيار ${q.correct_option} («${correctOptionText}») هو الإجابة الصحيحة لهذا السؤال.`
        : `Option ${q.correct_option} ("${correctOptionText}") is the correct answer for this curriculum question.`;
    const explanation = storedExplanation || fallbackExplanation;

    const wrongReason = isCorrect
      ? undefined
      : buildWrongOptionExplanation({
          questionText: loc.questionText,
          selectedOption: selectedOption as 'A' | 'B' | 'C' | 'D',
          selectedOptionText,
          correctOption: q.correct_option,
          correctOptionText,
          trueExplanation: explanation,
          lang,
        });

    const actingUser = req.user!;
    const ansRes = db
      .prepare('INSERT INTO student_question_answers (user_id, question_id, is_correct) VALUES (?, ?, ?)')
      .run(actingUser.id, q.id, isCorrect ? 1 : 0);

    let pointsAwarded = 0;
    let totalPoints = getUserCompetitionTotal(actingUser.id);
    if (isCorrect) {
      const pts = awardCompetitionPoints({
        userId: actingUser.id,
        eventKey: `sqa-${ansRes.lastInsertRowid}`,
        eventType: 'correct_answer',
        points: COMPETITION_RULES.correctAnswer,
        chapterNumber: q.chapter_number,
        details: `Question #${q.id}`,
      });
      pointsAwarded = pts.awarded;
      totalPoints = pts.totalPoints;
    }

    touchUserActivity(actingUser.id);
    logStudentActivity(
      actingUser.id,
      'question_answered',
      `Question #${q.id} (${isCorrect ? 'Correct' : 'Incorrect'})`,
      'question',
      q.id
    );
    broadcastAdminDashboard();
    checkpointDatabase();
    writeRecoverySnapshotSync('question-answered');

    res.json({
      questionId: q.id,
      selectedOption,
      selectedOptionText,
      correctOption: q.correct_option,
      correctOptionText,
      isCorrect,
      explanation,
      wrongReason,
      pointsAwarded,
      totalPoints,
      accountPassport: buildAccountPassportForUser(actingUser.id),
    });
  });

  app.post('/api/quizzes/submit', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const mode = req.body?.mode as 'all_chapters' | 'chapter' | 'general';
    const chapterNumber =
      mode === 'chapter' ? Number(req.body?.chapterNumber) : null;
    const answers = (req.body?.answers || {}) as Record<string, string>;
    const lang = normalizeLang(req.body?.lang);
    const skipSave = Boolean(req.body?.skipSave);

    if (!['all_chapters', 'chapter', 'general'].includes(mode)) {
      res.status(400).json({ error: 'Invalid quiz mode.' });
      return;
    }

    let questionRows: RawQuestionRow[] = [];

    if (mode === 'all_chapters') {
      questionRows = db
        .prepare(
          `SELECT q.*, c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           WHERE q.scope = 'chapter'
           ORDER BY q.chapter_number ASC, q.id ASC`
        )
        .all() as RawQuestionRow[];
    } else if (mode === 'general') {
      questionRows = db
        .prepare(
          `SELECT q.*, NULL AS chapter_title, NULL AS chapter_title_ku, NULL AS chapter_title_ar
           FROM questions q
           WHERE q.scope = 'general'
           ORDER BY q.id ASC`
        )
        .all() as RawQuestionRow[];
    } else {
      questionRows = db
        .prepare(
          `SELECT q.*, c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar
           FROM questions q
           LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
           WHERE q.scope = 'chapter' AND q.chapter_number = ?
           ORDER BY q.id ASC`
        )
        .all(chapterNumber) as RawQuestionRow[];
    }

    if (questionRows.length === 0) {
      res.status(400).json({ error: 'No questions available in this quiz yet.' });
      return;
    }

    let correctCount = 0;
    const results = questionRows.map((q) => {
      const selected = String(answers[String(q.id)] || '').toUpperCase() || null;
      const isCorrect = selected === q.correct_option;
      if (isCorrect) correctCount++;
      const loc = getLocalizedQuestionFields(q, lang);
      const optMap: Record<string, string> = {
        A: loc.optionA,
        B: loc.optionB,
        C: loc.optionC,
        D: loc.optionD,
      };
      const fallbackExp =
        lang === 'ku'
          ? `هەڵبژاردنی ${q.correct_option} («${optMap[q.correct_option] || ''}») وەڵامە دروستەکەیە.`
          : lang === 'ar'
          ? `الخيار ${q.correct_option} («${optMap[q.correct_option] || ''}») هو الإجابة الصحيحة.`
          : `Option ${q.correct_option} ("${optMap[q.correct_option] || ''}") is the correct answer.`;
      const explanation = (loc.explanation || '').trim() || fallbackExp;

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
        explanation,
      };
    });

    const totalQuestions = questionRows.length;
    const scorePercent = Math.round((correctCount / totalQuestions) * 1000) / 10;

    let pointsAwarded = 0;
    let totalPoints = getUserCompetitionTotal(user.id);

    if (!skipSave) {
      const attemptRes = db
        .prepare(
          `INSERT INTO quiz_attempts (user_id, mode, chapter_number, total_questions, correct_count, score_percent, answers_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          user.id,
          mode,
          chapterNumber,
          totalQuestions,
          correctCount,
          scorePercent,
          JSON.stringify(answers)
        );

      const completionPts =
        COMPETITION_RULES.quizCompleted +
        (scorePercent >= 100
          ? COMPETITION_RULES.perfectScoreBonus
          : scorePercent >= 80
          ? COMPETITION_RULES.highScore80Bonus
          : 0);

      const pts = awardCompetitionPoints({
        userId: user.id,
        eventKey: `qa-${attemptRes.lastInsertRowid}`,
        eventType: 'quiz_completed',
        points: completionPts,
        chapterNumber,
        details: `${mode}${chapterNumber ? ` Ch.${chapterNumber}` : ''} (${correctCount}/${totalQuestions})`,
      });
      pointsAwarded = pts.awarded;
      totalPoints = pts.totalPoints;

      touchUserActivity(user.id);
      logStudentActivity(
        user.id,
        'quiz_completed',
        `${mode}${chapterNumber ? ` Ch.${chapterNumber}` : ''}: ${correctCount}/${totalQuestions} (${scorePercent}%)`,
        'quiz',
        chapterNumber
      );
      broadcastAdminDashboard();
      checkpointDatabase();
      writeRecoverySnapshotSync('quiz-submit');
    }

    res.json({
      totalQuestions,
      correctCount,
      scorePercent,
      results,
      pointsAwarded,
      totalPoints,
      accountPassport: !skipSave ? buildAccountPassportForUser(user.id) : undefined,
    });
  });

  app.get('/api/quizzes/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const lang = normalizeLang(req.query.lang);
    const rows = db
      .prepare(
        `SELECT qa.id, qa.mode, qa.chapter_number,
                c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar,
                qa.total_questions, qa.correct_count, qa.score_percent, qa.created_at
         FROM quiz_attempts qa
         LEFT JOIN chapters c ON c.chapter_number = qa.chapter_number
         WHERE qa.user_id = ?
         ORDER BY qa.id DESC
         LIMIT 30`
      )
      .all(user.id) as Array<{
      id: number;
      mode: 'all_chapters' | 'chapter' | 'general';
      chapter_number: number | null;
      chapter_title: string | null;
      chapter_title_ku?: string | null;
      chapter_title_ar?: string | null;
      total_questions: number;
      correct_count: number;
      score_percent: number;
      created_at: string;
    }>;

    const attempts = rows.map((a) => ({
      id: a.id,
      mode: a.mode,
      chapter_number: a.chapter_number,
      chapter_title:
        lang === 'ku'
          ? (a.chapter_title_ku || '').trim() || a.chapter_title
          : lang === 'ar'
          ? (a.chapter_title_ar || '').trim() || a.chapter_title
          : a.chapter_title,
      total_questions: a.total_questions,
      correct_count: a.correct_count,
      score_percent: a.score_percent,
      created_at: a.created_at,
    }));

    res.json({ attempts });
  });

  // ---------------- ANNOUNCEMENTS & MATERIALS ----------------
  app.get('/api/announcements', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const items = db
      .prepare(
        `SELECT a.*, u.name AS author_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.id DESC`
      )
      .all();
    res.json({ announcements: items });
  });

  app.post(
    '/api/announcements',
    requireTeacher,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const title = String(req.body?.title || '').trim();
      const content = String(req.body?.content || '').trim();
      const type = req.body?.type === 'material' ? 'material' : 'announcement';

      if (!title || !content) {
        res.status(400).json({ error: 'Title and message content are required.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;

      const result = db
        .prepare(
          `INSERT INTO announcements (title, content, type, attachment_name, attachment_url, attachment_mime, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(title, content, type, attachmentName, attachmentUrl, attachmentMime, user.id);

      notifyAllStudents({
        title: type === 'material' ? `New Study Material: ${title}` : `Announcement: ${title}`,
        body: content.slice(0, 140),
        category: type === 'material' ? 'material' : 'announcement',
        linkTab: 'home',
      });

      const created = db
        .prepare('SELECT * FROM announcements WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json({ announcement: created });
    }
  );

  app.delete('/api/announcements/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ---------------- TEXTBOOKS & STUDY Q&A ----------------
  app.get('/api/textbooks-qa', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const lang = normalizeLang(req.query.lang);
    const isPrivileged = req.user!.role === 'teacher' || req.user!.isAdmin;

    const chapterRows = db
      .prepare(
        `SELECT c.chapter_number, c.title, c.description,
                c.title_ku, c.description_ku, c.title_ar, c.description_ar,
                c.updated_at,
                COUNT(q.id) AS question_count
         FROM chapters c
         LEFT JOIN questions q ON q.scope = 'chapter' AND q.chapter_number = c.chapter_number
         GROUP BY c.chapter_number
         ORDER BY c.chapter_number ASC`
      )
      .all() as RawChapterRow[];

    const chapters = chapterRows.map((row) => pickLocalizedChapter(row, lang));

    interface RawTextbookResourceRow {
      id: number;
      chapter_number: number | null;
      title: string;
      title_ku: string;
      title_ar: string;
      summary: string;
      summary_ku: string;
      summary_ar: string;
      key_formulas: string;
      resource_type: 'textbook' | 'guide' | 'summary' | 'slides';
      attachment_name: string | null;
      attachment_url: string | null;
      attachment_mime: string | null;
      external_url: string | null;
      created_at: string;
    }

    const rawResources = db
      .prepare(
        `SELECT id, chapter_number, title, title_ku, title_ar, summary, summary_ku, summary_ar,
                key_formulas, resource_type, attachment_name, attachment_url, attachment_mime,
                external_url, created_at
         FROM textbook_resources
         ORDER BY COALESCE(chapter_number, 0) ASC, id ASC`
      )
      .all() as RawTextbookResourceRow[];

    const resources = rawResources.map((r) => {
      const locTitle =
        lang === 'ku'
          ? (r.title_ku || '').trim() || r.title
          : lang === 'ar'
          ? (r.title_ar || '').trim() || r.title
          : r.title;
      const locSummary =
        lang === 'ku'
          ? normalizeScientificUnits((r.summary_ku || '').trim() || r.summary)
          : lang === 'ar'
          ? normalizeScientificUnits((r.summary_ar || '').trim() || r.summary)
          : r.summary;
      return {
        id: r.id,
        chapter_number: r.chapter_number,
        title: locTitle,
        summary: locSummary,
        key_formulas: r.key_formulas || '',
        resource_type: r.resource_type,
        attachment_name: r.attachment_name,
        attachment_url: r.attachment_url,
        attachment_mime: r.attachment_mime,
        external_url: r.external_url,
        created_at: r.created_at,
        ...(isPrivileged ? { raw_title: r.title, raw_summary: r.summary } : {}),
      };
    });

    interface RawStudyQARow {
      id: number;
      chapter_number: number;
      question_text: string;
      question_text_ku: string;
      question_text_ar: string;
      answer_text: string;
      answer_text_ku: string;
      answer_text_ar: string;
      explanation_text: string;
      explanation_text_ku: string;
      explanation_text_ar: string;
      source_label: string;
      created_at: string;
    }

    const rawStudyQa = db
      .prepare(
        `SELECT id, chapter_number,
                question_text, question_text_ku, question_text_ar,
                answer_text, answer_text_ku, answer_text_ar,
                explanation_text, explanation_text_ku, explanation_text_ar,
                source_label, created_at
         FROM textbook_study_qa
         ORDER BY chapter_number ASC, id ASC`
      )
      .all() as RawStudyQARow[];

    const studyQa = rawStudyQa.map((q) => {
      const qt =
        lang === 'ku'
          ? normalizeScientificUnits((q.question_text_ku || '').trim() || q.question_text)
          : lang === 'ar'
          ? normalizeScientificUnits((q.question_text_ar || '').trim() || q.question_text)
          : q.question_text;
      const ans =
        lang === 'ku'
          ? normalizeScientificUnits((q.answer_text_ku || '').trim() || q.answer_text)
          : lang === 'ar'
          ? normalizeScientificUnits((q.answer_text_ar || '').trim() || q.answer_text)
          : q.answer_text;
      const exp =
        lang === 'ku'
          ? normalizeScientificUnits((q.explanation_text_ku || '').trim() || q.explanation_text)
          : lang === 'ar'
          ? normalizeScientificUnits((q.explanation_text_ar || '').trim() || q.explanation_text)
          : q.explanation_text;
      return {
        id: q.id,
        chapter_number: q.chapter_number,
        question_text: qt,
        answer_text: ans,
        explanation_text: exp,
        source_label: q.source_label || 'Textbook Study Guide',
        created_at: q.created_at,
        ...(isPrivileged
          ? {
              raw_question_text: q.question_text,
              raw_answer_text: q.answer_text,
              raw_explanation_text: q.explanation_text,
            }
          : {}),
      };
    });

    const rawQuestions = db
      .prepare(
        `SELECT q.id, q.scope, q.chapter_number,
                c.title AS chapter_title, c.title_ku AS chapter_title_ku, c.title_ar AS chapter_title_ar,
                q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation,
                q.question_text_ku, q.option_a_ku, q.option_b_ku, q.option_c_ku, q.option_d_ku, q.explanation_ku,
                q.question_text_ar, q.option_a_ar, q.option_b_ar, q.option_c_ar, q.option_d_ar, q.explanation_ar,
                q.created_at
         FROM questions q
         LEFT JOIN chapters c ON c.chapter_number = q.chapter_number
         ORDER BY CASE WHEN q.scope = 'chapter' THEN 0 ELSE 1 END, COALESCE(q.chapter_number, 99) ASC, q.id ASC`
      )
      .all() as RawQuestionRow[];

    const curriculumQa = rawQuestions.map((row) => {
      const loc = getLocalizedQuestionFields(row, lang);
      const optMap: Record<'A' | 'B' | 'C' | 'D', string> = {
        A: loc.optionA,
        B: loc.optionB,
        C: loc.optionC,
        D: loc.optionD,
      };
      const correctOptionText = optMap[row.correct_option] || '';
      const storedExp = (loc.explanation || '').trim();
      const fallbackExp =
        lang === 'ku'
          ? `هەڵبژاردنی ${row.correct_option} («${correctOptionText}») وەڵامە دروستەکەی ئەم پرسیارەیە.`
          : lang === 'ar'
          ? `الخيار ${row.correct_option} («${correctOptionText}») هو الإجابة الصحيحة لهذا السؤال.`
          : `Option ${row.correct_option} ("${correctOptionText}") is the correct answer for this curriculum question.`;

      return {
        id: row.id,
        scope: row.scope,
        chapter_number: row.chapter_number,
        chapter_title: loc.chapterTitle,
        question_text: loc.questionText,
        option_a: loc.optionA,
        option_b: loc.optionB,
        option_c: loc.optionC,
        option_d: loc.optionD,
        correct_option: row.correct_option,
        correct_option_text: correctOptionText,
        explanation: storedExp || fallbackExp,
        created_at: row.created_at,
      };
    });

    const materials = db
      .prepare(
        `SELECT a.*, u.name AS author_name
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         WHERE a.type = 'material'
         ORDER BY a.id DESC`
      )
      .all();

    res.json({ chapters, resources, studyQa, curriculumQa, materials });
  });

  app.post(
    '/api/textbooks-qa/resources',
    requireTeacher,
    upload.single('file'),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const chapterRaw = req.body?.chapterNumber;
      const chapterNumber =
        chapterRaw === '' || chapterRaw === null || chapterRaw === undefined || chapterRaw === 'all'
          ? null
          : Number(chapterRaw);
      if (
        chapterNumber !== null &&
        (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 11)
      ) {
        res.status(400).json({ error: 'Chapter number must be between 1 and 11, or general.' });
        return;
      }

      const title = String(req.body?.title || '').trim();
      const summary = String(req.body?.summary || '').trim();
      const keyFormulas = String(req.body?.keyFormulas || '').trim();
      const externalUrl = String(req.body?.externalUrl || '').trim() || null;
      const rawType = String(req.body?.resourceType || 'guide');
      const resourceType = ['textbook', 'guide', 'summary', 'slides'].includes(rawType)
        ? rawType
        : 'guide';

      if (!title) {
        res.status(400).json({ error: 'Resource title is required.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;

      const result = db
        .prepare(
          `INSERT INTO textbook_resources
           (chapter_number, title, summary, key_formulas, resource_type, attachment_name, attachment_url, attachment_mime, external_url, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          chapterNumber,
          title,
          summary,
          keyFormulas,
          resourceType,
          attachmentName,
          attachmentUrl,
          attachmentMime,
          externalUrl,
          user.id
        );

      notifyAllStudents({
        title: `New Textbook Material: ${title}`,
        body: chapterNumber
          ? `Added to Chapter ${chapterNumber} in Textbooks & Study Q&A.`
          : 'Added to Grade 9 Textbooks & Study Q&A.',
        category: 'material',
        linkTab: 'textbooks-qa',
      });

      checkpointDatabase();
      writeRecoverySnapshotSync('textbook-resource-added');
      const created = db
        .prepare('SELECT * FROM textbook_resources WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json({ resource: created });
    }
  );

  app.delete(
    '/api/textbooks-qa/resources/:id',
    requireTeacher,
    (req: AuthenticatedRequest, res: Response) => {
      const id = Number(req.params.id);
      const result = db.prepare('DELETE FROM textbook_resources WHERE id = ?').run(id);
      if (result.changes === 0) {
        res.status(404).json({ error: 'Textbook resource not found.' });
        return;
      }
      checkpointDatabase();
      writeRecoverySnapshotSync('textbook-resource-deleted');
      res.json({ ok: true });
    }
  );

  app.post('/api/textbooks-qa/qa', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const chapterNumber = Number(req.body?.chapterNumber);
    const questionText = String(req.body?.questionText || '').trim();
    const answerText = String(req.body?.answerText || '').trim();
    const explanationText = String(req.body?.explanationText || '').trim();
    const sourceLabel = String(req.body?.sourceLabel || '').trim() || 'Textbook Study Guide';

    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 11) {
      res.status(400).json({ error: 'Chapter number must be between 1 and 11.' });
      return;
    }
    if (!questionText || !answerText) {
      res.status(400).json({ error: 'Both study question and answer are required.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO textbook_study_qa
         (chapter_number, question_text, answer_text, explanation_text, source_label, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(chapterNumber, questionText, answerText, explanationText, sourceLabel, user.id);

    checkpointDatabase();
    writeRecoverySnapshotSync('textbook-qa-added');
    const created = db
      .prepare('SELECT * FROM textbook_study_qa WHERE id = ?')
      .get(result.lastInsertRowid);
    res.status(201).json({ qa: created });
  });

  app.put('/api/textbooks-qa/qa/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT id FROM textbook_study_qa WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Study Q&A not found.' });
      return;
    }

    const chapterNumber = Number(req.body?.chapterNumber);
    const questionText = String(req.body?.questionText || '').trim();
    const answerText = String(req.body?.answerText || '').trim();
    const explanationText = String(req.body?.explanationText || '').trim();
    const sourceLabel = String(req.body?.sourceLabel || '').trim() || 'Textbook Study Guide';

    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 11) {
      res.status(400).json({ error: 'Chapter number must be between 1 and 11.' });
      return;
    }
    if (!questionText || !answerText) {
      res.status(400).json({ error: 'Both study question and answer are required.' });
      return;
    }

    db.prepare(
      `UPDATE textbook_study_qa
       SET chapter_number = ?, question_text = ?, question_text_ku = '', question_text_ar = '',
           answer_text = ?, answer_text_ku = '', answer_text_ar = '',
           explanation_text = ?, explanation_text_ku = '', explanation_text_ar = '',
           source_label = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(chapterNumber, questionText, answerText, explanationText, sourceLabel, id);

    checkpointDatabase();
    writeRecoverySnapshotSync('textbook-qa-updated');
    const updated = db.prepare('SELECT * FROM textbook_study_qa WHERE id = ?').get(id);
    res.json({ qa: updated });
  });

  app.delete('/api/textbooks-qa/qa/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM textbook_study_qa WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Study Q&A not found.' });
      return;
    }
    checkpointDatabase();
    writeRecoverySnapshotSync('textbook-qa-deleted');
    res.json({ ok: true });
  });

  // ---------------- ASK YOUR TEACHER MESSAGING ----------------
  app.get('/api/messages/threads', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const isPrivileged = user.role === 'teacher' || user.isAdmin;

    if (isPrivileged) {
      const threads = db
        .prepare(
          `SELECT u.id AS student_id, u.name AS student_name, u.email AS student_email, u.grade AS student_grade, u.avatar_url AS student_avatar_url,
                  MAX(m.created_at) AS last_message_at,
                  (SELECT tm.message_text FROM teacher_messages tm WHERE tm.student_id = u.id ORDER BY tm.id DESC LIMIT 1) AS last_message_text,
                  (SELECT tm.attachment_name FROM teacher_messages tm WHERE tm.student_id = u.id ORDER BY tm.id DESC LIMIT 1) AS last_attachment_name,
                  SUM(CASE WHEN m.sender_role = 'student' AND m.is_read_by_recipient = 0 THEN 1 ELSE 0 END) AS unread_count
           FROM users u
           JOIN teacher_messages m ON m.student_id = u.id
           WHERE u.role = 'student'
           GROUP BY u.id
           ORDER BY last_message_at DESC`
        )
        .all();

      res.json({ threads });
      return;
    }

    const unreadCountRow = db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM teacher_messages
         WHERE student_id = ? AND sender_role = 'teacher' AND is_read_by_recipient = 0`
      )
      .get(user.id) as { count: number };

    res.json({
      threads: [
        {
          student_id: user.id,
          student_name: user.name,
          student_email: user.email,
          student_grade: user.grade,
          student_avatar_url: user.avatar_url,
          unread_count: unreadCountRow.count,
        },
      ],
    });
  });

  app.get('/api/messages/:studentId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    const studentId = Number(req.params.studentId);

    if (!isPrivileged && user.id !== studentId) {
      res.status(403).json({ error: 'You can only view your own conversation with your teacher.' });
      return;
    }

    const messages = db
      .prepare(
        `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar_url
         FROM teacher_messages m
         JOIN users u ON u.id = m.sender_id
         WHERE m.student_id = ?
         ORDER BY m.id ASC`
      )
      .all(studentId);

    // Mark incoming messages as read for the viewer
    if (isPrivileged) {
      db.prepare(
        `UPDATE teacher_messages SET is_read_by_recipient = 1
         WHERE student_id = ? AND sender_role = 'student' AND is_read_by_recipient = 0`
      ).run(studentId);
    } else {
      db.prepare(
        `UPDATE teacher_messages SET is_read_by_recipient = 1
         WHERE student_id = ? AND sender_role = 'teacher' AND is_read_by_recipient = 0`
      ).run(studentId);
    }

    res.json({ messages });
  });

  app.delete('/api/messages/:id', requireTeacher, (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const result = db.prepare('DELETE FROM teacher_messages WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post(
    '/api/messages',
    requireAuth,
    upload.single('attachment'),
    (req: AuthenticatedRequest, res: Response) => {
      const user = req.user!;
      const isPrivileged = user.role === 'teacher' || user.isAdmin;
      const messageText = String(req.body?.messageText || '').trim();
      const targetStudentId = isPrivileged ? Number(req.body?.studentId) : user.id;

      if (!targetStudentId || !Number.isInteger(targetStudentId)) {
        res.status(400).json({ error: 'Valid student conversation ID is required.' });
        return;
      }

      if (!messageText && !req.file) {
        res.status(400).json({ error: 'Please write a message or attach an image/file.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;
      const attachmentSize = req.file ? req.file.size : null;

      const senderRole: 'student' | 'teacher' = isPrivileged ? 'teacher' : 'student';

      const result = db
        .prepare(
          `INSERT INTO teacher_messages (student_id, sender_id, sender_role, message_text, attachment_name, attachment_url, attachment_mime, attachment_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          targetStudentId,
          user.id,
          senderRole,
          messageText,
          attachmentName,
          attachmentUrl,
          attachmentMime,
          attachmentSize
        );

      if (isPrivileged) {
        notifySingleUser({
          userId: targetStudentId,
          title: 'Reply from Mr. Kasrawan',
          body: messageText ? messageText.slice(0, 120) : `Sent an attachment: ${attachmentName}`,
          category: 'reply',
          linkTab: 'ask-teacher',
        });
      } else {
        const teachers = db
          .prepare("SELECT id FROM users WHERE role = 'teacher' OR is_admin = 1")
          .all() as Array<{ id: number }>;
        for (const t of teachers) {
          notifySingleUser({
            userId: t.id,
            title: `Question from ${user.name}`,
            body: messageText ? messageText.slice(0, 120) : `Sent an attachment: ${attachmentName}`,
            category: 'reply',
            linkTab: 'ask-teacher',
          });
        }
      }

      const created = db
        .prepare(
          `SELECT m.*, u.name AS sender_name, u.avatar_url AS sender_avatar_url
           FROM teacher_messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.id = ?`
        )
        .get(result.lastInsertRowid);

      touchUserActivity(user.id);
      logStudentActivity(
        user.id,
        'teacher_message_sent',
        messageText ? messageText.slice(0, 100) : `Attachment: ${attachmentName}`,
        'teacher_message',
        Number(result.lastInsertRowid)
      );
      if (!isPrivileged) {
        awardCompetitionPoints({
          userId: user.id,
          eventKey: `teacher-msg-${result.lastInsertRowid}`,
          eventType: 'curriculum_activity',
          points: COMPETITION_RULES.curriculumActivity,
          chapterNumber: null,
          details: 'Asked teacher a science question',
        });
      }
      broadcastAdminDashboard();

      res.status(201).json({ message: created });
    }
  );

  // ---------------- NOTIFICATIONS & WEB PUSH ----------------
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const notifications = db
      .prepare(
        `SELECT * FROM notifications
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 60`
      )
      .all(user.id);

    const unreadRow = db
      .prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(user.id) as { count: number };

    res.json({ notifications, unreadCount: unreadRow.count });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const id = Number(req.params.id);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, user.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/permission-choice', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const choice = req.body?.choice === 'allowed' ? 'allowed' : req.body?.choice === 'denied' ? 'denied' : null;
    if (!choice) {
      res.status(400).json({ error: 'Choice must be "allowed" or "denied".' });
      return;
    }

    const enabled = choice === 'allowed' ? 1 : 0;
    db.prepare('UPDATE users SET notif_prompt_status = ?, notifications_enabled = ? WHERE id = ?').run(
      choice,
      enabled,
      user.id
    );

    const updatedRow = db
      .prepare(`SELECT ${USER_SELECT_COLS} FROM users WHERE id = ?`)
      .get(user.id) as DbUserRow;

    res.json({ user: serializeAuthUser(updatedRow) });
  });

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: getPublicVapidKey() });
  });

  app.post('/api/push/subscribe', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      res.status(400).json({ error: 'Invalid push subscription object.' });
      return;
    }

    db.prepare(
      `INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, ?, ?)`
    ).run(user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth);

    db.prepare("UPDATE users SET notif_prompt_status = 'allowed', notifications_enabled = 1 WHERE id = ?").run(
      user.id
    );

    res.json({ ok: true });
  });

  app.post('/api/push/unsubscribe', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const endpoint = String(req.body?.endpoint || '');
    if (endpoint) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    }
    db.prepare('UPDATE users SET notifications_enabled = 0 WHERE id = ?').run(user.id);
    res.json({ ok: true });
  });

  // ---------------- GEMINI AI TUTOR & IMAGE GENERATOR ----------------
  app.post('/api/ai/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const model = String(req.body?.model || 'gemini-4-hydrogen');
      const systemInstruction = String(
        req.body?.systemInstruction ||
          'You are an encouraging Grade 9 Science Tutor for Grade 9 Hub. Explain concepts clearly with step-by-step reasoning and SI units.'
      );
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const message = String(req.body?.message || '').trim();

      if (!message) {
        res.status(400).json({ error: 'Please enter a message for the AI tutor.' });
        return;
      }

      const result = await runTutorChat({ model, systemInstruction, history, message });
      const chatUser = req.user!;
      db.prepare("UPDATE users SET ai_tutor_turns = ai_tutor_turns + 1, last_active_at = datetime('now') WHERE id = ?").run(
        chatUser.id
      );
      logStudentActivity(chatUser.id, 'ai_tutor_used', message.slice(0, 100), 'ai_chat', null);
      awardCompetitionPoints({
        userId: chatUser.id,
        eventKey: `ai-chat-${chatUser.id}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        eventType: 'curriculum_activity',
        points: COMPETITION_RULES.curriculumActivity,
        chapterNumber: null,
        details: 'Practiced science with AI Tutor',
      });
      broadcastAdminDashboard();
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI Tutor request failed.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/ai/generate-image', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const prompt = String(req.body?.prompt || '').trim();
      const imageSize = String(req.body?.imageSize || '1K');
      const aspectRatio = String(req.body?.aspectRatio || '1:1');

      if (!prompt) {
        res.status(400).json({ error: 'Please describe the scientific diagram or illustration you want to generate.' });
        return;
      }

      const result = await generateStudyImage({ prompt, imageSize, aspectRatio });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image generation failed.';
      res.status(500).json({ error: msg });
    }
  });

  // ---------------- STUDENT COMPETITION & HYBRID OFFLINE SYNC ----------------
  app.get('/api/competition/leaderboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    res.json(buildCompetitionLeaderboard(user.id));
  });

  app.post('/api/competition/sync', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const rawEvents = Array.isArray(req.body?.events) ? req.body.events : [];
    const syncedKeys: string[] = [];
    let totalAwarded = 0;

    for (const rawEv of rawEvents.slice(0, 100)) {
      if (!rawEv || typeof rawEv !== 'object') continue;
      const ev = rawEv as {
        eventKey?: string;
        eventType?: string;
        points?: number;
        chapterNumber?: number | null;
        questionId?: number;
        selectedOption?: string;
        mode?: 'all_chapters' | 'chapter' | 'general';
        answers?: Record<string, string>;
        details?: string;
        createdAt?: string;
      };

      const eventKey = String(ev.eventKey || '').trim().slice(0, 140);
      if (!eventKey) continue;

      const existing = db
        .prepare('SELECT id FROM competition_point_events WHERE event_key = ?')
        .get(eventKey);
      if (existing) {
        syncedKeys.push(eventKey);
        continue;
      }

      const evType = ev.eventType;
      const createdAt = ev.createdAt ? String(ev.createdAt).slice(0, 40) : undefined;

      if (evType === 'correct_answer') {
        let verifiedCorrect = true;
        let chNum = ev.chapterNumber ?? null;
        const qId = Number(ev.questionId);
        const sel = String(ev.selectedOption || '').trim().toUpperCase();

        if (Number.isInteger(qId) && qId > 0 && ['A', 'B', 'C', 'D'].includes(sel)) {
          const qRow = db
            .prepare('SELECT id, chapter_number, correct_option FROM questions WHERE id = ?')
            .get(qId) as { id: number; chapter_number: number | null; correct_option: string } | undefined;
          if (qRow) {
            chNum = qRow.chapter_number;
            verifiedCorrect = qRow.correct_option === sel;
            db.prepare(
              'INSERT INTO student_question_answers (user_id, question_id, is_correct) VALUES (?, ?, ?)'
            ).run(user.id, qRow.id, verifiedCorrect ? 1 : 0);
          }
        }

        if (verifiedCorrect) {
          const awarded = awardCompetitionPoints({
            userId: user.id,
            eventKey,
            eventType: 'correct_answer',
            points: COMPETITION_RULES.correctAnswer,
            chapterNumber: chNum,
            details: String(ev.details || (qId ? `Question #${qId}` : 'Offline correct answer')),
            createdAt,
            skipBroadcast: true,
          });
          totalAwarded += awarded.awarded;
        }
        syncedKeys.push(eventKey);
      } else if (evType === 'quiz_completed') {
        const mode = ev.mode;
        const chNum = mode === 'chapter' && ev.chapterNumber ? Number(ev.chapterNumber) : null;
        let awardedPts = Math.max(0, Math.min(55, Math.round(Number(ev.points) || COMPETITION_RULES.quizCompleted)));
        let summaryDetails = String(ev.details || 'Offline quiz completion');

        if (mode && ['all_chapters', 'chapter', 'general'].includes(mode) && ev.answers && typeof ev.answers === 'object') {
          let questionRows: Array<{ id: number; correct_option: string }> = [];
          if (mode === 'all_chapters') {
            questionRows = db
              .prepare("SELECT id, correct_option FROM questions WHERE scope = 'chapter'")
              .all() as Array<{ id: number; correct_option: string }>;
          } else if (mode === 'general') {
            questionRows = db
              .prepare("SELECT id, correct_option FROM questions WHERE scope = 'general'")
              .all() as Array<{ id: number; correct_option: string }>;
          } else if (chNum) {
            questionRows = db
              .prepare("SELECT id, correct_option FROM questions WHERE scope = 'chapter' AND chapter_number = ?")
              .all(chNum) as Array<{ id: number; correct_option: string }>;
          }

          if (questionRows.length > 0) {
            let correctCount = 0;
            for (const qr of questionRows) {
              if (String(ev.answers[String(qr.id)] || '').toUpperCase() === qr.correct_option) {
                correctCount++;
              }
            }
            const scorePercent = Math.round((correctCount / questionRows.length) * 1000) / 10;
            awardedPts =
              COMPETITION_RULES.quizCompleted +
              (scorePercent >= 100
                ? COMPETITION_RULES.perfectScoreBonus
                : scorePercent >= 80
                ? COMPETITION_RULES.highScore80Bonus
                : 0);
            summaryDetails = `${mode}${chNum ? ` Ch.${chNum}` : ''} (${correctCount}/${questionRows.length})`;

            db.prepare(
              `INSERT INTO quiz_attempts (user_id, mode, chapter_number, total_questions, correct_count, score_percent, answers_json)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(
              user.id,
              mode,
              chNum,
              questionRows.length,
              correctCount,
              scorePercent,
              JSON.stringify(ev.answers)
            );
          }
        }

        const awarded = awardCompetitionPoints({
          userId: user.id,
          eventKey,
          eventType: 'quiz_completed',
          points: awardedPts,
          chapterNumber: chNum,
          details: summaryDetails,
          createdAt,
          skipBroadcast: true,
        });
        totalAwarded += awarded.awarded;
        syncedKeys.push(eventKey);
      } else if (evType === 'curriculum_activity') {
        const safeActPts = Math.max(1, Math.min(15, Math.round(Number(ev.points) || COMPETITION_RULES.curriculumActivity)));
        const awarded = awardCompetitionPoints({
          userId: user.id,
          eventKey,
          eventType: 'curriculum_activity',
          points: safeActPts,
          chapterNumber: ev.chapterNumber ?? null,
          details: String(ev.details || 'Offline curriculum activity'),
          createdAt,
          skipBroadcast: true,
        });
        totalAwarded += awarded.awarded;
        syncedKeys.push(eventKey);
      }
    }

    if (totalAwarded > 0) {
      touchUserActivity(user.id);
      broadcastAdminDashboard();
      broadcastToAllUsers({
        type: 'leaderboard:update',
        payload: { userId: user.id, pointsAwarded: totalAwarded, totalPoints: getUserCompetitionTotal(user.id) },
      });
      checkpointDatabase();
      writeRecoverySnapshotSync('competition-sync');
    }

    const snapshot = buildCompetitionLeaderboard(user.id);
    res.json({
      syncedKeys,
      awardedPoints: totalAwarded,
      totalPoints: getUserCompetitionTotal(user.id),
      accountPassport: buildAccountPassportForUser(user.id),
      snapshot,
    });
  });

  registerCommunityRoutes({
    app,
    requireAuth,
    requireTeacher,
    upload,
    isUserOnline: (userId) => activeUserSockets.has(userId),
    getUserSection: (userId) => userActiveSection.get(userId) || 'home',
    touchUserActivity,
    broadcastAdminDashboard,
    broadcastToUser,
    broadcastToAllUsers,
    broadcastToAdmins,
    notifySingleUser,
    onAwardCurriculumPoints: (params) => {
      awardCompetitionPoints(params);
    },
  });

  const httpServer = http.createServer(app);

  // ---------------- REAL-TIME PRESENCE & ADMIN DASHBOARD WEBSOCKET ----------------
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    let queryToken = '';
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      pathname = parsed.pathname;
      queryToken = parsed.searchParams.get('token') || '';
    } catch {
      return;
    }

    if (pathname !== '/ws') {
      return;
    }

    const token = queryToken || extractTokenFromCookieHeader(req.headers.cookie);
    const user = getAuthenticatedUserByToken(token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  interface AliveWebSocket extends WebSocket {
    isAlive?: boolean;
  }

  wss.on('connection', (ws: AliveWebSocket, _req: http.IncomingMessage, user: AuthUser) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    let socketSet = activeUserSockets.get(user.id);
    const wasOffline = !socketSet || socketSet.size === 0;
    if (!socketSet) {
      socketSet = new Set<WebSocket>();
      activeUserSockets.set(user.id, socketSet);
    }
    socketSet.add(ws);
    if (!userActiveSection.has(user.id)) {
      userActiveSection.set(user.id, 'home');
    }
    touchUserActivity(user.id);
    if (wasOffline && !isPrivileged) {
      logStudentActivity(user.id, 'online', 'Came online in Grade 9 Hub', 'user', user.id);
    }

    if (isPrivileged) {
      adminDashboardSockets.add(ws);
      ws.send(
        JSON.stringify({
          type: 'admin:dashboard',
          payload: computeAdminDashboardSnapshot(),
        })
      );
    } else {
      broadcastAdminDashboard();
    }
    if (wasOffline) {
      broadcastToAllUsers({ type: 'community:presence', payload: { userId: user.id, online: true } });
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as { type?: string; section?: string };
        if (msg.type === 'presence:section' && typeof msg.section === 'string') {
          const safeSection = ALLOWED_PRESENCE_SECTIONS.has(msg.section) ? msg.section : 'home';
          userActiveSection.set(user.id, safeSection);
          touchUserActivity(user.id);
          if (!isPrivileged) {
            broadcastAdminDashboard();
            broadcastToAllUsers({
              type: 'community:presence',
              payload: { userId: user.id, online: true, section: safeSection },
            });
          }
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      adminDashboardSockets.delete(ws);
      const set = activeUserSockets.get(user.id);
      let wentOffline = false;
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          activeUserSockets.delete(user.id);
          userActiveSection.delete(user.id);
          wentOffline = true;
        }
      }
      if (wentOffline && !isPrivileged) {
        logStudentActivity(user.id, 'offline', 'Disconnected from Grade 9 Hub', 'user', user.id);
      }
      if (!isPrivileged) {
        broadcastAdminDashboard();
      }
      if (wentOffline) {
        broadcastToAllUsers({ type: 'community:presence', payload: { userId: user.id, online: false } });
      }
    });
  });

  const wsHeartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const aliveClient = client as AliveWebSocket;
      if (aliveClient.isAlive === false) {
        aliveClient.terminate();
        continue;
      }
      aliveClient.isAlive = false;
      aliveClient.ping();
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(wsHeartbeat);
  });

  // Block HTTP access to tracked encrypted backup files and server internals
  app.use(['/src/data', '/server', '/data'], (_req, res) => {
    res.status(404).send('Not found');
  });

  // ---------------- VITE / STATIC SERVING ----------------
  const textbookPdfPath = path.resolve(
    process.cwd(),
    'server/assets/Science_9_Book_2409ed82.pdf'
  );
  app.get('/assets/aistudio/Science_9_Book_2409ed82.pdf', (_req, res) => {
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(textbookPdfPath, { acceptRanges: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        watch:
          process.env.DISABLE_HMR === 'true'
            ? null
            : {
                ignored: ['**/data/**', '**/src/data/**'],
              },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Exiting cleanly so the process supervisor can restart.`);
      process.exit(1);
    }
    throw err;
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Grade 9 Hub running on http://localhost:${PORT}`);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] Received ${signal}, flushing SQLite WAL and saving recovery snapshot...`);
    try {
      checkpointDatabase();
      flushPendingRecoverySnapshotSync(`shutdown-${signal.toLowerCase()}`);
    } catch (err) {
      console.error('[Server] Shutdown persistence error:', err);
    }
    try {
      wss.close();
      httpServer.close(() => {
        try {
          checkpointDatabase();
          db.close();
        } catch {
          // ignore
        }
        process.exit(0);
      });
      setTimeout(() => {
        try {
          checkpointDatabase();
          db.close();
        } catch {
          // ignore
        }
        process.exit(0);
      }, 2000).unref();
    } catch {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('beforeExit', () => {
    try {
      flushPendingRecoverySnapshotSync('before-exit');
    } catch {
      // ignore
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
