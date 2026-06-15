// PIN generation — 6 digits, range 100000-999999 (no leading-zero ambiguity).

const PIN_MIN = 100000;
const PIN_MAX = 999999;

/** Generate a single random 6-digit PIN as a string. */
export function generatePin(): string {
  const span = PIN_MAX - PIN_MIN + 1;
  const n = PIN_MIN + Math.floor(randomFraction() * span);
  return String(n);
}

/** Cryptographically-strong fraction in [0, 1). */
function randomFraction(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

/** True if `pin` is a syntactically valid game PIN. */
export function isValidPin(pin: string): boolean {
  if (!/^\d{6}$/.test(pin)) return false;
  const n = Number(pin);
  return n >= PIN_MIN && n <= PIN_MAX;
}

/**
 * Generate a PIN, retrying if `isActive` reports a collision with a live game.
 * `isActive` is async because it consults the Durable Object layer.
 */
export async function generateUniquePin(
  isActive: (pin: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const pin = generatePin();
    if (!(await isActive(pin))) return pin;
  }
  throw new Error('Could not allocate a free game PIN; too many active games.');
}
