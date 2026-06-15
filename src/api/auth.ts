// Built-in host login (spec §8 alternative for deployments without Cloudflare
// Access / a custom domain). A shared HOST_PASSWORD is exchanged for a signed,
// HttpOnly session cookie that carries the host's chosen email identity.

import { Hono } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import type { Env } from '../lib/env';
import { signSession, verifySession, timingSafeEqualStrings } from '../lib/session';

export const auth = new Hono<{ Bindings: Env }>();

const COOKIE = 'qf_session';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function cookieOpts() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: TTL_SECONDS,
  };
}

// Verify a Cloudflare Turnstile token. Returns true if Turnstile isn't
// configured (not enforced) or the token is valid.
async function verifyTurnstile(
  env: { TURNSTILE_SECRET_KEY?: string },
  token: string,
  ip: string | null,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET_KEY);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// GET /api/auth/config  → what the login page needs to render.
auth.get('/config', (c) => {
  return c.json({
    enabled: !!(c.env.HOST_PASSWORD && c.env.AUTH_SECRET),
    emailRequired: !c.env.HOST_EMAIL,
    turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? null,
  });
});

// POST /api/auth/login  { email?, password }
auth.post('/login', async (c) => {
  if (!c.env.HOST_PASSWORD || !c.env.AUTH_SECRET) {
    return c.json(
      { error: 'Host login is not configured. Set HOST_PASSWORD and AUTH_SECRET.' },
      503,
    );
  }
  const body = await c.req.json().catch(() => ({}));
  const password = typeof body?.password === 'string' ? body.password : '';

  // Bot check (if Turnstile is configured) before any password comparison.
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  const human = await verifyTurnstile(c.env, turnstileToken, c.req.header('CF-Connecting-IP') ?? null);
  if (!human) {
    return c.json({ error: 'Bot check failed. Please try again.' }, 403);
  }

  // A configured HOST_EMAIL fixes the identity; otherwise the host picks one.
  const fixedEmail = c.env.HOST_EMAIL?.trim().toLowerCase();
  const email = fixedEmail ?? (typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '');

  if (!email.includes('@') || email.length > 254) {
    return c.json({ error: 'Enter a valid email to use as your host name.' }, 400);
  }
  if (!timingSafeEqualStrings(password, c.env.HOST_PASSWORD)) {
    return c.json({ error: 'Incorrect host password.' }, 401);
  }

  const token = await signSession(email, c.env.AUTH_SECRET, TTL_SECONDS);
  setCookie(c, COOKIE, token, cookieOpts());
  return c.json({ email });
});

// POST /api/auth/logout
auth.post('/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

// GET /api/auth/me  → current host identity, or 401 if not signed in.
auth.get('/me', async (c) => {
  const token = getCookie(c, COOKIE);
  const email = token && c.env.AUTH_SECRET ? await verifySession(token, c.env.AUTH_SECRET) : null;
  if (!email) return c.json({ error: 'Not signed in' }, 401);
  return c.json({ email });
});
