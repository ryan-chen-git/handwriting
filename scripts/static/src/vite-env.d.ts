/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}

// The Overleaf lezer grammar is compiled to `latex.mjs` + `latex.terms.mjs`
// via `npx lezer-generator`. The generator does not emit type declarations,
// so we declare the two module shapes here.
declare module '*/latex.mjs' {
  import type { LRParser } from '@lezer/lr';
  export const parser: LRParser;
}
declare module '*/latex.terms.mjs' {
  // lezer-generator emits `export const FooTerm = N` for every parser term;
  // the set is grammar-defined and large, so we expose it as a record of
  // numbers indexed by name. `import * as termsModule` + `termsModule[name]`
  // accesses (see utils/tree-operations/tokens.ts) resolve cleanly.
  const terms: { [termName: string]: number };
  export = terms;
}
