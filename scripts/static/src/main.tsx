import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './infrastructure/i18n';
import { PdfPreviewProvider } from './features/pdf-preview/components/pdf-preview-provider';
import { ProjectProvider } from './shared/context/project-context';
import { DetachCompileProvider } from './shared/context/detach-compile-context';

// Bootstrap is built from SCSS source inside styles/overleaf/index.scss
// (via base/bootstrap.scss) with upstream's variable-overrides applied
// BEFORE compilation. Don't add `bootstrap.min.css` back — it would
// re-introduce Bootstrap's defaults and undo the variable-overrides.
import './styles/overleaf/index.scss';
import './styles/overrides.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <DetachCompileProvider>
        <PdfPreviewProvider>
          <App />
        </PdfPreviewProvider>
      </DetachCompileProvider>
    </ProjectProvider>
  </StrictMode>
);
