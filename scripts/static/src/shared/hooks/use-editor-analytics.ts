// Stub of Overleaf's shared/hooks/use-editor-analytics. Their full version
// posts to their Segment/internal pipeline; we just swallow events.
export const useEditorAnalytics = () => ({
  sendEvent: (_name: string, _payload?: Record<string, unknown>) => {},
});
