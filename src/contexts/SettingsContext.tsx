import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';
export type AccentThemeId =
  | 'burgundy'
  | 'indigo'
  | 'emerald'
  | 'violet'
  | 'blue'
  | 'rose'
  | 'amber';

export interface AccentThemeOption {
  id: AccentThemeId;
  primaryHex: string;
  hoverHex: string;
  deepHex: string;
  softHex: string;
  softDarkHex: string;
  textDarkHex: string;
  rgb: string;
  hoverRgb: string;
  deepRgb: string;
  softRgb: string;
  textDarkRgb: string;
}

export const ACCENT_THEMES: AccentThemeOption[] = [
  {
    id: 'burgundy',
    primaryHex: '#6B1118',
    hoverHex: '#530D12',
    deepHex: '#3E080C',
    softHex: '#F9EFF0',
    softDarkHex: '#2E191C',
    textDarkHex: '#F2A7AE',
    rgb: '107 17 24',
    hoverRgb: '83 13 18',
    deepRgb: '62 8 12',
    softRgb: '249 239 240',
    textDarkRgb: '242 167 174',
  },
  {
    id: 'indigo',
    primaryHex: '#4338CA',
    hoverHex: '#3730A3',
    deepHex: '#1E1B4B',
    softHex: '#EEF2FF',
    softDarkHex: '#1E1B4B',
    textDarkHex: '#A5B4FC',
    rgb: '67 56 202',
    hoverRgb: '55 48 163',
    deepRgb: '30 27 75',
    softRgb: '238 242 255',
    textDarkRgb: '165 180 252',
  },
  {
    id: 'emerald',
    primaryHex: '#047857',
    hoverHex: '#065F46',
    deepHex: '#022C22',
    softHex: '#ECFDF5',
    softDarkHex: '#0D2B22',
    textDarkHex: '#6EE7B7',
    rgb: '4 120 87',
    hoverRgb: '6 95 70',
    deepRgb: '2 44 34',
    softRgb: '236 253 245',
    textDarkRgb: '110 231 183',
  },
  {
    id: 'violet',
    primaryHex: '#6D28D9',
    hoverHex: '#5B21B6',
    deepHex: '#2E1065',
    softHex: '#F5F3FF',
    softDarkHex: '#251746',
    textDarkHex: '#C4B5FD',
    rgb: '109 40 217',
    hoverRgb: '91 33 182',
    deepRgb: '46 16 101',
    softRgb: '245 243 255',
    textDarkRgb: '196 181 253',
  },
  {
    id: 'blue',
    primaryHex: '#1D4ED8',
    hoverHex: '#1E40AF',
    deepHex: '#172554',
    softHex: '#EFF6FF',
    softDarkHex: '#16233E',
    textDarkHex: '#93C5FD',
    rgb: '29 78 216',
    hoverRgb: '30 64 175',
    deepRgb: '23 37 84',
    softRgb: '239 246 255',
    textDarkRgb: '147 197 253',
  },
  {
    id: 'rose',
    primaryHex: '#BE123C',
    hoverHex: '#9F1239',
    deepHex: '#4C0519',
    softHex: '#FFF1F2',
    softDarkHex: '#35151E',
    textDarkHex: '#FDA4AF',
    rgb: '190 18 60',
    hoverRgb: '159 18 57',
    deepRgb: '76 5 25',
    softRgb: '255 241 242',
    textDarkRgb: '253 164 175',
  },
  {
    id: 'amber',
    primaryHex: '#B45309',
    hoverHex: '#92400E',
    deepHex: '#451A03',
    softHex: '#FFFBEB',
    softDarkHex: '#2D1E0B',
    textDarkHex: '#FCD34D',
    rgb: '180 83 9',
    hoverRgb: '146 64 14',
    deepRgb: '69 26 3',
    softRgb: '255 251 235',
    textDarkRgb: '252 211 77',
  },
];

const ACCENT_THEME_MAP: Record<AccentThemeId, AccentThemeOption> = ACCENT_THEMES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<AccentThemeId, AccentThemeOption>
);

export interface AppSettings {
  themeMode: ThemeMode;
  accentColor: AccentThemeId;
  fontSize: FontSizeScale;
  reduceMotion: boolean;
  soundFeedback: boolean;
  autoScrollFeedback: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  accentColor: 'burgundy',
  fontSize: 'md',
  reduceMotion: false,
  soundFeedback: true,
  autoScrollFeedback: true,
};

const STORAGE_KEY = 'grade9hub_settings';

const FONT_SIZE_PX: Record<FontSizeScale, string> = {
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
};

interface SettingsContextValue {
  settings: AppSettings;
  resolvedTheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (accent: AccentThemeId) => void;
  setFontSize: (size: FontSizeScale) => void;
  setReduceMotion: (val: boolean) => void;
  setSoundFeedback: (val: boolean) => void;
  setAutoScrollFeedback: (val: boolean) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function isValidAccent(val: unknown): val is AccentThemeId {
  return (
    val === 'burgundy' ||
    val === 'indigo' ||
    val === 'emerald' ||
    val === 'violet' ||
    val === 'blue' ||
    val === 'rose' ||
    val === 'amber'
  );
}

function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      themeMode:
        parsed.themeMode === 'light' || parsed.themeMode === 'dark' || parsed.themeMode === 'auto'
          ? parsed.themeMode
          : DEFAULT_SETTINGS.themeMode,
      accentColor: isValidAccent(parsed.accentColor)
        ? parsed.accentColor
        : DEFAULT_SETTINGS.accentColor,
      fontSize:
        parsed.fontSize === 'sm' ||
        parsed.fontSize === 'md' ||
        parsed.fontSize === 'lg' ||
        parsed.fontSize === 'xl'
          ? parsed.fontSize
          : DEFAULT_SETTINGS.fontSize,
      reduceMotion:
        typeof parsed.reduceMotion === 'boolean'
          ? parsed.reduceMotion
          : DEFAULT_SETTINGS.reduceMotion,
      soundFeedback:
        typeof parsed.soundFeedback === 'boolean'
          ? parsed.soundFeedback
          : DEFAULT_SETTINGS.soundFeedback,
      autoScrollFeedback:
        typeof parsed.autoScrollFeedback === 'boolean'
          ? parsed.autoScrollFeedback
          : DEFAULT_SETTINGS.autoScrollFeedback,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    setSystemPrefersDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    settings.themeMode === 'auto'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : settings.themeMode;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota errors
    }

    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      root.dataset.theme = 'light';
    }

    const accent = ACCENT_THEME_MAP[settings.accentColor] || ACCENT_THEME_MAP.burgundy;
    root.dataset.accent = accent.id;
    root.style.setProperty('--accent-rgb', accent.rgb);
    root.style.setProperty('--accent-hover-rgb', accent.hoverRgb);
    root.style.setProperty('--accent-deep-rgb', accent.deepRgb);
    root.style.setProperty('--accent-soft-rgb', accent.softRgb);
    root.style.setProperty('--accent-text-dark-rgb', accent.textDarkRgb);
    root.style.setProperty('--accent-soft', accent.softHex);
    root.style.setProperty('--accent-soft-dark', accent.softDarkHex);
    root.style.setProperty('--accent-text-dark', accent.textDarkHex);
    root.style.setProperty('--brand-burgundy', accent.primaryHex);
    root.style.setProperty('--brand-burgundy-hover', accent.hoverHex);
    root.style.setProperty('--brand-burgundy-soft', accent.softHex);

    root.style.fontSize = FONT_SIZE_PX[settings.fontSize];

    if (settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  }, [settings, resolvedTheme]);

  const setThemeMode = useCallback((themeMode: ThemeMode) => {
    setSettings((prev) => ({ ...prev, themeMode }));
  }, []);

  const setAccentColor = useCallback((accentColor: AccentThemeId) => {
    setSettings((prev) => ({ ...prev, accentColor }));
  }, []);

  const setFontSize = useCallback((fontSize: FontSizeScale) => {
    setSettings((prev) => ({ ...prev, fontSize }));
  }, []);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    setSettings((prev) => ({ ...prev, reduceMotion }));
  }, []);

  const setSoundFeedback = useCallback((soundFeedback: boolean) => {
    setSettings((prev) => ({ ...prev, soundFeedback }));
  }, []);

  const setAutoScrollFeedback = useCallback((autoScrollFeedback: boolean) => {
    setSettings((prev) => ({ ...prev, autoScrollFeedback }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        resolvedTheme,
        setThemeMode,
        setAccentColor,
        setFontSize,
        setReduceMotion,
        setSoundFeedback,
        setAutoScrollFeedback,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}

interface ThemeToggleButtonProps {
  tone?: 'light' | 'dark';
  compact?: boolean;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  tone = 'light',
  compact = false,
}) => {
  const { resolvedTheme, setThemeMode } = useSettings();
  const { t } = useLanguage();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? t.nav.switchToLight : t.nav.switchToDark;

  const handleToggle = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  if (tone === 'dark') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={label}
        title={label}
        className={`inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer shrink-0 ${
          compact ? 'w-[38px] h-[38px]' : 'w-9 h-9'
        }`}
      >
        {isDark ? <Sun className="w-[18px] h-[18px] text-[#E5B742]" /> : <Moon className="w-[18px] h-[18px]" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer shrink-0 ${
        compact ? 'w-[38px] h-[38px]' : 'w-9 h-9'
      }`}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px] text-[#E5B742]" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-[#6B1118]" />
      )}
    </button>
  );
};

export function playAnswerSound(isCorrect: boolean): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCorrect) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.18);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.24);
    }
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 350);
  } catch {
    // ignore audio restrictions
  }
}
