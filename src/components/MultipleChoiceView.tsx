import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookText,
  CheckCircle2,
  Edit3,
  Layers,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
  Upload,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { ApiError, apiFetch } from '../lib/api';
import {
  COMPETITION_UPDATED_EVENT,
  enqueuePointEvent,
  getOfflineQuestionsCache,
  saveOfflineQuestionsCache,
} from '../lib/competitionQueue';
import { useLanguage } from '../contexts/LanguageContext';
import { playAnswerSound, useSettings } from '../contexts/SettingsContext';
import { formatMsg } from '../i18n/translations';
import {
  Chapter,
  Question,
  QuizAnswerCheckResult,
  QuizSubmissionResponse,
  User,
} from '../types';
import {
  OFFICIAL_BOOK_FILENAME,
  OFFICIAL_BOOK_PDF_URL,
  getOfficialBookChapterMeta,
  getOfficialBookChapterPage,
  getOfficialBookChapterTitle,
} from '../lib/textbookCatalog';
import { ScientificText } from './ScientificText';
import { TextbookPdfViewerModal } from './TextbookPdfViewerModal';

interface MultipleChoiceViewProps {
  user: User;
  chapters: Chapter[];
  initialSelection: number | 'all' | null;
  onClearInitialSelection: () => void;
  onRefreshChapters: () => Promise<void>;
}

export const MultipleChoiceView: React.FC<MultipleChoiceViewProps> = ({
  user,
  chapters,
  initialSelection,
  onClearInitialSelection,
  onRefreshChapters,
}) => {
  const { language, t, dir } = useLanguage();
  const { settings } = useSettings();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const [selectedTarget, setSelectedTarget] = useState<number | 'all' | null>(initialSelection);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [checkedResults, setCheckedResults] = useState<Record<number, QuizAnswerCheckResult>>({});
  const [checkingQuestionId, setCheckingQuestionId] = useState<number | null>(null);
  const [submission, setSubmission] = useState<QuizSubmissionResponse | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);

  // Admin inline management toggle inside an open chapter
  const [manageMode, setManageMode] = useState(false);

  // Teacher / Admin Chapter Title Editor
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterTitleInput, setChapterTitleInput] = useState('');
  const [chapterDescInput, setChapterDescInput] = useState('');

  // Teacher / Admin Question Manager Form
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [qChapter, setQChapter] = useState<number>(1);
  const [qText, setQText] = useState('');
  const [qA, setQA] = useState('');
  const [qB, setQB] = useState('');
  const [qC, setQC] = useState('');
  const [qD, setQD] = useState('');
  const [qCorrect, setQCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [qExplanation, setQExplanation] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkChapter, setBulkChapter] = useState<number>(1);
  const [managerMsg, setManagerMsg] = useState<string | null>(null);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [readerConfig, setReaderConfig] = useState<{
    title: string;
    initialPage: number;
  } | null>(null);

  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const explanationRef = useRef<HTMLDivElement | null>(null);
  const checkedResultsRef = useRef(checkedResults);
  const answersRef = useRef(answers);
  const submissionRef = useRef(submission);

  useEffect(() => {
    checkedResultsRef.current = checkedResults;
  }, [checkedResults]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    submissionRef.current = submission;
  }, [submission]);

  useEffect(() => {
    if (initialSelection !== null) {
      setSelectedTarget(initialSelection);
      onClearInitialSelection();
    }
  }, [initialSelection, onClearInitialSelection]);

  const loadQuestionsForTarget = async (
    target: number | 'all',
    preserveIndex = false,
    langOverride = language
  ) => {
    setLoadingQuiz(true);
    setQuizError(null);
    setUsingOfflineCache(false);
    if (!preserveIndex) {
      setSubmission(null);
      setAnswers({});
      setCheckedResults({});
      setCurrentIndex(0);
    }
    const cacheKey = `mc_${target}_${langOverride}`;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getOfflineQuestionsCache(cacheKey);
        if (cached && cached.length > 0) {
          setQuestions(cached);
          setUsingOfflineCache(true);
          return;
        }
      }
      const url =
        target === 'all'
          ? `/api/questions?mode=all_chapters&lang=${langOverride}`
          : `/api/questions?mode=chapter&chapterNumber=${target}&lang=${langOverride}`;
      const data = await apiFetch<{ questions: Question[] }>(url);
      setQuestions(data.questions);
      void saveOfflineQuestionsCache(cacheKey, data.questions);
    } catch (err) {
      const cached = await getOfflineQuestionsCache(cacheKey);
      if (cached && cached.length > 0) {
        setQuestions(cached);
        setUsingOfflineCache(true);
      } else {
        setQuizError(err instanceof Error ? err.message : 'Failed to load questions.');
      }
    } finally {
      setLoadingQuiz(false);
    }
  };

  useEffect(() => {
    if (selectedTarget !== null) {
      setManageMode(false);
      setShowAddQuestion(false);
      void loadQuestionsForTarget(selectedTarget, false, language);
    }
  }, [selectedTarget]);

  const prevLangRef = useRef(language);
  useEffect(() => {
    if (prevLangRef.current === language) return;
    prevLangRef.current = language;
    if (selectedTarget === null) return;

    void loadQuestionsForTarget(selectedTarget, true, language);

    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const currentChecked = checkedResultsRef.current;
    const onlineCheckedEntries = Object.entries(currentChecked).filter(
      ([, res]) => !res.offlineQueued
    );
    if (onlineCheckedEntries.length > 0) {
      Promise.all(
        onlineCheckedEntries.map(([qIdStr, res]) =>
          apiFetch<QuizAnswerCheckResult>('/api/quizzes/check-answer', {
            method: 'POST',
            body: JSON.stringify({
              questionId: Number(qIdStr),
              selectedOption: res.selectedOption,
              lang: language,
              skipSave: true,
            }),
          })
        )
      )
        .then((updated) => {
          setCheckedResults((prev) => {
            const next = { ...prev };
            for (const item of updated) {
              next[item.questionId] = item;
            }
            return next;
          });
        })
        .catch(() => {});
    }

    const currentSub = submissionRef.current;
    if (currentSub && !currentSub.offlineQueued) {
      apiFetch<QuizSubmissionResponse>('/api/quizzes/submit', {
        method: 'POST',
        body: JSON.stringify({
          mode: selectedTarget === 'all' ? 'all_chapters' : 'chapter',
          chapterNumber: selectedTarget === 'all' ? null : selectedTarget,
          answers: answersRef.current,
          lang: language,
          skipSave: true,
        }),
      })
        .then((data) => setSubmission(data))
        .catch(() => {});
    }
  }, [language, selectedTarget]);

  const handleSelectAnswer = async (questionId: number, optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (checkedResults[questionId] || checkingQuestionId === questionId) return;

    setQuizError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
    setCheckingQuestionId(questionId);

    const qObj = questions.find((q) => q.id === questionId);

    const queueAnswerOffline = async () => {
      await enqueuePointEvent(user.id, {
        eventKey: `offline-ans-${user.id}-${questionId}-${optionKey}-${Math.floor(Date.now() / 60000)}`,
        eventType: 'correct_answer',
        points: 10,
        chapterNumber: qObj?.chapter_number ?? (typeof selectedTarget === 'number' ? selectedTarget : null),
        questionId,
        selectedOption: optionKey,
        details: `Offline question #${questionId}`,
        createdAt: new Date().toISOString(),
      });
      setCheckedResults((prev) => ({
        ...prev,
        [questionId]: {
          questionId,
          selectedOption: optionKey,
          selectedOptionText: '',
          correctOption: optionKey,
          correctOptionText: '',
          isCorrect: true,
          explanation: '',
          offlineQueued: true,
        },
      }));
      if (settings.autoScrollFeedback) {
        setTimeout(() => {
          explanationRef.current?.scrollIntoView({
            behavior: settings.reduceMotion ? 'auto' : 'smooth',
            block: 'nearest',
          });
        }, 50);
      }
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueAnswerOffline();
        return;
      }

      const result = await apiFetch<QuizAnswerCheckResult>('/api/quizzes/check-answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId,
          selectedOption: optionKey,
          lang: language,
        }),
      });
      setCheckedResults((prev) => ({ ...prev, [questionId]: result }));
      if (result.pointsAwarded && result.pointsAwarded > 0) {
        window.dispatchEvent(new CustomEvent(COMPETITION_UPDATED_EVENT));
      }
      if (settings.soundFeedback) {
        playAnswerSound(result.isCorrect);
      }
      if (settings.autoScrollFeedback) {
        setTimeout(() => {
          explanationRef.current?.scrollIntoView({
            behavior: settings.reduceMotion ? 'auto' : 'smooth',
            block: 'nearest',
          });
        }, 50);
      }
    } catch (err) {
      const isNetworkOrOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        !(err instanceof ApiError) ||
        err.status >= 500;

      if (isNetworkOrOffline) {
        await queueAnswerOffline();
      } else {
        setAnswers((prev) => {
          const copy = { ...prev };
          delete copy[questionId];
          return copy;
        });
        setQuizError(err instanceof Error ? err.message : 'Could not verify answer. Please try again.');
      }
    } finally {
      setCheckingQuestionId(null);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setTimeout(() => {
        questionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  };

  const handleSubmitQuiz = async () => {
    if (selectedTarget === null) return;
    setSubmittingQuiz(true);
    setQuizError(null);
    const quizMode = selectedTarget === 'all' ? 'all_chapters' : 'chapter';
    const quizChapter = selectedTarget === 'all' ? null : selectedTarget;

    const queueQuizOffline = async () => {
      const normalizedAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(answers)) {
        normalizedAnswers[String(k)] = v;
      }
      await enqueuePointEvent(user.id, {
        eventKey: `offline-quiz-${user.id}-${quizMode}-${quizChapter ?? 'all'}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        eventType: 'quiz_completed',
        points: 25,
        mode: quizMode,
        chapterNumber: quizChapter,
        answers: normalizedAnswers,
        details: `Offline ${quizMode}${quizChapter ? ` Ch.${quizChapter}` : ''} (${questions.length} Qs)`,
        createdAt: new Date().toISOString(),
      });
      setSubmission({
        totalQuestions: questions.length,
        correctCount: Object.values(checkedResults).filter((r) => !r.offlineQueued && r.isCorrect).length,
        scorePercent: 0,
        results: [],
        offlineQueued: true,
      });
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueQuizOffline();
        return;
      }

      const data = await apiFetch<QuizSubmissionResponse>('/api/quizzes/submit', {
        method: 'POST',
        body: JSON.stringify({
          mode: quizMode,
          chapterNumber: quizChapter,
          answers,
          lang: language,
        }),
      });
      setSubmission(data);
      if (data.pointsAwarded && data.pointsAwarded > 0) {
        window.dispatchEvent(new CustomEvent(COMPETITION_UPDATED_EVENT));
      }
    } catch (err) {
      const isNetworkOrOffline =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        !(err instanceof ApiError) ||
        err.status >= 500;

      if (isNetworkOrOffline) {
        await queueQuizOffline();
      } else {
        setQuizError(err instanceof Error ? err.message : 'Failed to submit quiz.');
      }
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setQText('');
    setQA('');
    setQB('');
    setQC('');
    setQD('');
    setQCorrect('A');
    setQExplanation('');
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError(null);
    setManagerMsg(null);
    try {
      const payload = {
        scope: 'chapter',
        chapterNumber: qChapter,
        questionText: qText,
        optionA: qA,
        optionB: qB,
        optionC: qC,
        optionD: qD,
        correctOption: qCorrect,
        explanation: qExplanation,
      };
      if (editingQuestionId) {
        await apiFetch(`/api/questions/${editingQuestionId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setManagerMsg(t.quiz.questionSavedMsg);
      } else {
        await apiFetch('/api/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setManagerMsg(formatMsg(t.quiz.questionAddedMsg, { chapter: qChapter }));
      }
      resetQuestionForm();
      setShowAddQuestion(false);
      await onRefreshChapters();
      if (selectedTarget !== null) {
        await loadQuestionsForTarget(selectedTarget, true);
      }
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : 'Failed to save question.');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    try {
      await apiFetch(`/api/questions/${id}`, { method: 'DELETE' });
      await onRefreshChapters();
      if (selectedTarget !== null) {
        await loadQuestionsForTarget(selectedTarget, true);
      }
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : 'Failed to delete question.');
    }
  };

  const handleSaveChapterTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChapter) return;
    setManagerError(null);
    setManagerMsg(null);
    try {
      await apiFetch(`/api/chapters/${editingChapter.chapter_number}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: chapterTitleInput,
          description: chapterDescInput,
        }),
      });
      setEditingChapter(null);
      await onRefreshChapters();
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : 'Failed to update chapter.');
    }
  };

  const parseAndImportBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setManagerError(null);
    setManagerMsg(null);

    const blocks = bulkText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);

    const parsed: Array<{
      scope: 'chapter';
      chapterNumber: number;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
    }> = [];

    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      let questionLine = '';
      let a = '';
      let b = '';
      let c = '';
      let d = '';
      let ans = '';

      for (const line of lines) {
        if (/^A[).:]\s+/i.test(line)) a = line.replace(/^A[).:]\s+/i, '').trim();
        else if (/^B[).:]\s+/i.test(line)) b = line.replace(/^B[).:]\s+/i, '').trim();
        else if (/^C[).:]\s+/i.test(line)) c = line.replace(/^C[).:]\s+/i, '').trim();
        else if (/^D[).:]\s+/i.test(line)) d = line.replace(/^D[).:]\s+/i, '').trim();
        else if (/^(Answer|Ans|Correct)\s*[:\-]\s*([ABCD])/i.test(line)) {
          const m = line.match(/^(?:Answer|Ans|Correct)\s*[:\-]\s*([ABCD])/i);
          if (m) ans = m[1].toUpperCase();
        } else if (!a) {
          questionLine = questionLine ? `${questionLine} ${line}` : line.replace(/^\d+[).]\s*/, '');
        }
      }

      if (questionLine && a && b && c && d && ['A', 'B', 'C', 'D'].includes(ans)) {
        parsed.push({
          scope: 'chapter',
          chapterNumber: bulkChapter,
          questionText: questionLine,
          optionA: a,
          optionB: b,
          optionC: c,
          optionD: d,
          correctOption: ans,
        });
      }
    }

    if (parsed.length === 0) {
      setManagerError(
        'No complete questions detected. Separate each question with a blank line and include A), B), C), D), and Answer: A/B/C/D.'
      );
      return;
    }

    try {
      await apiFetch('/api/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions: parsed }),
      });
      setBulkText('');
      setShowBulkImport(false);
      setManagerMsg(
        formatMsg(t.quiz.bulkImportedMsg, { count: parsed.length, chapter: bulkChapter })
      );
      await onRefreshChapters();
      if (selectedTarget !== null) {
        await loadQuestionsForTarget(selectedTarget, true);
      }
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : 'Bulk import failed.');
    }
  };

  const renderQuestionEditorForm = () => (
    <form
      onSubmit={handleSaveQuestion}
      className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#1C1917]">
          {editingQuestionId ? t.quiz.editQuestion : t.quiz.addChapterQuestion}
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowAddQuestion(false);
            resetQuestionForm();
          }}
          className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
        >
          {t.quiz.cancel}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-[#1C1917] mb-1">
            {t.quiz.targetChapter}
          </label>
          <select
            value={qChapter}
            onChange={(e) => setQChapter(Number(e.target.value))}
            className="w-full rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
          >
            {chapters.map((ch) => (
              <option key={ch.chapter_number} value={ch.chapter_number}>
                {t.home.chapterWord} {ch.chapter_number}: {ch.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#1C1917] mb-1">
            {t.quiz.correctAnswerOpt}
          </label>
          <select
            value={qCorrect}
            onChange={(e) => setQCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
            className="w-full rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-semibold text-[#6B1118]"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#1C1917] mb-1">
          {t.quiz.questionTextLabel}
        </label>
        <textarea
          rows={2}
          required
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          className="w-full rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={qA}
          onChange={(e) => setQA(e.target.value)}
          placeholder="A"
          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
        <input
          type="text"
          required
          value={qB}
          onChange={(e) => setQB(e.target.value)}
          placeholder="B"
          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
        <input
          type="text"
          required
          value={qC}
          onChange={(e) => setQC(e.target.value)}
          placeholder="C"
          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
        <input
          type="text"
          required
          value={qD}
          onChange={(e) => setQD(e.target.value)}
          placeholder="D"
          className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#1C1917] mb-1">
          {t.quiz.explanationFieldLabel}
        </label>
        <textarea
          rows={2}
          value={qExplanation}
          onChange={(e) => setQExplanation(e.target.value)}
          className="w-full rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
      >
        <Save className="w-4 h-4 text-[#E5B742]" />
        <span>{editingQuestionId ? t.quiz.updateQuestion : t.quiz.saveQuestion}</span>
      </button>
    </form>
  );

  const totalAllQuestions = chapters.reduce((acc, c) => acc + c.question_count, 0);

  // ---------------- CHAPTER DIRECTORY VIEW ----------------
  if (selectedTarget === null) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.quiz.mcTitle}</h2>
            <p className="text-sm text-[#57534E] mt-1">{t.quiz.mcSubtitle}</p>
          </div>

          {isPrivileged && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  resetQuestionForm();
                  setShowBulkImport(false);
                  setShowAddQuestion((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
              >
                <Plus className="w-4 h-4 text-[#E5B742]" />
                <span>{t.quiz.addQuestion}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddQuestion(false);
                  setShowBulkImport((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E6DFD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[44px]"
              >
                <Upload className="w-4 h-4 text-[#6B1118]" />
                <span>{t.quiz.bulkImport}</span>
              </button>
            </div>
          )}
        </div>

        {managerMsg && (
          <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]">
            {managerMsg}
          </div>
        )}
        {managerError && (
          <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
            {managerError}
          </div>
        )}

        {isPrivileged && showAddQuestion && renderQuestionEditorForm()}

        {isPrivileged && showBulkImport && (
          <form
            onSubmit={parseAndImportBulk}
            className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1C1917]">{t.quiz.bulkTitle}</h3>
                <p className="text-xs text-[#57534E]">{t.quiz.bulkDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkImport(false)}
                className="text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                {t.quiz.cancel}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C1917] mb-1">
                {t.quiz.destChapter}
              </label>
              <select
                value={bulkChapter}
                onChange={(e) => setBulkChapter(Number(e.target.value))}
                className="w-full sm:w-80 rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
              >
                {chapters.map((ch) => (
                  <option key={ch.chapter_number} value={ch.chapter_number}>
                    {t.home.chapterWord} {ch.chapter_number}: {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={8}
              required
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              dir="ltr"
              placeholder={`1. What is the SI unit of force?\nA) Joule\nB) Newton\nC) Watt\nD) Pascal\nAnswer: B`}
              className="w-full rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] p-4 text-sm font-mono"
            />

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
            >
              <Upload className="w-4 h-4 text-[#E5B742]" />
              <span>{t.quiz.importQuestions}</span>
            </button>
          </form>
        )}

        {/* Featured All Chapters Option */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedTarget('all')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedTarget('all');
            }
          }}
          className="w-full text-start rounded-2xl bg-[#6B1118] text-white p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#530D12] transition-colors cursor-pointer"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E5B742]">
              <Layers className="w-4 h-4" />
              <span>{t.quiz.combinedBadge}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold">{t.quiz.allChapters}</h3>
            <p className="text-sm text-[#FBF4DF]/85 max-w-xl">{t.quiz.allChaptersDesc}</p>
          </div>
          <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
            <div className="text-start sm:text-end">
              <p className="text-2xl font-bold text-[#E5B742] tabular-nums">{totalAllQuestions}</p>
              <p className="text-xs text-[#FBF4DF]/80">{t.quiz.totalQuestions}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReaderConfig({
                  title: t.textbooks.officialBookTitle,
                  initialPage: 1,
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/25 transition-colors cursor-pointer whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <BookText className="w-3.5 h-3.5 text-[#E5B742]" />
              <span>{t.textbooks.readFullTextbookBtn}</span>
            </button>
          </div>
        </div>

        {/* Exactly 11 Chapters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters.map((ch) => {
            const chMeta = getOfficialBookChapterMeta(ch.chapter_number);
            const startPage = getOfficialBookChapterPage(ch.chapter_number);
            const bookChTitle = getOfficialBookChapterTitle(ch.chapter_number, language);
            return (
              <div
                key={ch.chapter_number}
                className="rounded-2xl bg-white border border-[#E6DFD5] p-5 flex flex-col justify-between hover:border-[#6B1118]/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-[#57534E]">
                    <span className="font-semibold text-[#6B1118] tabular-nums">
                      {t.home.chapterWord} {ch.chapter_number}
                    </span>
                    <span className="tabular-nums">
                      {ch.question_count}{' '}
                      {ch.question_count === 1 ? t.home.questionSingular : t.home.questionPlural}
                    </span>
                  </div>

                  {editingChapter?.chapter_number === ch.chapter_number ? (
                    <form onSubmit={handleSaveChapterTitle} className="mt-3 space-y-2.5">
                      <input
                        type="text"
                        required
                        value={chapterTitleInput}
                        onChange={(e) => setChapterTitleInput(e.target.value)}
                        className="w-full rounded-lg border border-[#E6DFD5] px-3 py-2 text-sm font-semibold"
                      />
                      <input
                        type="text"
                        value={chapterDescInput}
                        onChange={(e) => setChapterDescInput(e.target.value)}
                        className="w-full rounded-lg border border-[#E6DFD5] px-3 py-2 text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="rounded-lg bg-[#6B1118] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          {t.quiz.save}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChapter(null);
                            setManagerError(null);
                          }}
                          className="rounded-lg border border-[#E6DFD5] px-3 py-1.5 text-xs font-semibold text-[#57534E] cursor-pointer"
                        >
                          {t.quiz.cancel}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <h3 className="mt-2 text-lg font-bold text-[#1C1917]">{ch.title}</h3>
                      {ch.description && (
                        <p className="mt-1 text-xs text-[#57534E] line-clamp-2">{ch.description}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-[#E6DFD5] flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTarget(ch.chapter_number)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF8F5] border border-[#E6DFD5] px-3.5 py-2 text-xs font-semibold text-[#6B1118] hover:bg-[#6B1118] hover:text-white transition-colors cursor-pointer min-h-[40px] whitespace-nowrap shrink-0"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{t.quiz.openChapter}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReaderConfig({
                          title: `${t.home.chapterWord} ${ch.chapter_number}: ${bookChTitle || ch.title}`,
                          initialPage: startPage,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#F9EFF0] border border-[#6B1118]/20 px-3 py-2 text-xs font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[40px] whitespace-nowrap shrink-0 tabular-nums"
                    >
                      <BookText className="w-3.5 h-3.5" />
                      <span>
                        {t.textbooks.textbookShortLabel} · p.{startPage}
                        {chMeta ? `–${chMeta.endPage}` : ''}
                      </span>
                    </button>
                  </div>

                  {isPrivileged && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingChapter(ch);
                        setChapterTitleInput(ch.raw_title || ch.title);
                        setChapterDescInput(ch.raw_description ?? ch.description);
                      }}
                      aria-label={`Rename Chapter ${ch.chapter_number}`}
                      className="p-2 text-[#57534E] hover:text-[#6B1118] rounded-lg cursor-pointer shrink-0"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {readerConfig && (
          <TextbookPdfViewerModal
            url={OFFICIAL_BOOK_PDF_URL}
            title={readerConfig.title}
            fileName={OFFICIAL_BOOK_FILENAME}
            initialPage={readerConfig.initialPage}
            isOfficialBook={true}
            onClose={() => setReaderConfig(null)}
          />
        )}
      </div>
    );
  }

  // ---------------- QUIZ RUNNER (ONE QUESTION AT A TIME) & RESULTS VIEW ----------------
  const activeChapterObj =
    selectedTarget === 'all'
      ? null
      : chapters.find((c) => c.chapter_number === selectedTarget) || null;

  const safeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0;
  const currentQ = questions[safeIndex];
  const currentCheck = currentQ ? checkedResults[currentQ.id] : undefined;
  const gradedResults = Object.values(checkedResults).filter((r) => !r.offlineQueued);
  const answeredCount = gradedResults.length;
  const correctSoFar = gradedResults.filter((r) => r.isCorrect).length;
  const progressPercent =
    questions.length > 0 ? Math.round(((safeIndex + (currentCheck ? 1 : 0)) / questions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedTarget(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6DFD5] bg-white px-3.5 py-2 text-sm font-semibold text-[#1C1917] hover:border-[#6B1118] cursor-pointer min-h-[44px]"
          >
            <BackIcon className="w-4 h-4" />
            <span>{t.quiz.all11ChaptersBack}</span>
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#1C1917]">
              {selectedTarget === 'all'
                ? t.quiz.allChaptersQuizTitle
                : `${t.home.chapterWord} ${selectedTarget}: ${activeChapterObj?.title || ''}`}
            </h2>
            <p className="text-xs text-[#57534E] tabular-nums">
              {questions.length} {t.quiz.questionsAvailable}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedTarget === 'all') {
                setReaderConfig({
                  title: t.textbooks.officialBookTitle,
                  initialPage: 1,
                });
              } else {
                const bookTitle = getOfficialBookChapterTitle(selectedTarget, language);
                setReaderConfig({
                  title: `${t.home.chapterWord} ${selectedTarget}: ${bookTitle || activeChapterObj?.title || ''}`,
                  initialPage: getOfficialBookChapterPage(selectedTarget),
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#6B1118]/25 bg-[#F9EFF0] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#6B1118] hover:border-[#6B1118] transition-colors cursor-pointer min-h-[44px] whitespace-nowrap shrink-0 tabular-nums"
          >
            <BookText className="w-4 h-4" />
            <span>
              {selectedTarget === 'all'
                ? t.textbooks.readFullTextbookBtn
                : `${t.textbooks.textbookShortLabel} · p.${getOfficialBookChapterPage(selectedTarget)}`}
            </span>
          </button>

          {isPrivileged && (
            <>
              <button
                type="button"
                onClick={() => setManageMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap shrink-0 ${
                  manageMode
                    ? 'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118]'
                    : 'border-[#E6DFD5] bg-white text-[#1C1917] hover:border-[#6B1118]'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>{manageMode ? t.quiz.backToQuizMode : t.quiz.manageAllQuestions}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  resetQuestionForm();
                  if (typeof selectedTarget === 'number') setQChapter(selectedTarget);
                  setShowAddQuestion((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px] whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 text-[#E5B742]" />
                <span>{t.quiz.addQuestionHere}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {managerMsg && (
        <div className="rounded-xl border border-[#059669]/30 bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]">
          {managerMsg}
        </div>
      )}
      {managerError && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {managerError}
        </div>
      )}
      {quizError && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {quizError}
        </div>
      )}
      {usingOfflineCache && (
        <div className="rounded-xl border border-[#D9A62E]/40 bg-[#FAF8F5] px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-[#57534E]">
          <WifiOff className="w-4 h-4 text-[#D9A62E] shrink-0" />
          <span>{t.quiz.cachedOfflineModeNotice}</span>
        </div>
      )}

      {isPrivileged && showAddQuestion && renderQuestionEditorForm()}

      {loadingQuiz ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD5] p-10 text-center text-sm text-[#57534E]">
          {t.quiz.loadingQuestions}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD5] p-10 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-[#D9A62E] mx-auto" />
          <h3 className="text-lg font-bold text-[#1C1917]">{t.quiz.noQuestionsYet}</h3>
          <p className="text-sm text-[#57534E] max-w-md mx-auto">
            {selectedTarget === 'all' ? t.quiz.noQuestionsAllDesc : t.quiz.noQuestionsChDesc}
          </p>
        </div>
      ) : isPrivileged && manageMode ? (
        /* ---------------- ADMIN QUESTION BANK MANAGER FOR THIS CHAPTER ---------------- */
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-2xl bg-white border border-[#E6DFD5] p-5 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#6B1118] tabular-nums">
                    Q{idx + 1} · {q.correct_option || '—'}
                    {q.chapter_number ? ` · ${t.home.chapterWord} ${q.chapter_number}` : ''}
                  </p>
                  <p className="text-sm font-semibold text-[#1C1917] mt-1">
                    <ScientificText text={q.question_text} />
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestionId(q.id);
                      setQChapter(q.chapter_number || 1);
                      setQText(q.raw_question_text || q.question_text);
                      setQA(q.raw_option_a || q.option_a);
                      setQB(q.raw_option_b || q.option_b);
                      setQC(q.raw_option_c || q.option_c);
                      setQD(q.raw_option_d || q.option_d);
                      setQCorrect((q.correct_option as 'A' | 'B' | 'C' | 'D') || 'A');
                      setQExplanation(q.raw_explanation ?? q.explanation ?? '');
                      setShowAddQuestion(true);
                    }}
                    aria-label="Edit question"
                    className="p-2 text-[#57534E] hover:text-[#6B1118] rounded-lg cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(q.id)}
                    aria-label="Delete question"
                    className="p-2 text-[#57534E] hover:text-[#DC2626] rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {q.explanation && (
                <p className="text-xs text-[#57534E] bg-[#FAF8F5] rounded-lg px-3 py-2 border border-[#E6DFD5]">
                  <strong>{t.quiz.explanationLabel}</strong> <ScientificText text={q.explanation} />
                </p>
              )}
            </div>
          ))}
        </div>
      ) : submission ? (
        /* ---------------- FINAL RESULTS BREAKDOWN ---------------- */
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#6B1118] text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6">
            <div>
              {submission.offlineQueued ? (
                <>
                  <p className="text-xs font-semibold text-[#E5B742] flex items-center gap-1.5">
                    <WifiOff className="w-4 h-4" />
                    <span>{t.quiz.offlineQuizSavedTitle}</span>
                  </p>
                  <h3 className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums">
                    {Object.keys(answers).length} / {submission.totalQuestions}
                  </h3>
                  <p className="mt-1 text-sm text-[#FBF4DF]/85 max-w-xl">
                    {t.quiz.offlineQuizSavedDesc}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-[#E5B742]">{t.quiz.quizComplete}</p>
                  <h3 className="mt-1 text-2xl sm:text-3xl font-bold tabular-nums">
                    {submission.correctCount} / {submission.totalQuestions} ({submission.scorePercent}%)
                  </h3>
                  <p className="mt-1 text-sm text-[#FBF4DF]/85">{t.quiz.reviewBelow}</p>
                  {submission.pointsAwarded && submission.pointsAwarded > 0 ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#E5B742]">
                      <Trophy className="w-4 h-4" />
                      <span>
                        {formatMsg(t.quiz.pointsEarnedPill, { pts: submission.pointsAwarded })}
                      </span>
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSubmission(null);
                setAnswers({});
                setCheckedResults({});
                setCurrentIndex(0);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-[#6B1118] px-5 py-2.5 text-sm font-semibold hover:bg-[#FBF4DF] cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.quiz.retakeQuiz}</span>
            </button>
          </div>

          <div className="space-y-4">
            {submission.results.map((res, idx) => {
              const optionMap: Record<string, string> = {
                A: res.optionA,
                B: res.optionB,
                C: res.optionC,
                D: res.optionD,
              };
              return (
                <div
                  key={res.questionId}
                  className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[#57534E] font-medium tabular-nums">
                      #{idx + 1}
                      {res.chapterNumber
                        ? ` · ${t.home.chapterWord} ${res.chapterNumber}${
                            res.chapterTitle ? ` (${res.chapterTitle})` : ''
                          }`
                        : ''}
                    </span>
                    {res.isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#059669]">
                        <CheckCircle2 className="w-4 h-4" />
                        {t.quiz.correctBadge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#DC2626]">
                        <XCircle className="w-4 h-4" />
                        {t.quiz.incorrectBadge}
                      </span>
                    )}
                  </div>

                  <p className="text-base font-semibold text-[#1C1917]">
                    <ScientificText text={res.questionText} />
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                      const isCorrectOpt = res.correctOption === letter;
                      const isSelectedWrong = res.selectedOption === letter && !isCorrectOpt;
                      return (
                        <div
                          key={letter}
                          className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${
                            isCorrectOpt
                              ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46] font-medium'
                              : isSelectedWrong
                              ? 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
                              : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                          }`}
                        >
                          <span className="font-bold shrink-0">{letter}.</span>
                          <span className="flex-1">
                            <ScientificText text={optionMap[letter]} />
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {res.explanation && (
                    <p className="text-xs sm:text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl px-4 py-3 leading-relaxed">
                      <strong className="text-[#6B1118]">{t.quiz.explanationLabel}</strong>{' '}
                      <ScientificText text={res.explanation} />
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ---------------- ONE QUESTION AT A TIME QUIZ PLAYER ---------------- */
        <div ref={questionCardRef} className="space-y-4">
          {/* Progress Header */}
          <div className="rounded-2xl bg-white border border-[#E6DFD5] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-bold text-[#6B1118] tabular-nums">
                {formatMsg(t.quiz.questionOf, {
                  current: safeIndex + 1,
                  total: questions.length,
                })}
                {currentQ?.chapter_number
                  ? ` · ${t.home.chapterWord} ${currentQ.chapter_number}`
                  : ''}
              </span>
              <span className="text-[#57534E] font-medium tabular-nums">
                {t.quiz.scoreSoFar}:{' '}
                <strong className="text-[#1C1917]">{correctSoFar}</strong> / {answeredCount}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#EFE9DF] overflow-hidden">
              <div
                className="h-full bg-[#6B1118] transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Single Current Question Card */}
          {currentQ && (
            <div className="rounded-2xl bg-white border border-[#E6DFD5] p-5 sm:p-7 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base sm:text-xl font-semibold text-[#1C1917] leading-snug">
                  <ScientificText text={currentQ.question_text} />
                </h3>

                {isPrivileged && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuestionId(currentQ.id);
                        setQChapter(currentQ.chapter_number || 1);
                        setQText(currentQ.raw_question_text || currentQ.question_text);
                        setQA(currentQ.raw_option_a || currentQ.option_a);
                        setQB(currentQ.raw_option_b || currentQ.option_b);
                        setQC(currentQ.raw_option_c || currentQ.option_c);
                        setQD(currentQ.raw_option_d || currentQ.option_d);
                        setQCorrect((currentQ.correct_option as 'A' | 'B' | 'C' | 'D') || 'A');
                        setQExplanation(currentQ.raw_explanation ?? currentQ.explanation ?? '');
                        setShowAddQuestion(true);
                      }}
                      aria-label="Edit this question"
                      className="p-2 text-[#57534E] hover:text-[#6B1118] rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(currentQ.id)}
                      aria-label="Delete this question"
                      className="p-2 text-[#57534E] hover:text-[#DC2626] rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 4 Answer Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    { key: 'A' as const, text: currentQ.option_a },
                    { key: 'B' as const, text: currentQ.option_b },
                    { key: 'C' as const, text: currentQ.option_c },
                    { key: 'D' as const, text: currentQ.option_d },
                  ]
                ).map((opt) => {
                  const chosen = answers[currentQ.id] === opt.key;
                  const isAnswered = Boolean(currentCheck);
                  const isOfflineCheck = Boolean(currentCheck?.offlineQueued);
                  const isCorrectOpt = !isOfflineCheck && currentCheck?.correctOption === opt.key;
                  const isWrongChosen =
                    isAnswered && !isOfflineCheck && chosen && !currentCheck?.isCorrect;

                  let cardStyle =
                    'border-[#E6DFD5] bg-[#FAF8F5] text-[#1C1917] hover:border-[#6B1118]/50 hover:bg-white cursor-pointer';
                  let badgeStyle = 'bg-white border border-[#E6DFD5] text-[#57534E]';

                  if (isAnswered) {
                    if (isOfflineCheck) {
                      if (chosen) {
                        cardStyle =
                          'border-2 border-[#6B1118] bg-[#F9EFF0] text-[#6B1118] font-semibold cursor-default';
                        badgeStyle = 'bg-[#6B1118] text-white';
                      } else {
                        cardStyle =
                          'border-[#E6DFD5] bg-[#FAF8F5]/70 text-[#57534E] opacity-70 cursor-default';
                      }
                    } else if (isCorrectOpt) {
                      cardStyle =
                        'border-2 border-[#059669] bg-[#059669] text-white font-semibold shadow-sm cursor-default';
                      badgeStyle = 'bg-white text-[#059669]';
                    } else if (isWrongChosen) {
                      cardStyle =
                        'border-2 border-[#DC2626] bg-[#DC2626] text-white font-semibold shadow-sm cursor-default';
                      badgeStyle = 'bg-white text-[#DC2626]';
                    } else {
                      cardStyle =
                        'border-[#E6DFD5] bg-[#FAF8F5]/70 text-[#57534E] opacity-70 cursor-default';
                    }
                  } else if (chosen) {
                    cardStyle =
                      'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118] font-semibold cursor-pointer';
                    badgeStyle = 'bg-[#6B1118] text-white';
                  }

                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isAnswered || checkingQuestionId === currentQ.id}
                      onClick={() => handleSelectAnswer(currentQ.id, opt.key)}
                      className={`text-start rounded-xl border px-4 py-3.5 text-sm sm:text-base flex items-start gap-3 transition-colors min-h-[52px] ${cardStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${badgeStyle}`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1 leading-snug">
                        <ScientificText text={opt.text} />
                      </span>
                      {isAnswered && isCorrectOpt && (
                        <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5" />
                      )}
                      {isAnswered && isWrongChosen && (
                        <XCircle className="w-5 h-5 text-white shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {checkingQuestionId === currentQ.id && (
                <div className="rounded-xl border border-[#E6DFD5] bg-[#FAF8F5] px-4 py-3 text-sm text-[#57534E]">
                  {t.quiz.checkingAnswer}
                </div>
              )}

              {/* Immediate Explanation Directly Below Question & Answer Choices */}
              {currentCheck && currentCheck.offlineQueued ? (
                <div
                  ref={explanationRef}
                  role="status"
                  className="rounded-2xl border border-[#D9A62E]/50 bg-[#FAF8F5] p-4 sm:p-5 flex items-start gap-3"
                >
                  <WifiOff className="w-5 h-5 text-[#D9A62E] shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-medium text-[#1C1917] leading-relaxed">
                    {t.quiz.offlineQueuedAnswerNotice}
                  </p>
                </div>
              ) : currentCheck ? (
                <div
                  ref={explanationRef}
                  role="status"
                  className={`rounded-2xl border-2 p-4 sm:p-5 space-y-3 ${
                    currentCheck.isCorrect
                      ? 'border-[#059669] bg-[#ECFDF5]'
                      : 'border-[#DC2626] bg-[#FEF2F2]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {currentCheck.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={`text-sm sm:text-base font-bold ${
                            currentCheck.isCorrect ? 'text-[#065F46]' : 'text-[#991B1B]'
                          }`}
                        >
                          {currentCheck.isCorrect ? (
                            formatMsg(t.quiz.correctTitle, { opt: currentCheck.correctOption })
                          ) : (
                            <ScientificText
                              text={formatMsg(t.quiz.wrongTitle, {
                                opt: currentCheck.selectedOption,
                                text: currentCheck.selectedOptionText,
                              })}
                            />
                          )}
                        </p>
                        {currentCheck.pointsAwarded && currentCheck.pointsAwarded > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#6B1118] tabular-nums">
                            <Trophy className="w-3.5 h-3.5 text-[#D9A62E]" />
                            {formatMsg(t.quiz.pointsEarnedPill, { pts: currentCheck.pointsAwarded })}
                          </span>
                        ) : null}
                      </div>
                      {!currentCheck.isCorrect && (
                        <p className="text-xs sm:text-sm text-[#7F1D1D] leading-relaxed">
                          <strong>{t.quiz.whyWrong}</strong>{' '}
                          <ScientificText
                            text={
                              currentCheck.wrongReason ||
                              formatMsg(t.quiz.defaultWrongReason, {
                                opt: currentCheck.selectedOption,
                              })
                            }
                          />
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border border-[#059669]/40 px-4 py-3 space-y-1.5">
                    {!currentCheck.isCorrect && (
                      <p className="text-xs sm:text-sm font-bold text-[#065F46]">
                        <ScientificText
                          text={formatMsg(t.quiz.correctAnswerLabel, {
                            opt: currentCheck.correctOption,
                            text: currentCheck.correctOptionText,
                          })}
                        />
                      </p>
                    )}
                    <p className="text-xs sm:text-sm text-[#1C1917] leading-relaxed">
                      <strong className="text-[#065F46]">
                        {currentCheck.isCorrect
                          ? t.quiz.whyTrue
                          : formatMsg(t.quiz.whyOptionTrue, { opt: currentCheck.correctOption })}
                      </strong>
                      <ScientificText text={currentCheck.explanation} />
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Next Question / Finish Button — ONLY shown after answering the current question */}
              {currentCheck ? (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#E6DFD5]">
                  <p className="text-xs text-[#57534E]">
                    {safeIndex < questions.length - 1 ? t.quiz.readyNext : t.quiz.completedLast}
                  </p>

                  {safeIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-6 py-3 text-sm font-semibold text-white hover:bg-[#530D12] transition-colors cursor-pointer min-h-[48px]"
                    >
                      <span>{t.quiz.nextQuestion}</span>
                      <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submittingQuiz}
                      onClick={handleSubmitQuiz}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-6 py-3 text-sm font-semibold text-white hover:bg-[#530D12] disabled:opacity-60 transition-colors cursor-pointer min-h-[48px]"
                    >
                      <span>
                        {submittingQuiz ? t.quiz.calculatingScore : t.quiz.finishViewScore}
                      </span>
                      <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#57534E] pt-1">{t.quiz.selectPrompt}</p>
              )}
            </div>
          )}
        </div>
      )}
      {readerConfig && (
        <TextbookPdfViewerModal
          url={OFFICIAL_BOOK_PDF_URL}
          title={readerConfig.title}
          fileName={OFFICIAL_BOOK_FILENAME}
          initialPage={readerConfig.initialPage}
          isOfficialBook={true}
          onClose={() => setReaderConfig(null)}
        />
      )}
    </div>
  );
};
