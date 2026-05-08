import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Port of Overleaf's PdfZoomDropdown. Real upstream uses Bootstrap's
// Dropdown (DropdownToggle/Menu/Item/Header/Divider). We don't import
// react-bootstrap here, so this is a hand-rolled menu with the same
// structure (custom-zoom input, divider, zoom in/out, fit width/height,
// presentation, divider, "zoom to" header + 50/75/100/150/200/400%).

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const shortcuts = isMac
  ? {
      'zoom-in': ['⌘', '+'],
      'zoom-out': ['⌘', '-'],
      'fit-to-width': ['⌘', '0'],
      'fit-to-height': ['⌘', '9'],
    }
  : {
      'zoom-in': ['Ctrl', '+'],
      'zoom-out': ['Ctrl', '-'],
      'fit-to-width': ['Ctrl', '0'],
      'fit-to-height': ['Ctrl', '9'],
    };

const zoomValues = ['0.5', '0.75', '1', '1.5', '2', '4'];

const rawScaleToPercentage = (rawScale: number) => `${Math.round(rawScale * 100)}%`;

type Props = {
  requestPresentationMode: () => void;
  setZoom: (zoom: string) => void;
  rawScale: number;
};

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="shortcut" aria-hidden>
      {keys.map((k, i) => (
        <kbd key={i}>{k}</kbd>
      ))}
    </span>
  );
}

export default function PdfZoomDropdown({
  requestPresentationMode,
  setZoom,
  rawScale,
}: Props) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [customZoomValue, setCustomZoomValue] = useState<string>(
    rawScaleToPercentage(rawScale),
  );

  useEffect(() => {
    setCustomZoomValue(rawScaleToPercentage(rawScale));
  }, [rawScale]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const showPresentOption =
    typeof document !== 'undefined' && document.fullscreenEnabled;

  const select = (eventKey: string) => {
    if (eventKey === 'custom-zoom') return;
    if (eventKey === 'present') {
      setOpen(false);
      requestPresentationMode();
      return;
    }
    setOpen(false);
    setZoom(eventKey);
  };

  return (
    <div className="dropdown pdf-zoom-dropdown" ref={wrapRef}>
      <button
        type="button"
        id="pdf-zoom-dropdown"
        className="btn pdf-toolbar-btn pdfjs-zoom-dropdown-button small"
        aria-label={t('pdf_zoom_level')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {rawScaleToPercentage(rawScale)}
      </button>
      {open && (
        <ul className="dropdown-menu pdfjs-zoom-dropdown-menu show" role="menu">
          <li role="none">
            <div
              className="dropdown-item pdfjs-custom-zoom-menu-item"
              role="menuitem"
            >
              <input
                className="form-control"
                type="text"
                value={customZoomValue}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  setCustomZoomValue(e.target.value.replace(/[^0-9%]/g, ''));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const zoom = Number(customZoomValue.replace('%', '')) / 100;
                    setOpen(false);
                    if (zoom < 0.1) setZoom('0.1');
                    else if (zoom > 9.99) setZoom('9.99');
                    else setZoom(`${zoom}`);
                  }
                }}
              />
            </div>
          </li>
          <li role="separator"><hr className="dropdown-divider" /></li>
          <li role="none">
            <button type="button" role="menuitem" className="dropdown-item" onClick={() => select('zoom-in')}>
              {t('zoom_in')}
              <Shortcut keys={shortcuts['zoom-in']} />
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="dropdown-item" onClick={() => select('zoom-out')}>
              {t('zoom_out')}
              <Shortcut keys={shortcuts['zoom-out']} />
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="dropdown-item" onClick={() => select('page-width')}>
              {t('fit_to_width')}
              <Shortcut keys={shortcuts['fit-to-width']} />
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" className="dropdown-item" onClick={() => select('page-height')}>
              {t('fit_to_height')}
              <Shortcut keys={shortcuts['fit-to-height']} />
            </button>
          </li>
          {showPresentOption && (
            <li role="separator"><hr className="dropdown-divider" /></li>
          )}
          {showPresentOption && (
            <li role="none">
              <button type="button" role="menuitem" className="dropdown-item" onClick={() => select('present')}>
                {t('presentation_mode')}
              </button>
            </li>
          )}
          <li role="separator"><hr className="dropdown-divider" /></li>
          <li className="dropdown-header" aria-hidden>{t('zoom_to')}</li>
          {zoomValues.map((value) => (
            <li role="none" key={value}>
              <button type="button" role="menuitem" className="dropdown-item" onClick={() => select(value)}>
                {rawScaleToPercentage(Number(value))}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
