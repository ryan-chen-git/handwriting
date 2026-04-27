// Stub of Overleaf's infrastructure/event-tracking. Real one pings their
// Mixpanel + internal metrics pipeline. We swallow all calls.
export const sendMB = (_event: string, _data?: Record<string, unknown>) => {};
export const send = (_category: string, _event: string, _data?: Record<string, unknown>) => {};
