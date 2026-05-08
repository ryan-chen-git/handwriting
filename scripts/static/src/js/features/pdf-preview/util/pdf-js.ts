import '@/utils/abortsignal-polyfill'
import * as PDFJS from 'pdfjs-dist'
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api'

export { PDFJS }

// Vite needs the explicit `{ type: 'module' }` option for an ESM worker (the
// `.mjs` build of pdf.worker uses top-level import.meta). Upstream's webpack
// auto-detects this; Vite does not.
PDFJS.GlobalWorkerOptions.workerPort = new Worker(
  new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url),
  { type: 'module' }
)

export const imageResourcesPath = '/images/pdfjs-dist/'
const cMapUrl = '/js/pdfjs-dist/cmaps/'
const wasmUrl = '/js/pdfjs-dist/wasm/'
const iccUrl = '/js/pdfjs-dist/iccs/'
const standardFontDataUrl = '/fonts/pdfjs-dist/'

const params = new URLSearchParams(window.location.search)
const disableFontFace = params.get('disable-font-face') === 'true'
const disableStream = process.env.NODE_ENV !== 'test'

export const loadPdfDocumentFromUrl = (
  url: string,
  options: Partial<DocumentInitParameters> = {}
) =>
  PDFJS.getDocument({
    url,
    cMapUrl,
    wasmUrl,
    iccUrl,
    standardFontDataUrl,
    disableFontFace,
    disableAutoFetch: true, // only fetch the data needed for the displayed pages
    disableStream,
    isEvalSupported: false,
    enableXfa: false, // default is false (2021-10-12), but set explicitly to be sure
    ...options,
  })
