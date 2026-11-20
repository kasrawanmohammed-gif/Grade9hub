import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  Flag,
  Globe,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  Lock,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Chapter,
  CommunityComment,
  CommunityDirectMessage,
  CommunityDmThread,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMessage,
  CommunityPeer,
  CommunityPost,
  CommunityReactionType,
  User,
} from '../types';
import { UserAvatar } from './UserAvatar';

export interface LiveCommunityEvent {
  seq: number;
  type: string;
  payload?: unknown;
}

interface CommunityViewProps {
  user: User;
  chapters: Chapter[];
  liveEvent: LiveCommunityEvent | null;
  onUserUpdated?: (patch: Partial<User>) => void;
}

type CommunityTab = 'feed' | 'active' | 'dm' | 'groups';

interface ReportDraft {
  targetType: 'post' | 'comment' | 'dm' | 'group_message' | 'user';
  targetId: number;
  label: string;
}

function formatUtcTimestamp(ts: string | null | undefined): string {
  if (!ts) return '';
  const iso = ts.includes('T') || ts.endsWith('Z') ? ts : `${ts.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDownloadHref(url: string, name: string | null): string {
  const filename = url.split('/').pop() || '';
  if (!filename) return url;
  return `/api/uploads/download/${encodeURIComponent(filename)}?name=${encodeURIComponent(
    name || filename
  )}`;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  user,
  chapters,
  liveEvent,
}) => {
  const { t } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const isRestricted = Boolean(user.isRestricted && !isPrivileged);

  const [tab, setTab] = useState<CommunityTab>('feed');
  const [statusBanner, setStatusBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Peers & Presence
  const [peers, setPeers] = useState<CommunityPeer[]>([]);
  const [peerSearch, setPeerSearch] = useState('');

  // Feed State
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [feedSearch, setFeedSearch] = useState('');
  const [feedChapter, setFeedChapter] = useState<string>('');
  const [postContent, setPostContent] = useState('');
  const [postChapter, setPostChapter] = useState<string>('');
  const [postFile, setPostFile] = useState<File | null>(null);
  const [publishingPost, setPublishingPost] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const postFileInputRef = useRef<HTMLInputElement | null>(null);

  // DM State
  const [dmThreads, setDmThreads] = useState<CommunityDmThread[]>([]);
  const [dmSearch, setDmSearch] = useState('');
  const [selectedPeerId, setSelectedPeerId] = useState<number | null>(null);
  const [dmMessages, setDmMessages] = useState<CommunityDirectMessage[]>([]);
  const [loadingDm, setLoadingDm] = useState(false);
  const [dmText, setDmText] = useState('');
  const [dmFile, setDmFile] = useState<File | null>(null);
  const [sendingDm, setSendingDm] = useState(false);
  const dmFileInputRef = useRef<HTMLInputElement | null>(null);
  const dmBottomRef = useRef<HTMLDivElement | null>(null);

  // Groups State
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [activeGroupDetail, setActiveGroupDetail] = useState<CommunityGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<CommunityGroupMember[]>([]);
  const [groupMessages, setGroupMessages] = useState<CommunityGroupMessage[]>([]);
  const [loadingGroupChat, setLoadingGroupChat] = useState(false);
  const [groupMsgText, setGroupMsgText] = useState('');
  const [groupMsgFile, setGroupMsgFile] = useState<File | null>(null);
  const [sendingGroupMsg, setSendingGroupMsg] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState<string>('');
  const groupFileInputRef = useRef<HTMLInputElement | null>(null);
  const groupBottomRef = useRef<HTMLDivElement | null>(null);

  // Create Group Modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupPublic, setNewGroupPublic] = useState(true);
  const [newGroupMembers, setNewGroupMembers] = useState<number[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Report Modal
  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const showToast = useCallback((kind: 'ok' | 'err', text: string) => {
    setStatusBanner({ kind, text });
    setTimeout(() => {
      setStatusBanner((cur) => (cur?.text === text ? null : cur));
    }, 4500);
  }, []);

  const fetchPeers = useCallback(async () => {
    try {
      const data = await apiFetch<{ peers: CommunityPeer[] }>('/api/community/peers');
      setPeers(data.peers);
    } catch {
      // ignore transient error
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (feedSearch.trim()) params.set('q', feedSearch.trim());
      if (feedChapter) params.set('chapter', feedChapter);
      const qs = params.toString();
      const data = await apiFetch<{ posts: CommunityPost[] }>(
        `/api/community/posts${qs ? `?${qs}` : ''}`
      );
      setPosts(data.posts);
    } catch {
      // ignore
    } finally {
      setLoadingPosts(false);
    }
  }, [feedSearch, feedChapter]);

  const fetchDmThreads = useCallback(async () => {
    try {
      const data = await apiFetch<{ threads: CommunityDmThread[] }>('/api/community/dm/threads');
      setDmThreads(data.threads);
    } catch {
      // ignore
    }
  }, []);

  const fetchDmConversation = useCallback(async (peerId: number) => {
    setLoadingDm(true);
    try {
      const data = await apiFetch<{ messages: CommunityDirectMessage[] }>(
        `/api/community/dm/${peerId}`
      );
      setDmMessages(data.messages);
      setDmThreads((prev) =>
        prev.map((th) => (th.peer_id === peerId ? { ...th, unread_count: 0 } : th))
      );
    } catch {
      setDmMessages([]);
    } finally {
      setLoadingDm(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiFetch<{ groups: CommunityGroup[] }>('/api/community/groups');
      setGroups(data.groups);
    } catch {
      // ignore
    }
  }, []);

  const fetchGroupMessages = useCallback(async (groupId: number) => {
    setLoadingGroupChat(true);
    try {
      const data = await apiFetch<{
        group: CommunityGroup;
        members: CommunityGroupMember[];
        messages: CommunityGroupMessage[];
      }>(`/api/community/groups/${groupId}/messages`);
      setActiveGroupDetail(data.group);
      setGroupMembers(data.members);
      setGroupMessages(data.messages);
    } catch {
      setActiveGroupDetail(null);
      setGroupMembers([]);
      setGroupMessages([]);
    } finally {
      setLoadingGroupChat(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void Promise.all([fetchPeers(), fetchPosts(), fetchDmThreads(), fetchGroups()]);
  }, [fetchPeers, fetchPosts, fetchDmThreads, fetchGroups]);

  // Refetch filtered posts when search/chapter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPosts();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchPosts]);

  // Load selected DM thread
  useEffect(() => {
    if (selectedPeerId !== null) {
      void fetchDmConversation(selectedPeerId);
    }
  }, [selectedPeerId, fetchDmConversation]);

  // Load selected Group chat
  useEffect(() => {
    if (selectedGroupId !== null) {
      void fetchGroupMessages(selectedGroupId);
    }
  }, [selectedGroupId, fetchGroupMessages]);

  // Auto-scroll DMs & Group chat on new messages
  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages.length]);

  useEffect(() => {
    groupBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages.length]);

  // Real-time WebSocket Event Listener
  useEffect(() => {
    if (!liveEvent) return;
    const { type, payload } = liveEvent;

    if (type === 'community:presence') {
      void fetchPeers();
      void fetchDmThreads();
    } else if (type === 'community:post:created') {
      const created = payload as CommunityPost | undefined;
      if (created && created.id) {
        setPosts((prev) =>
          prev.some((p) => p.id === created.id) ? prev : [created, ...prev]
        );
      } else {
        void fetchPosts();
      }
    } else if (type === 'community:post:deleted') {
      const p = payload as { postId?: number } | undefined;
      if (p?.postId) {
        setPosts((prev) => prev.filter((item) => item.id !== p.postId));
      }
    } else if (type === 'community:comment:created') {
      const comment = payload as CommunityComment | undefined;
      if (comment && comment.id) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === comment.post_id
              ? {
                  ...post,
                  comments: post.comments.some((c) => c.id === comment.id)
                    ? post.comments
                    : [...post.comments, comment],
                }
              : post
          )
        );
      }
    } else if (type === 'community:comment:deleted') {
      const p = payload as { postId?: number; commentId?: number } | undefined;
      if (p?.postId && p?.commentId) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === p.postId
              ? {
                  ...post,
                  comments: post.comments.filter((c) => c.id !== p.commentId),
                }
              : post
          )
        );
      }
    } else if (type === 'community:post:reacted') {
      const p = payload as
        | {
            postId: number;
            reactionCounts: Record<CommunityReactionType, number>;
            totalReactions: number;
            actorId: number;
            actorReaction: CommunityReactionType | null;
          }
        | undefined;
      if (p?.postId) {
        setPosts((prev) =>
          prev.map((post) =>
            post.id === p.postId
              ? {
                  ...post,
                  reactionCounts: p.reactionCounts,
                  totalReactions: p.totalReactions,
                  myReaction: p.actorId === user.id ? p.actorReaction : post.myReaction,
                }
              : post
          )
        );
      }
    } else if (type === 'community:dm:new') {
      const msg = payload as CommunityDirectMessage | undefined;
      if (msg && msg.id) {
        const involvesActivePeer =
          selectedPeerId !== null &&
          ((msg.sender_id === user.id && msg.recipient_id === selectedPeerId) ||
            (msg.sender_id === selectedPeerId && msg.recipient_id === user.id));
        if (involvesActivePeer) {
          setDmMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
        void fetchDmThreads();
      }
    } else if (type === 'community:dm:deleted') {
      const p = payload as { id?: number } | undefined;
      if (p?.id) {
        setDmMessages((prev) => prev.filter((m) => m.id !== p.id));
        void fetchDmThreads();
      }
    } else if (type === 'community:group:updated') {
      const p = payload as { groupId?: number } | undefined;
      void fetchGroups();
      if (p?.groupId && selectedGroupId === p.groupId) {
        void fetchGroupMessages(p.groupId);
      }
    } else if (type === 'community:group:message') {
      const msg = payload as CommunityGroupMessage | undefined;
      if (msg && msg.id) {
        if (selectedGroupId === msg.group_id) {
          setGroupMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
          );
        }
        void fetchGroups();
      }
    } else if (type === 'community:group:message_deleted') {
      const p = payload as { groupId?: number; messageId?: number } | undefined;
      if (p?.messageId) {
        setGroupMessages((prev) => prev.filter((m) => m.id !== p.messageId));
        void fetchGroups();
      }
    } else if (type === 'community:group:deleted') {
      const p = payload as { groupId?: number } | undefined;
      if (p?.groupId) {
        setGroups((prev) => prev.filter((g) => g.id !== p.groupId));
        if (selectedGroupId === p.groupId) {
          setSelectedGroupId(null);
          setActiveGroupDetail(null);
          setGroupMessages([]);
        }
      }
    }
  }, [
    liveEvent,
    user.id,
    selectedPeerId,
    selectedGroupId,
    fetchPeers,
    fetchPosts,
    fetchDmThreads,
    fetchGroups,
    fetchGroupMessages,
  ]);

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

  const renderAvatar = (name: string, avatarUrl?: string, size = 'w-10 h-10') => (
    <UserAvatar
      name={name}
      avatarUrl={avatarUrl}
      sizeClass={size}
      textClass={size.includes('w-7') ? 'text-xs' : 'text-sm'}
    />
  );

  // ---------------- FEED ACTIONS ----------------
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted) return;
    if (!postContent.trim() && !postFile) return;

    setPublishingPost(true);
    try {
      const formData = new FormData();
      formData.append('content', postContent.trim());
      if (postChapter) formData.append('chapterNumber', postChapter);
      if (postFile) formData.append('attachment', postFile);

      const data = await apiFetch<{ post: CommunityPost }>('/api/community/posts', {
        method: 'POST',
        body: formData,
      });
      setPosts((prev) =>
        prev.some((p) => p.id === data.post.id) ? prev : [data.post, ...prev]
      );
      setPostContent('');
      setPostChapter('');
      setPostFile(null);
      if (postFileInputRef.current) postFileInputRef.current.value = '';
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to publish post');
    } finally {
      setPublishingPost(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    try {
      await apiFetch(`/api/community/posts/${postId}`, { method: 'DELETE' });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete post');
    }
  };

  const handleAddComment = async (postId: number) => {
    if (isRestricted) return;
    const text = (commentDrafts[postId] || '').trim();
    if (!text) return;

    try {
      const data = await apiFetch<{ comment: CommunityComment }>(
        `/api/community/posts/${postId}/comments`,
        {
          method: 'POST',
          body: JSON.stringify({ content: text }),
        }
      );
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                comments: post.comments.some((c) => c.id === data.comment.id)
                  ? post.comments
                  : [...post.comments, data.comment],
              }
            : post
        )
      );
      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to post comment');
    }
  };

  const handleDeleteComment = async (postId: number, commentId: number) => {
    try {
      await apiFetch(`/api/community/comments/${commentId}`, { method: 'DELETE' });
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? { ...post, comments: post.comments.filter((c) => c.id !== commentId) }
            : post
        )
      );
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete comment');
    }
  };

  const handleReaction = async (postId: number, reaction: CommunityReactionType) => {
    if (isRestricted) return;
    try {
      const data = await apiFetch<{
        postId: number;
        reactionCounts: Record<CommunityReactionType, number>;
        totalReactions: number;
        myReaction: CommunityReactionType | null;
      }>(`/api/community/posts/${postId}/react`, {
        method: 'POST',
        body: JSON.stringify({ reaction }),
      });
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                reactionCounts: data.reactionCounts,
                totalReactions: data.totalReactions,
                myReaction: data.myReaction,
              }
            : post
        )
      );
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to react');
    }
  };

  // ---------------- DM ACTIONS ----------------
  const openDirectChat = (peerId: number) => {
    setSelectedPeerId(peerId);
    setTab('dm');
  };

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted || !selectedPeerId) return;
    if (!dmText.trim() && !dmFile) return;

    setSendingDm(true);
    try {
      const formData = new FormData();
      formData.append('messageText', dmText.trim());
      if (dmFile) formData.append('attachment', dmFile);

      const data = await apiFetch<{ message: CommunityDirectMessage }>(
        `/api/community/dm/${selectedPeerId}`,
        { method: 'POST', body: formData }
      );
      setDmMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
      setDmText('');
      setDmFile(null);
      if (dmFileInputRef.current) dmFileInputRef.current.value = '';
      void fetchDmThreads();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSendingDm(false);
    }
  };

  const handleDeleteDm = async (messageId: number) => {
    try {
      await apiFetch(`/api/community/dm/message/${messageId}`, { method: 'DELETE' });
      setDmMessages((prev) => prev.filter((m) => m.id !== messageId));
      void fetchDmThreads();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete message');
    }
  };

  // ---------------- GROUP ACTIONS ----------------
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted || newGroupName.trim().length < 2) return;
    setCreatingGroup(true);
    try {
      const data = await apiFetch<{ groupId: number }>('/api/community/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          isPublic: newGroupPublic,
          memberIds: newGroupMembers,
        }),
      });
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      setNewGroupPublic(true);
      setNewGroupMembers([]);
      await fetchGroups();
      setSelectedGroupId(data.groupId);
      setTab('groups');
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (groupId: number) => {
    try {
      await apiFetch(`/api/community/groups/${groupId}/join`, { method: 'POST' });
      await fetchGroups();
      await fetchGroupMessages(groupId);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    try {
      await apiFetch(`/api/community/groups/${groupId}/leave`, { method: 'POST' });
      await fetchGroups();
      await fetchGroupMessages(groupId);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to leave group');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      await apiFetch(`/api/community/groups/${groupId}`, { method: 'DELETE' });
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setSelectedGroupId(null);
      setActiveGroupDetail(null);
      setGroupMessages([]);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  const handleAddGroupMember = async () => {
    if (!selectedGroupId || !addMemberUserId) return;
    try {
      await apiFetch(`/api/community/groups/${selectedGroupId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: Number(addMemberUserId) }),
      });
      setAddMemberUserId('');
      await fetchGroupMessages(selectedGroupId);
      await fetchGroups();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestricted || !selectedGroupId) return;
    if (!groupMsgText.trim() && !groupMsgFile) return;

    setSendingGroupMsg(true);
    try {
      const formData = new FormData();
      formData.append('messageText', groupMsgText.trim());
      if (groupMsgFile) formData.append('attachment', groupMsgFile);

      const data = await apiFetch<{ message: CommunityGroupMessage }>(
        `/api/community/groups/${selectedGroupId}/messages`,
        { method: 'POST', body: formData }
      );
      setGroupMessages((prev) =>
        prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
      );
      setGroupMsgText('');
      setGroupMsgFile(null);
      if (groupFileInputRef.current) groupFileInputRef.current.value = '';
      void fetchGroups();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to send group message');
    } finally {
      setSendingGroupMsg(false);
    }
  };

  const handleDeleteGroupMessage = async (messageId: number) => {
    try {
      await apiFetch(`/api/community/groups/message/${messageId}`, { method: 'DELETE' });
      setGroupMessages((prev) => prev.filter((m) => m.id !== messageId));
      void fetchGroups();
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to delete message');
    }
  };

  // ---------------- REPORT ACTION ----------------
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDraft || reportReason.trim().length < 3) return;
    setSubmittingReport(true);
    try {
      await apiFetch('/api/community/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: reportDraft.targetType,
          targetId: reportDraft.targetId,
          reason: reportReason.trim(),
        }),
      });
      setReportDraft(null);
      setReportReason('');
      showToast('ok', t.community.reportSubmittedMsg);
    } catch (err) {
      showToast('err', err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const onlineStudentsCount = peers.filter((p) => p.online && p.role === 'student').length;
  const totalUnreadDms = dmThreads.reduce((sum, th) => sum + (th.unread_count || 0), 0);

  const filteredPeers = peers.filter((p) => {
    const q = peerSearch.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.grade.toLowerCase().includes(q);
  });

  const filteredDmThreads = dmThreads.filter((th) => {
    const q = dmSearch.trim().toLowerCase();
    if (!q) return true;
    return th.peer_name.toLowerCase().includes(q) || th.peer_grade.toLowerCase().includes(q);
  });

  const selectedDmThread = dmThreads.find((th) => th.peer_id === selectedPeerId) || null;
  const nonMemberPeers = peers.filter(
    (p) => p.id !== user.id && !groupMembers.some((m) => m.id === p.id)
  );

  const reactionButtons: Array<{
    type: CommunityReactionType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { type: 'like', label: t.community.reactions.like, icon: ThumbsUp },
    { type: 'helpful', label: t.community.reactions.helpful, icon: CheckCircle2 },
    { type: 'celebrate', label: t.community.reactions.celebrate, icon: Award },
    { type: 'insightful', label: t.community.reactions.insightful, icon: Lightbulb },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Online Counter */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.community.title}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#059669]/30 bg-[#ECFDF5] px-2.5 py-1 text-xs font-bold text-[#065F46] tabular-nums">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>
                {onlineStudentsCount} {t.community.onlineNowCount}
              </span>
            </span>
          </div>
          <p className="text-sm text-[#57534E] mt-1 max-w-3xl">{t.community.subtitle}</p>
        </div>
      </div>

      {/* Mandatory Privacy & Security Monitoring Notice */}
      <div className="rounded-xl border border-[#D9A62E]/40 bg-[#FBF4DF]/80 px-4 py-3 flex items-start gap-3 text-xs sm:text-sm text-[#1C1917]">
        <ShieldCheck className="w-5 h-5 text-[#6B1118] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[#6B1118]">{t.community.privacyBannerTitle}</p>
          <p className="text-[#57534E] mt-0.5 leading-relaxed">{t.community.privacyBannerDesc}</p>
        </div>
      </div>

      {/* Restricted Account Notice */}
      {isRestricted && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 flex items-start gap-3 text-xs sm:text-sm text-[#991B1B]">
          <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">{t.community.restrictedBannerTitle}</p>
            <p className="mt-0.5">
              {user.restrictionReason || t.community.restrictedBannerDefault}
            </p>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {statusBanner && (
        <div
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium flex items-center justify-between gap-3 ${
            statusBanner.kind === 'ok'
              ? 'border-[#059669]/30 bg-[#ECFDF5] text-[#065F46]'
              : 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#991B1B]'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="p-1 cursor-pointer"
            aria-label={t.community.cancelBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Community Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E6DFD5] pb-3">
        {(
          [
            { id: 'feed', label: t.community.tabFeed, icon: BookOpen },
            {
              id: 'active',
              label: t.community.tabActiveStudents,
              icon: Users,
              badge: onlineStudentsCount > 0 ? onlineStudentsCount : undefined,
            },
            {
              id: 'dm',
              label: t.community.tabPrivateMessages,
              icon: MessageSquare,
              badge: totalUnreadDms > 0 ? totalUnreadDms : undefined,
            },
            {
              id: 'groups',
              label: t.community.tabGroupChats,
              icon: MessageCircle,
              badge: groups.length > 0 ? groups.length : undefined,
            },
          ] as Array<{
            id: CommunityTab;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
            badge?: number;
          }>
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer min-h-[42px] ${
                active
                  ? 'bg-[#6B1118] text-white'
                  : 'bg-white border border-[#E6DFD5] text-[#57534E] hover:border-[#6B1118] hover:text-[#1C1917]'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-[#E5B742]' : 'text-[#6B1118]'}`} />
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-[#FAF8F5] text-[#6B1118]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: EDUCATIONAL FEED ==================== */}
      {tab === 'feed' && (
        <div className="space-y-6">
          {/* Post Composer */}
          <form
            onSubmit={handleCreatePost}
            className="rounded-2xl bg-white border border-[#E6DFD5] p-5 space-y-4"
          >
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={isRestricted || publishingPost}
              placeholder={t.community.sharePlaceholder}
              rows={3}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] focus:ring-2 focus:ring-[#6B1118]/15 disabled:opacity-60"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={postChapter}
                  onChange={(e) => setPostChapter(e.target.value)}
                  disabled={isRestricted}
                  aria-label={t.community.chapterTagOptional}
                  className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2 text-xs font-medium text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[40px]"
                >
                  <option value="">{t.community.noChapterTag}</option>
                  {chapters.map((ch) => (
                    <option key={ch.chapter_number} value={ch.chapter_number}>
                      {t.home.chapterWord} {ch.chapter_number}: {ch.title}
                    </option>
                  ))}
                </select>

                <input
                  ref={postFileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setPostFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={isRestricted}
                  onClick={() => postFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[40px] disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{t.community.attachFileBtn}</span>
                </button>

                {postFile && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-2.5 py-1 text-xs text-[#1C1917]">
                    <span className="truncate max-w-[160px]">{postFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPostFile(null);
                        if (postFileInputRef.current) postFileInputRef.current.value = '';
                      }}
                      className="text-[#DC2626] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isRestricted || publishingPost || (!postContent.trim() && !postFile)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 transition-colors cursor-pointer min-h-[42px]"
              >
                <Send className="w-4 h-4 text-[#E5B742]" />
                <span>{publishingPost ? t.community.publishingPost : t.community.publishPostBtn}</span>
              </button>
            </div>
          </form>

          {/* Feed Search & Chapter Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-[#57534E] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={feedSearch}
                onChange={(e) => setFeedSearch(e.target.value)}
                placeholder={t.community.searchPostsPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-white ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <select
              value={feedChapter}
              onChange={(e) => setFeedChapter(e.target.value)}
              className="rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm font-medium text-[#1C1917] focus:outline-none focus:border-[#6B1118] min-h-[42px]"
            >
              <option value="">{t.community.allChaptersFilter}</option>
              {chapters.map((ch) => (
                <option key={ch.chapter_number} value={ch.chapter_number}>
                  {t.home.chapterWord} {ch.chapter_number}: {ch.title}
                </option>
              ))}
            </select>
          </div>

          {/* Posts List */}
          {loadingPosts ? (
            <p className="text-sm text-[#57534E] py-8 text-center">{t.quiz.loadingQuestions}</p>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#E6DFD5] p-10 text-center space-y-2">
              <BookOpen className="w-9 h-9 text-[#6B1118] mx-auto" />
              <p className="text-sm text-[#57534E]">{t.community.noPostsYet}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                const isOwnPost = post.author_id === user.id;
                const canDeletePost = isOwnPost || isPrivileged;
                const isImage = post.attachment_mime?.startsWith('image/');
                const taggedChapter = post.chapter_number
                  ? chapters.find((c) => c.chapter_number === post.chapter_number)
                  : null;

                return (
                  <article
                    key={post.id}
                    className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-6 space-y-4"
                  >
                    {/* Post Author Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderAvatar(post.author_name, post.author_avatar_url, 'w-11 h-11')}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm sm:text-base text-[#1C1917] truncate">
                              {post.author_name}
                            </p>
                            {(post.author_role === 'teacher' || post.author_is_admin) && (
                              <span className="rounded-md bg-[#FBF4DF] border border-[#D9A62E]/40 px-2 py-0.5 text-[11px] font-bold text-[#6B1118]">
                                {t.community.teacherBadge}
                              </span>
                            )}
                            {post.author_is_restricted && (
                              <span className="rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#DC2626]">
                                {t.community.restrictedUserTag}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#57534E] tabular-nums">
                            {formatUtcTimestamp(post.created_at)}
                            {post.author_grade ? ` · ${post.author_grade}` : ''}
                            {post.chapter_number
                              ? ` · ${t.home.chapterWord} ${post.chapter_number}${
                                  taggedChapter ? `: ${taggedChapter.title}` : ''
                                }`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isOwnPost && (
                          <button
                            type="button"
                            onClick={() => openDirectChat(post.author_id)}
                            className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer"
                          >
                            {t.community.messagePeerBtn}
                          </button>
                        )}
                        {!isOwnPost && (
                          <button
                            type="button"
                            onClick={() =>
                              setReportDraft({
                                targetType: 'post',
                                targetId: post.id,
                                label: post.author_name,
                              })
                            }
                            aria-label={t.community.reportBtn}
                            title={t.community.reportBtn}
                            className="p-2 rounded-lg text-[#57534E] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                          >
                            <Flag className="w-4 h-4" />
                          </button>
                        )}
                        {canDeletePost && (
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            aria-label={t.community.deleteBtn}
                            title={t.community.deleteBtn}
                            className="p-2 rounded-lg text-[#57534E] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post Body */}
                    {post.content && (
                      <p className="text-sm sm:text-base text-[#1C1917] whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>
                    )}

                    {/* Post Attachment */}
                    {post.attachment_url && (
                      <div className="space-y-2">
                        {isImage && (
                          <img
                            src={post.attachment_url}
                            alt={post.attachment_name || 'Attachment'}
                            referrerPolicy="no-referrer"
                            className="max-h-96 rounded-xl border border-[#E6DFD5] object-contain bg-[#FAF8F5]"
                          />
                        )}
                        <a
                          href={getDownloadHref(post.attachment_url, post.attachment_name)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{post.attachment_name || t.community.downloadAttachment}</span>
                        </a>
                      </div>
                    )}

                    {/* Reactions Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E6DFD5]">
                      {reactionButtons.map((rb) => {
                        const Icon = rb.icon;
                        const active = post.myReaction === rb.type;
                        const count = post.reactionCounts?.[rb.type] || 0;
                        return (
                          <button
                            key={rb.type}
                            type="button"
                            disabled={isRestricted}
                            onClick={() => handleReaction(post.id, rb.type)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer min-h-[36px] disabled:opacity-50 ${
                              active
                                ? 'bg-[#6B1118] text-white'
                                : 'bg-[#FAF8F5] border border-[#E6DFD5] text-[#57534E] hover:border-[#6B1118] hover:text-[#1C1917]'
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#E5B742]' : ''}`} />
                            <span>{rb.label}</span>
                            {count > 0 && <span className="tabular-nums font-bold">{count}</span>}
                          </button>
                        );
                      })}

                      <span className="ms-auto text-xs text-[#57534E] tabular-nums flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-[#6B1118]" />
                        {post.totalReactions} · {post.comments.length} {t.community.commentsLabel}
                      </span>
                    </div>

                    {/* Comments Section */}
                    <div className="space-y-3 pt-2 border-t border-[#E6DFD5]">
                      {post.comments.length > 0 && (
                        <div className="space-y-2.5">
                          {post.comments.map((c) => {
                            const isOwnComment = c.author_id === user.id;
                            return (
                              <div
                                key={c.id}
                                className="rounded-xl bg-[#FAF8F5] border border-[#E6DFD5] px-3.5 py-2.5 flex items-start justify-between gap-2.5"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  {renderAvatar(c.author_name, c.author_avatar_url, 'w-7 h-7')}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-[#1C1917]">
                                        {c.author_name}
                                      </span>
                                      <span className="text-[11px] text-[#57534E] tabular-nums">
                                        {formatUtcTimestamp(c.created_at)}
                                      </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-[#1C1917] mt-0.5 whitespace-pre-wrap">
                                      {c.content}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {!isOwnComment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReportDraft({
                                          targetType: 'comment',
                                          targetId: c.id,
                                          label: c.author_name,
                                        })
                                      }
                                      className="p-1 text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                                      aria-label={t.community.reportBtn}
                                    >
                                      <Flag className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {(isOwnComment || isPrivileged) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(post.id, c.id)}
                                      className="p-1 text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                                      aria-label={t.community.deleteBtn}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isRestricted && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={commentDrafts[post.id] || ''}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleAddComment(post.id);
                              }
                            }}
                            placeholder={t.community.writeCommentPlaceholder}
                            className="flex-1 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs sm:text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddComment(post.id)}
                            disabled={!(commentDrafts[post.id] || '').trim()}
                            className="rounded-xl bg-[#6B1118] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[38px]"
                          >
                            {t.community.sendCommentBtn}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: ACTIVE STUDENTS & CLASSMATES ==================== */}
      {tab === 'active' && (
        <section className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DFD5] pb-4">
            <div>
              <h3 className="text-lg font-bold text-[#1C1917]">
                {t.community.activeClassmatesTitle}
              </h3>
              <p className="text-xs text-[#57534E]">{t.community.activeClassmatesSub}</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={peerSearch}
                onChange={(e) => setPeerSearch(e.target.value)}
                placeholder={t.community.searchClassmatesPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-9 pe-3 py-2 text-xs sm:text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>
          </div>

          {filteredPeers.length === 0 ? (
            <p className="text-sm text-[#57534E] py-8 text-center">{t.community.noPeersFound}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPeers.map((peer) => {
                const isSelf = peer.id === user.id;
                return (
                  <div
                    key={peer.id}
                    className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        {renderAvatar(peer.name, peer.avatar_url, 'w-11 h-11')}
                        <span
                          className={`absolute bottom-0 end-0 w-3 h-3 rounded-full ring-2 ring-white ${
                            peer.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[#1C1917] truncate">
                            {peer.name} {isSelf ? `(${t.community.youLabel})` : ''}
                          </p>
                          {(peer.role === 'teacher' || peer.isAdmin) && (
                            <span className="rounded bg-[#FBF4DF] border border-[#D9A62E]/40 px-1.5 py-0.5 text-[10px] font-bold text-[#6B1118]">
                              {t.community.teacherBadge}
                            </span>
                          )}
                          {peer.isRestricted && (
                            <span className="rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
                              {t.community.restrictedUserTag}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#57534E] truncate">
                          <span className={peer.online ? 'text-[#065F46] font-semibold' : ''}>
                            {peer.online ? t.community.onlineStatus : t.community.offlineStatus}
                          </span>
                          {peer.online && peer.currentSection
                            ? ` · ${t.community.studyingLabel}: ${getSectionLabel(
                                peer.currentSection
                              )}`
                            : peer.grade
                            ? ` · ${peer.grade}`
                            : ''}
                        </p>
                      </div>
                    </div>

                    {!isSelf && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openDirectChat(peer.id)}
                          className="rounded-lg bg-[#6B1118] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[36px]"
                        >
                          {t.community.messagePeerBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setReportDraft({
                              targetType: 'user',
                              targetId: peer.id,
                              label: peer.name,
                            })
                          }
                          aria-label={t.community.reportUserBtn}
                          title={t.community.reportUserBtn}
                          className="p-2 rounded-lg border border-[#E6DFD5] bg-white text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                        >
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==================== TAB 3: PRIVATE DIRECT MESSAGES ==================== */}
      {tab === 'dm' && (
        <section className="rounded-2xl bg-white border border-[#E6DFD5] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
          {/* Classmates Thread List */}
          <div
            className={`md:col-span-4 border-e border-[#E6DFD5] flex flex-col ${
              selectedPeerId !== null ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-[#E6DFD5] space-y-2.5">
              <h3 className="text-sm font-bold text-[#1C1917]">{t.community.dmThreadsTitle}</h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#57534E] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={dmSearch}
                  onChange={(e) => setDmSearch(e.target.value)}
                  placeholder={t.community.searchClassmatesPlaceholder}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-8 pe-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E6DFD5]">
              {filteredDmThreads.map((th) => {
                const active = selectedPeerId === th.peer_id;
                return (
                  <button
                    key={th.peer_id}
                    type="button"
                    onClick={() => setSelectedPeerId(th.peer_id)}
                    className={`w-full text-start p-3.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      active ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative">
                        {renderAvatar(th.peer_name, th.peer_avatar_url, 'w-10 h-10')}
                        <span
                          className={`absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                            th.peer_online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C1917] truncate">
                          {th.peer_name}
                        </p>
                        <p className="text-xs text-[#57534E] truncate">
                          {th.last_message_text ||
                            th.last_attachment_name ||
                            (th.peer_online ? t.community.onlineStatus : t.community.offlineStatus)}
                        </p>
                      </div>
                    </div>

                    {th.unread_count > 0 && (
                      <span className="rounded-full bg-[#6B1118] text-white px-2 py-0.5 text-[11px] font-bold tabular-nums shrink-0">
                        {th.unread_count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Private Chat Pane */}
          <div
            className={`md:col-span-8 flex flex-col ${
              selectedPeerId === null ? 'hidden md:flex' : 'flex'
            }`}
          >
            {!selectedDmThread ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                <MessageSquare className="w-10 h-10 text-[#6B1118]" />
                <p className="text-sm text-[#57534E] max-w-sm">
                  {t.community.selectClassmatePrompt}
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#E6DFD5] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPeerId(null)}
                      className="md:hidden p-1.5 rounded-lg text-[#6B1118] hover:bg-[#FAF8F5] cursor-pointer"
                      aria-label={t.community.backToList}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    {renderAvatar(
                      selectedDmThread.peer_name,
                      selectedDmThread.peer_avatar_url,
                      'w-9 h-9'
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1C1917] truncate">
                        {selectedDmThread.peer_name}
                      </p>
                      <p className="text-[11px] text-[#57534E]">
                        {selectedDmThread.peer_online
                          ? t.community.onlineStatus
                          : t.community.offlineStatus}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]/60 max-h-[400px]">
                  {loadingDm ? (
                    <p className="text-xs text-[#57534E] text-center py-6">
                      {t.quiz.loadingQuestions}
                    </p>
                  ) : dmMessages.length === 0 ? (
                    <p className="text-xs sm:text-sm text-[#57534E] text-center py-10">
                      {t.community.noDmMessages}
                    </p>
                  ) : (
                    dmMessages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      const isImg = msg.attachment_mime?.startsWith('image/');
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-2.5 space-y-1.5 border ${
                              isMine
                                ? 'bg-[#6B1118] text-white border-[#6B1118]'
                                : 'bg-white text-[#1C1917] border-[#E6DFD5]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[11px] opacity-80">
                              <span className="font-semibold">{msg.sender_name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="tabular-nums">
                                  {formatUtcTimestamp(msg.created_at)}
                                </span>
                                {!isMine && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReportDraft({
                                        targetType: 'dm',
                                        targetId: msg.id,
                                        label: msg.sender_name,
                                      })
                                    }
                                    className="hover:text-[#DC2626] cursor-pointer"
                                    aria-label={t.community.reportBtn}
                                  >
                                    <Flag className="w-3 h-3" />
                                  </button>
                                )}
                                {(isMine || isPrivileged) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDm(msg.id)}
                                    className="hover:text-[#FCA5A5] cursor-pointer"
                                    aria-label={t.community.deleteBtn}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {msg.message_text && (
                              <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                            )}

                            {msg.attachment_url && (
                              <div className="space-y-1.5 pt-1">
                                {isImg && (
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_name || 'Attachment'}
                                    referrerPolicy="no-referrer"
                                    className="max-h-56 rounded-xl object-contain"
                                  />
                                )}
                                <a
                                  href={getDownloadHref(msg.attachment_url, msg.attachment_name)}
                                  className={`inline-flex items-center gap-1.5 text-xs underline ${
                                    isMine ? 'text-[#E5B742]' : 'text-[#6B1118]'
                                  }`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>{msg.attachment_name || t.community.downloadAttachment}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={dmBottomRef} />
                </div>

                {/* DM Composer */}
                <form
                  onSubmit={handleSendDm}
                  className="p-3 border-t border-[#E6DFD5] bg-white space-y-2"
                >
                  {dmFile && (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-2.5 py-1 text-xs">
                      <span className="truncate max-w-[200px]">{dmFile.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDmFile(null);
                          if (dmFileInputRef.current) dmFileInputRef.current.value = '';
                        }}
                        className="text-[#DC2626] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={dmFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setDmFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      disabled={isRestricted}
                      onClick={() => dmFileInputRef.current?.click()}
                      className="p-2.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118] cursor-pointer disabled:opacity-50"
                      aria-label={t.community.attachFileBtn}
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      value={dmText}
                      disabled={isRestricted || sendingDm}
                      onChange={(e) => setDmText(e.target.value)}
                      placeholder={t.community.writeDmPlaceholder}
                      className="flex-1 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={isRestricted || sendingDm || (!dmText.trim() && !dmFile)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[42px]"
                    >
                      <Send className="w-4 h-4 text-[#E5B742]" />
                      <span className="hidden sm:inline">
                        {sendingDm ? t.community.sendingBtn : t.community.sendBtn}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      {/* ==================== TAB 4: GROUP CHATS ==================== */}
      {tab === 'groups' && (
        <section className="rounded-2xl bg-white border border-[#E6DFD5] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
          {/* Groups Sidebar */}
          <div
            className={`md:col-span-4 border-e border-[#E6DFD5] flex flex-col ${
              selectedGroupId !== null ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="p-4 border-b border-[#E6DFD5] flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#1C1917]">{t.community.groupsTitle}</h3>
              {!isRestricted && (
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#6B1118] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E5B742]" />
                  <span>{t.community.createGroupBtn}</span>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E6DFD5]">
              {groups.length === 0 ? (
                <p className="text-xs text-[#57534E] p-6 text-center">{t.community.selectGroupPrompt}</p>
              ) : (
                groups.map((grp) => {
                  const active = selectedGroupId === grp.id;
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setSelectedGroupId(grp.id)}
                      className={`w-full text-start p-3.5 space-y-1 transition-colors cursor-pointer ${
                        active ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#1C1917] truncate flex items-center gap-1.5">
                          {grp.is_public ? (
                            <Globe className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-[#6B1118] shrink-0" />
                          )}
                          <span className="truncate">{grp.name}</span>
                        </span>
                        <span className="text-[11px] font-semibold text-[#57534E] tabular-nums shrink-0">
                          {grp.member_count} {t.community.membersCount}
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] truncate">
                        {grp.last_message_text || grp.description || grp.creator_name}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Group Chat Pane */}
          <div
            className={`md:col-span-8 flex flex-col ${
              selectedGroupId === null ? 'hidden md:flex' : 'flex'
            }`}
          >
            {!activeGroupDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2">
                <Users className="w-10 h-10 text-[#6B1118]" />
                <p className="text-sm text-[#57534E] max-w-sm">
                  {loadingGroupChat ? t.quiz.loadingQuestions : t.community.selectGroupPrompt}
                </p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-[#E6DFD5] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setSelectedGroupId(null)}
                      className="md:hidden p-1.5 rounded-lg text-[#6B1118] hover:bg-[#FAF8F5] cursor-pointer"
                      aria-label={t.community.backToList}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#1C1917] truncate">
                          {activeGroupDetail.name}
                        </h4>
                        <span className="text-[11px] text-[#57534E] tabular-nums">
                          · {groupMembers.length} {t.community.membersCount}
                        </span>
                      </div>
                      {activeGroupDetail.description && (
                        <p className="text-xs text-[#57534E] truncate">
                          {activeGroupDetail.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!activeGroupDetail.is_member && activeGroupDetail.is_public && !isRestricted && (
                      <button
                        type="button"
                        onClick={() => handleJoinGroup(activeGroupDetail.id)}
                        className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] cursor-pointer"
                      >
                        {t.community.joinGroupBtn}
                      </button>
                    )}

                    {(activeGroupDetail.is_member || isPrivileged) &&
                      nonMemberPeers.length > 0 &&
                      !isRestricted && (
                        <div className="flex items-center gap-1">
                          <select
                            value={addMemberUserId}
                            onChange={(e) => setAddMemberUserId(e.target.value)}
                            className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2 py-1 text-xs text-[#1C1917]"
                          >
                            <option value="">{t.community.addMemberLabel}</option>
                            {nonMemberPeers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!addMemberUserId}
                            onClick={handleAddGroupMember}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] disabled:opacity-40 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{t.community.addMemberBtn}</span>
                          </button>
                        </div>
                      )}

                    {activeGroupDetail.is_member &&
                      activeGroupDetail.created_by !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleLeaveGroup(activeGroupDetail.id)}
                          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1.5 text-xs font-semibold text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                        >
                          {t.community.leaveGroupBtn}
                        </button>
                      )}

                    {(activeGroupDetail.created_by === user.id || isPrivileged) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(activeGroupDetail.id)}
                        className="rounded-lg border border-[#DC2626]/30 bg-[#FEF2F2] px-2.5 py-1.5 text-xs font-semibold text-[#DC2626] cursor-pointer"
                      >
                        {t.community.deleteGroupBtn}
                      </button>
                    )}
                  </div>
                </div>

                {/* Member Strip */}
                <div className="px-4 py-2 border-b border-[#E6DFD5] bg-[#FAF8F5] flex items-center gap-2 overflow-x-auto text-xs">
                  {groupMembers.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E6DFD5] px-2 py-1 shrink-0"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m.online ? 'bg-[#059669]' : 'bg-[#A8A29E]'
                        }`}
                      />
                      <span className="font-medium text-[#1C1917]">{m.name}</span>
                    </span>
                  ))}
                </div>

                {/* Group Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F5]/60 max-h-[380px]">
                  {groupMessages.length === 0 ? (
                    <p className="text-xs sm:text-sm text-[#57534E] text-center py-10">
                      {t.community.noGroupMessages}
                    </p>
                  ) : (
                    groupMessages.map((msg) => {
                      const isMine = msg.sender_id === user.id;
                      const isImg = msg.attachment_mime?.startsWith('image/');
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl px-4 py-2.5 space-y-1.5 border ${
                              isMine
                                ? 'bg-[#6B1118] text-white border-[#6B1118]'
                                : 'bg-white text-[#1C1917] border-[#E6DFD5]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[11px] opacity-80">
                              <span className="font-semibold">{msg.sender_name}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="tabular-nums">
                                  {formatUtcTimestamp(msg.created_at)}
                                </span>
                                {!isMine && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReportDraft({
                                        targetType: 'group_message',
                                        targetId: msg.id,
                                        label: msg.sender_name,
                                      })
                                    }
                                    className="hover:text-[#DC2626] cursor-pointer"
                                    aria-label={t.community.reportBtn}
                                  >
                                    <Flag className="w-3 h-3" />
                                  </button>
                                )}
                                {(isMine || isPrivileged) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteGroupMessage(msg.id)}
                                    className="hover:text-[#FCA5A5] cursor-pointer"
                                    aria-label={t.community.deleteBtn}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {msg.message_text && (
                              <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                            )}

                            {msg.attachment_url && (
                              <div className="space-y-1.5 pt-1">
                                {isImg && (
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_name || 'Attachment'}
                                    referrerPolicy="no-referrer"
                                    className="max-h-56 rounded-xl object-contain"
                                  />
                                )}
                                <a
                                  href={getDownloadHref(msg.attachment_url, msg.attachment_name)}
                                  className={`inline-flex items-center gap-1.5 text-xs underline ${
                                    isMine ? 'text-[#E5B742]' : 'text-[#6B1118]'
                                  }`}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>{msg.attachment_name || t.community.downloadAttachment}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={groupBottomRef} />
                </div>

                {/* Group Message Input */}
                {!activeGroupDetail.is_member && !isPrivileged ? (
                  <div className="p-3.5 border-t border-[#E6DFD5] bg-[#FAF8F5] flex items-center justify-between gap-3">
                    <span className="text-xs text-[#57534E]">{t.community.joinToChatPrompt}</span>
                    {!isRestricted && (
                      <button
                        type="button"
                        onClick={() => handleJoinGroup(activeGroupDetail.id)}
                        className="rounded-xl bg-[#6B1118] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                      >
                        {t.community.joinGroupBtn}
                      </button>
                    )}
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendGroupMessage}
                    className="p-3 border-t border-[#E6DFD5] bg-white space-y-2"
                  >
                    {groupMsgFile && (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-2.5 py-1 text-xs">
                        <span className="truncate max-w-[200px]">{groupMsgFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setGroupMsgFile(null);
                            if (groupFileInputRef.current) groupFileInputRef.current.value = '';
                          }}
                          className="text-[#DC2626] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        ref={groupFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setGroupMsgFile(e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        disabled={isRestricted}
                        onClick={() => groupFileInputRef.current?.click()}
                        className="p-2.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118] cursor-pointer disabled:opacity-50"
                        aria-label={t.community.attachFileBtn}
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={groupMsgText}
                        disabled={isRestricted || sendingGroupMsg}
                        onChange={(e) => setGroupMsgText(e.target.value)}
                        placeholder={t.community.writeGroupMsgPlaceholder}
                        className="flex-1 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] disabled:opacity-60"
                      />
                      <button
                        type="submit"
                        disabled={
                          isRestricted ||
                          sendingGroupMsg ||
                          (!groupMsgText.trim() && !groupMsgFile)
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer min-h-[42px]"
                      >
                        <Send className="w-4 h-4 text-[#E5B742]" />
                        <span className="hidden sm:inline">
                          {sendingGroupMsg ? t.community.sendingBtn : t.community.sendBtn}
                        </span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ==================== CREATE GROUP MODAL ==================== */}
      {showCreateGroupModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowCreateGroupModal(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateGroup}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-3">
              <h3 className="text-lg font-bold text-[#1C1917]">{t.community.createGroupTitle}</h3>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1.5 rounded-lg text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t.community.groupNameLabel}
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t.community.groupNamePlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t.community.groupDescLabel}
              </label>
              <input
                type="text"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder={t.community.groupDescPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t.community.groupVisibilityLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNewGroupPublic(true)}
                  className={`rounded-xl border p-3 text-start font-semibold cursor-pointer ${
                    newGroupPublic
                      ? 'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118]'
                      : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                  }`}
                >
                  {t.community.groupPublicOpt}
                </button>
                <button
                  type="button"
                  onClick={() => setNewGroupPublic(false)}
                  className={`rounded-xl border p-3 text-start font-semibold cursor-pointer ${
                    !newGroupPublic
                      ? 'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118]'
                      : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                  }`}
                >
                  {t.community.groupPrivateOpt}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t.community.selectMembersLabel}
              </label>
              <div className="max-h-40 overflow-y-auto border border-[#E6DFD5] rounded-xl divide-y divide-[#E6DFD5] bg-[#FAF8F5]">
                {peers
                  .filter((p) => p.id !== user.id)
                  .map((p) => {
                    const checked = newGroupMembers.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewGroupMembers((prev) => [...prev, p.id]);
                            } else {
                              setNewGroupMembers((prev) => prev.filter((id) => id !== p.id));
                            }
                          }}
                          className="accent-[#6B1118]"
                        />
                        <span className="font-medium text-[#1C1917]">{p.name}</span>
                        {p.grade && <span className="text-[#57534E]">· {p.grade}</span>}
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(false)}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] cursor-pointer"
              >
                {t.community.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={creatingGroup || newGroupName.trim().length < 2}
                className="rounded-xl bg-[#6B1118] px-5 py-2 text-xs font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer"
              >
                {t.community.createGroupSubmit}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== SAFETY REPORT MODAL ==================== */}
      {reportDraft && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReportDraft(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSubmitReport}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E6DFD5] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                <h3 className="text-base font-bold text-[#1C1917]">{t.community.reportModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportDraft(null)}
                className="p-1 text-[#57534E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#57534E] leading-relaxed">{t.community.reportModalDesc}</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1C1917]">
                {t.community.reportReasonLabel} ({reportDraft.label})
              </label>
              <textarea
                required
                minLength={3}
                rows={3}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder={t.community.reportReasonPlaceholder}
                className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-3 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportDraft(null)}
                className="rounded-xl border border-[#E6DFD5] px-4 py-2 text-xs font-semibold text-[#57534E] cursor-pointer"
              >
                {t.community.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={submittingReport || reportReason.trim().length < 3}
                className="rounded-xl bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 cursor-pointer"
              >
                {t.community.submitReportBtn}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
