// Signed session tokens for the built-in host login (an alternative to
// Cloudflare Access for deployments without a custom domain).
//
// Token format:  base64url(JSON payload) "." base64url(HMAC-SHA256)
// Payload:       { email, exp }  (exp = unix seconds)
// Signed with the AUTH_SECRET Worker secret. Stateless — no DB lookup needed.

interface SessionPayload {
  email: string;
  exp: number;
}

const encoder = new TextEncoder();

function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlEncodeString(s: string): string {
  return b64urlEncodeBytes(encoder.encode(s));
}

function b64urlDecodeToString(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  return atob(padded);
}

function b64urlDecodeToBytes(s: string): Uint8Array {
  const bin = b64urlDecodeToString(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(sig);
}

/** Constant-time comparison of two byte arrays. */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Constant-time comparison of two strings (for the shared password check). */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  return timingSafeEqualBytes(encoder.encode(a), encoder.encode(b));
}

/** Create a signed session token for `email`, valid for `ttlSeconds`. */
export async function signSession(
  email: string,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  const payload: SessionPayload = { email, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64urlEncodeString(JSON.stringify(payload));
  const sig = b64urlEncodeBytes(await hmac(secret, body));
  return `${body}.${sig}`;
}

/** Verify a session token; returns the email if valid and unexpired, else null. */
export async function verifySession(token: string, secret: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  try {
    const expected = await hmac(secret, body);
    const provided = b64urlDecodeToBytes(sig);
    if (!timingSafeEqualBytes(expected, provided)) return null;
    const payload = JSON.parse(b64urlDecodeToString(body)) as SessionPayload;
    if (!payload.email || typeof payload.exp !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;
    return payload.email;
  } catch {
    return null;
  }
}

/** Pull a single cookie value out of a Cookie header. */
export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}
