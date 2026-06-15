import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkersConfig(async () => {
  // Read D1 migrations so the test setup can apply them to the in-memory DB.
  const migrations = await readD1Migrations(path.join(dir, 'migrations'));

  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          // Open game WebSockets persist across test boundaries, which is
          // incompatible with isolated-storage stack popping. Each test uses a
          // fresh PIN (a distinct DO), so we don't need per-test isolation.
          isolatedStorage: false,
          wrangler: { configPath: './wrangler.test.jsonc' },
          miniflare: {
            // Expose migrations to the setup file + test auth secrets.
            bindings: {
              TEST_MIGRATIONS: migrations,
              HOST_PASSWORD: 'test-password',
              AUTH_SECRET: 'test-auth-secret',
            },
          },
        },
      },
    },
  };
});
