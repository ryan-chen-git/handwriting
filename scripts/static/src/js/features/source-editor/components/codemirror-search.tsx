// Stubbed: upstream wires a custom search panel via @codemirror/search's
// internal `createSearchPanel`, which isn't exported publicly. We render
// nothing here; CodeMirror's default Ctrl+F panel still works.
function CodeMirrorSearch() {
  return null
}

export default CodeMirrorSearch
