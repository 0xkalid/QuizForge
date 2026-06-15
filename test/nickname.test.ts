import { describe, it, expect } from 'vitest';
import {
  isBlockedNickname,
  sanitizeNickname,
  dedupeNickname,
  normalizeForFilter,
} from '../src/lib/nickname';

describe('normalizeForFilter', () => {
  it('lowercases, de-leets, and strips non-letters', () => {
    // 'A1 B3-C' → a,(1→i),(space dropped),b,(3→e),(- dropped),c
    expect(normalizeForFilter('A1 B3-C')).toBe('aibec');
  });

  it('collapses spacing and leet evasions', () => {
    expect(normalizeForFilter('a d m i n')).toBe('admin');
    expect(normalizeForFilter('4dm1n')).toBe('admin');
  });
});

describe('isBlockedNickname', () => {
  it('blocks exact blocklist words', () => {
    expect(isBlockedNickname('admin')).toBe(true);
    expect(isBlockedNickname('Host')).toBe(true);
  });

  it('blocks leet-speak and spaced evasions', () => {
    expect(isBlockedNickname('4dm1n')).toBe(true);
    expect(isBlockedNickname('a d m i n')).toBe(true);
  });

  it('blocks substrings of larger nicknames', () => {
    expect(isBlockedNickname('xXadminXx')).toBe(true);
  });

  it('allows clean nicknames', () => {
    expect(isBlockedNickname('Sam')).toBe(false);
    expect(isBlockedNickname('QuizWhiz42')).toBe(false);
  });
});

describe('sanitizeNickname', () => {
  it('trims and keeps a clean nickname', () => {
    expect(sanitizeNickname('  Sam  ', 1)).toBe('Sam');
  });

  it('falls back to Player-N for blocked nicknames', () => {
    expect(sanitizeNickname('admin', 5)).toBe('Player-5');
  });

  it('falls back to Player-N for empty input', () => {
    expect(sanitizeNickname('   ', 3)).toBe('Player-3');
  });

  it('truncates to the max length', () => {
    const long = 'a'.repeat(40);
    expect(sanitizeNickname(long, 1).length).toBe(20);
  });
});

describe('dedupeNickname', () => {
  it('returns the name unchanged when unique', () => {
    expect(dedupeNickname('Sam', ['Alex', 'Jo'])).toBe('Sam');
  });

  it('appends a numeric suffix on collision (case-insensitive)', () => {
    expect(dedupeNickname('Sam', ['sam'])).toBe('Sam-2');
    expect(dedupeNickname('Sam', ['Sam', 'Sam-2'])).toBe('Sam-3');
  });
});
