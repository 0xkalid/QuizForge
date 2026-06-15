import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';

// Minimal typing for the globally-injected Turnstile script.
interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      theme?: 'dark' | 'light' | 'auto';
      callback?: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT = 'cf-turnstile-script';

// Built-in host sign-in: shared host password (+ optional email and bot check).
export function HostLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailRequired, setEmailRequired] = useState(true);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // If already signed in, skip to the dashboard; otherwise load login config.
  useEffect(() => {
    api
      .me()
      .then(() => navigate('/host', { replace: true }))
      .catch(() => {});
    api
      .authConfig()
      .then((cfg) => {
        setEmailRequired(cfg.emailRequired);
        setSiteKey(cfg.turnstileSiteKey);
      })
      .catch(() => {});
  }, [navigate]);

  // Render the Turnstile widget once we know the site key.
  useEffect(() => {
    if (!siteKey) return;
    function renderWidget() {
      if (window.turnstile && widgetRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(widgetRef.current, {
          sitekey: siteKey!,
          theme: 'dark',
          callback: (t) => setTurnstileToken(t),
          'error-callback': () => setTurnstileToken(''),
          'expired-callback': () => setTurnstileToken(''),
        });
      }
    }
    if (!document.getElementById(TURNSTILE_SCRIPT)) {
      const s = document.createElement('script');
      s.id = TURNSTILE_SCRIPT;
      s.async = true;
      s.defer = true;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      renderWidget();
    }
  }, [siteKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (siteKey && !turnstileToken) {
      setError('Please complete the bot check.');
      return;
    }
    setBusy(true);
    try {
      await api.login(emailRequired ? email : '', password, turnstileToken || undefined);
      navigate('/host', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(
          err.status === 503
            ? 'Host login is not configured yet. Set HOST_PASSWORD and AUTH_SECRET on the Worker.'
            : err.body.error || 'Could not sign in.',
        );
      } else {
        setError('Could not reach the server.');
      }
      // Reset the bot check so the host can retry.
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
      setTurnstileToken('');
      setBusy(false);
    }
  }

  return (
    <div className="screen center">
      <div className="stack" style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div className="brand" style={{ fontSize: '2rem' }}>
            QuizForge
          </div>
          <div className="muted">Host sign-in</div>
        </div>
        <form className="card stack" onSubmit={submit}>
          {emailRequired && (
            <input
              type="email"
              placeholder="Your email (used as your host name)"
              aria-label="Email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Host password"
            aria-label="Host password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {siteKey && <div ref={widgetRef} style={{ minHeight: 65 }} />}
          {error && <div className="error-box">{error}</div>}
          <button className="btn big block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div style={{ textAlign: 'center' }}>
          <a href="/" className="muted">
            ← Join a game instead
          </a>
        </div>
      </div>
    </div>
  );
}
