import { useEffect, useRef, useState } from "react";
import * as ops from "../methods/contentState";
import { emptyHistory, record, travel, canUndo as hasPast, canRedo as hasFuture } from "../methods/history";

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
// WHAT'S LEFT HERE. The state transitions live in methods/contentState.js and
// the undo stack in methods/history.js, both pure and unit-tested. This file is
// only the part that can't be: React state, the live ref mirror, and onChange.
//
// `controlledContent`, when defined, puts the hook in CONTROLLED mode (still
// EXPERIMENTAL): the parent owns content and drives it by passing a new array;
// the hook optimistically mirrors it. Left undefined, the hook is uncontrolled —
// it owns content from `start`.
//
// `onChange(content)` fires on INTERNAL edits only (draws, drags, deletes, undo).
// It is emitted from `apply`, the internal writer — never from the controlled
// sync below — so mirroring the external prop in does NOT echo back out, and a
// parent that clones content in its handler can't spin a feedback loop.
export default function useContent(registry, start, controlledContent = undefined, onChange = undefined){
  const [content, setContent] = useState(start)
  const [selectedElements, setSelectedElements] = useState([])

  // Latest-ref for onChange so an inline callback doesn't need to be stable.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // Mirror of both states, written synchronously by `apply`. Mutations compute
  // the next state from this rather than from the render closure, so several
  // writes landing in one tick each see the previous one's result.
  const live = useRef({ content: start, selection: [] })

  // Nothing renders from the stacks, so they live in a ref — but whether
  // undo/redo is AVAILABLE is rendered (menus, command `enabled`), so that part
  // is state.
  const history = useRef(emptyHistory())
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Reads stay on state, never on the mirror: reading a ref during render is
  // exactly the stale-render trap the mirror exists to avoid elsewhere.
  const hasElement = (uuid) => content.some(el => el.uuid === uuid);

  const getElement = (uuid) => content.find(el => el.uuid === uuid);

  // The single writer for internal edits — keeps the mirror and both states in
  // step, and notifies the consumer when CONTENT changed (a selection-only apply
  // keeps the same content reference, so it doesn't fire onChange).
  const apply = (next) => {
    const contentChanged = next.content !== live.current.content
    live.current = next
    setContent(next.content)
    setSelectedElements(next.selection)
    if (contentChanged) onChangeRef.current?.(next.content)
  }

  // CONTROLLED sync: when the external content prop changes to a new array,
  // mirror it in. Reference-guarded, so the parent feeding our own content back
  // (same array) is a no-op — pass it back as-is. This does NOT go through
  // `apply`: an external replacement is not an internal edit, so it emits no
  // onChange (nothing to echo) and records no undo point. It DOES reset undo
  // history, since the pre-replacement timeline belongs to content the parent
  // has discarded (external replacement is the history-ownership policy in
  // controlled mode).
  useEffect(() => {
    if (controlledContent === undefined || controlledContent === live.current.content) return

    const next = ops.adoptContent(live.current, controlledContent)
    live.current = next
    setContent(next.content)
    setSelectedElements(next.selection)
    history.current = emptyHistory()
    setCanUndo(false)
    setCanRedo(false)
  }, [controlledContent])

  const syncHistoryFlags = () => {
    setCanUndo(hasPast(history.current))
    setCanRedo(hasFuture(history.current))
  }

  // A content edit: record an undo point, then apply. `key` identifies the
  // interaction for coalescing; null means "always its own step".
  const mutate = (key, next) => {
    history.current = record(history.current, key, live.current, performance.now())
    apply(next)
    syncHistoryFlags()
  }

  const addElements = (list) => mutate(null, ops.addElements(live.current, list))

  // Deliberately NOT recorded: selecting isn't an edit, and spending undo steps
  // on clicks would bury the edits the user actually wants back.
  const selectElements = (uuids) => apply(ops.selectElements(live.current, uuids))

  const updateElements = (patches) =>
    mutate(ops.updateKey(patches), ops.updateElements(live.current, patches))

  const deleteElements = (uuids) => mutate(null, ops.deleteElements(live.current, uuids, registry))

  const clearContent = () => mutate(null, ops.clearContent())

  const travelTo = (from, to) => {
    const moved = travel(history.current, from, to, live.current)
    if (!moved) return

    history.current = moved.history
    apply(moved.state)
    syncHistoryFlags()
  }

  const undo = () => travelTo("past", "future")
  const redo = () => travelTo("future", "past")

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
