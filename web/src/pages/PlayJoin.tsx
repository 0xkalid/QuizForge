import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

// Default landing page: PIN input + nickname, huge inputs, autofocus PIN.
export function PlayJoin() {
  const [searchParams] = useSearchParams();
  const prefillPin = (searchParams.get('pin') ?? '').replace(/\D/g, '').slice(0, 6);
  const [pin, setPin] = useState(prefillPin);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  const nickRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // If the PIN arrived via QR (?pin=), jump straight to the nickname field.
    if (prefillPin.length === 6) nickRef.current?.focus();
    else pinRef.current?.focus();
  }, [prefillPin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(pin)) {
      setError('A game PIN is 6 digits.');
      return;
    }
    if (nickname.trim().length === 0) {
      setError('Pick a nickname so others can see you.');
      return;
    }
    setBusy(true);
    try {
      const { exists } = await api.gameExists(pin);
      if (!exists) {
        setError('Hmm, no game with that PIN — double-check with your host.');
        setBusy(false);
        return;
      }
      // Stash the requested nickname; PlayGame reads it to send `join`.
      sessionStorage.setItem(`qf:nick:${pin}`, nickname.trim());
      navigate(`/play/${pin}`);
    } catch {
      setError('Could not reach the server. Try again in a moment.');
      setBusy(false);
    }
  }

  return (
    <div className="screen center">
      <div className="stack" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="brand" style={{ fontSize: '2.4rem' }}>
            QuizForge
          </div>
          <div className="muted">Enter the PIN on the host's screen</div>
        </div>
        <form className="card stack" onSubmit={submit}>
          <input
            ref={pinRef}
            className="input-pin"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            placeholder="PIN"
            aria-label="Game PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <input
            ref={nickRef}
            placeholder="Your nickname"
            aria-label="Nickname"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          {error && <div className="error-box">{error}</div>}
          <button className="btn big block" type="submit" disabled={busy}>
            {busy ? 'Joining…' : 'Join game'}
          </button>
        </form>
        <div style={{ textAlign: 'center' }}>
          <a href="/host" className="muted">
            Host a game →
          </a>
        </div>
      </div>
    </div>
  );
}
