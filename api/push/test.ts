import {
  dispatchPushToSubscriptions,
  ensureWebPushConfigured,
  jsonResponse,
  listAllPushSubscriptions,
  matchesCaller,
  normalizePushLang,
  PushLang,
  verifyPushCaller,
} from './_lib.ts';

export async function POST(request: Request): Promise<Response> {
  if (!ensureWebPushConfigured()) {
    return jsonResponse({ error: 'VAPID keys are not configured on this server.' }, 503);
  }

  const caller = await verifyPushCaller(request);
  if (!caller) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  let body: { lang?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const preferredLang = body?.lang ? normalizePushLang(body.lang) : null;
  const allSubs = await listAllPushSubscriptions();
  const mine = allSubs.filter((s) => matchesCaller(s, caller));

  if (mine.length === 0) {
    return jsonResponse(
      {
        ok: false,
        sent: 0,
        error: 'No active push subscription found on this device. Enable Push Notifications first.',
      },
      400
    );
  }

  const result = await dispatchPushToSubscriptions(mine, (subLang: PushLang) => {
    const lang = preferredLang || subLang;
    return {
      title:
        lang === 'ku'
          ? 'تاقیکردنەوەی ئاگاداری پۆلی ٩'
          : lang === 'ar'
          ? 'اختبار إشعارات منصة الصف التاسع'
          : 'Grade 9 Hub · Test Notification',
      body:
        lang === 'ku'
          ? 'ئاگادارکردنەوەی سیستەم و شاشەی قوفڵ بە سەرکەوتوویی کار دەکات.'
          : lang === 'ar'
          ? 'تنبيهات النظام وشاشة القفل تعمل بنجاح على جهازك.'
          : 'Background and lock-screen push alerts are active on this device.',
      url: '/?tab=notifications',
      tab: 'notifications',
      tag: `grade9hub-test-${caller.firebaseUid || caller.userId || caller.email}`,
      icon: '/pwa-192x192.png',
    };
  });

  if (result.sent === 0) {
    return jsonResponse(
      {
        ok: false,
        sent: 0,
        failed: result.failed,
        removed: result.removed,
        error: 'Push delivery failed or subscription expired. Please re-enable notifications.',
      },
      400
    );
  }

  return jsonResponse({ ok: true, ...result });
}
