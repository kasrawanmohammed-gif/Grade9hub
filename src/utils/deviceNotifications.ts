export interface DeviceScreenNotificationOptions {
  tag?: string;
  tab?: string;
  url?: string;
  requireInteraction?: boolean;
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

  if ('serviceWorker' in navigator) {
    try {
      const regPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 1800);
      });
      const registration = (await Promise.race([
        regPromise,
        timeoutPromise,
      ])) as ServiceWorkerRegistration | null;

      if (registration && typeof registration.showNotification === 'function') {
        const swOptions: NotificationOptions & {
          renotify?: boolean;
          vibrate?: number[];
        } = {
          body: safeBody,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag,
          renotify: true,
          vibrate: [180, 90, 180],
          requireInteraction: Boolean(options.requireInteraction),
          data: { url, tab },
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
      icon: '/pwa-192x192.png',
      tag,
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
