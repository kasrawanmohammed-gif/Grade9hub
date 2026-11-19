import { apiFetch } from './api';
import {
  CompetitionLeaderboardResponse,
  Question,
  QueuedPointEvent,
} from '../types';

const DB_NAME = 'grade9hub_competition_v1';
const DB_VERSION = 1;
const STORE_QUEUE = 'queue';
const STORE_LEADERBOARD = 'leaderboardCache';
const STORE_QUESTIONS = 'questionsCache';

const LS_QUEUE_KEY = 'grade9hub_comp_queue_v1';
const LS_LEADERBOARD_KEY = 'grade9hub_comp_lb_v1';
const LS_QUESTIONS_KEY = 'grade9hub_comp_qcache_v1';

export const COMPETITION_UPDATED_EVENT = 'grade9hub:competition-updated';

interface StoredLeaderboardRecord {
  userId: number;
  snapshot: CompetitionLeaderboardResponse;
  savedAt: string;
}

interface StoredQuestionsRecord {
  cacheKey: string;
  questions: Question[];
  savedAt: string;
}

export interface QueuedPointsSummary {
  count: number;
  totalPendingPoints: number;
  events: QueuedPointEvent[];
}

export interface CompetitionSyncResult {
  syncedCount: number;
  awardedPoints: number;
  totalPoints: number;
  snapshot: CompetitionLeaderboardResponse | null;
}

function notifyCompetitionUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(COMPETITION_UPDATED_EVENT));
}

function openCompetitionDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const queueStore = db.createObjectStore(STORE_QUEUE, { keyPath: 'eventKey' });
          queueStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_LEADERBOARD)) {
          db.createObjectStore(STORE_LEADERBOARD, { keyPath: 'userId' });
        }
        if (!db.objectStoreNames.contains(STORE_QUESTIONS)) {
          db.createObjectStore(STORE_QUESTIONS, { keyPath: 'cacheKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await openCompetitionDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as T[]) : []);
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
    } catch {
      resolve([]);
    }
  });
}

async function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openCompetitionDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const db = await openCompetitionDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

async function idbDeleteMany(storeName: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openCompetitionDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const key of keys) {
        store.delete(key);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

export async function getQueuedPointEvents(userId: number): Promise<QueuedPointEvent[]> {
  const idbEvents = await idbGetAll<QueuedPointEvent>(STORE_QUEUE);
  const lsEvents = readLocalJson<QueuedPointEvent[]>(LS_QUEUE_KEY, []);

  const merged = new Map<string, QueuedPointEvent>();
  for (const ev of [...lsEvents, ...idbEvents]) {
    if (ev && ev.userId === userId && ev.eventKey) {
      merged.set(ev.eventKey, ev);
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  );
}

export async function getQueuedPointsSummary(userId: number): Promise<QueuedPointsSummary> {
  const events = await getQueuedPointEvents(userId);
  const totalPendingPoints = events.reduce((acc, ev) => acc + (Number(ev.points) || 0), 0);
  return {
    count: events.length,
    totalPendingPoints,
    events,
  };
}

export async function enqueuePointEvent(
  userId: number,
  event: Omit<QueuedPointEvent, 'userId'> & { userId?: number }
): Promise<void> {
  const normalized: QueuedPointEvent = {
    ...event,
    userId,
    createdAt: event.createdAt || new Date().toISOString(),
  };

  await idbPut(STORE_QUEUE, normalized);

  const lsEvents = readLocalJson<QueuedPointEvent[]>(LS_QUEUE_KEY, []);
  const filtered = lsEvents.filter((item) => item.eventKey !== normalized.eventKey);
  filtered.push(normalized);
  writeLocalJson(LS_QUEUE_KEY, filtered.slice(-150));

  notifyCompetitionUpdated();
}

export async function removeSyncedPointEvents(
  userId: number,
  syncedKeys: string[]
): Promise<void> {
  if (syncedKeys.length === 0) return;
  const keySet = new Set(syncedKeys);

  await idbDeleteMany(STORE_QUEUE, syncedKeys);

  const lsEvents = readLocalJson<QueuedPointEvent[]>(LS_QUEUE_KEY, []);
  const remaining = lsEvents.filter(
    (item) => !(item.userId === userId && keySet.has(item.eventKey))
  );
  writeLocalJson(LS_QUEUE_KEY, remaining);
}

export async function saveCachedLeaderboard(
  userId: number,
  snapshot: CompetitionLeaderboardResponse
): Promise<void> {
  const record: StoredLeaderboardRecord = {
    userId,
    snapshot,
    savedAt: new Date().toISOString(),
  };
  await idbPut(STORE_LEADERBOARD, record);

  const lsMap = readLocalJson<Record<string, StoredLeaderboardRecord>>(LS_LEADERBOARD_KEY, {});
  lsMap[String(userId)] = record;
  writeLocalJson(LS_LEADERBOARD_KEY, lsMap);
}

export async function getCachedLeaderboard(
  userId: number
): Promise<CompetitionLeaderboardResponse | null> {
  const idbRecord = await idbGet<StoredLeaderboardRecord>(STORE_LEADERBOARD, userId);
  if (idbRecord?.snapshot) {
    return idbRecord.snapshot;
  }
  const lsMap = readLocalJson<Record<string, StoredLeaderboardRecord>>(LS_LEADERBOARD_KEY, {});
  return lsMap[String(userId)]?.snapshot || null;
}

export async function saveOfflineQuestionsCache(
  cacheKey: string,
  questions: Question[]
): Promise<void> {
  if (!Array.isArray(questions) || questions.length === 0) return;
  const record: StoredQuestionsRecord = {
    cacheKey,
    questions,
    savedAt: new Date().toISOString(),
  };
  await idbPut(STORE_QUESTIONS, record);

  const lsMap = readLocalJson<Record<string, StoredQuestionsRecord>>(LS_QUESTIONS_KEY, {});
  lsMap[cacheKey] = record;
  // Keep up to 16 recent question packs in localStorage to respect storage limits
  const entries = Object.entries(lsMap).slice(-16);
  writeLocalJson(LS_QUESTIONS_KEY, Object.fromEntries(entries));
}

export async function getOfflineQuestionsCache(cacheKey: string): Promise<Question[] | null> {
  const idbRecord = await idbGet<StoredQuestionsRecord>(STORE_QUESTIONS, cacheKey);
  if (idbRecord?.questions && idbRecord.questions.length > 0) {
    return idbRecord.questions;
  }
  const lsMap = readLocalJson<Record<string, StoredQuestionsRecord>>(LS_QUESTIONS_KEY, {});
  const cached = lsMap[cacheKey]?.questions;
  return cached && cached.length > 0 ? cached : null;
}

let flushInFlight: Promise<CompetitionSyncResult> | null = null;

export async function flushCompetitionQueue(userId: number): Promise<CompetitionSyncResult> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = (async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, awardedPoints: 0, totalPoints: 0, snapshot: null };
    }

    const events = await getQueuedPointEvents(userId);
    if (events.length === 0) {
      return { syncedCount: 0, awardedPoints: 0, totalPoints: 0, snapshot: null };
    }

    try {
      const response = await apiFetch<{
        syncedKeys?: string[];
        awardedPoints?: number;
        totalPoints?: number;
        snapshot?: CompetitionLeaderboardResponse;
      }>('/api/competition/sync', {
        method: 'POST',
        body: JSON.stringify({ events }),
      });

      const syncedKeys = Array.isArray(response.syncedKeys)
        ? response.syncedKeys
        : events.map((e) => e.eventKey);

      await removeSyncedPointEvents(userId, syncedKeys);

      if (response.snapshot) {
        await saveCachedLeaderboard(userId, response.snapshot);
      }

      notifyCompetitionUpdated();

      return {
        syncedCount: syncedKeys.length,
        awardedPoints: Number(response.awardedPoints) || 0,
        totalPoints: Number(response.totalPoints) || 0,
        snapshot: response.snapshot || null,
      };
    } catch {
      return { syncedCount: 0, awardedPoints: 0, totalPoints: 0, snapshot: null };
    }
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}
