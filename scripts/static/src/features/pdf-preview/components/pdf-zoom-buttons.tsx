import { useTranslation } from 'react-i18next';
import PDFToolbarButton from './pdf-toolbar-button';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

type Props = {
  setZoom: (zoom: string) => void;
};

export default function PdfZoomButtons({ setZoom }: Props) {
  const { t } = useTranslation();

  const zoomInShortcut = isMac ? '⌘+' : 'Ctrl +';
  const zoomOutShortcut = isMac ? '⌘-' : 'Ctrl -';

  return (
    <div className="pdfjs-toolbar-buttons" role="group">
      <PDFToolbarButton
        tooltipId="pdf-controls-zoom-out-tooltip"
        label={t('zoom_out')}
        icon="remove"
        onClick={() => setZoom('zoom-out')}
        shortcut={zoomOutShortcut}
      />
      <PDFToolbarButton
        tooltipId="pdf-controls-zoom-in-tooltip"
        label={t('zoom_in')}
        icon="add"
        onClick={() => setZoom('zoom-in')}
        shortcut={zoomInShortcut}
      />
    </div>
  );
}
