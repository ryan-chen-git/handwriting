import { memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PdfHybridThemeButton } from './pdf-hybrid-theme-button';
import PdfPageNumberControl from './pdf-page-number-control';
import PdfZoomButtons from './pdf-zoom-buttons';
import PdfZoomDropdown from './pdf-zoom-dropdown';

// Port of Overleaf's PdfViewerControlsToolbar. Renders into the
// `#toolbar-pdf-controls` slot defined by the outer PdfToolbar via
// React portal, so the controls component lives near the PDF state
// (here, inside PdfJsViewer) but appears in the right side of the
// main toolbar row.
//
// We omit upstream's responsive small-mode (PdfViewerControlsToolbarSmall),
// the resize observer, and the keyboard-command provider — easy to add
// later if needed; the user said "trim after, don't worry about adding
// too much functionality."

type Props = {
  requestPresentationMode: () => void;
  setZoom: (zoom: string) => void;
  rawScale: number;
  setPage: (page: number) => void;
  page: number;
  totalPages: number;
  pdfContainer?: HTMLDivElement;
};

function PdfViewerControlsToolbar({
  requestPresentationMode,
  setZoom,
  rawScale,
  setPage,
  page,
  totalPages,
}: Props) {
  // Wait for the portal target to mount. Re-checks on every render until
  // it appears; `portalNode` becomes a stable element once present.
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (portalNode) return;
    const tick = () => {
      const el = document.getElementById('toolbar-pdf-controls');
      if (el) setPortalNode(el);
    };
    tick();
    if (!portalNode) {
      const id = window.setTimeout(tick, 0);
      return () => window.clearTimeout(id);
    }
  });

  if (!portalNode) return null;

  return createPortal(
    <div className="pdfjs-viewer-controls">
      <PdfHybridThemeButton />
      <PdfPageNumberControl
        setPage={setPage}
        page={page}
        totalPages={totalPages}
      />
      <div className="pdfjs-zoom-controls">
        <PdfZoomButtons setZoom={setZoom} />
        <PdfZoomDropdown
          requestPresentationMode={requestPresentationMode}
          rawScale={rawScale}
          setZoom={setZoom}
        />
      </div>
    </div>,
    portalNode,
  );
}

export default memo(PdfViewerControlsToolbar);
