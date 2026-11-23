import {
  dispatchPushToSubscriptions,
  getVapidConfig,
  jsonResponse,
  listAllPushSubscriptions,
  matchesCaller,
  PushLang,
  sanitizePushIconUrl,
  StoredVercelPushSub,
  verifyPushCaller,
} from './_lib.ts';

export async function POST(request: Request): Promise<Response> {
  const cfg = getVapidConfig();
  if (!cfg.configured) {
    return jsonResponse({ error: 'VAPID keys are not configured on this server.' }, 503);
  }

  const caller = await verifyPushCaller(request);
  if (!caller) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  let body: {
    kind?: unknown;
    title?: unknown;
    preview?: unknown;
    announcementType?: unknown;
    announcementId?: unknown;
    recipientUid?: unknown;
    recipientUserId?: unknown;
    recipientEmail?: unknown;
    senderName?: unknown;
    senderUserId?: unknown;
    senderIcon?: unknown;
    groupId?: unknown;
    groupName?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const kind = String(body.kind || '').trim();
  const title = String(body.title || '').trim().slice(0, 120);
  const preview = String(body.preview || '').trim().slice(0, 200);
  const senderIcon = sanitizePushIconUrl(typeof body.senderIcon === 'string' ? body.senderIcon : '');

  const allSubs = await listAllPushSubscriptions();
  const callerHasTeacherSub = allSubs.some(
    (s) => matchesCaller(s, caller) && s.role === 'teacher'
  );
  const callerIsPrivileged =
    caller.isAdmin || caller.role === 'teacher' || callerHasTeacherSub;

  if (kind === 'announcement') {
    if (!callerIsPrivileged) {
      return jsonResponse({ error: 'Only teachers/admins can broadcast announcements.' }, 403);
    }
    if (!title && !preview) {
      return jsonResponse({ error: 'Announcement title or preview is required.' }, 400);
    }

    const annType = body.announcementType === 'material' ? 'material' : 'announcement';
    const annId =
      typeof body.announcementId === 'number' && Number.isFinite(body.announcementId)
        ? body.announcementId
        : null;
    const url = annId ? `/?tab=home&announcementId=${annId}` : '/?tab=home';
    const tag = annId ? `grade9hub-announcement-${annId}` : 'grade9hub-announcement';

    const targets = allSubs.filter((s) => !matchesCaller(s, caller));
    const result = await dispatchPushToSubscriptions(targets, (lang: PushLang) => ({
      title:
        lang === 'ku'
          ? annType === 'material'
            ? `مەلزەمەی نوێ: ${title}`
            : `ڕاگەیاندن: ${title}`
          : lang === 'ar'
          ? annType === 'material'
            ? `مادة دراسية جديدة: ${title}`
            : `إعلان: ${title}`
          : annType === 'material'
          ? `New Study Material: ${title}`
          : `Announcement: ${title}`,
      body: preview || title,
      url,
      tab: 'home',
      tag,
      icon: senderIcon,
      data: annId ? { announcementId: annId } : undefined,
    }));

    return jsonResponse({ ok: true, targets: targets.length, ...result });
  }

  if (kind === 'dm') {
    const recipientUid = typeof body.recipientUid === 'string' ? body.recipientUid.trim() : '';
    const recipientEmail =
      typeof body.recipientEmail === 'string' ? body.recipientEmail.trim().toLowerCase() : '';
    const recipientUserId =
      typeof body.recipientUserId === 'number' && Number.isInteger(body.recipientUserId)
        ? body.recipientUserId
        : null;

    if (!recipientUid && !recipientUserId && !recipientEmail) {
      return jsonResponse({ error: 'Target recipient is required.' }, 400);
    }

    const senderDisplay =
      String(body.senderName || '').trim().slice(0, 80) || caller.email.split('@')[0] || 'Classmate';
    const senderNumericId =
      typeof body.senderUserId === 'number' && Number.isInteger(body.senderUserId)
        ? body.senderUserId
        : caller.userId;

    const url = senderNumericId
      ? `/?tab=community&communityTab=dm&peerId=${senderNumericId}`
      : '/?tab=community&communityTab=dm';
    const tag = `grade9hub-dm-${senderNumericId || caller.firebaseUid || caller.email}`;

    const targets = allSubs.filter((s: StoredVercelPushSub) => {
      if (matchesCaller(s, caller)) return false;
      if (recipientUid && s.firebaseUid === recipientUid) return true;
      if (recipientEmail && s.email && s.email.toLowerCase() === recipientEmail) return true;
      if (recipientUserId && s.userId === recipientUserId) return true;
      return false;
    });

    const result = await dispatchPushToSubscriptions(targets, (lang: PushLang) => ({
      title:
        lang === 'ku'
          ? `نامەیەکی نوێ لە ${senderDisplay}`
          : lang === 'ar'
          ? `رسالة جديدة من ${senderDisplay}`
          : `New message from ${senderDisplay}`,
      body: preview || 'Sent a message',
      url,
      tab: 'community',
      tag,
      icon: senderIcon,
      data: {
        communityTab: 'dm',
        ...(senderNumericId ? { peerId: senderNumericId } : {}),
      },
    }));

    return jsonResponse({ ok: true, targets: targets.length, ...result });
  }

  return jsonResponse({ error: 'Unsupported push notification kind.' }, 400);
}
