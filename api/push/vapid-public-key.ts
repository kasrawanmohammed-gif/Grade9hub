import {
  ensureWebPushConfigured,
  getVapidConfig,
  getVapidConfigError,
  jsonResponse,
} from './_lib.ts';

export async function GET(): Promise<Response> {
  try {
    const cfg = getVapidConfig();
    const valid = cfg.configured && ensureWebPushConfigured();
    const configError = getVapidConfigError();
    return jsonResponse({
      publicKey: valid ? cfg.publicKey : null,
      configured: valid,
      source: 'env',
      checks: {
        hasPublicKey: Boolean(cfg.publicKey),
        hasPrivateKey: Boolean(cfg.privateKey),
        hasSubject: cfg.subjectFromEnv,
      },
      ...(valid ? {} : { missing: cfg.missingVars }),
      ...(!valid && configError ? { configError } : {}),
    });
  } catch (err) {
    return jsonResponse(
      {
        publicKey: null,
        configured: false,
        configError: err instanceof Error ? err.message : 'VAPID check failed.',
      },
      500
    );
  }
}
