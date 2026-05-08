import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

// Subset of Overleaf's DetachCompileContext used by the vendored pdf-js-viewer
// and the PDF toolbar.

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

  // Mirrors Overleaf's dark-mode PDF preview flag. When true, an inversion
  // filter is applied to the rendered PDF page (CSS-driven via a class
  // on a wrapper). Persisted in localStorage.
  darkModePdf: boolean;
  setDarkModePdf: (next: boolean) => void;
};

const noop = () => {};

const DARK_MODE_KEY = 'pdf:darkMode';

const DetachCompileContext = createContext<DetachCompileContextValue>({
  setError: noop,
  firstRenderDone: noop,
  highlights: undefined,
  position: undefined,
  setPosition: noop,
  darkModePdf: false,
  setDarkModePdf: noop,
});

export const useDetachCompileContext = () => useContext(DetachCompileContext);

export const DetachCompileProvider = ({ children }: PropsWithChildren) => {
  const [position, setPosition] = useState<PdfPosition | undefined>(undefined);

  const [darkModePdf, setDarkModePdfState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DARK_MODE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const setDarkModePdf = useCallback((next: boolean) => {
    setDarkModePdfState(next);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DARK_MODE_KEY, darkModePdf ? '1' : '0');
    } catch {
      // ignore quota / availability errors
    }
  }, [darkModePdf]);

  const value = useMemo<DetachCompileContextValue>(
    () => ({
      setError: noop,
      firstRenderDone: noop,
      highlights: undefined,
      position,
      setPosition,
      darkModePdf,
      setDarkModePdf,
    }),
    [position, darkModePdf, setDarkModePdf],
  );

  return (
    <DetachCompileContext.Provider value={value}>
      {children}
    </DetachCompileContext.Provider>
  );
};
