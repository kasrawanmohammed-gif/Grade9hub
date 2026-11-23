import { ensureServiceWorkerActive } from './serviceWorker';

export interface DeviceScreenNotificationOptions {
  tag?: string;
  tab?: string;
  url?: string;
  icon?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

function sanitizeLocalNotificationIcon(raw?: string): string {
  if (!raw || raw.length > 512) return '/pwa-192x192.png';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  if (/^https:\/\//i.test(raw)) return raw;
  return '/pwa-192x192.png';
}

/**
 * Triggers a device/screen notification reliably across Desktop Chrome/Safari,
 * Android Chrome, and installed iOS/Android PWAs by preferring
 * `ServiceWorkerRegistration.showNotification` and falling back to `new Notification`.
 */
export async function showDeviceScreenNotification(
  title: string,
  body: string,
  options: DeviceScreenNotificationOptions = {}
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (window.Notification.permission !== 'granted') {
    return false;
  }

  const safeTitle = String(title || 'Grade 9 Hub').trim().slice(0, 120) || 'Grade 9 Hub';
  const safeBody = String(body || '').trim().slice(0, 300);
  const tag = options.tag || `grade9hub-notif-${Date.now()}`;
  const tab = options.tab || 'notifications';
  const url = options.url || `/?tab=${encodeURIComponent(tab)}`;
  const icon = sanitizeLocalNotificationIcon(options.icon);

  if ('serviceWorker' in navigator) {
    try {
      const registration = await ensureServiceWorkerActive({ timeoutMs: 2500 });

      if (registration && typeof registration.showNotification === 'function') {
        const swOptions: NotificationOptions & {
          renotify?: boolean;
          vibrate?: number[];
          timestamp?: number;
        } = {
          body: safeBody,
          icon,
          badge: '/pwa-192x192.png',
          tag,
          renotify: true,
          vibrate: [180, 90, 180],
          dir: options.dir || (options.lang === 'ku' || options.lang === 'ar' ? 'rtl' : 'ltr'),
          lang: options.lang || 'en',
          timestamp: Date.now(),
          requireInteraction: Boolean(options.requireInteraction),
          data: {
            ...(options.data || {}),
            url,
            tab,
          },
        };
        await registration.showNotification(safeTitle, swOptions);
        return true;
      }
    } catch {
      // Fall through to standard Notification constructor
    }
  }

  try {
    const notification = new window.Notification(safeTitle, {
      body: safeBody,
      icon,
      tag,
      dir: options.dir || (options.lang === 'ku' || options.lang === 'ar' ? 'rtl' : 'ltr'),
      lang: options.lang || 'en',
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // ignore focus restriction
      }
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
