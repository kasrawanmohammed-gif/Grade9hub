let inFlightRegistration: Promise<ServiceWorkerRegistration | null> | null = null;

function isWorkerActivated(reg: ServiceWorkerRegistration | null | undefined): boolean {
  return Boolean(reg && reg.active && reg.active.state === 'activated');
}

function waitForWorkerActivation(
  worker: ServiceWorker | null | undefined,
  timeoutMs: number
): Promise<boolean> {
  if (!worker) return Promise.resolve(false);
  if (worker.state === 'activated') return Promise.resolve(true);
  if (worker.state === 'redundant') return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      worker.removeEventListener('statechange', onStateChange);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onStateChange = () => {
      if (worker.state === 'activated') {
        finish(true);
      } else if (worker.state === 'redundant') {
        finish(false);
      }
    };
    const timer = window.setTimeout(() => finish(worker.state === 'activated'), timeoutMs);
    worker.addEventListener('statechange', onStateChange);
  });
}

export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  try {
    const existing =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.getRegistration());
    if (existing) return existing;
  } catch {
    // ignore getRegistration error and try registering directly
  }

  if (!inFlightRegistration) {
    inFlightRegistration = navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => null)
      .finally(() => {
        inFlightRegistration = null;
      });
  }

  return inFlightRegistration;
}

/**
 * Ensures a ServiceWorkerRegistration is registered and activated (waiting cleanly
 * for installing/waiting/activating transitions and waking stale waiting workers)
 * before returning it for PushManager operations.
 */
export async function ensureServiceWorkerActive(
  options: { timeoutMs?: number; forceRegisterIfMissing?: boolean } = {}
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;

  const timeoutMs = options.timeoutMs ?? 12000;
  const forceRegister = options.forceRegisterIfMissing !== false;
  const deadline = Date.now() + timeoutMs;

  try {
    let reg: ServiceWorkerRegistration | null =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.getRegistration()) ||
      null;

    if (!reg && forceRegister) {
      reg = await getOrRegisterServiceWorker();
    }

    if (reg && isWorkerActivated(reg)) {
      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore postMessage failure
        }
      }
      return reg;
    }

    if (reg?.waiting) {
      try {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } catch {
        // ignore postMessage failure
      }
    }

    if (reg && !reg.active && !reg.waiting && !reg.installing && forceRegister) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => reg);
    }

    const remainingMs = Math.max(1500, deadline - Date.now());

    // Wait for either navigator.serviceWorker.ready OR the installing/waiting/activating worker to activate
    const readyPromise = navigator.serviceWorker.ready.catch(() => null);
    const transitionTarget = reg?.active || reg?.waiting || reg?.installing || null;

    const activationPromise = transitionTarget
      ? new Promise<ServiceWorkerRegistration | null>((resolve) => {
          void waitForWorkerActivation(transitionTarget, remainingMs).then(async (activated) => {
            if (activated && reg) {
              resolve(reg);
              return;
            }
            const latest =
              (await navigator.serviceWorker.getRegistration('/')) ||
              (await navigator.serviceWorker.getRegistration()) ||
              null;
            if (latest && (isWorkerActivated(latest) || latest.active)) {
              resolve(latest);
            }
            // Otherwise leave unresolved so readyPromise or timeout decides
          });
        })
      : new Promise<ServiceWorkerRegistration | null>(() => {
          // Wait for readyPromise or timeout when no worker instance is attached yet
        });

    const candidate = await Promise.race<ServiceWorkerRegistration | null>([
      readyPromise,
      activationPromise,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), remainingMs)),
    ]);

    if (candidate && (isWorkerActivated(candidate) || candidate.active)) {
      return candidate;
    }

    // Final poll/fallback: re-check registration and ready state briefly
    while (Date.now() < deadline) {
      const latest =
        (await navigator.serviceWorker.getRegistration('/')) ||
        (await navigator.serviceWorker.getRegistration()) ||
        null;
      if (latest?.waiting) {
        try {
          latest.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore
        }
      }
      if (latest?.active) {
        return latest;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    // Last-chance: try registering /sw.js cleanly if still no active worker
    if (forceRegister) {
      const freshReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
      if (freshReg?.waiting) {
        try {
          freshReg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          // ignore
        }
      }
      if (freshReg?.active) return freshReg;
      const readyAfterRegister = await Promise.race([
        navigator.serviceWorker.ready.catch(() => null),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3000)),
      ]);
      if (readyAfterRegister) return readyAfterRegister;
    }

    return null;
  } catch {
    return null;
  }
}
