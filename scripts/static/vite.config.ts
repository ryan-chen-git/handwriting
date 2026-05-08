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
      // upstream's client-side error reporter posts here; we have no sink
      if (url === '/error/client') return json(res, 200, {});

      // Settings persistence: client posts each change to /user/settings
      // (user-wide: theme, font, etc.) and /project/local/settings (per-
      // project: compiler, root doc, spellcheck language). Our store is
      // the in-memory context, so just ack both.
      if (url === '/user/settings') return json(res, 200, {});
      if (url === '/project/local/settings') return json(res, 200, {});

      // Spelling personal dictionary lives only in browser localStorage in
      // our build; ack the server learn/unlearn endpoints.
      if (url === '/spelling/learn' || url === '/spelling/unlearn') {
        return json(res, 200, {});
      }

      // File-tree write endpoints. We generate a local id and let the
      // client fire the matching `recive*` socket event itself (see the
      // notifySocket calls in sync-mutation.ts).
      const createMatch = url.match(/^\/project\/local\/(doc|folder|linked_file)$/);
      if (createMatch && req.method === 'POST') {
        const kind = createMatch[1];
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          let body: { name?: string } = {};
          try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}
          const id = `local_${Math.random().toString(36).slice(2, 10)}`;
          if (kind === 'folder') {
            return json(res, 200, { _id: id, name: body.name, folders: [], fileRefs: [], docs: [] });
          }
          if (kind === 'linked_file') {
            return json(res, 200, { new_file_id: id });
          }
          return json(res, 200, { _id: id, name: body.name });
        });
        return;
      }

      // Delete an entity. The client fires a synthetic `removeEntity` socket
      // event after this resolves so the file tree updates locally.
      if (
        /^\/project\/local\/(doc|folder|file)\/[^/]+$/.test(url) &&
        req.method === 'DELETE'
      ) {
        return json(res, 200, {});
      }
      // Rename + move endpoints — same shape, just ack and let the client
      // simulate the recive* event.
      if (
        /^\/project\/local\/(doc|folder|file)\/[^/]+\/(rename|move)$/.test(url) &&
        req.method === 'POST'
      ) {
        return json(res, 200, {});
      }
      // Stop a running compile + clear cache. Both endpoints are wired
      // unconditionally from local-compile-context; the local Python server
      // doesn't implement either, so ack here so a stop/clear during compile
      // doesn't 404.
      if (/^\/project\/local\/compile\/stop$/.test(url) && req.method === 'POST') {
        return json(res, 200, {});
      }
      if (/^\/project\/local\/output(\?|$)/.test(url) && req.method === 'DELETE') {
        return json(res, 200, {});
      }

      // Multipart upload from Uppy. Read just enough to grab the filename
      // and decide doc vs file based on the extension.
      if (/^\/project\/local\/upload(\?|$)/.test(url) && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const buf = Buffer.concat(chunks);
          const head = buf.toString('binary', 0, Math.min(buf.length, 4096));
          const m = head.match(/filename="([^"]+)"/);
          const name = m ? m[1] : 'upload';
          const ext = (name.split('.').pop() || '').toLowerCase();
          const isDoc = ['tex', 'bib', 'cls', 'sty', 'txt', 'md', 'rtex', 'ltx'].includes(ext);
          const id = `local_${Math.random().toString(36).slice(2, 10)}`;
          return json(res, 200, {
            success: true,
            entity_id: id,
            entity_type: isDoc ? 'doc' : 'file',
            name,
          });
        });
        return;
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
      { find: '@', replacement: r('src/js') },
    ],
  },
  server: {
    port: 5173,
    // Allow ?raw imports from the sibling examples/ folder at the repo root
    // (one level above scripts/static/).
    fs: { allow: ['..', '../..'] },
    proxy: {
      '/health': 'http://127.0.0.1:8787',
      '/chars': 'http://127.0.0.1:8787',
      '/samples': 'http://127.0.0.1:8787',
      '/compile': 'http://127.0.0.1:8787',
      '/pull-samples': 'http://127.0.0.1:8787',
      '/default_template': 'http://127.0.0.1:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4096,
  },
});
