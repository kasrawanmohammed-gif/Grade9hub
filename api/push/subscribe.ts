import {
  hashEndpoint,
  isPersistentStoreConfigured,
  jsonResponse,
  listAllPushSubscriptions,
  matchesCaller,
  normalizePushLang,
  savePushSubscription,
  verifyPushCaller,
} from './_lib.ts';

export async function POST(request: Request): Promise<Response> {
  const caller = await verifyPushCaller(request);
  if (!caller) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  let body: {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    lang?: unknown;
    role?: unknown;
    userId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const endpoint =
    typeof body?.subscription?.endpoint === 'string' ? body.subscription.endpoint.trim() : '';
  const p256dh =
    typeof body?.subscription?.keys?.p256dh === 'string'
      ? body.subscription.keys.p256dh.trim()
      : '';
  const auth =
    typeof body?.subscription?.keys?.auth === 'string' ? body.subscription.keys.auth.trim() : '';

  if (
    !endpoint ||
    !/^https:\/\//i.test(endpoint) ||
    endpoint.length > 2048 ||
    !p256dh ||
    !auth
  ) {
    return jsonResponse({ error: 'Invalid push subscription object.' }, 400);
  }

  const numericUserId =
    typeof body.userId === 'number' && Number.isInteger(body.userId) && body.userId > 0
      ? body.userId
      : caller.userId;

  const effectiveRole =
    caller.isAdmin || caller.role === 'teacher'
      ? 'teacher'
      : body.role === 'teacher' && caller.email === 'mohamdm791@gmail.com'
      ? 'teacher'
      : 'student';

  const record = {
    endpointHash: hashEndpoint(endpoint),
    endpoint,
    p256dh,
    auth,
    userId: numericUserId,
    firebaseUid: caller.firebaseUid,
    email: caller.email,
    role: effectiveRole as 'student' | 'teacher',
    lang: normalizePushLang(body.lang),
    userAgent: (request.headers.get('user-agent') || '').slice(0, 250),
    updatedAt: new Date().toISOString(),
  };

  await savePushSubscription(record);
  const all = await listAllPushSubscriptions();
  const mineCount = all.filter((s) => matchesCaller(s, caller)).length;

  return jsonResponse({
    ok: true,
    subscriptionCount: mineCount,
    persistence: isPersistentStoreConfigured() ? 'redis' : 'memory',
  });
}
