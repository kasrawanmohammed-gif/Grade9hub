import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Send,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { TeacherMessage, TeacherThread, User } from '../types';
import { UserAvatar } from './UserAvatar';

interface AskTeacherViewProps {
  user: User;
  initialStudentId?: number | null;
  onClearInitialStudentId?: () => void;
  onRefreshNotifications: () => Promise<void>;
}

export const AskTeacherView: React.FC<AskTeacherViewProps> = ({
  user,
  initialStudentId,
  onClearInitialStudentId,
  onRefreshNotifications,
}) => {
  const { t, dir } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const [threads, setThreads] = useState<TeacherThread[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<number | null>(
    isPrivileged ? initialStudentId ?? null : user.id
  );
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(initialStudentId));
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = async () => {
    try {
      const data = await apiFetch<{ threads: TeacherThread[] }>('/api/messages/threads');
      setThreads(data.threads);
      if (isPrivileged && !initialStudentId && activeStudentId === null && data.threads.length > 0) {
        setActiveStudentId(data.threads[0].student_id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (studentId: number) => {
    try {
      const data = await apiFetch<{ messages: TeacherMessage[] }>(`/api/messages/${studentId}`);
      setMessages(data.messages);
      await onRefreshNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversation.');
    }
  };

  useEffect(() => {
    void loadThreads();
  }, []);

  useEffect(() => {
    if (isPrivileged && initialStudentId) {
      setActiveStudentId(initialStudentId);
      setMobileShowChat(true);
      onClearInitialStudentId?.();
    }
  }, [isPrivileged, initialStudentId, onClearInitialStudentId]);

  useEffect(() => {
    if (activeStudentId !== null) {
      void loadMessages(activeStudentId);
    }
  }, [activeStudentId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStudentId) return;
    if (!messageText.trim() && !attachment) return;

    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('messageText', messageText);
      if (isPrivileged) {
        formData.append('studentId', String(activeStudentId));
      }
      if (attachment) {
        formData.append('attachment', attachment);
      }
      await apiFetch('/api/messages', {
        method: 'POST',
        body: formData,
      });
      setMessageText('');
      setAttachment(null);
      await loadMessages(activeStudentId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    try {
      await apiFetch(`/api/messages/${msgId}`, { method: 'DELETE' });
      if (activeStudentId !== null) {
        await loadMessages(activeStudentId);
        await loadThreads();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete message.');
    }
  };

  const activeThread = threads.find((th) => th.student_id === activeStudentId);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.askTeacher.title}</h2>
        <p className="text-sm text-[#57534E] mt-1">
          {isPrivileged ? t.askTeacher.teacherSub : t.askTeacher.studentSub}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Teacher Student Inbox Sidebar */}
        {isPrivileged && (
          <div
            className={`lg:col-span-4 rounded-2xl bg-white border border-[#E6DFD5] overflow-hidden flex-col ${
              mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="px-5 py-4 border-b border-[#E6DFD5] bg-[#FAF8F5]">
              <h3 className="text-sm font-bold text-[#1C1917]">
                {t.askTeacher.studentConversations} ({threads.length})
              </h3>
            </div>
            <div className="divide-y divide-[#E6DFD5] max-h-[540px] overflow-y-auto">
              {loading ? (
                <p className="p-5 text-sm text-[#57534E]">{t.askTeacher.loadingThreads}</p>
              ) : threads.length === 0 ? (
                <p className="p-6 text-sm text-[#57534E]">{t.askTeacher.noMessagesTeacher}</p>
              ) : (
                threads.map((th) => {
                  const selected = th.student_id === activeStudentId;
                  return (
                    <button
                      key={th.student_id}
                      type="button"
                      onClick={() => {
                        setActiveStudentId(th.student_id);
                        setMobileShowChat(true);
                      }}
                      className={`w-full text-start px-5 py-4 transition-colors cursor-pointer flex items-start gap-3 ${
                        selected ? 'bg-[#F9EFF0]' : 'hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <UserAvatar
                        name={th.student_name}
                        avatarUrl={th.student_avatar_url}
                        sizeClass="w-9 h-9"
                        textClass="text-xs"
                        fallbackClass="bg-[#6B1118]/10 text-[#6B1118]"
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-[#1C1917] truncate">
                            {th.student_name}
                          </span>
                          {th.unread_count > 0 && (
                            <span className="text-xs font-bold text-[#6B1118] tabular-nums">
                              {th.unread_count} {t.askTeacher.newBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#57534E] truncate mt-0.5">
                          {th.student_email}
                        </p>
                        {(th.last_message_text || th.last_attachment_name) && (
                          <p className="text-xs text-[#57534E] truncate mt-1.5">
                            {th.last_message_text || th.last_attachment_name}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Active Conversation Panel */}
        <div
          className={`${
            isPrivileged
              ? `lg:col-span-8 ${mobileShowChat ? 'flex' : 'hidden lg:flex'}`
              : 'lg:col-span-12 flex'
          } rounded-2xl bg-white border border-[#E6DFD5] flex-col min-h-[500px] max-h-[700px] overflow-hidden`}
        >
          {/* Conversation Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-[#E6DFD5] bg-[#FAF8F5] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isPrivileged && (
                <button
                  type="button"
                  onClick={() => setMobileShowChat(false)}
                  className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1C1917] cursor-pointer shrink-0 min-h-[36px]"
                >
                  <BackIcon className="w-3.5 h-3.5" />
                  <span>{t.askTeacher.backToStudents}</span>
                </button>
              )}
              {isPrivileged && activeThread ? (
                <UserAvatar
                  name={activeThread.student_name}
                  avatarUrl={activeThread.student_avatar_url}
                  sizeClass="w-10 h-10"
                  textClass="text-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#6B1118] text-white flex items-center justify-center shrink-0 overflow-hidden">
                  <UserIcon className="w-5 h-5 text-[#E5B742]" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#1C1917] truncate">
                  {isPrivileged
                    ? activeThread
                      ? activeThread.student_name
                      : t.askTeacher.selectStudent
                    : t.about.name}
                </h3>
                <p className="text-xs text-[#57534E] truncate">
                  {isPrivileged
                    ? activeThread
                      ? activeThread.student_email
                      : t.askTeacher.chooseLeft
                    : t.askTeacher.teacherRoleSub}
                </p>
              </div>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAF8F5]/60">
            {isPrivileged && !activeStudentId ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-sm text-[#57534E]">
                <MessageSquare className="w-9 h-9 text-[#D9A62E] mb-2" />
                <p>{t.askTeacher.selectPrompt}</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-sm text-[#57534E]">
                <MessageSquare className="w-9 h-9 text-[#D9A62E] mb-2" />
                <p>{t.askTeacher.noMessagesChat}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                const isImage = msg.attachment_mime?.startsWith('image/');
                const fileBasename = msg.attachment_url?.split('/').pop() || '';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {msg.sender_avatar_url && (
                        <UserAvatar
                          name={msg.sender_name}
                          avatarUrl={msg.sender_avatar_url}
                          sizeClass="w-5 h-5"
                          textClass="text-[9px]"
                        />
                      )}
                      <span className="text-[11px] text-[#57534E]">
                        {msg.sender_name} ·{' '}
                        {new Date(msg.created_at + 'Z').toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isPrivileged && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          aria-label="Delete message"
                          className="text-[#57534E] hover:text-[#DC2626] cursor-pointer p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] sm:max-w-[72%] rounded-2xl px-4 py-3 text-sm space-y-2.5 ${
                        isOwn
                          ? 'bg-[#6B1118] text-white'
                          : 'bg-white border border-[#E6DFD5] text-[#1C1917]'
                      }`}
                    >
                      {msg.message_text && (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.message_text}</p>
                      )}

                      {msg.attachment_url && msg.attachment_name && (
                        <div className="pt-1">
                          {isImage ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewImage({
                                    url: msg.attachment_url!,
                                    name: msg.attachment_name!,
                                  })
                                }
                                className="block rounded-xl overflow-hidden border border-white/20 cursor-pointer"
                              >
                                <img
                                  src={msg.attachment_url}
                                  alt={msg.attachment_name}
                                  referrerPolicy="no-referrer"
                                  className="max-h-56 object-contain bg-black/5"
                                />
                              </button>
                              <a
                                href={`/api/uploads/download/${fileBasename}?name=${encodeURIComponent(
                                  msg.attachment_name
                                )}`}
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline ${
                                  isOwn ? 'text-[#E5B742]' : 'text-[#6B1118]'
                                }`}
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>
                                  {t.askTeacher.download} {msg.attachment_name}
                                </span>
                              </a>
                            </div>
                          ) : (
                            <a
                              href={`/api/uploads/download/${fileBasename}?name=${encodeURIComponent(
                                msg.attachment_name
                              )}`}
                              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold border ${
                                isOwn
                                  ? 'border-white/25 bg-white/10 text-white hover:bg-white/20'
                                  : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118]'
                              }`}
                            >
                              <FileText className="w-4 h-4 shrink-0" />
                              <span className="truncate max-w-[200px]">{msg.attachment_name}</span>
                              <Download className="w-3.5 h-3.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Composer */}
          {(!isPrivileged || activeStudentId !== null) && (
            <form onSubmit={handleSend} className="p-4 border-t border-[#E6DFD5] bg-white space-y-3">
              {attachment && (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate text-[#1C1917]">
                    {attachment.type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-[#6B1118] shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-[#6B1118] shrink-0" />
                    )}
                    <span className="truncate font-medium">{attachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="p-1 text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2.5">
                <label
                  title="Attach image or document"
                  className="p-3 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] text-[#6B1118] hover:border-[#6B1118] cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Paperclip className="w-5 h-5" />
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
                    className="hidden"
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />
                </label>

                <textarea
                  rows={1}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    isPrivileged ? t.askTeacher.replyPlaceholder : t.askTeacher.askPlaceholder
                  }
                  className="flex-1 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118] resize-none min-h-[44px]"
                />

                <button
                  type="submit"
                  disabled={sending || (!messageText.trim() && !attachment)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-50 cursor-pointer shrink-0 min-h-[44px]"
                >
                  <Send className="w-4 h-4 text-[#E5B742]" />
                  <span className="hidden sm:inline">
                    {sending ? t.askTeacher.sending : t.askTeacher.send}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full rounded-2xl bg-white p-3 shadow-2xl"
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <p className="text-sm font-semibold text-[#1C1917] truncate">{previewImage.name}</p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              referrerPolicy="no-referrer"
              className="w-full max-h-[75vh] object-contain rounded-xl bg-[#FAF8F5]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
