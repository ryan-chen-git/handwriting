// Upstream Overleaf imports `nextChar`/`prevChar` from `@codemirror/autocomplete`,
// but those symbols aren't part of the public API of any published version.
// Provide local re-implementations matching upstream's signatures.
import type { Text } from '@codemirror/state';

export function nextChar(doc: Text, pos: number): string {
  if (pos >= doc.length) return '';
  return doc.sliceString(pos, Math.min(doc.length, pos + 2));
}

export function prevChar(doc: Text, pos: number): string {
  if (pos <= 0) return '';
  return doc.sliceString(Math.max(0, pos - 2), pos);
}
