import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  BookOpen,
  CheckCheck,
  FileText,
  Megaphone,
  MessageSquare,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { type PushUnsupportedReason } from '../hooks/usePushNotifications';
import { useLanguage } from '../contexts/LanguageContext';
import { NotificationItem, TabId } from '../types';
import { formatUtcDateTime } from '../utils/dateFormat';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  unreadCount: number;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  pushError: string | null;
  pushUnsupportedReason?: PushUnsupportedReason;
  onEnablePush: () => Promise<boolean>;
  onDisablePush: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onNavigate: (tab: TabId) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  unreadCount,
  pushSupported,
  pushSubscribed,
  pushBusy,
  pushError,
  pushUnsupportedReason = null,
  onEnablePush,
  onDisablePush,
  onRefresh,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleMarkRead = async (id: number, targetTab: TabId) => {
    setActionError(null);
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark notification as read.');
    }
    onNavigate(targetTab);
  };

  const handleMarkAllRead = async () => {
    setActionError(null);
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      await onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to mark all notifications as read.');
    }
  };

  const getCategoryIcon = (cat: NotificationItem['category']) => {
    switch (cat) {
      case 'question':
      case 'chapter':
        return <BookOpen className="w-4 h-4 text-[#6B1118]" />;
      case 'material':
        return <FileText className="w-4 h-4 text-[#D9A62E]" />;
      case 'reply':
        return <MessageSquare className="w-4 h-4 text-[#6B1118]" />;
      default:
        return <Megaphone className="w-4 h-4 text-[#6B1118]" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">
            {t.notifications.title}
          </h2>
          <p className="text-sm text-[#57534E] mt-1 tabular-nums">
            {unreadCount} {t.notifications.unreadLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {pushSupported && (
            <button
              type="button"
              disabled={pushBusy}
              onClick={pushSubscribed ? onDisablePush : onEnablePush}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer min-h-[44px] ${
                pushSubscribed
                  ? 'border border-[#E6DFD5] bg-white text-[#1C1917] hover:border-[#6B1118]'
                  : 'bg-[#6B1118] text-white hover:bg-[#530D12]'
              }`}
            >
              {pushSubscribed ? (
                <>
                  <BellOff className="w-4 h-4 text-[#57534E]" />
                  <span>{t.notifications.pushActive}</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 text-[#E5B742]" />
                  <span>
                    {pushBusy ? t.notifications.enablingPush : t.notifications.enablePush}
                  </span>
                </>
              )}
            </button>
          )}

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[44px]"
            >
              <CheckCheck className="w-4 h-4" />
              <span>{t.notifications.markAllRead}</span>
            </button>
          )}
        </div>
      </div>

      {(pushError || actionError) && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {actionError || pushError}
        </div>
      )}

      {pushUnsupportedReason === 'ios_home_screen' && (
        <div
          role="region"
          aria-label={t.notifications.iosBrowserTitle}
          className="rounded-2xl border border-[#D9A62E]/45 bg-[#FBF4DF]/75 px-5 py-4 space-y-1.5"
        >
          <p className="text-sm font-bold text-[#6B1118] flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#D9A62E] shrink-0" />
            <span>{t.notifications.iosBrowserTitle}</span>
          </p>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
            {t.notifications.iosBrowserSteps}
          </p>
        </div>
      )}

      {pushUnsupportedReason === 'unsupported' && (
        <div
          role="region"
          aria-label={t.notifications.unsupportedTitle}
          className="rounded-2xl border border-[#E6DFD5] bg-[#FAF8F5] px-5 py-4 space-y-1.5"
        >
          <p className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
            <BellOff className="w-4 h-4 text-[#57534E] shrink-0" />
            <span>{t.notifications.unsupportedTitle}</span>
          </p>
          <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
            {t.notifications.unsupportedDesc}
          </p>
        </div>
      )}

      {pushUnsupportedReason === 'vapid_missing' && (
        <div
          role="status"
          className="rounded-2xl border border-[#D9A62E]/45 bg-[#FBF4DF]/75 px-5 py-3.5 text-xs sm:text-sm text-[#57534E] leading-relaxed"
        >
          {t.notifications.vapidUnavailableDesc}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-[#E6DFD5] divide-y divide-[#E6DFD5]">
        {notifications.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Bell className="w-9 h-9 text-[#D9A62E] mx-auto" />
            <p className="text-base font-semibold text-[#1C1917]">
              {t.notifications.allCaughtUp}
            </p>
            <p className="text-sm text-[#57534E]">{t.notifications.emptyDesc}</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleMarkRead(n.id, n.link_tab || 'home')}
              className={`w-full text-start p-5 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                n.is_read === 0 ? 'bg-[#F9EFF0]/60 hover:bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#E6DFD5] flex items-center justify-center shrink-0 mt-0.5">
                  {getCategoryIcon(n.category)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#57534E]">
                    <span className="font-semibold text-[#6B1118]">
                      {t.notifications.categories[n.category] || n.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatUtcDateTime(n.created_at)}
                    </span>
                    {n.is_read === 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-bold text-[#6B1118]">
                          {t.notifications.unreadTag}
                        </span>
                      </>
                    )}
                  </div>
                  <h4 className="mt-1 text-sm sm:text-base font-semibold text-[#1C1917]">
                    {n.title}
                  </h4>
                  <p className="mt-0.5 text-sm text-[#57534E]">{n.body}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
