import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  Flame,
  Globe,
  HelpCircle,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { apiFetch, getStoredSessionToken } from '../lib/api';
import { deleteCloudUserAsAdmin, MAIN_ADMIN_EMAIL } from '../lib/cloudAccounts';
import { syncAdminVaultWithStoredKey, syncSessionBoundVault } from '../lib/recoveryVault';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';
import { ScientificText } from './ScientificText';
import { UserAvatar } from './UserAvatar';
import { formatUtcDate, formatUtcDateTime } from '../utils/dateFormat';
import {
  AdminBackupsResponse,
  AdminCommunityOverview,
  AdminDashboardSnapshot,
  AdminDmConversationSummary,
  AdminSearchResults,
  AdminStudentDetailResponse,
  AdminStudentPerformance,
  AdminUserRecord,
  Announcement,
  AppSettings,
  BackupFileInfo,
  CommunityDirectMessage,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMessage,
  CommunityReport,
  DatabaseHealthStats,
  StudentActivityLog,
  TabId,
  User,
} from '../types';
import type { LiveCommunityEvent } from './CommunityView';

interface AdminDashboardViewProps {
  currentUser: User;
  snapshot: AdminDashboardSnapshot | null;
  wsConnected: boolean;
  focusSearchTrigger?: number;
  liveEvent?: LiveCommunityEvent | null;
  appSettings?: AppSettings | null;
  onSettingsUpdated?: (settings: AppSettings) => void;
  onRefreshDashboard: () => Promise<void>;
  onNavigate: (tab: TabId) => void;
  onSelectChapter: (chapterNumber: number | 'all') => void;
  onOpenStudentChat: (studentId: number) => void;
}

type SearchScopeFilter = 'all' | 'students' | 'questions' | 'chapters' | 'messages';
type MonitoringTab =
  | 'overview'
  | 'accounts'
  | 'dms'
  | 'groups'
  | 'logs'
  | 'moderation'
  | 'content'
  | 'settings'
  | 'backups';

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  snapshot,
  wsConnected,
  focusSearchTrigger,
  liveEvent,
  appSettings,
  onSettingsUpdated,
  onRefreshDashboard,
  onNavigate,
  onSelectChapter,
  onOpenStudentChat,
}) => {
  const { language, t } = useLanguage();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchScopeFilter>('all');
  const [searchResults, setSearchResults] = useState<AdminSearchResults | null>(null);
  const [searching, setSearching] = useState(false);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentDetail, setStudentDetail] = useState<AdminStudentDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Community Monitoring & Moderation State
  const [monitoringTab, setMonitoringTab] = useState<MonitoringTab>('overview');
  const [communityOverview, setCommunityOverview] = useState<AdminCommunityOverview | null>(null);

  const [dmQuery, setDmQuery] = useState('');
  const [dmConversations, setDmConversations] = useState<AdminDmConversationSummary[]>([]);
  const [selectedDmPair, setSelectedDmPair] = useState<{ userAId: number; userBId: number; label: string } | null>(null);
  const [dmThreadMessages, setDmThreadMessages] = useState<CommunityDirectMessage[]>([]);

  const [adminGroups, setAdminGroups] = useState<CommunityGroup[]>([]);
  const [selectedAdminGroupId, setSelectedAdminGroupId] = useState<number | null>(null);
  const [adminGroupMembers, setAdminGroupMembers] = useState<CommunityGroupMember[]>([]);
  const [adminGroupMessages, setAdminGroupMessages] = useState<CommunityGroupMessage[]>([]);

  const [activityLogs, setActivityLogs] = useState<StudentActivityLog[]>([]);
  const [logQuery, setLogQuery] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('all');

  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'open' | 'resolved' | 'dismissed'>('all');

  const [restrictTarget, setRestrictTarget] = useState<{ id: number; name: string } | null>(null);
  const [restrictReason, setRestrictReason] = useState('');
  const [restrictBusy, setRestrictBusy] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  // Safe Account Deletion State
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountActionMsg, setAccountActionMsg] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);

  // Registered Accounts & Profile Edit State
  const [registeredUsers, setRegisteredUsers] = useState<AdminUserRecord[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountQuery, setAccountQuery] = useState('');
  const [accountFilter, setAccountFilter] = useState<
    'all' | 'students' | 'admins' | 'online' | 'restricted'
  >('all');
  const [editUserTarget, setEditUserTarget] = useState<AdminUserRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRole, setEditRole] = useState<'student' | 'teacher'>('student');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Content & Announcements Quick Control State
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annType, setAnnType] = useState<'announcement' | 'material'>('announcement');
  const [annSaving, setAnnSaving] = useState(false);
  const [annError, setAnnError] = useState<string | null>(null);

  // Global App Settings State
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>({
    allowStudentRegistration: appSettings?.allowStudentRegistration ?? true,
    communityEnabled: appSettings?.communityEnabled ?? true,
    communityPostingEnabled: appSettings?.communityPostingEnabled ?? true,
    aiTutorEnabled: appSettings?.aiTutorEnabled ?? true,
    defaultLanguage: appSettings?.defaultLanguage ?? 'en',
    maintenanceMessage: appSettings?.maintenanceMessage ?? '',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Database Backup & Recovery State
  const [dbStats, setDbStats] = useState<DatabaseHealthStats | null>(null);
  const [backupsList, setBackupsList] = useState<BackupFileInfo[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [pendingReplaceConfirm, setPendingReplaceConfirm] = useState<
    { type: 'file'; filename: string } | { type: 'upload'; payload: unknown; label: string } | null
  >(null);

  const fetchCommunityOverview = async () => {
    try {
      const data = await apiFetch<AdminCommunityOverview>('/api/admin/community/overview');
      setCommunityOverview(data);
    } catch {
      // ignore
    }
  };

  const fetchDmConversations = async (qStr = dmQuery) => {
    try {
      const data = await apiFetch<{ conversations: AdminDmConversationSummary[] }>(
        `/api/admin/community/dm-conversations${qStr.trim() ? `?q=${encodeURIComponent(qStr.trim())}` : ''}`
      );
      setDmConversations(data.conversations);
    } catch {
      // ignore
    }
  };

  const fetchDmThread = async (userA: number, userB: number) => {
    try {
      const data = await apiFetch<{ messages: CommunityDirectMessage[] }>(
        `/api/admin/community/dm-thread?userA=${userA}&userB=${userB}`
      );
      setDmThreadMessages(data.messages);
    } catch {
      setDmThreadMessages([]);
    }
  };

  const fetchAdminGroups = async () => {
    try {
      const data = await apiFetch<{ groups: CommunityGroup[] }>('/api/community/groups');
      setAdminGroups(data.groups);
    } catch {
      // ignore
    }
  };

  const fetchAdminGroupDetail = async (groupId: number) => {
    try {
      const data = await apiFetch<{
        members: CommunityGroupMember[];
        messages: CommunityGroupMessage[];
      }>(`/api/community/groups/${groupId}/messages`);
      setAdminGroupMembers(data.members);
      setAdminGroupMessages(data.messages);
    } catch {
      setAdminGroupMembers([]);
      setAdminGroupMessages([]);
    }
  };

  const fetchActivityLogs = async (qStr = logQuery, actionStr = logActionFilter) => {
    try {
      const params = new URLSearchParams();
      if (qStr.trim()) params.set('q', qStr.trim());
      if (actionStr && actionStr !== 'all') params.set('action', actionStr);
      params.set('limit', '120');
      const data = await apiFetch<{ logs: StudentActivityLog[] }>(
        `/api/admin/activity-logs?${params.toString()}`
      );
      setActivityLogs(data.logs);
    } catch {
      // ignore
    }
  };

  const fetchReports = async (statusStr = reportStatusFilter) => {
    try {
      const data = await apiFetch<{ reports: CommunityReport[] }>(
        `/api/admin/moderation/reports?status=${statusStr}`
      );
      setReports(data.reports);
    } catch {
      // ignore
    }
  };

  const fetchBackups = async () => {
    try {
      const data = await apiFetch<AdminBackupsResponse>('/api/admin/backups');
      setDbStats(data.stats);
      setBackupsList(data.backups);
    } catch {
      // ignore
    }
  };

  const fetchRegisteredUsers = async () => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const data = await apiFetch<{ users: AdminUserRecord[] }>('/api/admin/users');
      setRegisteredUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : t.profile.loadAccountsError);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchAdminAnnouncements = async () => {
    try {
      const data = await apiFetch<{ announcements: Announcement[] }>('/api/announcements');
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
    } catch {
      // ignore
    }
  };

  const fetchAdminSettings = async () => {
    try {
      const data = await apiFetch<{ settings: AppSettings }>('/api/admin/settings');
      if (data?.settings) {
        setSettingsDraft(data.settings);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!snapshot) {
      void onRefreshDashboard();
    }
  }, [snapshot, onRefreshDashboard]);

  useEffect(() => {
    if (appSettings) {
      setSettingsDraft(appSettings);
    }
  }, [appSettings]);

  useEffect(() => {
    void Promise.all([
      fetchRegisteredUsers(),
      fetchCommunityOverview(),
      fetchDmConversations(''),
      fetchAdminGroups(),
      fetchActivityLogs('', 'all'),
      fetchReports('all'),
      fetchAdminAnnouncements(),
      fetchAdminSettings(),
      fetchBackups(),
    ]);
  }, []);

  useEffect(() => {
    if (wsConnected) return;
    const interval = setInterval(() => {
      void Promise.all([
        onRefreshDashboard(),
        fetchRegisteredUsers(),
        fetchCommunityOverview(),
      ]);
    }, 15000);
    return () => clearInterval(interval);
  }, [wsConnected, onRefreshDashboard]);

  useEffect(() => {
    if (!liveEvent) return;
    if (liveEvent.type === 'community:presence' && liveEvent.payload) {
      const p = liveEvent.payload as {
        userId?: number;
        online?: boolean;
        lastActiveAt?: string;
      };
      if (typeof p.userId === 'number') {
        const isOn = Boolean(p.online);
        setStudentDetail((prev) =>
          prev && prev.student.id === p.userId
            ? {
                ...prev,
                student: {
                  ...prev.student,
                  online: isOn,
                  lastActiveAt: p.lastActiveAt || prev.student.lastActiveAt,
                },
              }
            : prev
        );
        setActivityLogs((prev) =>
          prev.map((l) => (l.user_id === p.userId ? { ...l, user_online: isOn } : l))
        );
      }
      return;
    }
    if (
      liveEvent.type === 'admin:community_event' ||
      liveEvent.type.startsWith('community:')
    ) {
      void fetchCommunityOverview();
      void fetchActivityLogs(logQuery, logActionFilter);
      void fetchReports(reportStatusFilter);
      void fetchDmConversations(dmQuery);
      void fetchAdminGroups();
      if (selectedDmPair) {
        void fetchDmThread(selectedDmPair.userAId, selectedDmPair.userBId);
      }
      if (selectedAdminGroupId !== null) {
        void fetchAdminGroupDetail(selectedAdminGroupId);
      }
    }
  }, [liveEvent]);

  useEffect(() => {
    const tmr = setTimeout(() => void fetchDmConversations(dmQuery), 200);
    return () => clearTimeout(tmr);
  }, [dmQuery]);

  useEffect(() => {
    const tmr = setTimeout(() => void fetchActivityLogs(logQuery, logActionFilter), 200);
    return () => clearTimeout(tmr);
  }, [logQuery, logActionFilter]);

  useEffect(() => {
    void fetchReports(reportStatusFilter);
  }, [reportStatusFilter]);

  useEffect(() => {
    if (focusSearchTrigger && focusSearchTrigger > 0) {
      searchInputRef.current?.focus();
    }
  }, [focusSearchTrigger]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      apiFetch<AdminSearchResults>(
        `/api/admin/search?q=${encodeURIComponent(trimmed)}&lang=${language}`
      )
        .then((res) => setSearchResults(res))
        .catch(() => setSearchResults({ students: [], questions: [], chapters: [], messages: [] }))
        .finally(() => setSearching(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [query, language]);

  const openStudentStats = async (studentId: number) => {
    setSelectedStudentId(studentId);
    setLoadingDetail(true);
    setStudentDetail(null);
    try {
      const detail = await apiFetch<AdminStudentDetailResponse>(
        `/api/admin/students/${studentId}/stats?lang=${language}`
      );
      setStudentDetail(detail);
    } catch {
      setStudentDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        onRefreshDashboard(),
        fetchRegisteredUsers(),
        fetchCommunityOverview(),
        fetchDmConversations(dmQuery),
        fetchAdminGroups(),
        fetchActivityLogs(logQuery, logActionFilter),
        fetchReports(reportStatusFilter),
        fetchAdminAnnouncements(),
        fetchAdminSettings(),
        fetchBackups(),
      ]);
      if (selectedStudentId !== null) {
        const detail = await apiFetch<AdminStudentDetailResponse>(
          `/api/admin/students/${selectedStudentId}/stats?lang=${language}`
        ).catch(() => null);
        if (detail) setStudentDetail(detail);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleRestrict = async (targetId: number, restricted: boolean, reason = '') => {
    setRestrictBusy(true);
    setModerationError(null);
    try {
      await apiFetch(`/api/admin/users/${targetId}/restrict`, {
        method: 'PUT',
        body: JSON.stringify({ restricted, reason }),
      });
      setRestrictTarget(null);
      setRestrictReason('');
      await Promise.all([
        onRefreshDashboard(),
        fetchRegisteredUsers(),
        fetchCommunityOverview(),
        fetchActivityLogs(logQuery, logActionFilter),
        fetchReports(reportStatusFilter),
      ]);
      if (selectedStudentId === targetId) {
        const detail = await apiFetch<AdminStudentDetailResponse>(
          `/api/admin/students/${targetId}/stats?lang=${language}`
        ).catch(() => null);
        if (detail) setStudentDetail(detail);
      }
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to update restriction status.');
    } finally {
      setRestrictBusy(false);
    }
  };

  const isProtectedUser = (target: { id: number; email: string }) =>
    target.id === currentUser.id || target.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;

  const openEditUserModal = async (target: AdminUserRecord) => {
    setEditUserTarget(target);
    setEditName(target.name);
    setEditGrade(target.grade || '');
    setEditBirthday(target.birthday || '');
    setEditBio(target.bio || '');
    setEditRole(target.role);
    setEditError(null);
    try {
      const detail = await apiFetch<{ user: AdminUserRecord }>(`/api/admin/users/${target.id}`);
      if (detail?.user) {
        setEditUserTarget(detail.user);
        setEditName(detail.user.name);
        setEditGrade(detail.user.grade || '');
        setEditBirthday(detail.user.birthday || '');
        setEditBio(detail.user.bio || '');
        setEditRole(detail.user.role);
      }
    } catch {
      // Fallback to list record if detail fetch unavailable
    }
  };

  const handleSaveEditedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserTarget || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    setAccountActionMsg(null);
    const isTargetProtected = isProtectedUser(editUserTarget);
    try {
      const payload: Record<string, unknown> = {
        name: editName.trim(),
        grade: editGrade.trim(),
        birthday: editBirthday.trim(),
        bio: editBio.trim(),
      };
      if (!isTargetProtected) {
        payload.role = editRole;
        payload.isAdmin = editRole === 'teacher';
      }
      const res = await apiFetch<{ user: AdminUserRecord }>(`/api/admin/users/${editUserTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setEditUserTarget(res.user);
      setRegisteredUsers((prev) =>
        prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u))
      );
      setAccountActionMsg(t.profile.accountUpdatedMsg);
      await Promise.all([onRefreshDashboard(), fetchRegisteredUsers()]);
      if (selectedStudentId === res.user.id) {
        const detail = await apiFetch<AdminStudentDetailResponse>(
          `/api/admin/students/${res.user.id}/stats?lang=${language}`
        ).catch(() => null);
        if (detail) setStudentDetail(detail);
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleAccountRole = async (target: AdminUserRecord) => {
    if (isProtectedUser(target)) return;
    setAccountActionMsg(null);
    setAccountActionError(null);
    const nextRole = target.role === 'teacher' ? 'student' : 'teacher';
    try {
      await apiFetch(`/api/admin/users/${target.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: nextRole, isAdmin: nextRole === 'teacher' }),
      });
      setAccountActionMsg(
        formatMsg(t.profile.roleUpdatedMsg, {
          name: target.name,
          role: nextRole === 'teacher' ? t.profile.adminTeacherTag : t.profile.studentTag,
        })
      );
      await Promise.all([onRefreshDashboard(), fetchRegisteredUsers()]);
    } catch (err) {
      setAccountActionError(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleCreateQuickAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim() || annSaving) return;
    setAnnSaving(true);
    setAnnError(null);
    try {
      const fd = new FormData();
      fd.append('title', annTitle.trim());
      fd.append('content', annContent.trim());
      fd.append('type', annType);
      const res = await apiFetch<{ announcement: Announcement }>('/api/announcements', {
        method: 'POST',
        body: fd,
      });
      if (res?.announcement) {
        setAnnouncements((prev) => [res.announcement, ...prev]);
      } else {
        await fetchAdminAnnouncements();
      }
      setAnnTitle('');
      setAnnContent('');
      setAccountActionMsg(t.home.announcementsTitle);
    } catch (err) {
      setAnnError(err instanceof Error ? err.message : 'Failed to publish announcement.');
    } finally {
      setAnnSaving(false);
    }
  };

  const handleDeleteQuickAnnouncement = async (annId: number) => {
    setAnnError(null);
    try {
      await apiFetch(`/api/announcements/${annId}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
    } catch (err) {
      setAnnError(err instanceof Error ? err.message : 'Failed to delete announcement.');
    }
  };

  const handleSaveAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsSaving) return;
    setSettingsSaving(true);
    setSettingsMsg(null);
    setSettingsError(null);
    try {
      const res = await apiFetch<{ settings: AppSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settingsDraft),
      });
      if (res?.settings) {
        setSettingsDraft(res.settings);
        onSettingsUpdated?.(res.settings);
      }
      setSettingsMsg(t.admin.settingsSavedMsg);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Failed to update settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const openDeleteUserModal = (target: { id: number; name: string; email: string }) => {
    setAccountActionMsg(null);
    setAccountActionError(null);
    if (target.id === currentUser.id) {
      setAccountActionError(t.admin.cannotDeleteSelf);
      return;
    }
    if (target.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
      setAccountActionError(t.admin.cannotDeleteMainAdmin);
      return;
    }
    setDeleteTarget(target);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTarget || deleteBusy) return;
    if (deleteTarget.id === currentUser.id) {
      setAccountActionError(t.admin.cannotDeleteSelf);
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
      setAccountActionError(t.admin.cannotDeleteMainAdmin);
      setDeleteTarget(null);
      return;
    }

    setDeleteBusy(true);
    setAccountActionMsg(null);
    setAccountActionError(null);
    const removed = deleteTarget;
    try {
      await apiFetch(`/api/admin/users/${removed.id}`, { method: 'DELETE' });
      await deleteCloudUserAsAdmin(removed.email).catch(() => {});

      setDeleteTarget(null);
      if (selectedStudentId === removed.id) {
        setSelectedStudentId(null);
        setStudentDetail(null);
      }
      if (editUserTarget?.id === removed.id) {
        setEditUserTarget(null);
      }
      setRegisteredUsers((prev) => prev.filter((u) => u.id !== removed.id));
      setSearchResults((prev) =>
        prev
          ? {
              ...prev,
              students: prev.students.filter((s) => s.id !== removed.id),
            }
          : prev
      );
      setAccountActionMsg(formatMsg(t.admin.userDeletedSuccess, { name: removed.name }));
      await Promise.all([
        onRefreshDashboard(),
        fetchRegisteredUsers(),
        fetchCommunityOverview(),
        fetchActivityLogs(logQuery, logActionFilter),
        fetchReports(reportStatusFilter),
        fetchBackups(),
      ]);
    } catch (err) {
      setAccountActionError(err instanceof Error ? err.message : 'Failed to delete user account.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDeleteAdminDm = async (messageId: number) => {
    setModerationError(null);
    try {
      await apiFetch(`/api/community/dm/message/${messageId}`, { method: 'DELETE' });
      setDmThreadMessages((prev) => prev.filter((m) => m.id !== messageId));
      void fetchCommunityOverview();
      void fetchDmConversations(dmQuery);
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to delete direct message.');
    }
  };

  const handleDeleteAdminGroupMessage = async (messageId: number) => {
    setModerationError(null);
    try {
      await apiFetch(`/api/community/groups/message/${messageId}`, { method: 'DELETE' });
      setAdminGroupMessages((prev) => prev.filter((m) => m.id !== messageId));
      void fetchCommunityOverview();
      void fetchAdminGroups();
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to delete group message.');
    }
  };

  const handleDeleteAdminGroup = async (groupId: number) => {
    setModerationError(null);
    try {
      await apiFetch(`/api/community/groups/${groupId}`, { method: 'DELETE' });
      setAdminGroups((prev) => prev.filter((g) => g.id !== groupId));
      if (selectedAdminGroupId === groupId) {
        setSelectedAdminGroupId(null);
        setAdminGroupMembers([]);
        setAdminGroupMessages([]);
      }
      void fetchCommunityOverview();
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to delete group.');
    }
  };

  const handleDeleteReportedTarget = async (report: CommunityReport) => {
    setModerationError(null);
    try {
      if (report.target_type === 'post') {
        await apiFetch(`/api/community/posts/${report.target_id}`, { method: 'DELETE' });
      } else if (report.target_type === 'comment') {
        await apiFetch(`/api/community/comments/${report.target_id}`, { method: 'DELETE' });
      } else if (report.target_type === 'dm') {
        await apiFetch(`/api/community/dm/message/${report.target_id}`, { method: 'DELETE' });
      } else if (report.target_type === 'group_message') {
        await apiFetch(`/api/community/groups/message/${report.target_id}`, { method: 'DELETE' });
      }
      await apiFetch(`/api/admin/moderation/reports/${report.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'resolved' }),
      });
      void Promise.all([
        fetchReports(reportStatusFilter),
        fetchCommunityOverview(),
        fetchActivityLogs(logQuery, logActionFilter),
      ]);
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to process reported content.');
    }
  };

  const handleUpdateReportStatus = async (reportId: number, status: 'resolved' | 'dismissed') => {
    setModerationError(null);
    try {
      await apiFetch(`/api/admin/moderation/reports/${reportId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      void Promise.all([fetchReports(reportStatusFilter), fetchCommunityOverview()]);
    } catch (err) {
      setModerationError(err instanceof Error ? err.message : 'Failed to update report status.');
    }
  };

  const handleCreateManualBackup = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    setBackupError(null);
    try {
      const res = await apiFetch<AdminBackupsResponse>('/api/admin/backups', {
        method: 'POST',
      });
      setDbStats(res.stats);
      setBackupsList(res.backups);
      setBackupMsg(t.admin.backupCreatedMsg);
      apiFetch<{ mainAdminEmail?: string }>('/api/admin/backups/export')
        .then(async (payload) => {
          if (payload?.mainAdminEmail) {
            await syncAdminVaultWithStoredKey(payload.mainAdminEmail, payload);
            const token = getStoredSessionToken();
            if (token) {
              await syncSessionBoundVault(payload.mainAdminEmail, token, payload);
            }
          }
        })
        .catch(() => {});
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to create backup.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleDownloadBackupBlob = async (url: string, fallbackFilename: string) => {
    setBackupError(null);
    try {
      const token = getStoredSessionToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        throw new Error('Download failed.');
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = fallbackFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to download backup.');
    }
  };

  const executeRestore = async (
    source: { filename: string } | { backup: unknown },
    mode: 'merge' | 'replace'
  ) => {
    setBackupBusy(true);
    setBackupMsg(null);
    setBackupError(null);
    try {
      const res = await apiFetch<AdminBackupsResponse>('/api/admin/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ ...source, mode }),
      });
      setDbStats(res.stats);
      setBackupsList(res.backups);
      setBackupMsg(t.admin.backupRestoredMsg);
      setPendingReplaceConfirm(null);
      await Promise.all([onRefreshDashboard(), fetchCommunityOverview()]);
      apiFetch<{ mainAdminEmail?: string }>('/api/admin/backups/export')
        .then(async (payload) => {
          if (payload?.mainAdminEmail) {
            await syncAdminVaultWithStoredKey(payload.mainAdminEmail, payload);
            const token = getStoredSessionToken();
            if (token) {
              await syncSessionBoundVault(payload.mainAdminEmail, token, payload);
            }
          }
        })
        .catch(() => {});
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to restore backup.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleUploadBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupMsg(null);
    setBackupError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (restoreMode === 'replace') {
        setPendingReplaceConfirm({ type: 'upload', payload: parsed, label: file.name });
        return;
      }
      await executeRestore({ backup: parsed }, 'merge');
    } catch (err) {
      setBackupError(
        err instanceof Error ? err.message : 'Invalid backup JSON file.'
      );
    }
  };

  const handleDeleteServerBackup = async (filename: string) => {
    setBackupError(null);
    try {
      const res = await apiFetch<AdminBackupsResponse>(
        `/api/admin/backups/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      setDbStats(res.stats);
      setBackupsList(res.backups);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to delete backup.');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSectionLabel = (section: string): string => {
    switch (section) {
      case 'multiple-choice':
        return t.nav.multipleChoice;
      case 'general-questions':
        return t.nav.generalQuestions;
      case 'ask-teacher':
        return t.nav.askTeacher;
      case 'ai-studio':
        return t.nav.scienceStudio;
      case 'community':
        return t.nav.community;
      case 'notifications':
        return t.nav.notifications;
      case 'profile':
        return t.nav.profile;
      case 'settings':
        return t.nav.settings;
      case 'about':
        return t.nav.about;
      default:
        return t.nav.home;
    }
  };

  const getActivityActionLabel = (actionType: string): string => {
    const dict = t.admin.actionLabels as Record<string, string>;
    return dict[actionType] || actionType;
  };

  const renderAvatar = (student: Pick<AdminStudentPerformance, 'name' | 'avatar_url'>, size = 'w-11 h-11') => (
    <UserAvatar
      name={student.name}
      avatarUrl={student.avatar_url}
      sizeClass={size}
      textClass={size.includes('w-9') ? 'text-xs' : 'text-sm'}
    />
  );

  const activeStudents = snapshot?.activeStudents || [];
  const topStudent = snapshot?.topStudent || null;
  const mostActiveStudent = snapshot?.mostActiveStudent || null;
  const allStudents = snapshot?.students || [];

  const filteredRegisteredUsers = registeredUsers.filter((u) => {
    const q = accountQuery.trim().toLowerCase();
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

  const totalSearchHits = searchResults
    ? searchResults.students.length +
      searchResults.questions.length +
      searchResults.chapters.length +
      searchResults.messages.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.admin.title}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#059669]/30 bg-[#ECFDF5] px-2.5 py-1 text-xs font-semibold text-[#065F46]">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-[#059669] animate-pulse' : 'bg-[#D9A62E]'
                }`}
              />
              <span>{t.admin.liveSyncLabel}</span>
            </span>
          </div>
          <p className="text-sm text-[#57534E] mt-1 max-w-3xl">{t.admin.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{t.admin.refreshBtn}</span>
        </button>
      </div>

      {/* Educational Privacy Notice */}
      <div className="rounded-xl border border-[#E6DFD5] bg-[#FBF4DF]/70 px-4 py-3 flex items-start gap-2.5 text-xs text-[#57534E]">
        <ShieldCheck className="w-4 h-4 text-[#6B1118] shrink-0 mt-0.5" />
        <span>{t.admin.privacyNote}</span>
      </div>

      {accountActionMsg && (
        <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-3 text-xs sm:text-sm font-medium text-[#065F46] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{accountActionMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setAccountActionMsg(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {accountActionError && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-xs sm:text-sm font-medium text-[#991B1B] flex items-center justify-between gap-3">
          <span>{accountActionError}</span>
          <button
            type="button"
            onClick={() => setAccountActionError(null)}
            className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Unified Admin Search Bar */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-6 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-[#57534E] absolute start-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.admin.searchPlaceholder}
            className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-11 pe-20 py-3 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              {t.admin.searchClear}
            </button>
          )}
        </div>

        {/* Category Filter Tabs when searching */}
        {query.trim() && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: `${t.admin.filterAll} (${totalSearchHits})` },
                  {
                    id: 'students',
                    label: `${t.admin.filterStudents} (${searchResults?.students.length ?? 0})`,
                  },
                  {
                    id: 'questions',
                    label: `${t.admin.filterQuestions} (${searchResults?.questions.length ?? 0})`,
                  },
                  {
                    id: 'chapters',
                    label: `${t.admin.filterChapters} (${searchResults?.chapters.length ?? 0})`,
                  },
                  {
                    id: 'messages',
                    label: `${t.admin.filterMessages} (${searchResults?.messages.length ?? 0})`,
                  },
                ] as Array<{ id: SearchScopeFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    filter === tab.id
                      ? 'bg-[#6B1118] text-white'
                      : 'border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {searching ? (
              <p className="text-sm text-[#57534E] py-3">{t.admin.searching}</p>
            ) : totalSearchHits === 0 ? (
              <p className="text-sm text-[#57534E] py-3">{t.admin.searchEmpty}</p>
            ) : (
              <div className="space-y-4 pt-2 border-t border-[#E6DFD5]">
                {(filter === 'all' || filter === 'students') &&
                  searchResults &&
                  searchResults.students.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B1118]">
                        {t.admin.filterStudents}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {searchResults.students.map((st) => (
                          <div
                            key={`search-st-${st.id}`}
                            className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {renderAvatar(st, 'w-9 h-9')}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-[#1C1917] truncate">
                                    {st.name}
                                  </p>
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      st.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                                    }`}
                                  />
                                </div>
                                <p className="text-xs text-[#57534E] truncate">
                                  {st.email} · {t.admin.avgScore}: {st.avgScorePercent}%
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openStudentStats(st.id)}
                                className="rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer"
                              >
                                {t.admin.viewStatsBtn}
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenStudentChat(st.id)}
                                className="rounded-lg bg-[#6B1118] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer"
                              >
                                {t.admin.messageBtn}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {(filter === 'all' || filter === 'chapters') &&
                  searchResults &&
                  searchResults.chapters.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B1118]">
                        {t.admin.filterChapters}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {searchResults.chapters.map((ch) => (
                          <button
                            key={`search-ch-${ch.chapter_number}`}
                            type="button"
                            onClick={() => {
                              onSelectChapter(ch.chapter_number);
                              onNavigate('multiple-choice');
                            }}
                            className="text-start rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 hover:border-[#6B1118] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#6B1118]">
                                {t.home.chapterWord} {ch.chapter_number}
                              </p>
                              <p className="text-sm font-semibold text-[#1C1917] truncate">
                                {ch.title}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#6B1118] shrink-0">
                              {t.admin.openChapterBtn} →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {(filter === 'all' || filter === 'questions') &&
                  searchResults &&
                  searchResults.questions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B1118]">
                        {t.admin.filterQuestions}
                      </h4>
                      <div className="space-y-2">
                        {searchResults.questions.map((q) => (
                          <button
                            key={`search-q-${q.id}`}
                            type="button"
                            onClick={() => {
                              if (q.scope === 'general') {
                                onNavigate('general-questions');
                              } else if (q.chapter_number) {
                                onSelectChapter(q.chapter_number);
                                onNavigate('multiple-choice');
                              }
                            }}
                            className="w-full text-start rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 hover:border-[#6B1118] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs text-[#6B1118] font-semibold">
                                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {q.scope === 'general'
                                    ? t.nav.generalQuestions
                                    : `${t.home.chapterWord} ${q.chapter_number}${
                                        q.chapter_title ? ` · ${q.chapter_title}` : ''
                                      }`}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-[#1C1917] line-clamp-2">
                                <ScientificText text={q.question_text} />
                              </p>
                            </div>
                            <span className="rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1 text-xs font-bold text-[#059669] shrink-0">
                              {q.correct_option}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {(filter === 'all' || filter === 'messages') &&
                  searchResults &&
                  searchResults.messages.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B1118]">
                        {t.admin.filterMessages}
                      </h4>
                      <div className="space-y-2">
                        {searchResults.messages.map((m) => (
                          <button
                            key={`search-msg-${m.id}`}
                            type="button"
                            onClick={() => onOpenStudentChat(m.student_id)}
                            className="w-full text-start rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 hover:border-[#6B1118] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs text-[#57534E]">
                                <MessageSquare className="w-3.5 h-3.5 text-[#6B1118]" />
                                <span className="font-bold text-[#1C1917]">{m.student_name}</span>
                                <span>· {m.sender_name}</span>
                              </div>
                              <p className="mt-1 text-sm text-[#1C1917] truncate">
                                {m.message_text || m.attachment_name}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-[#6B1118] shrink-0">
                              {t.admin.openChatBtn} →
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </>
        )}
      </section>

      {/* 2. Highlighted Dashboard Sections: Active Students, Top Performing Student, Most Active Student */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section A: Currently Active Students */}
        <section className="lg:col-span-5 rounded-2xl bg-white border border-[#E6DFD5] p-6 flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[#E6DFD5] pb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] border border-[#059669]/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-[#059669]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-[#1C1917] truncate">
                  {t.admin.activeStudentsTitle}
                </h3>
                <p className="text-xs text-[#57534E]">{t.admin.activeStudentsSub}</p>
              </div>
            </div>
            <span className="rounded-lg bg-[#ECFDF5] border border-[#059669]/30 px-2.5 py-1 text-xs font-bold text-[#065F46] tabular-nums shrink-0">
              {activeStudents.length} {t.admin.onlineNowBadge}
            </span>
          </div>

          <div className="mt-4 flex-1">
            {activeStudents.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Activity className="w-8 h-8 text-[#A8A29E] mx-auto" />
                <p className="text-sm text-[#57534E]">{t.admin.noActiveStudents}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E6DFD5]">
                {activeStudents.map((st) => (
                  <div key={`active-${st.id}`} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        {renderAvatar(st, 'w-10 h-10')}
                        <span
                          aria-label={t.admin.onlineLabel}
                          className="absolute bottom-0 end-0 w-3 h-3 rounded-full bg-[#059669] ring-2 ring-white"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#1C1917] truncate">{st.name}</p>
                          <span className="text-[11px] font-bold text-[#065F46]">
                            {t.admin.onlineLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#57534E] truncate">
                          {t.admin.viewingSection}: {getSectionLabel(st.currentSection)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openStudentStats(st.id)}
                      className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer shrink-0"
                    >
                      {t.admin.viewStatsBtn}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section B & C: Top Performing Student & Most Active Student */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section B: Top Performing Student */}
          <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-[#E6DFD5] pb-4">
                <div className="w-9 h-9 rounded-xl bg-[#FBF4DF] border border-[#D9A62E]/40 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-[#D9A62E]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-[#1C1917]">
                    {t.admin.topStudentTitle}
                  </h3>
                  <p className="text-xs text-[#57534E]">{t.admin.topStudentSub}</p>
                </div>
              </div>

              {!topStudent ? (
                <div className="py-10 text-center space-y-2">
                  <Award className="w-8 h-8 text-[#D9A62E] mx-auto" />
                  <p className="text-sm text-[#57534E]">{t.admin.noTopStudent}</p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-3.5">
                    {renderAvatar(topStudent, 'w-14 h-14')}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-[#1C1917] truncate">
                          {topStudent.name}
                        </p>
                        {topStudent.online && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#57534E] truncate">{topStudent.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.avgScore}</p>
                      <p className="mt-0.5 text-lg font-bold text-[#6B1118] tabular-nums">
                        {topStudent.avgScorePercent}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.accuracyLabel}</p>
                      <p className="mt-0.5 text-lg font-bold text-[#059669] tabular-nums">
                        {topStudent.accuracyPercent}%
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.correctAnswers}</p>
                      <p className="mt-0.5 text-base font-bold text-[#1C1917] tabular-nums">
                        {topStudent.correctAnswers}/{topStudent.questionsAnswered}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.quizzesCompleted}</p>
                      <p className="mt-0.5 text-base font-bold text-[#1C1917] tabular-nums">
                        {topStudent.quizzesCompleted}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {topStudent && (
              <button
                type="button"
                onClick={() => openStudentStats(topStudent.id)}
                className="mt-5 w-full rounded-xl bg-[#6B1118] py-2.5 text-xs font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[40px]"
              >
                {t.admin.viewStatsBtn}
              </button>
            )}
          </section>

          {/* Section C: Most Active Student */}
          <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 border-b border-[#E6DFD5] pb-4">
                <div className="w-9 h-9 rounded-xl bg-[#F9EFF0] border border-[#6B1118]/25 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-[#6B1118]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-[#1C1917]">
                    {t.admin.mostActiveTitle}
                  </h3>
                  <p className="text-xs text-[#57534E]">{t.admin.mostActiveSub}</p>
                </div>
              </div>

              {!mostActiveStudent ? (
                <div className="py-10 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-[#6B1118] mx-auto" />
                  <p className="text-sm text-[#57534E]">{t.admin.noMostActive}</p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-3.5">
                    {renderAvatar(mostActiveStudent, 'w-14 h-14')}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-[#1C1917] truncate">
                          {mostActiveStudent.name}
                        </p>
                        {mostActiveStudent.online && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[#059669] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#57534E] truncate">{mostActiveStudent.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.activityPoints}</p>
                      <p className="mt-0.5 text-lg font-bold text-[#6B1118] tabular-nums">
                        {mostActiveStudent.activityScore}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.questionsAnswered}</p>
                      <p className="mt-0.5 text-lg font-bold text-[#1C1917] tabular-nums">
                        {mostActiveStudent.questionsAnswered}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.quizzesCompleted}</p>
                      <p className="mt-0.5 text-base font-bold text-[#1C1917] tabular-nums">
                        {mostActiveStudent.quizzesCompleted}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                      <p className="text-[#57534E]">{t.admin.teacherQuestions}</p>
                      <p className="mt-0.5 text-base font-bold text-[#1C1917] tabular-nums">
                        {mostActiveStudent.teacherMessagesCount + mostActiveStudent.aiTutorTurns}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {mostActiveStudent && (
              <button
                type="button"
                onClick={() => openStudentStats(mostActiveStudent.id)}
                className="mt-5 w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[40px]"
              >
                {t.admin.viewStatsBtn}
              </button>
            )}
          </section>
        </div>
      </div>

      {/* 3. Complete Student Performance & Rankings Table */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DFD5] pb-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-[#6B1118]" />
            <div>
              <h3 className="text-lg font-bold text-[#1C1917]">{t.admin.leaderboardTitle}</h3>
              <p className="text-xs text-[#57534E]">{t.admin.leaderboardSub}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#57534E] tabular-nums">
            {allStudents.length} {t.admin.filterStudents}
          </span>
        </div>

        {allStudents.length === 0 ? (
          <p className="text-sm text-[#57534E] py-6 text-center">{t.admin.noStudentsYet}</p>
        ) : (
          <div className="divide-y divide-[#E6DFD5]">
            {allStudents.map((st, idx) => (
              <div
                key={st.id}
                className="py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-xs font-bold text-[#57534E] tabular-nums">
                    #{idx + 1}
                  </span>
                  <div className="relative">
                    {renderAvatar(st, 'w-10 h-10')}
                    {st.online && (
                      <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-[#059669] ring-2 ring-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1C1917] truncate">{st.name}</p>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          st.online
                            ? 'bg-[#ECFDF5] text-[#065F46]'
                            : 'bg-[#FAF8F5] text-[#57534E]'
                        }`}
                      >
                        {st.online ? t.admin.onlineLabel : t.admin.offlineLabel}
                      </span>
                      {st.isRestricted && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626]">
                          {t.admin.restrictedBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#57534E] truncate">
                      {st.email}
                      {st.lastLoginAt
                        ? ` · ${t.admin.lastLogin}: ${formatUtcDateTime(st.lastLoginAt)}`
                        : st.lastActiveAt
                        ? ` · ${t.admin.lastActive}: ${formatUtcDateTime(st.lastActiveAt)}`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 sm:gap-5 text-xs tabular-nums">
                  <div>
                    <p className="text-[#57534E]">{t.admin.avgScore}</p>
                    <p className="font-bold text-[#6B1118]">{st.avgScorePercent}%</p>
                  </div>
                  <div>
                    <p className="text-[#57534E]">{t.admin.questionsAnswered}</p>
                    <p className="font-bold text-[#1C1917]">
                      {st.correctAnswers}/{st.questionsAnswered}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#57534E]">{t.admin.quizzesCompleted}</p>
                    <p className="font-bold text-[#1C1917]">{st.quizzesCompleted}</p>
                  </div>
                  <div>
                    <p className="text-[#57534E]">{t.admin.activityPoints}</p>
                    <p className="font-bold text-[#1C1917]">{st.activityScore}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openStudentStats(st.id)}
                      className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-1.5 font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[36px]"
                    >
                      {t.admin.viewStatsBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStudentChat(st.id)}
                      aria-label={`${t.admin.messageBtn} ${st.name}`}
                      className="rounded-lg bg-[#6B1118] px-3 py-1.5 font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[36px]"
                    >
                      {t.admin.messageBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        st.isRestricted
                          ? void handleToggleRestrict(st.id, false)
                          : setRestrictTarget({ id: st.id, name: st.name })
                      }
                      className={`rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer min-h-[36px] border ${
                        st.isRestricted
                          ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
                          : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
                      }`}
                    >
                      {st.isRestricted ? t.admin.unrestrictBtn : t.admin.restrictBtn}
                    </button>
                    {!isProtectedUser(st) && (
                      <button
                        type="button"
                        onClick={() =>
                          openDeleteUserModal({ id: st.id, name: st.name, email: st.email })
                        }
                        aria-label={`${t.admin.deleteUserBtn} ${st.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-1.5 font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.admin.deleteUserBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Community Monitoring, Private/Group Chat Review, Activity Logs & Safety Moderation */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E6DFD5] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F9EFF0] border border-[#6B1118]/25 flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-[#6B1118]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1C1917]">{t.admin.monitoringTitle}</h3>
              <p className="text-xs text-[#57534E]">{t.admin.monitoringSub}</p>
            </div>
          </div>

          {communityOverview && communityOverview.openReportsCount > 0 && (
            <button
              type="button"
              onClick={() => setMonitoringTab('moderation')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 px-3 py-1.5 text-xs font-bold text-[#DC2626] cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {communityOverview.openReportsCount} {t.admin.statOpenReports}
              </span>
            </button>
          )}
        </div>

        {/* Monitoring Sub-Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'overview', label: t.admin.tabOverview, icon: BarChart3 },
              {
                id: 'accounts',
                label: t.admin.tabAccounts,
                icon: UserCog,
                badge: registeredUsers.length,
              },
              {
                id: 'dms',
                label: t.admin.tabPrivateDms,
                icon: MessageSquare,
                badge: communityOverview?.dmCount,
              },
              {
                id: 'groups',
                label: t.admin.tabGroupChats,
                icon: MessageCircle,
                badge: communityOverview?.groupCount,
              },
              {
                id: 'logs',
                label: t.admin.tabActivityLogs,
                icon: Clock,
              },
              {
                id: 'moderation',
                label: t.admin.tabModeration,
                icon: ShieldAlert,
                badge: communityOverview?.openReportsCount,
              },
              {
                id: 'content',
                label: t.admin.tabContentControl,
                icon: BookOpen,
              },
              {
                id: 'settings',
                label: t.admin.tabAppSettings,
                icon: Settings,
              },
              {
                id: 'backups',
                label: t.admin.tabBackups,
                icon: Database,
                badge: dbStats?.backupCount,
              },
            ] as Array<{
              id: MonitoringTab;
              label: string;
              icon: React.ComponentType<{ className?: string }>;
              badge?: number;
            }>
          ).map((mt) => {
            const Icon = mt.icon;
            const active = monitoringTab === mt.id;
            return (
              <button
                key={mt.id}
                type="button"
                onClick={() => setMonitoringTab(mt.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[40px] ${
                  active
                    ? 'bg-[#6B1118] text-white'
                    : 'bg-[#FAF8F5] border border-[#E6DFD5] text-[#57534E] hover:border-[#6B1118] hover:text-[#1C1917]'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#E5B742]' : 'text-[#6B1118]'}`} />
                <span>{mt.label}</span>
                {mt.badge !== undefined && mt.badge > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-[#6B1118]'
                    }`}
                  >
                    {mt.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {moderationError && (
          <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs sm:text-sm text-[#991B1B] flex items-center justify-between gap-2">
            <span>{moderationError}</span>
            <button
              type="button"
              onClick={() => setModerationError(null)}
              className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sub-Tab 1: Community Overview KPIs */}
        {monitoringTab === 'overview' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: t.admin.statPosts, value: communityOverview?.postsCount ?? 0 },
              { label: t.admin.statComments, value: communityOverview?.commentsCount ?? 0 },
              { label: t.admin.statReactions, value: communityOverview?.reactionsCount ?? 0 },
              { label: t.admin.statPrivateDms, value: communityOverview?.dmCount ?? 0 },
              { label: t.admin.statGroups, value: communityOverview?.groupCount ?? 0 },
              { label: t.admin.statGroupMsgs, value: communityOverview?.groupMsgCount ?? 0 },
              {
                label: t.admin.statOpenReports,
                value: communityOverview?.openReportsCount ?? 0,
                danger: (communityOverview?.openReportsCount ?? 0) > 0,
              },
              {
                label: t.admin.statRestrictedUsers,
                value: communityOverview?.restrictedCount ?? 0,
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4"
              >
                <p className="text-[#57534E]">{kpi.label}</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${
                    kpi.danger ? 'text-[#DC2626]' : 'text-[#6B1118]'
                  }`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Sub-Tab 1B: Full Registered Accounts Directory & Profile Control */}
        {monitoringTab === 'accounts' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-[#57534E]">{t.admin.registeredAccountsSub}</p>
              <button
                type="button"
                disabled={loadingAccounts}
                onClick={() => void fetchRegisteredUsers()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] disabled:opacity-50 cursor-pointer min-h-[36px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounts ? 'animate-spin' : ''}`} />
                <span>{t.profile.refreshAccountsBtn}</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#57534E] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={accountQuery}
                onChange={(e) => setAccountQuery(e.target.value)}
                placeholder={t.profile.searchAccountsPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  {
                    id: 'all',
                    label: `${t.profile.filterAllAccounts} (${registeredUsers.length})`,
                  },
                  {
                    id: 'students',
                    label: `${t.profile.filterStudentsOnly} (${
                      registeredUsers.filter((u) => u.role !== 'teacher' && !u.isAdmin).length
                    })`,
                  },
                  {
                    id: 'admins',
                    label: `${t.profile.filterAdminsOnly} (${
                      registeredUsers.filter((u) => u.role === 'teacher' || u.isAdmin).length
                    })`,
                  },
                  {
                    id: 'online',
                    label: `${t.profile.filterOnlineOnly} (${
                      registeredUsers.filter((u) => Boolean(u.online)).length
                    })`,
                  },
                  {
                    id: 'restricted',
                    label: `${t.profile.filterRestrictedOnly} (${
                      registeredUsers.filter((u) => Boolean(u.isRestricted)).length
                    })`,
                  },
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setAccountFilter(pill.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    accountFilter === pill.id
                      ? 'bg-[#6B1118] text-white'
                      : 'border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {accountsError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#991B1B]">
                {accountsError}
              </div>
            )}

            {loadingAccounts && registeredUsers.length === 0 ? (
              <p className="text-sm text-[#57534E] py-6 text-center">{t.profile.loadingAccounts}</p>
            ) : filteredRegisteredUsers.length === 0 ? (
              <p className="text-sm text-[#57534E] py-6 text-center">{t.profile.noAccounts}</p>
            ) : (
              <div className="border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5]">
                {filteredRegisteredUsers.map((u) => {
                  const isMain = u.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL;
                  const isSelf = u.id === currentUser.id;
                  return (
                    <div
                      key={`${u.id}-${u.email}`}
                      className="p-4 flex flex-wrap items-center justify-between gap-3"
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
                            className={`absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                              u.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-[#1C1917] truncate">{u.name}</p>
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

                      <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => void openEditUserModal(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1.5 font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[34px]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{t.admin.editProfileBtn}</span>
                        </button>

                        {u.role === 'student' && (
                          <button
                            type="button"
                            onClick={() => void openStudentStats(u.id)}
                            className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1.5 font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[34px]"
                          >
                            {t.admin.viewStatsBtn}
                          </button>
                        )}

                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => onOpenStudentChat(u.id)}
                            className="rounded-lg bg-[#6B1118] px-2.5 py-1.5 font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[34px]"
                          >
                            {t.admin.messageBtn}
                          </button>
                        )}

                        {!isMain && !isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleToggleAccountRole(u)}
                              className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1.5 font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[34px]"
                            >
                              {u.role === 'teacher' ? t.profile.setStudent : t.profile.makeAdmin}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                u.isRestricted
                                  ? void handleToggleRestrict(u.id, false)
                                  : setRestrictTarget({ id: u.id, name: u.name })
                              }
                              className={`rounded-lg px-2.5 py-1.5 font-semibold cursor-pointer min-h-[34px] border ${
                                u.isRestricted
                                  ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
                                  : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
                              }`}
                            >
                              {u.isRestricted ? t.admin.unrestrictBtn : t.admin.restrictBtn}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openDeleteUserModal({ id: u.id, name: u.name, email: u.email })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-1.5 font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white cursor-pointer min-h-[34px]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t.admin.deleteUserBtn}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 2: Private Direct Message Inspector */}
        {monitoringTab === 'dms' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#57534E] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={dmQuery}
                onChange={(e) => setDmQuery(e.target.value)}
                placeholder={t.admin.searchDmsPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            {dmConversations.length === 0 ? (
              <p className="text-sm text-[#57534E] py-8 text-center">
                {t.admin.noDmConversations}
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] max-h-[420px] overflow-y-auto">
                  {dmConversations.map((conv) => {
                    const active =
                      selectedDmPair?.userAId === conv.userA.id &&
                      selectedDmPair?.userBId === conv.userB.id;
                    return (
                      <button
                        key={`${conv.userA.id}-${conv.userB.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedDmPair({
                            userAId: conv.userA.id,
                            userBId: conv.userB.id,
                            label: `${conv.userA.name} ↔ ${conv.userB.name}`,
                          });
                          void fetchDmThread(conv.userA.id, conv.userB.id);
                        }}
                        className={`w-full text-start p-3.5 space-y-1 transition-colors cursor-pointer ${
                          active ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#1C1917] truncate">
                            {conv.userA.name} ↔ {conv.userB.name}
                          </p>
                          <span className="text-[11px] font-bold text-[#6B1118] tabular-nums shrink-0">
                            {conv.messageCount} {t.admin.messagesCountLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#57534E] truncate">{conv.lastMessageText}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="lg:col-span-7 border border-[#E6DFD5] rounded-xl bg-[#FAF8F5] flex flex-col max-h-[420px]">
                  {!selectedDmPair ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-[#57534E]">
                      {t.admin.selectDmConversation}
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-[#E6DFD5] bg-white rounded-t-xl flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#1C1917] truncate">
                          {selectedDmPair.label}
                        </p>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {dmThreadMessages.map((msg) => (
                          <div
                            key={msg.id}
                            className="rounded-xl bg-white border border-[#E6DFD5] p-3 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#6B1118]">
                                {msg.sender_name} → {msg.recipient_name}
                              </span>
                              <div className="flex items-center gap-2 text-[#57534E]">
                                <span className="tabular-nums">
                                  {formatUtcDateTime(msg.created_at)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAdminDm(msg.id)}
                                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>{t.admin.deleteMsgBtn}</span>
                                </button>
                              </div>
                            </div>
                            {msg.message_text && (
                              <p className="text-sm text-[#1C1917] whitespace-pre-wrap">
                                {msg.message_text}
                              </p>
                            )}
                            {msg.attachment_url && (
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block text-xs underline text-[#6B1118]"
                              >
                                {msg.attachment_name || 'Attachment'}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 3: Group Chats Inspector */}
        {monitoringTab === 'groups' && (
          <div>
            {adminGroups.length === 0 ? (
              <p className="text-sm text-[#57534E] py-8 text-center">{t.admin.noGroupsFound}</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] max-h-[420px] overflow-y-auto">
                  {adminGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setSelectedAdminGroupId(g.id);
                        void fetchAdminGroupDetail(g.id);
                      }}
                      className={`w-full text-start p-3.5 space-y-1 transition-colors cursor-pointer ${
                        selectedAdminGroupId === g.id ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#1C1917] truncate flex items-center gap-1.5">
                          {g.is_public ? (
                            <Globe className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-[#6B1118] shrink-0" />
                          )}
                          <span className="truncate">{g.name}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-[#57534E] tabular-nums shrink-0">
                          {g.message_count} {t.admin.messagesCountLabel}
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] truncate">
                        {g.is_public ? t.admin.publicGroupBadge : t.admin.privateGroupBadge} ·{' '}
                        {g.creator_name}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="lg:col-span-7 border border-[#E6DFD5] rounded-xl bg-[#FAF8F5] flex flex-col max-h-[420px]">
                  {selectedAdminGroupId === null ? (
                    <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-[#57534E]">
                      {t.admin.selectGroupInspect}
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-[#E6DFD5] bg-white rounded-t-xl flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#1C1917] truncate">
                          {adminGroups.find((g) => g.id === selectedAdminGroupId)?.name} (
                          {adminGroupMembers.length} {t.community.membersCount})
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAdminGroup(selectedAdminGroupId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#FEF2F2] border border-[#DC2626]/30 px-2.5 py-1 text-xs font-semibold text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t.admin.deleteGroupBtn}</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {adminGroupMessages.length === 0 ? (
                          <p className="text-xs text-[#57534E] text-center py-6">
                            {t.community.noGroupMessages}
                          </p>
                        ) : (
                          adminGroupMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className="rounded-xl bg-white border border-[#E6DFD5] p-3 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-bold text-[#6B1118]">{msg.sender_name}</span>
                                <div className="flex items-center gap-2 text-[#57534E]">
                                  <span className="tabular-nums">
                                    {formatUtcDateTime(msg.created_at)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteAdminGroupMessage(msg.id)}
                                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold bg-[#FEF2F2] text-[#DC2626] cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t.admin.deleteMsgBtn}</span>
                                  </button>
                                </div>
                              </div>
                              {msg.message_text && (
                                <p className="text-sm text-[#1C1917] whitespace-pre-wrap">
                                  {msg.message_text}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 4: Detailed Student Activity Logs */}
        {monitoringTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-[#57534E] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={logQuery}
                  onChange={(e) => setLogQuery(e.target.value)}
                  placeholder={t.admin.searchLogsPlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                />
              </div>

              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2.5 text-xs sm:text-sm font-medium text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              >
                <option value="all">{t.admin.allActionsFilter}</option>
                {Object.entries(t.admin.actionLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {activityLogs.length === 0 ? (
              <p className="text-sm text-[#57534E] py-8 text-center">{t.admin.noLogsFound}</p>
            ) : (
              <div className="border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] max-h-[440px] overflow-y-auto">
                {activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1C1917]">{log.user_name}</span>
                        <span className="rounded-md bg-[#F9EFF0] px-2 py-0.5 text-[11px] font-bold text-[#6B1118]">
                          {getActivityActionLabel(log.action_type)}
                        </span>
                        {log.user_online && (
                          <span className="w-2 h-2 rounded-full bg-[#059669]" />
                        )}
                      </div>
                      {log.details && (
                        <p className="text-xs text-[#57534E] mt-0.5 truncate">{log.details}</p>
                      )}
                    </div>
                    <span className="text-xs text-[#57534E] tabular-nums shrink-0">
                      {formatUtcDateTime(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 5: Safety & Moderation Reports Queue */}
        {monitoringTab === 'moderation' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: t.admin.filterAll },
                  { id: 'open', label: t.admin.filterOpen },
                  { id: 'resolved', label: t.admin.filterResolved },
                  { id: 'dismissed', label: t.admin.filterDismissed },
                ] as const
              ).map((rf) => (
                <button
                  key={rf.id}
                  type="button"
                  onClick={() => setReportStatusFilter(rf.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    reportStatusFilter === rf.id
                      ? 'bg-[#6B1118] text-white'
                      : 'border border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                  }`}
                >
                  {rf.label}
                </button>
              ))}
            </div>

            {reports.length === 0 ? (
              <p className="text-sm text-[#57534E] py-8 text-center">{t.admin.noReportsFound}</p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded px-2 py-0.5 font-bold ${
                            rep.status === 'open'
                              ? 'bg-[#FEF2F2] text-[#DC2626]'
                              : rep.status === 'resolved'
                              ? 'bg-[#ECFDF5] text-[#065F46]'
                              : 'bg-white text-[#57534E]'
                          }`}
                        >
                          {rep.status === 'open'
                            ? t.admin.statusOpen
                            : rep.status === 'resolved'
                            ? t.admin.statusResolved
                            : t.admin.statusDismissed}
                        </span>
                        <span className="font-semibold text-[#1C1917]">
                          {t.admin.reportedBy}: {rep.reporter_name}
                        </span>
                        {rep.target_user_name && (
                          <span className="text-[#57534E]">
                            · {t.admin.reportedTarget}: <strong>{rep.target_user_name}</strong> (
                            {rep.target_type})
                          </span>
                        )}
                      </div>
                      <span className="text-[#57534E] tabular-nums">
                        {formatUtcDateTime(rep.created_at)}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-[#1C1917]">
                      <strong>{t.admin.reportedReason}:</strong> {rep.reason}
                    </p>
                    {rep.excerpt && (
                      <p className="text-xs text-[#57534E] bg-white border border-[#E6DFD5] rounded-lg px-3 py-2 italic">
                        "{rep.excerpt}"
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {rep.target_type !== 'user' && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteReportedTarget(rep)}
                          className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          {t.admin.deleteReportedContent}
                        </button>
                      )}
                      {rep.target_user_id && (
                        <button
                          type="button"
                          onClick={() =>
                            rep.target_user_restricted
                              ? void handleToggleRestrict(rep.target_user_id!, false)
                              : setRestrictTarget({
                                  id: rep.target_user_id!,
                                  name: rep.target_user_name || 'Student',
                                })
                          }
                          className="rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B1118] cursor-pointer"
                        >
                          {rep.target_user_restricted
                            ? t.admin.unrestrictBtn
                            : t.admin.restrictBtn}
                        </button>
                      )}
                      {rep.status === 'open' && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleUpdateReportStatus(rep.id, 'resolved')}
                            className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                          >
                            {t.admin.resolveBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleUpdateReportStatus(rep.id, 'dismissed')}
                            className="rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#57534E] cursor-pointer"
                          >
                            {t.admin.dismissBtn}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 6: Database Preservation, Backups & Recovery */}
        {monitoringTab === 'backups' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-[#065F46]">{t.admin.backupTitle}</h4>
                    <span className="rounded bg-white px-2 py-0.5 text-[11px] font-bold text-[#065F46] border border-[#059669]/30">
                      {t.admin.backupProtectionBadge}
                    </span>
                  </div>
                  <p className="text-xs text-[#065F46]/90 mt-1 max-w-3xl">{t.admin.backupSub}</p>
                  {dbStats?.lastRecoverySnapshotAt && (
                    <p className="text-[11px] text-[#065F46]/80 mt-1.5 tabular-nums">
                      {t.admin.backupLastSnapshot}:{' '}
                      {new Date(dbStats.lastRecoverySnapshotAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {backupMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-xs font-medium text-[#065F46]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{backupMsg}</span>
              </div>
            )}
            {backupError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs font-medium text-[#991B1B]">
                {backupError}
              </div>
            )}

            {dbStats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5">
                  <p className="text-[#57534E]">{t.admin.backupStatsAccounts}</p>
                  <p className="mt-1 text-xl font-bold text-[#6B1118] tabular-nums">
                    {dbStats.counts.users}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5">
                  <p className="text-[#57534E]">{t.admin.backupStatsQuestions}</p>
                  <p className="mt-1 text-xl font-bold text-[#1C1917] tabular-nums">
                    {dbStats.counts.questions}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5">
                  <p className="text-[#57534E]">{t.admin.backupStatsMessages}</p>
                  <p className="mt-1 text-xl font-bold text-[#1C1917] tabular-nums">
                    {dbStats.counts.teacherMessages + dbStats.counts.communityDms}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5">
                  <p className="text-[#57534E]">{t.admin.backupStatsAttempts}</p>
                  <p className="mt-1 text-xl font-bold text-[#1C1917] tabular-nums">
                    {dbStats.counts.quizAttempts}
                  </p>
                </div>
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5">
                  <p className="text-[#57534E]">{t.admin.backupStatsDbSize}</p>
                  <p className="mt-1 text-base font-bold text-[#1C1917] tabular-nums">
                    {formatBytes(dbStats.dbSizeBytes)}
                  </p>
                </div>
              </div>
            )}

            {/* Backup Actions & Restore Mode */}
            <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() => void handleCreateManualBackup()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[40px]"
                >
                  <Database className="w-4 h-4 text-[#E5B742]" />
                  <span>{backupBusy ? t.admin.creatingBackup : t.admin.createBackupBtn}</span>
                </button>

                <button
                  type="button"
                  disabled={backupBusy}
                  onClick={() =>
                    void handleDownloadBackupBlob(
                      '/api/admin/backups/export',
                      `grade9hub-backup-${new Date().toISOString().slice(0, 10)}.json`
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[40px]"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.admin.downloadExportBtn}</span>
                </button>

                <label className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[40px]">
                  <Upload className="w-4 h-4 text-[#6B1118]" />
                  <span>{t.admin.importBackupBtn}</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={backupBusy}
                    onChange={handleUploadBackupFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs pt-2 border-t border-[#E6DFD5]">
                <span className="font-bold text-[#1C1917]">{t.admin.restoreModeLabel}:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                    className="accent-[#6B1118]"
                  />
                  <span className="text-[#1C1917]">{t.admin.restoreModeMerge}</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                    className="accent-[#6B1118]"
                  />
                  <span className="text-[#DC2626] font-medium">{t.admin.restoreModeReplace}</span>
                </label>
              </div>

              {pendingReplaceConfirm && (
                <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-[#991B1B]">
                    {t.admin.backupConfirmReplace} (
                    {pendingReplaceConfirm.type === 'file'
                      ? pendingReplaceConfirm.filename
                      : pendingReplaceConfirm.label}
                    )
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={backupBusy}
                      onClick={() => {
                        if (pendingReplaceConfirm.type === 'file') {
                          void executeRestore({ filename: pendingReplaceConfirm.filename }, 'replace');
                        } else {
                          void executeRestore({ backup: pendingReplaceConfirm.payload }, 'replace');
                        }
                      }}
                      className="rounded-lg bg-[#DC2626] px-3 py-1.5 font-semibold text-white cursor-pointer"
                    >
                      {t.admin.restoreBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingReplaceConfirm(null)}
                      className="rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 font-semibold text-[#57534E] cursor-pointer"
                    >
                      {t.admin.closeBtn}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Server Backup History List */}
            {backupsList.length === 0 ? (
              <p className="text-sm text-[#57534E] py-6 text-center">{t.admin.noBackupsYet}</p>
            ) : (
              <div className="border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] max-h-[380px] overflow-y-auto">
                {backupsList.map((b) => (
                  <div
                    key={b.filename}
                    className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#1C1917] break-all">{b.filename}</span>
                        {b.isLatestRecovery ? (
                          <span className="rounded bg-[#ECFDF5] border border-[#059669]/30 px-2 py-0.5 text-[10px] font-bold text-[#065F46]">
                            {t.admin.latestSnapshotBadge}
                          </span>
                        ) : (
                          <span className="rounded bg-[#FAF8F5] border border-[#E6DFD5] px-2 py-0.5 text-[10px] font-semibold text-[#57534E] uppercase">
                            {b.reason}
                          </span>
                        )}
                      </div>
                      <p className="text-[#57534E] tabular-nums">
                        {new Date(b.createdAt).toLocaleString()} · {formatBytes(b.sizeBytes)}
                        {b.usersCount !== undefined ? ` · ${b.usersCount} users` : ''}
                        {b.questionsCount !== undefined ? ` · ${b.questionsCount} questions` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={backupBusy}
                        onClick={() => {
                          if (restoreMode === 'replace') {
                            setPendingReplaceConfirm({ type: 'file', filename: b.filename });
                          } else {
                            void executeRestore({ filename: b.filename }, 'merge');
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#6B1118] px-3 py-1.5 font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#E5B742]" />
                        <span>{t.admin.restoreBtn}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleDownloadBackupBlob(
                            `/api/admin/backups/download/${encodeURIComponent(b.filename)}`,
                            b.filename
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1.5 font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t.admin.downloadFileBtn}</span>
                      </button>

                      {!b.isLatestRecovery && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteServerBackup(b.filename)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-1.5 font-semibold text-[#DC2626] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t.admin.deleteBackupBtn}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Sub-Tab 7: Content & Curriculum Control */}
        {monitoringTab === 'content' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-base font-bold text-[#1C1917]">{t.admin.contentControlTitle}</h4>
              <p className="text-xs text-[#57534E] mt-0.5">{t.admin.contentControlSub}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => onNavigate('multiple-choice')}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 text-start hover:border-[#6B1118] transition-colors cursor-pointer space-y-1.5"
              >
                <BookOpen className="w-5 h-5 text-[#6B1118]" />
                <p className="text-sm font-bold text-[#1C1917]">{t.admin.openQuizzesBtn}</p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('general-questions')}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 text-start hover:border-[#6B1118] transition-colors cursor-pointer space-y-1.5"
              >
                <HelpCircle className="w-5 h-5 text-[#6B1118]" />
                <p className="text-sm font-bold text-[#1C1917]">{t.admin.openGeneralQaBtn}</p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('textbooks-qa')}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 text-start hover:border-[#6B1118] transition-colors cursor-pointer space-y-1.5"
              >
                <BookOpen className="w-5 h-5 text-[#D9A62E]" />
                <p className="text-sm font-bold text-[#1C1917]">{t.admin.openTextbooksQaBtn}</p>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 text-start hover:border-[#6B1118] transition-colors cursor-pointer space-y-1.5"
              >
                <Megaphone className="w-5 h-5 text-[#059669]" />
                <p className="text-sm font-bold text-[#1C1917]">
                  {t.admin.openHomeAnnouncementsBtn}
                </p>
              </button>
            </div>

            {/* Quick Announcement / Material Publisher */}
            <form
              onSubmit={handleCreateQuickAnnouncement}
              className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h5 className="text-sm font-bold text-[#1C1917]">{t.home.announcementsTitle}</h5>
                <select
                  value={annType}
                  onChange={(e) => setAnnType(e.target.value as 'announcement' | 'material')}
                  className="rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1C1917]"
                >
                  <option value="announcement">{t.home.announcementOpt}</option>
                  <option value="material">{t.home.materialOpt}</option>
                </select>
              </div>
              {annError && (
                <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                  {annError}
                </div>
              )}
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder={t.home.titleLabel}
                className="w-full rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm text-[#1C1917]"
              />
              <textarea
                rows={2}
                required
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder={t.home.messageLabel}
                className="w-full rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm text-[#1C1917]"
              />
              <button
                type="submit"
                disabled={annSaving || !annTitle.trim() || !annContent.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[38px]"
              >
                <Megaphone className="w-3.5 h-3.5 text-[#E5B742]" />
                <span>{annSaving ? t.home.publishingNotify : t.home.publishNotifyBtn}</span>
              </button>
            </form>

            {announcements.length > 0 && (
              <div className="border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] max-h-[300px] overflow-y-auto">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 flex items-start justify-between gap-3 text-xs sm:text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1C1917]">{a.title}</span>
                        <span className="rounded bg-[#F9EFF0] px-2 py-0.5 text-[10px] font-bold text-[#6B1118] uppercase">
                          {a.type}
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] mt-0.5 line-clamp-2">{a.content}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteQuickAnnouncement(a.id)}
                      className="p-1.5 rounded-lg text-[#57534E] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer shrink-0"
                      aria-label={t.admin.deleteMsgBtn}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab 8: Global App Settings */}
        {monitoringTab === 'settings' && (
          <form onSubmit={handleSaveAppSettings} className="space-y-4">
            <div>
              <h4 className="text-base font-bold text-[#1C1917]">{t.admin.appSettingsTitle}</h4>
              <p className="text-xs text-[#57534E] mt-0.5">{t.admin.appSettingsSub}</p>
            </div>

            {settingsMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-xs font-medium text-[#065F46]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{settingsMsg}</span>
              </div>
            )}
            {settingsError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-xs font-medium text-[#991B1B]">
                {settingsError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <label className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 flex items-center justify-between gap-3 cursor-pointer">
                <span className="font-semibold text-[#1C1917]">{t.admin.settingAllowReg}</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.allowStudentRegistration}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      allowStudentRegistration: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#6B1118]"
                />
              </label>

              <label className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 flex items-center justify-between gap-3 cursor-pointer">
                <span className="font-semibold text-[#1C1917]">
                  {t.admin.settingCommunityEnabled}
                </span>
                <input
                  type="checkbox"
                  checked={settingsDraft.communityEnabled}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      communityEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#6B1118]"
                />
              </label>

              <label className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 flex items-center justify-between gap-3 cursor-pointer">
                <span className="font-semibold text-[#1C1917]">
                  {t.admin.settingCommunityPosting}
                </span>
                <input
                  type="checkbox"
                  checked={settingsDraft.communityPostingEnabled}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      communityPostingEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#6B1118]"
                />
              </label>

              <label className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 flex items-center justify-between gap-3 cursor-pointer">
                <span className="font-semibold text-[#1C1917]">{t.admin.settingAiTutor}</span>
                <input
                  type="checkbox"
                  checked={settingsDraft.aiTutorEnabled}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      aiTutorEnabled: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-[#6B1118]"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.admin.settingDefaultLang}
                </label>
                <select
                  value={settingsDraft.defaultLanguage}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      defaultLanguage: e.target.value as 'en' | 'ku' | 'ar',
                    }))
                  }
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917]"
                >
                  <option value="en">English (en)</option>
                  <option value="ku">کوردی (ku)</option>
                  <option value="ar">العربية (ar)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.admin.settingMaintenanceMsg}
                </label>
                <input
                  type="text"
                  value={settingsDraft.maintenanceMessage}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      maintenanceMessage: e.target.value,
                    }))
                  }
                  placeholder={t.admin.settingMaintenancePlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={settingsSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[42px]"
            >
              <Save className="w-4 h-4 text-[#E5B742]" />
              <span>{settingsSaving ? t.profile.saving : t.admin.saveSettingsBtn}</span>
            </button>
          </form>
        )}
      </section>

      {/* Detailed Student Performance Modal */}
      {selectedStudentId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedStudentId(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#E6DFD5] pb-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-[#6B1118]" />
                <h3 className="text-lg font-bold text-[#1C1917]">{t.admin.statsModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                aria-label={t.admin.closeBtn}
                className="p-2 rounded-lg text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <p className="text-sm text-[#57534E] py-8 text-center">{t.quiz.loadingQuestions}</p>
            ) : !studentDetail ? (
              <p className="text-sm text-[#57534E] py-8 text-center">{t.admin.noStudentsYet}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {renderAvatar(studentDetail.student, 'w-14 h-14')}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-[#1C1917] truncate">
                          {studentDetail.student.name}
                        </h4>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                            studentDetail.student.online
                              ? 'bg-[#ECFDF5] text-[#065F46]'
                              : 'bg-[#FAF8F5] text-[#57534E]'
                          }`}
                        >
                          {studentDetail.student.online
                            ? t.admin.onlineLabel
                            : t.admin.offlineLabel}
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] truncate">
                        {studentDetail.student.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const target = registeredUsers.find(
                          (u) => u.id === studentDetail.student.id
                        );
                        void openEditUserModal(
                          target || {
                            id: studentDetail.student.id,
                            name: studentDetail.student.name,
                            email: studentDetail.student.email,
                            role: 'student',
                            isAdmin: false,
                            grade: studentDetail.student.grade || '',
                            avatar_url: studentDetail.student.avatar_url,
                            online: studentDetail.student.online,
                            isRestricted: studentDetail.student.isRestricted,
                            restrictionReason: studentDetail.student.restrictionReason,
                            created_at: studentDetail.student.lastActiveAt || '',
                          }
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[40px]"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#6B1118]" />
                      <span>{t.admin.editProfileBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = studentDetail.student.id;
                        setSelectedStudentId(null);
                        onOpenStudentChat(targetId);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[40px]"
                    >
                      <MessageSquare className="w-4 h-4 text-[#E5B742]" />
                      <span>{t.admin.openChatBtn}</span>
                    </button>
                    {!isProtectedUser(studentDetail.student) && (
                      <button
                        type="button"
                        onClick={() =>
                          openDeleteUserModal({
                            id: studentDetail.student.id,
                            name: studentDetail.student.name,
                            email: studentDetail.student.email,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3.5 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-colors cursor-pointer min-h-[40px]"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t.admin.deleteUserBtn}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.avgScore}</p>
                    <p className="mt-1 text-lg font-bold text-[#6B1118] tabular-nums">
                      {studentDetail.student.avgScorePercent}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.bestScore}</p>
                    <p className="mt-1 text-lg font-bold text-[#059669] tabular-nums">
                      {studentDetail.student.bestScorePercent}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.accuracyLabel}</p>
                    <p className="mt-1 text-lg font-bold text-[#1C1917] tabular-nums">
                      {studentDetail.student.accuracyPercent}%
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.performanceScore}</p>
                    <p className="mt-1 text-lg font-bold text-[#D9A62E] tabular-nums">
                      {studentDetail.student.performanceScore}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.quizzesCompleted}</p>
                    <p className="mt-1 text-base font-bold text-[#1C1917] tabular-nums">
                      {studentDetail.student.quizzesCompleted}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.correctAnswers}</p>
                    <p className="mt-1 text-base font-bold text-[#1C1917] tabular-nums">
                      {studentDetail.student.correctAnswers}/{studentDetail.student.questionsAnswered}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.teacherQuestions}</p>
                    <p className="mt-1 text-base font-bold text-[#1C1917] tabular-nums">
                      {studentDetail.student.teacherMessagesCount}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-3">
                    <p className="text-[#57534E]">{t.admin.aiTutorTurns}</p>
                    <p className="mt-1 text-base font-bold text-[#1C1917] tabular-nums">
                      {studentDetail.student.aiTutorTurns}
                    </p>
                  </div>
                </div>

                {/* Recent Quiz Attempts */}
                <div className="space-y-3 pt-2 border-t border-[#E6DFD5]">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#6B1118]" />
                    <h4 className="text-sm font-bold text-[#1C1917]">
                      {t.admin.recentAttemptsTitle}
                    </h4>
                  </div>

                  {studentDetail.attempts.length === 0 ? (
                    <p className="text-xs text-[#57534E] py-4 text-center">
                      {t.admin.noStudentAttempts}
                    </p>
                  ) : (
                    <div className="divide-y divide-[#E6DFD5] border border-[#E6DFD5] rounded-xl px-4">
                      {studentDetail.attempts.map((a) => (
                        <div
                          key={a.id}
                          className="py-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                        >
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
                              {formatUtcDateTime(a.created_at)}
                            </p>
                          </div>
                          <div className="text-end tabular-nums flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                            <div>
                              <p className="font-bold text-[#6B1118]">{a.score_percent}%</p>
                              <p className="text-xs text-[#57534E]">
                                {a.correct_count}/{a.total_questions}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Restrict Student Modal */}
      {restrictTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setRestrictTarget(null);
            setModerationError(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleToggleRestrict(restrictTarget.id, true, restrictReason.trim());
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#DC2626]" />
                <h3 className="text-base font-bold text-[#1C1917]">
                  {t.admin.restrictPromptTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRestrictTarget(null);
                  setModerationError(null);
                }}
                className="p-1 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm font-semibold text-[#1C1917]">{restrictTarget.name}</p>

            {moderationError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                {moderationError}
              </div>
            )}

            <textarea
              rows={3}
              value={restrictReason}
              onChange={(e) => setRestrictReason(e.target.value)}
              placeholder={t.admin.restrictReasonPlaceholder}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestrictTarget(null);
                  setModerationError(null);
                }}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] cursor-pointer"
              >
                {t.admin.closeBtn}
              </button>
              <button
                type="submit"
                disabled={restrictBusy}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 cursor-pointer"
              >
                {t.admin.confirmRestrictBtn}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Permanent User Account Deletion Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-delete-user-title"
          onClick={() => {
            if (!deleteBusy) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1E1A1A] border border-[#E6DFD5] dark:border-[#342D2D] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] dark:border-[#342D2D] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] border border-[#DC2626]/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3
                  id="admin-delete-user-title"
                  className="text-base font-bold text-[#1C1917] dark:text-[#F5EFE9]"
                >
                  {t.admin.deleteUserModalTitle}
                </h3>
              </div>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                aria-label={t.admin.closeBtn}
                className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#B8AEA5] leading-relaxed">
              {formatMsg(t.admin.deleteUserModalWarning, {
                name: deleteTarget.name,
                email: deleteTarget.email,
              })}
            </p>

            {accountActionError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                {accountActionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer min-h-[40px]"
              >
                {t.admin.closeBtn}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleConfirmDeleteUser()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 cursor-pointer min-h-[40px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  {deleteBusy ? t.admin.deletingUserBtn : t.admin.confirmDeleteUserBtn}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect & Edit User Profile Modal */}
      {editUserTarget && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!editSaving) setEditUserTarget(null);
          }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveEditedUser}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1E1A1A] border border-[#E6DFD5] dark:border-[#342D2D] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6DFD5] dark:border-[#342D2D] pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <UserAvatar
                    name={editUserTarget.name}
                    avatarUrl={editUserTarget.avatar_url}
                    sizeClass="w-12 h-12"
                    textClass="text-base"
                  />
                  <span
                    className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-white ${
                      editUserTarget.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5EFE9] truncate">
                    {t.profile.inspectModalTitle}
                  </h3>
                  <p className="text-xs text-[#57534E] truncate">{editUserTarget.email}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditUserTarget(null)}
                aria-label={t.admin.closeBtn}
                className="p-1 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editUserTarget.created_at && (
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#57534E] bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl px-3 py-2">
                {editUserTarget.source && (
                  <span>
                    {t.profile.sourceLabel}:{' '}
                    <strong className="uppercase">{editUserTarget.source}</strong>
                  </span>
                )}
                <span>
                  {t.profile.joinedLabel}: {formatUtcDate(editUserTarget.created_at)}
                </span>
                {editUserTarget.lastLoginAt && (
                  <span>
                    {t.admin.lastLogin}: {formatUtcDateTime(editUserTarget.lastLoginAt)}
                  </span>
                )}
              </div>
            )}

            {editError && (
              <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                {editError}
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
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                    value={editGrade}
                    onChange={(e) => setEditGrade(e.target.value)}
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
                    value={editBirthday}
                    onChange={(e) => setEditBirthday(e.target.value)}
                    className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1917] dark:text-[#F5EFE9] mb-1">
                  {t.profile.roleLabel}
                </label>
                <select
                  value={editRole}
                  disabled={isProtectedUser(editUserTarget)}
                  onChange={(e) => setEditRole(e.target.value as 'student' | 'teacher')}
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
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-sm text-[#1C1917]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditUserTarget(null)}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer min-h-[40px]"
              >
                {t.admin.closeBtn}
              </button>
              <button
                type="submit"
                disabled={editSaving || !editName.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[40px]"
              >
                <Save className="w-4 h-4 text-[#E5B742]" />
                <span>{editSaving ? t.profile.saving : t.admin.saveProfileBtn}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
