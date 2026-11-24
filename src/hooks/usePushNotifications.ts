import { useCallback, useEffect, useRef, useState } from 'react';
import { AppLanguage } from '../i18n/translations';
import { apiFetch } from '../lib/api';
import { ensureServiceWorkerActive } from '../utils/serviceWorker';

export type PushUnsupportedReason = 'ios_home_screen' | 'unsupported' | 'vapid_missing' | null;

export interface UsePushNotificationsParams {
  isAuthenticated: boolean;
  userNotificationsEnabled?: boolean;
  language?: AppLanguage;
  userId?: number | null;
  userRole?: 'student' | 'teacher';
}

function cleanClientVapidKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed
    .replace(/\s+/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getBuildTimeVapidPublicKey(): string {
  try {
    return cleanClientVapidKey(import.meta.env?.VITE_VAPID_PUBLIC_KEY);
  } catch {
    return '';
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const cleaned = cleanClientVapidKey(base64String);
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscriptionMatchesPublicKey(sub: PushSubscription, expectedKey: string): boolean {
  try {
    const existingBuf = sub.options?.applicationServerKey;
    if (!existingBuf) return true;
    const expected = urlBase64ToUint8Array(expectedKey);
    const actual = new Uint8Array(existingBuf);
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i += 1) {
      if (actual[i] !== expected[i]) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function detectIosDevice(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    const isTouchMac =
      ua.includes('macintosh') &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1;
    return /iphone|ipad|ipod/.test(ua) || isTouchMac;
  } catch {
    return false;
  }
}

function detectStandalonePwa(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const standaloneMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false;
    const navStandalone = (navigator as { standalone?: boolean }).standalone === true;
    return standaloneMedia || navStandalone;
  } catch {
    return false;
  }
}

export function usePushNotifications({
  isAuthenticated,
  userNotificationsEnabled = true,
  language = 'en',
  userId = null,
  userRole = 'student',
}: UsePushNotificationsParams) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandalonePwa, setIsStandalonePwa] = useState(false);
  const [isIosBrowserTab, setIsIosBrowserTab] = useState(false);
  const [vapidMissing, setVapidMissing] = useState(false);
  const [vapidMissingDetails, setVapidMissingDetails] = useState<string | null>(null);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const lastSyncSigRef = useRef('');

  const syncSubscriptionRecord = useCallback(
    async (subscription: PushSubscription) => {
      await apiFetch<{ ok: boolean; subscriptionCount?: number }>('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          lang: language,
          role: userRole,
          userId,
        }),
      }).then((res) => {
        if (typeof res?.subscriptionCount === 'number') {
          setSubscriptionCount(res.subscriptionCount);
        }
      });
    },
    [language, userRole, userId]
  );

  const resolveVapidKey = useCallback(async (): Promise<{
    publicKey: string;
    serverExplicitlyMissing: boolean;
    missingVars?: string[];
    errorDetail?: string;
  }> => {
    const buildTimeKey = getBuildTimeVapidPublicKey();
    try {
        const res = await apiFetch<{
          publicKey?: string | null;
          configured?: boolean;
          missing?: string[];
          configError?: string;
        }>('/api/push/vapid-public-key', { cache: 'no-store' });
        const serverKey = cleanClientVapidKey(res?.publicKey);
        if (serverKey) {
          return { publicKey: serverKey, serverExplicitlyMissing: false };
        }
        if (res && res.configured === false) {
          return {
            publicKey: '',
            serverExplicitlyMissing: true,
            missingVars: Array.isArray(res.missing) ? res.missing : undefined,
            errorDetail: typeof res.configError === 'string' ? res.configError : undefined,
          };
        }
        return {
          publicKey: buildTimeKey,
          serverExplicitlyMissing: !buildTimeKey,
        };
      } catch (err) {
        return {
          publicKey: buildTimeKey,
          serverExplicitlyMissing: false,
          errorDetail: err instanceof Error ? err.message : undefined,
        };
      }
    }, []);

  const refreshStatus = useCallback(() => {
    const iosDevice = detectIosDevice();
    const standalone = detectStandalonePwa();
    const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
    const hasPushApi =
      hasNotificationApi && 'serviceWorker' in navigator && 'PushManager' in window;

    setIsIosDevice(iosDevice);
    setIsStandalonePwa(standalone);
    setIsIosBrowserTab(iosDevice && !standalone && !hasPushApi);
    setSupported(hasNotificationApi && hasPushApi);

    if (hasNotificationApi) {
      try {
        setPermission(Notification.permission);
      } catch {
        setPermission('default');
      }
    }

    if (hasPushApi && isAuthenticated) {
      void (async () => {
        const [reg, vapidInfo] = await Promise.all([
          ensureServiceWorkerActive({ timeoutMs: 6000 }),
          resolveVapidKey(),
        ]);
        const keyPresent = Boolean(vapidInfo.publicKey);
        const isMissing = vapidInfo.serverExplicitlyMissing && !keyPresent;
        setVapidMissing(isMissing);
        if (isMissing) {
          const detailParts: string[] = [];
          if (vapidInfo.missingVars && vapidInfo.missingVars.length > 0) {
            detailParts.push(`Missing: ${vapidInfo.missingVars.join(', ')}`);
          }
          if (vapidInfo.errorDetail) {
            detailParts.push(vapidInfo.errorDetail);
          }
          setVapidMissingDetails(detailParts.length > 0 ? detailParts.join(' · ') : null);
        } else {
          setVapidMissingDetails(null);
        }

        if (!reg?.pushManager) return;
        let sub = await reg.pushManager.getSubscription().catch(() => null);

        if (sub && keyPresent && !subscriptionMatchesPublicKey(sub, vapidInfo.publicKey)) {
          await sub.unsubscribe().catch(() => {});
          sub = null;
          lastSyncSigRef.current = '';
          if (Notification.permission === 'granted' && userNotificationsEnabled) {
            sub = await reg.pushManager
              .subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                  vapidInfo.publicKey
                ) as unknown as BufferSource,
              })
              .catch(() => null);
          }
        }

        const active = Boolean(sub) && keyPresent;
        setHasPushSubscription(active);

        if (sub && keyPresent && Notification.permission === 'granted' && userNotificationsEnabled) {
          const sig = `${sub.endpoint}|${language}|${userId || ''}|${userRole}`;
          if (lastSyncSigRef.current !== sig) {
            lastSyncSigRef.current = sig;
            await syncSubscriptionRecord(sub).catch(() => {});
          }
        }
      })();
    } else if (!isAuthenticated) {
      setHasPushSubscription(false);
      setVapidMissing(false);
      setVapidMissingDetails(null);
      setSubscriptionCount(0);
      lastSyncSigRef.current = '';
    }
  }, [
    isAuthenticated,
    userNotificationsEnabled,
    language,
    userId,
    userRole,
    syncSubscriptionRecord,
    resolveVapidKey,
  ]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const handleResume = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        refreshStatus();
      }
    };
    window.addEventListener('focus', handleResume);
    document.addEventListener('visibilitychange', handleResume);
    return () => {
      window.removeEventListener('focus', handleResume);
      document.removeEventListener('visibilitychange', handleResume);
    };
  }, [refreshStatus]);

  const isSubscribed =
    isAuthenticated &&
    userNotificationsEnabled &&
    permission === 'granted' &&
    hasPushSubscription &&
    !vapidMissing;

  const unsupportedReason: PushUnsupportedReason = isIosBrowserTab
    ? 'ios_home_screen'
    : !supported
    ? 'unsupported'
    : vapidMissing
    ? 'vapid_missing'
    : null;

  const subscribe = useCallback(
    async (options?: { silentError?: boolean }) => {
      const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
      const hasPushApi =
        hasNotificationApi && 'serviceWorker' in navigator && 'PushManager' in window;

      if (!hasNotificationApi || !hasPushApi) {
        if (!options?.silentError) {
          setError(
            detectIosDevice() && !detectStandalonePwa()
              ? 'On iPhone/iPad, open Share → Add to Home Screen first to enable system notifications.'
              : 'Web Push notifications are not supported by this browser.'
          );
        }
        return false;
      }

      setBusy(true);
      setError(null);
      setTestResult(null);
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
                ? 'Notifications are blocked in your browser or device settings.'
                : 'Notification permission was not granted.'
            );
          }
          return false;
        }

        const registration = await ensureServiceWorkerActive({ timeoutMs: 12000 });
        if (!registration?.pushManager) {
          if (!options?.silentError) {
            setError('Service Worker is not active yet. Please reload the page and try again.');
          }
          return false;
        }

        const vapidInfo = await resolveVapidKey();
        const publicKey = vapidInfo.publicKey;

        if (!publicKey) {
          setVapidMissing(vapidInfo.serverExplicitlyMissing);
          setHasPushSubscription(false);
          const detailParts: string[] = [];
          if (vapidInfo.missingVars && vapidInfo.missingVars.length > 0) {
            detailParts.push(`Missing: ${vapidInfo.missingVars.join(', ')}`);
          }
          if (vapidInfo.errorDetail) {
            detailParts.push(vapidInfo.errorDetail);
          }
          setVapidMissingDetails(detailParts.length > 0 ? detailParts.join(' · ') : null);
          if (!options?.silentError) {
            if (!vapidInfo.serverExplicitlyMissing && vapidInfo.errorDetail) {
              setError(`Push key endpoint error: ${vapidInfo.errorDetail}`);
            } else if (vapidInfo.missingVars && vapidInfo.missingVars.length > 0) {
              setError(
                `VAPID push keys are not configured on the server yet (missing: ${vapidInfo.missingVars.join(', ')}).`
              );
            } else if (vapidInfo.errorDetail) {
              setError(`VAPID push configuration error: ${vapidInfo.errorDetail}`);
            } else {
              setError('VAPID push keys are not configured on the server yet.');
            }
          }
          return false;
        }

        setVapidMissing(false);
        setVapidMissingDetails(null);
        let existing = await registration.pushManager.getSubscription();
        if (existing && !subscriptionMatchesPublicKey(existing, publicKey)) {
          await existing.unsubscribe().catch(() => {});
          existing = null;
        }
        const subscription =
          existing ||
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
          }));

        await syncSubscriptionRecord(subscription);
        lastSyncSigRef.current = `${subscription.endpoint}|${language}|${userId || ''}|${userRole}`;
        setHasPushSubscription(true);
        return true;
      } catch (err) {
        if (!options?.silentError) {
          setError(err instanceof Error ? err.message : 'Failed to enable notifications.');
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [language, userId, userRole, syncSubscriptionRecord, resolveVapidKey]
  );

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const registration = await ensureServiceWorkerActive({
        timeoutMs: 4000,
        forceRegisterIfMissing: false,
      });
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await apiFetch('/api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        await subscription.unsubscribe().catch(() => {});
      } else {
        await apiFetch('/api/notifications/permission-choice', {
          method: 'POST',
          body: JSON.stringify({ choice: 'denied' }),
        }).catch(() => {});
      }
      lastSyncSigRef.current = '';
      setHasPushSubscription(false);
      setSubscriptionCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable push notifications.');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTestPush = useCallback(async () => {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await apiFetch<{ ok?: boolean; sent?: number; error?: string }>(
        '/api/push/test',
        {
          method: 'POST',
          body: JSON.stringify({ lang: language }),
        }
      );
      if (res?.ok && (res.sent || 0) > 0) {
        setTestResult({ ok: true, message: 'sent' });
        return true;
      }
      setTestResult({ ok: false, message: res?.error || 'failed' });
      return false;
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to send test notification.',
      });
      return false;
    } finally {
      setTestBusy(false);
    }
  }, [language]);

  return {
    supported,
    permission,
    isSubscribed,
    hasPushSubscription,
    isIosDevice,
    isStandalonePwa,
    isIosBrowserTab,
    vapidMissing,
    vapidMissingDetails,
    subscriptionCount,
    unsupportedReason,
    busy,
    error,
    testBusy,
    testResult,
    subscribe,
    unsubscribe,
    sendTestPush,
    refreshStatus,
  };
}
