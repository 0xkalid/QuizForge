// Shared TypeScript types used by both the Worker/DO (server) and the React SPA (client).
// No `any` in the WS protocol — these are the single source of truth.

// ----- Domain model -----

export type QuestionType = 'multiple_choice' | 'true_false';

export interface AnswerOption {
  id: string;
  position: number; // 0-3
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  timeLimitS: number;
  points: number;
  options: AnswerOption[];
}

export interface Quiz {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
  questions: Question[];
}

/** The full quiz JSON snapshot injected into a GameRoom DO at creation. */
export interface QuizSnapshot {
  id: string;
  title: string;
  questions: Question[];
}

// ----- REST payloads -----

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiError {
  error: string;
  fields?: FieldError[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateGameResponse {
  pin: string;
  sessionId: string;
  hostKey: string;
}

export interface GameHistoryEntry {
  sessionId: string;
  quizTitle: string;
  startedAt: number | null;
  endedAt: number | null;
  playerCount: number;
  results: Array<{
    nickname: string;
    finalScore: number;
    finalRank: number;
    correctCount: number;
    questionCount: number;
  }>;
}

// ----- Game state (inside the Durable Object) -----

export type GamePhase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export interface PlayerAnswer {
  qIndex: number;
  optionId: string;
  ms: number;
  correct: boolean;
  pointsEarned: number;
}

export interface Player {
  id: string;
  token: string;
  nickname: string;
  score: number;
  streak: number;
  answers: PlayerAnswer[];
  connected: boolean;
  /** A spectator joined mid-game; scores 0 for already-played questions. */
  spectator: boolean;
}

export interface GameState {
  phase: GamePhase;
  quiz: QuizSnapshot;
  sessionId: string;
  hostKey: string;
  hostId: string;
  hostConnected: boolean;
  currentQuestionIndex: number; // -1 in lobby
  questionStartedAt: number;
  questionDeadline: number;
  players: Record<string, Player>;
  /** playerTokens that have been kicked for the session. */
  kicked: string[];
  lateJoin: boolean;
  createdAt: number;
  startedAt: number | null;
}

// ----- WebSocket protocol -----

// Client -> server
export type ClientMessage =
  | { type: 'join'; payload: { nickname: string; playerToken?: string } }
  | { type: 'host_join'; payload: { hostKey: string } }
  | { type: 'start_game'; payload: Record<string, never> }
  | { type: 'next'; payload: Record<string, never> }
  | { type: 'answer'; payload: { optionId: string } }
  | { type: 'kick'; payload: { nickname: string } }
  | { type: 'end_game'; payload: Record<string, never> };

// Public (safe) view of a question — never includes isCorrect.
export interface PublicQuestion {
  qIndex: number;
  total: number;
  text: string;
  options: Array<{ id: string; text: string }>;
  deadline: number;
  timeLimitS: number;
}

export interface LeaderboardRow {
  nickname: string;
  score: number;
  rank: number;
}

export interface PlayerStateView {
  phase: GamePhase;
  playerId: string;
  nickname: string;
  score: number;
  quizTitle: string;
  totalQuestions: number;
  currentQuestion?: PublicQuestion;
  alreadyAnswered?: boolean;
}

// Server -> client
export type ServerMessage =
  | {
      type: 'joined';
      payload: { playerId: string; playerToken: string; state: PlayerStateView };
    }
  | { type: 'host_joined'; payload: { state: HostStateView } }
  | { type: 'lobby_update'; payload: { players: Array<{ nickname: string }>; count: number } }
  | { type: 'question_start'; payload: PublicQuestion }
  | { type: 'answer_ack'; payload: { received: true } }
  | { type: 'answer_count'; payload: { answered: number; total: number } }
  | {
      type: 'question_end';
      payload: {
        correctOptionId: string;
        distribution: Record<string, number>;
        yourResult?: { correct: boolean; pointsEarned: number; score: number };
      };
    }
  | {
      type: 'leaderboard';
      payload: { top: LeaderboardRow[]; yourRank?: number; hasNext: boolean };
    }
  | {
      type: 'game_over';
      payload: {
        podium: LeaderboardRow[];
        yourFinal?: { nickname: string; score: number; rank: number };
      };
    }
  | { type: 'kicked'; payload: { reason: string } }
  | { type: 'error'; payload: { code: string; message: string } };

export interface HostStateView {
  phase: GamePhase;
  pin: string;
  quizTitle: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  players: Array<{ nickname: string; score: number }>;
  currentQuestion?: PublicQuestion & { correctOptionId?: string };
}
