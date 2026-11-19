import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getReadyRegistrationWithTimeout(timeoutMs = 3500): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return registration;
  } catch {
    return null;
  }
}

export function usePushNotifications(
  isAuthenticated: boolean,
  userNotificationsEnabled = true
) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(() => {
    const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
    setSupported(hasNotificationApi);

    if (hasNotificationApi) {
      setPermission(Notification.permission);
    }

    const isPushSupported =
      hasNotificationApi && 'serviceWorker' in navigator && 'PushManager' in window;

    if (isPushSupported && isAuthenticated) {
      void getReadyRegistrationWithTimeout(3000).then((reg) => {
        if (!reg?.pushManager) return;
        reg.pushManager
          .getSubscription()
          .then((sub) => {
            setHasPushSubscription(Boolean(sub));
          })
          .catch(() => {});
      });
    } else if (!isAuthenticated) {
      setHasPushSubscription(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const isSubscribed =
    isAuthenticated &&
    userNotificationsEnabled &&
    (hasPushSubscription || (supported && permission === 'granted'));

  const subscribe = useCallback(async (options?: { silentError?: boolean }) => {
    const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
    if (!hasNotificationApi) {
      if (!options?.silentError) {
        setError('Notifications are not supported by this browser.');
      }
      return false;
    }

    setBusy(true);
    setError(null);
    try {
      const perm =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        if (!options?.silentError) {
          setError(
            perm === 'denied'
              ? 'Notifications are blocked in your browser settings.'
              : 'Notification permission was not granted.'
          );
        }
        return false;
      }

      const canWebPush = 'serviceWorker' in navigator && 'PushManager' in window;
      if (canWebPush) {
        const registration = await getReadyRegistrationWithTimeout(3500);
        if (registration?.pushManager) {
          const { publicKey } = await apiFetch<{ publicKey: string }>('/api/push/vapid-public-key');
          const existing = await registration.pushManager.getSubscription();
          const subscription =
            existing ||
            (await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
            }));

          await apiFetch('/api/push/subscribe', {
            method: 'POST',
            body: JSON.stringify({ subscription: subscription.toJSON() }),
          });
          setHasPushSubscription(true);
          return true;
        }
      }

      await apiFetch('/api/notifications/permission-choice', {
        method: 'POST',
        body: JSON.stringify({ choice: 'allowed' }),
      }).catch(() => {});
      setHasPushSubscription(true);
      return true;
    } catch (err) {
      if (!options?.silentError) {
        setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
      }
      return Notification.permission === 'granted';
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const registration = await getReadyRegistrationWithTimeout(2500);
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await apiFetch('/api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      } else {
        await apiFetch('/api/notifications/permission-choice', {
          method: 'POST',
          body: JSON.stringify({ choice: 'denied' }),
        });
      }
      setHasPushSubscription(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable push notifications.');
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    supported,
    permission,
    isSubscribed,
    busy,
    error,
    subscribe,
    unsubscribe,
    refreshStatus,
  };
}
