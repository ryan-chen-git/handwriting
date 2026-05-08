import { useMemo } from 'react';
import PdfJsViewer from '../features/pdf-preview/components/pdf-js-viewer';
import type { PDFFile } from '@ol-types/compile';

type Props = {
  pdfUrl: string | null;
  pdfSize?: number;
};

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

  return (
    <div className="pdf-viewer">
      <PdfJsViewer url={pdfUrl} pdfFile={pdfFile} />
    </div>
  );
}
