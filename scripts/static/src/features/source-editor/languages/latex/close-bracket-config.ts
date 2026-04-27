import type { CloseBracketConfig } from '@codemirror/autocomplete';

// Minimal close-bracket config. Upstream Overleaf ships a patched
// @codemirror/autocomplete that adds a custom `buildInsert` hook so `$$`
// (display math) and other multi-char pairs can auto-close intelligently.
// Our plain-release @codemirror/autocomplete only supports `brackets`,
// `before`, and `stringPrefixes`, so the `$$` upgrade isn't available
// without forking the package. Single-char `$` still auto-pairs.
export const closeBracketConfig: CloseBracketConfig = {
  brackets: ['$', '[', '{', '('],
};
