import { Component, type ComponentType, type ReactNode } from 'react';
import { captureException } from './error-reporter';

// Stub of Overleaf's withErrorBoundary HOC. Their version adds sentry/segment
// tags; we capture the exception and render the fallback. Upstream callers
// pass the fallback as `() => ReactNode`, so we keep that narrow signature.
type FallbackFn = () => ReactNode;

type ErrorBoundaryProps = {
  fallback: FallbackFn;
  children: ReactNode;
};
type ErrorBoundaryState = { error: unknown };

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown) {
    captureException(error);
  }

  render() {
    return this.state.error ? this.props.fallback() : this.props.children;
  }
}

export default function withErrorBoundary<P extends object>(
  Wrapped: ComponentType<P>,
  fallback: FallbackFn,
): ComponentType<P> {
  const Boundary = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Wrapped {...props} />
    </ErrorBoundary>
  );
  Boundary.displayName = `withErrorBoundary(${Wrapped.displayName || Wrapped.name || 'Component'})`;
  return Boundary;
}
