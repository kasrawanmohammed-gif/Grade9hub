/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tab?: string;
  tag: string;
  icon?: string;
  badge?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  timestamp?: number;
  renotify?: boolean;
  data?: Record<string, unknown>;
}

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && (event.data as { type?: string }).type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

self.skipWaiting();
clientsClaim();

try {
  cleanupOutdatedCaches();
  const rawManifest = self.__WB_MANIFEST || [];
  const dedupedByUrl = new Map<string, { url: string; revision: string | null }>();
  for (const entry of Array.isArray(rawManifest) ? rawManifest : []) {
    if (!entry || typeof entry.url !== 'string') continue;
    const existing = dedupedByUrl.get(entry.url);
    if (!existing || (!existing.revision && entry.revision)) {
      dedupedByUrl.set(entry.url, entry);
    }
  }
  precacheAndRoute(Array.from(dedupedByUrl.values()));
} catch {
  // Never let precache setup crash Service Worker evaluation or block PushManager
}

function broadcastToOpenClients(message: Record<string, unknown>): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('grade9hub-push');
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // ignore BroadcastChannel failures on older Safari
  }
}

function sanitizeNotificationIcon(raw?: unknown): string {
  if (typeof raw !== 'string') return '/pwa-192x192.png';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512) return '/pwa-192x192.png';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  return '/pwa-192x192.png';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  let trimmed = String(base64String || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  const cleaned = trimmed.replace(/\s+/g, '').replace(/=+$/, '');
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushNotificationPayload = {
    title: 'Grade 9 Hub',
    body: 'You have a new update from Mr. Kasrawan.',
    url: '/?tab=notifications',
    tab: 'notifications',
    tag: 'grade9hub-notification',
  };

  if (event.data) {
    try {
      const data = event.data.json() as Partial<PushNotificationPayload>;
      payload = { ...payload, ...data };
    } catch {
      payload.body = event.data.text();
    }
  }

  const safeTab = typeof payload.tab === 'string' && payload.tab ? payload.tab : 'notifications';
  const safeUrl =
    typeof payload.url === 'string' && payload.url.startsWith('/')
      ? payload.url
      : `/?tab=${encodeURIComponent(safeTab)}`;

  const notificationOptions: NotificationOptions & {
    renotify?: boolean;
    vibrate?: number[];
    timestamp?: number;
  } = {
    body: payload.body,
    icon: sanitizeNotificationIcon(payload.icon),
    badge: sanitizeNotificationIcon(payload.badge),
    tag: payload.tag || 'grade9hub-notification',
    renotify: payload.renotify !== false,
    vibrate: [180, 90, 180],
    dir: payload.dir || (payload.lang === 'ku' || payload.lang === 'ar' ? 'rtl' : 'ltr'),
    lang: payload.lang || 'en',
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
    data: {
      ...(payload.data || {}),
      url: safeUrl,
      tab: safeTab,
    },
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(payload.title || 'Grade 9 Hub', notificationOptions);
      broadcastToOpenClients({ type: 'PUSH_RECEIVED', payload });
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        try {
          client.postMessage({ type: 'PUSH_RECEIVED', payload });
        } catch {
          // ignore postMessage failure
        }
      }
    })()
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const notifData = (event.notification.data || {}) as Record<string, unknown>;
  const rawUrl = typeof notifData.url === 'string' && notifData.url ? notifData.url : '/';
  const fullTargetUrl = new URL(rawUrl, self.location.origin);
  const tabFromData = typeof notifData.tab === 'string' && notifData.tab ? notifData.tab : '';
  const tab = fullTargetUrl.searchParams.get('tab') || tabFromData || 'notifications';
  if (!fullTargetUrl.searchParams.get('tab')) {
    fullTargetUrl.searchParams.set('tab', tab);
  }
  const resolvedRelativeUrl = `${fullTargetUrl.pathname}${fullTargetUrl.search}`;

  const targetPayload = {
    type: 'OPEN_NOTIFICATION_TARGET',
    tab,
    url: resolvedRelativeUrl,
    communityTab:
      fullTargetUrl.searchParams.get('communityTab') ||
      (typeof notifData.communityTab === 'string' ? notifData.communityTab : undefined),
    peerId:
      fullTargetUrl.searchParams.get('peerId') ||
      (notifData.peerId !== undefined ? String(notifData.peerId) : undefined),
    groupId:
      fullTargetUrl.searchParams.get('groupId') ||
      (notifData.groupId !== undefined ? String(notifData.groupId) : undefined),
    studentId:
      fullTargetUrl.searchParams.get('studentId') ||
      (notifData.studentId !== undefined ? String(notifData.studentId) : undefined),
    announcementId:
      fullTargetUrl.searchParams.get('announcementId') ||
      (notifData.announcementId !== undefined ? String(notifData.announcementId) : undefined),
    postId:
      fullTargetUrl.searchParams.get('postId') ||
      (notifData.postId !== undefined ? String(notifData.postId) : undefined),
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      broadcastToOpenClients(targetPayload);

      for (const client of clientList) {
        if ('focus' in client) {
          try {
            client.postMessage(targetPayload);
            client.postMessage({ type: 'OPEN_TAB', tab, url: resolvedRelativeUrl });
          } catch {
            // ignore postMessage failure
          }
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              const currentUrl = new URL(client.url);
              if (currentUrl.origin === self.location.origin) {
                await client.navigate(fullTargetUrl.href);
              }
            } catch {
              // ignore navigate restrictions on certain WebKit contexts
            }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(fullTargetUrl.href);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  const pushEvent = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };
  pushEvent.waitUntil(
    (async () => {
      let nextSub = pushEvent.newSubscription || null;
      if (!nextSub) {
        try {
          let applicationServerKey: BufferSource | undefined =
            pushEvent.oldSubscription?.options?.applicationServerKey || undefined;
          if (!applicationServerKey) {
            const keyRes = await fetch('/api/push/vapid-public-key');
            const keyData = (await keyRes.json().catch(() => ({}))) as { publicKey?: string | null };
            if (typeof keyData.publicKey === 'string' && keyData.publicKey.trim()) {
              applicationServerKey = urlBase64ToUint8Array(
                keyData.publicKey.trim()
              ) as unknown as BufferSource;
            }
          }
          if (applicationServerKey) {
            nextSub = await self.registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey,
            });
          }
        } catch {
          nextSub = null;
        }
      }
      if (!nextSub) return;
      try {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ subscription: nextSub.toJSON() }),
        });
      } catch {
        // ignore background sync failure when offline
      }
    })()
  );
});
