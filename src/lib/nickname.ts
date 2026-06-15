// Nickname filtering (spec §9.1).
//
// A small blocklist + simple normalization (leet-speak, spacing). On match the
// caller auto-assigns "Player-N" instead of rejecting loudly. The list lives in
// a constant so an admin can extend it easily. We deliberately do NOT log the
// rejected content.

export const MAX_NICKNAME_LENGTH = 20;

/**
 * Admin-extendable blocklist. Keep entries lowercase. Matching is done against
 * a normalized form of the nickname, so common evasions (l33t, spaces) are
 * covered without listing every variant.
 */
export const NICKNAME_BLOCKLIST: string[] = [
  'admin',
  'host',
  'moderator',
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'rape',
  'nazi',
  'hitler',
  'penis',
  'vagina',
  'pussy',
  'cock',
  'dick',
  'slut',
  'whore',
];

const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '|': 'i',
};

/**
 * Normalize a nickname for blocklist matching: lowercase, de-leet, and strip
 * everything that isn't a letter (so "n i g_g a", "n1gga" etc. collapse).
 */
export function normalizeForFilter(input: string): string {
  const lowered = input.toLowerCase();
  let out = '';
  for (const ch of lowered) {
    const mapped = LEET_MAP[ch] ?? ch;
    if (mapped >= 'a' && mapped <= 'z') out += mapped;
  }
  return out;
}

/** True if the nickname matches the blocklist after normalization. */
export function isBlockedNickname(nickname: string): boolean {
  const normalized = normalizeForFilter(nickname);
  if (normalized.length === 0) return false;
  return NICKNAME_BLOCKLIST.some((bad) => normalized.includes(normalizeForFilter(bad)));
}

/**
 * Clean and validate a requested nickname.
 * Returns the trimmed nickname, or a generated "Player-N" fallback when the
 * input is empty, too long, or blocked. `n` should be unique per game (e.g. the
 * current player count) so fallbacks don't collide.
 */
export function sanitizeNickname(requested: string, n: number): string {
  const trimmed = requested.trim().slice(0, MAX_NICKNAME_LENGTH);
  if (trimmed.length === 0 || isBlockedNickname(trimmed)) {
    return `Player-${n}`;
  }
  return trimmed;
}

/**
 * Ensure a nickname is unique among `existing`; on collision append a numeric
 * suffix (`Sam` → `Sam-2`, `Sam-3`, …). Comparison is case-insensitive.
 */
export function dedupeNickname(nickname: string, existing: string[]): string {
  const lowerExisting = new Set(existing.map((e) => e.toLowerCase()));
  if (!lowerExisting.has(nickname.toLowerCase())) return nickname;
  for (let i = 2; ; i++) {
    const candidate = `${nickname}-${i}`;
    if (!lowerExisting.has(candidate.toLowerCase())) return candidate;
  }
}
