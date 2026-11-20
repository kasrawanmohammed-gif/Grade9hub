import React, { useEffect, useState } from 'react';
import { Award, Bell, Camera, CheckCircle2, Save, Shield, Trash2, UserCog } from 'lucide-react';
import { apiFetch, getStoredSessionToken, setStoredCachedUser } from '../lib/api';
import {
  initializeAdminVaultWithPassword,
  syncAdminVaultWithStoredKey,
  syncSessionBoundVault,
} from '../lib/recoveryVault';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';
import { AdminUserRecord, QuizAttempt, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { formatUtcDate } from '../utils/dateFormat';

interface ProfileViewProps {
  user: User;
  onUserUpdated: (user: User) => void;
  pushSupported: boolean;
  pushSubscribed: boolean;
  pushBusy: boolean;
  onEnablePush: () => Promise<boolean>;
  onDisablePush: () => Promise<void>;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  pushSupported,
  pushSubscribed,
  pushBusy,
  onEnablePush,
  onDisablePush,
}) => {
  const { language, t } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const [name, setName] = useState(user.name);
  const [birthday, setBirthday] = useState(user.birthday || '');
  const [grade, setGrade] = useState(user.grade);
  const [bio, setBio] = useState(user.bio);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);

  // Admin User Management state
  const [allUsers, setAllUsers] = useState<AdminUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);

  const loadAdminUsers = async () => {
    if (!isPrivileged) return;
    setLoadingUsers(true);
    try {
      const data = await apiFetch<{ users: AdminUserRecord[] }>('/api/admin/users');
      setAllUsers(data.users);
    } catch {
      // ignore
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setMsg(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
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
      setMsg(t.profile.avatarUpdatedMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload profile picture.');
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
    try {
      await apiFetch(`/api/admin/users/${targetId}`, { method: 'DELETE' });
      setConfirmDeleteUserId(null);
      setAdminMsg(t.profile.accountRemovedMsg);
      await loadAdminUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to delete user.');
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
                  accept="image/*"
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
            <span className="text-xs font-semibold text-[#57534E] tabular-nums">
              {allUsers.length} {t.profile.accountsCount}
            </span>
          </div>

          {adminMsg && (
            <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46]">
              {adminMsg}
            </div>
          )}
          {adminError && (
            <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]">
              {adminError}
            </div>
          )}

          {loadingUsers ? (
            <p className="text-sm text-[#57534E] py-4">{t.profile.loadingAccounts}</p>
          ) : allUsers.length === 0 ? (
            <p className="text-sm text-[#57534E] py-4">{t.profile.noAccounts}</p>
          ) : (
            <div className="divide-y divide-[#E6DFD5]">
              {allUsers.map((u) => {
                const isMain = u.email.toLowerCase() === 'mohamdm791@gmail.com';
                return (
                  <div
                    key={u.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#1C1917]">{u.name}</p>
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
                      </div>
                      <p className="text-xs text-[#57534E] truncate">
                        {u.email}
                        {u.grade ? ` · ${u.grade}` : ''}
                      </p>
                    </div>

                    {!isMain && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleUserRole(u)}
                          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[36px]"
                        >
                          {u.role === 'teacher' ? t.profile.setStudent : t.profile.makeAdmin}
                        </button>

                        {u.id !== user.id &&
                          (confirmDeleteUserId === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
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
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
