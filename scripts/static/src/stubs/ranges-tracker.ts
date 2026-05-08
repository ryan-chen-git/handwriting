// Minimal stub for @overleaf/ranges-tracker. Upstream uses it to track
// comment threads and accepted/rejected change ranges in a document. We
// don't have a real-time backend, so the public surface is a no-op.

type Range = { id: string; pos: number; length: number };

export default class RangesTracker {
  changes: Range[] = [];
  comments: Range[] = [];

  track(_op: unknown): void {}
  applyOp(_op: unknown): void {}
  applyOps(_ops: unknown[]): void {}
  removeChangeId(_id: string): void {}
  removeChangeIds(_ids: string[]): void {}
  removeCommentId(_id: string): void {}
  getChange(_id: string) { return null; }
  getComment(_id: string) { return null; }
  getChanges(): Range[] { return this.changes; }
  getComments(): Range[] { return this.comments; }
  getThread(_id: string) { return null; }
  toRaw(): unknown { return { changes: this.changes, comments: this.comments }; }
}
