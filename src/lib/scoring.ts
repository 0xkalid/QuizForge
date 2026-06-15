// Pure scoring functions — unit-tested in test/scoring.test.ts.
//
// Rules (from spec §6):
//   if incorrect: 0
//   if correct:   round(points * (0.5 + 0.5 * (1 - elapsedMs / timeLimitMs)))
//     → full-speed correct ≈ 1000, last-millisecond correct ≈ 500
//   Streak bonus: +100 per consecutive correct answer beyond the first (cap +500).

export const STREAK_BONUS_PER = 100;
export const STREAK_BONUS_CAP = 500;

/**
 * Base points for a correct answer, scaled by how quickly it was submitted.
 * elapsedMs is clamped to [0, timeLimitMs] so out-of-range clocks can't
 * produce negative or inflated scores.
 */
export function basePoints(points: number, elapsedMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return points;
  const clamped = Math.min(Math.max(elapsedMs, 0), timeLimitMs);
  const fraction = 1 - clamped / timeLimitMs; // 1 at start, 0 at deadline
  return Math.round(points * (0.5 + 0.5 * fraction));
}

/**
 * Streak bonus awarded *in addition* to base points.
 * `streakLength` is the number of consecutive correct answers including this one.
 * First correct answer in a streak earns 0 bonus.
 */
export function streakBonus(streakLength: number): number {
  if (streakLength <= 1) return 0;
  return Math.min((streakLength - 1) * STREAK_BONUS_PER, STREAK_BONUS_CAP);
}

export interface ScoreResult {
  pointsEarned: number;
  newStreak: number;
}

/**
 * Compute the points earned for a single answer and the player's new streak.
 *
 * @param correct      whether the chosen option was correct
 * @param points       the question's max points
 * @param elapsedMs    server-measured time from question start to answer
 * @param timeLimitMs  the question's time limit in ms
 * @param prevStreak   the player's streak before this answer
 */
export function scoreAnswer(
  correct: boolean,
  points: number,
  elapsedMs: number,
  timeLimitMs: number,
  prevStreak: number,
): ScoreResult {
  if (!correct) {
    return { pointsEarned: 0, newStreak: 0 };
  }
  const newStreak = prevStreak + 1;
  const earned = basePoints(points, elapsedMs, timeLimitMs) + streakBonus(newStreak);
  return { pointsEarned: earned, newStreak };
}
