import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { LanguageProvider } from './contexts/LanguageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { FirestoreErrorBoundary } from './components/FirestoreErrorBoundary';
import { getOrRegisterServiceWorker } from './utils/serviceWorker';
import './index.css';

const SW_RELOAD_GUARD_KEY = 'grade9hub_sw_reloaded_at';

try {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        try {
          void updateSW(true);
        } catch {
          // ignore SW update failure on restricted browsers
        }
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          if (registration.waiting) {
            try {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } catch {
              // ignore
            }
          }
          void registration.update().catch(() => {});
        }
      },
      onRegisterError() {
        void getOrRegisterServiceWorker();
      },
    });

    // In dev or if virtual:pwa-register did not create a registration, register /sw.js directly
    void getOrRegisterServiceWorker();

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadControllerAtBoot || refreshing || !navigator.serviceWorker.controller) return;
      try {
        const lastReloadRaw = window.sessionStorage?.getItem(SW_RELOAD_GUARD_KEY);
        const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0;
        if (Number.isFinite(lastReload) && Date.now() - lastReload < 15000) {
          return;
        }
        window.sessionStorage?.setItem(SW_RELOAD_GUARD_KEY, String(Date.now()));
      } catch {
        // ignore sessionStorage failures in private browsing
      }
      refreshing = true;
      window.location.reload();
    });
  }
} catch {
  // Never allow Service Worker setup errors to prevent app mount
}

const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null;
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <FirestoreErrorBoundary>
        <SettingsProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </SettingsProvider>
      </FirestoreErrorBoundary>
    </StrictMode>
  );
}
