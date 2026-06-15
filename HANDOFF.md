# QuizForge — Project & Deployment Summary

## What it is
A Kahoot-style **real-time quiz platform** on the Cloudflare free tier. Hosts build
quizzes and run live games on a shared screen; players join from phones with a
6-digit PIN/QR, answer timed questions, and compete on a live leaderboard.
Currently themed as a **dark neon "cyber"** UI with a cybersecurity quiz pack.

## Repo
- **GitHub:** `0xkalid/QuizForge`
- **Working branch (default):** `claude/new-session-2xbtzd`
- History was squashed to a single clean commit (old hardcoded email + D1 id
  scrubbed). Local clones must `git reset --hard origin/claude/new-session-2xbtzd`,
  not pull.

## Tech stack
- **API:** Cloudflare Worker, **Hono** router (`src/index.ts`)
- **Live games:** one **Durable Object** per game (`src/do/GameRoom.ts`), WebSocket
  **Hibernation API** + **Alarms**, server-authoritative timing/scoring
- **DB:** **D1** (`migrations/0001_init.sql`) — quizzes/users/results; live game
  state never touches D1 (written once at game end)
- **Frontend:** React + Vite SPA in `web/` (mobile-first), served via Workers static assets
- **Tooling:** TypeScript strict, Vitest + `@cloudflare/vitest-pool-workers`.
  **Wrangler v4** (needed for D1 auto-provisioning); the test pool stays on its own
  bundled v3 via `wrangler.test.jsonc`.

## Key files
```
src/index.ts              Worker entry: router, WS upgrade, auth middleware
src/do/GameRoom.ts        Durable Object game state machine
src/api/{quizzes,games,auth}.ts   REST handlers
src/lib/{scoring,pin,nickname,validation,session,auth,sampleQuizzes}.ts
web/src/pages/*           PlayJoin, PlayGame, HostDashboard, QuizEditor, HostGame, HostLogin
web/src/styles.css        The cyber theme + responsive rules
wrangler.jsonc            No database_id (auto-provisioned); build.command builds SPA
wrangler.test.jsonc       Test-only config with dummy D1 id
test/*                    55 tests (units + DO integration + worker routing/auth)
```

## Auth model
- **Players:** anonymous (nickname only).
- **Hosts:** built-in **password-only** login at `/host/login`. Identity = `HOST_EMAIL`
  env var, or a built-in default (`host@quizforge.app`). The browser never supplies
  an email. Signed HttpOnly cookie (`qf_session`, 7-day). Cloudflare Access JWT is
  also supported as an alternative (for custom domains).
- Optional **Cloudflare Turnstile** bot check (free) when `TURNSTILE_SITE_KEY` /
  `TURNSTILE_SECRET_KEY` are set.

## Env vars / secrets (Worker → Settings → Variables and Secrets)
| Name | Required | Purpose |
|---|---|---|
| `HOST_PASSWORD` | yes (to host) | shared host login password |
| `AUTH_SECRET` | yes (to host) | HMAC key for session cookies (random 40+ chars) |
| `HOST_EMAIL` | optional | fixes host identity / quiz ownership |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | optional | enable login bot check |
| `SEED_SAMPLE_QUIZZES` | optional | `false` disables auto-seed |

## Content
**14 sample cybersecurity quizzes (70 questions)** defined in
`src/lib/sampleQuizzes.ts`. They **auto-seed** on a host's first dashboard load
(when they own zero quizzes) — no seed command, no extra migration needed.

## Deployment (current state)
- **Deployed & live** at `https://quizforge.0xkalid-cloudflare.workers.dev`.
- D1 database `quizforge` exists (auto-provisioned, owned by the account); the
  Cloudflare GitHub build deploys from the branch.
- **Recommended build/deploy command** in the Cloudflare build settings:
  `npm run deploy` (= `wrangler d1 migrations apply DB --remote && wrangler deploy`;
  the SPA builds via `build.command`).
- **One-click deploy:** the README has a **"Deploy to Cloudflare" button**
  (`https://deploy.workers.cloudflare.com/?url=https://github.com/0xkalid/QuizForge`)
  that auto-provisions D1, runs migrations, and deploys — phone-friendly for
  sharing. New deployers just add `HOST_PASSWORD` / `AUTH_SECRET` (and optionally
  `HOST_EMAIL`) afterward.

## Local dev
```
npm install
npm run db:migrate:local
npm run dev            # wrangler dev (API+SPA) on :8787   (or npm run dev:web for Vite HMR)
npm test               # 55 tests
npm run typecheck
```
Local host auth bypass: set `DEV_AUTH_BYPASS=true` + `DEV_USER_EMAIL=...` in `.dev.vars`.

## Note
After switching to password-only + default identity, the previous quizzes (owned
by `0xkalid+cloudflare@gmail.com`) are hidden unless `HOST_EMAIL` is set to that
address.
