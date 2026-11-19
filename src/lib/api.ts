import { getActivePassport, saveUserPassport } from './recoveryVault';

const SESSION_TOKEN_KEY = 'grade9hub_session_token';
const CACHED_USER_KEY = 'grade9hub_cached_user';

export function getStoredSessionToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token?: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    }
  } catch {
    // ignore storage restriction
  }
}

export function clearStoredSessionToken(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function getStoredCachedUser<T>(): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredCachedUser(user: unknown | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export function clearStoredCachedUser(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let passportRestoreInFlight: Promise<{ user?: unknown; sessionToken?: string } | null> | null = null;

export async function tryRestoreActiveSessionPassport(): Promise<{
  user?: unknown;
  sessionToken?: string;
} | null> {
  if (passportRestoreInFlight) {
    return passportRestoreInFlight;
  }

  passportRestoreInFlight = (async () => {
    const token = getStoredSessionToken();
    const cachedUser = getStoredCachedUser<{ email?: string }>();
    const passport = await getActivePassport(cachedUser?.email);
    if (!token || !passport) {
      return null;
    }

    try {
      const response = await fetch('/api/auth/restore-passport', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionToken: token, passport }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json().catch(() => ({}))) as {
        user?: { email?: string };
        sessionToken?: string;
        accountPassport?: string;
      };
      if (!data?.user) return null;

      if (data.sessionToken) setStoredSessionToken(data.sessionToken);
      setStoredCachedUser(data.user);
      if (data.accountPassport && data.user.email) {
        await saveUserPassport(data.user.email, data.accountPassport, true);
      }
      return data;
    } catch {
      return null;
    }
  })();

  try {
    return await passportRestoreInFlight;
  } finally {
    passportRestoreInFlight = null;
  }
}

function capturePassportFromResponse(data: Record<string, unknown>): void {
  const passport = typeof data.accountPassport === 'string' ? data.accountPassport : '';
  if (!passport) return;
  const responseUser = data.user as { email?: string } | undefined;
  const cachedUser = getStoredCachedUser<{ email?: string }>();
  const targetEmail = responseUser?.email || cachedUser?.email;
  if (targetEmail) {
    void saveUserPassport(targetEmail, passport, true);
  }
}

async function performFetch(url: string, options: RequestInit): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const token = getStoredSessionToken();
  const baseHeaders: Record<string, string> = {};

  if (!isFormData) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    baseHeaders['Authorization'] = `Bearer ${token}`;
  }

  const headers: HeadersInit = {
    ...baseHeaders,
    ...(options.headers || {}),
  };

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  let response = await performFetch(url, options);
  let data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (
    response.status === 401 &&
    Boolean(data.needsPassportRestore) &&
    !url.startsWith('/api/auth/restore-passport') &&
    !url.startsWith('/api/auth/login') &&
    !url.startsWith('/api/auth/logout')
  ) {
    const restored = await tryRestoreActiveSessionPassport();
    if (restored?.user) {
      response = await performFetch(url, options);
      data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    }
  }

  if (!response.ok) {
    const errMsg =
      typeof data.error === 'string' && data.error
        ? data.error
        : `Request failed (${response.status})`;
    throw new ApiError(errMsg, response.status, data);
  }

  capturePassportFromResponse(data);
  return data as T;
}
