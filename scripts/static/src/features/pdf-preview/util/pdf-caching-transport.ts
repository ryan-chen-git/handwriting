// Stub of Overleaf's pdf-caching-transport. The real factory builds a
// range-fetch-backed transport for byte-range streaming PDFs. For our local
// use we return a factory that always yields null, so pdf.js falls back to
// its default fetch path.
export const generatePdfCachingTransportFactory = () => () => null;
