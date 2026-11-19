import { getActivePassport, saveUserPassport } from './recoveryVault';
import {
  handleStaticApiFallback,
  isStaticHostMode,
  StaticFallbackHttpError,
} from './staticFallback';

const SESSION_TOKEN_KEY = 'grade9hub_session_token';
const CACHED_USER_KEY = 'grade9hub_cached_user';
const REMEMBER_ME_KEY = 'grade9hub_remember_me';
const API_BASE =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  typeof import.meta.env.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL.trim().replace(/\/+$/, '')
    : '';

function resolveApiUrl(url: string): string {
  if (!API_BASE) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

export function getRememberMePreference(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = window.localStorage.getItem(REMEMBER_ME_KEY);
    if (raw === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

export function setRememberMePreference(remember: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REMEMBER_ME_KEY, remember ? 'true' : 'false');
  } catch {
    // ignore storage restriction
  }
}

export function getStoredSessionToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return (
      window.localStorage.getItem(SESSION_TOKEN_KEY) ||
      window.sessionStorage.getItem(SESSION_TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredSessionToken(
  token?: string | null,
  rememberMe: boolean = getRememberMePreference()
): void {
  try {
    if (typeof window === 'undefined' || !token) return;
    if (rememberMe) {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } else {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export function clearStoredSessionToken(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export function getStoredCachedUser<T>(): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw =
      window.localStorage.getItem(CACHED_USER_KEY) ||
      window.sessionStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredCachedUser(
  user: unknown | null,
  rememberMe: boolean = getRememberMePreference()
): void {
  try {
    if (typeof window === 'undefined') return;
    if (user) {
      const serialized = JSON.stringify(user);
      if (rememberMe) {
        window.localStorage.setItem(CACHED_USER_KEY, serialized);
        window.sessionStorage.removeItem(CACHED_USER_KEY);
      } else {
        window.sessionStorage.setItem(CACHED_USER_KEY, serialized);
        window.localStorage.removeItem(CACHED_USER_KEY);
      }
    } else {
      window.localStorage.removeItem(CACHED_USER_KEY);
      window.sessionStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore storage restriction
  }
}

export function clearStoredCachedUser(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CACHED_USER_KEY);
      window.sessionStorage.removeItem(CACHED_USER_KEY);
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
    if (isStaticHostMode() && !API_BASE) {
      return null;
    }

    const token = getStoredSessionToken();
    const cachedUser = getStoredCachedUser<{ email?: string }>();
    const passport = await getActivePassport(cachedUser?.email);
    if (!token || !passport) {
      return null;
    }

    const rememberMe = getRememberMePreference();
    try {
      const response = await fetch(resolveApiUrl('/api/auth/restore-passport'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Remember-Me': rememberMe ? '1' : '0',
        },
        body: JSON.stringify({ sessionToken: token, passport, rememberMe }),
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

      if (data.sessionToken) setStoredSessionToken(data.sessionToken, rememberMe);
      setStoredCachedUser(data.user, rememberMe);
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
  const rememberMe = getRememberMePreference();
  const baseHeaders: Record<string, string> = {
    'X-Remember-Me': rememberMe ? '1' : '0',
  };

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

  return fetch(resolveApiUrl(url), {
    credentials: 'include',
    ...options,
    headers,
  });
}

async function invokeStaticFallback<T>(url: string, options: RequestInit): Promise<T> {
  try {
    const fallbackData = await handleStaticApiFallback(url, options);
    if (fallbackData && typeof fallbackData === 'object') {
      capturePassportFromResponse(fallbackData as Record<string, unknown>);
    }
    return fallbackData as T;
  } catch (fallbackErr) {
    if (fallbackErr instanceof StaticFallbackHttpError) {
      throw new ApiError(fallbackErr.message, fallbackErr.status, fallbackErr.data);
    }
    throw fallbackErr;
  }
}

const ALWAYS_BACKEND_PREFIXES = [
  '/api/auth/login',
  '/api/auth/firebase-login',
  '/api/auth/me',
  '/api/auth/recovery-status',
  '/api/auth/logout',
  '/api/chapters',
  '/api/questions',
  '/api/quizzes/',
  '/api/textbooks-qa',
  '/api/competition/',
  '/api/profile',
  '/api/notifications',
  '/api/announcements',
  '/api/push/',
];

function isAlwaysBackendApiPath(url: string): boolean {
  const pathOnly = url.split('?')[0];
  return ALWAYS_BACKEND_PREFIXES.some((prefix) => pathOnly.startsWith(prefix));
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isAiEndpoint = url.startsWith('/api/ai/');
  if (isStaticHostMode() && !API_BASE && url.startsWith('/api/') && !isAiEndpoint) {
    return invokeStaticFallback<T>(url, options);
  }

  let response: Response;
  try {
    response = await performFetch(url, options);
  } catch (networkErr) {
    if (!API_BASE && url.startsWith('/api/') && (isStaticHostMode() || isAiEndpoint)) {
      return invokeStaticFallback<T>(url, options);
    }
    throw networkErr;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const isJsonResponse = contentType.includes('application/json');
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  const shouldFallbackToStatic =
    !API_BASE &&
    url.startsWith('/api/') &&
    (response.status === 404 || response.status === 405) &&
    (!isJsonResponse || typeof data.error !== 'string' || isAlwaysBackendApiPath(url) || isAiEndpoint);

  if (shouldFallbackToStatic) {
    return invokeStaticFallback<T>(url, options);
  }

  let currentResponse = response;
  let currentData = data;

  if (
    currentResponse.status === 401 &&
    Boolean(currentData.needsPassportRestore) &&
    !url.startsWith('/api/auth/restore-passport') &&
    !url.startsWith('/api/auth/login') &&
    !url.startsWith('/api/auth/logout')
  ) {
    const restored = await tryRestoreActiveSessionPassport();
    if (restored?.user) {
      currentResponse = await performFetch(url, options);
      currentData = (await currentResponse.json().catch(() => ({}))) as Record<string, unknown>;
    }
  }

  if (!currentResponse.ok) {
    const errMsg =
      typeof currentData.error === 'string' && currentData.error
        ? currentData.error
        : `Request failed (${currentResponse.status})`;
    throw new ApiError(errMsg, currentResponse.status, currentData);
  }

  capturePassportFromResponse(currentData);
  return currentData as T;
}

export interface StreamAiChatParams {
  model: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  message: string;
  lang?: string;
  onChunk: (deltaText: string) => void;
}

export async function streamAiTutorChat(
  params: StreamAiChatParams
): Promise<{ reply: string; model: string }> {
  const payload = JSON.stringify({
    model: params.model,
    systemInstruction: params.systemInstruction.trim().slice(0, 600),
    history: params.history.slice(-12).map((t) => ({
      role: t.role,
      text: t.text.slice(0, 1400),
    })),
    message: params.message,
    lang: params.lang,
    stream: true,
  });

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream, application/json',
    },
    body: payload,
  };

  let response: Response;
  try {
    response = await performFetch('/api/ai/chat', requestInit);
  } catch (networkErr) {
    if (!API_BASE) {
      const fallback = await invokeStaticFallback<{ reply: string; model?: string }>(
        '/api/ai/chat',
        { method: 'POST', body: payload }
      );
      if (fallback.reply) params.onChunk(fallback.reply);
      return { reply: fallback.reply, model: fallback.model || params.model };
    }
    throw networkErr;
  }

  if (response.status === 401) {
    const firstErrData = (await response.clone().json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (firstErrData.needsPassportRestore) {
      const restored = await tryRestoreActiveSessionPassport();
      if (restored?.user) {
        response = await performFetch('/api/ai/chat', requestInit);
      }
    }
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Fall back cleanly to offline curriculum study assistant ONLY when /api/ai/chat route is absent (404/405)
  if (!API_BASE && (response.status === 404 || response.status === 405)) {
    const fallback = await invokeStaticFallback<{ reply: string; model?: string }>(
      '/api/ai/chat',
      { method: 'POST', body: payload }
    );
    if (fallback.reply) params.onChunk(fallback.reply);
    return { reply: fallback.reply, model: fallback.model || params.model };
  }

  if (!response.ok) {
    const errData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const errMsg =
      typeof errData.error === 'string' && errData.error
        ? errData.error
        : `Request failed (${response.status})`;
    throw new ApiError(errMsg, response.status, errData);
  }

  if (contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';
    let resolvedModel = params.model;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const evt of events) {
        const lines = evt.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonText = line.slice(5).trim();
          if (!jsonText) continue;
          try {
            const parsed = JSON.parse(jsonText) as {
              chunk?: string;
              done?: boolean;
              error?: string;
              model?: string;
            };
            if (parsed.error) {
              throw new ApiError(parsed.error, 500);
            }
            if (parsed.model) {
              resolvedModel = parsed.model;
            }
            if (parsed.chunk) {
              fullReply += parsed.chunk;
              params.onChunk(parsed.chunk);
            }
          } catch (parseErr) {
            if (parseErr instanceof ApiError) throw parseErr;
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        try {
          const parsed = JSON.parse(line.slice(5).trim()) as {
            chunk?: string;
            error?: string;
            model?: string;
          };
          if (parsed.error) throw new ApiError(parsed.error, 500);
          if (parsed.model) resolvedModel = parsed.model;
          if (parsed.chunk) {
            fullReply += parsed.chunk;
            params.onChunk(parsed.chunk);
          }
        } catch (parseErr) {
          if (parseErr instanceof ApiError) throw parseErr;
        }
      }
    }

    return {
      reply: fullReply.trim() || 'I could not generate a response for that question.',
      model: resolvedModel,
    };
  }

  const data = (await response.json().catch(() => ({}))) as {
    reply?: string;
    model?: string;
  };
  const reply = (data.reply || '').trim() || 'I could not generate a response for that question.';
  params.onChunk(reply);
  return {
    reply,
    model: data.model || params.model,
  };
}
