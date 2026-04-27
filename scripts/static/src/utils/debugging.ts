// Stub of @/utils/debugging from overleaf/overleaf. Their original gates on
// ?debug=true; we unconditionally forward to console for dev and swallow in
// prod.
const DEBUG = import.meta.env.DEV;

export const debugConsole = {
  log: (...args: unknown[]) => { if (DEBUG) console.log(...args); },
  warn: (...args: unknown[]) => { if (DEBUG) console.warn(...args); },
  error: (...args: unknown[]) => { if (DEBUG) console.error(...args); },
};
