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
// real content when the user clicks a file in the file tree.
//
// `main` is the starter template (also the rootDoc in ol-project). The
// `ex_*` entries are read-only test files vendored from /examples at the
// repo root via Vite's `?raw` import; their doc_ids match the entries
// hardcoded in ol-project.rootFolder in index.html.
import fontMathTex from '../../../examples/font_math.tex?raw';
import lowercaseTex from '../../../examples/lowercase.tex?raw';
import spacingTex from '../../../examples/spacing.tex?raw';
import stressTex from '../../../examples/stress.tex?raw';

const splitLines = (s: string): string[] => s.replace(/\r\n/g, '\n').split('\n');

(window as unknown as { __seedDocLines: Record<string, string[]> }).__seedDocLines = {
  main: [
    '\\documentclass{article}',
    '\\begin{document}',
    '',
    'This is a starter template. Every character below should render in your',
    'own handwriting. If any letter, digit, or symbol appears in a different',
    'typeface, that glyph is missing from your sample set and needs to be',
    're-collected before the document will render correctly.',
    '',
    'The quick brown fox jumps over the lazy dog. 0123456789.',
    '',
    '\\end{document}',
  ],
  ex_font_math: splitLines(fontMathTex),
  ex_lowercase: splitLines(lowercaseTex),
  ex_spacing: splitLines(spacingTex),
  ex_stress: splitLines(stressTex),
};

import './stylesheets/main-style.scss';

// Offline build: when the user clicks "Open PDF in separate tab", the helper
// opens window.location with `/detached` appended. Upstream serves a different
// HTML file at that path which mounts only the PDF; we serve one HTML, so pick
// the entry based on the URL.
if (window.location.pathname.endsWith('/detached')) {
  import('./js/ide-detached');
} else {
  import('./js/pages/ide');
}
