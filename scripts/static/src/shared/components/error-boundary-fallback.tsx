import type { PropsWithChildren } from 'react';

// Subset of Overleaf's ErrorBoundaryFallback. Renders children inside a
// styled box so consumer-supplied messages ("PDF viewer error" etc.) show up.
export const ErrorBoundaryFallback = ({ children }: PropsWithChildren) => (
  <div className="error-boundary-fallback">{children}</div>
);
