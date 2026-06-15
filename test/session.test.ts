import { describe, it, expect } from 'vitest';
import {
  signSession,
  verifySession,
  timingSafeEqualStrings,
  readCookie,
} from '../src/lib/session';

const SECRET = 'test-secret-key';

describe('signSession / verifySession', () => {
  it('round-trips a valid token', async () => {
    const token = await signSession('host@test.com', SECRET, 3600);
    expect(await verifySession(token, SECRET)).toBe('host@test.com');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession('host@test.com', SECRET, 3600);
    expect(await verifySession(token, 'other-secret')).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await signSession('host@test.com', SECRET, 3600);
    const [, sig] = token.split('.');
    const forged = `${btoa('{"email":"evil@test.com","exp":9999999999}')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}.${sig}`;
    expect(await verifySession(forged, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await signSession('host@test.com', SECRET, -1);
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifySession('not-a-token', SECRET)).toBeNull();
    expect(await verifySession('', SECRET)).toBeNull();
  });
});

describe('timingSafeEqualStrings', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(timingSafeEqualStrings('hunter2', 'hunter2')).toBe(true);
    expect(timingSafeEqualStrings('hunter2', 'hunter3')).toBe(false);
    expect(timingSafeEqualStrings('short', 'longer')).toBe(false);
  });
});

describe('readCookie', () => {
  it('extracts a named cookie', () => {
    expect(readCookie('a=1; qf_session=abc.def; b=2', 'qf_session')).toBe('abc.def');
  });
  it('returns null when absent', () => {
    expect(readCookie('a=1; b=2', 'qf_session')).toBeNull();
    expect(readCookie(null, 'qf_session')).toBeNull();
  });
});
