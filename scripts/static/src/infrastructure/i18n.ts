import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Minimal i18next wiring so vendored Overleaf components can call
// `useTranslation()` / `<Trans>` without crashing. We only fill in the
// English strings Overleaf's pdf-preview feature uses.
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: {
      translation: {
        pdf_viewer_error: 'PDF viewer error.',
        log_viewer_error: 'Log viewer error.',
        pdf_preview_error: 'PDF preview error.',
        try_recompile_project_or_troubleshoot:
          'Try recompiling the project, or <0>check the troubleshooting guide</0>.',
        close_tab: 'Close tab',
        linked_file: 'Linked file',
        back_to_your_projects: 'Back to your projects',
        overleaf_logo: 'Overleaf',

        // PDF toolbar
        previous_page: 'Previous page',
        next_page: 'Next page',
        page_current: 'Page {{page}}',
        zoom_in: 'Zoom in',
        zoom_out: 'Zoom out',
        fit_to_width: 'Fit to width',
        fit_to_height: 'Fit to height',
        zoom_to: 'Zoom to',
        pdf_zoom_level: 'Zoom level',
        presentation_mode: 'Presentation mode',
        showing_pdf_preview_with_inverted_colors:
          'Showing PDF preview with inverted colors',
        invert_pdf_preview_colors: 'Invert PDF preview colors',
      },
    },
  },
});

export default i18n;
