// Entry point that boots upstream Overleaf's IDE page.
//
//   1. Set `window.io = null`. Upstream's connection-manager checks
//      `typeof window.io !== 'object'` to decide whether socket.io loaded
//      (a `<script>` tag injects the real one in production). JS quirk:
//      `typeof null === 'object'`, so the check passes. The downstream
//      `SocketIoShim` then sees `!io` and picks its built-in `SocketShimNoop`,
//      a no-op shim — no real network connection is attempted.
//   2. Load stylesheets so Bootstrap's variable-overrides + foundations
//      apply before any component reads them.
//   3. Load the page entry, which mounts <IdeRoot/> into #ide-root.
(window as unknown as { io: unknown }).io = null;

// Offline build: seed doc contents keyed by doc_id. Our patched
// SocketShimNoop replies to `joinDoc` with these lines so the editor mounts
// real content instead of showing "no_selection_select_file".
(window as unknown as { __seedDocLines: Record<string, string[]> }).__seedDocLines = {
  main: [
    '\\documentclass{article}',
    '\\begin{document}',
    'Hello, world.',
    '\\end{document}',
  ],
};

import './stylesheets/main-style.scss';
import './js/pages/ide';
