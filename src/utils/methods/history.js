// A bounded undo/redo stack with interaction coalescing.
//
// Deliberately GENERIC over what a snapshot is: it stores and hands back
// whatever it was given, and never looks inside. useContent happens to store
// { content, selection } pairs, which is cheap there because every mutation is
// an immutable map that replaces only the elements it touches — a snapshot is
// mostly an array of pointers to objects that already exist.
//
// The hard part was never the cost, it's GROUPING. Writes arrive on every
// pointermove of a drag and every keystroke while editing text, so consecutive
// writes that continue the same interaction have to collapse into one undoable
// step. That's what `key` is for.
//
// Every function here is pure: `record` and `travel` return a NEW history rather
// than mutating, and `now` is a parameter rather than a call to the clock, so
// coalescing can be tested without faking timers.

// Consecutive writes with the same coalescing key inside this window collapse
// into one step, so a drag is one Ctrl+Z rather than sixty.
export const COALESCE_MS = 400

// Undo depth. Bounded so a long session can't grow the heap without limit.
export const HISTORY_LIMIT = 100

export const emptyHistory = () => ({ past: [], future: [], key: null, at: 0 })

export const canUndo = (history) => history.past.length > 0
export const canRedo = (history) => history.future.length > 0

// Push `current` as the point undo returns to — unless this write continues the
// same interaction, in which case the entry already on the stack IS that point
// and a second one would only fragment the step.
//
// `key` identifies the interaction; null means "always its own step". Note the
// window is measured from the PREVIOUS write, not from the start of the
// interaction, so a drag of any length stays one step as long as its writes keep
// arriving. Editing after an undo forks the timeline and drops the redo stack.
export function record(history, key, current, now) {
  const continues = key !== null && key === history.key && now - history.at < COALESCE_MS
  if (continues) return { ...history, key, at: now }

  const past = [...history.past, current]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    future: [],
    key,
    at: now,
  }
}

// Move one step along the timeline: pop the source stack, push what we're
// leaving onto the other. Returns null when there's nowhere to go, else the new
// history and the snapshot to restore.
//
// Neither direction records (these ARE the history) and both clear the
// coalescing key, so the next edit opens a fresh step instead of merging into
// the step that was just restored.
export function travel(history, from, to, current) {
  const source = history[from]
  if (!source.length) return null

  return {
    history: {
      ...history,
      [from]: source.slice(0, -1),
      [to]: [...history[to], current],
      key: null,
    },
    state: source[source.length - 1],
  }
}
