export interface StudentScoreInput {
  correctAnswers?: number;
  questionsAnswered?: number;
  quizzesCompleted?: number;
  avgScorePercent?: number;
  bestScorePercent?: number;
  activityPoints?: number;
  teacherMessagesCount?: number;
  aiTutorTurns?: number;
}

export interface ComputedStudentFairMetrics {
  correctAnswers: number;
  questionsAnswered: number;
  quizzesCompleted: number;
  accuracyPercent: number;
  avgScorePercent: number;
  bestScorePercent: number;
  fairScore: number;
  activityScore: number;
}

function toFiniteNonNeg(val: unknown, maxVal = 10_000_000): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > maxVal ? maxVal : n;
}

/**
 * Computes fair, normalized metrics across different quiz lengths (e.g., 11, 15, 20, 25, 30, 37 questions).
 * Any student with >= 10 answered questions receives full 1.0 sample reliability so shorter and longer
 * tests are compared strictly by mastery (accuracy + quiz score average) rather than raw volume.
 */
export function computeStudentFairMetrics(
  input: StudentScoreInput
): ComputedStudentFairMetrics {
  const rawCorrect = Math.round(toFiniteNonNeg(input.correctAnswers, 1_000_000));
  const rawAnswered = Math.round(toFiniteNonNeg(input.questionsAnswered, 1_000_000));
  const quizzesCompleted = Math.round(toFiniteNonNeg(input.quizzesCompleted, 100_000));

  const questionsAnswered = Math.max(rawAnswered, rawCorrect);
  const correctAnswers = Math.min(rawCorrect, questionsAnswered);

  const rawAvg = toFiniteNonNeg(input.avgScorePercent, 100);
  const rawBest = toFiniteNonNeg(input.bestScorePercent, 100);

  const accuracyPercent =
    questionsAnswered > 0
      ? Math.round((correctAnswers / questionsAnswered) * 1000) / 10
      : quizzesCompleted > 0 && rawAvg > 0
      ? Math.round(rawAvg * 10) / 10
      : 0;

  const avgScorePercent =
    quizzesCompleted > 0 && rawAvg > 0
      ? Math.round(rawAvg * 10) / 10
      : accuracyPercent;

  const bestScorePercent =
    quizzesCompleted > 0 && rawBest > 0
      ? Math.round(Math.max(rawBest, avgScorePercent) * 10) / 10
      : avgScorePercent;

  let fairScore = 0;
  if (questionsAnswered > 0 || quizzesCompleted > 0) {
    const baseMastery =
      quizzesCompleted > 0 && questionsAnswered > 0
        ? accuracyPercent * 0.65 + avgScorePercent * 0.35
        : questionsAnswered > 0
        ? accuracyPercent
        : avgScorePercent;

    // Treat 10+ questions (11, 15, 20, 25, 30, 37...) equally at full 1.0 weight,
    // while preventing tiny 1-question samples (e.g. 1/1) from artificially topping multi-question peers.
    const reliability =
      questionsAnswered === 0
        ? quizzesCompleted > 0
          ? 1
          : 0
        : questionsAnswered >= 10
        ? 1
        : 0.7 + 0.3 * (questionsAnswered / 10);

    fairScore = Math.round(Math.min(100, Math.max(0, baseMastery * reliability)) * 10) / 10;
  }

  const activityPoints = toFiniteNonNeg(input.activityPoints, 1_000_000);
  const teacherMessagesCount = Math.round(toFiniteNonNeg(input.teacherMessagesCount, 100_000));
  const aiTutorTurns = Math.round(toFiniteNonNeg(input.aiTutorTurns, 100_000));

  const activityScore =
    quizzesCompleted * 10 +
    questionsAnswered * 2 +
    Math.round(activityPoints) +
    teacherMessagesCount * 3 +
    aiTutorTurns * 2;

  return {
    correctAnswers,
    questionsAnswered,
    quizzesCompleted,
    accuracyPercent,
    avgScorePercent,
    bestScorePercent,
    fairScore,
    activityScore,
  };
}

export interface RankableStudentFields {
  name: string;
  online?: boolean;
  fairScore: number;
  accuracyPercent: number;
  avgScorePercent?: number;
  totalPoints?: number;
  quizzesCompleted: number;
  correctAnswers: number;
  questionsAnswered: number;
  activityScore: number;
}

export function compareStudentsByFairRank(
  a: RankableStudentFields,
  b: RankableStudentFields
): number {
  if (b.fairScore !== a.fairScore) return b.fairScore - a.fairScore;
  if (b.accuracyPercent !== a.accuracyPercent) return b.accuracyPercent - a.accuracyPercent;
  const avgDiff = Number(b.avgScorePercent ?? b.accuracyPercent) - Number(a.avgScorePercent ?? a.accuracyPercent);
  if (avgDiff !== 0) return avgDiff;
  const ptsDiff = Number(b.totalPoints ?? 0) - Number(a.totalPoints ?? 0);
  if (ptsDiff !== 0) return ptsDiff;
  if (b.quizzesCompleted !== a.quizzesCompleted) return b.quizzesCompleted - a.quizzesCompleted;
  if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
  return a.name.localeCompare(b.name);
}

export function compareStudentsByTotalPoints(
  a: RankableStudentFields,
  b: RankableStudentFields
): number {
  const ptsDiff = Number(b.totalPoints ?? 0) - Number(a.totalPoints ?? 0);
  if (ptsDiff !== 0) return ptsDiff;
  if (b.fairScore !== a.fairScore) return b.fairScore - a.fairScore;
  if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
  return a.name.localeCompare(b.name);
}

export function compareStudentsByActivity(
  a: RankableStudentFields,
  b: RankableStudentFields
): number {
  if (b.activityScore !== a.activityScore) return b.activityScore - a.activityScore;
  if (b.questionsAnswered !== a.questionsAnswered) return b.questionsAnswered - a.questionsAnswered;
  if (b.quizzesCompleted !== a.quizzesCompleted) return b.quizzesCompleted - a.quizzesCompleted;
  if (b.fairScore !== a.fairScore) return b.fairScore - a.fairScore;
  const onlineDiff = Number(Boolean(b.online)) - Number(Boolean(a.online));
  if (onlineDiff !== 0) return onlineDiff;
  return a.name.localeCompare(b.name);
}
