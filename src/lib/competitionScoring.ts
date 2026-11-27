import type { CompetitionMedal, LeaderboardEntry } from '../types';

export interface FairScoreInput {
  totalPoints: number;
  quizPoints?: number;
  activityPoints?: number;
  quizzesCompleted: number;
  correctAnswers: number;
  questionsAnswered: number;
  legacyMissingQuestionsAnswered?: boolean;
}

export interface FairScoreResult {
  questionsAnswered: number;
  correctAnswers: number;
  accuracyPercent: number;
  fairScore: number;
}

export function computeFairScoreMetrics(input: FairScoreInput): FairScoreResult {
  const rawTotalPoints = Math.max(0, Math.round(Number(input.totalPoints || 0)));
  const rawActivityPoints = Math.max(0, Math.round(Number(input.activityPoints || 0)));
  const rawQuizzes = Math.max(0, Math.round(Number(input.quizzesCompleted || 0)));
  const rawCorrect = Math.max(0, Math.round(Number(input.correctAnswers || 0)));
  let safeAnswered = Math.max(0, Math.round(Number(input.questionsAnswered || 0)));

  if (safeAnswered === 0 && rawCorrect > 0 && input.legacyMissingQuestionsAnswered) {
    safeAnswered = rawCorrect;
  } else if (safeAnswered > 0 && rawCorrect > safeAnswered) {
    safeAnswered = rawCorrect;
  }

  const safeCorrect =
    safeAnswered > 0 ? Math.min(rawCorrect, safeAnswered) : rawCorrect;

  const accuracyPercent =
    safeAnswered > 0
      ? Math.round((safeCorrect / safeAnswered) * 1000) / 10
      : 0;

  // Fair scoring normalizes different question counts (e.g., 20 vs 30 questions):
  // - At 10+ answered questions, confidenceWeight = 1.0 so 20 vs 30 questions are
  //   evaluated on equal footing by accuracy % rather than raw question volume.
  // - Below 10 questions, confidenceWeight scales smoothly (answered / 10) so a
  //   1/1 (100%) attempt cannot outrank a fuller quiz such as 19/20 (95%).
  // - Quiz completions (+2 pts each, max +10) and curriculum activity (+0.2 per pt,
  //   max +10) provide a balanced participation bonus without distorting accuracy.
  const confidenceWeight = safeAnswered > 0 ? Math.min(1, safeAnswered / 10) : 0;
  const accuracyBase = accuracyPercent * confidenceWeight;
  const quizCompletionBonus = Math.min(10, rawQuizzes * 2);
  const activityCredit = Math.min(10, Math.round(rawActivityPoints * 0.2 * 10) / 10);

  let fairScore = Math.round((accuracyBase + quizCompletionBonus + activityCredit) * 10) / 10;

  if (fairScore === 0 && rawTotalPoints > 0) {
    fairScore = Math.min(10, Math.round(rawTotalPoints * 0.05 * 10) / 10);
  }

  return {
    questionsAnswered: safeAnswered,
    correctAnswers: safeCorrect,
    accuracyPercent,
    fairScore,
  };
}

export function compareLeaderboardEntries(
  a: Pick<
    LeaderboardEntry,
    'fairScore' | 'accuracyPercent' | 'totalPoints' | 'correctAnswers' | 'quizzesCompleted' | 'name'
  >,
  b: Pick<
    LeaderboardEntry,
    'fairScore' | 'accuracyPercent' | 'totalPoints' | 'correctAnswers' | 'quizzesCompleted' | 'name'
  >
): number {
  const aFair = Number(a.fairScore ?? 0);
  const bFair = Number(b.fairScore ?? 0);
  if (bFair !== aFair) return bFair - aFair;
  if (b.accuracyPercent !== a.accuracyPercent) return b.accuracyPercent - a.accuracyPercent;
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
  if (b.quizzesCompleted !== a.quizzesCompleted) return b.quizzesCompleted - a.quizzesCompleted;
  return a.name.localeCompare(b.name);
}

export function computeCompetitionMedal(rank: number): CompetitionMedal {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

export function formatFairScore(score: number | undefined | null): string {
  const val = Number(score || 0);
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}
