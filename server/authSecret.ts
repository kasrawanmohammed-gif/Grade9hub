import crypto from 'crypto';

const STATIC_PERSISTENT_AUTH_SECRET =
  'grade9hub-persistent-auth-master-key-v1-a8f3d92c7e1b406f94a2d5c8e3f1b7a9';

function getCandidateSecrets(): string[] {
  const candidates: string[] = [];
  const pushUnique = (val?: string) => {
    const clean = String(val || '').trim();
    if (!clean || clean === 'MY_JWT_SECRET' || clean === 'MY_SESSION_SECRET') return;
    if (!candidates.includes(clean)) candidates.push(clean);
  };
  pushUnique(STATIC_PERSISTENT_AUTH_SECRET);
  pushUnique(process.env.JWT_SECRET);
  pushUnique(process.env.SESSION_SECRET);
  return candidates;
}

function resolveMasterSecret(): string {
  return STATIC_PERSISTENT_AUTH_SECRET;
}

function deriveKeyWithSecret(master: string, purpose: string): Buffer {
  return crypto.createHmac('sha256', master).update(`grade9hub:${purpose}`).digest();
}

function deriveKey(purpose: string): Buffer {
  return deriveKeyWithSecret(resolveMasterSecret(), purpose);
}

export interface SignedSessionJwtPayload {
  v: 1;
  uid: number;
  email: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  iat: number;
  exp: number;
  jti: string;
}

export function signSessionJwt(params: {
  userId: number;
  email: string;
  role: 'student' | 'teacher';
  isAdmin: boolean;
  ttlDays?: number;
}): { token: string; expiresAt: Date; payload: SignedSessionJwtPayload } {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttlDays = params.ttlDays ?? 90;
  const expSec = nowSec + ttlDays * 24 * 60 * 60;
  const payload: SignedSessionJwtPayload = {
    v: 1,
    uid: params.userId,
    email: params.email.trim().toLowerCase(),
    role: params.role,
    isAdmin: params.isAdmin,
    iat: nowSec,
    exp: expSec,
    jti: crypto.randomBytes(16).toString('hex'),
  };

  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8').toString(
    'base64url'
  );
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto
    .createHmac('sha256', deriveKey('session-jwt'))
    .update(signingInput)
    .digest('base64url');

  return {
    token: `${signingInput}.${sig}`,
    expiresAt: new Date(expSec * 1000),
    payload,
  };
}

export function verifySessionJwt(token: string): SignedSessionJwtPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const signingInput = `${headerB64}.${payloadB64}`;
  const actualBuf = Buffer.from(sigB64, 'utf8');

  let sigValid = false;
  for (const secret of getCandidateSecrets()) {
    const expectedSig = crypto
      .createHmac('sha256', deriveKeyWithSecret(secret, 'session-jwt'))
      .update(signingInput)
      .digest('base64url');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (actualBuf.length === expectedBuf.length && crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      sigValid = true;
      break;
    }
  }
  if (!sigValid) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<SignedSessionJwtPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.uid !== 'number' ||
      !Number.isInteger(parsed.uid) ||
      typeof parsed.email !== 'string' ||
      !parsed.email ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return parsed as SignedSessionJwtPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function encryptSignedJson(purpose: string, data: unknown): string {
  const master =
    purpose === 'persistent-backup' ? STATIC_PERSISTENT_AUTH_SECRET : resolveMasterSecret();
  const aesKey = deriveKeyWithSecret(master, `${purpose}:aes`);
  const hmacKey = deriveKeyWithSecret(master, `${purpose}:hmac`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  cipher.setAAD(Buffer.from(purpose, 'utf8'));

  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const ivB64 = iv.toString('base64url');
  const tagB64 = authTag.toString('base64url');
  const cipherB64 = ciphertext.toString('base64url');
  const body = `g9e1.${ivB64}.${tagB64}.${cipherB64}`;
  const sig = crypto.createHmac('sha256', hmacKey).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function decryptSignedJson<T = unknown>(purpose: string, token: string): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'g9e1') return null;

  const [prefix, ivB64, tagB64, cipherB64, sigB64] = parts;
  const body = `${prefix}.${ivB64}.${tagB64}.${cipherB64}`;
  const actualBuf = Buffer.from(sigB64, 'utf8');

  const baseCandidates = getCandidateSecrets();
  const orderedSecrets =
    purpose === 'persistent-backup'
      ? [STATIC_PERSISTENT_AUTH_SECRET, ...baseCandidates.filter((s) => s !== STATIC_PERSISTENT_AUTH_SECRET)]
      : baseCandidates;

  for (const secret of orderedSecrets) {
    const hmacKey = deriveKeyWithSecret(secret, `${purpose}:hmac`);
    const expectedSig = crypto.createHmac('sha256', hmacKey).update(body).digest('base64url');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
      continue;
    }

    try {
      const aesKey = deriveKeyWithSecret(secret, `${purpose}:aes`);
      const iv = Buffer.from(ivB64, 'base64url');
      const authTag = Buffer.from(tagB64, 'base64url');
      const ciphertext = Buffer.from(cipherB64, 'base64url');

      const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
      decipher.setAAD(Buffer.from(purpose, 'utf8'));
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        'utf8'
      );
      return JSON.parse(plaintext) as T;
    } catch {
      // Try next secret
    }
  }

  return null;
}
