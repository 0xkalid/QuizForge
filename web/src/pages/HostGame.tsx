import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { GameSocket, type ConnectionStatus } from '../lib/ws';
import type {
  ServerMessage,
  PublicQuestion,
  LeaderboardRow,
  HostStateView,
} from '@shared/types';
import { answerStyle } from '../lib/shapes';
import { ShapeIcon } from '../components/ShapeIcon';
import { CountdownRing } from '../components/CountdownRing';

type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'ended';

export function HostGame() {
  const { pin = '' } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<string[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [answered, setAnswered] = useState({ answered: 0, total: 0 });
  const [reveal, setReveal] = useState<{ correctId: string; distribution: Record<string, number> } | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ top: LeaderboardRow[]; hasNext: boolean } | null>(null);
  const [podium, setPodium] = useState<LeaderboardRow[] | null>(null);
  const [qr, setQr] = useState<string>('');
  const [authError, setAuthError] = useState(false);
  const sockRef = useRef<GameSocket | null>(null);

  const joinUrl = `${location.origin}/?pin=${pin}`;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, { margin: 1, width: 240 }).then(setQr).catch(() => setQr(''));
  }, [joinUrl]);

  useEffect(() => {
    const hostKey = sessionStorage.getItem(`qf:hostkey:${pin}`);
    if (!hostKey) {
      setAuthError(true);
      return;
    }
    const sock = new GameSocket({
      pin,
      onStatus: setStatus,
      onReopen: () => sock.send({ type: 'host_join', payload: { hostKey } }),
      onMessage: (msg) => handle(msg),
    });
    sockRef.current = sock;
    sock.connect();
    return () => sock.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  function applyHostState(s: HostStateView) {
    setPhase(s.phase as Phase);
    setQuizTitle(s.quizTitle);
    setPlayers(s.players.map((p) => p.nickname));
    if (s.currentQuestion) setQuestion(s.currentQuestion);
  }

  function handle(msg: ServerMessage) {
    switch (msg.type) {
      case 'host_joined':
        applyHostState(msg.payload.state);
        break;
      case 'lobby_update':
        setPlayers(msg.payload.players.map((p) => p.nickname));
        break;
      case 'question_start':
        setReveal(null);
        setQuestion(msg.payload);
        setAnswered({ answered: 0, total: 0 });
        setPhase('question');
        break;
      case 'answer_count':
        setAnswered(msg.payload);
        break;
      case 'question_end':
        setReveal({ correctId: msg.payload.correctOptionId, distribution: msg.payload.distribution });
        setPhase('reveal');
        break;
      case 'leaderboard':
        setLeaderboard({ top: msg.payload.top, hasNext: msg.payload.hasNext });
        setPhase('leaderboard');
        break;
      case 'game_over':
        setPodium(msg.payload.podium);
        setPhase('ended');
        break;
      case 'error':
        if (msg.payload.code === 'bad_host_key') setAuthError(true);
        break;
    }
  }

  const send = (msg: Parameters<GameSocket['send']>[0]) => sockRef.current?.send(msg);

  if (authError) {
    return (
      <div className="screen center">
        <div className="card stack" style={{ textAlign: 'center' }}>
          <h2>Host session expired</h2>
          <p className="muted">Start the game again from your dashboard to get a fresh host link.</p>
          <button className="btn" onClick={() => navigate('/host')}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen host-screen">
      {(status === 'reconnecting' || status === 'connecting') && (
        <div className="reconnect-banner">Reconnecting…</div>
      )}

      <div className="row spread" style={{ marginBottom: 16 }}>
        <div className="brand">{quizTitle || 'QuizForge'}</div>
        {phase !== 'ended' && (
          <button className="btn danger" onClick={() => confirm('End this game for everyone?') && send({ type: 'end_game', payload: {} })}>
            End game
          </button>
        )}
      </div>

      {phase === 'lobby' && (
        <div className="stack">
          <div className="card pin-banner scan">
            <div className="muted">Join at {location.host} — Game PIN</div>
            <div className="pin">{pin}</div>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 30, flexWrap: 'wrap' }}>
            {qr && (
              <div className="qr">
                <img src={qr} width={200} height={200} alt="QR code to join the game" />
              </div>
            )}
            <div style={{ minWidth: 240 }}>
              <div className="row spread">
                <strong>{players.length} joined</strong>
                <button
                  className="btn big"
                  disabled={players.length === 0}
                  onClick={() => send({ type: 'start_game', payload: {} })}
                >
                  Start game
                </button>
              </div>
              <div className="player-chips">
                {players.map((name) => (
                  <span className="chip" key={name}>
                    {name}
                    <button
                      onClick={() => send({ type: 'kick', payload: { nickname: name } })}
                      aria-label={`Remove ${name}`}
                      title="Remove player"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {players.length === 0 && <span className="muted">Waiting for players…</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {(phase === 'question' || phase === 'reveal') && question && (
        <div className="stack">
          <div className={`card ${phase === 'question' ? 'scan' : ''}`}>
            <div className="row spread">
              <span className="qnum">
                Q {String(question.qIndex + 1).padStart(2, '0')} / {String(question.total).padStart(2, '0')}
              </span>
              {phase === 'question' && (
                <span className="pill">
                  {answered.answered} / {answered.total} answered
                </span>
              )}
            </div>
            <h1 className="q-text">{question.text}</h1>
            {phase === 'question' && (
              <>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <CountdownRing deadline={question.deadline} totalMs={question.timeLimitS * 1000} size={110} />
                </div>
                <div className="progress" style={{ marginTop: 18 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${answered.total ? (answered.answered / answered.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {phase === 'question' ? (
            <div className={`answer-grid ${question.options.length <= 2 ? 'two' : ''}`}>
              {question.options.map((o, i) => {
                const st = answerStyle(i);
                return (
                  <div className="answer-btn" key={o.id} style={{ background: st.color }}>
                    <span className="answer-key">{i + 1}</span>
                    <ShapeIcon shape={st.shape} />
                    <span className="grow">{o.text}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            reveal && (
              <>
                <div className="dist-bars">
                  {question.options.map((o, i) => {
                    const st = answerStyle(i);
                    const count = reveal.distribution[o.id] ?? 0;
                    const max = Math.max(1, ...Object.values(reveal.distribution));
                    const isCorrect = o.id === reveal.correctId;
                    return (
                      <div className="dist-row" key={o.id}>
                        <span style={{ background: st.color, borderRadius: 8, padding: 8, display: 'inline-flex' }}>
                          <ShapeIcon shape={st.shape} size={22} />
                        </span>
                        <div className="dist-bar-wrap">
                          <div
                            className="dist-bar"
                            style={{
                              width: `${(count / max) * 100}%`,
                              background: st.color,
                              opacity: isCorrect ? 1 : 0.5,
                            }}
                          />
                          <span className="dist-count">
                            {isCorrect ? '✓ ' : ''}
                            {o.text} · {count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn big block" onClick={() => send({ type: 'next', payload: {} })}>
                  Show leaderboard
                </button>
              </>
            )
          )}
        </div>
      )}

      {phase === 'leaderboard' && leaderboard && (
        <div className="stack">
          <h1 style={{ textAlign: 'center' }}>Leaderboard</h1>
          <div className="stack">
            {leaderboard.top.map((r) => (
              <div className="lb-row" key={r.rank}>
                <span className="lb-rank">{r.rank}</span>
                <span className="lb-name">{r.nickname}</span>
                <span className="lb-score">{r.score}</span>
              </div>
            ))}
          </div>
          <button className="btn big block" onClick={() => send({ type: 'next', payload: {} })}>
            {leaderboard.hasNext ? 'Next question' : 'Show final results'}
          </button>
        </div>
      )}

      {phase === 'ended' && podium && (
        <div className="splash">
          <h1>🏆 Final results</h1>
          <div className="podium">
            {orderPodium(podium).map((r) => (
              <div className={`podium-col podium-${r.rank}`} key={r.rank}>
                <strong>{r.nickname}</strong>
                <div className={`podium-bar`}>{r.rank}</div>
                <span className="muted">{r.score} pts</span>
              </div>
            ))}
          </div>
          <button className="btn secondary" onClick={() => navigate('/host')} style={{ marginTop: 24 }}>
            Back to dashboard
          </button>
        </div>
      )}
    </div>
  );
}

// Render podium as 2nd, 1st, 3rd for the classic staggered look.
function orderPodium(podium: LeaderboardRow[]): LeaderboardRow[] {
  const byRank = new Map(podium.map((p) => [p.rank, p]));
  const order = [2, 1, 3];
  return order.map((r) => byRank.get(r)).filter((p): p is LeaderboardRow => !!p);
}
