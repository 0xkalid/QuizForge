import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import type { QuizSnapshot, ServerMessage, ClientMessage } from '../src/lib/types';

// ---- helpers ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function snapshot(timeLimitS = 30): QuizSnapshot {
  return {
    id: 'quiz1',
    title: 'Test Quiz',
    questions: [
      {
        id: 'q1',
        position: 0,
        type: 'multiple_choice',
        text: 'Capital of France?',
        timeLimitS,
        points: 1000,
        options: [
          { id: 'q1a', position: 0, text: 'Paris', isCorrect: true },
          { id: 'q1b', position: 1, text: 'Berlin', isCorrect: false },
        ],
      },
      {
        id: 'q2',
        position: 1,
        type: 'true_false',
        text: 'The sky is green.',
        timeLimitS,
        points: 1000,
        options: [
          { id: 'q2a', position: 0, text: 'True', isCorrect: false },
          { id: 'q2b', position: 1, text: 'False', isCorrect: true },
        ],
      },
    ],
  };
}

function stubFor(pin: string) {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(pin));
}

async function initGame(pin: string, sessionId: string, hostKey: string, timeLimitS = 30) {
  // Seed the session row so the end-of-game results FK insert succeeds.
  await env.DB.prepare(
    `INSERT INTO game_sessions (id, quiz_id, quiz_title, host_id) VALUES (?, 'quiz1', 'Test Quiz', 'host@test')`,
  )
    .bind(sessionId)
    .run();

  const res = await stubFor(pin).fetch('https://do/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, sessionId, hostKey, hostId: 'host@test', quiz: snapshot(timeLimitS) }),
  });
  expect(res.ok).toBe(true);
}

async function connect(pin: string) {
  const res = await stubFor(pin).fetch('https://do/ws', {
    headers: { Upgrade: 'websocket' },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error('no webSocket on response');
  ws.accept();
  const msgs: ServerMessage[] = [];
  ws.addEventListener('message', (e: MessageEvent) => {
    msgs.push(JSON.parse(e.data as string) as ServerMessage);
  });
  const send = (m: ClientMessage) => ws.send(JSON.stringify(m));
  async function waitFor(type: ServerMessage['type'], timeoutMs = 2000): Promise<ServerMessage> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = msgs.find((m) => m.type === type);
      if (found) return found;
      await sleep(15);
    }
    throw new Error(`timed out waiting for "${type}". Got: ${msgs.map((m) => m.type).join(',')}`);
  }
  return { ws, msgs, send, waitFor };
}

let counter = 100000;
function freshPin(): string {
  return String(++counter);
}

describe('GameRoom durable object', () => {
  beforeEach(() => {
    counter = 100000 + Math.floor(Math.random() * 800000);
  });

  it('runs a full happy-path game and writes results to D1', async () => {
    const pin = freshPin();
    const sessionId = `sess-${pin}`;
    await initGame(pin, sessionId, 'hostkey1');

    const host = await connect(pin);
    host.send({ type: 'host_join', payload: { hostKey: 'hostkey1' } });
    await host.waitFor('host_joined');

    const player = await connect(pin);
    player.send({ type: 'join', payload: { nickname: 'Sam' } });
    const joined = await player.waitFor('joined');
    expect(joined.type).toBe('joined');

    host.send({ type: 'start_game', payload: {} });
    const qstart = await player.waitFor('question_start');
    expect(qstart.type === 'question_start' && qstart.payload.qIndex).toBe(0);

    // Correct answer → all active players answered → question closes early.
    player.send({ type: 'answer', payload: { optionId: 'q1a' } });
    await player.waitFor('answer_ack');
    const end = await player.waitFor('question_end');
    if (end.type === 'question_end') {
      expect(end.payload.correctOptionId).toBe('q1a');
      expect(end.payload.yourResult?.correct).toBe(true);
      expect(end.payload.yourResult?.pointsEarned).toBeGreaterThan(0);
    }

    host.send({ type: 'next', payload: {} }); // reveal → leaderboard
    const lb = await player.waitFor('leaderboard');
    if (lb.type === 'leaderboard') expect(lb.payload.hasNext).toBe(true);

    host.send({ type: 'next', payload: {} }); // → question 2
    await player.waitFor('question_start');
    player.send({ type: 'answer', payload: { optionId: 'q2a' } }); // wrong (True)
    await player.waitFor('question_end');

    host.send({ type: 'next', payload: {} }); // reveal → leaderboard
    // wait for the *second* leaderboard
    await sleep(50);
    host.send({ type: 'next', payload: {} }); // leaderboard → game over
    const over = await player.waitFor('game_over');
    if (over.type === 'game_over') {
      expect(over.payload.yourFinal?.nickname).toBe('Sam');
      expect(over.payload.yourFinal?.rank).toBe(1);
    }

    // Results persisted to D1.
    await sleep(50);
    const row = await env.DB.prepare(
      `SELECT nickname, final_rank, correct_count, question_count FROM player_results WHERE session_id = ?`,
    )
      .bind(sessionId)
      .first<{ nickname: string; final_rank: number; correct_count: number; question_count: number }>();
    expect(row?.nickname).toBe('Sam');
    expect(row?.correct_count).toBe(1);
    expect(row?.question_count).toBe(2);
  });

  it('rejects an answer after the question has ended', async () => {
    const pin = freshPin();
    await initGame(pin, `sess-${pin}`, 'hk');

    const host = await connect(pin);
    host.send({ type: 'host_join', payload: { hostKey: 'hk' } });
    await host.waitFor('host_joined');

    const p = await connect(pin);
    p.send({ type: 'join', payload: { nickname: 'A' } });
    await p.waitFor('joined');

    host.send({ type: 'start_game', payload: {} });
    await p.waitFor('question_start');
    p.send({ type: 'answer', payload: { optionId: 'q1a' } });
    await p.waitFor('question_end'); // closed early

    // A second answer now should be rejected with an error.
    p.send({ type: 'answer', payload: { optionId: 'q1b' } });
    const err = await p.waitFor('error');
    if (err.type === 'error') expect(err.payload.code).toBe('not_question');
  });

  it('restores identity and score on reconnect with a playerToken', async () => {
    const pin = freshPin();
    await initGame(pin, `sess-${pin}`, 'hk');

    const host = await connect(pin);
    host.send({ type: 'host_join', payload: { hostKey: 'hk' } });
    await host.waitFor('host_joined');

    const p1 = await connect(pin);
    p1.send({ type: 'join', payload: { nickname: 'Reconnector' } });
    const joined = await p1.waitFor('joined');
    let token = '';
    let playerId = '';
    if (joined.type === 'joined') {
      token = joined.payload.playerToken;
      playerId = joined.payload.playerId;
    }

    host.send({ type: 'start_game', payload: {} });
    await p1.waitFor('question_start');
    p1.send({ type: 'answer', payload: { optionId: 'q1a' } });
    await p1.waitFor('question_end');
    p1.ws.close();

    // Reconnect with the stored token.
    const p2 = await connect(pin);
    p2.send({ type: 'join', payload: { nickname: 'Reconnector', playerToken: token } });
    const rejoined = await p2.waitFor('joined');
    if (rejoined.type === 'joined') {
      expect(rejoined.payload.playerId).toBe(playerId);
      expect(rejoined.payload.state.score).toBeGreaterThan(0);
    }
  });

  it('closes an abandoned question via the DO alarm', async () => {
    const pin = freshPin();
    await initGame(pin, `sess-${pin}`, 'hk', 1); // 1s question

    const host = await connect(pin);
    host.send({ type: 'host_join', payload: { hostKey: 'hk' } });
    await host.waitFor('host_joined');

    const p = await connect(pin);
    p.send({ type: 'join', payload: { nickname: 'Idle' } });
    await p.waitFor('joined');

    host.send({ type: 'start_game', payload: {} });
    await p.waitFor('question_start');

    // The player never answers. The DO alarm set at the 1s deadline fires on
    // its own and closes the question — even though no client triggered it.
    const end = await p.waitFor('question_end', 3000);
    expect(end.type).toBe('question_end');
    if (end.type === 'question_end') {
      // Nobody answered, so the correct option got zero votes.
      expect(end.payload.distribution['q1a']).toBe(0);
    }
  });
});
