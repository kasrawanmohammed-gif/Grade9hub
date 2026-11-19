// Encrypted browser-local Admin Recovery Vault backed by Web Crypto (PBKDF2 + AES-GCM) & IndexedDB.
// Supports both:
// 1. Password-derived vault (survives manual logout + container resets when logging in with password)
// 2. Session-bound vault (automatically restores active session + all student sessions if container resets while logged in)

const DB_NAME = 'grade9hub_admin_vault_v1';
const DB_VERSION = 3;
const STORE_RECORDS = 'records';
const STORE_KEYS = 'keys';
const STORE_SESSION_VAULTS = 'sessionVaults';
const STORE_PASSPORTS = 'passports';

const LS_ACTIVE_PASSPORT_KEY = 'grade9hub_active_passport_v1';
const LS_PASSPORTS_MAP_KEY = 'grade9hub_user_passports_v1';

interface PassportEntry {
  email: string;
  passport: string;
  updatedAt: string;
}

interface VaultRecord {
  email: string;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  updatedAt: string;
  usersCount: number;
  questionsCount: number;
}

interface VaultKeyEntry {
  email: string;
  salt: Uint8Array;
  key: CryptoKey;
  updatedAt: string;
}

interface SessionVaultRecord {
  id: string;
  email: string;
  salt: Uint8Array;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  updatedAt: string;
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function isVaultSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.indexedDB !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains(STORE_SESSION_VAULTS)) {
        db.createObjectStore(STORE_SESSION_VAULTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PASSPORTS)) {
        db.createObjectStore(STORE_PASSPORTS, { keyPath: 'email' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB vault.'));
  });
}

function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error || new Error('Failed to read IndexedDB vault.'));
  });
}

function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error || new Error('Failed to read IndexedDB vault records.'));
  });
}

function idbPut(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to write IndexedDB vault.'));
  });
}

function idbClear(db: IDBDatabase, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to clear IndexedDB vault store.'));
  });
}

async function deriveAesKeyFromSecret(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const secretBytes = enc.encode(secret);
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const saltBuffer = new Uint8Array(salt).buffer;

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Non-extractable key in IndexedDB
    ['encrypt', 'decrypt']
  );
}

function extractBackupStats(payload: unknown): { usersCount: number; questionsCount: number } {
  const obj = payload as { counts?: { users?: number; questions?: number } } | null;
  return {
    usersCount: Number(obj?.counts?.users || 0),
    questionsCount: Number(obj?.counts?.questions || 0),
  };
}

export async function initializeAdminVaultWithPassword(
  email: string,
  password: string,
  payload: unknown
): Promise<boolean> {
  if (!isVaultSupported()) return false;
  const normEmail = normalizeEmail(email);
  if (!normEmail || !password) return false;

  const stats = extractBackupStats(payload);
  if (stats.usersCount <= 0) return false;

  try {
    const db = await openVaultDb();
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveAesKeyFromSecret(`${normEmail}:${password}`, salt);

      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
        key,
        plaintext
      );

      const nowIso = new Date().toISOString();
      const keyEntry: VaultKeyEntry = {
        email: normEmail,
        salt,
        key,
        updatedAt: nowIso,
      };
      const record: VaultRecord = {
        email: normEmail,
        salt,
        iv,
        ciphertext,
        updatedAt: nowIso,
        usersCount: stats.usersCount,
        questionsCount: stats.questionsCount,
      };

      await idbPut(db, STORE_KEYS, keyEntry);
      await idbPut(db, STORE_RECORDS, record);
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export async function syncAdminVaultWithStoredKey(
  email: string,
  payload: unknown
): Promise<boolean> {
  if (!isVaultSupported()) return false;
  const normEmail = normalizeEmail(email);
  if (!normEmail) return false;

  const stats = extractBackupStats(payload);
  if (stats.usersCount <= 0) return false;

  try {
    const db = await openVaultDb();
    try {
      const keyEntry = await idbGet<VaultKeyEntry>(db, STORE_KEYS, normEmail);
      if (!keyEntry?.key || !keyEntry?.salt) {
        return false;
      }

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
        keyEntry.key,
        plaintext
      );

      const record: VaultRecord = {
        email: normEmail,
        salt: keyEntry.salt,
        iv,
        ciphertext,
        updatedAt: new Date().toISOString(),
        usersCount: stats.usersCount,
        questionsCount: stats.questionsCount,
      };
      await idbPut(db, STORE_RECORDS, record);
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export async function syncSessionBoundVault(
  email: string,
  sessionToken: string,
  payload: unknown
): Promise<boolean> {
  if (!isVaultSupported()) return false;
  const normEmail = normalizeEmail(email);
  if (!normEmail || !sessionToken) return false;

  const stats = extractBackupStats(payload);
  if (stats.usersCount <= 0) return false;

  try {
    const db = await openVaultDb();
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveAesKeyFromSecret(`session:${sessionToken}`, salt);

      const plaintext = new TextEncoder().encode(JSON.stringify(payload));
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
        key,
        plaintext
      );

      const entry: SessionVaultRecord = {
        id: 'active',
        email: normEmail,
        salt,
        iv,
        ciphertext,
        updatedAt: new Date().toISOString(),
      };
      await idbPut(db, STORE_SESSION_VAULTS, entry);
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export async function decryptAdminVaultWithPassword(
  email: string,
  password: string
): Promise<unknown | null> {
  if (!isVaultSupported()) return null;
  const normEmail = normalizeEmail(email);
  if (!normEmail || !password) return null;

  try {
    const db = await openVaultDb();
    try {
      const record = await idbGet<VaultRecord>(db, STORE_RECORDS, normEmail);
      if (!record?.salt || !record?.iv || !record?.ciphertext) {
        return null;
      }

      const key = await deriveAesKeyFromSecret(`${normEmail}:${password}`, new Uint8Array(record.salt));
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(record.iv).buffer },
        key,
        record.ciphertext
      );

      const jsonText = new TextDecoder().decode(decryptedBuffer);
      const parsed = JSON.parse(jsonText);

      // Re-store the active non-extractable key for ongoing session syncing
      await idbPut(db, STORE_KEYS, {
        email: normEmail,
        salt: record.salt,
        key,
        updatedAt: new Date().toISOString(),
      } satisfies VaultKeyEntry);

      return parsed;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function decryptAdminVaultForAutoResume(
  sessionToken?: string | null
): Promise<unknown | null> {
  if (!isVaultSupported()) return null;
  try {
    const db = await openVaultDb();
    try {
      // 1. Try active session-bound vault first (most up-to-date for current session)
      if (sessionToken) {
        const sessionEntry = await idbGet<SessionVaultRecord>(db, STORE_SESSION_VAULTS, 'active');
        if (sessionEntry?.salt && sessionEntry?.iv && sessionEntry?.ciphertext) {
          try {
            const key = await deriveAesKeyFromSecret(
              `session:${sessionToken}`,
              new Uint8Array(sessionEntry.salt)
            );
            const decrypted = await window.crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: new Uint8Array(sessionEntry.iv).buffer },
              key,
              sessionEntry.ciphertext
            );
            return JSON.parse(new TextDecoder().decode(decrypted));
          } catch {
            // fall through to STORE_KEYS
          }
        }
      }

      // 2. Try active non-extractable CryptoKey in STORE_KEYS + STORE_RECORDS
      const keyEntries = await idbGetAll<VaultKeyEntry>(db, STORE_KEYS);
      for (const keyEntry of keyEntries) {
        if (!keyEntry?.email || !keyEntry?.key) continue;
        const record = await idbGet<VaultRecord>(db, STORE_RECORDS, keyEntry.email);
        if (!record?.iv || !record?.ciphertext) continue;
        try {
          const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(record.iv).buffer },
            keyEntry.key,
            record.ciphertext
          );
          return JSON.parse(new TextDecoder().decode(decrypted));
        } catch {
          // try next
        }
      }
      return null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function getAdminVaultSummaryForEmail(email: string): Promise<{
  exists: boolean;
  updatedAt?: string;
  usersCount?: number;
  questionsCount?: number;
}> {
  if (!isVaultSupported()) return { exists: false };
  const normEmail = normalizeEmail(email);
  if (!normEmail) return { exists: false };

  try {
    const db = await openVaultDb();
    try {
      const record = await idbGet<VaultRecord>(db, STORE_RECORDS, normEmail);
      if (!record) return { exists: false };
      return {
        exists: true,
        updatedAt: record.updatedAt,
        usersCount: record.usersCount,
        questionsCount: record.questionsCount,
      };
    } finally {
      db.close();
    }
  } catch {
    return { exists: false };
  }
}

export async function getAnyAdminVaultSummary(): Promise<{
  email: string;
  updatedAt: string;
  usersCount: number;
  questionsCount: number;
} | null> {
  if (!isVaultSupported()) return null;
  try {
    const db = await openVaultDb();
    try {
      const all = await idbGetAll<VaultRecord>(db, STORE_RECORDS);
      if (all.length === 0) return null;
      const latest = [...all].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      return {
        email: latest.email,
        updatedAt: latest.updatedAt,
        usersCount: latest.usersCount,
        questionsCount: latest.questionsCount,
      };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearActiveVaultKey(): Promise<void> {
  await clearActivePassport();
  if (!isVaultSupported()) return;
  try {
    const db = await openVaultDb();
    try {
      await idbClear(db, STORE_KEYS);
      await idbClear(db, STORE_SESSION_VAULTS);
    } finally {
      db.close();
    }
  } catch {
    // ignore
  }
}

export async function saveUserPassport(
  email: string,
  passport: string,
  setActive = true
): Promise<void> {
  const normEmail = normalizeEmail(email);
  if (!normEmail || !passport || typeof passport !== 'string') return;

  if (typeof window !== 'undefined') {
    if (setActive) {
      try {
        window.localStorage.setItem(LS_ACTIVE_PASSPORT_KEY, passport);
      } catch {
        // ignore storage quota errors
      }
    }
    try {
      const rawMap = window.localStorage.getItem(LS_PASSPORTS_MAP_KEY);
      const map: Record<string, string> = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};
      map[normEmail] = passport;
      try {
        window.localStorage.setItem(LS_PASSPORTS_MAP_KEY, JSON.stringify(map));
      } catch {
        // Keep active entry in localStorage even if previous entries fill 5MB quota (IndexedDB retains all entries)
        window.localStorage.setItem(LS_PASSPORTS_MAP_KEY, JSON.stringify({ [normEmail]: passport }));
      }
    } catch {
      // ignore storage quota / privacy mode errors
    }
  }

  if (!isVaultSupported()) return;
  try {
    const db = await openVaultDb();
    try {
      await idbPut(db, STORE_PASSPORTS, {
        email: normEmail,
        passport,
        updatedAt: new Date().toISOString(),
      } satisfies PassportEntry);
    } finally {
      db.close();
    }
  } catch {
    // ignore IndexedDB errors
  }
}

export async function getUserPassport(email: string): Promise<string | null> {
  const normEmail = normalizeEmail(email);
  if (!normEmail) return null;

  try {
    if (typeof window !== 'undefined') {
      const rawMap = window.localStorage.getItem(LS_PASSPORTS_MAP_KEY);
      if (rawMap) {
        const map = JSON.parse(rawMap) as Record<string, string>;
        if (typeof map[normEmail] === 'string' && map[normEmail]) {
          return map[normEmail];
        }
      }
    }
  } catch {
    // fallback to IndexedDB
  }

  if (!isVaultSupported()) return null;
  try {
    const db = await openVaultDb();
    try {
      const entry = await idbGet<PassportEntry>(db, STORE_PASSPORTS, normEmail);
      return entry?.passport || null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function getActivePassport(fallbackEmail?: string | null): Promise<string | null> {
  try {
    if (typeof window !== 'undefined') {
      const active = window.localStorage.getItem(LS_ACTIVE_PASSPORT_KEY);
      if (active) return active;
    }
  } catch {
    // ignore
  }
  if (fallbackEmail) {
    return getUserPassport(fallbackEmail);
  }
  return null;
}

export async function clearActivePassport(): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LS_ACTIVE_PASSPORT_KEY);
    }
  } catch {
    // ignore
  }
}
