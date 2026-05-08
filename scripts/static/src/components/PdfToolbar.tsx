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
  <span className="material-symbols" aria-hidden translate="no">{name}</span>
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
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCompileMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [compileMenuOpen]);

  return (
    <div className="pdf">
      <div
        aria-label="PDF"
        role="toolbar"
        className="toolbar toolbar-pdf toolbar-pdf-hybrid btn-toolbar"
      >
        {/* --- Left: Recompile / Logs / Download --- */}
        <div className="toolbar-pdf-left">
          <div
            role="group"
            className="compile-button-group dropdown btn-group"
            ref={compileRef}
          >
            <button
              type="button"
              className="d-inline-grid align-items-center py-0 no-left-radius px-3 compile-button btn btn-primary"
              onClick={onCompile}
              disabled={compiling}
            >
              {compiling && <span className="compile-spinner" aria-hidden />}
              <span className="button-content" aria-hidden="false">Recompile</span>
            </button>
            <button
              type="button"
              id="pdf-recompile-dropdown"
              aria-label="Toggle compile options menu"
              aria-haspopup="menu"
              aria-expanded={compileMenuOpen}
              className="custom-toggle no-left-border dropdown-button-toggle compile-dropdown-toggle dropdown-toggle dropdown-toggle-split btn btn-primary btn-sm"
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
            className={`d-inline-grid pdf-toolbar-btn toolbar-item log-btn btn btn-link${logsOpen ? ' active' : ''}${errorCount > 0 ? ' has-errors' : ''}`}
            onClick={onToggleLogs}
            aria-pressed={logsOpen}
            aria-label="View logs"
            style={{ position: 'relative' }}
          >
            <span className="button-content" aria-hidden="false">
              {MS('description')}
              {errorCount > 0 && <span className="badge bg-danger">{errorCount}</span>}
            </span>
          </button>

          {pdfUrl && (
            <a
              className="d-inline-grid pdf-toolbar-btn btn btn-link"
              href={pdfUrl}
              download="output.pdf"
              draggable={false}
              target="_blank"
              rel="noreferrer"
              aria-label="Download PDF"
              style={{ pointerEvents: 'auto' }}
            >
              <span className="button-content" aria-hidden="false">
                {MS('download')}
              </span>
            </a>
          )}
        </div>

        {/* --- Right: portal target. PdfViewerControlsToolbar (rendered
            from inside PdfJsViewer) createPortal's into the inner
            #toolbar-pdf-controls div, matching upstream's nesting. --- */}
        <div className="toolbar-pdf-right">
          <div id="toolbar-pdf-controls" className="toolbar-pdf-controls" />
        </div>
      </div>
    </div>
  );
}
