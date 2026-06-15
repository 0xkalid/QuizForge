// Worker environment bindings (see wrangler.jsonc).

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  /** Static-assets binding (the built React SPA). */
  ASSETS: Fetcher;
  /** Cloudflare Access team domain, e.g. "mycompany". Optional in dev. */
  ACCESS_TEAM_DOMAIN?: string;
  /** Access application AUD tag. Optional in dev. */
  ACCESS_AUD?: string;
  /** Shared password for the built-in host login. If unset, that login is off. */
  HOST_PASSWORD?: string;
  /**
   * Optional fixed host identity. When set, login ignores any submitted email
   * and uses this one — so nobody can sign in as an arbitrary email, and the
   * login form only needs the password. Quizzes are owned by this email.
   */
  HOST_EMAIL?: string;
  /** HMAC key for signing host session cookies. Required for built-in login. */
  AUTH_SECRET?: string;
  /** Set to "false" to disable auto-seeding sample quizzes for new hosts. */
  SEED_SAMPLE_QUIZZES?: string;
  /** Cloudflare Turnstile (free bot check) keys. When the secret is set, the
   *  host login requires a valid Turnstile token. Site key is public. */
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  /** When "true", bypass Access auth and use DEV_USER_EMAIL (local dev only). */
  DEV_AUTH_BYPASS?: string;
  DEV_USER_EMAIL?: string;
}

export interface AuthedUser {
  id: string; // email
  displayName: string;
}
