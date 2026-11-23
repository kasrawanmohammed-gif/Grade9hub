import { getVapidConfig, jsonResponse } from './_lib.ts';

export async function GET(): Promise<Response> {
  const cfg = getVapidConfig();
  return jsonResponse({
    publicKey: cfg.configured ? cfg.publicKey : null,
    configured: cfg.configured,
  });
}
