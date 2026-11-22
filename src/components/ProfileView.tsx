import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  Camera,
  CheckCircle2,
  Eye,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  X,
} from 'lucide-react';
import { apiFetch, getStoredSessionToken, setStoredCachedUser } from '../lib/api';
import {
  deleteCloudUserAsAdmin,
  deleteOwnCloudAccountData,
  MAIN_ADMIN_EMAIL,
} from '../lib/cloudAccounts';
import {
  initializeAdminVaultWithPassword,
  syncAdminVaultWithStoredKey,
  syncSessionBoundVault,
} from '../lib/recoveryVault';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';
import { AdminUserRecord, QuizAttempt, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { AvatarCropModal } from './AvatarCropModal';
import { formatUtcDate } from '../utils/dateFormat';

interface ProfileViewProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onAccountDeleted: () => Promise<void> | void;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  onEnablePush: () => Promise<boolean>;
  onDisablePush: () => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  onAccountDeleted,
  pushSupported,
  pushSubscribed,
  pushBusy,
  onEnablePush,
  onDisablePush,
}) => {
  const { language, t } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const isMainAdmin = user.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
  const [name, setName] = useState(user.name);
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [grade, setGrade] = useState(user.grade);
  const [bio, setBio] = useState(user.bio);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  // Self-account deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Admin User Management state
  const [allUsers, setAllUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState<
    'all' | 'students' | 'admins' | 'online' | 'restricted'
  >('all');
  const [inspectUser, setInspectUser] = useState<AdminUserRecord | null>(null);
  const [inspectName, setInspectName] = useState('');
  const [inspectGrade, setInspectGrade] = useState('');
  const [inspectBirthday, setInspectBirthday] = useState('');
  const [inspectBio, setInspectBio] = useState('');
  const [inspectRole, setInspectRole] = useState<'student' | 'teacher'>('student');
  const [inspectSaving, setInspectSaving] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const loadAdminUsers = async () => {
    if (!isPrivileged) return;
    setLoadingUsers(true);
    setAdminError(null);
    try {
      const data = await apiFetch<{ users: AdminUserRecord[] }>('/api/admin/users');
      setAllUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : t.profile.loadAccountsError);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    setName(user.name);
    setBirthday(user.birthday || '');
    setGrade(user.grade);
    setBio(user.bio);
  }, [user.name, user.birthday, user.grade, user.bio]);

  useEffect(() => {
    apiFetch<{ attempts: QuizAttempt[] }>(`/api/quizzes/history?lang=${language}`)
      .then((d) => setAttempts(d.attempts))
      .catch(() => {});
    if (isPrivileged) {
      void loadAdminUsers();
    }
  }, [isPrivileged, language, user.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const data = await apiFetch<{ user: User }>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          birthday,
          grade,
          bio,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      setStoredCachedUser(data.user);
      onUserUpdated(data.user);
      if (newPassword && isPrivileged) {
        try {
          const payload = await apiFetch<unknown>('/api/admin/backups/export');
          await initializeAdminVaultWithPassword(data.user.email, newPassword, payload);
          const token = getStoredSessionToken();
          if (token) {
            await syncSessionBoundVault(data.user.email, token, payload);
          }
        } catch {
          // ignore vault sync error
        }
      }
      setCurrentPassword('');
      setNewPassword('');
      setMsg(t.profile.updatedMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    setError(null);

    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      setError(t.profile.invalidImageType);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t.profile.imageTooLarge);
      return;
    }
    setPendingCropFile(file);
  };

  const handleCroppedAvatarConfirm = async (croppedFile: File) => {
    setAvatarBusy(true);
    setMsg(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', croppedFile);
      const data = await apiFetch<{ user: User }>('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      setStoredCachedUser(data.user);
      onUserUpdated(data.user);
      if (data.user.role === 'teacher' || data.user.isAdmin) {
        apiFetch<unknown>('/api/admin/backups/export')
          .then(async (payload) => {
            await syncAdminVaultWithStoredKey(data.user.email, payload);
            const token = getStoredSessionToken();
            if (token) {
              await syncSessionBoundVault(data.user.email, token, payload);
            }
          })
          .catch(() => {});
      }
      setPendingCropFile(null);
      setMsg(t.profile.avatarUpdatedMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile picture.');
      setPendingCropFile(null);
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarBusy(true);
    setMsg(null);
    setError(null);
    try {
      const data = await apiFetch<{ user: User }>('/api/profile/avatar', {
        method: 'DELETE',
      });
      setStoredCachedUser(data.user);
      onUserUpdated(data.user);
      if (data.user.role === 'teacher' || data.user.isAdmin) {
        apiFetch<unknown>('/api/admin/backups/export')
          .then(async (payload) => {
            await syncAdminVaultWithStoredKey(data.user.email, payload);
            const token = getStoredSessionToken();
            if (token) {
              await syncSessionBoundVault(data.user.email, token, payload);
            }
          })
          .catch(() => {});
      }
      setMsg(t.profile.avatarRemovedMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove profile picture.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleToggleUserRole = async (target: AdminUserRecord) => {
    setAdminMsg(null);
    setAdminError(null);
    if (target.id === user.id || target.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) return;
    const nextRole = target.role === 'teacher' ? 'student' : 'teacher';
    try {
      await apiFetch(`/api/admin/users/${target.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({
          role: nextRole,
          isAdmin: nextRole === 'teacher',
        }),
      });
      setAdminMsg(
        formatMsg(t.profile.roleUpdatedMsg, {
          name: target.name,
          role: nextRole === 'teacher' ? t.profile.adminTeacherTag : t.profile.studentTag,
        })
      );
      await loadAdminUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleDeleteUser = async (targetId: number) => {
    setAdminMsg(null);
    setAdminError(null);
    const targetUser = allUsers.find((u) => u.id === targetId);
    try {
      await apiFetch(`/api/admin/users/${targetId}`, { method: 'DELETE' });
      if (targetUser?.email) {
        await deleteCloudUserAsAdmin(targetUser.email).catch(() => {});
      }
      setConfirmDeleteUserId(null);
      if (inspectUser?.id === targetId) setInspectUser(null);
      setAdminMsg(t.profile.accountRemovedMsg);
      await loadAdminUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  };

  const openInspectModal = async (target: AdminUserRecord) => {
    setInspectUser(target);
    setInspectName(target.name);
    setInspectGrade(target.grade || '');
    setInspectBirthday(target.birthday || '');
    setInspectBio(target.bio || '');
    setInspectRole(target.role);
    setInspectError(null);
    try {
      const detail = await apiFetch<{ user: AdminUserRecord }>(`/api/admin/users/${target.id}`);
      if (detail?.user) {
        setInspectUser(detail.user);
        setInspectName(detail.user.name);
        setInspectGrade(detail.user.grade || '');
        setInspectBirthday(detail.user.birthday || '');
        setInspectBio(detail.user.bio || '');
        setInspectRole(detail.user.role);
      }
    } catch {
      // Keep summary record if detail lookup is unavailable
    }
  };

  const handleSaveInspectUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectUser || inspectSaving) return;
    setInspectSaving(true);
    setInspectError(null);
    setAdminMsg(null);
    const isTargetMain = inspectUser.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
    const isSelf = inspectUser.id === user.id;
    try {
      const payload: Record<string, unknown> = {
        name: inspectName.trim(),
        grade: inspectGrade.trim(),
        birthday: inspectBirthday.trim(),
        bio: inspectBio.trim(),
      };
      if (!isTargetMain && !isSelf) {
        payload.role = inspectRole;
        payload.isAdmin = inspectRole === 'teacher';
      }
      const res = await apiFetch<{ user: AdminUserRecord }>(`/api/admin/users/${inspectUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const updated = res.user;
      setInspectUser(updated);
      setAllUsers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      if (isSelf) {
        const mergedSelf: User = {
          ...user,
          name: updated.name,
          grade: updated.grade,
          birthday: updated.birthday,
          bio: updated.bio ?? user.bio,
        };
        setStoredCachedUser(mergedSelf);
        onUserUpdated(mergedSelf);
      }
      setAdminMsg(t.profile.accountUpdatedMsg);
      await loadAdminUsers();
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setInspectSaving(false);
    }
  };

  const handleToggleAccountRestrict = async (target: AdminUserRecord) => {
    if (target.id === user.id || target.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) return;
    setAdminMsg(null);
    setAdminError(null);
    const nextRestricted = !Boolean(target.isRestricted);
    try {
      await apiFetch(`/api/admin/users/${target.id}/restrict`, {
        method: 'PUT',
        body: JSON.stringify({
          restricted: nextRestricted,
          reason: nextRestricted ? t.community.restrictedBannerDefault : '',
        }),
      });
      if (inspectUser?.id === target.id) {
        setInspectUser((prev) =>
          prev
            ? {
                ...prev,
                isRestricted: nextRestricted,
                restrictionReason: nextRestricted ? t.community.restrictedBannerDefault : '',
              }
            : null
        );
      }
      setAdminMsg(t.profile.accountUpdatedMsg);
      await loadAdminUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to update restriction status.');
    }
  };

  const filteredAdminUsers = allUsers.filter((u) => {
    const q = accountSearch.trim().toLowerCase();
    if (q) {
      const hit =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.grade || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (accountFilter === 'students') return u.role !== 'teacher' && !u.isAdmin;
    if (accountFilter === 'admins') return u.role === 'teacher' || Boolean(u.isAdmin);
    if (accountFilter === 'online') return Boolean(u.online);
    if (accountFilter === 'restricted') return Boolean(u.isRestricted);
    return true;
  });

  const handleConfirmDeleteOwnAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMainAdmin || deletingAccount) return;
    if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE') {
      setDeleteAccountError(t.profile.deleteAccountTypeLabel);
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      await apiFetch('/api/profile', {
        method: 'DELETE',
        body: JSON.stringify({ confirmationText: deleteConfirmInput.trim() }),
      });
      await deleteOwnCloudAccountData(user.email).catch(() => {});
      setDeleteModalOpen(false);
      setDeleteConfirmInput('');
      await onAccountDeleted();
    } catch (err) {
      setDeleteAccountError(
        err instanceof Error ? err.message : 'Failed to delete your account.'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.profile.title}</h2>
        <p className="text-sm text-[#57534E] mt-1">{t.profile.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between border-b border-[#E6DFD5] pb-4 gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatar_url}
                sizeClass="w-16 h-16"
                textClass="text-xl"
                borderClass="border-2 border-[#6B1118]/30"
              />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#1C1917] truncate">{user.name}</h3>
                <p className="text-xs text-[#57534E] truncate">
                  {user.email} ·{' '}
                  {user.isAdmin || user.email.toLowerCase() === 'mohamdm791@gmail.com'
                    ? t.profile.mainAdminLabel
                    : user.role === 'teacher'
                    ? t.profile.teacherAccount
                    : t.profile.studentAccount}
                </p>
              </div>
            </div>
            {(user.isAdmin || user.email.toLowerCase() === 'mohamdm791@gmail.com') && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B1118] bg-[#FBF4DF] border border-[#D9A62E]/40 rounded-lg px-2.5 py-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-[#D9A62E]" />
                <span>{t.profile.adminBadge}</span>
              </span>
            )}
          </div>

          {/* Profile Picture Upload / Removal */}
          <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1C1917]">{t.profile.avatarTitle}</p>
              <p className="text-xs text-[#57534E] mt-0.5">{t.profile.avatarDesc}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[38px]">
                <Camera className="w-3.5 h-3.5 text-[#E5B742]" />
                <span>
                  {avatarBusy
                    ? t.profile.uploadingAvatar
                    : user.avatar_url
                    ? t.profile.changeAvatar
                    : t.profile.uploadAvatar}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  disabled={avatarBusy}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              {user.avatar_url && (
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={handleAvatarRemove}
                  className="inline-flex items-center gap-1 rounded-xl border border-[#E6DFD5] bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:border-[#DC2626] cursor-pointer min-h-[38px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.profile.removeAvatar}</span>
                </button>
              )}
            </div>
          </div>

          {msg && (
            <div className="flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{msg}</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1C1917] mb-1">
              {t.profile.fullName}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.profile.birthdayLabel}
              </label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.profile.gradeFocus}
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder={t.auth.gradePlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1C1917] mb-1">
              {t.profile.bio}
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm"
            />
          </div>

          <div className="pt-2 border-t border-[#E6DFD5] space-y-3">
            <p className="text-xs font-semibold text-[#57534E]">{t.profile.changePasswordOpt}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t.profile.currentPassPlaceholder}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.profile.newPassPlaceholder}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
          >
            <Save className="w-4 h-4 text-[#E5B742]" />
            <span>{saving ? t.profile.saving : t.profile.saveChanges}</span>
          </button>
        </form>

        <div className="lg:col-span-6 space-y-5">
          {pushSupported && (
            <div className="rounded-2xl bg-white border border-[#E6DFD5] p-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#1C1917]">{t.profile.pushTitle}</h3>
                <p className="text-xs text-[#57534E] mt-1">{t.profile.pushDesc}</p>
              </div>
              <button
                type="button"
                disabled={pushBusy}
                onClick={pushSubscribed ? onDisablePush : onEnablePush}
                className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer min-h-[44px] ${
                  pushSubscribed
                    ? 'border border-[#E6DFD5] text-[#1C1917]'
                    : 'bg-[#6B1118] text-white'
                }`}
              >
                <Bell className="w-4 h-4 text-[#E5B742]" />
                <span>{pushSubscribed ? t.profile.disablePush : t.profile.enablePush}</span>
              </button>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-[#E6DFD5] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-[#D9A62E]" />
              <h3 className="text-lg font-bold text-[#1C1917]">{t.profile.recentAttempts}</h3>
            </div>

            {attempts.length === 0 ? (
              <p className="text-sm text-[#57534E] py-6 text-center">{t.profile.noAttempts}</p>
            ) : (
              <div className="divide-y divide-[#E6DFD5]">
                {attempts.map((a) => (
                  <div key={a.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-[#1C1917]">
                        {a.mode === 'all_chapters'
                          ? t.profile.allChaptersCombined
                          : a.mode === 'general'
                          ? t.profile.generalQuestionsLabel
                          : `${t.home.chapterWord} ${a.chapter_number}${
                              a.chapter_title ? `: ${a.chapter_title}` : ''
                            }`}
                      </p>
                      <p className="text-xs text-[#57534E] tabular-nums">
                        {formatUtcDate(a.created_at)}
                      </p>
                    </div>
                    <div className="text-end tabular-nums">
                      <p className="font-bold text-[#6B1118]">{a.score_percent}%</p>
                      <p className="text-xs text-[#57534E]">
                        {a.correct_count}/{a.total_questions}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger Zone: Permanent Account Deletion */}
          <div className="rounded-2xl bg-white border border-[#DC2626]/30 p-6 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#991B1B]">{t.profile.dangerZoneTitle}</h3>
                <p className="text-xs text-[#57534E] mt-1 leading-relaxed">
                  {isMainAdmin ? t.profile.protectedAdminDeleteNote : t.profile.dangerZoneDesc}
                </p>
              </div>
            </div>

            {!isMainAdmin && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmInput('');
                    setDeleteAccountError(null);
                    setDeleteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#DC2626]/40 bg-[#FEF2F2] px-4 py-2.5 text-xs font-bold text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer min-h-[42px]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t.profile.deleteAccountBtn}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Administrator Controls: User & Permission Management */}
      {isPrivileged && (
        <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DFD5] pb-4">
            <div className="flex items-center gap-2.5">
              <UserCog className="w-5 h-5 text-[#6B1118]" />
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">
                  {t.profile.adminControlsTitle}
                </h3>
                <p className="text-xs text-[#57534E]">{t.profile.adminControlsDesc}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-[#57534E] tabular-nums">
                {allUsers.length} {t.profile.accountsCount}
              </span>
              <button
                type="button"
                disabled={loadingUsers}
                onClick={() => void loadAdminUsers()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] disabled:opacity-50 cursor-pointer min-h-[36px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                <span>{t.profile.refreshAccountsBtn}</span>
              </button>
            </div>
          </div>

          {/* Search & Account Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#57534E] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder={t.profile.searchAccountsPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  {
                    id: 'all',
                    label: `${t.profile.filterAllAccounts} (${allUsers.length})`,
                  },
                  {
                    id: 'students',
                    label: `${t.profile.filterStudentsOnly} (${
                      allUsers.filter((u) => u.role !== 'teacher' && !u.isAdmin).length
                    })`,
                  },
                  {
                    id: 'admins',
                    label: `${t.profile.filterAdminsOnly} (${
                      allUsers.filter((u) => u.role === 'teacher' || u.isAdmin).length
                    })`,
                  },
                  {
                    id: 'online',
                    label: `${t.profile.filterOnlineOnly} (${
                      allUsers.filter((u) => Boolean(u.online)).length
                    })`,
                  },
                  {
                    id: 'restricted',
                    label: `${t.profile.filterRestrictedOnly} (${
                      allUsers.filter((u) => Boolean(u.isRestricted)).length
                    })`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAccountFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    accountFilter === f.id
                      ? 'bg-[#6B1118] text-white'
                      : 'border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {adminMsg && (
            <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46] flex items-center justify-between gap-2">
              <span>{adminMsg}</span>
              <button
                type="button"
                onClick={() => setAdminMsg(null)}
                className="p-0.5 cursor-pointer"
                aria-label={t.profile.cancel}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {adminError && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B] flex items-center justify-between gap-2">
              <span>{adminError}</span>
              <button
                type="button"
                onClick={() => setAdminError(null)}
                className="p-0.5 cursor-pointer"
                aria-label={t.profile.cancel}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {loadingUsers && allUsers.length === 0 ? (
            <p className="text-sm text-[#57534E] py-4">{t.profile.loadingAccounts}</p>
          ) : filteredAdminUsers.length === 0 ? (
            <p className="text-sm text-[#57534E] py-4">{t.profile.noAccounts}</p>
          ) : (
            <div className="divide-y divide-[#E6DFD5]">
              {filteredAdminUsers.map((u) => {
                const isMain = u.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
                const isSelf = u.id === user.id;
                return (
                  <div
                    key={`${u.id}-${u.email}`}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          name={u.name}
                          avatarUrl={u.avatar_url}
                          sizeClass="w-10 h-10"
                          textClass="text-xs"
                        />
                        <span
                          aria-label={u.online ? t.admin.onlineLabel : t.admin.offlineLabel}
                          className={`absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                            u.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#1C1917]">{u.name}</p>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              u.online
                                ? 'bg-[#ECFDF5] text-[#065F46]'
                                : 'bg-[#FAF8F5] text-[#57534E]'
                            }`}
                          >
                            {u.online ? t.admin.onlineLabel : t.admin.offlineLabel}
                          </span>
                          {isMain ? (
                            <span className="text-[11px] font-bold text-[#6B1118] bg-[#FBF4DF] border border-[#D9A62E]/40 rounded px-2 py-0.5">
                              {t.profile.mainAdminTag}
                            </span>
                          ) : u.role === 'teacher' || u.isAdmin ? (
                            <span className="text-[11px] font-semibold text-[#065F46] bg-[#ECFDF5] border border-[#059669]/30 rounded px-2 py-0.5">
                              {t.profile.adminTeacherTag}
                            </span>
                          ) : (
                            <span className="text-[11px] font-medium text-[#57534E]">
                              {t.profile.studentTag}
                            </span>
                          )}
                          {u.isRestricted && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626]">
                              {t.admin.restrictedBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#57534E] truncate">
                          {u.email}
                          {u.grade ? ` · ${u.grade}` : ''}
                          {typeof u.quizzesCompleted === 'number' && u.quizzesCompleted > 0
                            ? ` · ${u.quizzesCompleted} ${t.admin.quizzesCompleted} (${u.avgScorePercent ?? 0}%)`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void openInspectModal(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[36px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t.profile.inspectEditBtn}</span>
                      </button>

                      {!isMain && !isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleToggleUserRole(u)}
                            className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[36px]"
                          >
                            {u.role === 'teacher' ? t.profile.setStudent : t.profile.makeAdmin}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleAccountRestrict(u)}
                            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer min-h-[36px] ${
                              u.isRestricted
                                ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
                                : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
                            }`}
                          >
                            {u.isRestricted ? t.admin.unrestrictBtn : t.admin.restrictBtn}
                          </button>

                          {confirmDeleteUserId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleDeleteUser(u.id)}
                                className="rounded-lg bg-[#DC2626] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer min-h-[36px]"
                              >
                                {t.profile.confirm}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="rounded-lg border border-[#E6DFD5] px-2.5 py-1.5 text-xs text-[#57534E] cursor-pointer min-h-[36px]"
                              >
                                {t.profile.cancel}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(u.id)}
                              aria-label={`Remove ${u.name}`}
                              className="p-2 text-[#57534E] hover:text-[#DC2626] rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Interactive Avatar Crop & Resize Modal */}
      {pendingCropFile && (
        <AvatarCropModal
          file={pendingCropFile}
          busy={avatarBusy}
          onCancel={() => {
            if (!avatarBusy) setPendingCropFile(null);
          }}
          onConfirm={handleCroppedAvatarConfirm}
        />
      )}

      {/* Self-Account Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-own-account-title"
          onClick={() => {
            if (!deletingAccount) setDeleteModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmDeleteOwnAccount}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1A1A] border border-[#E6DFD5] dark:border-[#342D2D] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] dark:border-[#342D2D] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#DC2626]/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3
                  id="delete-own-account-title"
                  className="text-base font-bold text-[#1C1917] dark:text-[#F5EFE9]"
                >
                  {t.profile.deleteAccountModalTitle}
                </h3>
              </div>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteModalOpen(false)}
                aria-label={t.profile.cancel}
                className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#B8AEA5] leading-relaxed">
              {t.profile.deleteAccountWarning}
            </p>

            {deleteAccountError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]">
                {deleteAccountError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9]">
                {t.profile.deleteAccountTypeLabel}
              </label>
              <input
                type="text"
                autoFocus
                required
                dir="ltr"
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                placeholder={t.profile.deleteAccountPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer min-h-[40px]"
              >
                {t.profile.cancel}
              </button>
              <button
                type="submit"
                disabled={
                  deletingAccount || deleteConfirmInput.trim().toUpperCase() !== 'DELETE'
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 cursor-pointer min-h-[40px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deletingAccount ? t.profile.deletingAccount : t.profile.confirmDeleteAccountBtn}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inspect & Edit Registered Account Modal */}
      {inspectUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-account-title"
          onClick={() => {
            if (!inspectSaving) setInspectUser(null);
          }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveInspectUser}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1E1A1A] border border-[#E6DFD5] dark:border-[#342D2D] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] dark:border-[#342D2D] pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <UserAvatar
                    name={inspectUser.name}
                    avatarUrl={inspectUser.avatar_url}
                    sizeClass="w-12 h-12"
                    textClass="text-base"
                  />
                  <span
                    className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-white ${
                      inspectUser.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h3
                    id="inspect-account-title"
                    className="text-base font-bold text-[#1C1917] dark:text-[#F5EFE9] truncate"
                  >
                    {t.profile.inspectModalTitle}
                  </h3>
                  <p className="text-xs text-[#57534E] truncate">{inspectUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={inspectSaving}
                onClick={() => setInspectUser(null)}
                aria-label={t.profile.cancel}
                className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metadata & Activity KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-2.5">
                <p className="text-[#57534E]">{t.admin.quizzesCompleted}</p>
                <p className="mt-0.5 font-bold text-[#6B1118] tabular-nums">
                  {inspectUser.quizzesCompleted ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-2.5">
                <p className="text-[#57534E]">{t.admin.correctAnswers}</p>
                <p className="mt-0.5 font-bold text-[#1C1917] tabular-nums">
                  {inspectUser.correctAnswers ?? 0}/{inspectUser.questionsAnswered ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-2.5">
                <p className="text-[#57534E]">{t.admin.avgScore}</p>
                <p className="mt-0.5 font-bold text-[#059669] tabular-nums">
                  {inspectUser.avgScorePercent ?? 0}%
                </p>
              </div>
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-2.5">
                <p className="text-[#57534E]">{t.admin.aiTutorTurns}</p>
                <p className="mt-0.5 font-bold text-[#1C1917] tabular-nums">
                  {inspectUser.aiTutorTurns ?? 0}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#57534E] bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl px-3 py-2">
              {inspectUser.source && (
                <span>
                  {t.profile.sourceLabel}: <strong className="uppercase">{inspectUser.source}</strong>
                </span>
              )}
              <span>
                {t.profile.joinedLabel}: {formatUtcDate(inspectUser.created_at)}
              </span>
              {inspectUser.lastLoginAt && (
                <span>
                  {t.admin.lastLogin}: {formatUtcDate(inspectUser.lastLoginAt)}
                </span>
              )}
            </div>

            {inspectError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]">
                {inspectError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                  {t.profile.fullName}
                </label>
                <input
                  type="text"
                  required
                  value={inspectName}
                  onChange={(e) => setInspectName(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                    {t.profile.gradeFocus}
                  </label>
                  <input
                    type="text"
                    value={inspectGrade}
                    onChange={(e) => setInspectGrade(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                    {t.profile.birthdayLabel}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    max={new Date().toISOString().split('T')[0]}
                    value={inspectBirthday}
                    onChange={(e) => setInspectBirthday(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                  {t.profile.roleLabel}
                </label>
                <select
                  value={inspectRole}
                  disabled={
                    inspectUser.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL ||
                    inspectUser.id === user.id
                  }
                  onChange={(e) => setInspectRole(e.target.value as 'student' | 'teacher')}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917] disabled:opacity-60"
                >
                  <option value="student">{t.profile.studentTag}</option>
                  <option value="teacher">{t.profile.adminTeacherTag}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                  {t.profile.bio}
                </label>
                <textarea
                  rows={2}
                  value={inspectBio}
                  onChange={(e) => setInspectBio(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6DFD5]">
              {inspectUser.email.trim().toLowerCase() !== MAIN_ADMIN_EMAIL &&
              inspectUser.id !== user.id ? (
                <button
                  type="button"
                  onClick={() => void handleToggleAccountRestrict(inspectUser)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer min-h-[38px] ${
                    inspectUser.isRestricted
                      ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
                      : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    {inspectUser.isRestricted ? t.admin.unrestrictBtn : t.admin.restrictBtn}
                  </span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={inspectSaving}
                  onClick={() => setInspectUser(null)}
                  className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer min-h-[40px]"
                >
                  {t.profile.cancel}
                </button>
                <button
                  type="submit"
                  disabled={inspectSaving || !inspectName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  <Save className="w-3.5 h-3.5 text-[#E5B742]" />
                  <span>{inspectSaving ? t.profile.saving : t.profile.saveChanges}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
