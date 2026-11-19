import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';
import {
  AppLanguage,
  LANGUAGE_LABELS,
  TRANSLATIONS,
  Translations,
  getLanguageDir,
} from '../i18n/translations';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  dir: 'ltr' | 'rtl';
  t: Translations;
}

const STORAGE_KEY = 'grade9hub_lang';
const LEGACY_STORAGE_KEY = 'majquiz_lang';

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved === 'en' || saved === 'ku' || saved === 'ar') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'en';
  });

  const dir = getLanguageDir(language);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        dir,
        t: TRANSLATIONS[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

interface LanguageSwitcherProps {
  compact?: boolean;
  tone?: 'light' | 'dark';
  variant?: 'icon' | 'segmented';
}

const SHORT_CODES: Record<AppLanguage, string> = {
  en: 'EN',
  ku: 'کوردی',
  ar: 'عربي',
};

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  tone = 'light',
  variant = 'icon',
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const langs: AppLanguage[] = ['en', 'ku', 'ar'];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label={t.nav.chooseLanguage}
        className={`inline-flex items-center gap-1 rounded-xl p-1 ${
          tone === 'dark'
            ? 'bg-white/15 border border-white/25'
            : 'bg-[#EFE9DF] border border-[#E6DFD5]'
        }`}
      >
        {!compact && (
          <Globe
            className={`w-3.5 h-3.5 mx-1.5 shrink-0 ${
              tone === 'dark' ? 'text-[#E5B742]' : 'text-[#6B1118]'
            }`}
          />
        )}
        {langs.map((code) => {
          const active = language === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap min-h-[30px] ${
                active
                  ? 'bg-[#6B1118] text-white shadow-xs'
                  : tone === 'dark'
                  ? 'text-white/85 hover:bg-white/10'
                  : 'text-[#57534E] hover:text-[#1C1917] hover:bg-white/60'
              }`}
            >
              {LANGUAGE_LABELS[code]}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t.nav.chooseLanguage} (${LANGUAGE_LABELS[language]})`}
        title={`${t.nav.chooseLanguage}: ${LANGUAGE_LABELS[language]}`}
        className={`inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 ${
          compact ? 'w-[38px] h-[38px]' : 'h-9 px-2.5 gap-1.5'
        } ${
          tone === 'dark'
            ? 'border-white/25 bg-white/15 text-white hover:bg-white/25'
            : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118]'
        }`}
      >
        <Globe className="w-[18px] h-[18px] shrink-0" />
        {!compact && (
          <span className="text-xs font-bold tracking-wide leading-none">
            {SHORT_CODES[language]}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.nav.chooseLanguage}
          className="absolute end-0 top-full mt-2 w-44 rounded-xl border border-[#E6DFD5] bg-white p-1.5 shadow-lg z-50"
        >
          {langs.map((code) => {
            const active = language === code;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLanguage(code);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#F9EFF0] text-[#6B1118]'
                    : 'text-[#1C1917] hover:bg-[#FAF8F5]'
                }`}
              >
                <span>{LANGUAGE_LABELS[code]}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 text-[#6B1118]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
