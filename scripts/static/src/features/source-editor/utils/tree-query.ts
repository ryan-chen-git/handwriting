// Slimmed-down re-export barrel. Upstream this file re-exports ~40 symbols
// across the whole tree-operations/ tree; we only clone the pieces needed
// by the LaTeX language + close-bracket config, so the barrel is trimmed
// to match. Expand this as we vendor more of the feature.
export {
  commentIsOpenFold,
  commentIsCloseFold,
  findClosingFoldComment,
  getFoldRange,
} from './tree-operations/comments';

export { tokenNames, Tokens } from './tree-operations/tokens';
