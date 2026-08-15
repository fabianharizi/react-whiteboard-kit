import { elementOf } from "./index"

// Engine-side connector operations, built on the `connector` facet a definition
// declares (see line.jsx). These are what let the rest of the app stop checking
// `type === "line"`: a call site asks "resolve this element", "bake it if a
// target died", "snapshot/remap its bindings" and a non-connector simply passes
// through. A second connector type (a routed edge, say) works everywhere the
// moment its definition carries the facet.

const connectorOf = (el) => elementOf(el)?.connector ?? null

// Render-ready properties: a connector's endpoints resolved against `lookup`,
// everything else untouched. Non-connectors pass their properties through.
export function effectiveProperties(el, lookup) {
  const c = connectorOf(el)
  return c ? { ...el.properties, ...c.resolve(el.properties, lookup) } : el.properties
}

// The element carrying its effective properties — for the paths where a whole
// `el` flows on (Board feeding the SelectionBox its effective geometry).
export function resolveElement(el, lookup) {
  const c = connectorOf(el)
  return c ? { ...el, properties: { ...el.properties, ...c.resolve(el.properties, lookup) } } : el
}

// Deleting `doomed`: if this connector binds to a doomed target, bake its
// geometry and drop the dead bindings, so it freezes in place instead of
// dangling or snapping to a stale fallback. Unaffected elements return as-is.
export function bakeOnDelete(el, doomed, lookup) {
  const c = connectorOf(el)
  if (!c || !c.refs(el.properties).some(r => doomed.has(r.uuid))) return el
  return {
    ...el,
    properties: {
      ...el.properties,
      ...c.bake(el.properties, lookup),
      ...c.rebind(el.properties, (uuid) => (doomed.has(uuid) ? null : uuid)),
    },
  }
}

// Copy snapshot: bake resolved geometry and keep a binding only when its target
// is also in the copied set (`kept`) — a connector copied without its target
// pastes detached at its current position, never silently bound to the original.
// Returns a properties patch to merge, or null for a non-connector.
export function snapshotConnector(el, kept, lookup) {
  const c = connectorOf(el)
  if (!c) return null
  return {
    ...c.bake(el.properties, lookup),
    ...c.rebind(el.properties, (uuid) => (kept.has(uuid) ? uuid : null)),
  }
}

// Paste/duplicate: remap a spawned connector's bindings onto the batch's freshly
// minted uuids (`minted`: source uuid → new uuid); a binding whose target wasn't
// part of the batch drops. Returns a properties patch, or null for a non-connector.
export function remapConnector(item, minted) {
  const c = connectorOf(item)
  if (!c) return null
  return c.rebind(item.properties, (uuid) => (minted.has(uuid) ? minted.get(uuid) : null))
}
