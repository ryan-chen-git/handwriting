// Stub of Overleaf's infrastructure/error-reporter. Their version ships
// the exception to Sentry; we just log it so it shows up in the console.
export const captureException = (error: unknown, context?: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.error('[captured]', error, context || '');
  }
};

export const captureMessage = (message: string, context?: Record<string, unknown>) => {
  if (import.meta.env.DEV) {
    console.warn('[captured message]', message, context || '');
  }
};
