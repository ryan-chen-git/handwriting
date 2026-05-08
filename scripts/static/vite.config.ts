import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Intercept upstream Overleaf's API calls and return mocked offline responses
// so the IDE doesn't accumulate 404s in the console / spinners that never
// resolve. Only paths the running UI actually polls today are listed here;
// extend as new ones surface during smoke-testing.
const apiStubs: Plugin = {
  name: 'overleaf-api-stubs',
  configureServer(server) {
    const json = (res: any, status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    server.middlewares.use((req, res, next) => {
      const url = req.url ?? '';
      // upstream polls /system/messages every 15 min for SaaS banners
      if (url === '/system/messages') return json(res, 200, []);
      // upstream's split-test resolver — empty list = no A/B variations
      if (url.startsWith('/event/'))   return json(res, 200, {});
      if (url.startsWith('/dev-tracking/')) return json(res, 200, {});
      // editing-session heartbeat (30s ping)
      if (/^\/editingSession\//.test(url)) return json(res, 200, {});
      // project-level stubs (the one project we have is the local stub)
      if (/^\/project\/local\/messages/.test(url)) return json(res, 200, []);
      if (/^\/project\/local\/(broadcast|metadata|active|users|threads)/.test(url)) {
        return json(res, 200, {});
      }
      next();
    });
  },
};

// Path aliases mirror upstream Overleaf's webpack config. Files vendored
// verbatim from services/web/frontend/js/ resolve their `@/...` imports
// against src/js/. `@ol-types/*` is upstream's TypeScript-types alias; we
// stub it with a permissive `any` declarations directory.
const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [react(), apiStubs],
  resolve: {
    // Order matters: regex aliases run first so `overleaf-editor-core/lib/...`
    // sub-imports resolve to the stub before the bare-name fallback.
    alias: [
      // overleaf-editor-core is upstream's internal History/track-changes
      // package; stubbed because we have no backend that produces it.
      { find: /^overleaf-editor-core(\/.*)?$/, replacement: r('src/stubs/overleaf-editor-core.ts') },
      // Billing / browser-Python / hot-reload tracking — never used offline.
      { find: /^@recurly\/recurly-js(\/.*)?$/, replacement: r('src/stubs/empty.ts') },
      { find: /^pyodide(\/.*)?$/, replacement: r('src/stubs/empty.ts') },
      // @overleaf/* workspace packages we don't have on npm
      { find: '@overleaf/ranges-tracker', replacement: r('src/stubs/ranges-tracker.ts') },
      { find: '@overleaf/no-generated-editor-themes', replacement: r('src/stubs/no-generated-editor-themes.ts') },
      { find: '@ol-types', replacement: r('src/ol-types') },
      { find: '@modules', replacement: r('src/modules-stub') },
      { find: '@wf', replacement: r('src/wf-stub') },
      { find: '@', replacement: r('src/js') },
    ],
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
    chunkSizeWarningLimit: 4096,
  },
});
