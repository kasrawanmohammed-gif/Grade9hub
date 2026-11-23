import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Globe,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Type,
  Volume2,
} from 'lucide-react';
import { AppLanguage, LANGUAGE_LABELS } from '../i18n/translations';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ACCENT_THEMES,
  AccentThemeId,
  FontSizeScale,
  ThemeMode,
  useSettings,
} from '../contexts/SettingsContext';
import { type PushUnsupportedReason } from '../hooks/usePushNotifications';
import { TabId } from '../types';

interface SettingsViewProps {
  onNavigate: (tab: TabId) => void;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushPermission: NotificationPermission;
  pushBusy: boolean;
  pushError: string | null;
  pushUnsupportedReason?: PushUnsupportedReason;
  pushTestBusy?: boolean;
  pushTestResult?: { ok: boolean; message: string } | null;
  onEnablePush: () => Promise<boolean>;
  onDisablePush: () => Promise<void>;
  onSendTestPush?: () => Promise<boolean>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onNavigate,
  pushSupported,
  pushSubscribed,
  pushPermission,
  pushBusy,
  pushError,
  pushUnsupportedReason = null,
  pushTestBusy = false,
  pushTestResult = null,
  onEnablePush,
  onDisablePush,
  onSendTestPush,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const {
    settings,
    resolvedTheme,
    setThemeMode,
    setAccentColor,
    setFontSize,
    setReduceMotion,
    setSoundFeedback,
    setAutoScrollFeedback,
    resetSettings,
  } = useSettings();

  const [resetNotice, setResetNotice] = useState(false);

  const themeOptions: Array<{
    id: ThemeMode;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'light',
      label: t.settings.themeLight,
      desc: t.settings.themeLightDesc,
      icon: Sun,
    },
    {
      id: 'dark',
      label: t.settings.themeDark,
      desc: t.settings.themeDarkDesc,
      icon: Moon,
    },
    {
      id: 'auto',
      label: t.settings.themeAuto,
      desc: t.settings.themeAutoDesc,
      icon: Monitor,
    },
  ];

  const fontOptions: Array<{
    id: FontSizeScale;
    label: string;
    sampleClass: string;
  }> = [
    { id: 'sm', label: t.settings.fontSmall, sampleClass: 'text-xs' },
    { id: 'md', label: t.settings.fontNormal, sampleClass: 'text-sm' },
    { id: 'lg', label: t.settings.fontLarge, sampleClass: 'text-base' },
    { id: 'xl', label: t.settings.fontXLarge, sampleClass: 'text-lg' },
  ];

  const langs: Array<{ code: AppLanguage; label: string; nativeSub: string }> = [
    { code: 'en', label: LANGUAGE_LABELS.en, nativeSub: 'LTR · English' },
    { code: 'ku', label: LANGUAGE_LABELS.ku, nativeSub: 'RTL · کوردی سۆرانی' },
    { code: 'ar', label: LANGUAGE_LABELS.ar, nativeSub: 'RTL · العربية' },
  ];

  const handleReset = () => {
    resetSettings();
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.settings.title}</h2>
          <p className="text-sm text-[#57534E] mt-1">{t.settings.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[#57534E] hover:border-[#6B1118] hover:text-[#6B1118] cursor-pointer min-h-[42px]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{t.settings.resetDefaults}</span>
        </button>
      </div>

      {resetNotice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{t.settings.resetDone}</span>
        </div>
      )}

      {/* Theme Mode Section: White (Light), Dark, Auto */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {resolvedTheme === 'dark' ? (
                <Moon className="w-5 h-5 text-[#E5B742]" />
              ) : (
                <Sun className="w-5 h-5 text-[#D9A62E]" />
              )}
              <h3 className="text-lg font-bold text-[#1C1917]">{t.settings.appearanceTitle}</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#57534E] mt-1">{t.settings.appearanceDesc}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-3 py-1.5 text-xs font-semibold text-[#6B1118]">
            <span>{t.settings.activeModeResolved}:</span>
            <span>
              {resolvedTheme === 'dark' ? t.settings.themeDark : t.settings.themeLight}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active = settings.themeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setThemeMode(opt.id)}
                className={`text-start rounded-xl border p-4 transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                  active
                    ? 'border-2 border-[#6B1118] bg-[#F9EFF0]'
                    : 'border-[#E6DFD5] bg-[#FAF8F5] hover:border-[#6B1118]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      active ? 'bg-[#6B1118] text-white' : 'bg-white border border-[#E6DFD5] text-[#6B1118]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#E5B742]' : ''}`} />
                  </div>
                  {active && (
                    <span className="w-5 h-5 rounded-full bg-[#6B1118] text-white flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1C1917]">{opt.label}</p>
                  <p className="text-xs text-[#57534E] mt-0.5 leading-relaxed">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Theme Accent Color Customizer */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#6B1118]" />
              <h3 className="text-lg font-bold text-[#1C1917]">{t.settings.accentThemeTitle}</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#57534E] mt-1">{t.settings.accentThemeDesc}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-3 py-1.5 text-xs font-semibold text-[#1C1917]">
            <span>{t.settings.accentActiveLabel}:</span>
            <span className="text-[#6B1118] font-bold">
              {t.settings.accentColors[settings.accentColor]}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {ACCENT_THEMES.map((theme) => {
            const active = settings.accentColor === theme.id;
            const colorLabel = t.settings.accentColors[theme.id as AccentThemeId];
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setAccentColor(theme.id)}
                aria-pressed={active}
                className={`rounded-xl border p-3 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2.5 min-h-[84px] ${
                  active
                    ? 'border-2 border-[#6B1118] bg-[#F9EFF0]'
                    : 'border-[#E6DFD5] bg-[#FAF8F5] hover:border-[#6B1118]/40'
                }`}
              >
                <span
                  className="w-8 h-8 rounded-full shadow-xs border border-black/10 flex items-center justify-center text-white shrink-0"
                  style={{
                    backgroundColor:
                      resolvedTheme === 'dark' ? theme.textDarkHex : theme.primaryHex,
                    color: resolvedTheme === 'dark' ? '#131111' : '#FFFFFF',
                  }}
                >
                  {active && <Check className="w-4 h-4 stroke-[2.75]" />}
                </span>
                <span
                  className={`text-xs font-bold leading-tight ${
                    active ? 'text-[#6B1118]' : 'text-[#1C1917]'
                  }`}
                >
                  {colorLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B1118]" />
            <span className="text-xs font-semibold text-[#1C1917]">
              {t.settings.accentColors[settings.accentColor]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#F9EFF0] px-2.5 py-1 text-xs font-semibold text-[#6B1118]">
              {t.settings.accentActiveLabel}
            </span>
            <span className="rounded-lg bg-[#6B1118] px-3 py-1 text-xs font-semibold text-white">
              {t.settings.accentPreviewBtn}
            </span>
          </div>
        </div>
      </section>

      {/* Font Size Scaling */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-[#6B1118]" />
            <h3 className="text-lg font-bold text-[#1C1917]">{t.settings.fontSizeLabel}</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#57534E] mt-1">{t.settings.fontSizeDesc}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {fontOptions.map((opt) => {
            const active = settings.fontSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFontSize(opt.id)}
                className={`rounded-xl border px-4 py-3 text-center transition-colors cursor-pointer min-h-[56px] flex flex-col items-center justify-center gap-1 ${
                  active
                    ? 'border-2 border-[#6B1118] bg-[#6B1118] text-white font-bold'
                    : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118]/50'
                }`}
              >
                <span className={`${opt.sampleClass} font-bold leading-none`}>Aa</span>
                <span className="text-xs">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B1118]">
            {t.settings.fontPreviewLabel}
          </p>
          <p className="mt-1.5 text-sm sm:text-base text-[#1C1917] leading-relaxed">
            {t.settings.fontPreviewSample}
          </p>
        </div>
      </section>

      {/* Language Selection inside Settings */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#6B1118]" />
            <h3 className="text-lg font-bold text-[#1C1917]">{t.settings.languageTitle}</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#57534E] mt-1">{t.settings.languageDesc}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {langs.map((item) => {
            const active = language === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => setLanguage(item.code)}
                className={`rounded-xl border p-4 text-start transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  active
                    ? 'border-2 border-[#6B1118] bg-[#F9EFF0]'
                    : 'border-[#E6DFD5] bg-[#FAF8F5] hover:border-[#6B1118]/40'
                }`}
              >
                <div>
                  <p className="text-base font-bold text-[#1C1917]">{item.label}</p>
                  <p className="text-xs text-[#57534E] mt-0.5">{item.nativeSub}</p>
                </div>
                {active && (
                  <span className="w-5 h-5 rounded-full bg-[#6B1118] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Study & System Preferences */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[#6B1118]" />
            <h3 className="text-lg font-bold text-[#1C1917]">{t.settings.preferencesTitle}</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#57534E] mt-1">{t.settings.preferencesDesc}</p>
        </div>

        <div className="divide-y divide-[#E6DFD5]">
          <div className="py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Volume2 className="w-4 h-4 text-[#6B1118] mt-1 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#1C1917]">
                  {t.settings.soundFeedbackLabel}
                </p>
                <p className="text-xs text-[#57534E] mt-0.5">{t.settings.soundFeedbackDesc}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.soundFeedback}
              onClick={() => setSoundFeedback(!settings.soundFeedback)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.soundFeedback ? 'bg-[#6B1118]' : 'bg-[#EFE9DF] border border-[#E6DFD5]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.soundFeedback ? 'ltr:translate-x-6 rtl:-translate-x-6' : 'ltr:translate-x-1 rtl:-translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">{t.settings.autoScrollLabel}</p>
              <p className="text-xs text-[#57534E] mt-0.5">{t.settings.autoScrollDesc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoScrollFeedback}
              onClick={() => setAutoScrollFeedback(!settings.autoScrollFeedback)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.autoScrollFeedback ? 'bg-[#6B1118]' : 'bg-[#EFE9DF] border border-[#E6DFD5]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.autoScrollFeedback
                    ? 'ltr:translate-x-6 rtl:-translate-x-6'
                    : 'ltr:translate-x-1 rtl:-translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#1C1917]">{t.settings.reduceMotionLabel}</p>
              <p className="text-xs text-[#57534E] mt-0.5">{t.settings.reduceMotionDesc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reduceMotion}
              onClick={() => setReduceMotion(!settings.reduceMotion)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                settings.reduceMotion ? 'bg-[#6B1118]' : 'bg-[#EFE9DF] border border-[#E6DFD5]'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.reduceMotion
                    ? 'ltr:translate-x-6 rtl:-translate-x-6'
                    : 'ltr:translate-x-1 rtl:-translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Push Alerts Shortcut */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-[#D9A62E] mt-0.5 shrink-0" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#1C1917]">{t.settings.notificationsTitle}</h3>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    pushUnsupportedReason !== null
                      ? 'bg-[#FBF4DF]/75 text-[#6B1118] border border-[#D9A62E]/40'
                      : pushSubscribed
                      ? 'bg-[#ECFDF5] text-[#065F46] border border-[#059669]/30'
                      : pushPermission === 'denied'
                      ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#DC2626]/30'
                      : 'bg-[#FAF8F5] text-[#57534E] border border-[#E6DFD5]'
                  }`}
                >
                  {pushUnsupportedReason === 'vapid_missing'
                    ? t.notifications.statusSetupRequired
                    : pushUnsupportedReason !== null
                    ? t.settings.notificationsStatusUnsupported
                    : pushSubscribed
                    ? t.settings.notificationsStatusEnabled
                    : pushPermission === 'denied'
                    ? t.settings.notificationsStatusBlocked
                    : t.settings.notificationsStatusDisabled}
                </span>
              </div>
              <p className="text-xs text-[#57534E] mt-0.5">{t.settings.notificationsDesc}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {pushSupported && pushUnsupportedReason !== 'vapid_missing' && (
              <button
                type="button"
                disabled={pushBusy}
                onClick={pushSubscribed ? onDisablePush : onEnablePush}
                className={`rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer min-h-[42px] disabled:opacity-60 ${
                  pushSubscribed
                    ? 'border border-[#E6DFD5] text-[#1C1917] hover:border-[#6B1118]'
                    : 'bg-[#6B1118] text-white hover:bg-[#530D12]'
                }`}
              >
                {pushSubscribed ? t.profile.disablePush : t.profile.enablePush}
              </button>
            )}
            {pushSubscribed && onSendTestPush && (
              <button
                type="button"
                disabled={pushTestBusy}
                onClick={() => void onSendTestPush()}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[42px] disabled:opacity-60"
              >
                {pushTestBusy ? t.notifications.sendingTestPush : t.notifications.sendTestPush}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[42px]"
            >
              {t.settings.openNotificationsBtn}
            </button>
          </div>
        </div>

        {pushTestResult && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${
              pushTestResult.ok
                ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
                : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#991B1B]'
            }`}
          >
            {pushTestResult.ok ? t.notifications.testPushSuccess : t.notifications.testPushError}
          </div>
        )}

        {(pushPermission === 'denied' || pushError || pushUnsupportedReason !== null) && !pushSubscribed && (
          <div
            role="status"
            className="rounded-xl border border-[#D9A62E]/40 bg-[#FBF4DF]/60 px-4 py-3 text-xs text-[#57534E] leading-relaxed"
          >
            {pushUnsupportedReason === 'ios_home_screen'
              ? t.notifications.iosBrowserSteps
              : pushUnsupportedReason === 'unsupported'
              ? t.notifications.unsupportedDesc
              : pushUnsupportedReason === 'vapid_missing'
              ? t.notifications.vapidUnavailableDesc
              : pushPermission === 'denied'
              ? t.settings.notificationsBlockedHelp
              : pushError}
          </div>
        )}
      </section>
    </div>
  );
};
