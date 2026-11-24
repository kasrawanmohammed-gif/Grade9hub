import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const LoginInstallAppButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { language, t } = useLanguage();
  const [hintMode, setHintMode] = useState<'ios' | 'browser' | null>(null);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      setHintMode(null);
      await install();
      return;
    }
    setHintMode((prev) => {
      const next = isIOS ? 'ios' : 'browser';
      return prev === next ? null : next;
    });
  };

  const browserMenuHint =
    language === 'ku'
      ? 'مێنووی وێبگەڕەکەت (⋮ یان ⋯) بکەرەوە ← «Install app» یان «Add to Home screen» هەڵبژێرە.'
      : language === 'ar'
      ? 'افتح قائمة المتصفح (⋮ أو ⋯) ← اختر «تثبيت التطبيق» أو «الإضافة إلى الشاشة الرئيسية».'
      : 'Open your browser menu (⋮ or ⋯) and select Install app or Add to Home screen.';

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => void handleClick()}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#D9A62E] bg-[#FBF4DF] px-4 py-2 text-sm font-semibold text-[#6B1118] hover:bg-[#F7EAC3] shadow-xs transition-colors cursor-pointer min-h-[40px] sm:min-h-[42px]"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="truncate">{t.brand.installAppNow}</span>
      </button>

      {hintMode === 'ios' && (
        <div
          role="status"
          className="rounded-xl border border-[#D9A62E]/60 bg-[#FBF4DF]/70 px-3 py-2 text-[11px] sm:text-xs text-[#1C1917] leading-relaxed flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2 min-w-0">
            <Share className="w-3.5 h-3.5 text-[#6B1118] shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-[#6B1118]">{t.brand.installIOSSub}</p>
              <p className="text-[#57534E]">
                {t.brand.installIOSStep1} {t.brand.installIOSStep2}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHintMode(null)}
            aria-label="Close install hint"
            className="p-0.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {hintMode === 'browser' && (
        <div
          role="status"
          className="rounded-xl border border-[#E6DFD5] bg-white px-3 py-2 text-[11px] sm:text-xs text-[#57534E] leading-relaxed flex items-start justify-between gap-2"
        >
          <span className="min-w-0">{browserMenuHint}</span>
          <button
            type="button"
            onClick={() => setHintMode(null)}
            aria-label="Close install hint"
            className="p-0.5 text-[#57534E] hover:text-[#1C1917] cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
