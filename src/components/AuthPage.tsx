import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Upload,
  User as UserIcon,
} from 'lucide-react';
import { ApiError, apiFetch, setStoredSessionToken } from '../lib/api';
import {
  decryptAdminVaultWithPassword,
  getAnyAdminVaultSummary,
  getUserPassport,
  initializeAdminVaultWithPassword,
  saveUserPassport,
  syncSessionBoundVault,
} from '../lib/recoveryVault';
import {
  MAIN_ADMIN_EMAIL,
  pullAllSchoolAccountsAsAdmin,
  pullCloudUserProfile,
  pushSchoolAccountsAsAdmin,
  SchoolAccountMirrorRow,
  signInWithFacebookCloud,
  signInWithGoogleCloud,
  syncCurrentUserToFirestore,
} from '../lib/cloudAccounts';
import { formatMsg } from '../i18n/translations';
import { User } from '../types';
import { LanguageSwitcher, useLanguage } from '../contexts/LanguageContext';
import { ThemeToggleButton } from '../contexts/SettingsContext';
import { PWAInstallButton } from './PWAInstallButton';
import prismHeroImg from '../assets/images/physics_optics_prism_hero_1794573933754.jpg';

interface AuthPageProps {
  onAuthenticated: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'forgot';
type ForgotStep = 'email' | 'verify' | 'reset' | 'done';

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const { t, dir } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [password, setPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [forgotStep, setForgotStep] = useState<ForgotStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [restoringVault, setRestoringVault] = useState(false);
  const [serverDbEmpty, setServerDbEmpty] = useState(false);
  const [vaultSummary, setVaultSummary] = useState<{
    email: string;
    updatedAt: string;
    usersCount: number;
    questionsCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{ dbEmpty: boolean }>('/api/auth/recovery-status')
      .then((res) => {
        if (active) setServerDbEmpty(Boolean(res.dbEmpty));
      })
      .catch(() => {});
    getAnyAdminVaultSummary()
      .then((summary) => {
        if (active) setVaultSummary(summary);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const persistAdminVault = async (
    adminEmail: string,
    adminPassword: string,
    sessionToken?: string
  ) => {
    try {
      const payload = await apiFetch<unknown>('/api/admin/backups/export');
      await initializeAdminVaultWithPassword(adminEmail, adminPassword, payload);
      if (sessionToken) {
        await syncSessionBoundVault(adminEmail, sessionToken, payload);
      }
    } catch {
      // ignore non-fatal browser storage failures
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    if (next === 'forgot') {
      setForgotStep('email');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const completeFirebaseSocialSignIn = async (
    fbIdentity: {
      idToken: string;
      uid: string;
      email: string;
      displayName: string;
      photoUrl: string;
    }
  ) => {
    const { profile, attempts } = await pullCloudUserProfile(fbIdentity.uid).catch(() => ({
      profile: null,
      attempts: [],
    }));

    const data = await apiFetch<{
      user: User;
      sessionToken?: string;
      accountPassport?: string;
      stats?: { totalPoints?: number; quizzesCompleted?: number; correctAnswers?: number };
    }>('/api/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({
        idToken: fbIdentity.idToken,
        cloudProfile: profile,
        cloudAttempts: attempts,
      }),
    });

    setStoredSessionToken(data.sessionToken);
    if (data.accountPassport && data.user?.email) {
      await saveUserPassport(data.user.email, data.accountPassport, true);
    }

    await syncCurrentUserToFirestore(data.user, data.stats).catch(() => {});

    if (data.user.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
      try {
        const cloudAccounts = await pullAllSchoolAccountsAsAdmin();
        const syncRes = await apiFetch<{
          localAccounts: SchoolAccountMirrorRow[];
        }>('/api/admin/cloud-sync', {
          method: 'POST',
          body: JSON.stringify({ cloudAccounts }),
        });
        if (syncRes.localAccounts?.length) {
          await pushSchoolAccountsAsAdmin(syncRes.localAccounts);
        }
      } catch {
        // non-fatal cloud mirror sync
      }
    }

    onAuthenticated(data.user);
  };

  const extractFirebaseAuthCode = (err: unknown): string => {
    const code =
      typeof (err as { code?: unknown })?.code === 'string'
        ? (err as { code: string }).code
        : '';
    if (code) return code;
    const msg = err instanceof Error ? err.message : '';
    const match = msg.match(/\((auth\/[^)]+)\)/);
    return match ? match[1] : '';
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      const fbIdentity = await signInWithGoogleCloud();
      await completeFirebaseSocialSignIn(fbIdentity);
    } catch (err) {
      const code = extractFirebaseAuthCode(err);
      const msg = err instanceof Error ? err.message : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('cancelled-popup-request')
      ) {
        setError(null);
      } else if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setError(t.auth.googleSignInFailed);
      } else if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(
          host
            ? `Domain "${host}" is not authorized in Firebase Authentication yet. Add it under Authentication → Settings → Authorized domains.`
            : t.auth.googleSignInFailed
        );
      } else {
        setError(msg || t.auth.googleSignInFailed);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setError(null);
    setInfo(null);
    setFacebookLoading(true);
    try {
      const fbIdentity = await signInWithFacebookCloud();
      await completeFirebaseSocialSignIn(fbIdentity);
    } catch (err) {
      const code = extractFirebaseAuthCode(err);
      const msg = err instanceof Error ? err.message : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        msg.includes('popup-closed-by-user') ||
        msg.includes('cancelled-popup-request')
      ) {
        setError(null);
      } else if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
        setError(t.auth.facebookProviderDisabled);
      } else if (
        code === 'auth/account-exists-with-different-credential' ||
        msg.includes('account-exists-with-different-credential')
      ) {
        setError(t.auth.socialAccountExistsDiffCredential);
      } else if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setError(t.auth.facebookSignInFailed);
      } else if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setError(
          host
            ? `Domain "${host}" is not authorized in Firebase Authentication yet. Add it under Authentication → Settings → Authorized domains.`
            : t.auth.facebookSignInFailed
        );
      } else {
        setError(msg || t.auth.facebookSignInFailed);
      }
    } finally {
      setFacebookLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const savedPassport = await getUserPassport(email);
      const data = await apiFetch<{
        user: User;
        sessionToken?: string;
        accountPassport?: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(savedPassport ? { passport: savedPassport } : {}),
        }),
      });
      setStoredSessionToken(data.sessionToken);
      if (data.accountPassport && data.user?.email) {
        await saveUserPassport(data.user.email, data.accountPassport, true);
      }
      if (data.user.role === 'teacher' || data.user.isAdmin) {
        await persistAdminVault(email, password, data.sessionToken);
      }
      onAuthenticated(data.user);
    } catch (err) {
      const isBootstrapPending =
        err instanceof ApiError && Boolean(err.data?.bootstrapPending);
      const isRecoverableMissing =
        err instanceof ApiError &&
        (Boolean(err.data?.dbEmpty) || isBootstrapPending);
      if (isRecoverableMissing) {
        if (err instanceof ApiError && Boolean(err.data?.dbEmpty)) {
          setServerDbEmpty(true);
        }
        const decryptedBackup = await decryptAdminVaultWithPassword(email, password);
        if (decryptedBackup) {
          setRestoringVault(true);
          try {
            const recovered = await apiFetch<{
              user: User;
              sessionToken?: string;
              accountPassport?: string;
            }>('/api/auth/recover-from-vault', {
              method: 'POST',
              body: JSON.stringify({
                email,
                password,
                backup: decryptedBackup,
              }),
            });
            setStoredSessionToken(recovered.sessionToken);
            if (recovered.accountPassport && recovered.user?.email) {
              await saveUserPassport(recovered.user.email, recovered.accountPassport, true);
            }
            await persistAdminVault(email, password, recovered.sessionToken);
            onAuthenticated(recovered.user);
            return;
          } catch (recoveryErr) {
            setError(
              recoveryErr instanceof Error
                ? recoveryErr.message
                : 'Unable to recover accounts from encrypted vault.'
            );
            return;
          } finally {
            setRestoringVault(false);
          }
        }
        if (isBootstrapPending && email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
          setError(t.auth.adminClaimPrompt);
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackupFileOnLogin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError(t.auth.enterAdminCredentialsForRestore);
      return;
    }

    setRestoringVault(true);
    setLoading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as unknown;
      const recovered = await apiFetch<{
        user: User;
        sessionToken?: string;
        accountPassport?: string;
      }>('/api/auth/recover-from-vault', {
        method: 'POST',
        body: JSON.stringify({ email, password, backup }),
      });
      setStoredSessionToken(recovered.sessionToken);
      if (recovered.accountPassport && recovered.user?.email) {
        await saveUserPassport(recovered.user.email, recovered.accountPassport, true);
      }
      await persistAdminVault(email, password, recovered.sessionToken);
      onAuthenticated(recovered.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore from backup file.');
    } finally {
      setRestoringVault(false);
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== registerConfirmPassword) {
      setError(t.auth.passwordsMismatch);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{
        user: User;
        sessionToken?: string;
        accountPassport?: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          birthday,
          password,
          confirmPassword: registerConfirmPassword,
        }),
      });
      setStoredSessionToken(data.sessionToken);
      if (data.accountPassport && data.user?.email) {
        await saveUserPassport(data.user.email, data.accountPassport, true);
      }
      if (data.user.role === 'teacher' || data.user.isAdmin) {
        await persistAdminVault(email, password, data.sessionToken);
      }
      onAuthenticated(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/forgot-password/request', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      });
      setInfo(data.message);
      setForgotStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, code: resetCode }),
      });
      setInfo(t.auth.verifiedMsg);
      setForgotStep('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (newPassword !== confirmPassword) {
      setError(t.auth.passwordsMismatch);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword }),
      });
      setInfo(data.message);
      setForgotStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const socialBusy = googleLoading || facebookLoading;

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAF8F5] text-[#1C1917]">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Editorial Brand Showcase (compact single-bar header on mobile, full showcase on desktop) */}
        <div className="lg:col-span-6 relative flex flex-col justify-between bg-[#6B1118] text-white px-4 py-2.5 sm:px-6 sm:py-3.5 lg:p-10 overflow-hidden">
          <img
            src={prismHeroImg}
            alt="Optical glass prism refracting light beam in a Grade 9 science studio"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#6B1118]/95 via-[#6B1118]/85 to-[#3E080C]/95 pointer-events-none" />

          {/* Top Bar on Left Showcase */}
          <div className="relative z-30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 lg:w-13 lg:h-13 rounded-lg sm:rounded-xl bg-white p-1 sm:p-1.5 shadow-sm shrink-0">
                <img
                  src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
                  alt="Grade 9 Hub Logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain rounded-md sm:rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base lg:text-lg font-bold tracking-tight text-white truncate">
                  {t.brand.appName}
                </p>
                <p className="text-[11px] sm:text-xs text-[#FBF4DF]/80 truncate">
                  <span className="lg:hidden">{t.auth.heroBadge}</span>
                  <span className="hidden lg:inline">{t.brand.schoolTag}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="lg:hidden flex items-center gap-1.5">
                <ThemeToggleButton compact tone="dark" />
                <LanguageSwitcher compact tone="dark" />
              </div>
              <PWAInstallButton compact />
            </div>
          </div>

          <div className="hidden lg:block relative z-10 my-auto max-w-xl">
            <p className="text-xs font-medium tracking-wider uppercase text-[#E5B742]">
              {t.auth.heroBadge}
            </p>
            <h1 className="mt-2.5 text-4xl xl:text-5xl font-bold leading-tight text-white [text-wrap:balance]">
              {t.auth.heroTitle}
            </h1>
            <p className="mt-3 text-sm xl:text-base text-[#FBF4DF]/85 leading-relaxed max-w-lg">
              {t.auth.heroDesc}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-5 text-sm">
              <div>
                <p className="text-xl font-bold text-[#E5B742] tabular-nums">11</p>
                <p className="text-xs text-[#FBF4DF]/80 mt-0.5">{t.auth.statChaptersLabel}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[#E5B742]">{t.auth.statDirectTitle}</p>
                <p className="text-xs text-[#FBF4DF]/80 mt-0.5">{t.auth.statDirectLabel}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[#E5B742]">PWA</p>
                <p className="text-xs text-[#FBF4DF]/80 mt-0.5">{t.auth.statPwaLabel}</p>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex relative z-10 items-center justify-between gap-4 text-xs text-[#FBF4DF]/75">
            <span>{t.brand.schoolTag}</span>
          </div>
        </div>

        {/* Right Authentication Form Panel */}
        <div className="lg:col-span-6 flex flex-col justify-between px-4 py-2.5 sm:px-8 sm:py-5 lg:px-10 lg:py-6 bg-[#FAF8F5]">
          {/* Top Theme & Language Controls on Desktop/Laptop */}
          <div className="hidden lg:flex relative z-30 items-center justify-end gap-2 mb-2">
            <ThemeToggleButton tone="light" />
            <LanguageSwitcher tone="light" />
          </div>

          <div className="my-auto w-full max-w-md mx-auto">
            {mode !== 'forgot' && (
              <div className="flex items-center gap-1 p-1 bg-[#EFE9DF] rounded-xl mb-3 sm:mb-4">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] sm:min-h-[40px] ${
                    mode === 'login'
                      ? 'bg-white text-[#6B1118] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {t.auth.loginTab}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`flex-1 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer min-h-[38px] sm:min-h-[40px] ${
                    mode === 'register'
                      ? 'bg-white text-[#6B1118] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {t.auth.registerTab}
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="mb-2.5 sm:mb-3 rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-xs sm:text-sm text-[#991B1B]"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {info && (
              <div
                role="status"
                className="mb-2.5 sm:mb-3 flex items-start gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-3 py-2 text-xs sm:text-sm text-[#065F46]"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{info}</span>
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-2.5 sm:space-y-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1917] leading-tight">
                    {t.auth.welcomeBack}
                  </h2>
                  <p className="text-xs text-[#57534E] mt-0.5">{t.auth.loginSubtitle}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    {t.auth.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@gmail.com"
                      dir="ltr"
                      className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3.5 py-2 sm:py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#1C1917]">
                      {t.auth.passwordLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-semibold text-[#6B1118] hover:underline cursor-pointer"
                    >
                      {t.auth.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-10 py-2 sm:py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || socialBusy}
                  className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors disabled:opacity-60 cursor-pointer min-h-[42px]"
                >
                  {restoringVault
                    ? t.auth.restoringFromVault
                    : loading
                    ? t.auth.signingIn
                    : t.auth.loginBtn}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-2 sm:space-y-2.5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1917] leading-tight">
                    {t.auth.createTitle}
                  </h2>
                  <p className="text-xs text-[#57534E] mt-0.5">{t.auth.createSubtitle}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                    {t.auth.fullNameLabel}
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t.auth.fullNameLabel}
                      className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3.5 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      {t.auth.emailRegisterLabel}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        dir="ltr"
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      {t.auth.birthdayLabel}
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split('T')[0]}
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        dir="ltr"
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      {t.auth.passwordCreateLabel}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-9 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                      {t.auth.confirmPasswordRegisterLabel}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={registerConfirmPassword}
                        onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                        placeholder={t.auth.confirmPasswordPlaceholder}
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3 py-2 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || socialBusy}
                  className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors disabled:opacity-60 cursor-pointer min-h-[42px]"
                >
                  {loading ? t.auth.creatingAccount : t.auth.registerBtn}
                </button>
              </form>
            )}

            {mode !== 'forgot' && (
              <div className="mt-2.5 sm:mt-3.5 space-y-2">
                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-[#E6DFD5]" />
                  <span className="shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-[#57534E]">
                    {t.auth.orEmailSeparator}
                  </span>
                  <div className="flex-grow border-t border-[#E6DFD5]" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={socialBusy || loading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#1C1917] hover:border-[#6B1118]/45 hover:bg-[#FAF8F5] shadow-xs transition-colors disabled:opacity-60 cursor-pointer min-h-[40px]"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.15H1.01v3.14C3.05 21.22 7.25 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.02 14.02c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.16H1.01C.37 7.45 0 8.88 0 10.36c0 1.48.37 2.91 1.01 4.2l4.01-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.25 0 3.05 2.78 1.01 6.84l4.01 3.14C6 6.94 8.75 4.75 12 4.75Z"
                    />
                  </svg>
                  <span>
                    {googleLoading ? t.auth.googleSignInLoading : t.auth.continueWithGoogle}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleFacebookSignIn}
                  disabled={socialBusy || loading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#1C1917] hover:border-[#1877F2]/55 hover:bg-[#FAF8F5] shadow-xs transition-colors disabled:opacity-60 cursor-pointer min-h-[40px]"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#1877F2"
                      d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.099 24 12.073Z"
                    />
                  </svg>
                  <span>
                    {facebookLoading ? t.auth.facebookSignInLoading : t.auth.continueWithFacebook}
                  </span>
                </button>

                {mode === 'login' && (
                  <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#57534E] text-center pt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                    <span>{t.auth.savedSessionNote}</span>
                  </p>
                )}

                {mode === 'login' && serverDbEmpty && (
                  <div className="mt-2 rounded-xl border border-[#D9A62E]/45 bg-[#FBF4DF]/70 p-3 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-[#6B1118]">
                      <Database className="w-4 h-4 text-[#D9A62E] shrink-0" />
                      <span>{t.auth.dbEmptyTitle}</span>
                    </div>
                    <p className="text-[#57534E] leading-relaxed">
                      {vaultSummary
                        ? formatMsg(t.auth.vaultDetectedDesc, { count: vaultSummary.usersCount })
                        : t.auth.dbEmptyDesc}
                    </p>
                    <label className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-[#6B1118]/30 bg-white px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[38px]">
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>{t.auth.restoreFromFileBtn}</span>
                      <input
                        type="file"
                        accept="application/json,.json"
                        disabled={loading}
                        onChange={handleRestoreBackupFileOnLogin}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {mode === 'forgot' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B1118] hover:underline cursor-pointer"
                >
                  <BackIcon className="w-3.5 h-3.5" />
                  <span>{t.auth.backToLogin}</span>
                </button>

                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#1C1917]">{t.auth.resetTitle}</h2>
                  <p className="text-xs sm:text-sm text-[#57534E] mt-0.5">{t.auth.resetSubtitle}</p>
                </div>

                {forgotStep === 'email' && (
                  <form onSubmit={handleRequestResetCode} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                        {t.auth.registeredGmailLabel}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="your.name@gmail.com"
                          dir="ltr"
                          className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors disabled:opacity-60 cursor-pointer min-h-[42px]"
                    >
                      {loading ? t.auth.sendingCode : t.auth.sendCodeBtn}
                    </button>
                  </form>
                )}

                {forgotStep === 'verify' && (
                  <form onSubmit={handleVerifyResetCode} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                        {t.auth.codeLabel}
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          pattern="\d{6}"
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          dir="ltr"
                          className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-9 pe-3.5 py-2.5 text-sm font-mono tracking-widest text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors disabled:opacity-60 cursor-pointer min-h-[42px]"
                    >
                      {loading ? t.auth.verifyingCode : t.auth.verifyCodeBtn}
                    </button>
                  </form>
                )}

                {forgotStep === 'reset' && (
                  <form onSubmit={handleResetPassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                        {t.auth.newPasswordLabel}
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                        {t.auth.confirmPasswordLabel}
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors disabled:opacity-60 cursor-pointer min-h-[42px]"
                    >
                      {loading ? t.auth.savingPassword : t.auth.savePasswordBtn}
                    </button>
                  </form>
                )}

                {forgotStep === 'done' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full rounded-xl bg-[#6B1118] py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[42px]"
                  >
                    {t.auth.returnLoginBtn}
                  </button>
                )}
              </div>
            )}
          </div>

          <footer className="pt-2.5 mt-2.5 sm:pt-3 sm:mt-4 text-center border-t border-[#E6DFD5]">
            <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-[#6B1118]">
              {t.brand.poweredBy}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};
