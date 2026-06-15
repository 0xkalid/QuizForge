import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import type { QuizSummary, GameHistoryEntry } from '@shared/types';

type Tab = 'quizzes' | 'history';

export function HostDashboard() {
  const [tab, setTab] = useState<Tab>('quizzes');
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [history, setHistory] = useState<GameHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  // Any 401 means the session is missing/expired → send them to sign in.
  function handleError(e: unknown, fallback: string) {
    if (e instanceof ApiClientError && e.status === 401) {
      navigate('/host/login', { replace: true });
      return;
    }
    setError(e instanceof ApiClientError ? e.body.error || fallback : fallback);
  }

  useEffect(() => {
    api
      .listQuizzes()
      .then(setQuizzes)
      .catch((e) => handleError(e, 'Could not load your quizzes.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === 'history' && history === null) {
      api.history().then(setHistory).catch((e) => handleError(e, 'Could not load history.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, history]);

  async function signOut() {
    await api.logout().catch(() => {});
    navigate('/host/login', { replace: true });
  }

  async function newQuiz() {
    setCreating(true);
    try {
      const { id } = await api.createQuiz('Untitled quiz');
      navigate(`/host/edit/${id}`);
    } catch (e) {
      handleError(e, 'Could not create quiz.');
      setCreating(false);
    }
  }

  async function hostGame(quizId: string) {
    try {
      const { pin, hostKey } = await api.createGame(quizId);
      sessionStorage.setItem(`qf:hostkey:${pin}`, hostKey);
      navigate(`/host/game/${pin}`);
    } catch (e) {
      handleError(e, 'Could not start game.');
    }
  }

  async function archive(quizId: string) {
    if (!confirm('Archive this quiz? It will be hidden from your list.')) return;
    await api.deleteQuiz(quizId);
    setQuizzes((qs) => qs?.filter((q) => q.id !== quizId) ?? null);
  }

  return (
    <div className="screen host-screen">
      <div className="row spread dash-header" style={{ marginBottom: 20 }}>
        <div className="brand">QuizForge</div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={newQuiz} disabled={creating}>
            + New quiz
          </button>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        <button
          className={`btn ${tab === 'quizzes' ? '' : 'ghost'}`}
          onClick={() => setTab('quizzes')}
        >
          My quizzes
        </button>
        <button
          className={`btn ${tab === 'history' ? '' : 'ghost'}`}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {tab === 'quizzes' && (
        <div className="stack">
          {quizzes === null && !error && <div className="spinner" />}
          {quizzes?.length === 0 && (
            <div className="empty">
              No quizzes yet. Click <strong>+ New quiz</strong> to build your first one.
            </div>
          )}
          {quizzes?.map((q) => (
            <div className="card row spread quiz-item" key={q.id}>
              <div className="quiz-item-info">
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{q.title}</div>
                <div className="muted">{q.questionCount} question{q.questionCount === 1 ? '' : 's'}</div>
              </div>
              <div className="row quiz-item-actions">
                <button className="btn ghost" onClick={() => navigate(`/host/edit/${q.id}`)}>
                  Edit
                </button>
                <button
                  className="btn"
                  onClick={() => hostGame(q.id)}
                  disabled={q.questionCount === 0}
                  title={q.questionCount === 0 ? 'Add a question first' : 'Host live game'}
                >
                  Host game
                </button>
                <button className="btn ghost" onClick={() => archive(q.id)} aria-label="Archive quiz">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="stack">
          {history === null && !error && <div className="spinner" />}
          {history?.length === 0 && <div className="empty">No games played yet.</div>}
          {history?.map((h) => (
            <div className="card" key={h.sessionId}>
              <div className="row spread">
                <div style={{ fontWeight: 700 }}>{h.quizTitle}</div>
                <div className="muted">
                  {h.endedAt ? new Date(h.endedAt).toLocaleString() : ''} · {h.playerCount} players
                </div>
              </div>
              {h.results.length > 0 && (
                <div className="stack" style={{ marginTop: 12 }}>
                  {h.results.slice(0, 5).map((r) => (
                    <div className="lb-row" key={r.finalRank + r.nickname}>
                      <span className="lb-rank">{r.finalRank}</span>
                      <span className="lb-name">{r.nickname}</span>
                      <span className="muted">
                        {r.correctCount}/{r.questionCount}
                      </span>
                      <span className="lb-score">{r.finalScore}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
