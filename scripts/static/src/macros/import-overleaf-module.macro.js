// Vite-friendly stub of upstream's babel-plugin-macros macro. The original
// resolves `modules/*/foo.tsx` plug-in points at compile time. We don't run
// babel-plugin-macros, so this becomes a runtime function that returns an
// empty array — every `importOverleafModules('foo')` call site sees no
// extras.
export default function importOverleafModules(_name) {
  return [];
}
