import { useMemo } from 'react';
import type { RailKey } from './LeftRail';
import { TEST_PRESETS, type TestPreset } from '../lib/test-presets';

export type TexFile = { name: string; content: string };

type Props = {
  active: RailKey;
  files: TexFile[];
  activeFileName: string;
  onSelectFile: (name: string) => void;
  onOpenPreset: (preset: TestPreset) => void;
  onClose: () => void;
};

const TITLES: Record<RailKey, string> = {
  files: 'File tree',
  search: 'Project search',
  tests: 'Test presets',
  review: 'Review',
  chat: 'Chat',
  help: 'Help',
  settings: 'Settings',
};

const MS = (name: string) => (
  <i className="material-symbols-outlined" aria-hidden>{name}</i>
);

type OutlineNode = { level: number; title: string; line: number };

const SECTION_RE = /^\s*\\(section|subsection|subsubsection|paragraph|subparagraph|chapter)\*?\s*\{([^}]*)\}/;
const LEVEL: Record<string, number> = {
  chapter: 0, section: 1, subsection: 2, subsubsection: 3, paragraph: 4, subparagraph: 5,
};

function parseOutline(src: string): OutlineNode[] {
  const out: OutlineNode[] = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SECTION_RE);
    if (m) out.push({ level: LEVEL[m[1]] ?? 1, title: m[2], line: i + 1 });
  }
  return out;
}

export default function RailPanel({
  active,
  files,
  activeFileName,
  onSelectFile,
  onOpenPreset,
  onClose,
}: Props) {
  const activeFile = files.find((f) => f.name === activeFileName);
  const outline = useMemo(() => parseOutline(activeFile?.content ?? ''), [activeFile?.content]);

  return (
    <aside className="ide-rail-panel" aria-label={TITLES[active]}>
      <header className="ide-rail-panel-header">
        <h2 className="ide-rail-panel-title">{TITLES[active]}</h2>
        <button
          type="button"
          className="ide-rail-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close"
        >
          {MS('close')}
        </button>
      </header>
      <div className="ide-rail-panel-body">
        {active === 'files' && (
          <ul className="ide-rail-file-list">
            {files.map((f) => (
              <li
                key={f.name}
                className={`ide-rail-file-item${f.name === activeFileName ? ' active' : ''}`}
              >
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectFile(f.name);
                  }}
                >
                  {MS('description')} <span>{f.name}</span>
                </a>
              </li>
            ))}
            {files.length === 0 && (
              <li className="ide-rail-panel-hint">No files yet.</li>
            )}
          </ul>
        )}
        {active === 'tests' && (
          <>
            <div className="ide-rail-panel-hint">
              Each preset opens as a new file in the project. Select it in the File tree to compile.
            </div>
            <ul className="ide-rail-file-list">
              {TEST_PRESETS.map((p) => (
                <li key={p.id} className="ide-rail-file-item">
                  <a
                    href="#"
                    title={p.description}
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenPreset(p);
                    }}
                  >
                    {MS('science')}
                    <span>{p.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {active === 'review' && (
          <div className="ide-rail-panel-empty">
            {MS('rate_review')}
            <p>No review comments yet.</p>
          </div>
        )}
        {active === 'chat' && (
          <div className="ide-rail-panel-empty">
            {MS('forum')}
            <p>Chat is disabled in this build.</p>
          </div>
        )}
        {active === 'search' && (
          <div className="ide-rail-panel-search">
            <input
              className="ide-rail-panel-search-input"
              placeholder="Search…"
              disabled
            />
            <div className="ide-rail-panel-hint">Project search is not wired up yet.</div>
          </div>
        )}
        {active === 'help' && (
          <ul className="ide-rail-file-list">
            <li className="ide-rail-file-item"><a href="https://www.overleaf.com/learn" target="_blank" rel="noreferrer">{MS('menu_book')} <span>LaTeX learn guide</span></a></li>
            <li className="ide-rail-file-item"><a href="https://www.overleaf.com/learn/latex/Questions/Keyboard_shortcuts" target="_blank" rel="noreferrer">{MS('keyboard')} <span>Keyboard shortcuts</span></a></li>
          </ul>
        )}
        {active === 'settings' && (
          <div className="ide-rail-panel-settings">
            <label className="ide-rail-setting-row">
              <span>Theme</span>
              <select disabled defaultValue="dark">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <label className="ide-rail-setting-row">
              <span>Font family</span>
              <select disabled defaultValue="mono">
                <option value="mono">Monospace</option>
                <option value="sans">Lucida</option>
              </select>
            </label>
            <label className="ide-rail-setting-row">
              <span>Auto-complete</span>
              <input type="checkbox" disabled defaultChecked />
            </label>
          </div>
        )}

        {active === 'files' && (
          <>
            <h3 className="ide-rail-panel-subheader">Outline</h3>
            {outline.length === 0 ? (
              <div className="ide-rail-panel-hint">
                No sections found. Use <code>\section{'{…}'}</code>, <code>\subsection{'{…}'}</code>, etc.
              </div>
            ) : (
              <ul className="ide-rail-outline">
                {outline.map((n, idx) => (
                  <li
                    key={idx}
                    className="ide-rail-outline-item"
                    style={{ paddingLeft: 8 + n.level * 12 }}
                    title={`Line ${n.line}`}
                  >
                    {n.title}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
