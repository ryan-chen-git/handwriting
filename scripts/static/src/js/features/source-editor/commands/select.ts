import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState, StateCommand } from '@codemirror/state'
import { SearchCursor } from '@codemirror/search'

// Upstream's selectWord is internal to @codemirror/search. Replacement:
// expand the selection to the word at the cursor using public APIs.
const selectWord: StateCommand = ({ state, dispatch }) => {
  const ranges = state.selection.ranges.map(r => {
    if (r.empty) {
      const word = state.wordAt(r.head)
      return word ?? r
    }
    return r
  })
  if (ranges.every((r, i) => r.eq(state.selection.ranges[i]))) return false
  dispatch(state.update({ selection: EditorSelection.create(ranges) }))
  return true
}

export { selectNextOccurrence } from '@codemirror/search'

// Upstream uses an internal `StringQuery` class from @codemirror/search.
// Replace with the public SearchCursor (literal-string mode), iterating to
// find the last match before the current selection.
const findPrevOccurence = (state: EditorState, search: string) => {
  const { from } = state.selection.main
  const cursor = new SearchCursor(state.doc, search, 0, from)
  let last: { from: number; to: number } | null = null
  while (!cursor.next().done) {
    last = { from: cursor.value.from, to: cursor.value.to }
  }
  return last
}

export const selectPrevOccurrence: StateCommand = ({ state, dispatch }) => {
  const { ranges } = state.selection

  if (ranges.some(range => range.from === range.to)) {
    return selectWord({ state, dispatch })
  }

  const searchedText = state.sliceDoc(ranges[0].from, ranges[0].to)

  if (
    state.selection.ranges.some(
      range => state.sliceDoc(range.from, range.to) !== searchedText
    )
  ) {
    return false
  }

  const range = findPrevOccurence(state, searchedText)
  if (!range) {
    return false
  }

  dispatch(
    state.update({
      selection: state.selection.addRange(
        EditorSelection.range(range.from, range.to)
      ),
      effects: EditorView.scrollIntoView(range.to),
    })
  )

  return true
}
