import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Edit3,
  HelpCircle,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Trophy,
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
  Question,
  QuizAnswerCheckResult,
  QuizSubmissionResponse,
  User,
} from '../types';
import { ScientificText } from './ScientificText';

interface GeneralQuestionsViewProps {
  user: User;
  onRefreshChapters: () => Promise<void>;
}

export const GeneralQuestionsView: React.FC<GeneralQuestionsViewProps> = ({
  user,
  onRefreshChapters,
}) => {
  const { language, t, dir } = useLanguage();
  const { settings } = useSettings();
  const isPrivileged = user.role === 'teacher' || Boolean(user.isAdmin);
  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D'>>({});
  const [checkedResults, setCheckedResults] = useState<Record<number, QuizAnswerCheckResult>>({});
  const [checkingQuestionId, setCheckingQuestionId] = useState<number | null>(null);
  const [submission, setSubmission] = useState<QuizSubmissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  // Teacher / Admin add/edit
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [qA, setQA] = useState('');
  const [qB, setQB] = useState('');
  const [qC, setQC] = useState('');
  const [qD, setQD] = useState('');
  const [qCorrect, setQCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [qExplanation, setQExplanation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usingOfflineCache, setUsingOfflineCache] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const explanationRef = useRef<HTMLDivElement | null>(null);

  const loadGeneral = async (langOverride = language) => {
    setLoading(true);
    setUsingOfflineCache(false);
    const cacheKey = `general_${langOverride}`;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getOfflineQuestionsCache(cacheKey);
        if (cached && cached.length > 0) {
          setQuestions(cached);
          setUsingOfflineCache(true);
          return;
        }
      }
      const data = await apiFetch<{ questions: Question[] }>(
        `/api/questions?mode=general&lang=${langOverride}`
      );
      setQuestions(data.questions);
      void saveOfflineQuestionsCache(cacheKey, data.questions);
    } catch (err) {
      const cached = await getOfflineQuestionsCache(cacheKey);
      if (cached && cached.length > 0) {
        setQuestions(cached);
        setUsingOfflineCache(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load questions.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGeneral(language);
  }, []);

  const prevLangRef = useRef(language);
  useEffect(() => {
    if (prevLangRef.current === language) return;
    prevLangRef.current = language;

    void loadGeneral(language);

    const checkedEntries = Object.entries(checkedResults);
    if (checkedEntries.length > 0) {
      Promise.all(
        checkedEntries.map(([qIdStr, res]) =>
          apiFetch<QuizAnswerCheckResult>('/api/quizzes/check-answer', {
            method: 'POST',
            body: JSON.stringify({
              questionId: Number(qIdStr),
              selectedOption: res.selectedOption,
              lang: language,
            }),
          })
        )
      )
        .then((updated) => {
          const map: Record<number, QuizAnswerCheckResult> = {};
          for (const item of updated) {
            map[item.questionId] = item;
          }
          setCheckedResults(map);
        })
        .catch(() => {});
    }

    if (submission) {
      apiFetch<QuizSubmissionResponse>('/api/quizzes/submit', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'general',
          answers,
          lang: language,
          skipSave: true,
        }),
      })
        .then((data) => setSubmission(data))
        .catch(() => {});
    }
  }, [language]);

  const handleSelectAnswer = async (questionId: number, optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (checkedResults[questionId] || checkingQuestionId === questionId) return;

    setError(null);
    setAnswers((prev) => ({ ...prev, [questionId]: optionKey }));
    setCheckingQuestionId(questionId);

    const queueAnswerOffline = async () => {
      await enqueuePointEvent(user.id, {
        eventKey: `offline-ans-${user.id}-${questionId}-${optionKey}-${Math.floor(Date.now() / 60000)}`,
        eventType: 'correct_answer',
        points: 10,
        chapterNumber: null,
        questionId,
        selectedOption: optionKey,
        details: `Offline general question #${questionId}`,
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
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await queueAnswerOffline();
        return;
      }

      const result = await apiFetch<QuizAnswerCheckResult>('/api/quizzes/check-answer', {
        method: 'POST',
        body: JSON.stringify({ questionId, selectedOption: optionKey, lang: language }),
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
        setError(err instanceof Error ? err.message : 'Unable to check answer.');
      }
    } finally {
      setCheckingQuestionId(null);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  };

  const handleSubmitQuiz = async () => {
    setSubmitting(true);
    setError(null);

    const queueQuizOffline = async () => {
      const normalizedAnswers: Record<string, string> = {};
      for (const [k, v] of Object.entries(answers)) {
        normalizedAnswers[String(k)] = v;
      }
      await enqueuePointEvent(user.id, {
        eventKey: `offline-quiz-${user.id}-general-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        eventType: 'quiz_completed',
        points: 25,
        mode: 'general',
        chapterNumber: null,
        answers: normalizedAnswers,
        details: `Offline general quiz (${questions.length} Qs)`,
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
          mode: 'general',
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
        setError(err instanceof Error ? err.message : 'Failed to submit quiz.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = {
        scope: 'general',
        questionText: qText,
        optionA: qA,
        optionB: qB,
        optionC: qC,
        optionD: qD,
        correctOption: qCorrect,
        explanation: qExplanation,
      };
      if (editingId) {
        await apiFetch(`/api/questions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/questions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEditingId(null);
      setQText('');
      setQA('');
      setQB('');
      setQC('');
      setQD('');
      setQCorrect('A');
      setQExplanation('');
      setShowForm(false);
      await loadGeneral();
      await onRefreshChapters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save question.');
    }
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/questions/${id}`, { method: 'DELETE' });
    await loadGeneral();
    await onRefreshChapters();
  };

  const safeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0;
  const currentQ = questions[safeIndex];
  const currentCheck = currentQ ? checkedResults[currentQ.id] : undefined;
  const answeredCount = Object.keys(checkedResults).length;
  const correctSoFar = Object.values(checkedResults).filter((r) => r.isCorrect).length;
  const progressPercent =
    questions.length > 0
      ? Math.round(((safeIndex + (currentCheck ? 1 : 0)) / questions.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C1917]">{t.quiz.generalTitle}</h2>
          <p className="text-sm text-[#57534E] mt-1">{t.quiz.generalSubtitle}</p>
        </div>

        {isPrivileged && (
          <div className="flex flex-wrap items-center gap-2">
            {questions.length > 0 && (
              <button
                type="button"
                onClick={() => setManageMode((v) => !v)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] ${
                  manageMode
                    ? 'border-[#6B1118] bg-[#F9EFF0] text-[#6B1118]'
                    : 'border-[#E6DFD5] bg-white text-[#1C1917] hover:border-[#6B1118]'
                }`}
              >
                <ListChecks className="w-4 h-4" />
                <span>{manageMode ? t.quiz.backToQuizMode : t.quiz.manageAllQuestions}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setShowForm((v) => !v);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
            >
              <Plus className="w-4 h-4 text-[#E5B742]" />
              <span>{showForm ? t.quiz.cancel : t.quiz.addGeneralBtn}</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#DC2626]/30 bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      )}
      {usingOfflineCache && (
        <div className="rounded-xl border border-[#D9A62E]/40 bg-[#FAF8F5] px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm text-[#57534E]">
          <WifiOff className="w-4 h-4 text-[#D9A62E] shrink-0" />
          <span>{t.quiz.cachedOfflineModeNotice}</span>
        </div>
      )}

      {isPrivileged && showForm && (
        <form
          onSubmit={handleSaveQuestion}
          className="rounded-2xl bg-white border border-[#E6DFD5] p-6 space-y-4"
        >
          <h3 className="text-lg font-bold text-[#1C1917]">
            {editingId ? t.quiz.editQuestion : t.quiz.addGeneralBtn}
          </h3>
          <textarea
            rows={2}
            required
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder={t.quiz.questionTextLabel}
            className="w-full rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={qCorrect}
              onChange={(e) => setQCorrect(e.target.value as 'A' | 'B' | 'C' | 'D')}
              className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm font-semibold text-[#6B1118]"
            >
              <option value="A">{t.quiz.correctAnswerOpt}: A</option>
              <option value="B">{t.quiz.correctAnswerOpt}: B</option>
              <option value="C">{t.quiz.correctAnswerOpt}: C</option>
              <option value="D">{t.quiz.correctAnswerOpt}: D</option>
            </select>
            <input
              type="text"
              value={qExplanation}
              onChange={(e) => setQExplanation(e.target.value)}
              placeholder={t.quiz.explanationFieldLabel}
              className="rounded-lg border border-[#E6DFD5] bg-[#FAF8F5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6B1118] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[44px]"
          >
            <Save className="w-4 h-4 text-[#E5B742]" />
            <span>{t.quiz.saveQuestion}</span>
          </button>
        </form>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD5] p-10 text-center text-sm text-[#57534E]">
          {t.quiz.loadingQuestions}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD5] p-10 text-center space-y-3">
          <HelpCircle className="w-10 h-10 text-[#D9A62E] mx-auto" />
          <h3 className="text-lg font-bold text-[#1C1917]">{t.quiz.noGeneralYet}</h3>
          <p className="text-sm text-[#57534E] max-w-md mx-auto">{t.quiz.noGeneralDesc}</p>
        </div>
      ) : isPrivileged && manageMode ? (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-2xl bg-white border border-[#E6DFD5] p-5 flex items-start justify-between gap-3"
            >
              <div>
                <p className="text-xs font-semibold text-[#6B1118] tabular-nums">
                  Q{idx + 1} · {q.correct_option || '—'}
                </p>
                <p className="text-sm font-semibold text-[#1C1917] mt-1">
                  <ScientificText text={q.question_text} />
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(q.id);
                    setQText(q.raw_question_text || q.question_text);
                    setQA(q.raw_option_a || q.option_a);
                    setQB(q.raw_option_b || q.option_b);
                    setQC(q.raw_option_c || q.option_c);
                    setQD(q.raw_option_d || q.option_d);
                    setQCorrect((q.correct_option as 'A' | 'B' | 'C' | 'D') || 'A');
                    setQExplanation(q.raw_explanation ?? q.explanation ?? '');
                    setShowForm(true);
                  }}
                  className="p-2 text-[#57534E] hover:text-[#6B1118] cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  className="p-2 text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : submission ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-[#6B1118] text-white p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              {submission.offlineQueued ? (
                <>
                  <p className="text-xs font-semibold text-[#E5B742] flex items-center gap-1.5">
                    <WifiOff className="w-4 h-4" />
                    <span>{t.quiz.offlineQuizSavedTitle}</span>
                  </p>
                  <h3 className="text-2xl font-bold tabular-nums mt-1">
                    {Object.keys(answers).length} / {submission.totalQuestions}
                  </h3>
                  <p className="mt-1 text-sm text-[#FBF4DF]/85 max-w-xl">
                    {t.quiz.offlineQuizSavedDesc}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-[#E5B742]">{t.quiz.quizComplete}</p>
                  <h3 className="text-2xl font-bold tabular-nums mt-1">
                    {submission.correctCount} / {submission.totalQuestions} ({submission.scorePercent}%)
                  </h3>
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
              className="inline-flex items-center gap-2 rounded-xl bg-white text-[#6B1118] px-4 py-2.5 text-sm font-semibold cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.quiz.tryAgain}</span>
            </button>
          </div>

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
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#57534E] tabular-nums">#{idx + 1}</span>
                  {res.isCorrect ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#059669]">
                      <CheckCircle2 className="w-4 h-4" /> {t.quiz.correctBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#DC2626]">
                      <XCircle className="w-4 h-4" /> {t.quiz.incorrectBadge}
                    </span>
                  )}
                </div>
                <p className="text-base font-semibold text-[#1C1917]">
                  <ScientificText text={res.questionText} />
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                    <div
                      key={letter}
                      className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${
                        res.correctOption === letter
                          ? 'border-[#059669] bg-[#ECFDF5] text-[#065F46] font-medium'
                          : res.selectedOption === letter
                          ? 'border-[#DC2626] bg-[#FEF2F2] text-[#991B1B]'
                          : 'border-[#E6DFD5] bg-[#FAF8F5] text-[#57534E]'
                      }`}
                    >
                      <span className="font-bold">{letter}.</span>
                      <span>
                        <ScientificText text={optionMap[letter]} />
                      </span>
                    </div>
                  ))}
                </div>
                {res.explanation && (
                  <p className="text-xs sm:text-sm text-[#1C1917] bg-[#FAF8F5] border border-[#E6DFD5] rounded-xl px-4 py-3">
                    <strong className="text-[#6B1118]">{t.quiz.explanationLabel}</strong>{' '}
                    <ScientificText text={res.explanation} />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div ref={cardRef} className="space-y-4">
          {/* Progress */}
          <div className="rounded-2xl bg-white border border-[#E6DFD5] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="font-bold text-[#6B1118] tabular-nums">
                {formatMsg(t.quiz.questionOf, {
                  current: safeIndex + 1,
                  total: questions.length,
                })}
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
                        setEditingId(currentQ.id);
                        setQText(currentQ.raw_question_text || currentQ.question_text);
                        setQA(currentQ.raw_option_a || currentQ.option_a);
                        setQB(currentQ.raw_option_b || currentQ.option_b);
                        setQC(currentQ.raw_option_c || currentQ.option_c);
                        setQD(currentQ.raw_option_d || currentQ.option_d);
                        setQCorrect((currentQ.correct_option as 'A' | 'B' | 'C' | 'D') || 'A');
                        setQExplanation(currentQ.raw_explanation ?? currentQ.explanation ?? '');
                        setShowForm(true);
                      }}
                      className="p-2 text-[#57534E] hover:text-[#6B1118] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(currentQ.id)}
                      className="p-2 text-[#57534E] hover:text-[#DC2626] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ['A', currentQ.option_a],
                    ['B', currentQ.option_b],
                    ['C', currentQ.option_c],
                    ['D', currentQ.option_d],
                  ] as const
                ).map(([key, text]) => {
                  const chosen = answers[currentQ.id] === key;
                  const isAnswered = Boolean(currentCheck);
                  const isOfflineCheck = Boolean(currentCheck?.offlineQueued);
                  const isCorrectOpt = !isOfflineCheck && currentCheck?.correctOption === key;
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
                      key={key}
                      type="button"
                      disabled={isAnswered || checkingQuestionId === currentQ.id}
                      onClick={() => handleSelectAnswer(currentQ.id, key)}
                      className={`text-start rounded-xl border px-4 py-3.5 text-sm sm:text-base flex items-start gap-3 transition-colors min-h-[52px] ${cardStyle}`}
                    >
                      <span
                        className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${badgeStyle}`}
                      >
                        {key}
                      </span>
                      <span className="flex-1 leading-snug">
                        <ScientificText text={text} />
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

              {currentCheck ? (
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#E6DFD5]">
                  <p className="text-xs text-[#57534E]">
                    {safeIndex < questions.length - 1 ? t.quiz.readyNext : t.quiz.completedLast}
                  </p>
                  {safeIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-6 py-3 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[48px]"
                    >
                      <span>{t.quiz.nextQuestion}</span>
                      <ForwardIcon className="w-4 h-4 text-[#E5B742]" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleSubmitQuiz}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B1118] px-6 py-3 text-sm font-semibold text-white hover:bg-[#530D12] cursor-pointer min-h-[48px]"
                    >
                      <span>
                        {submitting ? t.quiz.calculatingScore : t.quiz.finishViewScore}
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
    </div>
  );
};
