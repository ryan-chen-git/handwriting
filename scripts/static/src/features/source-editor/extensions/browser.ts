// Subset of Overleaf's source-editor/extensions/browser helper. They expose
// `browser.chrome`, `browser.firefox`, etc.; the pdf-js-wrapper only cares
// about `browser.safari` (to cap the canvas size).
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

const browser = {
  chrome: /Chrome/.test(ua) && !/Edg\//.test(ua),
  firefox: /Firefox/.test(ua),
  safari: /Safari/.test(ua) && !/Chrome|Chromium/.test(ua),
  edge: /Edg\//.test(ua),
};

export default browser;
