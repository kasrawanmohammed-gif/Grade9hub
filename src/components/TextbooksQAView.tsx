import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  BookOpen,
  BookText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Layers,
  Library,
  Paperclip,
  Plus,
  Search,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import { formatMsg } from '../i18n/translations';
import {
  OFFICIAL_BOOK_FILENAME,
  OFFICIAL_BOOK_PDF_URL,
  getAttachmentDownloadHref,
  getOfficialBookChapterPage,
  isPdfAttachment,
} from '../lib/textbookCatalog';
import {
  CurriculumStudyQA,
  TabId,
  TextbookResource,
  TextbookStudyQA,
  TextbooksQAResponse,
  User,
} from '../types';
import { ScientificText } from './ScientificText';
import { TextbookPdfViewerModal } from './TextbookPdfViewerModal';

interface TextbooksQAViewProps {
  user: User;
  onNavigate: (tab: TabId) => void;
  onSelectChapter: (chapterNumber: number | 'all') => void;
}

type ChapterTab = 'all' | 'general' | number;
type QaSourceFilter = 'all' | 'worked' | 'curriculum';

type CombinedQaItem =
  | {
      kind: 'worked';
      key: string;
      id: number;
      chapterNumber: number | null;
      chapterLabel: string;
      questionText: string;
      answerText: string;
      explanationText: string;
      sourceLabel: string;
      raw?: TextbookStudyQA;
    }
  | {
      kind: 'curriculum';
      key: string;
      id: number;
      chapterNumber: number | null;
      chapterLabel: string;
      questionText: string;
      answerText: string;
      explanationText: string;
      curriculum: CurriculumStudyQA;
    };

const STORAGE_CACHE_PREFIX = 'grade9hub_textbooks_qa_v1_';

export const TextbooksQAView: React.FC<TextbooksQAViewProps> = ({
  user,
  onNavigate,
  onSelectChapter,
}) => {
  const { language, t, dir } = useLanguage();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const [data, setData] = useState<TextbooksQAResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);

  const [selectedTab, setSelectedTab] = useState<ChapterTab>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [qaFilter, setQaFilter] = useState<QaSourceFilter>('all');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  // Teacher resource form state
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resChapter, setResChapter] = useState<string>('1');
  const [resType, setResType] = useState<'textbook' | 'guide' | 'summary' | 'slides'>('textbook');
  const [resSummary, setResSummary] = useState('');
  const [resFormulas, setResFormulas] = useState('');
  const [resExternalUrl, setResExternalUrl] = useState('');
  const [resFile, setResFile] = useState<File | null>(null);
  const [savingResource, setSavingResource] = useState(false);

  // Teacher study Q&A CRUD state
  const [showQaForm, setShowQaForm] = useState(false);
  const [editingQaId, setEditingQaId] = useState<number | null>(null);
  const [qaChapter, setQaChapter] = useState<number>(1);
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaExplanation, setQaExplanation] = useState('');
  const [qaSource, setQaSource] = useState('');
  const [savingQa, setSavingQa] = useState(false);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const [readerConfig, setReaderConfig] = useState<{
    url: string;
    title: string;
    fileName?: string | null;
    initialPage?: number;
    isOfficialBook?: boolean;
  } | null>(null);

  const loadData = async (lang = language) => {
    setLoading(true);
    setError(null);
    setUsingOfflineCache(false);
    const cacheKey = `${STORAGE_CACHE_PREFIX}${user.id}_${lang}`;

    const readCached = (): TextbooksQAResponse | null => {
      try {
        const raw = localStorage.getItem(cacheKey);
        return raw ? (JSON.parse(raw) as TextbooksQAResponse) : null;
      } catch {
        return null;
      }
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = readCached();
        if (cached) {
          setData(cached);
          setUsingOfflineCache(true);
          return;
        }
      }
      const resp = await apiFetch<TextbooksQAResponse>(`/api/textbooks-qa?lang=${lang}`);
      setData(resp);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(resp));
      } catch {
        // ignore quota limits
      }
    } catch (err) {
      const cached = readCached();
      if (cached) {
        setData(cached);
        setUsingOfflineCache(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load textbooks.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(language);
  }, [language, user.id]);

  // Keep form default chapter aligned when teacher switches chapter tabs
  useEffect(() => {
    if (typeof selectedTab === 'number') {
      setResChapter(String(selectedTab));
      if (!editingQaId) {
        setQaChapter(selectedTab);
      }
    } else if (selectedTab === 'all') {
      setResChapter('all');
    }
  }, [selectedTab, editingQaId]);

  const chapters = data?.chapters || [];
  const activeChapter =
    typeof selectedTab === 'number'
      ? chapters.find((c) => c.chapter_number === selectedTab) || null
      : null;

  const chapterTitleMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of chapters) {
      map.set(c.chapter_number, c.title);
    }
    return map;
  }, [chapters]);

  const officialBookResource = useMemo(() => {
    return (
      data?.resources.find((r) => r.attachment_url === OFFICIAL_BOOK_PDF_URL) || null
    );
  }, [data]);

  const visibleResources = useMemo(() => {
    if (!data) return [];
    const kw = searchQuery.trim().toLowerCase();
    return data.resources.filter((res) => {
      if (res.attachment_url === OFFICIAL_BOOK_PDF_URL) {
        return false;
      }
      const matchesTab =
        selectedTab === 'all'
          ? true
          : selectedTab === 'general'
          ? res.chapter_number === null
          : res.chapter_number === selectedTab;
      if (!matchesTab) return false;
      if (!kw) return true;
      return (
        res.title.toLowerCase().includes(kw) ||
        res.summary.toLowerCase().includes(kw) ||
        res.key_formulas.toLowerCase().includes(kw)
      );
    });
  }, [data, selectedTab, searchQuery]);

  const visibleMaterials = useMemo(() => {
    if (!data) return [];
    const kw = searchQuery.trim().toLowerCase();
    return data.materials.filter((m) => {
      if (selectedTab !== 'all' && selectedTab !== 'general') {
        const titleOrBody = `${m.title} ${m.content}`.toLowerCase();
        const chTag = `chapter ${selectedTab}`;
        const chKurdish = `بەشی ${selectedTab}`;
        const chArabic = `الفصل ${selectedTab}`;
        const matchesMention =
          titleOrBody.includes(chTag) ||
          titleOrBody.includes(chKurdish) ||
          titleOrBody.includes(chArabic);
        if (!matchesMention) return false;
      }
      if (!kw) return true;
      return m.title.toLowerCase().includes(kw) || m.content.toLowerCase().includes(kw);
    });
  }, [data, selectedTab, searchQuery]);

  const visibleQaItems = useMemo<CombinedQaItem[]>(() => {
    if (!data) return [];
    const kw = searchQuery.trim().toLowerCase();
    const list: CombinedQaItem[] = [];

    if (qaFilter === 'all' || qaFilter === 'worked') {
      for (const s of data.studyQa || []) {
        const matchesTab =
          selectedTab === 'all'
            ? true
            : selectedTab === 'general'
            ? false
            : s.chapter_number === selectedTab;
        if (!matchesTab) continue;
        if (kw) {
          const hay =
            `${s.question_text} ${s.answer_text} ${s.explanation_text} ${s.source_label}`.toLowerCase();
          if (!hay.includes(kw)) continue;
        }
        const chTitle = chapterTitleMap.get(s.chapter_number);
        list.push({
          kind: 'worked',
          key: `worked-${s.id}`,
          id: s.id,
          chapterNumber: s.chapter_number,
          chapterLabel: chTitle
            ? `${t.home.chapterWord} ${s.chapter_number} · ${chTitle}`
            : `${t.home.chapterWord} ${s.chapter_number}`,
          questionText: s.question_text,
          answerText: s.answer_text,
          explanationText: s.explanation_text,
          sourceLabel: s.source_label,
          raw: s,
        });
      }
    }

    if (qaFilter === 'all' || qaFilter === 'curriculum') {
      for (const q of data.curriculumQa || []) {
        const matchesTab =
          selectedTab === 'all'
            ? true
            : selectedTab === 'general'
            ? q.scope === 'general' || q.chapter_number === null
            : q.scope === 'chapter' && q.chapter_number === selectedTab;
        if (!matchesTab) continue;
        if (kw) {
          const hay =
            `${q.question_text} ${q.option_a} ${q.option_b} ${q.option_c} ${q.option_d} ${q.correct_option_text} ${q.explanation}`.toLowerCase();
          if (!hay.includes(kw)) continue;
        }
        list.push({
          kind: 'curriculum',
          key: `curr-${q.id}`,
          id: q.id,
          chapterNumber: q.chapter_number,
          chapterLabel:
            q.scope === 'general' || !q.chapter_number
              ? t.textbooks.generalScopeLabel
              : q.chapter_title
              ? `${t.home.chapterWord} ${q.chapter_number} · ${q.chapter_title}`
              : `${t.home.chapterWord} ${q.chapter_number}`,
          questionText: q.question_text,
          answerText: `${q.correct_option}. ${q.correct_option_text}`,
          explanationText: q.explanation,
          curriculum: q,
        });
      }
    }

    return list;
  }, [chapterTitleMap, data, qaFilter, searchQuery, selectedTab, t.home.chapterWord, t.textbooks.generalScopeLabel]);

  const allVisibleRevealed =
    visibleQaItems.length > 0 && visibleQaItems.every((item) => Boolean(revealedKeys[item.key]));

  const toggleRevealAll = () => {
    if (visibleQaItems.length === 0) return;
    if (allVisibleRevealed) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        for (const item of visibleQaItems) {
          delete next[item.key];
        }
        return next;
      });
    } else {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        for (const item of visibleQaItems) {
          next[item.key] = true;
        }
        return next;
      });
    }
  };

  const resetQaForm = () => {
    setEditingQaId(null);
    setQaChapter(typeof selectedTab === 'number' ? selectedTab : 1);
    setQaQuestion('');
    setQaAnswer('');
    setQaExplanation('');
    setQaSource('');
  };

  const handleSaveQa = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    setActionErr(null);
    setSavingQa(true);
    try {
      const payload = {
        chapterNumber: qaChapter,
        questionText: qaQuestion,
        answerText: qaAnswer,
        explanationText: qaExplanation,
        sourceLabel: qaSource,
      };
      if (editingQaId) {
        await apiFetch(`/api/textbooks-qa/qa/${editingQaId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/textbooks-qa/qa', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetQaForm();
      setShowQaForm(false);
      setActionMsg(t.textbooks.qaSavedMsg);
      await loadData(language);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to save study Q&A.');
    } finally {
      setSavingQa(false);
    }
  };

  const handleDeleteQa = async (id: number) => {
    setActionMsg(null);
    setActionErr(null);
    try {
      await apiFetch(`/api/textbooks-qa/qa/${id}`, { method: 'DELETE' });
      await loadData(language);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to delete study Q&A.');
    }
  };

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    setActionErr(null);
    setSavingResource(true);
    try {
      const formData = new FormData();
      formData.append('title', resTitle);
      formData.append('chapterNumber', resChapter);
      formData.append('resourceType', resType);
      formData.append('summary', resSummary);
      formData.append('keyFormulas', resFormulas);
      formData.append('externalUrl', resExternalUrl);
      if (resFile) {
        formData.append('file', resFile);
      }

      await apiFetch('/api/textbooks-qa/resources', {
        method: 'POST',
        body: formData,
      });

      setResTitle('');
      setResSummary('');
      setResFormulas('');
      setResExternalUrl('');
      setResFile(null);
      setShowResourceForm(false);
      setActionMsg(t.textbooks.resourceAddedMsg);
      await loadData(language);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to save textbook resource.');
    } finally {
      setSavingResource(false);
    }
  };

  const handleDeleteResource = async (id: number) => {
    setActionMsg(null);
    setActionErr(null);
    try {
      await apiFetch(`/api/textbooks-qa/resources/${id}`, { method: 'DELETE' });
      await loadData(language);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to delete resource.');
    }
  };

  const renderFormulasBar = (formulasStr: string) => {
    if (!formulasStr.trim()) return null;
    const chunks = formulasStr
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    if (chunks.length === 0) return null;
    return (
      <div className="mt-3 pt-3 border-t border-[#E6DFD5]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#57534E] mb-2">
          {t.textbooks.keyFormulasLabel}
        </p>
        <div className="flex flex-wrap gap-2" dir="ltr">
          {chunks.map((eq, idx) => (
            <code
              key={idx}
              className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold text-[#6B1118] font-mono-tabular"
            >
              {eq}
            </code>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-12 h-12 rounded-xl bg-[#F9EFF0] border border-[#E6DFD5] flex items-center justify-center shrink-0">
              <Library className="w-6 h-6 text-[#6B1118]" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917] [text-wrap:balance]">
                {t.textbooks.shelfTitle}
              </h2>
              <p className="mt-1.5 text-sm sm:text-base text-[#57534E] leading-relaxed">
                {t.textbooks.shelfSub}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {typeof selectedTab === 'number' && (
              <button
                type="button"
                onClick={() => {
                  onSelectChapter(selectedTab);
                  onNavigate('multiple-choice');
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#E5B742]" />
                <span>{t.textbooks.practiceChapterBtn}</span>
                <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
              </button>
            )}

            {isPrivileged && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setShowQaForm(false);
                    setShowResourceForm((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.textbooks.addTextbookBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResourceForm(false);
                    if (showQaForm && !editingQaId) {
                      setShowQaForm(false);
                    } else {
                      resetQaForm();
                      setShowQaForm(true);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#1C1917] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 text-[#6B1118]" />
                  <span>{t.textbooks.addQaBtn}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status Feedback */}
        {usingOfflineCache && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-[#FBF4DF]/70 px-4 py-2.5 text-xs font-medium text-[#1C1917]">
            <WifiOff className="w-4 h-4 text-[#D9A62E] shrink-0" />
            <span>{t.textbooks.offlineCacheNotice}</span>
          </div>
        )}

        {actionMsg && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-2.5 text-sm font-medium text-[#065F46]">
            <span>{actionMsg}</span>
            <button
              type="button"
              onClick={() => setActionMsg(null)}
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionErr && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-2.5 text-sm font-medium text-[#991B1B]">
            <span>{actionErr}</span>
            <button
              type="button"
              onClick={() => setActionErr(null)}
              className="p-1 rounded hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Teacher Resource Form */}
        {isPrivileged && showResourceForm && (
          <form
            onSubmit={handleCreateResource}
            className="mt-6 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-[#1C1917]">{t.textbooks.formResourceTitle}</h3>
              <button
                type="button"
                onClick={() => setShowResourceForm(false)}
                className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formChapterLabel}
                </label>
                <select
                  value={resChapter}
                  onChange={(e) => setResChapter(e.target.value)}
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                >
                  <option value="all">{t.textbooks.formAllOverviewOpt}</option>
                  {chapters.map((c) => (
                    <option key={c.chapter_number} value={String(c.chapter_number)}>
                      {t.home.chapterWord} {c.chapter_number} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formTypeLabel}
                </label>
                <select
                  value={resType}
                  onChange={(e) =>
                    setResType(e.target.value as 'textbook' | 'guide' | 'summary' | 'slides')
                  }
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                >
                  <option value="textbook">{t.textbooks.resourceTypes.textbook}</option>
                  <option value="guide">{t.textbooks.resourceTypes.guide}</option>
                  <option value="summary">{t.textbooks.resourceTypes.summary}</option>
                  <option value="slides">{t.textbooks.resourceTypes.slides}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formExternalUrlLabel}
                </label>
                <input
                  type="url"
                  value={resExternalUrl}
                  onChange={(e) => setResExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.textbooks.formSummaryLabel}
              </label>
              <textarea
                rows={3}
                value={resSummary}
                onChange={(e) => setResSummary(e.target.value)}
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.textbooks.formFormulasLabel}
              </label>
              <input
                type="text"
                value={resFormulas}
                onChange={(e) => setResFormulas(e.target.value)}
                placeholder="W = F · d (J) | P = W / Δt (W)"
                dir="ltr"
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm font-mono-tabular focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B1118] cursor-pointer rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 hover:border-[#6B1118]/40">
                <Paperclip className="w-4 h-4" />
                <span>{resFile ? resFile.name : t.textbooks.formAttachFileLabel}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setResFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowResourceForm(false)}
                  className="rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs font-semibold text-[#57534E] cursor-pointer"
                >
                  {t.textbooks.formCancelBtn}
                </button>
                <button
                  type="submit"
                  disabled={savingResource}
                  className="rounded-xl bg-[#6B1118] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 cursor-pointer min-h-[42px]"
                >
                  {savingResource ? t.textbooks.savingMsg : t.textbooks.formSaveResourceBtn}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Teacher Worked Study Q&A Form */}
        {isPrivileged && showQaForm && (
          <form
            onSubmit={handleSaveQa}
            className="mt-6 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-[#1C1917]">
                {editingQaId ? t.textbooks.formEditQaTitle : t.textbooks.formQaTitle}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowQaForm(false);
                  resetQaForm();
                }}
                className="p-1.5 rounded-lg text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formChapterLabel}
                </label>
                <select
                  value={qaChapter}
                  onChange={(e) => setQaChapter(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                >
                  {chapters.map((c) => (
                    <option key={c.chapter_number} value={c.chapter_number}>
                      {t.home.chapterWord} {c.chapter_number} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                  {t.textbooks.formSourceLabel}
                </label>
                <input
                  type="text"
                  value={qaSource}
                  onChange={(e) => setQaSource(e.target.value)}
                  placeholder="Textbook Study Guide"
                  className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.textbooks.formQuestionLabel}
              </label>
              <textarea
                rows={2}
                required
                value={qaQuestion}
                onChange={(e) => setQaQuestion(e.target.value)}
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.textbooks.formAnswerLabel}
              </label>
              <textarea
                rows={2}
                required
                value={qaAnswer}
                onChange={(e) => setQaAnswer(e.target.value)}
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.textbooks.formExplanationLabel}
              </label>
              <textarea
                rows={3}
                value={qaExplanation}
                onChange={(e) => setQaExplanation(e.target.value)}
                className="w-full rounded-lg border border-[#E6DFD5] bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#6B1118]"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowQaForm(false);
                  resetQaForm();
                }}
                className="rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-xs font-semibold text-[#57534E] cursor-pointer"
              >
                {t.textbooks.formCancelBtn}
              </button>
              <button
                type="submit"
                disabled={savingQa}
                className="rounded-xl bg-[#6B1118] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 cursor-pointer min-h-[42px]"
              >
                {savingQa
                  ? t.textbooks.savingMsg
                  : editingQaId
                  ? t.textbooks.formUpdateQaBtn
                  : t.textbooks.formSaveQaBtn}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Chapter Selector Strip */}
      <section className="rounded-2xl bg-white border border-[#E6DFD5] p-4 sm:p-5 space-y-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#57534E] absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.textbooks.searchPlaceholder}
            className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] ps-10 pe-4 py-2.5 text-sm text-[#1C1917] focus:outline-none focus:border-[#6B1118]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedTab('all')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              selectedTab === 'all'
                ? 'bg-[#6B1118] text-white border-[#6B1118]'
                : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6DFD5] hover:border-[#6B1118]/40'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.textbooks.allOverviewTab}</span>
          </button>

          {chapters.map((ch) => {
            const active = selectedTab === ch.chapter_number;
            return (
              <button
                key={ch.chapter_number}
                type="button"
                onClick={() => setSelectedTab(ch.chapter_number)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
                  active
                    ? 'bg-[#6B1118] text-white border-[#6B1118]'
                    : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6DFD5] hover:border-[#6B1118]/40'
                }`}
              >
                <span className="tabular-nums">
                  {t.textbooks.chapterTabPrefix} {ch.chapter_number}
                </span>
                <span className="opacity-70 font-normal hidden sm:inline truncate max-w-[140px]">
                  · {ch.title}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedTab('general')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px] ${
              selectedTab === 'general'
                ? 'bg-[#6B1118] text-white border-[#6B1118]'
                : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6DFD5] hover:border-[#6B1118]/40'
            }`}
          >
            <span>{t.textbooks.generalTabLabel}</span>
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD5] p-12 text-center text-sm text-[#57534E]">
          {t.textbooks.loadingTextbooks}
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white border border-[#DC2626]/30 p-8 text-center text-sm text-[#991B1B]">
          {error}
        </div>
      ) : (
        <section className="space-y-6">
          <div className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E6DFD5]">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917] flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-[#6B1118] shrink-0" />
                  <span>
                    {activeChapter
                      ? `${t.home.chapterWord} ${activeChapter.chapter_number}: ${activeChapter.title}`
                      : t.textbooks.shelfTitle}
                  </span>
                </h3>
                <p className="text-xs text-[#57534E] mt-1">
                  {activeChapter ? activeChapter.description : t.textbooks.shelfSub}
                </p>
              </div>
            </div>

            {/* Official Grade 9 Science Student Textbook Card */}
            <div className="rounded-xl border border-[#6B1118]/25 bg-[#F9EFF0]/65 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-14 rounded-lg bg-[#6B1118] text-[#E5B742] flex flex-col items-center justify-center shrink-0 shadow-sm">
                  <BookText className="w-5 h-5" />
                  <span className="text-[9px] font-bold tracking-wide mt-0.5 text-white tabular-nums">
                    G9
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-[#6B1118]">
                    {t.textbooks.officialBookMeta}
                  </p>
                  <h4 className="text-sm sm:text-base font-bold text-[#1C1917] leading-snug mt-0.5">
                    {officialBookResource ? (
                      <ScientificText text={officialBookResource.title} />
                    ) : (
                      t.textbooks.officialBookTitle
                    )}
                  </h4>
                  <p className="text-xs text-[#57534E] mt-1 leading-relaxed">
                    {t.textbooks.officialBookDesc}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const startPage =
                      typeof selectedTab === 'number'
                        ? getOfficialBookChapterPage(selectedTab)
                        : 1;
                    setReaderConfig({
                      url: OFFICIAL_BOOK_PDF_URL,
                      title:
                        officialBookResource?.title || t.textbooks.officialBookTitle,
                      fileName:
                        officialBookResource?.attachment_name || OFFICIAL_BOOK_FILENAME,
                      initialPage: startPage,
                      isOfficialBook: true,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#6B1118] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[40px]"
                >
                  <BookOpen className="w-4 h-4 text-[#E5B742]" />
                  <span>
                    {typeof selectedTab === 'number'
                      ? `${t.textbooks.previewChapterPageBtn} (${t.textbooks.chapterTabPrefix} ${selectedTab} · p.${getOfficialBookChapterPage(selectedTab)})`
                      : t.textbooks.previewBookBtn}
                  </span>
                </button>

                <a
                  href={OFFICIAL_BOOK_PDF_URL}
                  download={officialBookResource?.attachment_name || OFFICIAL_BOOK_FILENAME}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118] transition-colors min-h-[40px]"
                >
                  <Download className="w-3.5 h-3.5 text-[#6B1118]" />
                  <span>{t.textbooks.downloadBtn} PDF</span>
                </a>
              </div>
            </div>

            {visibleResources.length === 0 ? (
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-5 text-center text-xs sm:text-sm text-[#57534E]">
                {t.textbooks.noResourcesForChapter}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleResources.map((res: TextbookResource) => {
                  const hasPdf = isPdfAttachment(res.attachment_mime, res.attachment_url);
                  return (
                    <article
                      key={res.id}
                      className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#6B1118]">
                            <span>{t.textbooks.resourceTypes[res.resource_type]}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {res.chapter_number
                                ? `${t.home.chapterWord} ${res.chapter_number}`
                                : t.textbooks.generalScopeLabel}
                            </span>
                          </div>
                          <h4 className="mt-1 text-sm sm:text-base font-bold text-[#1C1917]">
                            <ScientificText text={res.title} />
                          </h4>
                        </div>
                        {isPrivileged && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteResource(res.id)}
                            aria-label={t.textbooks.deleteConfirmBtn}
                            className="p-1.5 rounded-lg text-[#57534E] hover:text-[#DC2626] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {res.summary && (
                        <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
                          <ScientificText text={res.summary} />
                        </p>
                      )}

                      {renderFormulasBar(res.key_formulas)}

                      {(res.attachment_url || res.external_url) && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          {res.attachment_url && hasPdf && (
                            <button
                              type="button"
                              onClick={() =>
                                setReaderConfig({
                                  url: res.attachment_url!,
                                  title: res.title,
                                  fileName: res.attachment_name,
                                  initialPage: 1,
                                  isOfficialBook:
                                    res.attachment_url === OFFICIAL_BOOK_PDF_URL,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B1118] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#530D12] cursor-pointer"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#E5B742]" />
                              <span>{t.textbooks.previewPdfBtn}</span>
                            </button>
                          )}
                          {res.attachment_url && res.attachment_name && (
                            <a
                              href={getAttachmentDownloadHref(
                                res.attachment_url,
                                res.attachment_name
                              )}
                              download={
                                res.attachment_url.startsWith('/uploads/')
                                  ? undefined
                                  : res.attachment_name
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118]"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>
                                {t.textbooks.downloadBtn}: {res.attachment_name}
                              </span>
                            </a>
                          )}
                          {res.external_url && (
                            <a
                              href={res.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#1C1917] hover:border-[#6B1118]"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#6B1118]" />
                              <span>{t.textbooks.openLinkLabel}</span>
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {/* Teacher-uploaded study materials from announcements */}
            {visibleMaterials.length > 0 && (
              <div className="pt-3 border-t border-[#E6DFD5] space-y-2.5">
                <p className="text-xs font-bold text-[#1C1917]">
                  {t.textbooks.teacherMaterialsTitle}
                </p>
                {visibleMaterials.map((mat) => (
                  <div
                    key={mat.id}
                    className="rounded-xl border border-[#E6DFD5] bg-white p-3.5 space-y-1.5"
                  >
                    <h5 className="text-sm font-semibold text-[#1C1917]">{mat.title}</h5>
                    <p className="text-xs text-[#57534E] leading-relaxed">{mat.content}</p>
                    {mat.attachment_url && mat.attachment_name && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {isPdfAttachment(mat.attachment_mime, mat.attachment_url) && (
                          <button
                            type="button"
                            onClick={() =>
                              setReaderConfig({
                                url: mat.attachment_url!,
                                title: mat.title,
                                fileName: mat.attachment_name,
                                initialPage: 1,
                                isOfficialBook: false,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6B1118] hover:underline cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t.textbooks.previewPdfBtn}</span>
                          </button>
                        )}
                        <a
                          href={getAttachmentDownloadHref(
                            mat.attachment_url,
                            mat.attachment_name
                          )}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B1118] hover:underline"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {t.textbooks.downloadBtn} {mat.attachment_name}
                          </span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solved Study Q&A Bank */}
          <div className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E6DFD5]">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-[#1C1917] flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#6B1118] shrink-0" />
                  <span>{t.textbooks.qaSectionTitle}</span>
                </h3>
                <p className="text-xs sm:text-sm text-[#57534E] mt-1">
                  {t.textbooks.qaSectionSub}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#57534E] tabular-nums">
                  {formatMsg(t.textbooks.qaCountLabel, { count: visibleQaItems.length })}
                </span>
                {visibleQaItems.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleRevealAll}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[38px]"
                  >
                    {allVisibleRevealed ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>{t.textbooks.hideAllBtn}</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t.textbooks.revealAllBtn}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Q&A Source Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: t.textbooks.filterAll },
                  { id: 'worked', label: t.textbooks.filterWorked },
                  { id: 'curriculum', label: t.textbooks.filterCurriculum },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQaFilter(opt.id)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer min-h-[38px] ${
                    qaFilter === opt.id
                      ? 'bg-[#6B1118] text-white border-[#6B1118]'
                      : 'bg-[#FAF8F5] text-[#1C1917] border-[#E6DFD5] hover:border-[#6B1118]/40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {visibleQaItems.length === 0 ? (
              <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-8 text-center space-y-1.5">
                <HelpCircle className="w-8 h-8 text-[#D9A62E] mx-auto" />
                <p className="text-sm font-semibold text-[#1C1917]">{t.textbooks.noQaFound}</p>
                <p className="text-xs text-[#57534E]">{t.textbooks.noQaSub}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleQaItems.map((item, idx) => {
                  const isRevealed = Boolean(revealedKeys[item.key]);
                  return (
                    <article
                      key={item.key}
                      className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                            <span className="text-[#57534E] tabular-nums">#{idx + 1}</span>
                            <span
                              className={`rounded-md px-2 py-0.5 ${
                                item.kind === 'worked'
                                  ? 'bg-[#F9EFF0] text-[#6B1118]'
                                  : 'bg-[#FBF4DF] text-[#92400E]'
                              }`}
                            >
                              {item.kind === 'worked'
                                ? t.textbooks.workedBadge
                                : t.textbooks.curriculumBadge}
                            </span>
                            <span className="text-[#57534E]">{item.chapterLabel}</span>
                            {item.kind === 'worked' && item.sourceLabel && (
                              <span className="text-[#57534E]">· {item.sourceLabel}</span>
                            )}
                          </div>

                          <h4 className="text-sm sm:text-base font-bold text-[#1C1917] leading-snug">
                            <ScientificText text={item.questionText} />
                          </h4>
                        </div>

                        {isPrivileged && item.kind === 'worked' && item.raw && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingQaId(item.id);
                                setQaChapter(item.raw!.chapter_number);
                                setQaQuestion(
                                  item.raw!.raw_question_text || item.raw!.question_text
                                );
                                setQaAnswer(item.raw!.raw_answer_text || item.raw!.answer_text);
                                setQaExplanation(
                                  item.raw!.raw_explanation_text || item.raw!.explanation_text
                                );
                                setQaSource(item.raw!.source_label || '');
                                setShowResourceForm(false);
                                setShowQaForm(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              aria-label={t.textbooks.formEditQaTitle}
                              className="p-1.5 rounded-lg text-[#57534E] hover:text-[#6B1118] cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteQa(item.id)}
                              aria-label={t.textbooks.deleteConfirmBtn}
                              className="p-1.5 rounded-lg text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {item.kind === 'curriculum' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {(
                            [
                              ['A', item.curriculum.option_a],
                              ['B', item.curriculum.option_b],
                              ['C', item.curriculum.option_c],
                              ['D', item.curriculum.option_d],
                            ] as const
                          ).map(([letter, optText]) => {
                            const isCorrectChoice =
                              isRevealed && item.curriculum.correct_option === letter;
                            return (
                              <div
                                key={letter}
                                className={`rounded-lg border px-3 py-2 text-xs sm:text-sm flex items-start gap-2 ${
                                  isCorrectChoice
                                    ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46] font-semibold'
                                    : 'border-[#E6DFD5] bg-white text-[#57534E]'
                                }`}
                              >
                                <span className="font-bold shrink-0">{letter}.</span>
                                <span className="flex-1">
                                  <ScientificText text={optText} />
                                </span>
                                {isCorrectChoice && (
                                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedKeys((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] cursor-pointer min-h-[34px]"
                        >
                          {isRevealed ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>{t.textbooks.hideAnswerBtn}</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>{t.textbooks.showAnswerBtn}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {isRevealed && (
                        <div className="rounded-xl border border-[#059669]/40 bg-[#ECFDF5] p-3.5 space-y-2">
                          <div className="text-xs sm:text-sm font-bold text-[#065F46]">
                            <span className="uppercase tracking-wide text-[11px] block opacity-85 mb-0.5">
                              {t.textbooks.correctAnswerHeading}
                            </span>
                            <ScientificText text={item.answerText} />
                          </div>
                          {item.explanationText && (
                            <div className="text-xs sm:text-sm text-[#1C1917] bg-white border border-[#059669]/30 rounded-lg px-3 py-2 leading-relaxed">
                              <strong className="text-[#065F46]">
                                {t.textbooks.explanationHeading}:{' '}
                              </strong>
                              <ScientificText text={item.explanationText} />
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {readerConfig && (
        <TextbookPdfViewerModal
          url={readerConfig.url}
          title={readerConfig.title}
          fileName={readerConfig.fileName}
          initialPage={readerConfig.initialPage}
          isOfficialBook={readerConfig.isOfficialBook}
          onClose={() => setReaderConfig(null)}
        />
      )}
    </div>
  );
};
