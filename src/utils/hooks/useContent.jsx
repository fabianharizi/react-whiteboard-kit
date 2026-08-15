import { useEffect, useRef, useState } from "react";

// This hook is used to keep track of the contents of the canvas.
//
// Selection is uniformly MULTI: `selectedElements` is an array of uuids and
// every operation takes an array — a single element is just a selection of
// length 1. There are deliberately no singular variants.
//
// `selectedElements` is the ONLY source of truth for selection. Elements do not
// carry a `selected` flag; encodeContent derives it at render. That's what lets
// history store plain content — a snapshot can't disagree with itself about what
// was selected.
//
// UNDO/REDO. `past`/`future` hold whole {content, selection} snapshots. That is
// cheap here because every mutation is an immutable map that replaces only the
// elements it touches, so a snapshot is mostly an array of pointers to objects
// that already exist (~1KB per entry on a 100-element board, and pushing one
// costs ~0.2% of the update that produced it). What history does need is
// GROUPING: updateElements fires on every pointermove of a drag and on every
// keystroke while editing text, so writes that continue the same interaction
// coalesce into a single undoable step.

// Consecutive writes with the same coalescing key inside this window collapse
// into one step, so a drag is one Ctrl+Z rather than sixty.
const COALESCE_MS = 400

// Undo depth. Bounded so a long session can't grow the heap without limit.
const HISTORY_LIMIT = 100

// `controlledContent`, when defined, puts the hook in CONTROLLED mode: the
// parent owns content and drives it by passing a new array; the hook mirrors it
// (and still reports its own edits outward through the consumer's onChange).
// Left undefined, the hook is uncontrolled — it owns content from `start`.
export default function useContent(registry, start, controlledContent = undefined){
  const [content, setContent] = useState(start)
  const [selectedElements, setSelectedElements] = useState([])

  // Mirror of both states, written synchronously by `apply`. Mutations compute
  // the next state from this rather than from the render closure, so several
  // writes landing in one tick each see the previous one's result.
  const live = useRef({ content: start, selection: [] })

  // The stacks hold PRE-change snapshots; `key`/`at` drive coalescing. Nothing
  // renders from the stacks, so they live in a ref — but whether undo/redo is
  // available IS rendered (menus, command `enabled`), so that part is state.
  const history = useRef({ past: [], future: [], key: null, at: 0 })
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Reads stay on state, never on the mirror: reading a ref during render is
  // exactly the stale-render trap the mirror exists to avoid elsewhere.
  const hasElement = (uuid) => content.some(el => el.uuid === uuid);

  const getElement = (uuid) => content.find(el => el.uuid === uuid);

  // The single writer — keeps the mirror and both states in step.
  const apply = (next) => {
    live.current = next
    setContent(next.content)
    setSelectedElements(next.selection)
  }

  // CONTROLLED sync: when the external content prop changes to a new array,
  // mirror it in. Reference-guarded, so the parent echoing our own onChange back
  // (same array) is a no-op — pass the content back as-is. Selection is trimmed
  // to survivors; deliberately NOT recorded, since in controlled mode the parent
  // owns the timeline. Inlines `apply` so the effect's only dep is the prop.
  useEffect(() => {
    if (controlledContent === undefined || controlledContent === live.current.content) return
    const known = new Set(controlledContent.map(el => el.uuid))
    const next = { content: controlledContent, selection: live.current.selection.filter(id => known.has(id)) }
    live.current = next
    setContent(next.content)
    setSelectedElements(next.selection)
  }, [controlledContent])

  const syncHistoryFlags = () => {
    setCanUndo(history.current.past.length > 0)
    setCanRedo(history.current.future.length > 0)
  }

  // Push the CURRENT state as the point undo returns to — unless this write
  // continues the same interaction, in which case the entry already on the
  // stack is that point and a second one would only fragment the step.
  const record = (key) => {
    const h = history.current
    const now = performance.now()
    const continues = key !== null && key === h.key && now - h.at < COALESCE_MS

    h.key = key
    h.at = now
    if (continues) return

    h.past.push(live.current)
    if (h.past.length > HISTORY_LIMIT) h.past.shift()
    h.future = []                 // editing after an undo forks the timeline
  }

  // A content edit: record an undo point, then apply. `key` identifies the
  // interaction for coalescing; null means "always its own step".
  const mutate = (key, next) => {
    record(key)
    apply(next)
    syncHistoryFlags()
  }

  // Appends elements and selects exactly them — a draw or a paste becomes the
  // active selection. Takes [{ type, uuid, properties }].
  const addElements = (list) => {
    const added = list.map(e => ({ type: e.type, uuid: e.uuid, properties: e.properties }))
    mutate(null, {
      content: [...live.current.content, ...added],
      selection: added.map(e => e.uuid),
    })
  }

  // Selects exactly the given uuids (unknown ids are dropped). An empty or
  // absent list deselects everything.
  //
  // Deliberately NOT recorded: selecting isn't an edit, and spending undo steps
  // on clicks would bury the edits the user actually wants back. Content keeps
  // its identity here, so React skips re-rendering it.
  const selectElements = (uuids) => {
    const known = new Set(live.current.content.map(el => el.uuid))
    apply({
      content: live.current.content,
      selection: (uuids ?? []).filter(id => known.has(id)),
    })
  }

  // Merges per-element property patches in one state pass.
  // Takes [{ uuid, properties }].
  const updateElements = (patches) => {
    const byId = new Map(patches.map(p => [p.uuid, p.properties]))

    // Coalesce on which elements changed and which fields — both hold constant
    // through a drag or a burst of typing, so the gesture is one step, while
    // touching a different element or property starts a new one.
    const key = "update:" + patches
      .map(p => p.uuid + ">" + Object.keys(p.properties).sort().join(","))
      .sort()
      .join("|")

    mutate(key, {
      content: live.current.content.map(el => {
        const patch = byId.get(el.uuid)
        return patch ? { ...el, properties: { ...el.properties, ...patch } } : el
      }),
      selection: live.current.selection,
    })
  }

  // Deleting a connector's binding target BAKES the connector first: its resolved
  // geometry (computed against the pre-delete content) is written into the raw
  // coords and the dead binding is nulled, so it freezes in place instead of
  // dangling or snapping to its stale fallback. bakeOnDelete leaves every
  // non-connector — and every connector not bound to a doomed target — untouched.
  const deleteElements = (uuids) => {
    const doomed = new Set(uuids)
    const prev = live.current.content
    const lookup = (uuid) => prev.find(el => el.uuid === uuid)

    mutate(null, {
      content: prev
        .filter(el => !doomed.has(el.uuid))
        .map(el => registry.bakeOnDelete(el, doomed, lookup)),
      selection: live.current.selection.filter(id => !doomed.has(id)),
    })
  }

  const clearContent = () => {
    mutate(null, { content: [], selection: [] })
  }

  // Move one step along the timeline: pop the source stack, push what we're
  // leaving onto the other. Neither records (these ARE the history) and both
  // clear the coalescing key, so the next edit opens a fresh step instead of
  // merging into the restored one.
  const travel = (from, to) => {
    const h = history.current
    if (!h[from].length) return

    const entry = h[from].pop()
    h[to].push(live.current)
    h.key = null
    apply(entry)
    syncHistoryFlags()
  }

  const undo = () => travel("past", "future")
  const redo = () => travel("future", "past")

  return {
    "content": content,
    "selectedElements": selectedElements,
    "hasElement": hasElement,
    "getElement": getElement,
    "addElements": addElements,
    "selectElements": selectElements,
    "updateElements": updateElements,
    "deleteElements": deleteElements,
    "clearContent": clearContent,
    "undo": undo,
    "redo": redo,
    "canUndo": canUndo,
    "canRedo": canRedo
  };
}
