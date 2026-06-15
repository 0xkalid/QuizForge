// GameRoom Durable Object (spec §6).
//
// One instance per live game, addressed by idFromName(pin). Uses the WebSocket
// Hibernation API so the DO incurs near-zero duration charge between questions.
// All in-game state lives here (memory + ctx.storage); D1 is written once at end.

import type { DurableObjectState } from '@cloudflare/workers-types';
import type { Env } from '../lib/env';
import type {
  GameState,
  Player,
  QuizSnapshot,
  ClientMessage,
  ServerMessage,
  PublicQuestion,
  LeaderboardRow,
  PlayerStateView,
  HostStateView,
  Question,
} from '../lib/types';
import { scoreAnswer } from '../lib/scoring';
import { sanitizeNickname, dedupeNickname, MAX_NICKNAME_LENGTH } from '../lib/nickname';

const STORAGE_KEY = 'state';
const MAX_PLAYERS = 300;
const ABANDON_MS = 4 * 60 * 60 * 1000; // 4 hours

interface SocketMeta {
  role: 'host' | 'player';
  playerId?: string;
}

export class GameRoom {
  private ctx: DurableObjectState;
  private env: Env;
  private state: GameState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  // ----- persistence -----

  private async load(): Promise<GameState | null> {
    if (this.state) return this.state;
    this.state = (await this.ctx.storage.get<GameState>(STORAGE_KEY)) ?? null;
    return this.state;
  }

  private async save(): Promise<void> {
    if (this.state) await this.ctx.storage.put(STORAGE_KEY, this.state);
  }

  // ----- HTTP entry (internal control + WS upgrade) -----

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal: report whether this game is live (for PIN collision checks).
    if (url.pathname === '/status') {
      const state = await this.load();
      const active = !!state && state.phase !== 'ended';
      return Response.json({ active });
    }

    // Internal: initialize the room with a quiz snapshot.
    if (url.pathname === '/init' && request.method === 'POST') {
      return this.handleInit(request);
    }

    // WebSocket upgrade.
    if (request.headers.get('Upgrade') === 'websocket') {
      const state = await this.load();
      if (!state) {
        return new Response('No such game', { status: 404 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      // Accept with the Hibernation API (no legacy accept()).
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json()) as {
      pin: string;
      sessionId: string;
      hostKey: string;
      hostId: string;
      quiz: QuizSnapshot;
    };
    this.state = {
      phase: 'lobby',
      quiz: body.quiz,
      sessionId: body.sessionId,
      hostKey: body.hostKey,
      hostId: body.hostId,
      hostConnected: false,
      currentQuestionIndex: -1,
      questionStartedAt: 0,
      questionDeadline: 0,
      players: {},
      kicked: [],
      lateJoin: false,
      createdAt: Date.now(),
      startedAt: null,
    };
    await this.save();
    // Abandoned-game cleanup: self-destruct in 4h if never started.
    await this.ctx.storage.setAlarm(Date.now() + ABANDON_MS);
    return Response.json({ ok: true });
  }

  // ----- socket helpers -----

  private meta(ws: WebSocket): SocketMeta | null {
    const att = ws.deserializeAttachment();
    return (att as SocketMeta) ?? null;
  }

  private setMeta(ws: WebSocket, meta: SocketMeta): void {
    ws.serializeAttachment(meta);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      /* socket may be closing; ignore */
    }
  }

  private broadcast(msg: ServerMessage): void {
    const json = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(json);
      } catch {
        /* ignore */
      }
    }
  }

  /** Run a callback for each player socket, with its playerId. */
  private forEachPlayerSocket(fn: (ws: WebSocket, playerId: string) => void): void {
    for (const ws of this.ctx.getWebSockets()) {
      const m = this.meta(ws);
      if (m?.role === 'player' && m.playerId) fn(ws, m.playerId);
    }
  }

  private socketsForPlayer(playerId: string): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      const m = this.meta(ws);
      return m?.role === 'player' && m.playerId === playerId;
    });
  }

  // ----- WebSocket Hibernation handlers -----

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const state = await this.load();
    if (!state) {
      this.send(ws, { type: 'error', payload: { code: 'no_game', message: 'Game not found.' } });
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      this.send(ws, { type: 'error', payload: { code: 'bad_json', message: 'Invalid message.' } });
      return;
    }

    switch (msg.type) {
      case 'join':
        return this.onJoin(ws, msg.payload);
      case 'host_join':
        return this.onHostJoin(ws, msg.payload);
      case 'start_game':
        return this.onStartGame(ws);
      case 'next':
        return this.onNext(ws);
      case 'answer':
        return this.onAnswer(ws, msg.payload);
      case 'kick':
        return this.onKick(ws, msg.payload);
      case 'end_game':
        return this.onEndGame(ws);
      default:
        this.send(ws, {
          type: 'error',
          payload: { code: 'unknown_type', message: 'Unknown message type.' },
        });
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const m = this.meta(ws);
    if (!m) return;
    if (m.role === 'host') {
      state.hostConnected = false;
    } else if (m.role === 'player' && m.playerId) {
      const p = state.players[m.playerId];
      if (p) p.connected = false;
    }
    await this.save();
    if (state.phase === 'lobby') this.broadcastLobby();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    return this.webSocketClose(ws);
  }

  // ----- message handlers -----

  private async onJoin(ws: WebSocket, payload: { nickname: string; playerToken?: string }): Promise<void> {
    const state = this.state!;
    if (state.phase === 'ended') {
      this.send(ws, { type: 'error', payload: { code: 'ended', message: 'This game has ended.' } });
      return;
    }

    // Reconnect path: known token resumes identity.
    if (payload.playerToken) {
      const existing = Object.values(state.players).find((p) => p.token === payload.playerToken);
      if (existing) {
        if (state.kicked.includes(existing.token)) {
          this.send(ws, { type: 'kicked', payload: { reason: 'You were removed by the host.' } });
          ws.close(1000, 'kicked');
          return;
        }
        existing.connected = true;
        this.setMeta(ws, { role: 'player', playerId: existing.id });
        await this.save();
        this.send(ws, {
          type: 'joined',
          payload: {
            playerId: existing.id,
            playerToken: existing.token,
            state: this.playerStateView(existing),
          },
        });
        if (state.phase === 'lobby') this.broadcastLobby();
        return;
      }
    }

    // New player.
    if (Object.keys(state.players).length >= MAX_PLAYERS) {
      this.send(ws, { type: 'error', payload: { code: 'full', message: 'This game is full.' } });
      return;
    }

    const n = Object.keys(state.players).length + 1;
    let nickname = sanitizeNickname(payload.nickname ?? '', n);
    nickname = dedupeNickname(
      nickname,
      Object.values(state.players).map((p) => p.nickname),
    );

    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, '');
    const isSpectator = state.phase !== 'lobby';
    const player: Player = {
      id,
      token,
      nickname,
      score: 0,
      streak: 0,
      answers: [],
      connected: true,
      spectator: isSpectator,
    };
    state.players[id] = player;
    this.setMeta(ws, { role: 'player', playerId: id });
    await this.save();

    this.send(ws, {
      type: 'joined',
      payload: { playerId: id, playerToken: token, state: this.playerStateView(player) },
    });
    if (state.phase === 'lobby') this.broadcastLobby();
  }

  private async onHostJoin(ws: WebSocket, payload: { hostKey: string }): Promise<void> {
    const state = this.state!;
    if (payload.hostKey !== state.hostKey) {
      this.send(ws, { type: 'error', payload: { code: 'bad_host_key', message: 'Invalid host key.' } });
      ws.close(1008, 'bad host key');
      return;
    }
    this.setMeta(ws, { role: 'host' });
    state.hostConnected = true;
    await this.save();
    this.send(ws, { type: 'host_joined', payload: { state: this.hostStateView() } });
  }

  private requireHost(ws: WebSocket): boolean {
    const m = this.meta(ws);
    if (m?.role !== 'host') {
      this.send(ws, {
        type: 'error',
        payload: { code: 'not_host', message: 'Only the host can do that.' },
      });
      return false;
    }
    return true;
  }

  private async onStartGame(ws: WebSocket): Promise<void> {
    if (!this.requireHost(ws)) return;
    const state = this.state!;
    if (state.phase !== 'lobby') return;
    state.startedAt = Date.now();
    await this.markSessionStarted();
    await this.startQuestion(0);
  }

  private async onNext(ws: WebSocket): Promise<void> {
    if (!this.requireHost(ws)) return;
    const state = this.state!;
    if (state.phase === 'reveal') {
      this.showLeaderboard();
      await this.save();
    } else if (state.phase === 'leaderboard') {
      const next = state.currentQuestionIndex + 1;
      if (next < state.quiz.questions.length) {
        await this.startQuestion(next);
      } else {
        await this.endGame();
      }
    }
  }

  private async onAnswer(ws: WebSocket, payload: { optionId: string }): Promise<void> {
    const state = this.state!;
    const m = this.meta(ws);
    if (m?.role !== 'player' || !m.playerId) {
      this.send(ws, { type: 'error', payload: { code: 'not_player', message: 'Join first.' } });
      return;
    }
    const player = state.players[m.playerId];
    if (!player) return;

    if (state.phase !== 'question') {
      this.send(ws, {
        type: 'error',
        payload: { code: 'not_question', message: 'No active question.' },
      });
      return;
    }
    if (player.spectator) {
      this.send(ws, {
        type: 'error',
        payload: { code: 'spectator', message: 'You will join from the next question.' },
      });
      return;
    }
    const now = Date.now();
    if (now > state.questionDeadline) {
      this.send(ws, { type: 'error', payload: { code: 'too_late', message: 'Time is up.' } });
      return;
    }
    const qIndex = state.currentQuestionIndex;
    if (player.answers.some((a) => a.qIndex === qIndex)) {
      // Duplicate answer — ignore silently (already acked).
      return;
    }
    const question = state.quiz.questions[qIndex];
    const option = question.options.find((o) => o.id === payload.optionId);
    if (!option) {
      this.send(ws, { type: 'error', payload: { code: 'bad_option', message: 'Unknown option.' } });
      return;
    }

    const elapsed = now - state.questionStartedAt;
    const { pointsEarned, newStreak } = scoreAnswer(
      option.isCorrect,
      question.points,
      elapsed,
      question.timeLimitS * 1000,
      player.streak,
    );
    player.score += pointsEarned;
    player.streak = newStreak;
    player.answers.push({
      qIndex,
      optionId: option.id,
      ms: elapsed,
      correct: option.isCorrect,
      pointsEarned,
    });
    await this.save();

    this.send(ws, { type: 'answer_ack', payload: { received: true } });
    this.broadcastAnswerCount();

    // Close the question early if every active player has answered.
    if (this.allActiveAnswered()) {
      await this.ctx.storage.deleteAlarm();
      await this.endQuestion();
    }
  }

  private async onKick(ws: WebSocket, payload: { nickname: string }): Promise<void> {
    if (!this.requireHost(ws)) return;
    const state = this.state!;
    const target = Object.values(state.players).find(
      (p) => p.nickname.toLowerCase() === payload.nickname.toLowerCase(),
    );
    if (!target) return;
    state.kicked.push(target.token);
    delete state.players[target.id];
    await this.save();
    for (const sock of this.socketsForPlayer(target.id)) {
      this.send(sock, { type: 'kicked', payload: { reason: 'You were removed by the host.' } });
      sock.close(1000, 'kicked');
    }
    if (state.phase === 'lobby') this.broadcastLobby();
    else this.broadcastAnswerCount();
  }

  private async onEndGame(ws: WebSocket): Promise<void> {
    if (!this.requireHost(ws)) return;
    await this.endGame();
  }

  // ----- phase transitions -----

  private async startQuestion(index: number): Promise<void> {
    const state = this.state!;
    state.phase = 'question';
    state.currentQuestionIndex = index;
    state.questionStartedAt = Date.now();
    const q = state.quiz.questions[index];
    state.questionDeadline = state.questionStartedAt + q.timeLimitS * 1000;
    // Spectators now become active participants.
    for (const p of Object.values(state.players)) p.spectator = false;
    await this.save();

    // Server-authoritative timeout via DO alarm.
    await this.ctx.storage.setAlarm(state.questionDeadline);

    this.broadcast({ type: 'question_start', payload: this.publicQuestion(q, index) });
    this.broadcastAnswerCount();
  }

  private async endQuestion(): Promise<void> {
    const state = this.state!;
    if (state.phase !== 'question') return;
    state.phase = 'reveal';
    await this.save();

    const qIndex = state.currentQuestionIndex;
    const question = state.quiz.questions[qIndex];
    const correct = question.options.find((o) => o.isCorrect);
    const correctOptionId = correct?.id ?? '';

    const distribution: Record<string, number> = {};
    for (const o of question.options) distribution[o.id] = 0;
    for (const p of Object.values(state.players)) {
      const a = p.answers.find((x) => x.qIndex === qIndex);
      if (a && distribution[a.optionId] !== undefined) distribution[a.optionId]++;
    }

    // Per-socket result.
    this.forEachPlayerSocket((sock, playerId) => {
      const p = state.players[playerId];
      const a = p?.answers.find((x) => x.qIndex === qIndex);
      this.send(sock, {
        type: 'question_end',
        payload: {
          correctOptionId,
          distribution,
          yourResult: a
            ? { correct: a.correct, pointsEarned: a.pointsEarned, score: p!.score }
            : { correct: false, pointsEarned: 0, score: p?.score ?? 0 },
        },
      });
    });
    // Host gets the reveal too (no personal result).
    for (const sock of this.ctx.getWebSockets()) {
      if (this.meta(sock)?.role === 'host') {
        this.send(sock, { type: 'question_end', payload: { correctOptionId, distribution } });
      }
    }
  }

  private showLeaderboard(): void {
    const state = this.state!;
    state.phase = 'leaderboard';
    const ranked = this.rankedPlayers();
    const top: LeaderboardRow[] = ranked.slice(0, 5).map((r) => ({
      nickname: r.nickname,
      score: r.score,
      rank: r.rank,
    }));
    const hasNext = state.currentQuestionIndex + 1 < state.quiz.questions.length;

    // Host + broadcast top 5.
    for (const ws of this.ctx.getWebSockets()) {
      const m = this.meta(ws);
      if (m?.role === 'player' && m.playerId) {
        const me = ranked.find((r) => r.id === m.playerId);
        this.send(ws, { type: 'leaderboard', payload: { top, yourRank: me?.rank, hasNext } });
      } else {
        this.send(ws, { type: 'leaderboard', payload: { top, hasNext } });
      }
    }
  }

  private async endGame(): Promise<void> {
    const state = this.state!;
    if (state.phase === 'ended') return;
    state.phase = 'ended';
    await this.ctx.storage.deleteAlarm();

    const ranked = this.rankedPlayers();
    const podium: LeaderboardRow[] = ranked.slice(0, 3).map((r) => ({
      nickname: r.nickname,
      score: r.score,
      rank: r.rank,
    }));

    for (const ws of this.ctx.getWebSockets()) {
      const m = this.meta(ws);
      if (m?.role === 'player' && m.playerId) {
        const me = ranked.find((r) => r.id === m.playerId);
        this.send(ws, {
          type: 'game_over',
          payload: {
            podium,
            yourFinal: me
              ? { nickname: me.nickname, score: me.score, rank: me.rank }
              : undefined,
          },
        });
      } else {
        this.send(ws, { type: 'game_over', payload: { podium } });
      }
    }

    // Persist results to D1 once, then wipe the DO.
    await this.persistResults(ranked);

    await this.ctx.storage.deleteAll();
    this.state = null;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'game over');
      } catch {
        /* ignore */
      }
    }
  }

  // ----- D1 writes -----

  private async markSessionStarted(): Promise<void> {
    const state = this.state!;
    try {
      await this.env.DB.prepare(`UPDATE game_sessions SET started_at = ? WHERE id = ?`)
        .bind(state.startedAt, state.sessionId)
        .run();
    } catch {
      /* non-fatal */
    }
  }

  private async persistResults(
    ranked: Array<{ id: string; nickname: string; score: number; rank: number }>,
  ): Promise<void> {
    const state = this.state!;
    const questionCount = state.quiz.questions.length;
    try {
      const statements: D1PreparedStatement[] = [];
      statements.push(
        this.env.DB.prepare(
          `UPDATE game_sessions SET ended_at = ?, player_count = ? WHERE id = ?`,
        ).bind(Date.now(), ranked.length, state.sessionId),
      );
      for (const r of ranked) {
        const player = state.players[r.id];
        const correctCount = player ? player.answers.filter((a) => a.correct).length : 0;
        statements.push(
          this.env.DB.prepare(
            `INSERT INTO player_results
               (id, session_id, nickname, final_score, final_rank, correct_count, question_count)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            crypto.randomUUID(),
            state.sessionId,
            r.nickname,
            r.score,
            r.rank,
            correctCount,
            questionCount,
          ),
        );
      }
      await this.env.DB.batch(statements);
    } catch {
      /* best-effort; do not block teardown */
    }
  }

  // ----- alarm -----

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;

    // Question timeout: close the active question even if the host died.
    if (state.phase === 'question' && Date.now() >= state.questionDeadline) {
      await this.endQuestion();
      return;
    }

    // Abandoned game: never started after 4h → self-destruct.
    if (state.phase === 'lobby' && state.startedAt === null) {
      await this.ctx.storage.deleteAll();
      this.state = null;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(1000, 'game expired');
        } catch {
          /* ignore */
        }
      }
    }
  }

  // ----- view builders -----

  private publicQuestion(q: Question, index: number): PublicQuestion {
    const state = this.state!;
    return {
      qIndex: index,
      total: state.quiz.questions.length,
      text: q.text,
      // Critically: never leak is_correct before reveal.
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      deadline: state.questionDeadline,
      timeLimitS: q.timeLimitS,
    };
  }

  private playerStateView(player: Player): PlayerStateView {
    const state = this.state!;
    const view: PlayerStateView = {
      phase: state.phase,
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      quizTitle: state.quiz.title,
      totalQuestions: state.quiz.questions.length,
    };
    if (state.phase === 'question') {
      const q = state.quiz.questions[state.currentQuestionIndex];
      view.currentQuestion = this.publicQuestion(q, state.currentQuestionIndex);
      view.alreadyAnswered = player.answers.some((a) => a.qIndex === state.currentQuestionIndex);
    }
    return view;
  }

  private hostStateView(): HostStateView {
    const state = this.state!;
    const view: HostStateView = {
      phase: state.phase,
      pin: this.pinFromName(),
      quizTitle: state.quiz.title,
      totalQuestions: state.quiz.questions.length,
      currentQuestionIndex: state.currentQuestionIndex,
      players: Object.values(state.players).map((p) => ({ nickname: p.nickname, score: p.score })),
    };
    if (state.phase === 'question' || state.phase === 'reveal') {
      const q = state.quiz.questions[state.currentQuestionIndex];
      const correct = q.options.find((o) => o.isCorrect);
      view.currentQuestion = {
        ...this.publicQuestion(q, state.currentQuestionIndex),
        ...(state.phase === 'reveal' ? { correctOptionId: correct?.id } : {}),
      };
    }
    return view;
  }

  private pinFromName(): string {
    // The DO is named by PIN; we don't store it separately, so derive from
    // sessionId-free context is impossible — instead we stash it at init time.
    return this.state?.quiz ? (this.ctx.id.name ?? '') : '';
  }

  // ----- helpers -----

  private broadcastLobby(): void {
    const state = this.state!;
    const players = Object.values(state.players)
      .filter((p) => p.connected)
      .map((p) => ({ nickname: p.nickname }));
    this.broadcast({ type: 'lobby_update', payload: { players, count: players.length } });
  }

  private broadcastAnswerCount(): void {
    const state = this.state!;
    const qIndex = state.currentQuestionIndex;
    const active = Object.values(state.players).filter((p) => !p.spectator);
    const answered = active.filter((p) => p.answers.some((a) => a.qIndex === qIndex)).length;
    this.broadcast({ type: 'answer_count', payload: { answered, total: active.length } });
  }

  private allActiveAnswered(): boolean {
    const state = this.state!;
    const qIndex = state.currentQuestionIndex;
    const active = Object.values(state.players).filter((p) => !p.spectator && p.connected);
    if (active.length === 0) return false;
    return active.every((p) => p.answers.some((a) => a.qIndex === qIndex));
  }

  private rankedPlayers(): Array<{ id: string; nickname: string; score: number; rank: number }> {
    const state = this.state!;
    const sorted = Object.values(state.players)
      .slice()
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
    return sorted.map((p, i) => ({ id: p.id, nickname: p.nickname, score: p.score, rank: i + 1 }));
  }
}
