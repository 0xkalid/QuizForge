import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameSocket, type ConnectionStatus } from '../lib/ws';
import type { ServerMessage, PublicQuestion, LeaderboardRow } from '@shared/types';
import { answerStyle } from '../lib/shapes';
import { ShapeIcon } from '../components/ShapeIcon';
import { CountdownRing } from '../components/CountdownRing';

type View =
  | { kind: 'waiting' }
  | { kind: 'question'; q: PublicQuestion; answeredId: string | null }
  | { kind: 'result'; correct: boolean; points: number; score: number; correctId: string; chosenId: string | null }
  | { kind: 'leaderboard'; top: LeaderboardRow[]; yourRank?: number }
  | { kind: 'over'; podium: LeaderboardRow[]; final?: { nickname: string; score: number; rank: number } }
  | { kind: 'kicked'; reason: string };

export function PlayGame() {
  const { pin = '' } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [view, setView] = useState<View>({ kind: 'waiting' });
  const [score, setScore] = useState(0);
  const [nickname, setNickname] = useState('');
  const sockRef = useRef<GameSocket | null>(null);
  const chosenRef = useRef<string | null>(null);

  useEffect(() => {
    const requestedNick = sessionStorage.getItem(`qf:nick:${pin}`) ?? 'Player';
    const tokenKey = `qf:token:${pin}`;

    const sock = new GameSocket({
      pin,
      onStatus: setStatus,
      onReopen: () => {
        const token = sessionStorage.getItem(tokenKey) ?? undefined;
        sock.send({ type: 'join', payload: { nickname: requestedNick, playerToken: token } });
      },
      onMessage: (msg: ServerMessage) => handle(msg, tokenKey),
    });
    sockRef.current = sock;
    sock.connect();
    return () => sock.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  function handle(msg: ServerMessage, tokenKey: string) {
    switch (msg.type) {
      case 'joined': {
        sessionStorage.setItem(tokenKey, msg.payload.playerToken);
        setNickname(msg.payload.state.nickname);
        setScore(msg.payload.state.score);
        const s = msg.payload.state;
        if (s.phase === 'question' && s.currentQuestion) {
          setView({
            kind: 'question',
            q: s.currentQuestion,
            answeredId: s.alreadyAnswered ? '' : null,
          });
        } else if (s.phase === 'lobby') {
          setView({ kind: 'waiting' });
        }
        break;
      }
      case 'question_start':
        chosenRef.current = null;
        setView({ kind: 'question', q: msg.payload, answeredId: null });
        break;
      case 'answer_ack':
        // already reflected optimistically as "locked in" via answeredId
        break;
      case 'question_end': {
        const r = msg.payload.yourResult;
        if (r) setScore(r.score);
        setView({
          kind: 'result',
          correct: r?.correct ?? false,
          points: r?.pointsEarned ?? 0,
          score: r?.score ?? score,
          correctId: msg.payload.correctOptionId,
          chosenId: chosenRef.current,
        });
        break;
      }
      case 'leaderboard':
        setView({ kind: 'leaderboard', top: msg.payload.top, yourRank: msg.payload.yourRank });
        break;
      case 'game_over':
        setView({ kind: 'over', podium: msg.payload.podium, final: msg.payload.yourFinal });
        break;
      case 'kicked':
        setView({ kind: 'kicked', reason: msg.payload.reason });
        sockRef.current?.close();
        break;
      case 'error':
        // Non-fatal errors (e.g. too_late) are surfaced inline by the question view;
        // log others for debugging.
        if (msg.payload.code === 'no_game' || msg.payload.code === 'ended') {
          setView({ kind: 'kicked', reason: 'This game is no longer available.' });
        }
        break;
    }
  }

  function answer(optionId: string) {
    if (view.kind !== 'question' || view.answeredId !== null) return;
    chosenRef.current = optionId;
    sockRef.current?.send({ type: 'answer', payload: { optionId } });
    setView({ ...view, answeredId: optionId });
  }

  return (
    <div className="screen">
      {(status === 'reconnecting' || status === 'connecting') && view.kind !== 'kicked' && (
        <div className="reconnect-banner">Reconnecting…</div>
      )}

      <div className="hud">
        <div className="hud-id">
          <span className="hud-avatar">{(nickname || 'Y').charAt(0).toUpperCase()}</span>
          <div>
            <div className="hud-name">{nickname || 'You'}</div>
            <div className="hud-sub">Operative</div>
          </div>
        </div>
        <div className="hud-stat">
          <div className="label">Score</div>
          <div className="value">{score.toLocaleString()}</div>
        </div>
      </div>

      {view.kind === 'waiting' && (
        <div className="splash">
          <div className="spinner" />
          <h1>You're in!</h1>
          <p className="muted">Hang tight — waiting for the host to start.</p>
        </div>
      )}

      {view.kind === 'question' && <QuestionView q={view.q} answeredId={view.answeredId} onAnswer={answer} />}

      {view.kind === 'result' && (
        <div className="splash">
          <h1 className={view.correct ? 'result-correct' : 'result-wrong'}>
            {view.correct ? 'Correct!' : view.chosenId ? 'Not quite' : 'Time up'}
          </h1>
          {view.correct && <div className="big-score">+{view.points}</div>}
          <p className="muted">Total: {view.score} pts</p>
        </div>
      )}

      {view.kind === 'leaderboard' && (
        <div className="splash" style={{ justifyContent: 'flex-start', paddingTop: 30 }}>
          <h1>Leaderboard</h1>
          {view.yourRank && <div className="pill">You're #{view.yourRank}</div>}
          <div className="stack" style={{ width: '100%', marginTop: 12 }}>
            {view.top.map((r) => (
              <div className="lb-row" key={r.rank}>
                <span className="lb-rank">{r.rank}</span>
                <span className="lb-name">{r.nickname}</span>
                <span className="lb-score">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view.kind === 'over' && (
        <div className="splash">
          <h1>🎉 Game over</h1>
          {view.final && (
            <>
              <div className="big-score">#{view.final.rank}</div>
              <p className="muted">
                {view.final.nickname} — {view.final.score} pts
              </p>
            </>
          )}
          <button className="btn secondary" onClick={() => navigate('/')}>
            Back to start
          </button>
        </div>
      )}

      {view.kind === 'kicked' && (
        <div className="splash">
          <h1>👋</h1>
          <p>{view.reason}</p>
          <button className="btn secondary" onClick={() => navigate('/')}>
            Back to start
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionView({
  q,
  answeredId,
  onAnswer,
}: {
  q: PublicQuestion;
  answeredId: string | null;
  onAnswer: (id: string) => void;
}) {
  const locked = answeredId !== null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <span className="qnum">
          Q {pad(q.qIndex + 1)} / {pad(q.total)}
        </span>
        <CountdownRing deadline={q.deadline} totalMs={q.timeLimitS * 1000} size={64} />
      </div>
      <div className="card scan" style={{ marginBottom: 14 }}>
        <h2 className="q-text">{q.text}</h2>
      </div>
      {locked ? (
        <div className="splash">
          <div className="spinner" />
          <h1 className="result-correct">Locked in</h1>
          <p className="muted">Awaiting other operatives…</p>
        </div>
      ) : (
        <div className={`answer-grid ${q.options.length <= 2 ? 'two' : ''}`}>
          {q.options.map((o, i) => {
            const st = answerStyle(i);
            return (
              <button
                key={o.id}
                className="answer-btn"
                style={{ background: st.color }}
                onClick={() => onAnswer(o.id)}
                aria-label={`${st.label}: ${o.text}`}
              >
                <span className="answer-key">{i + 1}</span>
                <ShapeIcon shape={st.shape} />
                <span className="grow">
                  {o.text}
                  <div className="shape-label">{st.label}</div>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
