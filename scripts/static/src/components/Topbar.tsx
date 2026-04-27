import { useEffect, useRef, useState } from 'react';
import olLogoUrl from '../assets/overleaf-o-white.svg';

type Props = {
  projectName: string;
};

const MS = (name: string) => (
  <i className="material-symbols-outlined" aria-hidden>{name}</i>
);

type MenuName = 'File' | 'Edit' | 'View' | 'Help';

const MENU_ITEMS: Record<MenuName, string[]> = {
  File: ['New Project', 'Open…', 'Rename Project', 'Download as Source', 'Download as PDF'],
  Edit: ['Undo', 'Redo', 'Find', 'Find and Replace', 'Select All'],
  View: ['Source', 'Rich Text', 'PDF Preview', 'Split Screen', 'Full Screen'],
  Help: ['Documentation', 'Keyboard Shortcuts', 'Contact Us', 'About'],
};

export default function Topbar({ projectName }: Props) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onDocClick = (e: MouseEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [openMenu]);

  return (
    <header className="ide-redesign-toolbar">
      <div className="ide-redesign-toolbar-menu-bar">
        <div className="ide-redesign-toolbar-logos">
          <div className="ide-redesign-toolbar-home-button">
            <a className="ide-redesign-toolbar-home-link" href="#" title="Home">
              <span
                className="toolbar-ol-logo"
                style={{ backgroundImage: `url(${olLogoUrl})` }}
                aria-label="Overleaf home"
              />
              <i className="material-symbols-outlined toolbar-ol-home-button" aria-hidden>home</i>
            </a>
          </div>
        </div>
        <span className="ide-redesign-toolbar-project-name">{projectName}</span>
        <nav className="ide-redesign-toolbar-menu" ref={navRef}>
          {(Object.keys(MENU_ITEMS) as MenuName[]).map((name) => (
            <div className="ide-redesign-toolbar-menu-item" key={name}>
              <button
                type="button"
                className={`ide-redesign-toolbar-button-subdued${openMenu === name ? ' active' : ''}`}
                aria-haspopup="menu"
                aria-expanded={openMenu === name}
                onClick={() => setOpenMenu((v) => (v === name ? null : name))}
                onMouseEnter={() => openMenu && setOpenMenu(name)}
              >
                {name}
              </button>
              {openMenu === name && (
                <div className="ide-redesign-toolbar-dropdown" role="menu">
                  {MENU_ITEMS[name].map((label) => (
                    <button
                      key={label}
                      className="ide-redesign-toolbar-dropdown-item"
                      role="menuitem"
                      onClick={() => setOpenMenu(null)}
                      disabled
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div className="ide-redesign-toolbar-actions">
        <button className="ide-redesign-toolbar-button-subdued">{MS('history')} History</button>
        <button className="ide-redesign-toolbar-button-subdued">{MS('view_quilt')} Layout</button>
        <button className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-primary">{MS('share')} Share</button>
      </div>
    </header>
  );
}
