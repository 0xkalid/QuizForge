import type { D1Migration } from '@cloudflare/vitest-pool-workers/config';
import type { Env } from '../src/lib/env';

declare module 'cloudflare:test' {
  // Bindings available to tests, mirroring the Worker Env plus test-only extras.
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
