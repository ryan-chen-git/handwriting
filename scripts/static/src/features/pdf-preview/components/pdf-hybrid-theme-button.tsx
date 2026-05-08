import { useTranslation } from 'react-i18next';
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context';

// Simplified port of Overleaf's PdfHybridThemeButton. Real upstream guards
// on activeOverallTheme === 'dark' and pdfViewer === 'pdfjs' and showLogs
// — we run dark-only with the pdfjs viewer always, so those guards drop.

export const PdfHybridThemeButton = () => {
  const { t } = useTranslation();
  const { darkModePdf, setDarkModePdf } = useDetachCompileContext();

  const tooltipText = darkModePdf
    ? t('showing_pdf_preview_with_inverted_colors')
    : t('invert_pdf_preview_colors');

  return (
    <button
      type="button"
      className={`btn pdf-toolbar-btn toolbar-item theme-toggle-btn${darkModePdf ? ' active' : ''}`}
      aria-label={tooltipText}
      aria-pressed={darkModePdf}
      title={tooltipText}
      onClick={() => setDarkModePdf(!darkModePdf)}
      style={{ position: 'relative' }}
    >
      <span className="material-symbols" aria-hidden translate="no">invert_colors</span>
    </button>
  );
};
