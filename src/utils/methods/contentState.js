// The pure state transitions behind useContent. Each takes the current state
// and returns the next one; the hook owns everything these can't be pure about
// — React state, the live ref mirror, the history stack, onChange.
//
// A STATE is { content, selection }: the element array plus the uuid list of
// what's selected. Selection lives in the same value as content because it IS
// the single source of truth for selection — elements carry no `selected` flag
// (encodeContent derives it at render), which is what lets a history snapshot be
// nothing more than one of these.
//
// Everything is PLURAL-ONLY, matching the hook's public API: a single element is
// a one-element array. Every transition treats `content` as immutable and
// replaces only the elements it touches, so an untouched element keeps its
// reference and history snapshots share structure.

// Appends elements and selects exactly them — a draw or a paste becomes the
// active selection. Takes [{ type, uuid, properties }]; anything else on the
// incoming objects is dropped rather than stored.
export function addElements(state, list) {
  const added = list.map(e => ({ type: e.type, uuid: e.uuid, properties: e.properties }))
  return {
    content: [...state.content, ...added],
    selection: added.map(e => e.uuid),
  }
}

// Selects exactly the given uuids (unknown ids are dropped). An empty or absent
// list deselects everything.
//
// Content keeps its IDENTITY here, which is the point: selecting isn't an edit,
// so React skips re-rendering the content tree.
export function selectElements(state, uuids) {
  const known = new Set(state.content.map(el => el.uuid))
  return {
    content: state.content,
    selection: (uuids ?? []).filter(id => known.has(id)),
  }
}

// Merges per-element property patches in one pass. Takes [{ uuid, properties }].
export function updateElements(state, patches) {
  const byId = new Map(patches.map(p => [p.uuid, p.properties]))
  return {
    content: state.content.map(el => {
      const patch = byId.get(el.uuid)
      return patch ? { ...el, properties: { ...el.properties, ...patch } } : el
    }),
    selection: state.selection,
  }
}

// The coalescing key for an update: WHICH elements changed × WHICH fields. Both
// hold constant through a drag or a burst of typing, so the gesture collapses to
// one undo step, while touching a different element or a different property
// opens a new one. Sorted at both levels so the key doesn't depend on the order
// a caller happened to build its patches in.
export function updateKey(patches) {
  return "update:" + patches
    .map(p => p.uuid + ">" + Object.keys(p.properties).sort().join(","))
    .sort()
    .join("|")
}

// Deleting a connector's binding target BAKES the connector first: its resolved
// geometry (computed against the PRE-delete content) is written into the raw
// coords and the dead binding is nulled, so it freezes in place instead of
// dangling or snapping back to its stale fallback. `registry.bakeOnDelete`
// leaves every non-connector — and every connector not bound to a doomed target
// — untouched by identity.
export function deleteElements(state, uuids, registry) {
  const doomed = new Set(uuids)
  const prev = state.content
  const lookup = (uuid) => prev.find(el => el.uuid === uuid)

  return {
    content: prev
      .filter(el => !doomed.has(el.uuid))
      .map(el => registry.bakeOnDelete(el, doomed, lookup)),
    selection: state.selection.filter(id => !doomed.has(id)),
  }
}

export const clearContent = () => ({ content: [], selection: [] })

// CONTROLLED mode: take on content the parent owns. The array is adopted by
// reference (the parent's identity is what the hook compares against) and the
// selection is trimmed to whatever survived, since the parent may have dropped
// elements that were selected.
export function adoptContent(state, content) {
  const known = new Set(content.map(el => el.uuid))
  return {
    content,
    selection: state.selection.filter(id => known.has(id)),
  }
}

// Did the parent replace the document, as opposed to accepting our edit or
// declining it? Three cases have to be told apart, and only the first should
// cost the user their undo history:
//
//   incoming !== synced, !== emitted   the parent set content to something of
//                                      its own — the timeline on the stack
//                                      describes content it has discarded.
//   incoming !== synced, === emitted   the parent accepted the edit we emitted.
//                                      Same timeline, one step further along.
//   incoming === synced                the prop didn't move at all: either
//                                      nothing happened, or the parent DECLINED
//                                      an edit. A veto shouldn't wipe history.
export function isExternalReplacement(incoming, synced, emitted) {
  return incoming !== synced && incoming !== emitted
}
