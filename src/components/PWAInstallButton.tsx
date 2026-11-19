import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useLanguage();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={`flex items-center justify-center gap-2 rounded-lg bg-[#6B1118] text-white font-medium transition-colors hover:bg-[#530D12] whitespace-nowrap shrink-0 cursor-pointer ${
          compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
        }`}
      >
        <Download className="w-4 h-4 text-[#E5B742] shrink-0" />
        <span>{t.brand.installApp}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center justify-center gap-2 rounded-lg border border-[#D9A62E] bg-[#FBF4DF] text-[#6B1118] font-medium transition-colors hover:bg-[#F7EAC3] whitespace-nowrap shrink-0 cursor-pointer ${
            compact ? 'px-3 py-2 text-xs min-h-[40px]' : 'w-full px-4 py-2.5 text-sm min-h-[44px]'
          }`}
        >
          <Share className="w-4 h-4 shrink-0" />
          <span>{t.brand.installIOS}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-[#E6DFD5]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
                    alt="Grade 9 Hub Logo"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-lg object-contain border border-[#E6DFD5] bg-white p-1"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-[#1C1917]">
                      {t.brand.installIOSTitle}
                    </h3>
                    <p className="text-xs text-[#57534E]">{t.brand.installIOSSub}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close installation guide"
                  className="p-2 text-[#57534E] hover:text-[#1C1917] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-[#1C1917]">
                <li>{t.brand.installIOSStep1}</li>
                <li>{t.brand.installIOSStep2}</li>
                <li>{t.brand.installIOSStep3}</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#6B1118] py-2.5 text-sm font-medium text-white hover:bg-[#530D12] cursor-pointer"
              >
                {t.brand.gotIt}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
