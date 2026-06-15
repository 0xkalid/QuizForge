import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

// End-to-end routing/auth checks against the Worker entry. No Access JWT and no
// DEV_AUTH_BYPASS are configured in the test env, so protected routes 401 while
// public player routes stay open.
describe('Worker routing & auth', () => {
  it('serves /api/health publicly', async () => {
    const res = await SELF.fetch('https://example.com/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'quizforge' });
  });

  it('keeps the PIN-exists check public and reports no game', async () => {
    const res = await SELF.fetch('https://example.com/api/game/123456/exists');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: false });
  });

  it('requires auth for host quiz routes', async () => {
    const res = await SELF.fetch('https://example.com/api/quizzes');
    expect(res.status).toBe(401);
  });

  it('rejects the built-in login with a wrong password', async () => {
    const res = await SELF.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@test.com', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('signs in with the shared password and authorizes host routes via the cookie', async () => {
    const login = await SELF.fetch('https://example.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'host@test.com', password: 'test-password' }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('qf_session=');

    // Reuse the session cookie to reach a protected route.
    const cookie = setCookie.split(';')[0];
    const quizzes = await SELF.fetch('https://example.com/api/quizzes', {
      headers: { Cookie: cookie },
    });
    expect(quizzes.status).toBe(200);
    const list = (await quizzes.json()) as Array<{ title: string }>;
    // A brand-new host is auto-seeded with the sample cybersecurity quizzes.
    expect(list.length).toBe(6);
    expect(list.some((q) => q.title === 'Cybersecurity Fundamentals')).toBe(true);

    // Idempotent: a second load does not duplicate them.
    const again = await SELF.fetch('https://example.com/api/quizzes', {
      headers: { Cookie: cookie },
    });
    expect(((await again.json()) as unknown[]).length).toBe(6);
  });
});
