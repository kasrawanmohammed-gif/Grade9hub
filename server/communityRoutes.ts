import { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { db, TEACHER_EMAIL } from './db.ts';

export interface CommunityAuthUser {
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

export interface CommunityAuthedRequest extends Request {
  user?: CommunityAuthUser;
}

export function logStudentActivity(
  userId: number,
  actionType: string,
  details = '',
  targetType = '',
  targetId: number | null = null
): void {
  try {
    db.prepare(
      `INSERT INTO student_activity_logs (user_id, action_type, details, target_type, target_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, actionType, details.slice(0, 500), targetType, targetId);
  } catch {
    // non-fatal logging safeguard
  }
}

interface RegisterCommunityDeps {
  app: Express;
  requireAuth: (req: CommunityAuthedRequest, res: Response, next: NextFunction) => void;
  requireTeacher: (req: CommunityAuthedRequest, res: Response, next: NextFunction) => void;
  upload: multer.Multer;
  isUserOnline: (userId: number) => boolean;
  getUserSection: (userId: number) => string;
  touchUserActivity: (userId: number) => void;
  broadcastAdminDashboard: () => void;
  broadcastToUser: (userId: number, event: unknown) => void;
  broadcastToAllUsers: (event: unknown) => void;
  broadcastToAdmins: (event: unknown) => void;
  notifySingleUser: (params: {
    userId: number;
    title: string;
    body: string;
    category: 'announcement' | 'question' | 'chapter' | 'material' | 'reply';
    linkTab: string;
    linkUrl?: string;
    tag?: string;
    icon?: string;
    data?: Record<string, unknown>;
    localizedFactory?: (lang: 'en' | 'ku' | 'ar') => {
      title: string;
      body: string;
      url?: string;
      tab?: string;
      tag?: string;
      icon?: string;
      lang?: 'en' | 'ku' | 'ar';
      dir?: 'ltr' | 'rtl';
      data?: Record<string, unknown>;
    };
  }) => void;
  onAwardCurriculumPoints?: (params: {
    userId: number;
    eventKey: string;
    eventType: 'curriculum_activity';
    points: number;
    chapterNumber?: number | null;
    details: string;
  }) => void;
}

const ALLOWED_REACTIONS = new Set(['like', 'helpful', 'celebrate', 'insightful']);
const ALLOWED_REPORT_TARGETS = new Set(['post', 'comment', 'dm', 'group_message', 'user']);

function getCommunityPolicy(): { communityEnabled: boolean; communityPostingEnabled: boolean } {
  try {
    const row = db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get('app_settings_v1') as { value: string } | undefined;
    if (!row?.value) return { communityEnabled: true, communityPostingEnabled: true };
    const parsed = JSON.parse(row.value) as {
      communityEnabled?: boolean;
      communityPostingEnabled?: boolean;
    };
    return {
      communityEnabled: typeof parsed.communityEnabled === 'boolean' ? parsed.communityEnabled : true,
      communityPostingEnabled:
        typeof parsed.communityPostingEnabled === 'boolean'
          ? parsed.communityPostingEnabled
          : true,
    };
  } catch {
    return { communityEnabled: true, communityPostingEnabled: true };
  }
}

function ensureCommunityReadable(user: CommunityAuthUser, res: Response): boolean {
  if (user.role === 'teacher' || user.isAdmin) return true;
  if (!getCommunityPolicy().communityEnabled) {
    res.status(403).json({
      error: 'Student Community is currently disabled by the administrator.',
    });
    return false;
  }
  return true;
}

function ensureNotRestricted(user: CommunityAuthUser, res: Response): boolean {
  if (user.role === 'teacher' || user.isAdmin) return true;
  const policy = getCommunityPolicy();
  if (!policy.communityEnabled) {
    res.status(403).json({
      error: 'Student Community is currently disabled by the administrator.',
    });
    return false;
  }
  if (!policy.communityPostingEnabled) {
    res.status(403).json({
      error: 'Community posting and messaging are currently paused by the administrator.',
    });
    return false;
  }
  if (user.isRestricted) {
    res.status(403).json({
      error: user.restrictionReason
        ? `Your community posting and messaging privileges are restricted: ${user.restrictionReason}`
        : 'Your community posting and messaging privileges have been restricted by the administrator.',
    });
    return false;
  }
  return true;
}

export function registerCommunityRoutes(deps: RegisterCommunityDeps): void {
  const {
    app,
    requireAuth,
    requireTeacher,
    upload,
    isUserOnline,
    getUserSection,
    touchUserActivity,
    broadcastAdminDashboard,
    broadcastToUser,
    broadcastToAllUsers,
    broadcastToAdmins,
    notifySingleUser,
    onAwardCurriculumPoints,
  } = deps;

  function serializePostRow(post: {
    id: number;
    author_id: number;
    author_name: string;
    author_avatar_url: string;
    author_role: string;
    author_is_admin: number;
    author_grade: string;
    author_is_restricted: number;
    chapter_number: number | null;
    content: string;
    attachment_name: string | null;
    attachment_url: string | null;
    attachment_mime: string | null;
    created_at: string;
  }, viewerId: number) {
    const reactionRows = db
      .prepare(
        `SELECT r.user_id, r.reaction, u.name
         FROM community_post_reactions r
         JOIN users u ON u.id = r.user_id
         WHERE r.post_id = ?`
      )
      .all(post.id) as Array<{ user_id: number; reaction: string; name: string }>;

    const counts: Record<string, number> = {
      like: 0,
      helpful: 0,
      celebrate: 0,
      insightful: 0,
    };
    let myReaction: string | null = null;
    for (const r of reactionRows) {
      if (counts[r.reaction] !== undefined) counts[r.reaction] += 1;
      if (r.user_id === viewerId) myReaction = r.reaction;
    }

    const comments = db
      .prepare(
        `SELECT c.id, c.post_id, c.author_id, c.content, c.created_at,
                u.name AS author_name, u.avatar_url AS author_avatar_url,
                u.role AS author_role, u.is_admin AS author_is_admin
         FROM community_post_comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.post_id = ?
         ORDER BY c.id ASC`
      )
      .all(post.id) as Array<{
      id: number;
      post_id: number;
      author_id: number;
      content: string;
      created_at: string;
      author_name: string;
      author_avatar_url: string;
      author_role: 'student' | 'teacher';
      author_is_admin: number;
    }>;

    return {
      id: post.id,
      author_id: post.author_id,
      author_name: post.author_name,
      author_avatar_url: post.author_avatar_url || '',
      author_role: post.author_role,
      author_is_admin: Boolean(post.author_is_admin),
      author_online: isUserOnline(post.author_id),
      author_grade: post.author_grade || '',
      author_is_restricted: Boolean(post.author_is_restricted),
      chapter_number: post.chapter_number,
      content: post.content,
      attachment_name: post.attachment_name,
      attachment_url: post.attachment_url,
      attachment_mime: post.attachment_mime,
      created_at: post.created_at,
      reactionCounts: counts,
      totalReactions: reactionRows.length,
      myReaction,
      comments: comments.map((c) => ({
        id: c.id,
        post_id: c.post_id,
        author_id: c.author_id,
        author_name: c.author_name,
        author_avatar_url: c.author_avatar_url || '',
        author_role: c.author_role,
        author_is_admin: Boolean(c.author_is_admin),
        author_online: isUserOnline(c.author_id),
        content: c.content,
        created_at: c.created_at,
      })),
    };
  }

  // ---------------- 1. ACTIVE STUDENTS & CLASSMATES ----------------
  app.get('/api/community/peers', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const viewer = req.user!;
    if (!ensureCommunityReadable(viewer, res)) return;
    const isPrivileged = viewer.role === 'teacher' || viewer.isAdmin;

    const rows = db
      .prepare(
        `SELECT id, name, email, role, is_admin, grade, bio, avatar_url, last_active_at, last_login_at, is_restricted
         FROM users
         ORDER BY name ASC`
      )
      .all() as Array<{
      id: number;
      name: string;
      email: string;
      role: 'student' | 'teacher';
      is_admin: number;
      grade: string;
      bio: string;
      avatar_url: string;
      last_active_at: string;
      last_login_at: string;
      is_restricted: number;
    }>;

    const peers = rows.map((r) => {
      const online = isUserOnline(r.id);
      return {
        id: r.id,
        name: r.name,
        email: isPrivileged ? r.email : undefined,
        role: r.role,
        isAdmin: Boolean(r.is_admin) || r.email.toLowerCase() === TEACHER_EMAIL.toLowerCase(),
        grade: r.grade,
        bio: r.bio,
        avatar_url: r.avatar_url || '',
        online,
        currentSection: online ? getUserSection(r.id) : '',
        lastActiveAt: r.last_active_at || r.last_login_at || '',
        lastLoginAt: isPrivileged ? r.last_login_at || '' : undefined,
        isRestricted: Boolean(r.is_restricted),
      };
    });

    peers.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        a.name.localeCompare(b.name)
    );

    res.json({ peers });
  });

  // ---------------- 2. COMMUNITY SOCIAL FEED (POSTS, COMMENTS, REACTIONS) ----------------
  app.get('/api/community/posts', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const viewer = req.user!;
    if (!ensureCommunityReadable(viewer, res)) return;
    const q = String(req.query.q || '').trim().toLowerCase();
    const chapterParam = req.query.chapter ? Number(req.query.chapter) : null;

    let sql = `
      SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar_url,
             u.role AS author_role, u.is_admin AS author_is_admin,
             u.grade AS author_grade, u.is_restricted AS author_is_restricted
      FROM community_posts p
      JOIN users u ON u.id = p.author_id
      WHERE 1 = 1
    `;
    const params: unknown[] = [];

    if (chapterParam && Number.isInteger(chapterParam) && chapterParam >= 1 && chapterParam <= 11) {
      sql += ' AND p.chapter_number = ?';
      params.push(chapterParam);
    }
    if (q) {
      sql += ' AND (LOWER(p.content) LIKE ? OR LOWER(u.name) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY p.id DESC LIMIT 60';

    const rows = db.prepare(sql).all(...params) as Array<Parameters<typeof serializePostRow>[0]>;
    const posts = rows.map((row) => serializePostRow(row, viewer.id));
    res.json({ posts });
  });

  app.post(
    '/api/community/posts',
    requireAuth,
    upload.single('attachment'),
    (req: CommunityAuthedRequest, res: Response) => {
      const user = req.user!;
      if (!ensureNotRestricted(user, res)) return;

      const content = String(req.body?.content || '').trim();
      const rawChapter = req.body?.chapterNumber;
      const chapterNumber =
        rawChapter !== undefined && rawChapter !== null && rawChapter !== ''
          ? Number(rawChapter)
          : null;

      if (chapterNumber !== null && (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 11)) {
        res.status(400).json({ error: 'Chapter tag must be between 1 and 11.' });
        return;
      }

      if (!content && !req.file) {
        res.status(400).json({ error: 'Please write an educational post or attach a file/image.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;

      const result = db
        .prepare(
          `INSERT INTO community_posts (author_id, chapter_number, content, attachment_name, attachment_url, attachment_mime)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(user.id, chapterNumber, content, attachmentName, attachmentUrl, attachmentMime);

      const postId = Number(result.lastInsertRowid);
      const row = db
        .prepare(
          `SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar_url,
                  u.role AS author_role, u.is_admin AS author_is_admin,
                  u.grade AS author_grade, u.is_restricted AS author_is_restricted
           FROM community_posts p
           JOIN users u ON u.id = p.author_id
           WHERE p.id = ?`
        )
        .get(postId) as Parameters<typeof serializePostRow>[0];

      const serialized = serializePostRow(row, user.id);

      touchUserActivity(user.id);
      logStudentActivity(
        user.id,
        'post_created',
        content ? content.slice(0, 120) : `Shared attachment: ${attachmentName}`,
        'post',
        postId
      );
      broadcastAdminDashboard();
      broadcastToAllUsers({ type: 'community:post:created', payload: serialized });
      broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'post_created', postId } });
      onAwardCurriculumPoints?.({
        userId: user.id,
        eventKey: `community-post-${postId}`,
        eventType: 'curriculum_activity',
        points: 5,
        chapterNumber,
        details: 'Shared study post in Student Community',
      });

      res.status(201).json({ post: serialized });
    }
  );

  app.delete('/api/community/posts/:id', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const postId = Number(req.params.id);
    const post = db
      .prepare('SELECT id, author_id, content FROM community_posts WHERE id = ?')
      .get(postId) as { id: number; author_id: number; content: string } | undefined;

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (post.author_id !== user.id && !isPrivileged) {
      res.status(403).json({ error: 'You can only delete your own posts.' });
      return;
    }

    db.prepare('DELETE FROM community_posts WHERE id = ?').run(postId);
    if (isPrivileged && post.author_id !== user.id) {
      logStudentActivity(user.id, 'content_deleted', `Deleted post #${postId}: ${post.content.slice(0, 80)}`, 'post', postId);
    } else {
      logStudentActivity(user.id, 'post_deleted', `Removed own post #${postId}`, 'post', postId);
    }
    broadcastToAllUsers({ type: 'community:post:deleted', payload: { postId } });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'post_deleted', postId } });

    res.json({ ok: true });
  });

  app.post('/api/community/posts/:id/comments', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    if (!ensureNotRestricted(user, res)) return;

    const postId = Number(req.params.id);
    const content = String(req.body?.content || '').trim();
    if (!content) {
      res.status(400).json({ error: 'Comment text is required.' });
      return;
    }

    const post = db
      .prepare('SELECT id, author_id FROM community_posts WHERE id = ?')
      .get(postId) as { id: number; author_id: number } | undefined;

    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO community_post_comments (post_id, author_id, content)
         VALUES (?, ?, ?)`
      )
      .run(postId, user.id, content);

    const commentId = Number(result.lastInsertRowid);
    const created = db
      .prepare(
        `SELECT c.id, c.post_id, c.author_id, c.content, c.created_at,
                u.name AS author_name, u.avatar_url AS author_avatar_url,
                u.role AS author_role, u.is_admin AS author_is_admin
         FROM community_post_comments c
         JOIN users u ON u.id = c.author_id
         WHERE c.id = ?`
      )
      .get(commentId) as {
      id: number;
      post_id: number;
      author_id: number;
      content: string;
      created_at: string;
      author_name: string;
      author_avatar_url: string;
      author_role: 'student' | 'teacher';
      author_is_admin: number;
    };

    const comment = {
      ...created,
      author_avatar_url: created.author_avatar_url || '',
      author_is_admin: Boolean(created.author_is_admin),
      author_online: isUserOnline(created.author_id),
    };

    touchUserActivity(user.id);
    logStudentActivity(user.id, 'comment_created', content.slice(0, 120), 'comment', commentId);
    broadcastAdminDashboard();

    if (post.author_id !== user.id) {
      const postUrl = `/?tab=community&communityTab=feed&postId=${postId}`;
      const postTag = `grade9hub-post-${postId}`;
      notifySingleUser({
        userId: post.author_id,
        title: `${user.name} commented on your post`,
        body: content.slice(0, 120),
        category: 'reply',
        linkTab: 'community',
        linkUrl: postUrl,
        tag: postTag,
        icon: user.avatar_url,
        data: { communityTab: 'feed', postId },
        localizedFactory: (lang) => ({
          title:
            lang === 'ku'
              ? `${user.name} لێدوانی لەسەر پۆستەکەت نووسی`
              : lang === 'ar'
              ? `علّق ${user.name} على منشورك`
              : `${user.name} commented on your post`,
          body: content.slice(0, 120),
          url: postUrl,
          tab: 'community',
          tag: postTag,
          icon: user.avatar_url,
          lang,
          dir: lang === 'en' ? 'ltr' : 'rtl',
          data: { communityTab: 'feed', postId },
        }),
      });
    }

    broadcastToAllUsers({ type: 'community:comment:created', payload: comment });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'comment_created', postId, commentId } });
    onAwardCurriculumPoints?.({
      userId: user.id,
      eventKey: `community-comment-${commentId}`,
      eventType: 'curriculum_activity',
      points: 5,
      chapterNumber: null,
      details: `Commented on study post #${postId}`,
    });

    res.status(201).json({ comment });
  });

  app.delete('/api/community/comments/:commentId', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const commentId = Number(req.params.commentId);
    const comment = db
      .prepare('SELECT id, post_id, author_id, content FROM community_post_comments WHERE id = ?')
      .get(commentId) as { id: number; post_id: number; author_id: number; content: string } | undefined;

    if (!comment) {
      res.status(404).json({ error: 'Comment not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (comment.author_id !== user.id && !isPrivileged) {
      res.status(403).json({ error: 'You can only delete your own comments.' });
      return;
    }

    db.prepare('DELETE FROM community_post_comments WHERE id = ?').run(commentId);
    if (isPrivileged && comment.author_id !== user.id) {
      logStudentActivity(user.id, 'content_deleted', `Deleted comment #${commentId}: ${comment.content.slice(0, 80)}`, 'comment', commentId);
    }
    broadcastToAllUsers({
      type: 'community:comment:deleted',
      payload: { postId: comment.post_id, commentId },
    });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'comment_deleted', commentId } });

    res.json({ ok: true });
  });

  app.post('/api/community/posts/:id/react', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    if (!ensureNotRestricted(user, res)) return;

    const postId = Number(req.params.id);
    const reaction = String(req.body?.reaction || '').trim();
    if (!ALLOWED_REACTIONS.has(reaction)) {
      res.status(400).json({ error: 'Invalid reaction type.' });
      return;
    }

    const post = db.prepare('SELECT id FROM community_posts WHERE id = ?').get(postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found.' });
      return;
    }

    const existing = db
      .prepare('SELECT id, reaction FROM community_post_reactions WHERE post_id = ? AND user_id = ?')
      .get(postId, user.id) as { id: number; reaction: string } | undefined;

    let activeReaction: string | null = reaction;
    if (existing && existing.reaction === reaction) {
      db.prepare('DELETE FROM community_post_reactions WHERE id = ?').run(existing.id);
      activeReaction = null;
    } else if (existing) {
      db.prepare('UPDATE community_post_reactions SET reaction = ? WHERE id = ?').run(reaction, existing.id);
    } else {
      db.prepare('INSERT INTO community_post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)').run(
        postId,
        user.id,
        reaction
      );
      logStudentActivity(user.id, 'reaction_added', `Reacted "${reaction}" on post #${postId}`, 'post', postId);
    }

    const rows = db
      .prepare('SELECT reaction, COUNT(*) AS count FROM community_post_reactions WHERE post_id = ? GROUP BY reaction')
      .all(postId) as Array<{ reaction: string; count: number }>;

    const reactionCounts: Record<string, number> = {
      like: 0,
      helpful: 0,
      celebrate: 0,
      insightful: 0,
    };
    let totalReactions = 0;
    for (const r of rows) {
      reactionCounts[r.reaction] = r.count;
      totalReactions += r.count;
    }

    touchUserActivity(user.id);
    broadcastToAllUsers({
      type: 'community:post:reacted',
      payload: { postId, reactionCounts, totalReactions, actorId: user.id, actorReaction: activeReaction },
    });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'reaction_added', postId } });

    res.json({ postId, reactionCounts, totalReactions, myReaction: activeReaction });
  });

  // ---------------- 3. PRIVATE DIRECT MESSAGES (STUDENT ↔ CLASSMATE) ----------------
  app.get('/api/community/dm/threads', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;

    const peers = db
      .prepare(
        `SELECT u.id, u.name, u.avatar_url, u.role, u.is_admin, u.grade, u.last_active_at, u.is_restricted
         FROM users u
         WHERE u.id != ?
         ORDER BY u.name ASC`
      )
      .all(user.id) as Array<{
      id: number;
      name: string;
      avatar_url: string;
      role: 'student' | 'teacher';
      is_admin: number;
      grade: string;
      last_active_at: string;
      is_restricted: number;
    }>;

    const threads = peers.map((p) => {
      const lastMsg = db
        .prepare(
          `SELECT id, sender_id, message_text, attachment_name, created_at
           FROM community_direct_messages
           WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
           ORDER BY id DESC
           LIMIT 1`
        )
        .get(user.id, p.id, p.id, user.id) as
        | {
            id: number;
            sender_id: number;
            message_text: string;
            attachment_name: string | null;
            created_at: string;
          }
        | undefined;

      const unreadRow = db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM community_direct_messages
           WHERE sender_id = ? AND recipient_id = ? AND is_read = 0`
        )
        .get(p.id, user.id) as { count: number };

      return {
        peer_id: p.id,
        peer_name: p.name,
        peer_avatar_url: p.avatar_url || '',
        peer_role: p.role,
        peer_is_admin: Boolean(p.is_admin),
        peer_grade: p.grade,
        peer_online: isUserOnline(p.id),
        peer_is_restricted: Boolean(p.is_restricted),
        last_message_at: lastMsg?.created_at || null,
        last_message_text: lastMsg?.message_text || '',
        last_attachment_name: lastMsg?.attachment_name || null,
        unread_count: unreadRow.count,
      };
    });

    threads.sort((a, b) => {
      if (a.last_message_at && b.last_message_at) {
        return b.last_message_at.localeCompare(a.last_message_at);
      }
      if (a.last_message_at) return -1;
      if (b.last_message_at) return 1;
      return Number(b.peer_online) - Number(a.peer_online) || a.peer_name.localeCompare(b.peer_name);
    });

    res.json({ threads });
  });

  app.get('/api/community/dm/:peerId', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    if (!ensureCommunityReadable(user, res)) return;
    const peerId = Number(req.params.peerId);
    if (!Number.isInteger(peerId) || peerId <= 0) {
      res.status(400).json({ error: 'Invalid classmate ID.' });
      return;
    }

    const rawMessages = db
      .prepare(
        `SELECT m.*,
                su.name AS sender_name, su.avatar_url AS sender_avatar_url, su.role AS sender_role,
                ru.name AS recipient_name
         FROM community_direct_messages m
         JOIN users su ON su.id = m.sender_id
         JOIN users ru ON ru.id = m.recipient_id
         WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
         ORDER BY m.id ASC
         LIMIT 200`
      )
      .all(user.id, peerId, peerId, user.id) as Array<{ sender_id: number } & Record<string, unknown>>;

    const messages = rawMessages.map((m) => ({
      ...m,
      sender_online: isUserOnline(m.sender_id),
    }));

    db.prepare(
      `UPDATE community_direct_messages
       SET is_read = 1
       WHERE sender_id = ? AND recipient_id = ? AND is_read = 0`
    ).run(peerId, user.id);

    res.json({ messages });
  });

  app.post(
    '/api/community/dm/:peerId',
    requireAuth,
    upload.single('attachment'),
    (req: CommunityAuthedRequest, res: Response) => {
      const user = req.user!;
      if (!ensureNotRestricted(user, res)) return;

      const peerId = Number(req.params.peerId);
      if (!Number.isInteger(peerId) || peerId <= 0 || peerId === user.id) {
        res.status(400).json({ error: 'Valid recipient is required.' });
        return;
      }

      const recipient = db.prepare('SELECT id, name FROM users WHERE id = ?').get(peerId) as
        | { id: number; name: string }
        | undefined;
      if (!recipient) {
        res.status(404).json({ error: 'Recipient account not found.' });
        return;
      }

      const messageText = String(req.body?.messageText || '').trim();
      if (!messageText && !req.file) {
        res.status(400).json({ error: 'Please write a message or attach an image/file.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;

      const result = db
        .prepare(
          `INSERT INTO community_direct_messages
           (sender_id, recipient_id, message_text, attachment_name, attachment_url, attachment_mime)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(user.id, peerId, messageText, attachmentName, attachmentUrl, attachmentMime);

      const messageId = Number(result.lastInsertRowid);
      const createdRaw = db
        .prepare(
          `SELECT m.*,
                  su.name AS sender_name, su.avatar_url AS sender_avatar_url, su.role AS sender_role,
                  ru.name AS recipient_name
           FROM community_direct_messages m
           JOIN users su ON su.id = m.sender_id
           JOIN users ru ON ru.id = m.recipient_id
           WHERE m.id = ?`
        )
        .get(messageId) as ({ sender_id: number } & Record<string, unknown>) | undefined;

      const created = createdRaw ? { ...createdRaw, sender_online: isUserOnline(createdRaw.sender_id) } : createdRaw;

      touchUserActivity(user.id);
      logStudentActivity(
        user.id,
        'dm_sent',
        `To ${recipient.name}: ${messageText ? messageText.slice(0, 100) : attachmentName}`,
        'dm',
        messageId
      );
      broadcastAdminDashboard();

      const dmUrl = `/?tab=community&communityTab=dm&peerId=${user.id}`;
      const dmTag = `grade9hub-dm-${user.id}`;
      const dmBody = messageText ? messageText.slice(0, 120) : `Sent an attachment: ${attachmentName}`;

      notifySingleUser({
        userId: peerId,
        title: `New message from ${user.name}`,
        body: dmBody,
        category: 'reply',
        linkTab: 'community',
        linkUrl: dmUrl,
        tag: dmTag,
        icon: user.avatar_url,
        data: { communityTab: 'dm', peerId: user.id },
        localizedFactory: (lang) => ({
          title:
            lang === 'ku'
              ? `نامەیەکی نوێ لە ${user.name}`
              : lang === 'ar'
              ? `رسالة جديدة من ${user.name}`
              : `New message from ${user.name}`,
          body: messageText
            ? messageText.slice(0, 120)
            : lang === 'ku'
            ? `هاوپێچێکی نارد: ${attachmentName}`
            : lang === 'ar'
            ? `أرسل مرفقاً: ${attachmentName}`
            : dmBody,
          url: dmUrl,
          tab: 'community',
          tag: dmTag,
          icon: user.avatar_url,
          lang,
          dir: lang === 'en' ? 'ltr' : 'rtl',
          data: { communityTab: 'dm', peerId: user.id },
        }),
      });

      const wsPayload = { type: 'community:dm:new', payload: created };
      broadcastToUser(user.id, wsPayload);
      broadcastToUser(peerId, wsPayload);
      broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'dm_sent', messageId } });

      res.status(201).json({ message: created });
    }
  );

  app.delete('/api/community/dm/message/:id', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const id = Number(req.params.id);
    const msg = db
      .prepare('SELECT id, sender_id, recipient_id, message_text FROM community_direct_messages WHERE id = ?')
      .get(id) as
      | { id: number; sender_id: number; recipient_id: number; message_text: string }
      | undefined;

    if (!msg) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (msg.sender_id !== user.id && !isPrivileged) {
      res.status(403).json({ error: 'You can only delete your own messages.' });
      return;
    }

    db.prepare('DELETE FROM community_direct_messages WHERE id = ?').run(id);
    if (isPrivileged && msg.sender_id !== user.id) {
      logStudentActivity(user.id, 'content_deleted', `Deleted DM #${id}: ${msg.message_text.slice(0, 80)}`, 'dm', id);
    }

    const delEvt = {
      type: 'community:dm:deleted',
      payload: { id, senderId: msg.sender_id, recipientId: msg.recipient_id },
    };
    broadcastToUser(msg.sender_id, delEvt);
    broadcastToUser(msg.recipient_id, delEvt);
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'dm_deleted', messageId: id } });

    res.json({ ok: true });
  });

  // ---------------- 4. GROUP CHATS ----------------
  app.get('/api/community/groups', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const isPrivileged = user.role === 'teacher' || user.isAdmin;

    const groups = db
      .prepare(
        `SELECT g.*, u.name AS creator_name,
                (SELECT COUNT(*) FROM community_group_members m WHERE m.group_id = g.id) AS member_count,
                (SELECT COUNT(*) FROM community_group_messages gm WHERE gm.group_id = g.id) AS message_count,
                (SELECT gm.message_text FROM community_group_messages gm WHERE gm.group_id = g.id ORDER BY gm.id DESC LIMIT 1) AS last_message_text,
                (SELECT gm.created_at FROM community_group_messages gm WHERE gm.group_id = g.id ORDER BY gm.id DESC LIMIT 1) AS last_message_at,
                EXISTS(SELECT 1 FROM community_group_members m WHERE m.group_id = g.id AND m.user_id = ?) AS is_member
         FROM community_groups g
         JOIN users u ON u.id = g.created_by
         WHERE ? = 1 OR g.is_public = 1 OR EXISTS(
           SELECT 1 FROM community_group_members m WHERE m.group_id = g.id AND m.user_id = ?
         )
         ORDER BY COALESCE(last_message_at, g.created_at) DESC`
      )
      .all(user.id, isPrivileged ? 1 : 0, user.id) as Array<{
      id: number;
      name: string;
      description: string;
      is_public: number;
      created_by: number;
      creator_name: string;
      created_at: string;
      member_count: number;
      message_count: number;
      last_message_text: string | null;
      last_message_at: string | null;
      is_member: number;
    }>;

    res.json({
      groups: groups.map((g) => ({
        ...g,
        is_public: Boolean(g.is_public),
        is_member: Boolean(g.is_member),
      })),
    });
  });

  app.post('/api/community/groups', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    if (!ensureNotRestricted(user, res)) return;

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const isPublic = req.body?.isPublic !== false;
    const memberIdsRaw = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];

    if (name.length < 2) {
      res.status(400).json({ error: 'Group name must be at least 2 characters.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO community_groups (name, description, is_public, created_by)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, description, isPublic ? 1 : 0, user.id);

    const groupId = Number(result.lastInsertRowid);
    const addMember = db.prepare(
      'INSERT OR IGNORE INTO community_group_members (group_id, user_id, role) VALUES (?, ?, ?)'
    );
    addMember.run(groupId, user.id, 'owner');

    for (const rawId of memberIdsRaw) {
      const mId = Number(rawId);
      if (Number.isInteger(mId) && mId > 0 && mId !== user.id) {
        const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(mId);
        if (exists) {
          addMember.run(groupId, mId, 'member');
        }
      }
    }

    touchUserActivity(user.id);
    logStudentActivity(user.id, 'group_created', `Created group "${name}"`, 'group', groupId);
    broadcastToAllUsers({ type: 'community:group:updated', payload: { groupId } });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'group_created', groupId } });

    res.status(201).json({ groupId });
  });

  app.post('/api/community/groups/:groupId/join', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const groupId = Number(req.params.groupId);
    const group = db
      .prepare('SELECT id, is_public, name FROM community_groups WHERE id = ?')
      .get(groupId) as { id: number; is_public: number; name: string } | undefined;

    if (!group) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (!group.is_public && !isPrivileged) {
      res.status(403).json({ error: 'This is a private group. Ask the group owner to add you.' });
      return;
    }

    db.prepare('INSERT OR IGNORE INTO community_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
      groupId,
      user.id,
      'member'
    );
    logStudentActivity(user.id, 'group_joined', `Joined group "${group.name}"`, 'group', groupId);
    broadcastToAllUsers({ type: 'community:group:updated', payload: { groupId } });
    res.json({ ok: true });
  });

  app.post('/api/community/groups/:groupId/leave', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const groupId = Number(req.params.groupId);
    db.prepare('DELETE FROM community_group_members WHERE group_id = ? AND user_id = ?').run(groupId, user.id);
    broadcastToAllUsers({ type: 'community:group:updated', payload: { groupId } });
    res.json({ ok: true });
  });

  app.post('/api/community/groups/:groupId/members', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    if (!ensureNotRestricted(user, res)) return;
    const groupId = Number(req.params.groupId);
    const targetUserId = Number(req.body?.userId);

    const group = db.prepare('SELECT id, created_by FROM community_groups WHERE id = ?').get(groupId) as
      | { id: number; created_by: number }
      | undefined;
    if (!group) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }

    const isMember = db
      .prepare('SELECT 1 FROM community_group_members WHERE group_id = ? AND user_id = ?')
      .get(groupId, user.id);
    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (!isMember && !isPrivileged) {
      res.status(403).json({ error: 'Only group members or admin can add classmates.' });
      return;
    }

    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!target) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    db.prepare('INSERT OR IGNORE INTO community_group_members (group_id, user_id, role) VALUES (?, ?, ?)').run(
      groupId,
      targetUserId,
      'member'
    );
    broadcastToAllUsers({ type: 'community:group:updated', payload: { groupId } });
    res.json({ ok: true });
  });

  app.get('/api/community/groups/:groupId/messages', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const groupId = Number(req.params.groupId);
    const isPrivileged = user.role === 'teacher' || user.isAdmin;

    const group = db.prepare('SELECT * FROM community_groups WHERE id = ?').get(groupId) as
      | { id: number; name: string; description: string; is_public: number; created_by: number }
      | undefined;
    if (!group) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }

    const isMember = Boolean(
      db.prepare('SELECT 1 FROM community_group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id)
    );
    if (!isMember && !isPrivileged && !group.is_public) {
      res.status(403).json({ error: 'You are not a member of this private group.' });
      return;
    }

    const members = db
      .prepare(
        `SELECT u.id, u.name, u.avatar_url, u.role, u.is_admin, u.grade, gm.role AS group_role
         FROM community_group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY gm.role DESC, u.name ASC`
      )
      .all(groupId) as Array<{
      id: number;
      name: string;
      avatar_url: string;
      role: 'student' | 'teacher';
      is_admin: number;
      grade: string;
      group_role: 'owner' | 'member';
    }>;

    const rawMessages = db
      .prepare(
        `SELECT gm.*, u.name AS sender_name, u.avatar_url AS sender_avatar_url,
                u.role AS sender_role, u.is_admin AS sender_is_admin
         FROM community_group_messages gm
         JOIN users u ON u.id = gm.sender_id
         WHERE gm.group_id = ?
         ORDER BY gm.id ASC
         LIMIT 250`
      )
      .all(groupId) as Array<{ sender_id: number; sender_is_admin: number } & Record<string, unknown>>;

    const messages = rawMessages.map((gm) => ({
      ...gm,
      sender_is_admin: Boolean(gm.sender_is_admin),
      sender_online: isUserOnline(gm.sender_id),
    }));

    res.json({
      group: { ...group, is_public: Boolean(group.is_public), is_member: isMember },
      members: members.map((m) => ({
        ...m,
        is_admin: Boolean(m.is_admin),
        online: isUserOnline(m.id),
      })),
      messages,
    });
  });

  app.post(
    '/api/community/groups/:groupId/messages',
    requireAuth,
    upload.single('attachment'),
    (req: CommunityAuthedRequest, res: Response) => {
      const user = req.user!;
      if (!ensureNotRestricted(user, res)) return;

      const groupId = Number(req.params.groupId);
      const isPrivileged = user.role === 'teacher' || user.isAdmin;

      const group = db
        .prepare('SELECT id, name, is_public FROM community_groups WHERE id = ?')
        .get(groupId) as { id: number; name: string; is_public: number } | undefined;
      if (!group) {
        res.status(404).json({ error: 'Group not found.' });
        return;
      }

      const isMember = Boolean(
        db.prepare('SELECT 1 FROM community_group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.id)
      );
      if (!isMember && !isPrivileged) {
        res.status(403).json({ error: 'Join this group before sending messages.' });
        return;
      }

      const messageText = String(req.body?.messageText || '').trim();
      if (!messageText && !req.file) {
        res.status(400).json({ error: 'Please write a message or attach a file.' });
        return;
      }

      const attachmentName = req.file ? req.file.originalname : null;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const attachmentMime = req.file ? req.file.mimetype : null;

      const result = db
        .prepare(
          `INSERT INTO community_group_messages (group_id, sender_id, message_text, attachment_name, attachment_url, attachment_mime)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(groupId, user.id, messageText, attachmentName, attachmentUrl, attachmentMime);

      const messageId = Number(result.lastInsertRowid);
      const createdRaw = db
        .prepare(
          `SELECT gm.*, u.name AS sender_name, u.avatar_url AS sender_avatar_url,
                  u.role AS sender_role, u.is_admin AS sender_is_admin
           FROM community_group_messages gm
           JOIN users u ON u.id = gm.sender_id
           WHERE gm.id = ?`
        )
        .get(messageId) as ({ sender_id: number; sender_is_admin: number } & Record<string, unknown>) | undefined;

      const created = createdRaw
        ? {
            ...createdRaw,
            sender_is_admin: Boolean(createdRaw.sender_is_admin),
            sender_online: isUserOnline(createdRaw.sender_id),
          }
        : createdRaw;

      touchUserActivity(user.id);
      logStudentActivity(
        user.id,
        'group_message_sent',
        `In "${group.name}": ${messageText ? messageText.slice(0, 100) : attachmentName}`,
        'group_message',
        messageId
      );
      broadcastAdminDashboard();

      const memberRows = db
        .prepare('SELECT user_id FROM community_group_members WHERE group_id = ?')
        .all(groupId) as Array<{ user_id: number }>;

      const evt = { type: 'community:group:message', payload: created };
      const groupUrl = `/?tab=community&communityTab=groups&groupId=${groupId}`;
      const groupTag = `grade9hub-group-${groupId}`;
      const groupPreview = messageText
        ? messageText.slice(0, 120)
        : `Sent an attachment: ${attachmentName}`;

      for (const m of memberRows) {
        broadcastToUser(m.user_id, evt);
        if (m.user_id !== user.id) {
          notifySingleUser({
            userId: m.user_id,
            title: `${user.name} · ${group.name}`,
            body: groupPreview,
            category: 'reply',
            linkTab: 'community',
            linkUrl: groupUrl,
            tag: groupTag,
            icon: user.avatar_url,
            data: { communityTab: 'groups', groupId },
            localizedFactory: (lang) => ({
              title: `${user.name} · ${group.name}`,
              body: messageText
                ? messageText.slice(0, 120)
                : lang === 'ku'
                ? `هاوپێچێکی نارد: ${attachmentName}`
                : lang === 'ar'
                ? `أرسل مرفقاً: ${attachmentName}`
                : groupPreview,
              url: groupUrl,
              tab: 'community',
              tag: groupTag,
              icon: user.avatar_url,
              lang,
              dir: lang === 'en' ? 'ltr' : 'rtl',
              data: { communityTab: 'groups', groupId },
            }),
          });
        }
      }
      broadcastToAdmins(evt);
      broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'group_message_sent', groupId, messageId } });

      res.status(201).json({ message: created });
    }
  );

  app.delete('/api/community/groups/message/:messageId', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const messageId = Number(req.params.messageId);
    const msg = db
      .prepare('SELECT id, group_id, sender_id, message_text FROM community_group_messages WHERE id = ?')
      .get(messageId) as
      | { id: number; group_id: number; sender_id: number; message_text: string }
      | undefined;

    if (!msg) {
      res.status(404).json({ error: 'Group message not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (msg.sender_id !== user.id && !isPrivileged) {
      res.status(403).json({ error: 'You can only delete your own messages.' });
      return;
    }

    db.prepare('DELETE FROM community_group_messages WHERE id = ?').run(messageId);
    if (isPrivileged && msg.sender_id !== user.id) {
      logStudentActivity(user.id, 'content_deleted', `Deleted group message #${messageId}: ${msg.message_text.slice(0, 80)}`, 'group_message', messageId);
    }

    broadcastToAllUsers({
      type: 'community:group:message_deleted',
      payload: { groupId: msg.group_id, messageId },
    });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'group_message_deleted', messageId } });

    res.json({ ok: true });
  });

  app.delete('/api/community/groups/:groupId', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const groupId = Number(req.params.groupId);
    const group = db
      .prepare('SELECT id, name, created_by FROM community_groups WHERE id = ?')
      .get(groupId) as { id: number; name: string; created_by: number } | undefined;

    if (!group) {
      res.status(404).json({ error: 'Group not found.' });
      return;
    }

    const isPrivileged = user.role === 'teacher' || user.isAdmin;
    if (group.created_by !== user.id && !isPrivileged) {
      res.status(403).json({ error: 'Only the group creator or administrator can delete this group.' });
      return;
    }

    db.prepare('DELETE FROM community_groups WHERE id = ?').run(groupId);
    logStudentActivity(user.id, 'content_deleted', `Deleted group "${group.name}"`, 'group', groupId);
    broadcastToAllUsers({ type: 'community:group:deleted', payload: { groupId } });
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'group_deleted', groupId } });
    res.json({ ok: true });
  });

  // ---------------- 5. SAFETY REPORTING ----------------
  app.post('/api/community/reports', requireAuth, (req: CommunityAuthedRequest, res: Response) => {
    const user = req.user!;
    const targetType = String(req.body?.targetType || '').trim();
    const targetId = Number(req.body?.targetId);
    const reason = String(req.body?.reason || '').trim();

    if (!ALLOWED_REPORT_TARGETS.has(targetType) || !Number.isInteger(targetId) || targetId <= 0) {
      res.status(400).json({ error: 'Valid report target is required.' });
      return;
    }
    if (reason.length < 3) {
      res.status(400).json({ error: 'Please explain why you are reporting this content or user.' });
      return;
    }

    let targetUserId: number | null = null;
    let excerpt = '';

    if (targetType === 'post') {
      const row = db.prepare('SELECT author_id, content FROM community_posts WHERE id = ?').get(targetId) as
        | { author_id: number; content: string }
        | undefined;
      if (row) {
        targetUserId = row.author_id;
        excerpt = row.content.slice(0, 140);
      }
    } else if (targetType === 'comment') {
      const row = db.prepare('SELECT author_id, content FROM community_post_comments WHERE id = ?').get(targetId) as
        | { author_id: number; content: string }
        | undefined;
      if (row) {
        targetUserId = row.author_id;
        excerpt = row.content.slice(0, 140);
      }
    } else if (targetType === 'dm') {
      const row = db.prepare('SELECT sender_id, message_text FROM community_direct_messages WHERE id = ?').get(targetId) as
        | { sender_id: number; message_text: string }
        | undefined;
      if (row) {
        targetUserId = row.sender_id;
        excerpt = row.message_text.slice(0, 140);
      }
    } else if (targetType === 'group_message') {
      const row = db.prepare('SELECT sender_id, message_text FROM community_group_messages WHERE id = ?').get(targetId) as
        | { sender_id: number; message_text: string }
        | undefined;
      if (row) {
        targetUserId = row.sender_id;
        excerpt = row.message_text.slice(0, 140);
      }
    } else if (targetType === 'user') {
      const row = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetId) as
        | { id: number; name: string }
        | undefined;
      if (row) {
        targetUserId = row.id;
        excerpt = row.name;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO community_reports (reporter_id, target_type, target_id, target_user_id, reason, excerpt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(user.id, targetType, targetId, targetUserId, reason, excerpt);

    const reportId = Number(result.lastInsertRowid);
    logStudentActivity(user.id, 'content_reported', `Reported ${targetType} #${targetId}: ${reason.slice(0, 90)}`, targetType, targetId);

    const teachers = db
      .prepare("SELECT id FROM users WHERE role = 'teacher' OR is_admin = 1")
      .all() as Array<{ id: number }>;
    for (const t of teachers) {
      notifySingleUser({
        userId: t.id,
        title: `Safety Report from ${user.name}`,
        body: `${targetType}: ${reason.slice(0, 100)}`,
        category: 'reply',
        linkTab: 'admin-dashboard',
      });
    }

    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'report_created', reportId } });
    res.status(201).json({ reportId, ok: true });
  });

  // ---------------- 6. ADMIN FULL MONITORING, ACTIVITY LOGS & MODERATION ----------------
  app.get('/api/admin/community/overview', requireTeacher, (_req: CommunityAuthedRequest, res: Response) => {
    const postsCount = (db.prepare('SELECT COUNT(*) AS c FROM community_posts').get() as { c: number }).c;
    const commentsCount = (db.prepare('SELECT COUNT(*) AS c FROM community_post_comments').get() as { c: number }).c;
    const reactionsCount = (db.prepare('SELECT COUNT(*) AS c FROM community_post_reactions').get() as { c: number }).c;
    const dmCount = (db.prepare('SELECT COUNT(*) AS c FROM community_direct_messages').get() as { c: number }).c;
    const groupCount = (db.prepare('SELECT COUNT(*) AS c FROM community_groups').get() as { c: number }).c;
    const groupMsgCount = (db.prepare('SELECT COUNT(*) AS c FROM community_group_messages').get() as { c: number }).c;
    const openReportsCount = (
      db.prepare("SELECT COUNT(*) AS c FROM community_reports WHERE status = 'open'").get() as { c: number }
    ).c;
    const restrictedCount = (
      db.prepare("SELECT COUNT(*) AS c FROM users WHERE is_restricted = 1 AND role = 'student'").get() as { c: number }
    ).c;

    res.json({
      postsCount,
      commentsCount,
      reactionsCount,
      dmCount,
      groupCount,
      groupMsgCount,
      openReportsCount,
      restrictedCount,
    });
  });

  app.get('/api/admin/community/dm-conversations', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const q = String(req.query.q || '').trim().toLowerCase();

    const pairs = db
      .prepare(
        `SELECT CASE WHEN sender_id < recipient_id THEN sender_id ELSE recipient_id END AS user_a_id,
                CASE WHEN sender_id < recipient_id THEN recipient_id ELSE sender_id END AS user_b_id,
                COUNT(*) AS message_count,
                MAX(created_at) AS last_message_at,
                MAX(id) AS last_message_id
         FROM community_direct_messages
         GROUP BY user_a_id, user_b_id
         ORDER BY last_message_id DESC`
      )
      .all() as Array<{
      user_a_id: number;
      user_b_id: number;
      message_count: number;
      last_message_at: string;
      last_message_id: number;
    }>;

    const getUser = db.prepare('SELECT id, name, email, avatar_url, role, is_restricted FROM users WHERE id = ?');
    const getLastMsg = db.prepare('SELECT message_text, attachment_name FROM community_direct_messages WHERE id = ?');

    const conversations = pairs
      .map((p) => {
        const userA = getUser.get(p.user_a_id) as
          | { id: number; name: string; email: string; avatar_url: string; role: string; is_restricted: number }
          | undefined;
        const userB = getUser.get(p.user_b_id) as
          | { id: number; name: string; email: string; avatar_url: string; role: string; is_restricted: number }
          | undefined;
        const last = getLastMsg.get(p.last_message_id) as
          | { message_text: string; attachment_name: string | null }
          | undefined;
        if (!userA || !userB) return null;
        return {
          userA: { ...userA, online: isUserOnline(userA.id), isRestricted: Boolean(userA.is_restricted) },
          userB: { ...userB, online: isUserOnline(userB.id), isRestricted: Boolean(userB.is_restricted) },
          messageCount: p.message_count,
          lastMessageAt: p.last_message_at,
          lastMessageText: last?.message_text || last?.attachment_name || '',
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => {
        if (!q) return true;
        return (
          item.userA.name.toLowerCase().includes(q) ||
          item.userB.name.toLowerCase().includes(q) ||
          item.userA.email.toLowerCase().includes(q) ||
          item.userB.email.toLowerCase().includes(q) ||
          item.lastMessageText.toLowerCase().includes(q)
        );
      });

    res.json({ conversations });
  });

  app.get('/api/admin/community/dm-thread', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const userA = Number(req.query.userA);
    const userB = Number(req.query.userB);
    if (!Number.isInteger(userA) || !Number.isInteger(userB) || userA <= 0 || userB <= 0) {
      res.status(400).json({ error: 'Valid userA and userB IDs are required.' });
      return;
    }

    const messages = db
      .prepare(
        `SELECT m.*,
                su.name AS sender_name, su.avatar_url AS sender_avatar_url, su.role AS sender_role,
                ru.name AS recipient_name
         FROM community_direct_messages m
         JOIN users su ON su.id = m.sender_id
         JOIN users ru ON ru.id = m.recipient_id
         WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
         ORDER BY m.id ASC`
      )
      .all(userA, userB, userB, userA);

    res.json({ messages });
  });

  app.get('/api/admin/activity-logs', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const userId = req.query.userId ? Number(req.query.userId) : null;
    const action = String(req.query.action || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 10), 250);

    let sql = `
      SELECT l.*, u.name AS user_name, u.email AS user_email, u.role AS user_role,
             u.avatar_url AS user_avatar_url, u.is_restricted AS user_is_restricted
      FROM student_activity_logs l
      JOIN users u ON u.id = l.user_id
      WHERE 1 = 1
    `;
    const params: unknown[] = [];

    if (userId && Number.isInteger(userId)) {
      sql += ' AND l.user_id = ?';
      params.push(userId);
    }
    if (action && action !== 'all') {
      sql += ' AND l.action_type = ?';
      params.push(action);
    }
    if (q) {
      sql += ' AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(l.details) LIKE ? OR LOWER(l.action_type) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY l.id DESC LIMIT ?';
    params.push(limit);

    const logs = db.prepare(sql).all(...params) as Array<{
      id: number;
      user_id: number;
      action_type: string;
      details: string;
      target_type: string;
      target_id: number | null;
      created_at: string;
      user_name: string;
      user_email: string;
      user_role: string;
      user_avatar_url: string;
      user_is_restricted: number;
    }>;

    res.json({
      logs: logs.map((l) => ({
        ...l,
        user_online: isUserOnline(l.user_id),
        user_is_restricted: Boolean(l.user_is_restricted),
      })),
    });
  });

  app.get('/api/admin/moderation/reports', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const status = String(req.query.status || 'all');
    let sql = `
      SELECT r.*,
             rep.name AS reporter_name, rep.email AS reporter_email,
             tgt.name AS target_user_name, tgt.email AS target_user_email, tgt.is_restricted AS target_user_restricted
      FROM community_reports r
      JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN users tgt ON tgt.id = r.target_user_id
      WHERE 1 = 1
    `;
    const params: unknown[] = [];
    if (status === 'open' || status === 'resolved' || status === 'dismissed') {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    sql += " ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.id DESC LIMIT 120";

    const reports = db.prepare(sql).all(...params) as Array<{
      id: number;
      reporter_id: number;
      reporter_name: string;
      reporter_email: string;
      target_type: string;
      target_id: number;
      target_user_id: number | null;
      target_user_name: string | null;
      target_user_email: string | null;
      target_user_restricted: number | null;
      reason: string;
      excerpt: string;
      status: 'open' | 'resolved' | 'dismissed';
      created_at: string;
    }>;

    res.json({
      reports: reports.map((r) => ({
        ...r,
        target_user_restricted: Boolean(r.target_user_restricted),
      })),
    });
  });

  app.put('/api/admin/moderation/reports/:id', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const admin = req.user!;
    const reportId = Number(req.params.id);
    const status = req.body?.status === 'dismissed' ? 'dismissed' : 'resolved';
    const result = db
      .prepare('UPDATE community_reports SET status = ?, resolved_by = ? WHERE id = ?')
      .run(status, admin.id, reportId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }

    logStudentActivity(admin.id, 'report_reviewed', `Marked report #${reportId} as ${status}`, 'report', reportId);
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'report_updated', reportId } });
    res.json({ ok: true, status });
  });

  app.put('/api/admin/users/:id/restrict', requireTeacher, (req: CommunityAuthedRequest, res: Response) => {
    const admin = req.user!;
    const targetId = Number(req.params.id);
    const restricted = Boolean(req.body?.restricted);
    const reason = String(req.body?.reason || '').trim();

    const target = db
      .prepare('SELECT id, name, email, role, is_admin FROM users WHERE id = ?')
      .get(targetId) as
      | { id: number; name: string; email: string; role: string; is_admin: number }
      | undefined;

    if (!target) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (target.email.toLowerCase() === TEACHER_EMAIL.toLowerCase() || target.role === 'teacher' || target.is_admin) {
      res.status(400).json({ error: 'Administrator and teacher accounts cannot be restricted.' });
      return;
    }

    db.prepare(
      `UPDATE users
       SET is_restricted = ?,
           restriction_reason = ?,
           restricted_at = ?
       WHERE id = ?`
    ).run(
      restricted ? 1 : 0,
      restricted ? reason || 'Restricted by school administrator for review.' : '',
      restricted ? new Date().toISOString() : '',
      targetId
    );

    logStudentActivity(
      admin.id,
      restricted ? 'account_restricted' : 'account_unrestricted',
      `${restricted ? 'Restricted' : 'Unrestricted'} ${target.name}${reason ? ` (${reason})` : ''}`,
      'user',
      targetId
    );

    notifySingleUser({
      userId: targetId,
      title: restricted ? 'Community Privileges Restricted' : 'Community Privileges Restored',
      body: restricted
        ? reason || 'Your Student Community posting and messaging privileges were temporarily restricted by the school administrator.'
        : 'Your Student Community posting and messaging privileges have been restored.',
      category: 'announcement',
      linkTab: 'community',
    });

    broadcastToUser(targetId, {
      type: 'community:restriction',
      payload: {
        isRestricted: restricted,
        restrictionReason: restricted ? reason : '',
      },
    });
    broadcastToAllUsers({ type: 'community:presence' });
    broadcastAdminDashboard();
    broadcastToAdmins({ type: 'admin:community_event', payload: { kind: 'user_restriction', targetId } });

    res.json({ ok: true, isRestricted: restricted });
  });
}
