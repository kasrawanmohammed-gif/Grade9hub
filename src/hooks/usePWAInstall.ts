import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let earlyDeferredPrompt: BeforeInstallPromptEvent | null = null;
let earlyAppInstalled = false;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    earlyDeferredPrompt = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    earlyAppInstalled = true;
    earlyDeferredPrompt = null;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => earlyDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(() => earlyAppInstalled);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    try {
      const standaloneMedia =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(display-mode: standalone)').matches
          : false;
      const isStandalone =
        earlyAppInstalled ||
        standaloneMedia ||
        (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
      setIsInstalled(isStandalone);

      const userAgent = (window.navigator?.userAgent || '').toLowerCase();
      const maxTouchPoints = window.navigator?.maxTouchPoints || 0;
      const isIPadOS = /macintosh/.test(userAgent) && maxTouchPoints > 1;
      setIsIOS(/iphone|ipad|ipod/.test(userAgent) || isIPadOS);

      if (earlyDeferredPrompt && !deferredPrompt) {
        setDeferredPrompt(earlyDeferredPrompt);
      }
    } catch {
      // ignore browser environment errors
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      earlyDeferredPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(earlyDeferredPrompt);
    };

    const handleAppInstalled = () => {
      earlyAppInstalled = true;
      earlyDeferredPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    const promptEvent = deferredPrompt || earlyDeferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      earlyAppInstalled = true;
      earlyDeferredPrompt = null;
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt || earlyDeferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}
