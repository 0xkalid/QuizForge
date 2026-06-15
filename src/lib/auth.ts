// Cloudflare Access JWT validation (spec §5, §8).
//
// We validate the `Cf-Access-Jwt-Assertion` header against the team's public
// certs endpoint and extract the email claim as the user id. Keys are fetched
// once and cached in module memory (per isolate).
//
// In local dev, set DEV_AUTH_BYPASS=true and DEV_USER_EMAIL to skip Access.

import type { AuthedUser, Env } from './env';
import { verifySession, readCookie } from './session';

interface Jwk {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

interface CertsResponse {
  keys: Jwk[];
}

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

let keyCache: CachedKeys | null = null;
const KEY_TTL_MS = 60 * 60 * 1000; // 1 hour

function b64urlToUint8(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): unknown {
  const bytes = b64urlToUint8(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

async function loadKeys(teamDomain: string): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (keyCache && now - keyCache.fetchedAt < KEY_TTL_MS) {
    return keyCache.keys;
  }
  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Access certs: ${res.status}`);
  const data = (await res.json()) as CertsResponse;
  const keys = new Map<string, CryptoKey>();
  for (const jwk of data.keys) {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keys.set(jwk.kid, key);
  }
  keyCache = { keys, fetchedAt: now };
  return keys;
}

interface AccessClaims {
  email?: string;
  aud?: string | string[];
  exp?: number;
  iss?: string;
  name?: string;
}

/**
 * Validate the Access JWT from the request and return the authenticated user,
 * or null if the token is missing/invalid.
 */
export async function authenticate(req: Request, env: Env): Promise<AuthedUser | null> {
  if (env.DEV_AUTH_BYPASS === 'true') {
    const email = env.DEV_USER_EMAIL || 'dev@local.test';
    return { id: email, displayName: email.split('@')[0] };
  }

  // Built-in host login: validate the signed session cookie (cheap, no network).
  if (env.AUTH_SECRET) {
    const sessionToken = readCookie(req.headers.get('Cookie'), 'qf_session');
    if (sessionToken) {
      const email = await verifySession(sessionToken, env.AUTH_SECRET);
      if (email) return { id: email, displayName: email.split('@')[0] };
    }
  }

  // Cloudflare Access JWT (used when the app sits behind Access on a custom domain).
  const token = req.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = decodeJson(parts[0]) as { kid?: string; alg?: string };
    if (!header.kid || header.alg !== 'RS256') return null;

    const keys = await loadKeys(env.ACCESS_TEAM_DOMAIN);
    const key = keys.get(header.kid);
    if (!key) return null;

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = b64urlToUint8(parts[2]);
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature as BufferSource,
      signingInput as BufferSource,
    );
    if (!valid) return null;

    const claims = decodeJson(parts[1]) as AccessClaims;

    // Expiry check
    if (claims.exp && Date.now() / 1000 > claims.exp) return null;

    // Audience check (if configured)
    if (env.ACCESS_AUD) {
      const auds = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
      if (!auds.includes(env.ACCESS_AUD)) return null;
    }

    if (!claims.email) return null;

    return {
      id: claims.email.toLowerCase(),
      displayName: claims.name || claims.email.split('@')[0],
    };
  } catch {
    return null;
  }
}

/** Upsert the user row on first sight; updates display_name if changed. */
export async function upsertUser(env: Env, user: AuthedUser): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
  )
    .bind(user.id, user.displayName, Date.now())
    .run();
}
