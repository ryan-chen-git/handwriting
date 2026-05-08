import { useEffect, useRef, useState } from 'react';
import olLogoUrl from '../assets/overleaf-o-white.svg';

type Props = {
  projectName: string;
};

const MS = (name: string) => (
  <span className="material-symbols" aria-hidden translate="no">{name}</span>
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
              <span className="material-symbols toolbar-ol-home-button" aria-hidden translate="no">home</span>
            </a>
          </div>
        </div>
        <span className="ide-redesign-toolbar-project-name">{projectName}</span>
        <nav className="ide-redesign-toolbar-menu" ref={navRef}>
          {(Object.keys(MENU_ITEMS) as MenuName[]).map((name) => (
            <div className="ide-redesign-toolbar-menu-item" key={name}>
              {/* Mirrors upstream <MenuBarDropdown>: <DropdownToggle variant="secondary"
                  className="ide-redesign-toolbar-dropdown-toggle-subdued
                             ide-redesign-toolbar-button-subdued menu-bar-toggle">.
                  Sizing (28px tall / 14px font / 4px radius) comes from those
                  three classes in vendored toolbar-redesign.scss + menu-bar.scss. */}
              <button
                type="button"
                className={`btn btn-secondary dropdown-toggle ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-subdued menu-bar-toggle${openMenu === name ? ' active show' : ''}`}
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
        {/* Upstream <OLIconButton icon="history" className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon">
            renders: <button class="btn btn-{variant} icon-button [...]">
                       <span class="button-content">
                         <span class="material-symbols icon-small">history</span>
                       </span>
                     </button> */}
        <div className="ide-redesign-toolbar-button-container">
          <button
            type="button"
            className="btn btn-secondary icon-button ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
            aria-label="History"
            title="History"
          >
            <span className="button-content">
              <span className="material-symbols icon-small" aria-hidden translate="no">history</span>
            </span>
          </button>
        </div>
        {/* Upstream Layout: <DropdownToggle> with ide-redesign-toolbar-button-subdued
            + ide-redesign-toolbar-dropdown-toggle-subdued + ide-redesign-toolbar-button-icon. */}
        <div className="ide-redesign-toolbar-button-container">
          <button
            type="button"
            className="btn btn-secondary icon-button ide-redesign-toolbar-button-subdued ide-redesign-toolbar-dropdown-toggle-subdued ide-redesign-toolbar-button-icon"
            aria-label="Layout options"
            title="Layout"
          >
            <span className="button-content">
              <span className="material-symbols icon-small unfilled" aria-hidden translate="no">space_dashboard</span>
            </span>
          </button>
        </div>
        {/* Upstream Share: <OLButton size="sm" variant="primary" leadingIcon=...> */}
        <div className="ide-redesign-toolbar-button-container">
          <button
            type="button"
            className="btn btn-primary btn-sm"
          >
            <span className="button-content">
              {MS('person_add')}
              <span>Share</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
