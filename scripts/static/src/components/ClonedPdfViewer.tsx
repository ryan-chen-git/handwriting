import { useMemo } from 'react';
import PdfJsViewer from '../features/pdf-preview/components/pdf-js-viewer';
import type { PDFFile } from '@ol-types/compile';

type Props = {
  pdfUrl: string | null;
  pdfSize?: number;
};

// Thin adapter around the verbatim Overleaf pdf-js-viewer. Keeps its internal
// state (scale, page) in localStorage via their usePersistedState; our outer
// toolbar's zoom/page buttons are suppressed when this viewer is active
// because the cloned component owns that state.
export default function ClonedPdfViewer({ pdfUrl, pdfSize }: Props) {
  const pdfFile = useMemo<PDFFile | null>(
    () => (pdfUrl ? { url: pdfUrl, size: pdfSize ?? 1 } : null),
    [pdfUrl, pdfSize],
  );

  if (!pdfUrl || !pdfFile) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-viewer-empty">
          <p>No PDF yet — click Recompile to generate one.</p>
        </div>
      </div>
    );
  }

  // Wrap in `.pdf-viewer` so the vendored Overleaf pdf.scss selectors
  // (`.pdf-viewer .pdfjs-viewer.pdfjs-viewer-outer { ... }`) apply.
  return (
    <div className="pdf-viewer">
      <PdfJsViewer url={pdfUrl} pdfFile={pdfFile} />
    </div>
  );
}
