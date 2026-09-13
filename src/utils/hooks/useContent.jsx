import { useEffect, useRef, useState } from "react";
import * as ops from "../methods/contentState";
import { classifyIncoming } from "../methods/contentState";
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
// `controlledContent`, when defined, puts the hook in CONTROLLED mode: the
// parent owns content, and the prop IS what renders — nothing is copied into
// local state, so the board cannot drift from what the parent says. An edit
// computes the next content and emits it; if the parent doesn't feed it back,
// nothing moves. That's what makes a read-only board, a filtered board, or an
// edit the parent rejects work at all, and it's the same contract as a
// controlled <input> (or React Flow's nodes/onNodesChange).
//
// Left undefined, the hook is uncontrolled and owns content from `start`.
// Switching between the two mid-life isn't supported.
//
// `onChange(content)` fires on INTERNAL edits only (draws, drags, deletes, undo),
// from `apply` — never from the reconciliation below — so content arriving from
// the parent doesn't echo back out and a parent that clones can't loop.
export default function useContent(registry, start, controlledContent = undefined, onChange = undefined){
  const isControlled = controlledContent !== undefined

  // The uncontrolled backing store. Never read while controlled.
  const [ownContent, setOwnContent] = useState(start)

  // In controlled mode the prop is the state. This is the whole of "controlled":
  // there is no second copy that could disagree with the parent.
  const content = isControlled ? controlledContent : ownContent

  // Selection is always the hook's own, in both modes — it's view state, not
  // document state, and a parent driving content shouldn't have to carry it.
  const [selectedElements, setSelectedElements] = useState([])

  // Latest-ref for onChange so an inline callback doesn't need to be stable.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  // Mirror of both states, written synchronously by `apply`. Mutations compute
  // the next state from this rather than from the render closure, so several
  // writes landing in one tick each see the previous one's result.
  //
  // In controlled mode the mirror runs OPTIMISTICALLY ahead of the parent for
  // exactly that reason — and the reconciliation effect below pulls it back to
  // the prop at the end of every render, which is how a declined edit is undone.
  const live = useRef({ content: start, selection: [] })

  // The last content handed to onChange, and the last prop value reconciled.
  // Together they tell an accepted edit from a veto from an outright external
  // replacement (see classifyIncoming).
  const emitted = useRef(null)
  const synced = useRef(controlledContent)

  // The undo stack as it was BEFORE the edit currently awaiting the parent's
  // answer. In controlled mode an edit is a proposal until the parent feeds it
  // back, and that has to include its effect on history — otherwise a declined
  // edit leaves a step behind that undoes to the content already on screen.
  // `record` and `travel` are pure and return new stacks, so the old one is
  // simply still here to put back. Only the first write of a batch saves, so a
  // rejected batch rolls back to before the batch rather than to its last write.
  const pendingHistory = useRef(null)

  // Bumped by `apply` in controlled mode purely to guarantee a render. Without
  // it, a parent that declines an edit changes no state anywhere and React never
  // re-renders — so the effect that rolls the mirror back would never run.
  const [syncTick, setSyncTick] = useState(0)

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

  // The single writer for internal edits — keeps the mirror and the states in
  // step, and notifies the consumer when CONTENT changed (a selection-only apply
  // keeps the same content reference, so it doesn't fire onChange).
  //
  // Controlled mode differs in one line: it does NOT write content to state,
  // because the prop is the state. It emits, and the parent decides.
  const apply = (next) => {
    const contentChanged = next.content !== live.current.content
    live.current = next
    setSelectedElements(next.selection)

    if (!contentChanged) return

    emitted.current = next.content
    if (isControlled) setSyncTick(t => t + 1)
    else setOwnContent(next.content)
    onChangeRef.current?.(next.content)
  }

  const syncHistoryFlags = () => {
    setCanUndo(hasPast(history.current))
    setCanRedo(hasFuture(history.current))
  }

  // CONTROLLED reconciliation. Runs after every render that could have moved
  // what the parent is showing us, and leaves the mirror agreeing with the prop.
  //
  // This is the one place a declined edit is rolled back: `apply` let the mirror
  // run ahead so writes in the same tick could chain off each other, and here the
  // parent's actual answer overrides it. Deliberately does NOT go through
  // `apply` — content arriving from the parent is not an internal edit, so it
  // emits no onChange and records no undo point.
  useEffect(() => {
    if (!isControlled) return

    // What the parent did with the last thing we emitted decides what happens to
    // the undo stack. Only "accepted" leaves it alone.
    switch (classifyIncoming(content, synced.current, emitted.current)) {
      case "replaced":
        // The stack describes a document the parent has thrown away.
        history.current = emptyHistory()
        pendingHistory.current = null
        setCanUndo(false)
        setCanRedo(false)
        break

      case "declined":
        // The edit never happened, so neither did its history entry. Without
        // this, rejecting an edit left a step that undid to the content already
        // on screen — a no-op Ctrl+Z — and a read-only board slowly filled its
        // undo stack with them.
        if (pendingHistory.current !== null) {
          history.current = pendingHistory.current
          pendingHistory.current = null
          syncHistoryFlags()
        }
        break

      default:
        pendingHistory.current = null
    }
    synced.current = content

    // Adopt the prop and drop any selection it no longer contains. Trimming only
    // ever shortens, so a length change is enough to detect it.
    const before = live.current
    live.current = ops.adoptContent(before, content)
    if (live.current.selection.length !== before.selection.length) {
      setSelectedElements(live.current.selection)
    }
  }, [content, syncTick, isControlled])

  // Move the stack to `next`, remembering where it was so controlled mode can
  // put it back if the parent declines the edit that caused the move. In
  // uncontrolled mode there's nobody to decline, so it just commits.
  const proposeHistory = (next) => {
    if (isControlled && pendingHistory.current === null) pendingHistory.current = history.current
    history.current = next
  }

  // A content edit: record an undo point, then apply. `key` identifies the
  // interaction for coalescing; null means "always its own step".
  const mutate = (key, next) => {
    proposeHistory(record(history.current, key, live.current, performance.now()))
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

    proposeHistory(moved.history)
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
