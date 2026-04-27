// Subset of Overleaf's types/compile that the vendored util/types.ts uses.
// In upstream this is defined at the monorepo root (5 levels above the
// feature file, hence `../../../../../types/compile`). We mirror that with
// `src/types/compile.ts` so the vendored relative import resolves.
export type CompileOutputFile = {
  path: string;
  url?: string;
  type: string;
  build?: string;
  size?: number;
  createdAt?: Date;
};
