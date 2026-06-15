// REST client for the host-facing API. Cloudflare Access injects the auth
// cookie/header automatically for same-origin requests, so we just use fetch.

import type {
  Quiz,
  QuizSummary,
  CreateGameResponse,
  GameHistoryEntry,
  ApiError,
} from '@shared/types';

export class ApiClientError extends Error {
  status: number;
  body: ApiError;
  constructor(status: number, body: ApiError) {
    super(body.error || `Request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    credentials: 'include',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiClientError(res.status, (data as ApiError) ?? { error: 'Request failed' });
  }
  return data as T;
}

export const api = {
  authConfig: () =>
    request<{ enabled: boolean; emailRequired: boolean; turnstileSiteKey: string | null }>(
      '/api/auth/config',
    ),
  login: (email: string, password: string, turnstileToken?: string) =>
    request<{ email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, turnstileToken }),
    }),
  logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ email: string }>('/api/auth/me'),
  listQuizzes: () => request<QuizSummary[]>('/api/quizzes'),
  getQuiz: (id: string) => request<Quiz>(`/api/quizzes/${id}`),
  createQuiz: (title: string) =>
    request<{ id: string }>('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  updateQuiz: (id: string, body: unknown) =>
    request<Quiz>(`/api/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteQuiz: (id: string) => request<{ ok: true }>(`/api/quizzes/${id}`, { method: 'DELETE' }),
  createGame: (quizId: string) =>
    request<CreateGameResponse>('/api/games', {
      method: 'POST',
      body: JSON.stringify({ quizId }),
    }),
  history: () => request<GameHistoryEntry[]>('/api/games/history'),
  gameExists: (pin: string) => request<{ exists: boolean }>(`/api/game/${pin}/exists`),
};
