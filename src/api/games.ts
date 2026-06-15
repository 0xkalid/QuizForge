// Game create / history handlers (spec §5).

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, AuthedUser } from '../lib/env';
import type { GameHistoryEntry, QuizSnapshot } from '../lib/types';
import { generateUniquePin } from '../lib/pin';
import { loadQuiz } from './quizzes';

type Vars = { user: AuthedUser };

export const games = new Hono<{ Bindings: Env; Variables: Vars }>();

/** Ask a game's DO whether it is currently active (PIN in use). */
async function isPinActive(env: Env, pin: string): Promise<boolean> {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(pin));
  const res = await stub.fetch('https://do/status');
  if (!res.ok) return false;
  const data = (await res.json()) as { active: boolean };
  return data.active;
}

// POST /api/games — create a live game from a quiz.
games.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const quizId = body?.quizId;
  if (typeof quizId !== 'string') {
    return c.json({ error: 'quizId is required' }, 400);
  }

  const quiz = await loadQuiz(c.env, quizId);
  if (!quiz || quiz.ownerId !== user.id) {
    return c.json({ error: 'Quiz not found' }, 404);
  }
  if (quiz.questions.length === 0) {
    return c.json({ error: 'Cannot host a quiz with no questions' }, 400);
  }

  const pin = await generateUniquePin((p) => isPinActive(c.env, p));
  const sessionId = nanoid();
  const hostKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const snapshot: QuizSnapshot = {
    id: quiz.id,
    title: quiz.title,
    questions: quiz.questions,
  };

  // Initialize the DO with the quiz snapshot.
  const stub = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(pin));
  const initRes = await stub.fetch('https://do/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, sessionId, hostKey, hostId: user.id, quiz: snapshot }),
  });
  if (!initRes.ok) {
    return c.json({ error: 'Failed to create game room' }, 500);
  }

  // Insert the session row (results filled in when the game ends).
  await c.env.DB.prepare(
    `INSERT INTO game_sessions (id, quiz_id, quiz_title, host_id, started_at, ended_at, player_count)
     VALUES (?, ?, ?, ?, NULL, NULL, 0)`,
  )
    .bind(sessionId, quiz.id, quiz.title, user.id)
    .run();

  return c.json({ pin, sessionId, hostKey }, 201);
});

// GET /api/games/history — past sessions for this host, with results.
games.get('/history', async (c) => {
  const user = c.get('user');
  const sessions = await c.env.DB.prepare(
    `SELECT id, quiz_title, started_at, ended_at, player_count
       FROM game_sessions
      WHERE host_id = ? AND ended_at IS NOT NULL
      ORDER BY ended_at DESC
      LIMIT 100`,
  )
    .bind(user.id)
    .all<{
      id: string;
      quiz_title: string;
      started_at: number | null;
      ended_at: number | null;
      player_count: number;
    }>();

  if (sessions.results.length === 0) return c.json([]);

  const ids = sessions.results.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const results = await c.env.DB.prepare(
    `SELECT session_id, nickname, final_score, final_rank, correct_count, question_count
       FROM player_results
      WHERE session_id IN (${placeholders})
      ORDER BY final_rank ASC`,
  )
    .bind(...ids)
    .all<{
      session_id: string;
      nickname: string;
      final_score: number;
      final_rank: number;
      correct_count: number;
      question_count: number;
    }>();

  const bySession = new Map<string, GameHistoryEntry['results']>();
  for (const r of results.results) {
    const arr = bySession.get(r.session_id) ?? [];
    arr.push({
      nickname: r.nickname,
      finalScore: r.final_score,
      finalRank: r.final_rank,
      correctCount: r.correct_count,
      questionCount: r.question_count,
    });
    bySession.set(r.session_id, arr);
  }

  const history: GameHistoryEntry[] = sessions.results.map((s) => ({
    sessionId: s.id,
    quizTitle: s.quiz_title,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    playerCount: s.player_count,
    results: bySession.get(s.id) ?? [],
  }));

  return c.json(history);
});
