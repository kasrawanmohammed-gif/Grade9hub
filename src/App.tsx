/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Home,
  Info,
  Library,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import {
  ApiError,
  apiFetch,
  clearStoredCachedUser,
  clearStoredSessionToken,
  getStoredCachedUser,
  getStoredSessionToken,
  setStoredCachedUser,
  setStoredSessionToken,
  tryRestoreActiveSessionPassport,
} from './lib/api';
import { isStaticHostMode } from './lib/staticFallback';
import {
  clearActiveVaultKey,
  decryptAdminVaultForAutoResume,
  getActivePassport,
  syncAdminVaultWithStoredKey,
  syncSessionBoundVault,
} from './lib/recoveryVault';
import {
  COMPETITION_UPDATED_EVENT,
  flushCompetitionQueue,
} from './lib/competitionQueue';
import {
  AdminDashboardSnapshot,
  Announcement,
  AppSettings,
  Chapter,
  NotificationItem,
  TabId,
  User,
} from './types';
import { LanguageSwitcher, useLanguage } from './contexts/LanguageContext';
import { ThemeToggleButton } from './contexts/SettingsContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import { SplashScreen } from './components/SplashScreen';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { NotificationPermissionModal } from './components/NotificationPermissionModal';
import { AuthPage } from './components/AuthPage';
import { HomeView } from './components/HomeView';
import {
  CommunityNavTarget,
  CommunityView,
  LiveCommunityEvent,
} from './components/CommunityView';
import { CompetitionView } from './components/CompetitionView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { MultipleChoiceView } from './components/MultipleChoiceView';
import { TextbooksQAView } from './components/TextbooksQAView';
import { GeneralQuestionsView } from './components/GeneralQuestionsView';
import { AskTeacherView } from './components/AskTeacherView';
import { NotificationsView } from './components/NotificationsView';
import { AIStudioView } from './components/AIStudioView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { FirestoreErrorBoundary } from './components/FirestoreErrorBoundary';
import { UserAvatar } from './components/UserAvatar';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useStudentGreeting } from './utils/greeting';
import { showDeviceScreenNotification } from './utils/deviceNotifications';
import {
  broadcastHeroBannersUpdated,
  sanitizeHeroSlidesList,
  saveLocalHeroSlides,
} from './lib/heroSlidesStore';
import {
  fetchCloudHeroBanners,
  MAIN_ADMIN_EMAIL,
  pullAllSchoolAccountsAsAdmin,
  pullCloudUserProfile,
  pushSchoolAccountsAsAdmin,
  SchoolAccountMirrorRow,
  signOutFirebaseCloud,
  subscribeCloudAnnouncements,
  subscribeCloudHeroBanners,
  subscribeCurrentUserAccountValidity,
  syncCurrentUserToFirestore,
} from './lib/cloudAccounts';

const VALID_TABS: ReadonlySet<TabId> = new Set<TabId>([
  'home',
  'community',
  'competition',
  'admin-dashboard',
  'multiple-choice',
  'textbooks-qa',
  'general-questions',
  'ask-teacher',
  'notifications',
  'ai-studio',
  'profile',
  'settings',
  'about',
]);

const SESSION_NOTICE_KEY = 'grade9hub_session_notice';

function parsePositiveInt(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface ParsedNotificationTarget {
  tab: TabId;
  announcementId: number | null;
  studentId: number | null;
  communityTarget: Omit<CommunityNavTarget, 'seq'> | null;
}

function getInitialTargetFromUrl(): ParsedNotificationTarget {
  try {
    if (typeof window === 'undefined') {
      return { tab: 'home', announcementId: null, studentId: null, communityTarget: null };
    }
    const params = new URLSearchParams(window.location.search);
    const rawTab = params.get('tab');
    const tab: TabId = rawTab && VALID_TABS.has(rawTab as TabId) ? (rawTab as TabId) : 'home';
    const announcementId = parsePositiveInt(params.get('announcementId'));
    const studentId = parsePositiveInt(params.get('studentId'));
    const rawCommunityTab = params.get('communityTab');
    const communityTab =
      rawCommunityTab === 'feed' ||
      rawCommunityTab === 'active' ||
      rawCommunityTab === 'dm' ||
      rawCommunityTab === 'groups'
        ? rawCommunityTab
        : undefined;
    const peerId = parsePositiveInt(params.get('peerId'));
    const groupId = parsePositiveInt(params.get('groupId'));
    const postId = parsePositiveInt(params.get('postId'));
    const hasCommunityTarget = Boolean(communityTab || peerId || groupId || postId);

    return {
      tab: hasCommunityTarget && tab === 'home' && !rawTab ? 'community' : tab,
      announcementId,
      studentId,
      communityTarget: hasCommunityTarget
        ? {
            tab: communityTab,
            peerId,
            groupId,
            postId,
          }
        : null,
    };
  } catch {
    return { tab: 'home', announcementId: null, studentId: null, communityTarget: null };
  }
}

export default function App() {
  const { language, t, dir } = useLanguage();
  const studentGreeting = useStudentGreeting(t);
  const [showSplash, setShowSplash] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined'
        ? window.sessionStorage.getItem(SESSION_NOTICE_KEY)
        : null;
    } catch {
      return null;
    }
  });

  const [initialUrlTarget] = useState<ParsedNotificationTarget>(() => getInitialTargetFromUrl());
  const [activeTab, setActiveTab] = useState<TabId>(() => initialUrlTarget.tab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [initialChapterSelection, setInitialChapterSelection] = useState<
    number | 'all' | null
  >(null);

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [generalCount, setGeneralCount] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  const [adminSnapshot, setAdminSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveCommunityEvent, setLiveCommunityEvent] = useState<LiveCommunityEvent | null>(null);
  const [leaderboardVersion, setLeaderboardVersion] = useState(0);
  const [focusAdminSearchTrigger, setFocusAdminSearchTrigger] = useState(0);
  const [initialStudentChatId, setInitialStudentChatId] = useState<number | null>(
    () => initialUrlTarget.studentId
  );
  const [initialAnnouncementId, setInitialAnnouncementId] = useState<number | null>(
    () => initialUrlTarget.announcementId
  );
  const [initialCommunityTarget, setInitialCommunityTarget] = useState<CommunityNavTarget | null>(
    () =>
      initialUrlTarget.communityTarget
        ? { seq: 1, ...initialUrlTarget.communityTarget }
        : null
  );
  const communityNavSeqRef = useRef(1);
  const wsRef = useRef<WebSocket | null>(null);
  const wsEventSeqRef = useRef(0);
  const promptedFirstLoginUserIdsRef = useRef<Set<number>>(new Set());
  const userRef = useRef<User | null>(null);
  const explicitSignOutRef = useRef(false);
  const firebaseResumeInFlightRef = useRef<Promise<User | null> | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const isPrivileged = Boolean(user && (user.role === 'teacher' || user.isAdmin));
  const push = usePushNotifications({
    isAuthenticated: Boolean(user),
    userNotificationsEnabled: user ? user.notifications_enabled !== false : true,
    language,
    userId: user?.id ?? null,
    userRole: isPrivileged ? 'teacher' : 'student',
  });

  const fetchPublicSettings = useCallback(async () => {
    try {
      const data = await apiFetch<{ settings: AppSettings }>('/api/settings/public');
      if (data?.settings) {
        const sanitized = sanitizeHeroSlidesList(data.settings.heroSlides);
        if (sanitized.length === 0) {
          const cloudSlides = await fetchCloudHeroBanners().catch(() => null);
          if (cloudSlides && cloudSlides.length > 0) {
            saveLocalHeroSlides(cloudSlides);
            broadcastHeroBannersUpdated(cloudSlides);
            setAppSettings({ ...data.settings, heroSlides: cloudSlides });
            return;
          }
        }
        setAppSettings(data.settings);
      }
    } catch {
      // ignore transient settings fetch errors
    }
  }, []);

  useEffect(() => {
    void fetchPublicSettings();
  }, [fetchPublicSettings]);

  // Real-time cloud hero banner synchronization across devices & tabs
  useEffect(() => {
    const unsubBanners = subscribeCloudHeroBanners((cloudSlides) => {
      if (cloudSlides.length === 0) return;
      saveLocalHeroSlides(cloudSlides);
      broadcastHeroBannersUpdated(cloudSlides);
      setAppSettings((prev) =>
        prev
          ? { ...prev, heroSlides: cloudSlides }
          : {
              allowStudentRegistration: true,
              communityEnabled: true,
              communityPostingEnabled: true,
              aiTutorEnabled: true,
              defaultLanguage: 'en',
              maintenanceMessage: '',
              heroSlides: cloudSlides,
            }
      );
    });
    return () => unsubBanners();
  }, []);

  const fetchAdminDashboard = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      const data = await apiFetch<AdminDashboardSnapshot>('/api/admin/dashboard');
      setAdminSnapshot(data);
    } catch {
      // ignore transient errors
    }
  }, [isPrivileged]);

  useEffect(() => {
    if (!isPrivileged || wsConnected) return;
    void fetchAdminDashboard();
    const timer = setInterval(() => {
      void fetchAdminDashboard();
    }, 20000);
    return () => clearInterval(timer);
  }, [isPrivileged, wsConnected, fetchAdminDashboard]);

  const fetchChapters = useCallback(async () => {
    const data = await apiFetch<{ chapters: Chapter[]; generalCount: number }>(
      `/api/chapters?lang=${language}`
    );
    setChapters(data.chapters);
    setGeneralCount(data.generalCount);
  }, [language]);

  const fetchAnnouncements = useCallback(async () => {
    const data = await apiFetch<{ announcements: Announcement[] }>(
      '/api/announcements'
    );
    setAnnouncements(data.announcements);
  }, []);

  const fetchNotifications = useCallback(async () => {
    const data = await apiFetch<{
      notifications: NotificationItem[];
      unreadCount: number;
    }>('/api/notifications');
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);

    if (user && data.notifications.length > 0) {
      const lastKey = `grade9hub_last_notif_${user.id}`;
      try {
        const stored = window.localStorage.getItem(lastKey);
        const maxId = data.notifications[0].id;
        if (stored === null) {
          window.localStorage.setItem(lastKey, String(maxId));
        } else {
          const prevId = Number(stored) || 0;
          if (maxId > prevId) {
            window.localStorage.setItem(lastKey, String(maxId));
            const newUnread = data.notifications.filter(
              (n) => n.id > prevId && n.is_read === 0
            );
            if (
              newUnread.length > 0 &&
              user.notifications_enabled !== false
            ) {
              const latest = newUnread[0];
              void showDeviceScreenNotification(latest.title, latest.body, {
                tag: `grade9hub-notif-${latest.id}`,
                tab: latest.link_tab || 'notifications',
              });
            }
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [user]);

  const hydrateDashboard = useCallback(async () => {
    await Promise.all([
      fetchChapters(),
      fetchAnnouncements(),
      fetchNotifications(),
    ]);
  }, [fetchChapters, fetchAnnouncements, fetchNotifications]);

  const syncCloudSchoolMirrorNow = useCallback(async (targetEmail: string) => {
    try {
      const fbUser = auth.currentUser;
      if (
        !fbUser ||
        !fbUser.emailVerified ||
        (fbUser.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL ||
        targetEmail.trim().toLowerCase() !== MAIN_ADMIN_EMAIL
      ) {
        return;
      }
      const cloudAccounts = await pullAllSchoolAccountsAsAdmin();
      const syncRes = await apiFetch<{
        restoredCount?: number;
        localAccounts: SchoolAccountMirrorRow[];
      }>('/api/admin/cloud-sync', {
        method: 'POST',
        body: JSON.stringify({ cloudAccounts }),
      });
      if (syncRes.localAccounts?.length) {
        await pushSchoolAccountsAsAdmin(syncRes.localAccounts);
      }
      if ((syncRes.restoredCount || 0) > 0) {
        void fetchAdminDashboard();
      }
    } catch {
      // ignore transient cloud sync errors
    }
  }, [fetchAdminDashboard]);

  const syncAdminVaultsNow = useCallback(async (targetEmail: string) => {
    try {
      const payload = await apiFetch<unknown>('/api/admin/backups/export');
      await syncAdminVaultWithStoredKey(targetEmail, payload);
      const token = getStoredSessionToken();
      if (token) {
        await syncSessionBoundVault(targetEmail, token, payload);
      }
    } catch {
      // ignore transient errors
    }
    void syncCloudSchoolMirrorNow(targetEmail);
  }, [syncCloudSchoolMirrorNow]);

  const vaultDirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resumeFirebaseSignedInUser = useCallback(async (fbUser: FirebaseUser): Promise<User | null> => {
    if (!fbUser || !fbUser.emailVerified || explicitSignOutRef.current) {
      return null;
    }
    if (firebaseResumeInFlightRef.current) {
      return firebaseResumeInFlightRef.current;
    }

    const promise = (async (): Promise<User | null> => {
      try {
        const idToken = await fbUser.getIdToken();
        const { profile, attempts } = await pullCloudUserProfile(fbUser.uid).catch(() => ({
          profile: null,
          attempts: [],
        }));
        const fbLogin = await apiFetch<{
          user: User;
          sessionToken?: string;
        }>('/api/auth/firebase-login', {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            cloudProfile: profile,
            cloudAttempts: attempts,
          }),
        });
        if (fbLogin.user && !explicitSignOutRef.current) {
          if (fbLogin.sessionToken) setStoredSessionToken(fbLogin.sessionToken);
          setStoredCachedUser(fbLogin.user);
          return fbLogin.user;
        }
        return null;
      } catch {
        return null;
      } finally {
        firebaseResumeInFlightRef.current = null;
      }
    })();

    firebaseResumeInFlightRef.current = promise;
    return promise;
  }, []);

  // Initial auth check + silent restart retry + automatic session recovery + Firebase onAuthStateChanged persistence
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const splashTimer = setTimeout(() => setShowSplash(false), 750);

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (cancelled || explicitSignOutRef.current) return;
      if (fbUser && fbUser.emailVerified && !userRef.current) {
        void resumeFirebaseSignedInUser(fbUser).then((restoredUser) => {
          if (!cancelled && restoredUser && !explicitSignOutRef.current) {
            setUser(restoredUser);
            setAuthChecked(true);
          }
        });
      }
    });

    const checkAuth = async (attempt = 0) => {
      try {
        const res = await apiFetch<{
          user: User | null;
          dbEmpty?: boolean;
          needsPassportRestore?: boolean;
          sessionRevoked?: boolean;
          sessionToken?: string;
        }>('/api/auth/me');

        if (cancelled) return;

        if (res.user) {
          if (res.sessionToken) setStoredSessionToken(res.sessionToken);
          setStoredCachedUser(res.user);
          setUser(res.user);
          setAuthChecked(true);
          return;
        }

        if (res.sessionRevoked) {
          clearStoredSessionToken();
          clearStoredCachedUser();
          try {
            window.sessionStorage.setItem(SESSION_NOTICE_KEY, 'account_deleted');
          } catch {
            // ignore storage errors
          }
          if (!cancelled) {
            setSessionNotice('account_deleted');
            setUser(null);
            setAuthChecked(true);
          }
          return;
        }

        const storedToken = getStoredSessionToken();
        const cachedUser = getStoredCachedUser<User>();
        const activePassport = storedToken
          ? await getActivePassport(cachedUser?.email)
          : null;

        if (storedToken && (res.dbEmpty || res.needsPassportRestore || Boolean(activePassport))) {
          // 1. If browser holds full admin recovery vault, restore entire school database + session
          if (res.dbEmpty || res.needsPassportRestore) {
            const decryptedBackup = await decryptAdminVaultForAutoResume(storedToken);
            if (decryptedBackup && !cancelled) {
              try {
                const recovered = await apiFetch<{
                  user: User;
                  sessionToken?: string;
                }>('/api/auth/auto-restore-session', {
                  method: 'POST',
                  body: JSON.stringify({
                    sessionToken: storedToken,
                    backup: decryptedBackup,
                  }),
                });
                if (!cancelled && recovered.user) {
                  if (recovered.sessionToken) setStoredSessionToken(recovered.sessionToken);
                  setStoredCachedUser(recovered.user);
                  setUser(recovered.user);
                  setAuthChecked(true);
                  void syncAdminVaultsNow(recovered.user.email);
                  return;
                }
              } catch {
                // fall through to universal user passport restore
              }
            }
          }

          // 2. Universal per-user passport auto-recovery (works for students, teachers, and admin)
          const passportRestored = await tryRestoreActiveSessionPassport();
          if (!cancelled && passportRestored?.user) {
            const restoredUser = passportRestored.user as User;
            if (passportRestored.sessionToken) {
              setStoredSessionToken(passportRestored.sessionToken);
            }
            setStoredCachedUser(restoredUser);
            setUser(restoredUser);
            setAuthChecked(true);
            return;
          }

          // Preserve token on dbEmpty / needsPassportRestore so sessions can resume seamlessly
          if (!cancelled) {
            setUser(null);
            setAuthChecked(true);
          }
          return;
        }

        // 3. If Firebase Google session is active on this browser, silently resume/restore
        await auth.authStateReady().catch(() => {});
        const currentFbUser = auth.currentUser;
        if (currentFbUser && currentFbUser.emailVerified && !cancelled) {
          const restoredFbUser = await resumeFirebaseSignedInUser(currentFbUser);
          if (!cancelled && restoredFbUser) {
            setUser(restoredFbUser);
            setAuthChecked(true);
            return;
          }
        }

        if (!res.dbEmpty && !res.needsPassportRestore && !activePassport) {
          clearStoredSessionToken();
          clearStoredCachedUser();
        }
        if (!cancelled) {
          setUser(null);
          setAuthChecked(true);
        }
      } catch (err) {
        if (cancelled) return;
        const isNotFound = err instanceof ApiError && err.status === 404;
        const cachedUser = getStoredCachedUser<User>();
        const storedToken = getStoredSessionToken();
        if (cachedUser && storedToken) {
          setUser(cachedUser);
          setAuthChecked(true);
          if (!isNotFound && !isStaticHostMode() && attempt < 5) {
            const delayMs = Math.min(2500 * (attempt + 1), 12000);
            retryTimer = setTimeout(() => {
              void checkAuth(attempt + 1);
            }, delayMs);
          }
        } else {
          setUser(null);
          setAuthChecked(true);
        }
      }
    };

    void checkAuth(0);

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (retryTimer) clearTimeout(retryTimer);
      clearTimeout(splashTimer);
    };
  }, [syncAdminVaultsNow, resumeFirebaseSignedInUser]);

  useEffect(() => {
    if (!user) return;
    void hydrateDashboard();
    if (isPrivileged) {
      void fetchAdminDashboard();
    }
    const interval = setInterval(() => {
      void fetchNotifications();
    }, 20000);
    return () => clearInterval(interval);
  }, [user, isPrivileged, hydrateDashboard, fetchNotifications, fetchAdminDashboard]);

  // Background hybrid offline/online competition queue sync & event propagation
  useEffect(() => {
    if (!user) return;
    const syncNow = () => {
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void flushCompetitionQueue(user.id).then((res) => {
          if (res.syncedCount > 0) {
            setLeaderboardVersion((v) => v + 1);
          }
        });
      }
    };
    const handleVisibility = () => {
      if (!document.hidden && navigator.onLine) {
        syncNow();
      }
    };
    const handleCompUpdated = () => {
      setLeaderboardVersion((v) => v + 1);
    };

    syncNow();
    window.addEventListener('online', syncNow);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(COMPETITION_UPDATED_EVENT, handleCompUpdated);
    return () => {
      window.removeEventListener('online', syncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(COMPETITION_UPDATED_EVENT, handleCompUpdated);
    };
  }, [user?.id]);

  // Silently keep encrypted Admin Recovery Vaults fresh in IndexedDB across Remember Me sessions
  useEffect(() => {
    if (!user || !isPrivileged) return;

    const initialTimer = setTimeout(() => {
      void syncAdminVaultsNow(user.email);
    }, 1500);
    const periodicTimer = setInterval(() => {
      void syncAdminVaultsNow(user.email);
    }, 120000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicTimer);
      if (vaultDirtyTimerRef.current) {
        clearTimeout(vaultDirtyTimerRef.current);
        vaultDirtyTimerRef.current = null;
      }
    };
  }, [user?.id, user?.email, isPrivileged, syncAdminVaultsNow]);

  // Keep authenticated Firebase Cloud profile, student competition stats, & school accounts synchronized
  useEffect(() => {
    if (!user) return;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (
        !fbUser ||
        !fbUser.emailVerified ||
        (fbUser.email || '').trim().toLowerCase() !== user.email.trim().toLowerCase()
      ) {
        return;
      }
      void (async () => {
        try {
          if (user.role === 'student' && !user.isAdmin) {
            const comp = await apiFetch<{
              myStats?: { totalPoints?: number; quizzesCompleted?: number; correctAnswers?: number };
            }>('/api/competition/leaderboard').catch(() => null);
            await syncCurrentUserToFirestore(user, comp?.myStats);
          } else {
            await syncCurrentUserToFirestore(user);
          }
        } catch {
          // non-fatal cloud profile sync
        }
        if (user.email.trim().toLowerCase() === MAIN_ADMIN_EMAIL) {
          void syncCloudSchoolMirrorNow(user.email);
        }
      })();
    });
    return () => unsub();
  }, [user?.id, user?.email, user?.role, user?.isAdmin, leaderboardVersion, syncCloudSchoolMirrorNow]);

  // Real-time WebSocket for student presence & live Admin Dashboard rankings
  useEffect(() => {
    if (!user || isStaticHostMode()) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled || isStaticHostMode()) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getStoredSessionToken();
      const wsUrl = `${protocol}//${window.location.host}/ws${
        token ? `?token=${encodeURIComponent(token)}` : ''
      }`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'presence:section', section: activeTab }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: unknown;
          };
          if (msg.type === 'auth:force_logout') {
            const reason =
              (msg.payload as { reason?: string } | undefined)?.reason || 'account_deleted';
            void resetClientAuthState(false, reason);
          } else if (msg.type === 'admin:dashboard' && msg.payload) {
            setAdminSnapshot(msg.payload as AdminDashboardSnapshot);
          } else if (msg.type === 'admin:users_updated') {
            wsEventSeqRef.current += 1;
            setLiveCommunityEvent({
              seq: wsEventSeqRef.current,
              type: 'admin:users_updated',
              payload: msg.payload,
            });
            if (isPrivileged) {
              void fetchAdminDashboard();
            }
          } else if (msg.type === 'announcement:created') {
            void fetchAnnouncements();
            void fetchNotifications();
            const p = (msg.payload || {}) as {
              id?: number;
              title?: string;
              content?: string;
              type?: 'announcement' | 'material';
              created_by?: number;
            };
            const activeUser = userRef.current;
            if (
              activeUser &&
              activeUser.notifications_enabled !== false &&
              p.created_by !== activeUser.id &&
              p.title
            ) {
              const notifTitle =
                p.type === 'material'
                  ? `New Study Material: ${p.title}`
                  : `Announcement: ${p.title}`;
              void showDeviceScreenNotification(notifTitle, (p.content || '').slice(0, 140), {
                tag: `grade9hub-ann-${p.id ?? Date.now()}`,
                tab: 'home',
              });
            }
          } else if (msg.type === 'announcement:deleted') {
            void fetchAnnouncements();
            void fetchNotifications();
          } else if (msg.type === 'notification:new') {
            void fetchNotifications();
            const p = (msg.payload || {}) as {
              title?: string;
              body?: string;
              linkTab?: string;
              createdBy?: number;
            };
            const activeUser = userRef.current;
            if (
              activeUser &&
              activeUser.notifications_enabled !== false &&
              p.createdBy !== activeUser.id &&
              p.title
            ) {
              void showDeviceScreenNotification(p.title, (p.body || '').slice(0, 140), {
                tag: `grade9hub-ws-${Date.now()}`,
                tab: p.linkTab || 'notifications',
              });
            }
          } else if (msg.type === 'admin:vault_dirty' && isPrivileged && user?.email) {
            if (vaultDirtyTimerRef.current) {
              clearTimeout(vaultDirtyTimerRef.current);
            }
            const targetEmail = user.email;
            vaultDirtyTimerRef.current = setTimeout(() => {
              vaultDirtyTimerRef.current = null;
              void syncAdminVaultsNow(targetEmail);
            }, 1500);
          } else if (
            msg.type &&
            (msg.type.startsWith('community:') || msg.type === 'admin:community_event')
          ) {
            if (msg.type === 'community:restriction' && msg.payload) {
              const p = msg.payload as { isRestricted?: boolean; restrictionReason?: string };
              setUser((prev) =>
                prev
                  ? {
                      ...prev,
                      isRestricted: Boolean(p.isRestricted),
                      restrictionReason: p.restrictionReason || '',
                    }
                  : prev
              );
            }
            wsEventSeqRef.current += 1;
            setLiveCommunityEvent({
              seq: wsEventSeqRef.current,
              type: msg.type,
              payload: msg.payload,
            });
          } else if (msg.type === 'leaderboard:update') {
            setLeaderboardVersion((v) => v + 1);
          } else if (msg.type === 'app:settings' && msg.payload) {
            const nextSettings = msg.payload as AppSettings;
            const nextSlides = sanitizeHeroSlidesList(nextSettings.heroSlides);
            if (nextSlides.length > 0) {
              saveLocalHeroSlides(nextSlides);
              broadcastHeroBannersUpdated(nextSlides);
            }
            setAppSettings(nextSettings);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        setWsConnected(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [user?.id]);

  // Notify server of active educational tab when navigating
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'presence:section', section: activeTab }));
    }
  }, [activeTab]);

  // Keep student live online presence active via WS heartbeat + HTTP heartbeat fallback & offline beacon
  useEffect(() => {
    if (!user) return;
    const currentSection = activeTab;

    const sendPresenceHeartbeat = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'presence:heartbeat', section: currentSection }));
        return;
      }
      void apiFetch('/api/presence/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ section: currentSection }),
      }).catch(() => {});
    };

    const sendOfflineSignal = () => {
      try {
        const token = getStoredSessionToken();
        if (
          !isStaticHostMode() &&
          typeof navigator !== 'undefined' &&
          typeof navigator.sendBeacon === 'function'
        ) {
          const blob = new Blob([JSON.stringify({ token: token || undefined })], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/presence/offline', blob);
        } else {
          void apiFetch('/api/presence/offline', {
            method: 'POST',
            keepalive: true,
            body: JSON.stringify({ token: token || undefined }),
          }).catch(() => {});
        }
      } catch {
        // ignore unload errors
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        sendPresenceHeartbeat();
      }
    };

    sendPresenceHeartbeat();
    const timer = setInterval(sendPresenceHeartbeat, 20000);
    window.addEventListener('online', sendPresenceHeartbeat);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', sendOfflineSignal);
    window.addEventListener('pagehide', sendOfflineSignal);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', sendPresenceHeartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', sendOfflineSignal);
      window.removeEventListener('pagehide', sendOfflineSignal);
    };
  }, [user?.id, activeTab]);

  const saveNotificationChoice = useCallback(
    async (targetUserId: number, choice: 'allowed' | 'denied') => {
      const localPromptKey = `grade9hub_notif_prompt_${targetUserId}`;
      try {
        window.localStorage.setItem(localPromptKey, choice);
      } catch {
        // ignore storage errors
      }
      try {
        const res = await apiFetch<{ user: User }>('/api/notifications/permission-choice', {
          method: 'POST',
          body: JSON.stringify({ choice }),
        });
        setUser((prev) => (prev && prev.id === targetUserId ? res.user : prev));
      } catch {
        setUser((prev) =>
          prev && prev.id === targetUserId
            ? {
                ...prev,
                notif_prompt_status: choice,
                notifications_enabled: choice === 'allowed',
              }
            : prev
        );
      }
    },
    []
  );

  // Prompt once via user-gesture modal on first login, and silently sync already-granted push subscriptions
  useEffect(() => {
    if (!user) {
      setShowNotifPrompt(false);
      setShowNotifBanner(false);
      return;
    }

    const localPromptKey = `grade9hub_notif_prompt_${user.id}`;
    const localBannerClosedKey = `grade9hub_notif_banner_closed_${user.id}`;
    let localChoice: string | null = null;
    let bannerClosed = false;
    try {
      localChoice = window.localStorage.getItem(localPromptKey);
      bannerClosed = window.localStorage.getItem(localBannerClosedKey) === '1';
    } catch {
      localChoice = null;
      bannerClosed = false;
    }

    const hasNotificationApi = typeof window !== 'undefined' && 'Notification' in window;
    const browserPerm: NotificationPermission = hasNotificationApi ? Notification.permission : 'default';

    const alreadyAnswered = Boolean(user.notif_prompt_status) || Boolean(localChoice);
    if (alreadyAnswered) {
      setShowNotifPrompt(false);
      if (
        (user.notif_prompt_status === 'allowed' || localChoice === 'allowed') &&
        user.notifications_enabled !== false &&
        hasNotificationApi &&
        browserPerm === 'granted'
      ) {
        setShowNotifBanner(false);
        if (!push.isSubscribed) {
          void push.subscribe({ silentError: true });
        }
      } else if (
        (localChoice === 'dismissed' ||
          (user.notif_prompt_status === 'allowed' && browserPerm === 'default')) &&
        hasNotificationApi &&
        browserPerm === 'default' &&
        !bannerClosed
      ) {
        setShowNotifBanner(true);
      } else {
        setShowNotifBanner(false);
      }
      return;
    }

    if (promptedFirstLoginUserIdsRef.current.has(user.id)) {
      return;
    }
    promptedFirstLoginUserIdsRef.current.add(user.id);

    if (hasNotificationApi && browserPerm === 'granted') {
      setShowNotifBanner(false);
      void (async () => {
        await saveNotificationChoice(user.id, 'allowed');
        await push.subscribe({ silentError: true });
        push.refreshStatus();
      })();
      return;
    }

    if (hasNotificationApi && browserPerm === 'denied') {
      setShowNotifBanner(false);
      void saveNotificationChoice(user.id, 'denied');
      push.refreshStatus();
      return;
    }

    // Show Grade 9 Hub permission dialog so Notification.requestPermission() runs from explicit tap/click
    setShowNotifPrompt(true);
  }, [
    user?.id,
    user?.notif_prompt_status,
    user?.notifications_enabled,
    push.isSubscribed,
    push.subscribe,
    push.refreshStatus,
    saveNotificationChoice,
  ]);

  const handleAllowNotifications = async () => {
    if (!user) return;
    setShowNotifPrompt(false);
    const granted = await push.subscribe({ silentError: true });
    push.refreshStatus();

    if (granted) {
      setShowNotifBanner(false);
      await saveNotificationChoice(user.id, 'allowed');
      return;
    }

    const browserPerm =
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : 'default';

    if (browserPerm === 'denied') {
      setShowNotifBanner(false);
      await saveNotificationChoice(user.id, 'denied');
    } else {
      try {
        window.localStorage.setItem(`grade9hub_notif_prompt_${user.id}`, 'dismissed');
      } catch {
        // ignore storage errors
      }
      setShowNotifBanner(true);
    }
  };

  const handleDontAllowNotifications = async () => {
    if (!user) return;
    setShowNotifPrompt(false);
    setShowNotifBanner(false);
    await saveNotificationChoice(user.id, 'denied');
  };

  const handleEnableNotificationsFromBanner = async () => {
    if (!user) return;
    const ok = await push.subscribe();
    push.refreshStatus();
    if (ok) {
      setShowNotifBanner(false);
      await saveNotificationChoice(user.id, 'allowed');
    } else if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'denied'
    ) {
      setShowNotifBanner(false);
      await saveNotificationChoice(user.id, 'denied');
    }
  };

  const handleDismissNotifBanner = () => {
    setShowNotifBanner(false);
    if (!user) return;
    try {
      window.localStorage.setItem(`grade9hub_notif_banner_closed_${user.id}`, '1');
    } catch {
      // ignore storage errors
    }
  };

  const handleEnablePushFromApp = async () => {
    const ok = await push.subscribe();
    if (ok && user) {
      setShowNotifBanner(false);
      await saveNotificationChoice(user.id, 'allowed');
    }
    return ok;
  };

  const handleDisablePushFromApp = async () => {
    await push.unsubscribe();
    if (user) {
      await saveNotificationChoice(user.id, 'denied');
    }
  };

  const resetClientAuthState = useCallback(
    async (callServerLogout: boolean, revokedReason?: string) => {
      explicitSignOutRef.current = true;
      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        if (callServerLogout) {
          await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          try {
            window.sessionStorage.removeItem(SESSION_NOTICE_KEY);
          } catch {
            // ignore storage errors
          }
          setSessionNotice(null);
        } else if (revokedReason) {
          try {
            window.sessionStorage.setItem(SESSION_NOTICE_KEY, revokedReason);
          } catch {
            // ignore storage errors
          }
          setSessionNotice(revokedReason);
        }
        await signOutFirebaseCloud();
        clearStoredSessionToken();
        clearStoredCachedUser();
        await clearActiveVaultKey();
        setShowNotifPrompt(false);
        setShowNotifBanner(false);
        setAdminSnapshot(null);
        setNotifications([]);
        setUnreadCount(0);
        setAnnouncements([]);
        setInitialChapterSelection(null);
        setInitialStudentChatId(null);
        setInitialAnnouncementId(null);
        setInitialCommunityTarget(null);
        setUser(null);
        setActiveTab('home');
      } finally {
        explicitSignOutRef.current = false;
      }
    },
    []
  );

  // Real-time & focus/visibility/periodic session validation (immediate logout when admin deletes account)
  useEffect(() => {
    if (!user) return;
    let lastCheckedAt = 0;

    const handleRevokedEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ reason?: string }>).detail;
      void resetClientAuthState(false, detail?.reason || 'account_deleted');
    };

    const revalidateSessionNow = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheckedAt < 5000) return;
      lastCheckedAt = now;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const res = await apiFetch<{
          user: User | null;
          sessionRevoked?: boolean;
          reason?: string;
        }>('/api/auth/me');
        if (!res.user && res.sessionRevoked) {
          void resetClientAuthState(false, res.reason || 'account_deleted');
        }
      } catch {
        // ignore transient network glitches
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        void revalidateSessionNow(false);
      }
    };
    const handleFocusOrOnline = () => {
      void revalidateSessionNow(false);
    };

    window.addEventListener('grade9hub:session-revoked', handleRevokedEvent);
    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const unsubscribeCloudValidity = subscribeCurrentUserAccountValidity(user.email, (reason) => {
      void resetClientAuthState(false, reason);
    });

    const intervalId = setInterval(() => {
      void revalidateSessionNow(false);
    }, 30000);

    return () => {
      window.removeEventListener('grade9hub:session-revoked', handleRevokedEvent);
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribeCloudValidity();
      clearInterval(intervalId);
    };
  }, [user?.id, user?.email, resetClientAuthState]);

  // Real-time Firestore Announcements & Screen/Device Notification listener across devices
  useEffect(() => {
    if (!user) return;
    const seenKey = `grade9hub_seen_cloud_ann_${user.id}`;
    let hasSeeded = false;
    const seenIds = new Set<string>();
    try {
      const raw = window.localStorage.getItem(seenKey);
      if (raw) {
        hasSeeded = true;
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (typeof entry === 'string') seenIds.add(entry);
          }
        }
      }
    } catch {
      // ignore storage errors
    }

    const persistSeen = () => {
      try {
        window.localStorage.setItem(seenKey, JSON.stringify(Array.from(seenIds).slice(-200)));
      } catch {
        // ignore storage errors
      }
    };

    const unsub = subscribeCloudAnnouncements((cloudList) => {
      if (!hasSeeded) {
        for (const item of cloudList) {
          seenIds.add(item.announcementId);
        }
        hasSeeded = true;
        persistSeen();
      } else {
        const myFbUid = auth.currentUser?.uid || '';
        const newlyArrived = cloudList.filter(
          (item) => !seenIds.has(item.announcementId)
        );
        if (newlyArrived.length > 0) {
          for (const item of newlyArrived) {
            seenIds.add(item.announcementId);
          }
          persistSeen();

          const fromOthers = newlyArrived.filter(
            (item) => !myFbUid || item.authorUid !== myFbUid
          );
          if (fromOthers.length > 0 && user.notifications_enabled !== false) {
            const latest = fromOthers[0];
            const notifTitle =
              latest.type === 'material'
                ? `New Study Material: ${latest.title}`
                : `Announcement: ${latest.title}`;
            void showDeviceScreenNotification(
              notifTitle,
              (latest.content || '').slice(0, 140),
              {
                tag: `grade9hub-ann-${latest.announcementId}`,
                tab: 'home',
              }
            );
          }
        }
      }

      if (isStaticHostMode()) {
        void fetchAnnouncements();
        void fetchNotifications();
      } else if (cloudList.length > 0) {
        setAnnouncements((prev) => {
          const existingKeys = new Set(prev.map((a) => `${a.title.trim()}::${a.content.trim()}`));
          const additions: Announcement[] = [];
          for (const item of cloudList) {
            const key = `${item.title.trim()}::${item.content.trim()}`;
            if (existingKeys.has(key) || prev.some((a) => a.id === item.id)) {
              continue;
            }
            existingKeys.add(key);
            additions.push({
              id: item.id,
              title: item.title,
              content: item.content,
              type: item.type,
              attachment_name: item.attachment_name,
              attachment_url: item.attachment_url,
              attachment_mime: item.attachment_mime,
              created_at: item.created_at,
              author_name: item.author_name,
            });
          }
          if (additions.length === 0) return prev;
          return [...additions, ...prev].sort(
            (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id
          );
        });
        void fetchNotifications();
      }
    });

    return () => unsub();
  }, [user?.id, user?.notifications_enabled, fetchAnnouncements, fetchNotifications]);

  // Listen to Service Worker notification clicks & background push broadcasts
  useEffect(() => {
    const handleSwMessage = (data: unknown) => {
      if (!data || typeof data !== 'object') return;
      const msg = data as {
        type?: string;
        tab?: string;
        url?: string;
        communityTab?: string;
        peerId?: string | number;
        groupId?: string | number;
        studentId?: string | number;
        announcementId?: string | number;
        postId?: string | number;
      };

      if (msg.type === 'OPEN_NOTIFICATION_TARGET') {
        const targetTab =
          msg.tab && VALID_TABS.has(msg.tab as TabId) ? (msg.tab as TabId) : 'notifications';
        setActiveTab(targetTab);
        setMobileMenuOpen(false);

        const annId = parsePositiveInt(
          msg.announcementId !== undefined ? String(msg.announcementId) : null
        );
        if (annId) {
          setInitialAnnouncementId(annId);
          if (userRef.current) {
            void fetchAnnouncements().catch(() => {});
          }
        }

        const studentId = parsePositiveInt(
          msg.studentId !== undefined ? String(msg.studentId) : null
        );
        if (studentId) {
          setInitialStudentChatId(studentId);
        }

        const peerId = parsePositiveInt(msg.peerId !== undefined ? String(msg.peerId) : null);
        const groupId = parsePositiveInt(msg.groupId !== undefined ? String(msg.groupId) : null);
        const postId = parsePositiveInt(msg.postId !== undefined ? String(msg.postId) : null);
        const communityTab =
          msg.communityTab === 'feed' ||
          msg.communityTab === 'active' ||
          msg.communityTab === 'dm' ||
          msg.communityTab === 'groups'
            ? msg.communityTab
            : undefined;

        if (communityTab || peerId || groupId || postId) {
          communityNavSeqRef.current += 1;
          setInitialCommunityTarget({
            seq: communityNavSeqRef.current,
            tab: communityTab,
            peerId,
            groupId,
            postId,
          });
        }

        if (userRef.current) {
          void fetchNotifications().catch(() => {});
        }
      } else if (msg.type === 'OPEN_TAB' && msg.tab && VALID_TABS.has(msg.tab as TabId)) {
        setActiveTab(msg.tab as TabId);
        setMobileMenuOpen(false);
      } else if (msg.type === 'PUSH_RECEIVED' && userRef.current) {
        void fetchNotifications().catch(() => {});
        void fetchAnnouncements().catch(() => {});
      }
    };

    const onSwMessage = (event: MessageEvent) => {
      handleSwMessage(event.data);
    };

    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', onSwMessage);
      }
    } catch {
      // ignore unsupported SW message listener
    }

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('grade9hub-push');
        channel.onmessage = (event) => handleSwMessage(event.data);
      }
    } catch {
      // ignore BroadcastChannel failures
    }

    return () => {
      try {
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', onSwMessage);
        }
      } catch {
        // ignore cleanup failure
      }
      try {
        channel?.close();
      } catch {
        // ignore close failure
      }
    };
  }, [fetchNotifications, fetchAnnouncements]);

  const handleLogout = () => resetClientAuthState(true);
  const handleAccountDeleted = () => resetClientAuthState(false);

  const navigateTo = (tab: TabId) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const openAdminSearch = () => {
    setActiveTab('admin-dashboard');
    setMobileMenuOpen(false);
    setFocusAdminSearchTrigger((n) => n + 1);
  };

  const navItems: Array<{
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'community', label: t.nav.community, icon: Users },
    { id: 'competition', label: t.nav.competition, icon: Trophy },
    ...(isPrivileged
      ? [
          {
            id: 'admin-dashboard' as TabId,
            label: t.nav.adminDashboard,
            icon: ShieldCheck,
            badge:
              adminSnapshot && adminSnapshot.activeCount > 0
                ? adminSnapshot.activeCount
                : undefined,
          },
        ]
      : []),
    { id: 'multiple-choice', label: t.nav.multipleChoice, icon: BookOpen },
    { id: 'textbooks-qa', label: t.nav.textbooksQa, icon: Library },
    { id: 'general-questions', label: t.nav.generalQuestions, icon: HelpCircle },
    { id: 'ask-teacher', label: t.nav.askTeacher, icon: MessageSquare },
    {
      id: 'notifications',
      label: t.nav.notifications,
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: 'ai-studio', label: t.nav.scienceStudio, icon: Sparkles },
    { id: 'profile', label: t.nav.profile, icon: UserIcon },
    { id: 'settings', label: t.nav.settings, icon: Settings },
    { id: 'about', label: t.nav.about, icon: Info },
  ];

  const mobileBottomItems = [
    navItems.find((i) => i.id === 'home')!,
    navItems.find((i) => i.id === 'multiple-choice')!,
    navItems.find((i) => i.id === 'ask-teacher')!,
    navItems.find((i) => i.id === 'notifications')!,
    navItems.find((i) => i.id === 'ai-studio')!,
  ];

  const drawerAnimClass =
    dir === 'rtl' ? 'g9-animate-drawer-rtl' : 'g9-animate-drawer-ltr';
  const CollapseIcon = sidebarCollapsed
    ? dir === 'rtl'
      ? ChevronLeft
      : ChevronRight
    : dir === 'rtl'
    ? ChevronRight
    : ChevronLeft;

  if (!authChecked) {
    return (
      <>
        <SplashScreen visible={true} />
        <OfflineIndicator />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SplashScreen visible={showSplash} />
        <AuthPage
          sessionNotice={sessionNotice}
          onDismissSessionNotice={() => {
            setSessionNotice(null);
            try {
              window.sessionStorage.removeItem(SESSION_NOTICE_KEY);
            } catch {
              // ignore storage errors
            }
          }}
          onAuthenticated={(loggedInUser) => {
            setSessionNotice(null);
            try {
              window.sessionStorage.removeItem(SESSION_NOTICE_KEY);
            } catch {
              // ignore storage errors
            }
            setStoredCachedUser(loggedInUser);
            setUser(loggedInUser);
          }}
        />
        <OfflineIndicator />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#FAF8F5] text-[#1C1917]">
      <SplashScreen visible={showSplash} />
      <OfflineIndicator />
      <NotificationPermissionModal
        visible={showNotifPrompt}
        isIosBrowserTab={push.isIosBrowserTab}
        onAllow={handleAllowNotifications}
        onDontAllow={handleDontAllowNotifications}
      />

      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-white border-e border-[#E6DFD5] transition-[width] duration-200 ease-out sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-20' : 'w-68'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-[#E6DFD5] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
              alt="Grade 9 Hub Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-contain border border-[#E6DFD5] bg-white p-0.5 shrink-0"
            />
            {!sidebarCollapsed && (
              <span className="font-bold text-base tracking-tight text-[#6B1118] truncate">
                {t.brand.appName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
            className="p-1.5 rounded-lg text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#1C1917] cursor-pointer shrink-0"
          >
            <CollapseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                  active
                    ? 'bg-[#6B1118] text-white'
                    : 'text-[#57534E] hover:bg-[#FAF8F5] hover:text-[#1C1917]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      active ? 'text-[#E5B742]' : 'text-[#6B1118]'
                    }`}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  )}
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs font-bold tabular-nums shrink-0 ${
                      active ? 'text-[#E5B742]' : 'text-[#6B1118]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions & Branding */}
        <div className="p-3 border-t border-[#E6DFD5] space-y-2.5">
          {!sidebarCollapsed && <PWAInstallButton />}

          <div
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center flex-col gap-2' : 'justify-between gap-2'
            } px-2 py-1.5`}
          >
            <button
              type="button"
              onClick={() => navigateTo('profile')}
              title={user.name}
              className={`flex items-center gap-2.5 min-w-0 text-start cursor-pointer group ${
                sidebarCollapsed ? 'justify-center' : 'flex-1'
              }`}
            >
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatar_url}
                sizeClass="w-8 h-8"
                textClass="text-xs"
              />
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#1C1917] truncate group-hover:text-[#6B1118] transition-colors">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-[#57534E] truncate">
                    {user.isAdmin
                      ? t.home.mainAdmin
                      : user.role === 'teacher'
                      ? t.profile.teacherAccount
                      : t.profile.studentAccount}
                  </p>
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title={t.nav.logOut}
              aria-label={t.nav.logOut}
              className="p-2 rounded-lg text-[#57534E] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {!sidebarCollapsed && (
            <p className="text-[11px] font-medium text-[#57534E] px-2">
              {t.brand.poweredBy}
            </p>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-black/45 lg:hidden g9-animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-72 h-full bg-white border-e border-[#E6DFD5] flex flex-col ${drawerAnimClass}`}
          >
              <div className="h-14 px-4 border-b border-[#E6DFD5] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
                    alt="Grade 9 Hub Logo"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg object-contain border border-[#E6DFD5] bg-white p-0.5 shrink-0"
                  />
                  <span className="font-bold text-base text-[#6B1118]">
                    {t.brand.appName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={t.nav.collapseSidebar}
                  className="p-2 text-[#57534E] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.id)}
                      className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-sm font-medium cursor-pointer min-h-[44px] ${
                        active
                          ? 'bg-[#6B1118] text-white'
                          : 'text-[#57534E] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-5 h-5 ${
                            active ? 'text-[#E5B742]' : 'text-[#6B1118]'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="text-xs font-bold tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-[#E6DFD5] space-y-3">
                <button
                  type="button"
                  onClick={() => navigateTo('profile')}
                  className="w-full flex items-center gap-3 rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] p-2.5 text-start cursor-pointer"
                >
                  <UserAvatar
                    name={user.name}
                    avatarUrl={user.avatar_url}
                    sizeClass="w-9 h-9"
                    textClass="text-sm"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#1C1917] truncate">{user.name}</p>
                    <p className="text-[11px] text-[#57534E] truncate">
                      {user.isAdmin
                        ? t.home.mainAdmin
                        : user.role === 'teacher'
                        ? t.profile.teacherAccount
                        : t.profile.studentAccount}
                    </p>
                  </div>
                </button>
                <PWAInstallButton />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#E6DFD5] py-2.5 text-sm font-semibold text-[#6B1118] cursor-pointer min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.nav.logOut}</span>
                </button>
                <p className="text-center text-xs text-[#57534E]">
                  {t.brand.poweredBy}
                </p>
              </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Mobile / Tablet Top Header with Language Chooser */}
        <header className="lg:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-sm border-b border-[#E6DFD5] px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t.nav.expandSidebar}
              className="p-2 -ms-1.5 text-[#1C1917] cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img
              src="/assets/aistudio/letter-9-education-logo-book-concept-training-career-sign-university-academy-graduation-logo-template-design-vector_3d279672.jpg"
              alt="Grade 9 Hub Logo"
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-md object-contain border border-[#E6DFD5] bg-white p-0.5 shrink-0"
            />
            <span className="font-bold text-sm text-[#6B1118] truncate">
              {t.brand.appName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPrivileged && (
              <button
                type="button"
                onClick={openAdminSearch}
                aria-label={t.nav.adminDashboard}
                className="p-2 text-[#6B1118] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
            <ThemeToggleButton compact tone="light" />
            <LanguageSwitcher compact tone="light" />
            <button
              type="button"
              onClick={() => navigateTo('notifications')}
              aria-label={t.nav.notifications}
              className="relative p-2 text-[#1C1917] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
            >
              <Bell className="w-5 h-5 text-[#6B1118]" />
              {unreadCount > 0 && (
                <span className="absolute top-1 end-1 text-[10px] font-bold bg-[#6B1118] text-white rounded-full px-1.5 leading-4 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Desktop / Laptop Top Bar featuring Science AI Studio & Language Switcher */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-sm border-b border-[#E6DFD5] px-10 items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-base font-bold tracking-tight text-[#6B1118] whitespace-nowrap">
              {t.brand.scienceStudio}
            </span>
            <span className="text-[#E6DFD5]" aria-hidden="true">|</span>
            <span className="text-xs font-medium text-[#57534E] truncate">
              {t.brand.schoolTag}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isPrivileged && (
              <button
                type="button"
                onClick={openAdminSearch}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5 text-[#6B1118]" />
                <span>{t.nav.adminDashboard}</span>
                {adminSnapshot && adminSnapshot.activeCount > 0 && (
                  <span className="ms-0.5 rounded bg-[#059669] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {adminSnapshot.activeCount}
                  </span>
                )}
              </button>
            )}
            <LanguageSwitcher tone="light" />
            <ThemeToggleButton tone="light" />
            {activeTab !== 'ai-studio' && (
              <button
                type="button"
                onClick={() => navigateTo('ai-studio')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D9A62E]" />
                <span>{t.nav.openStudioBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateTo('notifications')}
              aria-label={t.nav.notifications}
              className="relative p-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118] cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#6B1118]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 text-[10px] font-bold bg-[#6B1118] text-white rounded-full px-1.5 leading-4 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-5 sm:py-7 pb-24 lg:pb-10 max-w-6xl w-full mx-auto">
          {activeTab !== 'home' && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-[#E6DFD5] bg-[#FBF4DF]/65 px-4 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm text-[#1C1917]"
            >
              <Sparkles className="w-4 h-4 text-[#6B1118] shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-[#6B1118]">{studentGreeting}</strong>
                <span className="text-[#57534E]"> — {t.brand.heroJourneySubtitle}</span>
              </span>
            </div>
          )}

          {appSettings?.maintenanceMessage?.trim() && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[#F3D8A8] bg-[#FFFBEB] px-4 py-2.5 text-xs sm:text-sm text-[#92400E] flex items-center gap-2.5"
            >
              <ShieldCheck className="w-4 h-4 text-[#B45309] shrink-0" />
              <span className="font-medium">{appSettings.maintenanceMessage}</span>
            </div>
          )}

          {showNotifBanner && !showNotifPrompt && (
            <div
              role="region"
              aria-label={t.notifPrompt.bannerTitle}
              className="mb-6 rounded-2xl border border-[#E6DFD5] bg-white px-4 py-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-[#6B1118]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1C1917]">{t.notifPrompt.bannerTitle}</p>
                  <p className="text-xs text-[#57534E] mt-0.5">{t.notifPrompt.bannerDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={push.busy}
                  onClick={handleEnableNotificationsFromBanner}
                  className="rounded-xl bg-[#6B1118] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 transition-colors cursor-pointer min-h-[38px]"
                >
                  {push.busy ? t.notifications.enablingPush : t.notifPrompt.bannerEnableBtn}
                </button>
                <button
                  type="button"
                  onClick={handleDismissNotifBanner}
                  aria-label={t.notifPrompt.bannerDismissLabel}
                  className="p-2 rounded-lg text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <FirestoreErrorBoundary resetKey={`${activeTab}-${user.id}`} compact>
            <div key={activeTab} className="g9-animate-fade-slide">
              {activeTab === 'home' && (
                <HomeView
                  user={user}
                  chapters={chapters}
                  generalCount={generalCount}
                  announcements={announcements}
                  unreadNotifications={unreadCount}
                  leaderboardVersion={leaderboardVersion}
                  appSettings={appSettings}
                  onAppSettingsUpdated={(nextSettings) => setAppSettings(nextSettings)}
                  onNavigate={navigateTo}
                  onSelectChapter={(target) => setInitialChapterSelection(target)}
                  onRefreshAnnouncements={fetchAnnouncements}
                  initialAnnouncementId={initialAnnouncementId}
                  onClearInitialAnnouncementId={() => setInitialAnnouncementId(null)}
                />
              )}

              {activeTab === 'community' && (
                <CommunityView
                  user={user}
                  chapters={chapters}
                  liveEvent={liveCommunityEvent}
                  wsConnected={wsConnected}
                  appSettings={appSettings}
                  initialNavTarget={initialCommunityTarget}
                />
              )}

              {activeTab === 'competition' && (
                <CompetitionView
                  user={user}
                  leaderboardVersion={leaderboardVersion}
                  liveEvent={liveCommunityEvent}
                  onNavigate={navigateTo}
                />
              )}

              {activeTab === 'admin-dashboard' && isPrivileged && (
                <AdminDashboardView
                  currentUser={user}
                  snapshot={adminSnapshot}
                  wsConnected={wsConnected}
                  focusSearchTrigger={focusAdminSearchTrigger}
                  liveEvent={liveCommunityEvent}
                  appSettings={appSettings}
                  onSettingsUpdated={(nextSettings) => setAppSettings(nextSettings)}
                  onRefreshDashboard={fetchAdminDashboard}
                  onNavigate={navigateTo}
                  onSelectChapter={(target) => setInitialChapterSelection(target)}
                  onOpenStudentChat={(studentId) => {
                    setInitialStudentChatId(studentId);
                    navigateTo('ask-teacher');
                  }}
                />
              )}

              {activeTab === 'multiple-choice' && (
                <MultipleChoiceView
                  user={user}
                  chapters={chapters}
                  initialSelection={initialChapterSelection}
                  onClearInitialSelection={() => setInitialChapterSelection(null)}
                  onRefreshChapters={fetchChapters}
                />
              )}

              {activeTab === 'textbooks-qa' && (
                <TextbooksQAView
                  user={user}
                  onNavigate={navigateTo}
                  onSelectChapter={(target) => setInitialChapterSelection(target)}
                />
              )}

              {activeTab === 'general-questions' && (
                <GeneralQuestionsView
                  user={user}
                  onRefreshChapters={fetchChapters}
                />
              )}

              {activeTab === 'ask-teacher' && (
                <AskTeacherView
                  user={user}
                  initialStudentId={initialStudentChatId}
                  liveEvent={liveCommunityEvent}
                  onClearInitialStudentId={() => setInitialStudentChatId(null)}
                  onRefreshNotifications={fetchNotifications}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView
                  notifications={notifications}
                  unreadCount={unreadCount}
                  pushSupported={push.supported}
                  pushSubscribed={push.isSubscribed}
                  pushPermission={push.permission}
                  pushBusy={push.busy}
                  pushError={push.error}
                  pushUnsupportedReason={push.unsupportedReason}
                  pushTestBusy={push.testBusy}
                  pushTestResult={push.testResult}
                  onEnablePush={handleEnablePushFromApp}
                  onDisablePush={handleDisablePushFromApp}
                  onSendTestPush={push.sendTestPush}
                  onRefresh={fetchNotifications}
                  onNavigate={navigateTo}
                />
              )}

              {activeTab === 'ai-studio' &&
                (!isPrivileged && appSettings && !appSettings.aiTutorEnabled ? (
                  <div className="rounded-2xl border border-[#E6DFD5] bg-white p-8 text-center">
                    <Sparkles className="w-8 h-8 text-[#6B1118] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[#1C1917]">
                      {t.admin.aiDisabledNotice}
                    </p>
                  </div>
                ) : (
                  <AIStudioView />
                ))}

              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  onUserUpdated={(updated) => {
                    setStoredCachedUser(updated);
                    setUser(updated);
                    void syncCurrentUserToFirestore(updated).catch(() => {});
                    if (updated.role === 'teacher' || updated.isAdmin) {
                      void syncAdminVaultsNow(updated.email);
                    }
                  }}
                  onAccountDeleted={handleAccountDeleted}
                  pushSupported={push.supported}
                  pushSubscribed={push.isSubscribed}
                  pushPermission={push.permission}
                  pushBusy={push.busy}
                  pushError={push.error}
                  pushUnsupportedReason={push.unsupportedReason}
                  pushTestBusy={push.testBusy}
                  pushTestResult={push.testResult}
                  onEnablePush={handleEnablePushFromApp}
                  onDisablePush={handleDisablePushFromApp}
                  onSendTestPush={push.sendTestPush}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  onNavigate={navigateTo}
                  pushSupported={push.supported}
                  pushSubscribed={push.isSubscribed}
                  pushPermission={push.permission}
                  pushBusy={push.busy}
                  pushError={push.error}
                  pushUnsupportedReason={push.unsupportedReason}
                  pushTestBusy={push.testBusy}
                  pushTestResult={push.testResult}
                  onEnablePush={handleEnablePushFromApp}
                  onDisablePush={handleDisablePushFromApp}
                  onSendTestPush={push.sendTestPush}
                />
              )}

              {activeTab === 'about' && <AboutView />}
            </div>
          </FirestoreErrorBoundary>
        </main>

        <footer className="hidden lg:flex items-center justify-between px-10 py-4 border-t border-[#E6DFD5] text-xs text-[#57534E] max-w-6xl w-full mx-auto">
          <span>{t.brand.schoolTag}</span>
          <span className="font-semibold text-[#6B1118]">{t.brand.poweredBy}</span>
        </footer>
      </div>

      {/* Compact Mobile Bottom Thumb Navigation (56px) */}
      <nav
        aria-label="Quick navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 pb-safe bg-white/95 backdrop-blur-md border-t border-[#E6DFD5] grid grid-cols-5 items-center"
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className="relative flex flex-col items-center justify-center h-full cursor-pointer"
            >
              <Icon
                className={`w-5 h-5 ${
                  active ? 'text-[#6B1118]' : 'text-[#57534E]'
                }`}
              />
              <span
                className={`text-[10px] mt-0.5 truncate max-w-[68px] ${
                  active ? 'font-bold text-[#6B1118]' : 'font-medium text-[#57534E]'
                }`}
              >
                {item.id === 'multiple-choice'
                  ? t.nav.quizzesShort
                  : item.id === 'ask-teacher'
                  ? t.nav.teacherShort
                  : item.id === 'ai-studio'
                  ? t.nav.studioShort
                  : item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
