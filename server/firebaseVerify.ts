import fs from 'fs';
import path from 'path';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface FirebaseConfigFile {
  projectId?: string;
}

function loadFirebaseProjectId(): string {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseConfigFile;
      if (parsed.projectId) return parsed.projectId;
    }
  } catch {
    // ignore read error
  }
  return 'gen-lang-client-0277416465';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string;
  provider: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const token = String(idToken || '').trim();
  if (!token) {
    throw new Error('Firebase ID token is required.');
  }

  const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const rawEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const picture = typeof payload.picture === 'string' ? payload.picture.trim() : '';
  const firebaseClaim = payload.firebase as { sign_in_provider?: unknown } | undefined;
  const provider =
    typeof firebaseClaim?.sign_in_provider === 'string'
      ? firebaseClaim.sign_in_provider.trim()
      : '';

  const isFacebookProvider = provider === 'facebook.com';
  if (!uid || (!isFacebookProvider && (!rawEmail || !emailVerified))) {
    throw new Error('Verified email identity is required.');
  }

  const email =
    rawEmail || `fb_${uid.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}@facebook.grade9hub.local`;

  return {
    uid,
    email,
    emailVerified: Boolean(rawEmail && emailVerified),
    name,
    picture,
    provider,
  };
}
