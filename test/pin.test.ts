import { describe, it, expect } from 'vitest';
import { generatePin, isValidPin, generateUniquePin } from '../src/lib/pin';

describe('generatePin', () => {
  it('always produces a 6-digit string with no leading zero', () => {
    for (let i = 0; i < 1000; i++) {
      const pin = generatePin();
      expect(pin).toMatch(/^[1-9]\d{5}$/);
      const n = Number(pin);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    }
  });
});

describe('isValidPin', () => {
  it('accepts in-range 6-digit pins', () => {
    expect(isValidPin('100000')).toBe(true);
    expect(isValidPin('999999')).toBe(true);
  });

  it('rejects leading-zero, wrong-length, and non-numeric pins', () => {
    expect(isValidPin('099999')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('abc123')).toBe(false);
    expect(isValidPin('')).toBe(false);
  });
});

describe('generateUniquePin', () => {
  it('retries until a free pin is found', async () => {
    let calls = 0;
    const pin = await generateUniquePin(async () => {
      calls++;
      return calls < 3; // first two are "active"
    });
    expect(isValidPin(pin)).toBe(true);
    expect(calls).toBe(3);
  });

  it('throws if no free pin can be allocated', async () => {
    await expect(generateUniquePin(async () => true, 5)).rejects.toThrow();
  });
});
