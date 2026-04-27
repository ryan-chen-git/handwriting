import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { LaTeXLanguage } from '../features/source-editor/languages/latex/latex-language';
import { overleafDarkTheme, overleafDarkHighlight } from '../features/source-editor/themes/overleaf-dark-theme';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

// Uses Overleaf's real lezer-latex grammar + LaTeXLanguage (vendored from
// services/web/frontend/js/features/source-editor/): node-prop-driven
// folding, proper environment parsing, and language-aware close-brackets.
export default function CodeEditor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        foldGutter(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        LaTeXLanguage,
        overleafDarkTheme,
        overleafDarkHighlight,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([indentWithTab, ...closeBracketsKeymap, ...foldKeymap, ...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className="ide-codeeditor" />;
}
