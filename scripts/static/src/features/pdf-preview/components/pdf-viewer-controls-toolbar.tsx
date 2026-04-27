// Stub of upstream's pdf-viewer-controls-toolbar. The real toolbar pulls in a
// dozen more components (page-number-control, zoom-buttons, zoom-dropdown,
// theme-button, menu-button, etc.) that all depend on Overleaf's layout /
// command / split-test contexts. We render our own PdfToolbar outside the
// PdfJsViewer, so this file is an inert placeholder that just satisfies the
// import.

type Props = {
  requestPresentationMode: () => void;
  setZoom: (zoom: string) => void;
  rawScale: number;
  setPage: (page: number) => void;
  page: number;
  totalPages: number;
  pdfContainer?: HTMLDivElement;
};

function PdfViewerControlsToolbar(_props: Props) {
  return null;
}

export default PdfViewerControlsToolbar;
