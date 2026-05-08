// Permissive stub for upstream's `overleaf-editor-core` package — used by
// their history/track-changes machinery. We don't have the backend pieces
// that produce these, so the public surface is a no-op set of placeholder
// classes / types. Every name referenced anywhere in vendored upstream code
// is exported as a generic class so `new X()` and instanceof checks work.
//
// Catalog (regenerate by grepping `import .* from 'overleaf-editor-core'` —
// see scripts/static/AGENT_CONTEXT.md if/when added):
//   AddCommentOperation, Change, Chunk, CommentList,
//   DeleteCommentOperation, EditOperation, EditOperationBuilder,
//   EditOperationTransformer, File, InsertOp, Range, RawChange, RawChunk,
//   RawEditOperation, RemoveOp, RetainOp, SetCommentStateOperation,
//   Snapshot, StringFileData, StringFileRawData, TextOperation,
//   TrackedChangeList, TrackingProps.

class Stub {}

export class TrackingProps extends Stub {
  type = '';
  userId = '';
  ts = new Date();
}
export const ClearTrackingProps = TrackingProps;

export class Range extends Stub {
  pos = 0;
  length = 0;
}
export class StringFileData extends Stub {
  content = '';
}
export class FileData extends Stub {}
export class File extends Stub {}
export class TextOperation extends Stub {}
export class EditOperation extends Stub {}
export class EditOperationBuilder extends Stub {
  static fromJSON(_raw: unknown) { return new EditOperationBuilder(); }
}
export class EditOperationTransformer extends Stub {
  static transform(_a: unknown, _b: unknown): [EditOperation, EditOperation] {
    return [new EditOperation(), new EditOperation()];
  }
}
export class Operation extends Stub {}
export class InsertOp extends Stub {}
export class RemoveOp extends Stub {}
export class RetainOp extends Stub {}
export class History extends Stub {}
export class Snapshot extends Stub {}
export class V2DocVersions extends Stub {}
export class Chunk extends Stub {}
export class Change extends Stub {}
export class TrackedChange extends Stub {}
export class TrackedChangeList extends Stub {
  static fromRaw(_raw: unknown) { return new TrackedChangeList(); }
  asSorted() { return [] as TrackedChange[]; }
  applyDelete(_op: unknown) {}
  applyInsert(_op: unknown) {}
  applyRetain(_op: unknown) {}
}
export class CommentList extends Stub {
  static fromRaw(_raw: unknown) { return new CommentList(); }
  applyAddComment(_op: unknown) {}
  applyDeleteComment(_op: unknown) {}
  applySetCommentState(_op: unknown) {}
}
export class AddCommentOperation extends Stub {}
export class DeleteCommentOperation extends Stub {}
export class SetCommentStateOperation extends Stub {}

// Type aliases used across vendored code; cast to any so usage compiles.
export type ChangeType = string;
export type RawChange = any;
export type RawChunk = any;
export type RawEditOperation = any;
export type RawTrackedChange = any;
export type RawTrackingProps = any;
export type StringFileRawData = any;

const defaultExport = {} as Record<string, unknown>;
export default defaultExport;
