import { ensureWebPushConfigured, getVapidConfig, jsonResponse } from './_lib.ts';

export async function GET(): Promise<Response> {
  const cfg = getVapidConfig();
  const valid = cfg.configured && ensureWebPushConfigured();
  return jsonResponse({
    publicKey: valid ? cfg.publicKey : null,
    configured: valid,
    ...(valid ? {} : { missing: cfg.missingVars }),
  });
}
