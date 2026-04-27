import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Path aliases mirror Overleaf's webpack setup so files vendored verbatim
// from services/web/frontend/js/ resolve their `@/…` and `@ol-types/…`
// imports. Relative imports like `../../../shared/context/project-context`
// from cloned files resolve to matching stub dirs under `src/shared/`,
// `src/infrastructure/`, etc. Those stubs mimic Overleaf's runtime
// (contexts, hooks, error-boundary) enough to mount the feature in
// isolation.
const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ol-types': r('src/ol-types'),
      '@': r('src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://127.0.0.1:8787',
      '/chars': 'http://127.0.0.1:8787',
      '/compile': 'http://127.0.0.1:8787',
      '/default_template': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
