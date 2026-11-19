import React, { useState } from 'react';
import { BellRing } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationPermissionModalProps {
  visible: boolean;
  onAllow: () => Promise<void> | void;
  onDontAllow: () => Promise<void> | void;
}

export const NotificationPermissionModal: React.FC<NotificationPermissionModalProps> = ({
  visible,
  onAllow,
  onDontAllow,
}) => {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState<'allow' | 'deny' | null>(null);

  if (!visible) return null;

  const handleAllow = async () => {
    if (submitting) return;
    setSubmitting('allow');
    try {
      await onAllow();
    } finally {
      setSubmitting(null);
    }
  };

  const handleDeny = async () => {
    if (submitting) return;
    setSubmitting('deny');
    try {
      await onDontAllow();
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-permission-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
    >
      <div className="g9-animate-modal-pop w-full max-w-[350px] rounded-[28px] bg-white border border-[#E6DFD5] p-6 sm:p-7 shadow-2xl text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#EFE9DF] flex items-center justify-center mb-4">
          <BellRing className="w-6 h-6 text-[#1C1917]" />
        </div>

        <h2
          id="notif-permission-title"
          className="text-lg sm:text-xl font-bold leading-snug text-[#1C1917]"
        >
          {t.notifPrompt.title}
        </h2>

        <p className="mt-2 text-xs sm:text-sm text-[#57534E] leading-relaxed">
          {t.notifPrompt.subtitle}
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={submitting !== null}
            onClick={handleAllow}
            className="w-full rounded-full bg-[#1A73E8] hover:bg-[#1557B0] active:scale-[0.99] text-white font-semibold text-sm sm:text-[15px] py-3.5 transition-all disabled:opacity-60 cursor-pointer min-h-[48px]"
          >
            {t.notifPrompt.allow}
          </button>

          <button
            type="button"
            disabled={submitting !== null}
            onClick={handleDeny}
            className="w-full rounded-full bg-[#EFE9DF] hover:bg-[#FAF8F5] dark:hover:bg-[#342E2D] active:scale-[0.99] text-[#1C1917] font-semibold text-sm sm:text-[15px] py-3.5 transition-all disabled:opacity-60 cursor-pointer min-h-[48px]"
          >
            {t.notifPrompt.dontAllow}
          </button>
        </div>
      </div>
    </div>
  );
};
