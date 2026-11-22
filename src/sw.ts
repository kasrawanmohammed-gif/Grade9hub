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
}

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

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

  const notificationOptions: NotificationOptions & {
    renotify?: boolean;
    vibrate?: number[];
  } = {
    body: payload.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: payload.tag || 'grade9hub-notification',
    renotify: true,
    vibrate: [180, 90, 180],
    data: {
      url: payload.url || '/',
      tab: payload.tab || 'notifications',
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
  const notifData = (event.notification.data || {}) as { url?: string; tab?: string };
  const rawUrl = typeof notifData.url === 'string' && notifData.url ? notifData.url : '/';
  const tab = typeof notifData.tab === 'string' && notifData.tab ? notifData.tab : 'notifications';
  const resolvedUrl =
    rawUrl.includes('?') || rawUrl === '/' ? (rawUrl === '/' ? `/?tab=${encodeURIComponent(tab)}` : rawUrl) : rawUrl;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'OPEN_TAB', tab, url: resolvedUrl });
          } catch {
            // ignore postMessage failure
          }
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(resolvedUrl);
            } catch {
              // ignore navigate restrictions on certain WebKit contexts
            }
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(resolvedUrl);
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
      const nextSub = pushEvent.newSubscription;
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
