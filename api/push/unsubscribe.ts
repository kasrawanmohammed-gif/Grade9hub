import {
  hashEndpoint,
  jsonResponse,
  listAllPushSubscriptions,
  matchesCaller,
  removePushSubscription,
  verifyPushCaller,
} from './_lib.ts';

export async function POST(request: Request): Promise<Response> {
  const caller = await verifyPushCaller(request);
  if (!caller) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  if (endpoint) {
    const endpointHash = hashEndpoint(endpoint);
    const all = await listAllPushSubscriptions();
    const target = all.find((s) => s.endpointHash === endpointHash);
    if (target && matchesCaller(target, caller)) {
      await removePushSubscription(endpointHash);
    }
  }

  const remaining = (await listAllPushSubscriptions()).filter((s) => matchesCaller(s, caller));
  return jsonResponse({ ok: true, subscriptionCount: remaining.length });
}
