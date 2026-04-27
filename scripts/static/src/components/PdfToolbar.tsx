import { useEffect, useRef, useState } from 'react';

type Props = {
  compiling: boolean;
  errorCount: number;
  onCompile: () => void;
  onToggleLogs: () => void;
  logsOpen: boolean;
  hasPdf: boolean;
  pdfUrl: string | null;
};

const MS = (name: string) => (
  <i className="material-symbols-outlined" aria-hidden>{name}</i>
);

export default function PdfToolbar({
  compiling,
  errorCount,
  onCompile,
  onToggleLogs,
  logsOpen,
  pdfUrl,
}: Props) {
  const [compileMenuOpen, setCompileMenuOpen] = useState(false);
  const compileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!compileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!compileRef.current?.contains(e.target as Node)) setCompileMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCompileMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [compileMenuOpen]);

  return (
    <div className="pdf">
      <div className="toolbar toolbar-pdf">
        <div className="toolbar-pdf-left">
          <div className="btn-group compile-button-group" ref={compileRef}>
            <button
              type="button"
              className="btn btn-primary compile-button"
              onClick={onCompile}
              disabled={compiling}
            >
              {compiling
                ? <span className="compile-spinner" aria-hidden />
                : MS('refresh')}
              <span className="button-content">Recompile</span>
            </button>
            <button
              type="button"
              className="btn btn-primary compile-button-menu-toggle"
              aria-label="Compile options"
              aria-haspopup="menu"
              aria-expanded={compileMenuOpen}
              onClick={() => setCompileMenuOpen((v) => !v)}
            >
              {MS('expand_more')}
            </button>
            {compileMenuOpen && (
              <div className="compile-button-menu" role="menu">
                <div className="compile-button-menu-section">Recompile options</div>
                <button className="compile-button-menu-item" role="menuitem" disabled>
                  {MS('stop_circle')} <span>Stop compilation</span>
                </button>
                <button
                  className="compile-button-menu-item"
                  role="menuitem"
                  onClick={() => { setCompileMenuOpen(false); onCompile(); }}
                >
                  {MS('refresh')} <span>Recompile from scratch</span>
                </button>
                <button className="compile-button-menu-item" role="menuitem" disabled>
                  {MS('delete')} <span>Clear cached files</span>
                </button>
                <div className="compile-button-menu-section">Compile mode</div>
                <button className="compile-button-menu-item" role="menuitem" disabled>
                  {MS('check')} <span>Normal</span>
                </button>
                <button className="compile-button-menu-item" role="menuitem" disabled>
                  {MS('draft')} <span>Fast (draft)</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`btn pdf-toolbar-btn log-btn${logsOpen ? ' active' : ''}${errorCount > 0 ? ' has-errors' : ''}`}
            onClick={onToggleLogs}
            aria-pressed={logsOpen}
            title="Logs and output files"
          >
            {MS('description')}
            <span className="button-content">Logs</span>
            {errorCount > 0 && <span className="badge bg-danger">{errorCount}</span>}
          </button>

          {pdfUrl && (
            <a
              className="btn pdf-toolbar-btn"
              href={pdfUrl}
              download="output.pdf"
              title="Download PDF"
            >
              {MS('download')}
              <span className="button-content">Download</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
