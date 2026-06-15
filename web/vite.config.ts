import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The SPA lives in web/ and builds to web/dist (served by the Worker's assets
// binding). Shared types come from ../src/lib via the @shared alias.
export default defineConfig({
  // Pin the root to web/ so builds work from the repo root too (npm run build:web).
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../src/lib', import.meta.url)),
    },
  },
  server: {
    fs: { allow: ['..'] },
    proxy: {
      // During `vite` dev, forward API + WS to `wrangler dev` on :8787.
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
