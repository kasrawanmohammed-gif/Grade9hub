import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import * as webPushNs from 'web-push';
import type webPushTypes from 'web-push';

const webpush = ((webPushNs as unknown as { default?: typeof webPushTypes }).default ||
  webPushNs) as typeof webPushTypes;

export type PushLang = 'en' | 'ku' | 'ar';
export type PushRole = 'student' | 'teacher';

export interface StoredVercelPushSub {
  endpointHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: number | null;
  firebaseUid: string | null;
  email: string;
  role: PushRole;
  lang: PushLang;
  userAgent: string;
  updatedAt: string;
}

export interface VerifiedPushCaller {
  kind: 'firebase' | 'jwt';
  email: string;
  firebaseUid: string | null;
  userId: number | null;
  role: PushRole | null;
  isAdmin: boolean;
}

const MAIN_ADMIN_EMAIL = 'mohamdm791@gmail.com';
const PUSH_HASH_KEY = 'g9h:push:subs:v1';

function loadFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { projectId?: string };
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
    // ignore read error
  }
  return 'gen-lang-client-0277416465';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

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
  return cleanEnvValue(raw)
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function pickFirstCleanedVapidKey(...candidates: Array<string | undefined>): string {
  for (const candidate of candidates) {
    const cleaned = cleanVapidKey(candidate);
    if (cleaned) return cleaned;
  }
  return '';
}

function normalizeVapidSubject(raw?: string): { subject: string; fromEnv: boolean } {
  const cleaned = cleanEnvValue(raw);
  if (!cleaned) return { subject: `mailto:${MAIN_ADMIN_EMAIL}`, fromEnv: false };
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(cleaned)) {
    return { subject: `mailto:${cleaned.slice(7).trim()}`, fromEnv: true };
  }
  if (/^https:\/\/[^\s]+$/i.test(cleaned)) {
    return { subject: cleaned, fromEnv: true };
  }
  if (/^http:\/\/[^\s]+$/i.test(cleaned) && !/^http:\/\/localhost(?::|\/|$)/i.test(cleaned)) {
    return { subject: `https://${cleaned.slice(7)}`, fromEnv: true };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return { subject: `mailto:${cleaned}`, fromEnv: true };
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(cleaned)) {
    return { subject: `https://${cleaned}`, fromEnv: true };
  }
  return { subject: `mailto:${MAIN_ADMIN_EMAIL}`, fromEnv: false };
}

export function getVapidConfig(): {
  publicKey: string;
  privateKey: string;
  subject: string;
  subjectFromEnv: boolean;
  configured: boolean;
  missingVars: string[];
} {
  const publicKey = pickFirstCleanedVapidKey(
    process.env.VAPID_PUBLIC_KEY,
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.WEB_PUSH_PUBLIC_KEY
  );
  const privateKey = pickFirstCleanedVapidKey(
    process.env.VAPID_PRIVATE_KEY,
    process.env.WEB_PUSH_PRIVATE_KEY
  );
  const { subject, fromEnv: subjectFromEnv } = normalizeVapidSubject(process.env.VAPID_SUBJECT);
  const missingVars: string[] = [];
  if (!publicKey) missingVars.push('VAPID_PUBLIC_KEY');
  if (!privateKey) missingVars.push('VAPID_PRIVATE_KEY');

  return {
    publicKey,
    privateKey,
    subject,
    subjectFromEnv,
    configured: Boolean(publicKey && privateKey),
    missingVars,
  };
}

let lastConfiguredVapidSig = '';
let lastConfiguredVapidValid = false;
let lastConfiguredVapidError: string | null = null;
export function ensureWebPushConfigured(): boolean {
  const cfg = getVapidConfig();
  if (!cfg.configured) {
    lastConfiguredVapidError = null;
    return false;
  }
  const sig = `${cfg.subject}|${cfg.publicKey}|${cfg.privateKey}`;
  if (lastConfiguredVapidSig !== sig) {
    try {
      webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
      lastConfiguredVapidSig = sig;
      lastConfiguredVapidValid = true;
      lastConfiguredVapidError = null;
    } catch (err) {
      lastConfiguredVapidSig = sig;
      lastConfiguredVapidValid = false;
      lastConfiguredVapidError =
        err instanceof Error ? err.message : 'Invalid VAPID key configuration.';
    }
  }
  return lastConfiguredVapidValid;
}

export function getVapidConfigError(): string | null {
  return lastConfiguredVapidError;
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

export function hashEndpoint(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function verifyJwtWithEnvSecrets(token: string): {
  uid: number;
  email: string;
  role: PushRole;
  isAdmin: boolean;
} | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const candidateSecrets = [process.env.JWT_SECRET, process.env.SESSION_SECRET]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (candidateSecrets.length === 0) return null;

  const signingInput = `${headerB64}.${payloadB64}`;
  const actualBuf = Buffer.from(sigB64, 'utf8');

  let sigValid = false;
  for (const secret of candidateSecrets) {
    const derivedKey = crypto.createHmac('sha256', secret).update('grade9hub:session-jwt').digest();
    const expectedSig = crypto.createHmac('sha256', derivedKey).update(signingInput).digest('base64url');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      sigValid = true;
      break;
    }
  }
  if (!sigValid) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      v?: number;
      uid?: number;
      email?: string;
      role?: string;
      isAdmin?: boolean;
      exp?: number;
    };
    if (
      parsed.v !== 1 ||
      typeof parsed.uid !== 'number' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp * 1000 < Date.now()
    ) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email.trim().toLowerCase(),
      role: parsed.role === 'teacher' ? 'teacher' : 'student',
      isAdmin: Boolean(parsed.isAdmin),
    };
  } catch {
    return null;
  }
}

export async function verifyPushCaller(request: Request): Promise<VerifiedPushCaller | null> {
  const fbHeader = (request.headers.get('x-firebase-id-token') || '').trim();
  const authHeader = (request.headers.get('authorization') || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  const firebaseCandidate = fbHeader || bearerToken;
  if (firebaseCandidate) {
    try {
      const { payload } = await jwtVerify(firebaseCandidate, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
      const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const emailVerified = payload.email_verified === true;
      if (uid && email && emailVerified) {
        return {
          kind: 'firebase',
          email,
          firebaseUid: uid,
          userId: null,
          role: email === MAIN_ADMIN_EMAIL ? 'teacher' : null,
          isAdmin: email === MAIN_ADMIN_EMAIL,
        };
      }
    } catch {
      // May be an Express session JWT instead of a Firebase ID token
    }
  }

  if (bearerToken) {
    const jwtPayload = verifyJwtWithEnvSecrets(bearerToken);
    if (jwtPayload) {
      return {
        kind: 'jwt',
        email: jwtPayload.email,
        firebaseUid: null,
        userId: jwtPayload.uid,
        role: jwtPayload.role,
        isAdmin: jwtPayload.isAdmin || jwtPayload.email === MAIN_ADMIN_EMAIL,
      };
    }
  }

  return null;
}

// ---------------- UPSTASH / VERCEL KV REST STORE + MEMORY FALLBACK ----------------
function getRedisConfig(): { url: string; token: string } | null {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;
  return { url, token };
}

export function isPersistentStoreConfigured(): boolean {
  return Boolean(getRedisConfig());
}

const globalStore = globalThis as unknown as {
  __g9hVercelPushSubs?: Map<string, StoredVercelPushSub>;
};

function getMemoryMap(): Map<string, StoredVercelPushSub> {
  if (!globalStore.__g9hVercelPushSubs) {
    globalStore.__g9hVercelPushSubs = new Map();
  }
  return globalStore.__g9hVercelPushSubs;
}

async function runRedisCommand(args: string[]): Promise<unknown> {
  const cfg = getRedisConfig();
  if (!cfg) throw new Error('Redis/KV not configured.');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Push store error (${res.status}): ${text}`);
  }
  const parsed = (await res.json()) as { result?: unknown; error?: string };
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed.result;
}

export async function savePushSubscription(sub: StoredVercelPushSub): Promise<void> {
  if (getRedisConfig()) {
    await runRedisCommand(['HSET', PUSH_HASH_KEY, sub.endpointHash, JSON.stringify(sub)]);
    return;
  }
  getMemoryMap().set(sub.endpointHash, sub);
}

export async function removePushSubscription(endpointHash: string): Promise<void> {
  if (getRedisConfig()) {
    await runRedisCommand(['HDEL', PUSH_HASH_KEY, endpointHash]);
    return;
  }
  getMemoryMap().delete(endpointHash);
}

export async function listAllPushSubscriptions(): Promise<StoredVercelPushSub[]> {
  if (getRedisConfig()) {
    const raw = await runRedisCommand(['HGETALL', PUSH_HASH_KEY]);
    const subs: StoredVercelPushSub[] = [];
    if (Array.isArray(raw)) {
      for (let i = 1; i < raw.length; i += 2) {
        const jsonStr = raw[i];
        if (typeof jsonStr === 'string') {
          try {
            subs.push(JSON.parse(jsonStr) as StoredVercelPushSub);
          } catch {
            // ignore corrupted entry
          }
        }
      }
    } else if (raw && typeof raw === 'object') {
      for (const val of Object.values(raw as Record<string, unknown>)) {
        if (typeof val === 'string') {
          try {
            subs.push(JSON.parse(val) as StoredVercelPushSub);
          } catch {
            // ignore corrupted entry
          }
        }
      }
    }
    return subs;
  }
  return Array.from(getMemoryMap().values());
}

export function matchesCaller(sub: StoredVercelPushSub, caller: VerifiedPushCaller): boolean {
  if (caller.email && sub.email && sub.email.toLowerCase() === caller.email.toLowerCase()) {
    return true;
  }
  if (caller.firebaseUid && sub.firebaseUid && sub.firebaseUid === caller.firebaseUid) {
    return true;
  }
  if (caller.userId && sub.userId && sub.userId === caller.userId) {
    return true;
  }
  return false;
}

export interface DispatchPushItem {
  title: string;
  body: string;
  url: string;
  tab: string;
  tag: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export async function dispatchPushToSubscriptions(
  targets: StoredVercelPushSub[],
  buildForLang: (lang: PushLang) => DispatchPushItem
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureWebPushConfigured() || targets.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    targets.map(async (sub) => {
      const lang = normalizePushLang(sub.lang);
      const item = buildForLang(lang);
      const safeUrl = item.url && item.url.startsWith('/') ? item.url : `/?tab=${encodeURIComponent(item.tab)}`;
      const payload = JSON.stringify({
        title: String(item.title || 'Grade 9 Hub').trim().slice(0, 120),
        body: String(item.body || '').trim().slice(0, 280),
        url: safeUrl,
        tab: item.tab || 'notifications',
        tag: String(item.tag || 'grade9hub-notification').slice(0, 120),
        icon: sanitizePushIconUrl(item.icon),
        badge: '/pwa-192x192.png',
        lang,
        dir: lang === 'en' ? 'ltr' : 'rtl',
        timestamp: Date.now(),
        renotify: true,
        data: {
          ...(item.data || {}),
          url: safeUrl,
          tab: item.tab || 'notifications',
        },
      });

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
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
          await removePushSubscription(sub.endpointHash).catch(() => {});
          removed += 1;
        }
      }
    })
  );

  return { sent, failed, removed };
}
