# QuizForge

An internal, Kahoot-style live quiz platform. A **host** builds quizzes and runs
live sessions on a shared screen; **players** join from their phones with a
6-digit PIN or QR code, answer timed questions, and climb a live leaderboard.

Built entirely on the **Cloudflare free tier**: a Worker (Hono) for the API, one
**Durable Object** per live game (WebSocket Hibernation API + Alarms), **D1** for
persistence, host auth (built-in login **or** Cloudflare Access), and a
React + Vite SPA served from Workers static assets.

## 🚀 One-click deploy (no laptop, no CLI)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/0xkalid/QuizForge)

Tap the button (works on a phone). Cloudflare will fork this repo into your
GitHub, **auto-create the D1 database, run the migrations, and deploy** — there
are no values to edit. When it finishes:

1. Open your new Worker → **Settings → Variables and Secrets** and add:
   - `HOST_PASSWORD` (secret) — the password you'll type to host (choose anything).
   - `AUTH_SECRET` (secret) — a long random string (any 40+ random characters).
   - `HOST_EMAIL` (variable, **recommended**) — your email. When set, this *is*
     the host identity: login is password-only and nobody can sign in as a
     different email. Leave it unset to instead pick an email at the login form.
2. Visit `https://<your-worker>.workers.dev/host/login` and sign in with your
   `HOST_PASSWORD` (plus an email if you didn't set `HOST_EMAIL`). Your dashboard
   is auto-populated with the sample cybersecurity quizzes, owned by you. Done.

Players just open the root URL and join with the PIN — no account needed.

---

## Architecture at a glance

| Layer | Tech |
|---|---|
| Frontend | React + Vite SPA (`web/`), served via Workers static assets |
| API | Cloudflare Worker, Hono router (`src/index.ts`) |
| Live game rooms | Durable Objects, one per game by `idFromName(pin)` (`src/do/GameRoom.ts`) |
| Database | D1 — quizzes, users, results history (`migrations/`) |
| Host auth | Cloudflare Access (Zero Trust) JWT validation (`src/lib/auth.ts`) |

**Key rules:** live gameplay never touches D1 (all in-game state is in the DO);
final results are written to D1 once when a game ends; the server is authoritative
for timing, scoring, and question advancement; WebSockets use the Hibernation API
so the DO bills near-zero between questions.

```
src/
├── index.ts            Worker entry: router, WS upgrade, Access JWT check
├── do/GameRoom.ts      Durable Object: the live game state machine
├── api/quizzes.ts      Quiz CRUD
├── api/games.ts        Game create / history
├── lib/
│   ├── scoring.ts      Pure scoring (time decay + streak bonus)
│   ├── pin.ts          PIN generation
│   ├── nickname.ts     Nickname filter + dedupe
│   ├── validation.ts   Server-side quiz validation
│   ├── auth.ts         Cloudflare Access JWT validation
│   └── types.ts        Shared client/server types (the WS protocol)
web/                    React SPA (host + player UIs)
migrations/             D1 schema migrations
test/                   Vitest unit tests + DO integration tests
```

---

## Local development

### Prerequisites
- Node 18+ and npm
- `npm install`

### 1. Create the local D1 database and apply migrations
```bash
npm run db:migrate:local
```

> No seed step needed — the sample cybersecurity quizzes are **auto-seeded** for
> a host the first time they open an empty dashboard (owned by whoever signs in).
> Set `SEED_SAMPLE_QUIZZES=false` to disable.

### 2. Run it
QuizForge runs as a single Worker that also serves the built SPA. Two options:

**Option A — one server (closest to production):**
```bash
npm run build:web      # build the SPA into web/dist
npm run dev            # wrangler dev serves API + SPA on http://localhost:8787
```

**Option B — fast frontend iteration (two servers):**
```bash
npm run dev            # terminal 1: wrangler dev (API/WS) on :8787
npm run dev:web        # terminal 2: vite dev server on :5173, proxies /api + /ws to :8787
```

### Local auth bypass
Cloudflare Access only runs in front of the deployed app. For local host testing,
set these in a `.dev.vars` file (git-ignored) at the repo root:
```
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=you@example.com
```
With the bypass on, every `/api/*` request is treated as that user, and the
sample quizzes are auto-seeded for it on first dashboard load.

---

## Manual test script (host + player)

1. Start the app (Option A above) and open **two** browser windows.
2. **Host window:** go to `http://localhost:8787/host`, click **+ New quiz**,
   add a couple of questions, **Save**, then **Host game**. You'll land on the
   live host screen showing a PIN and QR code.
3. **Player window** (or your phone on the same network): go to
   `http://localhost:8787/`, enter the PIN and a nickname, **Join**. Your name
   appears in the host lobby.
4. On the host screen, click **Start game**. Answer on the player screen before
   the timer runs out; watch the reveal, distribution bars, and leaderboard.
5. Click **Show leaderboard → Next question** through to the **podium**.
6. Try resilience: close and reopen the player tab mid-game — it reconnects and
   restores your score (the nickname is remembered in `sessionStorage`).

---

## Deploy to Cloudflare (manual / CLI)

> Most people should just use the **one-click deploy button** at the top. These
> steps are for deploying from your own machine with Wrangler (v4+).

`wrangler.jsonc` intentionally omits the D1 `database_id` so Cloudflare can
**auto-provision** it. With Wrangler v4, a plain deploy creates the database (and
the deploy script applies migrations):

```bash
npx wrangler login
npm run deploy        # = wrangler d1 migrations apply DB --remote && wrangler deploy
                      #   (wrangler deploy builds the SPA via the build.command)
```

That provisions the `quizforge` D1 database on first run, applies the schema, and
deploys the Worker + SPA. Sample quizzes are auto-seeded per host on first login
(no seed step). If you prefer to pin an existing database, run
`npx wrangler d1 create quizforge` and paste the id into `wrangler.jsonc`.

### 5. Protect host routes with Cloudflare Access
Players are anonymous and must stay public; only host/admin surfaces are gated.

1. In the Cloudflare dashboard, go to **Zero Trust → Access → Applications →
   Add an application → Self-hosted**.
2. Set the application domain to your Worker's hostname and add **two paths**:
   `/host*` and `/api/*`.
   > Do **not** protect `/ws/*` or `/api/game/*/exists` — those are the public
   > player join/realtime endpoints. Add them as a separate **Bypass** policy or
   > a second public application if your Access app would otherwise cover them.
3. Add a policy: **Allow** where **Emails ending in** `@yourcompany.com` (or
   select your IdP group). Connect your IdP (Google Workspace / Entra ID / Okta)
   under **Settings → Authentication**.
4. Note your **team domain** (`<team>.cloudflareaccess.com`) and the
   application's **Application Audience (AUD) tag**.
5. Set them as Worker variables so the Worker validates the Access JWT:
   ```bash
   npx wrangler secret put ACCESS_TEAM_DOMAIN   # e.g. yourteam
   npx wrangler secret put ACCESS_AUD           # the AUD tag
   ```
   (Or add them under `[vars]` for non-secret values.) The Worker reads
   `Cf-Access-Jwt-Assertion`, verifies it against
   `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, and uses the
   email claim as the host's user id.

### Alternative: built-in host login (no custom domain needed)

Cloudflare Access requires a custom domain (it can't be applied to a
`*.workers.dev` URL). If you're running on workers.dev, use the built-in
password login instead. Set two Worker secrets:

```bash
npx wrangler secret put HOST_PASSWORD   # the shared password hosts type to sign in
npx wrangler secret put AUTH_SECRET      # a long random string for signing cookies
# Optional but recommended — fixes the host identity to one email:
npx wrangler deploy --var HOST_EMAIL:you@example.com   # or set it in the dashboard
```

Generate a strong `AUTH_SECRET`, e.g. `node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"`.

Hosts then go to `/host/login` and enter the `HOST_PASSWORD`. If `HOST_EMAIL` is
set, that email is the host identity (password-only login). If it isn't, the
host also types an email, which becomes their identity. The Worker issues a
signed, HttpOnly session cookie (`qf_session`, 7-day expiry); `authenticate()`
accepts it as an alternative to the Access JWT. No `HOST_PASSWORD`/`AUTH_SECRET`
set → the login endpoint returns 503 and the host side stays closed.

> This is a single shared password gating who can host — simpler than Access
> but with no per-user identity verification. Prefer Cloudflare Access for
> stricter, IdP-backed company auth when you have a custom domain.

### Bot protection on the login (Cloudflare Turnstile — free)

To stop automated/abuse attempts on the login, add a **Turnstile** widget. It's
free and unlimited on every Cloudflare plan, including the free tier.

1. Cloudflare dashboard → **Turnstile → Add a widget**. Set the hostname to your
   `*.workers.dev` (or custom) domain. Copy the **Site Key** and **Secret Key**.
2. On your Worker → **Settings → Variables and Secrets**, add:
   - `TURNSTILE_SITE_KEY` (variable) — the public site key.
   - `TURNSTILE_SECRET_KEY` (secret) — the secret key.

That's it — the login page automatically shows the Turnstile checkbox and the
Worker verifies the token before checking the password (before any password
comparison, so bots are stopped early). Leave the keys unset to disable it.

---

## Testing

```bash
npm test          # Vitest: scoring, PIN, nickname filter, validation, + DO game loop
npm run typecheck # strict TypeScript for both server and web
```

The DO integration tests (`test/gameroom.test.ts`) drive a real `GameRoom`
through the full lifecycle — join → start → answer → reveal → leaderboard → end —
plus late-answer rejection, reconnect identity restore, and alarm-driven question
close, using `@cloudflare/vitest-pool-workers`.

---

## Scoring

For a correct answer: `round(points × (0.5 + 0.5 × (1 − elapsed / timeLimit)))`,
so a full-speed correct answer earns ~1000 and a last-millisecond one ~500.
A streak bonus adds +100 per consecutive correct answer beyond the first, capped
at +500. See `src/lib/scoring.ts`.

## Content & safety

- Nicknames pass through a small, admin-extensible blocklist (with leet/spacing
  normalization); blocked or empty names become `Player-N` rather than a loud
  rejection (`src/lib/nickname.ts`).
- The quiz editor footer reminds authors that their name is attached to the quiz;
  results history is attributable to the host.
- Hosts can remove a player from the lobby/game (kick), which blocks that
  player's token for the session.
- Text-only questions in v1 — no image uploads, which removes the hardest
  moderation surface.

## Free-tier notes

A 100-player, 20-question game is roughly 100 joins + ~2,000 answer messages
(billed ~100 requests at the 20:1 WebSocket ratio) — trivially within the 100k
requests/day free limit. Hibernation keeps DO duration low between questions, and
D1 is written once per game (≤ 301 rows). If you ever outgrow the free caps, the
$5/mo Workers Paid plan lifts them with no re-architecture.
