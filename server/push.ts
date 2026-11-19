import { createRequire } from 'module';
import type webPushTypes from 'web-push';
import { db } from './db.ts';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof webPushTypes;

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function getOrCreateVapidKeys(): VapidKeys {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
    };
  }

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

const vapidKeys = getOrCreateVapidKeys();
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:mohamdm791@gmail.com';

webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);

export function getPublicVapidKey(): string {
  return vapidKeys.publicKey;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  const subs = db
    .prepare(
      `SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.user_id = ? AND u.notifications_enabled = 1`
    )
    .all(userId) as Array<{
    id: number;
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
  }>;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
      }
    })
  );
}

export async function sendPushToAllStudents(payload: PushPayload): Promise<void> {
  const subs = db
    .prepare(
      `SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
       FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.role = 'student' AND u.notifications_enabled = 1`
    )
    .all() as Array<{
    id: number;
    endpoint: string;
    keys_p256dh: string;
    keys_auth: string;
  }>;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys_p256dh,
              auth: sub.keys_auth,
            },
          },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
      }
    })
  );
}
