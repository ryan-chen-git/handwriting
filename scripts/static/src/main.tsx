import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './infrastructure/i18n';
import { PdfPreviewProvider } from './features/pdf-preview/components/pdf-preview-provider';
import { ProjectProvider } from './shared/context/project-context';
import { DetachCompileProvider } from './shared/context/detach-compile-context';

// Order matters: Bootstrap first (provides --bs-* vars + .btn base styles),
// then vendored Overleaf SCSS (consumes those vars), then our overrides.
import 'bootstrap/dist/css/bootstrap.min.css';
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
