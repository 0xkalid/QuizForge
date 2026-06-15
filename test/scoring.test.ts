import { describe, it, expect } from 'vitest';
import { basePoints, streakBonus, scoreAnswer } from '../src/lib/scoring';

describe('basePoints', () => {
  it('awards ~full points for an instant correct answer', () => {
    expect(basePoints(1000, 0, 20000)).toBe(1000);
  });

  it('awards ~half points for a last-millisecond answer', () => {
    expect(basePoints(1000, 20000, 20000)).toBe(500);
  });

  it('awards 75% at the halfway point', () => {
    expect(basePoints(1000, 10000, 20000)).toBe(750);
  });

  it('clamps negative elapsed (clock skew) to full points', () => {
    expect(basePoints(1000, -500, 20000)).toBe(1000);
  });

  it('clamps over-deadline elapsed to half points', () => {
    expect(basePoints(1000, 99999, 20000)).toBe(500);
  });

  it('handles a zero time limit without dividing by zero', () => {
    expect(basePoints(1000, 0, 0)).toBe(1000);
  });
});

describe('streakBonus', () => {
  it('gives no bonus for the first correct answer', () => {
    expect(streakBonus(1)).toBe(0);
  });

  it('gives +100 per consecutive answer beyond the first', () => {
    expect(streakBonus(2)).toBe(100);
    expect(streakBonus(3)).toBe(200);
  });

  it('caps the bonus at +500', () => {
    expect(streakBonus(6)).toBe(500);
    expect(streakBonus(20)).toBe(500);
  });
});

describe('scoreAnswer', () => {
  it('returns zero and resets streak for incorrect answers', () => {
    expect(scoreAnswer(false, 1000, 0, 20000, 4)).toEqual({ pointsEarned: 0, newStreak: 0 });
  });

  it('adds base + streak bonus for a correct answer', () => {
    // 2nd consecutive correct, instant → 1000 + 100
    expect(scoreAnswer(true, 1000, 0, 20000, 1)).toEqual({ pointsEarned: 1100, newStreak: 2 });
  });

  it('increments streak from zero on first correct', () => {
    expect(scoreAnswer(true, 1000, 0, 20000, 0)).toEqual({ pointsEarned: 1000, newStreak: 1 });
  });

  it('combines time decay with a capped streak', () => {
    // 7th correct (cap 500 bonus), halfway → 750 base + 500
    expect(scoreAnswer(true, 1000, 10000, 20000, 6)).toEqual({ pointsEarned: 1250, newStreak: 7 });
  });
});
