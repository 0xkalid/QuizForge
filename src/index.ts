// Worker entry: Hono router, WebSocket upgrade forwarding, Access JWT check.

import { Hono } from 'hono';
import type { Env, AuthedUser } from './lib/env';
import { authenticate, upsertUser } from './lib/auth';
import { isValidPin } from './lib/pin';
import { quizzes } from './api/quizzes';
import { games } from './api/games';
import { auth } from './api/auth';

export { GameRoom } from './do/GameRoom';

type Vars = { user: AuthedUser };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// ----- Public routes (no Access) -----

app.get('/api/health', (c) => c.json({ ok: true, service: 'quizforge' }));

// Lightweight PIN check so the join page can show a friendly error before
// opening a WebSocket. Public — players are anonymous.
app.get('/api/game/:pin/exists', async (c) => {
  const pin = c.req.param('pin');
  if (!isValidPin(pin)) return c.json({ exists: false });
  const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(pin));
  const res = await stub.fetch('https://do/status');
  if (!res.ok) return c.json({ exists: false });
  const data = (await res.json()) as { active: boolean };
  return c.json({ exists: data.active });
});

// WebSocket upgrade → forward to the game's Durable Object. Public (players are
// anonymous; host actions are gated inside the DO by hostKey).
app.get('/ws/game/:pin', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426);
  }
  const pin = c.req.param('pin');
  if (!isValidPin(pin)) return c.text('Invalid PIN', 400);
  const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(pin));
  return stub.fetch(c.req.raw);
});

// ----- Access-protected API -----

// Public /api paths that must NOT require Access (player-facing). Checked here
// so auth is independent of route registration order.
const PUBLIC_API = (path: string): boolean =>
  path === '/api/health' ||
  path.startsWith('/api/auth/') ||
  /^\/api\/game\/\d+\/exists$/.test(path);

app.use('/api/*', async (c, next) => {
  if (PUBLIC_API(new URL(c.req.url).pathname)) return next();
  const user = await authenticate(c.req.raw, c.env);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await upsertUser(c.env, user);
  c.set('user', user);
  await next();
});

app.route('/api/auth', auth);
app.route('/api/quizzes', quizzes);
app.route('/api/games', games);

// The Worker runs first for every request (run_worker_first). Anything not an
// API/WS route is served from the static-assets binding — which, with
// not_found_handling: single-page-application, returns index.html for client
// routes so the React Router app can take over.
app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/api') || path.startsWith('/ws')) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
