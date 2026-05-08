// No-op stub. Upstream wires Sentry here; we ship offline so there's no
// external error sink.
import OError from '@overleaf/o-error';

export type ErrorContext = Record<string, unknown>;
export type ErrorMetadata = Record<string, unknown>;

export function captureException(_error: unknown, _context?: ErrorContext): void {}
export function captureMessage(_message: string): void {}
export function captureFromUnhandledRejection(_reason: unknown): void {}
export function reportError(_error: unknown): void {}

export { OError };
