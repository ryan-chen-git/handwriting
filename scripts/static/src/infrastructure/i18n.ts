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
      },
    },
  },
});

export default i18n;
