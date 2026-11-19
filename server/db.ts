import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

export const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'majquiz.db');
export const TEACHER_EMAIL = 'mohamdm791@gmail.com';
export const BOOTSTRAP_PENDING_HASH = '!BOOTSTRAP_PENDING_CLAIM!';
const LATEST_SCHEMA_VERSION = 5;

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = FULL');
db.pragma('wal_autocheckpoint = 100');
db.pragma('foreign_keys = ON');

export function checkpointDatabase(): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('[DB] WAL checkpoint warning:', err);
  }
}

function getTableRowCountSafe(tableName: string): number {
  try {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { name: string } | undefined;
    if (!exists) return 0;
    const row = db.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get() as { count: number };
    return row?.count || 0;
  } catch {
    return 0;
  }
}

function getCurrentSchemaVersion(): number {
  try {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get() as { name: string } | undefined;
    if (!exists) return 0;
    const row = db
      .prepare('SELECT MAX(version) AS version FROM schema_migrations')
      .get() as { version: number | null };
    return row?.version || 0;
  } catch {
    return 0;
  }
}

function createPreMigrationBackupIfNeeded(): string | null {
  const existingUsers = getTableRowCountSafe('users');
  const existingQuestions = getTableRowCountSafe('questions');
  const currentVersion = getCurrentSchemaVersion();

  if (currentVersion >= LATEST_SCHEMA_VERSION) {
    return null;
  }
  if (existingUsers === 0 && existingQuestions === 0) {
    return null;
  }

  checkpointDatabase();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(
    backupsDir,
    `pre-migration-v${currentVersion}-to-v${LATEST_SCHEMA_VERSION}-${stamp}.db`
  );
  fs.copyFileSync(dbPath, backupFile);
  console.log(`[DB] Created pre-migration safety backup: ${path.basename(backupFile)}`);
  return backupFile;
}

const preMigrationBackupPath = createPreMigrationBackupIfNeeded();

try {
  // Always additive, non-destructive DDL & column migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
      grade TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS revoked_sessions (
      token_hash TEXT PRIMARY KEY,
      revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chapters (
      chapter_number INTEGER PRIMARY KEY CHECK (chapter_number BETWEEN 1 AND 11),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK (scope IN ('chapter', 'general')),
      chapter_number INTEGER NULL CHECK (chapter_number IS NULL OR (chapter_number BETWEEN 1 AND 11)),
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
      explanation TEXT NOT NULL DEFAULT '',
      created_by INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_number) REFERENCES chapters(chapter_number) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('all_chapters', 'chapter', 'general')),
      chapter_number INTEGER NULL,
      total_questions INTEGER NOT NULL,
      correct_count INTEGER NOT NULL,
      score_percent REAL NOT NULL,
      answers_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN ('announcement', 'material')),
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      created_by INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teacher_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('student', 'teacher')),
      message_text TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      attachment_size INTEGER NULL,
      is_read_by_recipient INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('announcement', 'question', 'chapter', 'material', 'reply')),
      link_tab TEXT NOT NULL DEFAULT 'home',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_question_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      chapter_number INTEGER NULL,
      content TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_post_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reaction TEXT NOT NULL CHECK (reaction IN ('like', 'helpful', 'celebrate', 'insightful')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      message_text TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES community_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_group_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message_text TEXT NOT NULL DEFAULT '',
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES community_groups(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'dm', 'group_message', 'user')),
      target_id INTEGER NOT NULL,
      target_user_id INTEGER NULL,
      reason TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
      resolved_by INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS student_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT '',
      target_id INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS competition_point_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_key TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      points INTEGER NOT NULL,
      chapter_number INTEGER NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_comp_events_user ON competition_point_events(user_id, id DESC);

    CREATE TABLE IF NOT EXISTS textbook_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_number INTEGER NULL CHECK (chapter_number IS NULL OR (chapter_number BETWEEN 1 AND 11)),
      title TEXT NOT NULL,
      title_ku TEXT NOT NULL DEFAULT '',
      title_ar TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      summary_ku TEXT NOT NULL DEFAULT '',
      summary_ar TEXT NOT NULL DEFAULT '',
      key_formulas TEXT NOT NULL DEFAULT '',
      resource_type TEXT NOT NULL DEFAULT 'guide' CHECK (resource_type IN ('textbook', 'guide', 'summary', 'slides')),
      attachment_name TEXT NULL,
      attachment_url TEXT NULL,
      attachment_mime TEXT NULL,
      external_url TEXT NULL,
      created_by INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_number) REFERENCES chapters(chapter_number) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS textbook_study_qa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_number INTEGER NOT NULL CHECK (chapter_number BETWEEN 1 AND 11),
      question_text TEXT NOT NULL,
      question_text_ku TEXT NOT NULL DEFAULT '',
      question_text_ar TEXT NOT NULL DEFAULT '',
      answer_text TEXT NOT NULL,
      answer_text_ku TEXT NOT NULL DEFAULT '',
      answer_text_ar TEXT NOT NULL DEFAULT '',
      explanation_text TEXT NOT NULL DEFAULT '',
      explanation_text_ku TEXT NOT NULL DEFAULT '',
      explanation_text_ar TEXT NOT NULL DEFAULT '',
      source_label TEXT NOT NULL DEFAULT 'Textbook Study Guide',
      created_by INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_number) REFERENCES chapters(chapter_number) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_textbook_res_chapter ON textbook_resources(chapter_number, id ASC);
    CREATE INDEX IF NOT EXISTS idx_textbook_qa_chapter ON textbook_study_qa(chapter_number, id ASC);
  `);

  // Safe additive column migrations wrapped in a transaction
  const runAdditiveMigrations = db.transaction(() => {
    const userColumns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const ensureUserCol = (col: string, ddl: string) => {
      if (!userColumns.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE users ADD COLUMN ${col} ${ddl}`);
      }
    };

    ensureUserCol('is_admin', 'INTEGER NOT NULL DEFAULT 0');
    ensureUserCol('birthday', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('avatar_url', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('notif_prompt_status', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('notifications_enabled', 'INTEGER NOT NULL DEFAULT 1');
    ensureUserCol('last_active_at', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('ai_tutor_turns', 'INTEGER NOT NULL DEFAULT 0');
    ensureUserCol('last_login_at', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('is_restricted', 'INTEGER NOT NULL DEFAULT 0');
    ensureUserCol('restriction_reason', "TEXT NOT NULL DEFAULT ''");
    ensureUserCol('restricted_at', "TEXT NOT NULL DEFAULT ''");

    const chapterColumns = db.prepare('PRAGMA table_info(chapters)').all() as Array<{ name: string }>;
    for (const col of ['title_ku', 'description_ku', 'title_ar', 'description_ar']) {
      if (!chapterColumns.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE chapters ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
      }
    }

    const questionColumns = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>;
    for (const col of [
      'question_text_ku',
      'option_a_ku',
      'option_b_ku',
      'option_c_ku',
      'option_d_ku',
      'explanation_ku',
      'question_text_ar',
      'option_a_ar',
      'option_b_ar',
      'option_c_ar',
      'option_d_ar',
      'explanation_ar',
    ]) {
      if (!questionColumns.some((c) => c.name === col)) {
        db.exec(`ALTER TABLE questions ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
      }
    }

    db.prepare(
      `INSERT OR IGNORE INTO schema_migrations (version, description)
       VALUES (?, ?)`
    ).run(1, 'Initial schema & trilingual content columns');
    db.prepare(
      `INSERT OR IGNORE INTO schema_migrations (version, description)
       VALUES (?, ?)`
    ).run(2, 'Community monitoring, durable WAL checkpointing, and pre-migration backup tracking');
    db.prepare(
      `INSERT OR IGNORE INTO schema_migrations (version, description)
       VALUES (?, ?)`
    ).run(3, 'Zero-logout revoked_sessions tracking and permanent main admin lock');

    const v4Applied = db
      .prepare('SELECT 1 AS ok FROM schema_migrations WHERE version = 4')
      .get() as { ok: number } | undefined;

    if (!v4Applied) {
      db.exec(`
        INSERT OR IGNORE INTO competition_point_events (user_id, event_key, event_type, points, chapter_number, details, created_at)
        SELECT sqa.user_id, 'retro-sqa-' || sqa.id, 'correct_answer', 10, NULL, 'Question #' || sqa.question_id, sqa.created_at
        FROM student_question_answers sqa
        JOIN users u ON u.id = sqa.user_id
        WHERE sqa.is_correct = 1 AND u.role = 'student' AND u.is_admin = 0;

        INSERT OR IGNORE INTO competition_point_events (user_id, event_key, event_type, points, chapter_number, details, created_at)
        SELECT qa.user_id, 'retro-qa-' || qa.id, 'quiz_completed',
               25 + CASE WHEN qa.score_percent >= 100 THEN 30 WHEN qa.score_percent >= 80 THEN 15 ELSE 0 END,
               qa.chapter_number,
               qa.mode || ' (' || qa.correct_count || '/' || qa.total_questions || ')',
               qa.created_at
        FROM quiz_attempts qa
        JOIN users u ON u.id = qa.user_id
        WHERE u.role = 'student' AND u.is_admin = 0;
      `);

      db.prepare(
        `INSERT OR IGNORE INTO schema_migrations (version, description)
         VALUES (?, ?)`
      ).run(4, 'Student Competition & Leaderboard points tracking with idempotent offline sync');
    }

    db.prepare(
      `INSERT OR IGNORE INTO schema_migrations (version, description)
       VALUES (?, ?)`
    ).run(5, 'Textbooks & Study Q&A chapter resources and worked study Q&A bank');
  });

  runAdditiveMigrations();
} catch (migrationErr) {
  console.error('[DB] Migration failed! Attempting automatic rollback from pre-migration backup:', migrationErr);
  if (preMigrationBackupPath && fs.existsSync(preMigrationBackupPath)) {
    try {
      db.close();
      fs.copyFileSync(preMigrationBackupPath, dbPath);
      const walPath = `${dbPath}-wal`;
      const shmPath = `${dbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      console.log(`[DB] Successfully rolled back database to ${path.basename(preMigrationBackupPath)}.`);
    } catch (rollbackErr) {
      console.error('[DB] Automatic rollback failed:', rollbackErr);
    }
  }
  throw migrationErr;
}

// Ensure all 11 chapters exist without overwriting existing chapter titles or questions
const insertChapterStmt = db.prepare(`
  INSERT OR IGNORE INTO chapters (chapter_number, title, description)
  VALUES (?, ?, ?)
`);

for (let i = 1; i <= 11; i++) {
  insertChapterStmt.run(
    i,
    `Chapter ${i}`,
    `Textbook Chapter ${i} multiple-choice assessment`
  );
}

export function getRealUserCount(): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM users WHERE password_hash != ?')
    .get(BOOTSTRAP_PENDING_HASH) as { count: number };
  return row?.count || 0;
}

export function ensureMainAdminPermissions(): void {
  const existing = db
    .prepare('SELECT id, role, is_admin FROM users WHERE LOWER(email) = LOWER(?)')
    .get(TEACHER_EMAIL) as { id: number; role: string; is_admin: number } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT OR IGNORE INTO users (name, email, password_hash, role, is_admin, grade, bio)
       VALUES (?, ?, ?, 'teacher', 1, '', ?)`
    ).run(
      'Mr. Kasrawan',
      TEACHER_EMAIL,
      BOOTSTRAP_PENDING_HASH,
      'Science Teacher | Grade 9 Hub Administrator'
    );
  } else if (existing.role !== 'teacher' || !existing.is_admin) {
    db.prepare("UPDATE users SET role = 'teacher', is_admin = 1 WHERE id = ?").run(existing.id);
  }
}

// Always ensure the main administrator account retains full teacher + admin privileges
ensureMainAdminPermissions();
checkpointDatabase();
