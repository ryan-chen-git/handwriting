import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import themeJson from './cm6/overleaf_dark.json';

// Build the CodeMirror 6 extensions for Overleaf's `overleaf_dark` theme.
// Upstream this is loaded dynamically from a generated `.json` at runtime
// (see services/web/frontend/js/features/source-editor/themes/cm6 and the
// `theme-cache.ts` helper). We import the JSON at bundle time and map the
// `tok-*` keys to their `@lezer/highlight` tag equivalents.
const tagByClass: Record<string, readonly unknown[] | unknown> = {
  'tok-keyword': t.keyword,
  'tok-literal': t.literal,
  'tok-typeName': t.typeName,
  'tok-invalid': t.invalid,
  'tok-string': t.string,
  'tok-comment': t.comment,
  'tok-attributeValue': t.attributeValue,
  'tok-attributeName': t.attributeName,
  'tok-function': t.function(t.variableName),
  'tok-tagName': t.tagName,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const overleafDarkTheme = EditorView.theme(themeJson.theme as any, { dark: true });

const highlightSpecs = Object.entries(themeJson.highlightStyle)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .map(([selector, style]): any => {
    const key = selector.replace(/^\.?/, '');
    const tag = tagByClass[key];
    if (!tag) return null;
    return { tag, ...(style as Record<string, string>) };
  })
  .filter(Boolean);

// Cast to `any` for the HighlightStyle.define call — the tag union in @lezer
// /highlight is too narrow to express programmatically, but the runtime
// shape is identical to what upstream passes in.
export const overleafDarkHighlight = syntaxHighlighting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HighlightStyle.define(highlightSpecs as any),
);
