import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptSignedJson, encryptSignedJson } from './authSecret.ts';
import {
  backupsDir,
  BOOTSTRAP_PENDING_HASH,
  checkpointDatabase,
  db,
  dbPath,
  ensureMainAdminPermissions,
  getRealUserCount,
  TEACHER_EMAIL,
} from './db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

export const BACKUP_FORMAT = 'grade9hub-backup-v1';
export const PERSISTENT_BACKUP_FORMAT = 'grade9hub-encrypted-persistent-v1';
export const LATEST_RECOVERY_FILENAME = 'latest-recovery.json';
export const LATEST_RECOVERY_PATH = path.join(backupsDir, LATEST_RECOVERY_FILENAME);
export const PERSISTENT_BACKUP_PATH = path.resolve(
  WORKSPACE_ROOT,
  'src/data/persistent_backup.json'
);
const CWD_PERSISTENT_BACKUP_PATH = path.resolve(
  process.cwd(),
  'src/data/persistent_backup.json'
);

// Ordered parent -> child for deterministic export and restore
export const BACKUP_TABLES = [
  'schema_migrations',
  'users',
  'sessions',
  'revoked_sessions',
  'password_resets',
  'chapters',
  'questions',
  'quiz_attempts',
  'announcements',
  'teacher_messages',
  'notifications',
  'push_subscriptions',
  'app_settings',
  'student_question_answers',
  'community_posts',
  'community_post_comments',
  'community_post_reactions',
  'community_direct_messages',
  'community_groups',
  'community_group_members',
  'community_group_messages',
  'community_reports',
  'student_activity_logs',
  'competition_point_events',
  'textbook_resources',
  'textbook_study_qa',
] as const;

export type BackupRow = Record<string, unknown>;

export interface PortableBackupCounts {
  users: number;
  students: number;
  teachers: number;
  chapters: number;
  questions: number;
  quizAttempts: number;
  announcements: number;
  teacherMessages: number;
  communityPosts: number;
  communityDms: number;
  communityGroups: number;
  notifications: number;
}

export interface PortableBackupPayload {
  format: string;
  createdAt: string;
  reason: string;
  mainAdminEmail: string;
  counts: PortableBackupCounts;
  tables: Record<string, BackupRow[]>;
}

export interface BackupFileInfo {
  filename: string;
  kind: 'sqlite' | 'json';
  reason: string;
  createdAt: string;
  sizeBytes: number;
  isLatestRecovery: boolean;
  usersCount?: number;
  questionsCount?: number;
}

export interface DatabaseHealthStats {
  counts: PortableBackupCounts;
  dbSizeBytes: number;
  walSizeBytes: number;
  lastRecoverySnapshotAt: string | null;
  lastRecoveryUsersCount: number;
  backupCount: number;
}

function getExistingTables(sourceDb: Database.Database): Set<string> {
  const rows = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function getTableColumnNames(targetDb: Database.Database, table: string): string[] {
  const cols = targetDb.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return cols.map((c) => c.name);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function buildPortableBackupPayloadFromDb(
  sourceDb: Database.Database,
  reason = 'snapshot'
): PortableBackupPayload {
  const existingTables = getExistingTables(sourceDb);
  const tables: Record<string, BackupRow[]> = {};

  for (const table of BACKUP_TABLES) {
    if (!existingTables.has(table)) {
      tables[table] = [];
      continue;
    }
    tables[table] = sourceDb.prepare(`SELECT * FROM "${table}"`).all() as BackupRow[];
  }

  const rawUsers = tables.users || [];
  const users = rawUsers.filter((u) => String(u.password_hash || '') !== BOOTSTRAP_PENDING_HASH);
  tables.users = users;
  const teachers = users.filter(
    (u) =>
      u.role === 'teacher' ||
      Boolean(u.is_admin) ||
      String(u.email || '').toLowerCase() === TEACHER_EMAIL.toLowerCase()
  ).length;

  const counts: PortableBackupCounts = {
    users: users.length,
    students: Math.max(0, users.length - teachers),
    teachers,
    chapters: (tables.chapters || []).length,
    questions: (tables.questions || []).length,
    quizAttempts: (tables.quiz_attempts || []).length,
    announcements: (tables.announcements || []).length,
    teacherMessages: (tables.teacher_messages || []).length,
    communityPosts: (tables.community_posts || []).length,
    communityDms: (tables.community_direct_messages || []).length,
    communityGroups: (tables.community_groups || []).length,
    notifications: (tables.notifications || []).length,
  };

  return {
    format: BACKUP_FORMAT,
    createdAt: new Date().toISOString(),
    reason,
    mainAdminEmail: TEACHER_EMAIL,
    counts,
    tables,
  };
}

export function buildPortableBackupPayload(reason = 'export'): PortableBackupPayload {
  checkpointDatabase();
  return buildPortableBackupPayloadFromDb(db, reason);
}

function readRecoveryJsonIfValid(filePath: string): PortableBackupPayload | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PortableBackupPayload;
    if (!parsed || parsed.format !== BACKUP_FORMAT || typeof parsed.tables !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function countRealPayloadUsers(payload: PortableBackupPayload | null): number {
  if (!payload || !Array.isArray(payload.tables?.users)) return 0;
  return payload.tables.users.filter(
    (u) => String(u.password_hash || '') !== BOOTSTRAP_PENDING_HASH
  ).length;
}

export function readPersistentBackupPayload(): PortableBackupPayload | null {
  const candidates =
    PERSISTENT_BACKUP_PATH === CWD_PERSISTENT_BACKUP_PATH
      ? [PERSISTENT_BACKUP_PATH]
      : [PERSISTENT_BACKUP_PATH, CWD_PERSISTENT_BACKUP_PATH];

  for (const candidatePath of candidates) {
    try {
      if (!fs.existsSync(candidatePath)) continue;
      const raw = fs.readFileSync(candidatePath, 'utf8');
      const wrapper = JSON.parse(raw) as {
        format?: string;
        envelope?: string;
      };
      if (
        !wrapper ||
        wrapper.format !== PERSISTENT_BACKUP_FORMAT ||
        typeof wrapper.envelope !== 'string'
      ) {
        continue;
      }
      const decrypted = decryptSignedJson<PortableBackupPayload>(
        'persistent-backup',
        wrapper.envelope
      );
      if (decrypted && decrypted.format === BACKUP_FORMAT && typeof decrypted.tables === 'object') {
        return decrypted;
      }
    } catch {
      // try next path
    }
  }
  return null;
}

function getMissingRealUserEmails(
  sourcePayload: PortableBackupPayload | null,
  targetPayload: PortableBackupPayload
): string[] {
  if (!sourcePayload || !Array.isArray(sourcePayload.tables?.users)) return [];
  const targetRealEmails = new Set(
    (targetPayload.tables?.users || [])
      .filter((u) => String(u.password_hash || '') !== BOOTSTRAP_PENDING_HASH)
      .map((u) => String(u.email || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const missing: string[] = [];
  for (const u of sourcePayload.tables.users) {
    const email = String(u.email || '').trim().toLowerCase();
    const hash = String(u.password_hash || '');
    if (email && hash && hash !== BOOTSTRAP_PENDING_HASH && !targetRealEmails.has(email)) {
      missing.push(email);
    }
  }
  return missing;
}

function updatePersistentWorkspaceBackup(
  payload: PortableBackupPayload,
  options: { forceOverwrite?: boolean; allowUserRemoval?: boolean } = {}
): boolean {
  try {
    const { forceOverwrite = false, allowUserRemoval = false } = options;
    const existingPersistent = readPersistentBackupPayload();
    const existingUserCount = countRealPayloadUsers(existingPersistent);
    const newUserCount = countRealPayloadUsers(payload);

    // CRITICAL GUARD 1: Never overwrite persisted user accounts with an empty 0-real-user snapshot
    if (!forceOverwrite && existingUserCount > 0 && newUserCount === 0) {
      return false;
    }

    // CRITICAL GUARD 2: If existing persistent backup has real users missing from current SQLite
    // (and admin did not explicitly delete a user), merge them into SQLite first so NO user is ever lost!
    let payloadToSave = payload;
    if (!forceOverwrite && !allowUserRemoval && existingPersistent) {
      const missingEmails = getMissingRealUserEmails(existingPersistent, payload);
      if (missingEmails.length > 0) {
        restoreFromBackupPayloadSync(existingPersistent, 'merge', {
          skipSafetyDbBackup: true,
          skipSnapshotWrite: true,
        });
        payloadToSave = buildPortableBackupPayloadFromDb(db, payload.reason);
      }
    }

    const envelope = encryptSignedJson('persistent-backup', payloadToSave);
    const serialized = {
      format: PERSISTENT_BACKUP_FORMAT,
      updatedAt: payloadToSave.createdAt,
      reason: payloadToSave.reason,
      counts: payloadToSave.counts,
      envelope,
    };
    writeJsonAtomic(PERSISTENT_BACKUP_PATH, serialized);
    if (CWD_PERSISTENT_BACKUP_PATH !== PERSISTENT_BACKUP_PATH) {
      writeJsonAtomic(CWD_PERSISTENT_BACKUP_PATH, serialized);
    }
    return true;
  } catch (err) {
    console.warn('[Backup] Persistent workspace backup write warning:', err);
    return false;
  }
}

function updateLatestRecoverySnapshot(
  payload: PortableBackupPayload,
  options: boolean | { forceOverwrite?: boolean; allowUserRemoval?: boolean } = false
): boolean {
  const opts =
    typeof options === 'boolean'
      ? { forceOverwrite: options, allowUserRemoval: false }
      : options;
  const forceOverwrite = Boolean(opts.forceOverwrite);
  const allowUserRemoval = Boolean(opts.allowUserRemoval);

  const existingRecovery = readRecoveryJsonIfValid(LATEST_RECOVERY_PATH);
  const existingUserCount = countRealPayloadUsers(existingRecovery);
  const newUserCount = countRealPayloadUsers(payload);

  // CRITICAL GUARD: Never overwrite a recovery snapshot containing user accounts with an empty 0-user snapshot automatically
  if (!forceOverwrite && existingUserCount > 0 && newUserCount === 0) {
    return false;
  }

  const savedPersistent = updatePersistentWorkspaceBackup(payload, {
    forceOverwrite,
    allowUserRemoval,
  });
  const finalPayload = savedPersistent ? buildPortableBackupPayloadFromDb(db, payload.reason) : payload;
  writeJsonAtomic(LATEST_RECOVERY_PATH, finalPayload);
  return true;
}

function pruneOldAutoBackups(maxAutoDbFiles = 15, maxAutoJsonFiles = 10): void {
  try {
    const entries = fs
      .readdirSync(backupsDir)
      .map((filename) => {
        const full = path.join(backupsDir, filename);
        const stat = fs.statSync(full);
        return { filename, full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    const autoDb = entries.filter(
      (e) =>
        e.filename.endsWith('.db') &&
        (e.filename.startsWith('auto-') ||
          e.filename.startsWith('startup-') ||
          e.filename.startsWith('shutdown-'))
    );
    for (const stale of autoDb.slice(maxAutoDbFiles)) {
      try {
        fs.unlinkSync(stale.full);
      } catch {
        // ignore
      }
    }

    const autoJson = entries.filter(
      (e) =>
        e.filename.endsWith('.json') &&
        e.filename !== LATEST_RECOVERY_FILENAME &&
        (e.filename.startsWith('auto-') ||
          e.filename.startsWith('startup-') ||
          e.filename.startsWith('shutdown-'))
    );
    for (const stale of autoJson.slice(maxAutoJsonFiles)) {
      try {
        fs.unlinkSync(stale.full);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

export async function createFullBackup(
  reason: string,
  options: {
    saveTimestampedDb?: boolean;
    saveTimestampedJson?: boolean;
    forceSnapshot?: boolean;
  } = {}
): Promise<{
  payload: PortableBackupPayload;
  dbFilename: string | null;
  jsonFilename: string | null;
}> {
  checkpointDatabase();
  const payload = buildPortableBackupPayloadFromDb(db, reason);
  updateLatestRecoverySnapshot(payload, Boolean(options.forceSnapshot));

  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase() || 'backup';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  let dbFilename: string | null = null;
  let jsonFilename: string | null = null;

  if (options.saveTimestampedDb) {
    dbFilename = `${safeReason}-${stamp}.db`;
    const targetDbPath = path.join(backupsDir, dbFilename);
    await db.backup(targetDbPath);
  }

  if (options.saveTimestampedJson) {
    jsonFilename = `${safeReason}-${stamp}.json`;
    const targetJsonPath = path.join(backupsDir, jsonFilename);
    writeJsonAtomic(targetJsonPath, payload);
  }

  pruneOldAutoBackups();
  return { payload, dbFilename, jsonFilename };
}

export function writeRecoverySnapshotSync(
  reason = 'sync',
  options: { allowUserRemoval?: boolean; forceOverwrite?: boolean } = {}
): boolean {
  try {
    checkpointDatabase();
    const payload = buildPortableBackupPayloadFromDb(db, reason);
    return updateLatestRecoverySnapshot(payload, options);
  } catch (err) {
    console.warn('[Backup] Sync recovery snapshot warning:', err);
    return false;
  }
}

let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSnapshotReason = 'auto-mutation';

export function scheduleAutoRecoverySnapshot(reason = 'auto-mutation'): void {
  checkpointDatabase();
  pendingSnapshotReason = reason;
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
  }
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    writeRecoverySnapshotSync(pendingSnapshotReason);
  }, 150);
}

export function flushPendingRecoverySnapshotSync(reason = 'flush'): void {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  writeRecoverySnapshotSync(reason);
}

function getLiveUserCount(): number {
  return getRealUserCount();
}

function isValidPayload(raw: unknown): raw is PortableBackupPayload {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<PortableBackupPayload>;
  return obj.format === BACKUP_FORMAT && Boolean(obj.tables && typeof obj.tables === 'object');
}

function filterRowToColumns(row: BackupRow, validColumns: string[]): { cols: string[]; vals: unknown[] } {
  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const col of validColumns) {
    if (Object.prototype.hasOwnProperty.call(row, col)) {
      cols.push(col);
      vals.push(row[col]);
    }
  }
  return { cols, vals };
}

export function restoreFromBackupPayloadSync(
  rawPayload: unknown,
  mode: 'merge' | 'replace' = 'merge',
  options: {
    safetyBackupFile?: string | null;
    skipSafetyDbBackup?: boolean;
    skipSnapshotWrite?: boolean;
  } = {}
): {
  mode: 'merge' | 'replace';
  restoredCounts: PortableBackupCounts;
  safetyBackupFile: string | null;
} {
  if (!isValidPayload(rawPayload)) {
    throw new Error('Invalid backup format. Please select a valid Grade 9 Hub backup file.');
  }

  checkpointDatabase();

  const tables = rawPayload.tables;
  const validColumnsCache = new Map<string, string[]>();
  const liveTables = getExistingTables(db);
  for (const t of BACKUP_TABLES) {
    if (liveTables.has(t)) {
      validColumnsCache.set(t, getTableColumnNames(db, t));
    }
  }

  const restoreTx = db.transaction(() => {
    if (mode === 'replace') {
      // Clear tables in reverse dependency order inside atomic transaction
      for (const table of [...BACKUP_TABLES].reverse()) {
        if (!liveTables.has(table) || table === 'schema_migrations') continue;
        db.prepare(`DELETE FROM "${table}"`).run();
      }

      for (const table of BACKUP_TABLES) {
        if (!liveTables.has(table) || table === 'schema_migrations') continue;
        const rows = Array.isArray(tables[table]) ? tables[table] : [];
        const validCols = validColumnsCache.get(table) || [];
        for (const row of rows) {
          const { cols, vals } = filterRowToColumns(row, validCols);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const colList = cols.map((c) => `"${c}"`).join(', ');
          db.prepare(`INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${placeholders})`).run(
            ...vals
          );
        }
      }
    } else {
      // Safe non-destructive MERGE mode: never deletes or overwrites existing accounts/data
      const userIdMap = new Map<number, number>();
      const postIdMap = new Map<number, number>();
      const groupIdMap = new Map<number, number>();

      const remapUserId = (oldId: unknown): number | null => {
        if (oldId === null || oldId === undefined) return null;
        const n = Number(oldId);
        if (!Number.isInteger(n)) return null;
        return userIdMap.get(n) ?? n;
      };

      // 1. Merge users safely by lowercase email
      const backupUsers = Array.isArray(tables.users) ? tables.users : [];
      const userCols = validColumnsCache.get('users') || [];
      for (const bu of backupUsers) {
        const email = String(bu.email || '').trim();
        const oldId = Number(bu.id);
        const backupHash = String(bu.password_hash || '');
        if (!email || backupHash === BOOTSTRAP_PENDING_HASH) continue;

        const existingByEmail = db
          .prepare('SELECT id, password_hash, avatar_url FROM users WHERE LOWER(email) = LOWER(?)')
          .get(email) as { id: number; password_hash: string; avatar_url: string } | undefined;

        if (existingByEmail) {
          if (
            existingByEmail.password_hash === BOOTSTRAP_PENDING_HASH &&
            backupHash
          ) {
            const isMain = email.toLowerCase() === TEACHER_EMAIL.toLowerCase();
            db.prepare(
              `UPDATE users
               SET name = ?, password_hash = ?, role = ?, is_admin = ?, grade = ?, bio = ?,
                   birthday = ?, avatar_url = ?, notif_prompt_status = ?, notifications_enabled = ?,
                   ai_tutor_turns = ?, last_login_at = ?, last_active_at = ?
               WHERE id = ?`
            ).run(
              String(bu.name || 'Mr. Kasrawan'),
              backupHash,
              isMain ? 'teacher' : String(bu.role || 'student'),
              isMain ? 1 : Number(bu.is_admin ? 1 : 0),
              String(bu.grade || ''),
              String(bu.bio || ''),
              String(bu.birthday || ''),
              String(bu.avatar_url || ''),
              String(bu.notif_prompt_status || ''),
              bu.notifications_enabled === 0 ? 0 : 1,
              Number(bu.ai_tutor_turns || 0),
              String(bu.last_login_at || ''),
              String(bu.last_active_at || ''),
              existingByEmail.id
            );
          } else {
            const backupAvatar = String(bu.avatar_url || '');
            const currentAvatar = String(existingByEmail.avatar_url || '');
            if (
              backupAvatar.startsWith('data:image/') &&
              (!currentAvatar || currentAvatar.startsWith('/uploads/'))
            ) {
              db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(
                backupAvatar,
                existingByEmail.id
              );
            }
          }
          if (Number.isInteger(oldId)) {
            userIdMap.set(oldId, existingByEmail.id);
          }
          continue;
        }

        const idOccupied = Number.isInteger(oldId)
          ? (db.prepare('SELECT id FROM users WHERE id = ?').get(oldId) as { id: number } | undefined)
          : undefined;

        const rowToInsert: BackupRow = { ...bu };
        if (idOccupied) {
          delete rowToInsert.id;
        }
        if (email.toLowerCase() === TEACHER_EMAIL.toLowerCase()) {
          rowToInsert.role = 'teacher';
          rowToInsert.is_admin = 1;
        }

        const { cols, vals } = filterRowToColumns(rowToInsert, userCols);
        if (cols.length === 0) continue;
        const placeholders = cols.map(() => '?').join(', ');
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const res = db
          .prepare(`INSERT INTO users (${colList}) VALUES (${placeholders})`)
          .run(...vals);
        const newId = Number(res.lastInsertRowid);
        if (Number.isInteger(oldId)) {
          userIdMap.set(oldId, newId);
        }
      }

      // 2. Merge sessions
      const sessionCols = validColumnsCache.get('sessions') || [];
      for (const s of Array.isArray(tables.sessions) ? tables.sessions : []) {
        const mappedUser = remapUserId(s.user_id);
        if (!mappedUser) continue;
        const row = { ...s, user_id: mappedUser };
        const { cols, vals } = filterRowToColumns(row, sessionCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT OR IGNORE INTO sessions (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 3. Merge chapters (preserve customized chapters; update only default placeholders if backup has real title)
      const backupChapters = Array.isArray(tables.chapters) ? tables.chapters : [];
      for (const ch of backupChapters) {
        const num = Number(ch.chapter_number);
        if (!Number.isInteger(num)) continue;
        const existing = db
          .prepare('SELECT chapter_number, title, title_ku, title_ar FROM chapters WHERE chapter_number = ?')
          .get(num) as { chapter_number: number; title: string; title_ku: string; title_ar: string } | undefined;

        if (!existing) {
          const chCols = validColumnsCache.get('chapters') || [];
          const { cols, vals } = filterRowToColumns(ch, chCols);
          if (cols.length > 0) {
            db.prepare(
              `INSERT OR IGNORE INTO chapters (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
            ).run(...vals);
          }
        } else if (
          /^Chapter \d+$/i.test(existing.title.trim()) &&
          ch.title &&
          !/^Chapter \d+$/i.test(String(ch.title).trim())
        ) {
          db.prepare(
            `UPDATE chapters
             SET title = ?, description = ?, title_ku = ?, description_ku = ?, title_ar = ?, description_ar = ?, updated_at = ?
             WHERE chapter_number = ?`
          ).run(
            String(ch.title || existing.title),
            String(ch.description || ''),
            String(ch.title_ku || ''),
            String(ch.description_ku || ''),
            String(ch.title_ar || ''),
            String(ch.description_ar || ''),
            String(ch.updated_at || new Date().toISOString()),
            num
          );
        }
      }

      // 4. Merge questions (deduplicate by exact scope + chapter_number + question_text)
      const questionCols = validColumnsCache.get('questions') || [];
      for (const q of Array.isArray(tables.questions) ? tables.questions : []) {
        const dup = db
          .prepare(
            `SELECT id FROM questions
             WHERE scope = ? AND COALESCE(chapter_number, -1) = COALESCE(?, -1) AND question_text = ?`
          )
          .get(q.scope, q.chapter_number ?? null, q.question_text);
        if (dup) continue;

        const idOccupied =
          q.id !== undefined &&
          db.prepare('SELECT id FROM questions WHERE id = ?').get(Number(q.id));
        const row: BackupRow = {
          ...q,
          created_by: remapUserId(q.created_by),
        };
        if (idOccupied) delete row.id;
        const { cols, vals } = filterRowToColumns(row, questionCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT INTO questions (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 5. Merge quiz_attempts, announcements, teacher_messages, notifications, push_subscriptions, app_settings, student_question_answers
      const appendUserScopedRows = (
        table: string,
        userFields: string[],
        uniqueIdCheck = true
      ) => {
        if (!liveTables.has(table)) return;
        const validCols = validColumnsCache.get(table) || [];
        const rows = Array.isArray(tables[table]) ? tables[table] : [];
        for (const rawRow of rows) {
          const row: BackupRow = { ...rawRow };
          let missingRequiredUser = false;
          for (const field of userFields) {
            if (row[field] !== null && row[field] !== undefined) {
              const mapped = remapUserId(row[field]);
              if (mapped === null) {
                missingRequiredUser = true;
                break;
              }
              row[field] = mapped;
            }
          }
          if (missingRequiredUser) continue;

          if (uniqueIdCheck && row.id !== undefined) {
            const occupied = db.prepare(`SELECT id FROM "${table}" WHERE id = ?`).get(Number(row.id));
            if (occupied) continue;
          }

          const { cols, vals } = filterRowToColumns(row, validCols);
          if (cols.length === 0) continue;
          db.prepare(
            `INSERT OR IGNORE INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...vals);
        }
      };

      appendUserScopedRows('password_resets', []);
      appendUserScopedRows('quiz_attempts', ['user_id']);
      appendUserScopedRows('announcements', ['created_by']);
      appendUserScopedRows('teacher_messages', ['student_id', 'sender_id']);
      appendUserScopedRows('notifications', ['user_id']);
      appendUserScopedRows('push_subscriptions', ['user_id']);
      appendUserScopedRows('app_settings', [], false);
      appendUserScopedRows('student_question_answers', ['user_id']);

      // 6. Merge community_posts & map post IDs
      const postCols = validColumnsCache.get('community_posts') || [];
      for (const p of Array.isArray(tables.community_posts) ? tables.community_posts : []) {
        const oldPostId = Number(p.id);
        const mappedAuthor = remapUserId(p.author_id);
        if (!mappedAuthor) continue;
        const existingSame = db
          .prepare(
            'SELECT id FROM community_posts WHERE author_id = ? AND content = ? AND created_at = ?'
          )
          .get(mappedAuthor, String(p.content || ''), String(p.created_at || '')) as
          | { id: number }
          | undefined;
        if (existingSame) {
          if (Number.isInteger(oldPostId)) postIdMap.set(oldPostId, existingSame.id);
          continue;
        }
        const idOccupied =
          Number.isInteger(oldPostId) &&
          db.prepare('SELECT id FROM community_posts WHERE id = ?').get(oldPostId);
        const row: BackupRow = { ...p, author_id: mappedAuthor };
        if (idOccupied) delete row.id;
        const { cols, vals } = filterRowToColumns(row, postCols);
        if (cols.length === 0) continue;
        const res = db
          .prepare(
            `INSERT INTO community_posts (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          )
          .run(...vals);
        if (Number.isInteger(oldPostId)) {
          postIdMap.set(oldPostId, Number(res.lastInsertRowid));
        }
      }

      // 7. Merge community_post_comments
      const commentCols = validColumnsCache.get('community_post_comments') || [];
      for (const c of Array.isArray(tables.community_post_comments) ? tables.community_post_comments : []) {
        const mappedAuthor = remapUserId(c.author_id);
        const mappedPost = postIdMap.get(Number(c.post_id)) ?? Number(c.post_id);
        if (!mappedAuthor || !Number.isInteger(mappedPost)) continue;
        const existing = db.prepare('SELECT id FROM community_post_comments WHERE id = ?').get(Number(c.id));
        if (existing) continue;
        const row = { ...c, post_id: mappedPost, author_id: mappedAuthor };
        const { cols, vals } = filterRowToColumns(row, commentCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT OR IGNORE INTO community_post_comments (${cols.map((col) => `"${col}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 8. Merge community_post_reactions
      const reactionCols = validColumnsCache.get('community_post_reactions') || [];
      for (const r of Array.isArray(tables.community_post_reactions) ? tables.community_post_reactions : []) {
        const mappedUser = remapUserId(r.user_id);
        const mappedPost = postIdMap.get(Number(r.post_id)) ?? Number(r.post_id);
        if (!mappedUser || !Number.isInteger(mappedPost)) continue;
        const row: BackupRow = { ...r, post_id: mappedPost, user_id: mappedUser };
        delete row.id;
        const { cols, vals } = filterRowToColumns(row, reactionCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT OR IGNORE INTO community_post_reactions (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 9. Merge community_direct_messages
      appendUserScopedRows('community_direct_messages', ['sender_id', 'recipient_id']);

      // 10. Merge community_groups & map group IDs
      const groupCols = validColumnsCache.get('community_groups') || [];
      for (const g of Array.isArray(tables.community_groups) ? tables.community_groups : []) {
        const oldGroupId = Number(g.id);
        const mappedCreator = remapUserId(g.created_by);
        if (!mappedCreator) continue;
        const existingSame = db
          .prepare('SELECT id FROM community_groups WHERE name = ? AND created_at = ?')
          .get(String(g.name || ''), String(g.created_at || '')) as { id: number } | undefined;
        if (existingSame) {
          if (Number.isInteger(oldGroupId)) groupIdMap.set(oldGroupId, existingSame.id);
          continue;
        }
        const idOccupied =
          Number.isInteger(oldGroupId) &&
          db.prepare('SELECT id FROM community_groups WHERE id = ?').get(oldGroupId);
        const row: BackupRow = { ...g, created_by: mappedCreator };
        if (idOccupied) delete row.id;
        const { cols, vals } = filterRowToColumns(row, groupCols);
        if (cols.length === 0) continue;
        const res = db
          .prepare(
            `INSERT INTO community_groups (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          )
          .run(...vals);
        if (Number.isInteger(oldGroupId)) {
          groupIdMap.set(oldGroupId, Number(res.lastInsertRowid));
        }
      }

      // 11. Merge community_group_members
      const gmCols = validColumnsCache.get('community_group_members') || [];
      for (const m of Array.isArray(tables.community_group_members) ? tables.community_group_members : []) {
        const mappedUser = remapUserId(m.user_id);
        const mappedGroup = groupIdMap.get(Number(m.group_id)) ?? Number(m.group_id);
        if (!mappedUser || !Number.isInteger(mappedGroup)) continue;
        const row = { ...m, group_id: mappedGroup, user_id: mappedUser };
        const { cols, vals } = filterRowToColumns(row, gmCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT OR IGNORE INTO community_group_members (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 12. Merge community_group_messages
      const gmsgCols = validColumnsCache.get('community_group_messages') || [];
      for (const m of Array.isArray(tables.community_group_messages) ? tables.community_group_messages : []) {
        const mappedSender = remapUserId(m.sender_id);
        const mappedGroup = groupIdMap.get(Number(m.group_id)) ?? Number(m.group_id);
        if (!mappedSender || !Number.isInteger(mappedGroup)) continue;
        const existing = db.prepare('SELECT id FROM community_group_messages WHERE id = ?').get(Number(m.id));
        if (existing) continue;
        const row = { ...m, group_id: mappedGroup, sender_id: mappedSender };
        const { cols, vals } = filterRowToColumns(row, gmsgCols);
        if (cols.length === 0) continue;
        db.prepare(
          `INSERT OR IGNORE INTO community_group_messages (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
        ).run(...vals);
      }

      // 13. Merge community_reports, student_activity_logs & competition_point_events
      appendUserScopedRows('community_reports', ['reporter_id', 'target_user_id', 'resolved_by']);
      appendUserScopedRows('student_activity_logs', ['user_id']);

      if (liveTables.has('competition_point_events')) {
        const compCols = validColumnsCache.get('competition_point_events') || [];
        const compRows = Array.isArray(tables.competition_point_events)
          ? tables.competition_point_events
          : [];
        for (const rawRow of compRows) {
          const mappedUser = remapUserId(rawRow.user_id);
          const eventKey = String(rawRow.event_key || '').trim();
          if (!mappedUser || !eventKey) continue;
          const dupKey = db
            .prepare('SELECT id FROM competition_point_events WHERE event_key = ?')
            .get(eventKey);
          if (dupKey) continue;
          const row: BackupRow = { ...rawRow, user_id: mappedUser };
          if (
            row.id !== undefined &&
            db.prepare('SELECT id FROM competition_point_events WHERE id = ?').get(Number(row.id))
          ) {
            delete row.id;
          }
          const { cols, vals } = filterRowToColumns(row, compCols);
          if (cols.length === 0) continue;
          db.prepare(
            `INSERT OR IGNORE INTO competition_point_events (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...vals);
        }
      }
      // 14. Merge revoked_sessions so explicit logouts stay revoked
      if (liveTables.has('revoked_sessions')) {
        const rsCols = validColumnsCache.get('revoked_sessions') || [];
        for (const r of Array.isArray(tables.revoked_sessions) ? tables.revoked_sessions : []) {
          const { cols, vals } = filterRowToColumns(r, rsCols);
          if (cols.length === 0) continue;
          db.prepare(
            `INSERT OR IGNORE INTO revoked_sessions (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...vals);
        }
      }

      // 15. Merge textbook_resources (deduplicate by chapter_number + title)
      if (liveTables.has('textbook_resources')) {
        const trCols = validColumnsCache.get('textbook_resources') || [];
        for (const tr of Array.isArray(tables.textbook_resources) ? tables.textbook_resources : []) {
          const dup = db
            .prepare(
              `SELECT id FROM textbook_resources
               WHERE COALESCE(chapter_number, -1) = COALESCE(?, -1) AND title = ?`
            )
            .get(tr.chapter_number ?? null, String(tr.title || ''));
          if (dup) continue;
          const idOccupied =
            tr.id !== undefined &&
            db.prepare('SELECT id FROM textbook_resources WHERE id = ?').get(Number(tr.id));
          const row: BackupRow = { ...tr, created_by: remapUserId(tr.created_by) };
          if (idOccupied) delete row.id;
          const { cols, vals } = filterRowToColumns(row, trCols);
          if (cols.length === 0) continue;
          db.prepare(
            `INSERT OR IGNORE INTO textbook_resources (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...vals);
        }
      }

      // 16. Merge textbook_study_qa (deduplicate by chapter_number + question_text)
      if (liveTables.has('textbook_study_qa')) {
        const tqCols = validColumnsCache.get('textbook_study_qa') || [];
        for (const tq of Array.isArray(tables.textbook_study_qa) ? tables.textbook_study_qa : []) {
          const dup = db
            .prepare(
              `SELECT id FROM textbook_study_qa
               WHERE chapter_number = ? AND question_text = ?`
            )
            .get(Number(tq.chapter_number), String(tq.question_text || ''));
          if (dup) continue;
          const idOccupied =
            tq.id !== undefined &&
            db.prepare('SELECT id FROM textbook_study_qa WHERE id = ?').get(Number(tq.id));
          const row: BackupRow = { ...tq, created_by: remapUserId(tq.created_by) };
          if (idOccupied) delete row.id;
          const { cols, vals } = filterRowToColumns(row, tqCols);
          if (cols.length === 0) continue;
          db.prepare(
            `INSERT OR IGNORE INTO textbook_study_qa (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
          ).run(...vals);
        }
      }
    }

    // Always restore main admin privileges
    ensureMainAdminPermissions();
  });

  db.pragma('foreign_keys = OFF');
  try {
    restoreTx();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  checkpointDatabase();
  const refreshed = buildPortableBackupPayloadFromDb(db, `post-restore-${mode}`);
  if (!options.skipSnapshotWrite) {
    updateLatestRecoverySnapshot(refreshed, {
      forceOverwrite: mode === 'replace',
      allowUserRemoval: mode === 'replace',
    });
  }

  return {
    mode,
    restoredCounts: refreshed.counts,
    safetyBackupFile: options.safetyBackupFile ?? null,
  };
}

export async function restoreFromBackupPayload(
  rawPayload: unknown,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{
  mode: 'merge' | 'replace';
  restoredCounts: PortableBackupCounts;
  safetyBackupFile: string | null;
}> {
  if (!isValidPayload(rawPayload)) {
    throw new Error('Invalid backup format. Please select a valid Grade 9 Hub backup file.');
  }

  // Always preserve current state before restoring anything
  let safetyBackupFile: string | null = null;
  const currentUsers = getLiveUserCount();
  if (currentUsers > 0) {
    const pre = await createFullBackup('pre-restore', { saveTimestampedDb: true });
    safetyBackupFile = pre.dbFilename;
  }

  return restoreFromBackupPayloadSync(rawPayload, mode, { safetyBackupFile });
}

export function ensureHydratedFromPersistentBackupSync(): {
  restored: boolean;
  source: string | null;
  usersCount: number;
} {
  const liveUsers = getLiveUserCount();
  if (liveUsers > 0) {
    return { restored: false, source: null, usersCount: liveUsers };
  }

  const persistentPayload = readPersistentBackupPayload();
  if (persistentPayload && countRealPayloadUsers(persistentPayload) > 0) {
    const res = restoreFromBackupPayloadSync(persistentPayload, 'merge', {
      skipSafetyDbBackup: true,
    });
    console.log(
      `[Backup & Recovery] Auto-restored ${res.restoredCounts.users} real user accounts from tracked src/data/persistent_backup.json.`
    );
    return {
      restored: true,
      source: 'persistent_backup.json',
      usersCount: res.restoredCounts.users,
    };
  }

  const recovery = readRecoveryJsonIfValid(LATEST_RECOVERY_PATH);
  if (recovery && countRealPayloadUsers(recovery) > 0) {
    const res = restoreFromBackupPayloadSync(recovery, 'merge', {
      skipSafetyDbBackup: true,
    });
    console.log(
      `[Backup & Recovery] Auto-restored ${res.restoredCounts.users} user accounts from latest-recovery.json.`
    );
    return {
      restored: true,
      source: 'latest-recovery.json',
      usersCount: res.restoredCounts.users,
    };
  }

  const candidates = listBackups().filter((b) => b.kind === 'sqlite');
  for (const candidate of candidates) {
    try {
      const payload = readPortableBackupFile(candidate.filename);
      if (countRealPayloadUsers(payload) > 0) {
        const res = restoreFromBackupPayloadSync(payload, 'merge', {
          skipSafetyDbBackup: true,
        });
        console.log(
          `[Backup & Recovery] Auto-restored ${res.restoredCounts.users} accounts from SQLite backup ${candidate.filename}.`
        );
        return {
          restored: true,
          source: candidate.filename,
          usersCount: res.restoredCounts.users,
        };
      }
    } catch {
      // try next backup
    }
  }

  return { restored: false, source: null, usersCount: 0 };
}

export function restoreMissingUserFromPersistentBackupSync(email: string): boolean {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) return false;

  const payload = readPersistentBackupPayload();
  if (!payload || countRealPayloadUsers(payload) === 0) return false;

  const hasUser = (payload.tables.users || []).some(
    (u) =>
      String(u.email || '').trim().toLowerCase() === norm &&
      String(u.password_hash || '') !== BOOTSTRAP_PENDING_HASH
  );
  if (!hasUser) return false;

  restoreFromBackupPayloadSync(payload, 'merge', { skipSafetyDbBackup: true });
  return true;
}

export function sanitizeBackupFilename(filename: string): string | null {
  const base = path.basename(String(filename || '').trim());
  if (!base || base.includes('..') || (!base.endsWith('.db') && !base.endsWith('.json'))) {
    return null;
  }
  const fullPath = path.join(backupsDir, base);
  if (!fullPath.startsWith(backupsDir) || !fs.existsSync(fullPath)) {
    return null;
  }
  return fullPath;
}

export function readPortableBackupFile(filename: string): PortableBackupPayload {
  const fullPath = sanitizeBackupFilename(filename);
  if (!fullPath) {
    throw new Error('Backup file not found.');
  }
  if (fullPath.endsWith('.json')) {
    const parsed = readRecoveryJsonIfValid(fullPath);
    if (!parsed) {
      throw new Error('Backup JSON file is malformed or incompatible.');
    }
    return parsed;
  }
  const readonlyDb = new Database(fullPath, { readonly: true });
  try {
    return buildPortableBackupPayloadFromDb(readonlyDb, `sqlite-file:${path.basename(fullPath)}`);
  } finally {
    readonlyDb.close();
  }
}

export async function restoreFromServerBackupFile(
  filename: string,
  mode: 'merge' | 'replace' = 'merge'
) {
  const payload = readPortableBackupFile(filename);
  return restoreFromBackupPayload(payload, mode);
}

export function listBackups(): BackupFileInfo[] {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir);
  const items: BackupFileInfo[] = [];

  for (const filename of files) {
    if (!filename.endsWith('.db') && !filename.endsWith('.json')) continue;
    const fullPath = path.join(backupsDir, filename);
    const stat = fs.statSync(fullPath);
    const isLatestRecovery = filename === LATEST_RECOVERY_FILENAME;

    let reason = filename.split('-')[0] || 'backup';
    let createdAt = stat.mtime.toISOString();
    let usersCount: number | undefined;
    let questionsCount: number | undefined;

    if (filename.endsWith('.json')) {
      const parsed = readRecoveryJsonIfValid(fullPath);
      if (parsed) {
        reason = parsed.reason || (isLatestRecovery ? 'auto-recovery' : reason);
        createdAt = parsed.createdAt || createdAt;
        usersCount = parsed.counts?.users;
        questionsCount = parsed.counts?.questions;
      }
    } else if (filename.endsWith('.db')) {
      if (filename.startsWith('pre-migration')) reason = 'pre-migration';
      else if (filename.startsWith('pre-restore')) reason = 'pre-restore';
      else if (filename.startsWith('manual')) reason = 'manual';
      else if (filename.startsWith('startup')) reason = 'startup';
      else if (filename.startsWith('shutdown')) reason = 'shutdown';
    }

    items.push({
      filename,
      kind: filename.endsWith('.db') ? 'sqlite' : 'json',
      reason,
      createdAt,
      sizeBytes: stat.size,
      isLatestRecovery,
      usersCount,
      questionsCount,
    });
  }

  return items.sort((a, b) => {
    if (a.isLatestRecovery !== b.isLatestRecovery) return a.isLatestRecovery ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getDatabaseHealthStats(): DatabaseHealthStats {
  const payload = buildPortableBackupPayloadFromDb(db, 'stats');
  const dbSizeBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const walPath = `${dbPath}-wal`;
  const walSizeBytes = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
  const latestRecovery = readRecoveryJsonIfValid(LATEST_RECOVERY_PATH);
  const backups = listBackups();

  return {
    counts: payload.counts,
    dbSizeBytes,
    walSizeBytes,
    lastRecoverySnapshotAt: latestRecovery?.createdAt || null,
    lastRecoveryUsersCount: latestRecovery?.counts?.users || 0,
    backupCount: backups.length,
  };
}

export interface AccountPassportPayload {
  v: 1;
  issuedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: 'student' | 'teacher';
    is_admin: number;
    grade: string;
    bio: string;
    birthday: string;
    avatar_url: string;
    notif_prompt_status: string;
    notifications_enabled: number;
    ai_tutor_turns: number;
    last_login_at: string;
    last_active_at: string;
    created_at: string;
    is_restricted: number;
    restriction_reason: string;
    restricted_at: string;
  };
  quiz_attempts: BackupRow[];
  student_question_answers: BackupRow[];
  competition_point_events?: BackupRow[];
}

export function restoreUserPassportRecord(passport: AccountPassportPayload): number {
  const pu = passport.user;
  const normEmail = String(pu.email || '').trim().toLowerCase();
  if (!normEmail || !pu.password_hash || pu.password_hash === BOOTSTRAP_PENDING_HASH) {
    throw new Error('Passport contains invalid user credentials.');
  }

  const isMainAdmin = normEmail === TEACHER_EMAIL.toLowerCase();
  const safeRole: 'student' | 'teacher' = isMainAdmin
    ? 'teacher'
    : pu.role === 'teacher'
    ? 'teacher'
    : 'student';
  const safeAdmin = isMainAdmin ? 1 : pu.is_admin ? 1 : 0;

  let finalUserId = 0;

  const tx = db.transaction(() => {
    const existingByEmail = db
      .prepare('SELECT id, password_hash, avatar_url FROM users WHERE LOWER(email) = LOWER(?)')
      .get(normEmail) as { id: number; password_hash: string; avatar_url: string } | undefined;

    if (!existingByEmail) {
      const requestedId = Number(pu.id);
      const idOccupied =
        Number.isInteger(requestedId) && requestedId > 0
          ? Boolean(db.prepare('SELECT id FROM users WHERE id = ?').get(requestedId))
          : true;

      if (!idOccupied) {
        db.prepare(
          `INSERT INTO users (
             id, name, email, password_hash, role, is_admin, grade, bio, birthday, avatar_url,
             notif_prompt_status, notifications_enabled, ai_tutor_turns, last_login_at, last_active_at,
             created_at, is_restricted, restriction_reason, restricted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          requestedId,
          String(pu.name || 'Grade 9 User'),
          normEmail,
          pu.password_hash,
          safeRole,
          safeAdmin,
          String(pu.grade || ''),
          String(pu.bio || ''),
          String(pu.birthday || ''),
          String(pu.avatar_url || ''),
          String(pu.notif_prompt_status || ''),
          pu.notifications_enabled === 0 ? 0 : 1,
          Number(pu.ai_tutor_turns || 0),
          String(pu.last_login_at || ''),
          String(pu.last_active_at || ''),
          String(pu.created_at || new Date().toISOString()),
          pu.is_restricted ? 1 : 0,
          String(pu.restriction_reason || ''),
          String(pu.restricted_at || '')
        );
        finalUserId = requestedId;
      } else {
        const inserted = db
          .prepare(
            `INSERT INTO users (
               name, email, password_hash, role, is_admin, grade, bio, birthday, avatar_url,
               notif_prompt_status, notifications_enabled, ai_tutor_turns, last_login_at, last_active_at,
               created_at, is_restricted, restriction_reason, restricted_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            String(pu.name || 'Grade 9 User'),
            normEmail,
            pu.password_hash,
            safeRole,
            safeAdmin,
            String(pu.grade || ''),
            String(pu.bio || ''),
            String(pu.birthday || ''),
            String(pu.avatar_url || ''),
            String(pu.notif_prompt_status || ''),
            pu.notifications_enabled === 0 ? 0 : 1,
            Number(pu.ai_tutor_turns || 0),
            String(pu.last_login_at || ''),
            String(pu.last_active_at || ''),
            String(pu.created_at || new Date().toISOString()),
            pu.is_restricted ? 1 : 0,
            String(pu.restriction_reason || ''),
            String(pu.restricted_at || '')
          );
        finalUserId = Number(inserted.lastInsertRowid);
      }
    } else if (existingByEmail.password_hash === BOOTSTRAP_PENDING_HASH) {
      db.prepare(
        `UPDATE users
         SET name = ?, password_hash = ?, role = ?, is_admin = ?, grade = ?, bio = ?, birthday = ?,
             avatar_url = ?, notif_prompt_status = ?, notifications_enabled = ?, ai_tutor_turns = ?,
             last_login_at = ?, last_active_at = ?
         WHERE id = ?`
      ).run(
        String(pu.name || 'Mr. Kasrawan'),
        pu.password_hash,
        safeRole,
        safeAdmin,
        String(pu.grade || ''),
        String(pu.bio || ''),
        String(pu.birthday || ''),
        String(pu.avatar_url || ''),
        String(pu.notif_prompt_status || ''),
        pu.notifications_enabled === 0 ? 0 : 1,
        Number(pu.ai_tutor_turns || 0),
        String(pu.last_login_at || ''),
        String(pu.last_active_at || ''),
        existingByEmail.id
      );
      finalUserId = existingByEmail.id;
    } else {
      finalUserId = existingByEmail.id;
      const passportAvatar = String(pu.avatar_url || '');
      const currentAvatar = String(existingByEmail.avatar_url || '');
      if (
        passportAvatar.startsWith('data:image/') &&
        (!currentAvatar || currentAvatar.startsWith('/uploads/'))
      ) {
        db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(
          passportAvatar,
          existingByEmail.id
        );
      }
    }

    // Safely merge quiz_attempts without duplicating attempts
    for (const attempt of Array.isArray(passport.quiz_attempts) ? passport.quiz_attempts : []) {
      const mode = String(attempt.mode || 'chapter');
      if (!['all_chapters', 'chapter', 'general'].includes(mode)) continue;
      const chapterNum =
        attempt.chapter_number === null || attempt.chapter_number === undefined
          ? null
          : Number(attempt.chapter_number);
      const totalQ = Number(attempt.total_questions || 0);
      const correctC = Number(attempt.correct_count || 0);
      const scorePct = Number(attempt.score_percent || 0);
      const answersJson = String(attempt.answers_json || '{}');
      const createdAt = String(attempt.created_at || new Date().toISOString());

      const dup = db
        .prepare(
          `SELECT id FROM quiz_attempts
           WHERE user_id = ? AND mode = ? AND COALESCE(chapter_number, -1) = COALESCE(?, -1)
             AND created_at = ? AND answers_json = ?`
        )
        .get(finalUserId, mode, chapterNum, createdAt, answersJson);
      if (dup) continue;

      db.prepare(
        `INSERT INTO quiz_attempts (user_id, mode, chapter_number, total_questions, correct_count, score_percent, answers_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(finalUserId, mode, chapterNum, totalQ, correctC, scorePct, answersJson, createdAt);
    }

    // Safely merge per-question answer history without duplicates
    for (const ans of Array.isArray(passport.student_question_answers)
      ? passport.student_question_answers
      : []) {
      const qId = Number(ans.question_id);
      if (!Number.isInteger(qId) || qId <= 0) continue;
      const isCorrect = Number(ans.is_correct ? 1 : 0);
      const createdAt = String(ans.created_at || new Date().toISOString());
      const dup = db
        .prepare(
          'SELECT id FROM student_question_answers WHERE user_id = ? AND question_id = ? AND created_at = ?'
        )
        .get(finalUserId, qId, createdAt);
      if (dup) continue;

      db.prepare(
        'INSERT INTO student_question_answers (user_id, question_id, is_correct, created_at) VALUES (?, ?, ?, ?)'
      ).run(finalUserId, qId, isCorrect, createdAt);
    }

    // Safely merge competition_point_events by unique event_key
    for (const ev of Array.isArray(passport.competition_point_events)
      ? passport.competition_point_events
      : []) {
      const eventKey = String(ev.event_key || '').trim();
      const eventType = String(ev.event_type || 'curriculum_activity').trim();
      const pts = Math.max(0, Math.min(100, Math.round(Number(ev.points || 0))));
      if (!eventKey || pts <= 0) continue;
      const chapterNum =
        ev.chapter_number === null || ev.chapter_number === undefined
          ? null
          : Number(ev.chapter_number);
      const details = String(ev.details || '');
      const createdAt = String(ev.created_at || new Date().toISOString());

      db.prepare(
        `INSERT OR IGNORE INTO competition_point_events
           (user_id, event_key, event_type, points, chapter_number, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(finalUserId, eventKey, eventType, pts, chapterNum, details, createdAt);
    }

    ensureMainAdminPermissions();
  });

  tx();
  checkpointDatabase();
  writeRecoverySnapshotSync('passport-restore');
  return finalUserId;
}

export async function initBackupAndRecovery(): Promise<void> {
  // 1. Check encrypted tracked workspace backup first (survives container /data wipes across AI Studio rebuilds)
  const persistentPayload = readPersistentBackupPayload();
  const liveUsers = getLiveUserCount();

  if (liveUsers === 0) {
    if (persistentPayload && countRealPayloadUsers(persistentPayload) > 0) {
      const res = await restoreFromBackupPayload(persistentPayload, 'merge');
      console.log(
        `[Backup & Recovery] Auto-seeded ${res.restoredCounts.users} real user accounts, ${res.restoredCounts.questions} questions, and ${res.restoredCounts.quizAttempts} quiz attempts from tracked workspace backup.`
      );
    } else {
      const recovery = readRecoveryJsonIfValid(LATEST_RECOVERY_PATH);
      if (recovery && countRealPayloadUsers(recovery) > 0) {
        const res = await restoreFromBackupPayload(recovery, 'merge');
        console.log(
          `[Backup & Recovery] Auto-recovered ${res.restoredCounts.users} user accounts, ${res.restoredCounts.questions} questions, and ${res.restoredCounts.teacherMessages} messages from latest recovery snapshot.`
        );
      } else {
        // Fallback: check timestamped .db backups for the newest one with users
        const candidates = listBackups().filter((b) => b.kind === 'sqlite');
        for (const candidate of candidates) {
          try {
            const payload = readPortableBackupFile(candidate.filename);
            if (countRealPayloadUsers(payload) > 0) {
              const res = await restoreFromBackupPayload(payload, 'merge');
              console.log(
                `[Backup & Recovery] Auto-recovered ${res.restoredCounts.users} accounts from SQLite backup ${candidate.filename}.`
              );
              break;
            }
          } catch {
            // try next backup
          }
        }
      }
    }
  } else {
    // 2. Database already has live accounts: if tracked workspace backup holds users missing from SQLite, merge them non-destructively
    if (persistentPayload && countRealPayloadUsers(persistentPayload) > 0) {
      const liveEmailRows = db
        .prepare('SELECT LOWER(email) AS email FROM users WHERE password_hash != ?')
        .all(BOOTSTRAP_PENDING_HASH) as Array<{ email: string }>;
      const liveEmails = new Set(liveEmailRows.map((r) => r.email));
      const hasMissingUsers = (persistentPayload.tables.users || []).some((u) => {
        const email = String(u.email || '').trim().toLowerCase();
        return email && String(u.password_hash || '') !== BOOTSTRAP_PENDING_HASH && !liveEmails.has(email);
      });
      if (hasMissingUsers) {
        const merged = await restoreFromBackupPayload(persistentPayload, 'merge');
        console.log(
          `[Backup & Recovery] Merged missing accounts from tracked workspace backup (total users now: ${merged.restoredCounts.users}).`
        );
      }
    }

    const recentStartup = listBackups().find(
      (b) =>
        b.kind === 'sqlite' &&
        b.reason === 'startup' &&
        Date.now() - new Date(b.createdAt).getTime() < 30 * 60 * 1000
    );
    await createFullBackup('startup', { saveTimestampedDb: !recentStartup });
  }

  ensureMainAdminPermissions();
  checkpointDatabase();
}
