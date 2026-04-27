import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

// Subset of Overleaf's DetachCompileContext used by the vendored pdf-js-viewer.
// We only implement the handful of state slots the viewer actually reads/writes:
// setError, firstRenderDone, highlights, position, setPosition.
//
// The full upstream context bag is much larger (compile state, auto-compile
// settings, SyncTeX, file list, etc.) — we don't need any of that here because
// compilation is driven by our App.tsx already.

export type PdfHighlight = {
  page: number;
  h: number;
  v: number;
  width: number;
  height: number;
};

export type PdfPosition = {
  page: number;
  offset: { top: number; left: number };
  pageY?: number;
  pageX?: number;
  scale?: number;
};

type CompileError = undefined | string;

type FirstRenderMetrics = {
  latencyFetch: number;
  latencyRender?: number;
  pdfCachingMetrics?: unknown;
};

type DetachCompileContextValue = {
  setError: (err: CompileError) => void;
  firstRenderDone: (metrics: FirstRenderMetrics) => void;
  highlights: PdfHighlight[] | undefined;
  position: PdfPosition | undefined;
  setPosition: (pos: PdfPosition | undefined) => void;
};

const noop = () => {};

const DetachCompileContext = createContext<DetachCompileContextValue>({
  setError: noop,
  firstRenderDone: noop,
  highlights: undefined,
  position: undefined,
  setPosition: noop,
});

export const useDetachCompileContext = () => useContext(DetachCompileContext);

export const DetachCompileProvider = ({ children }: PropsWithChildren) => {
  const [position, setPosition] = useState<PdfPosition | undefined>(undefined);

  const value = useMemo<DetachCompileContextValue>(
    () => ({
      setError: noop,
      firstRenderDone: noop,
      highlights: undefined,
      position,
      setPosition,
    }),
    [position],
  );

  return (
    <DetachCompileContext.Provider value={value}>
      {children}
    </DetachCompileContext.Provider>
  );
};
