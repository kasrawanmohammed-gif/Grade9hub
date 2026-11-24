import * as webPushNs from 'web-push';
import type webPushTypes from 'web-push';
import { db } from './db.ts';

const webpush = ((webPushNs as unknown as { default?: typeof webPushTypes }).default ||
  webPushNs) as typeof webPushTypes;

export type PushLang = 'en' | 'ku' | 'ar';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function cleanEnvValue(raw?: string): string {
  const trimmed = String(raw || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function cleanVapidKey(raw?: string): string {
  return cleanEnvValue(raw).replace(/\s+/g, '').replace(/=+$/, '');
}

function normalizeVapidSubject(raw?: string): string {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return 'mailto:mohamdm791@gmail.com';
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(cleaned)) return cleaned;
  if (/^https:\/\/.+/i.test(cleaned)) return cleaned;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return `mailto:${cleaned}`;
  return 'mailto:mohamdm791@gmail.com';
}

function getOrCreateSqliteVapidKeys(): VapidKeys {
  const pubRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'vapid_public_key'")
    .get() as { value: string } | undefined;
  const privRow = db
    .prepare("SELECT value FROM app_settings WHERE key = 'vapid_private_key'")
    .get() as { value: string } | undefined;

  if (pubRow?.value && privRow?.value) {
    return { publicKey: pubRow.value, privateKey: privRow.value };
  }

  const generated = webpush.generateVAPIDKeys();
  const upsert = db.prepare(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)'
  );
  upsert.run('vapid_public_key', generated.publicKey);
  upsert.run('vapid_private_key', generated.privateKey);
  return generated;
}

function initVapidDetails(): VapidKeys {
  const envPublic = cleanVapidKey(
    process.env.VAPID_PUBLIC_KEY ||
      process.env.VITE_VAPID_PUBLIC_KEY ||
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  );
  const envPrivate = cleanVapidKey(
    process.env.VAPID_PRIVATE_KEY || process.env.WEB_PUSH_PRIVATE_KEY
  );
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);

  if (envPublic && envPrivate) {
    try {
      webpush.setVapidDetails(subject, envPublic, envPrivate);
      return { publicKey: envPublic, privateKey: envPrivate };
    } catch (err) {
      console.warn('[push] Invalid VAPID_* environment variables; falling back to local keys:', err);
    }
  }

  const localKeys = getOrCreateSqliteVapidKeys();
  webpush.setVapidDetails(subject, localKeys.publicKey, localKeys.privateKey);
  return localKeys;
}

const vapidKeys = initVapidDetails();

export function getPublicVapidKey(): string {
  return vapidKeys.publicKey;
}

export function normalizePushLang(raw: unknown): PushLang {
  if (raw === 'ku' || raw === 'ar') return raw;
  return 'en';
}

export function sanitizePushIconUrl(raw?: string | null): string {
  const val = String(raw || '').trim();
  if (!val || val.length > 512) return '/pwa-192x192.png';
  if (val.startsWith('/') && !val.startsWith('//')) return val;
  if (/^https:\/\//i.test(val)) return val;
  return '/pwa-192x192.png';
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tab?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  lang?: PushLang;
  dir?: 'ltr' | 'rtl';
  timestamp?: number;
  renotify?: boolean;
  data?: Record<string, unknown>;
}

interface StoredPushSubRow {
  id: number;
  user_id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  role: string;
  lang: string;
}

export type LocalizedPushFactory = (lang: PushLang) => PushPayload;

function buildWirePayload(payload: PushPayload, subLang: PushLang): string {
  const lang = payload.lang || subLang || 'en';
  const dir: 'ltr' | 'rtl' = payload.dir || (lang === 'en' ? 'ltr' : 'rtl');
  const safeTab = payload.tab || 'notifications';
  const safeUrl =
    payload.url && payload.url.startsWith('/')
      ? payload.url
      : `/?tab=${encodeURIComponent(safeTab)}`;

  const normalized: PushPayload = {
    title: String(payload.title || 'Grade 9 Hub').trim().slice(0, 120) || 'Grade 9 Hub',
    body: String(payload.body || '').trim().slice(0, 280),
    url: safeUrl,
    tab: safeTab,
    tag: String(payload.tag || 'grade9hub-notification').slice(0, 120),
    icon: sanitizePushIconUrl(payload.icon),
    badge: '/pwa-192x192.png',
    lang,
    dir,
    timestamp: payload.timestamp || Date.now(),
    renotify: payload.renotify !== false,
    data: {
      ...(payload.data || {}),
      url: safeUrl,
      tab: safeTab,
    },
  };

  return JSON.stringify(normalized);
}

async function deliverToRows(
  subs: StoredPushSubRow[],
  payloadOrFactory: PushPayload | LocalizedPushFactory
): Promise<{ sent: number; failed: number; removed: number }> {
  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      const subLang = normalizePushLang(sub.lang);
      const resolvedPayload =
        typeof payloadOrFactory === 'function' ? payloadOrFactory(subLang) : payloadOrFactory;
      const wireBody = buildWirePayload(resolvedPayload, subLang);

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth,
            },
          },
          wireBody,
          {
            TTL: 86400,
            urgency: 'high',
          }
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
          removed += 1;
        }
      }
    })
  );

  return { sent, failed, removed };
}

export async function sendPushToUser(
  userId: number,
  payloadOrFactory: PushPayload | LocalizedPushFactory
): Promise<{ sent: number; failed: number; removed: number }> {
  const subs = db
    .prepare(
      `SELECT ps.id, ps.user_id, ps.endpoint, ps.keys_p256dh, ps.keys_auth, ps.role, ps.lang
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.user_id = ? AND u.notifications_enabled = 1`
    )
    .all(userId) as StoredPushSubRow[];

  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
  return deliverToRows(subs, payloadOrFactory);
}

export async function sendPushToUsers(
  userIds: number[],
  payloadOrFactory: PushPayload | LocalizedPushFactory
): Promise<{ sent: number; failed: number; removed: number }> {
  const uniqueIds = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return { sent: 0, failed: 0, removed: 0 };

  const placeholders = uniqueIds.map(() => '?').join(',');
  const subs = db
    .prepare(
      `SELECT ps.id, ps.user_id, ps.endpoint, ps.keys_p256dh, ps.keys_auth, ps.role, ps.lang
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.user_id IN (${placeholders}) AND u.notifications_enabled = 1`
    )
    .all(...uniqueIds) as StoredPushSubRow[];

  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
  return deliverToRows(subs, payloadOrFactory);
}

export async function sendPushToAllStudents(
  payloadOrFactory: PushPayload | LocalizedPushFactory,
  options: { excludeUserId?: number; includeTeachers?: boolean } = {}
): Promise<{ sent: number; failed: number; removed: number }> {
  const excludeId = options.excludeUserId ?? -1;
  const subs = (
    options.includeTeachers
      ? db
          .prepare(
            `SELECT ps.id, ps.user_id, ps.endpoint, ps.keys_p256dh, ps.keys_auth, ps.role, ps.lang
             FROM push_subscriptions ps
             JOIN users u ON u.id = ps.user_id
             WHERE u.id != ? AND u.notifications_enabled = 1`
          )
          .all(excludeId)
      : db
          .prepare(
            `SELECT ps.id, ps.user_id, ps.endpoint, ps.keys_p256dh, ps.keys_auth, ps.role, ps.lang
             FROM push_subscriptions ps
             JOIN users u ON u.id = ps.user_id
             WHERE u.role = 'student' AND u.id != ? AND u.notifications_enabled = 1`
          )
          .all(excludeId)
  ) as StoredPushSubRow[];

  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0 };
  return deliverToRows(subs, payloadOrFactory);
}

export function countUserPushSubscriptions(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?')
    .get(userId) as { count: number } | undefined;
  return row?.count || 0;
}
