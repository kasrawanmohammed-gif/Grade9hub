import {
  ensureWebPushConfigured,
  hashEndpoint,
  isPersistentStoreConfigured,
  jsonResponse,
  listAllPushSubscriptions,
  matchesCaller,
  verifyPushCaller,
} from './_lib.ts';

export async function GET(request: Request): Promise<Response> {
  const configured = ensureWebPushConfigured();
  const caller = await verifyPushCaller(request);
  if (!caller) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  const reqUrl = new URL(request.url);
  const endpoint = (reqUrl.searchParams.get('endpoint') || '').trim();
  const endpointHash = endpoint ? hashEndpoint(endpoint) : '';

  const allSubs = await listAllPushSubscriptions();
  const mine = allSubs.filter((s) => matchesCaller(s, caller));
  const currentEndpointRegistered = Boolean(
    endpointHash && mine.some((s) => s.endpointHash === endpointHash)
  );

  return jsonResponse({
    configured,
    subscriptionCount: mine.length,
    currentEndpointRegistered,
    persistence: isPersistentStoreConfigured() ? 'redis' : 'memory',
  });
}
