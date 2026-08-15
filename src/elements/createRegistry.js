import { MousePointer2, Hand } from "lucide-react"
import box from "../utils/geometry/box"
import segment from "../utils/geometry/segment"
import path from "../utils/geometry/path"

// A registry is an isolated element-type environment: everything the engine
// needs to know about "what types exist and how to treat one" hangs off the
// object this factory returns. Because it's a value, not a module global, each
// <Whiteboard> can own a different one — its built-ins plus whatever custom types
// the consumer passed. The built-ins go in the same list a consumer's types do.
//
// Components read the registry from RegistryContext; the pure helpers (geometry
// dispatch, connector ops) are METHODS on it, so a hook or utility that has the
// registry can call them without a module-level global. The geometry KINDS and
// all coordinate math stay free functions — they operate on `properties`, not on
// the type set, so they don't belong to any one registry.

const KINDS = { box, segment, path }

// Navigation tools aren't element types (they change interaction, not content),
// so they're constant across every registry; the element tools are derived from
// the definitions below.
const NAVIGATION = [
  { id: "select", icon: MousePointer2, shortcut: "v" },
  { id: "move", icon: Hand, shortcut: "h", momentary: " " },
]

export function createRegistry(definitions) {
  const DEFINITIONS = definitions
  const byType = new Map(definitions.map(d => [d.type, d]))

  const elementOf = (el) => byType.get(el?.type) ?? null
  const definitionOf = (type) => byType.get(type) ?? null
  const schemaOf = (type) => byType.get(type)?.schema ?? []
  const bindable = new Set(definitions.filter(d => d.bindable).map(d => d.type))

  // --- geometry dispatch: type → kind, plus the element-aware helpers on top ---
  const geometryOf = (el) => KINDS[definitionOf(el?.type)?.geometry ?? "box"]
  const rawCorners = (el) => geometryOf(el).unrotatedCorners(el.properties)
  const cornersOf = (el) => geometryOf(el).corners(el.properties)
  const boundsOf = (elements, rotated = true) => {
    const points = elements.flatMap(el => (rotated ? cornersOf(el) : rawCorners(el)))
    const xs = points.map(p => p.x)
    const ys = points.map(p => p.y)
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys),
    }
  }

  // --- connector ops: built on each definition's optional `connector` facet ---
  const connectorOf = (el) => elementOf(el)?.connector ?? null

  const effectiveProperties = (el, lookup) => {
    const c = connectorOf(el)
    return c ? { ...el.properties, ...c.resolve(el.properties, lookup) } : el.properties
  }
  const resolveElement = (el, lookup) => {
    const c = connectorOf(el)
    return c ? { ...el, properties: { ...el.properties, ...c.resolve(el.properties, lookup) } } : el
  }
  const bakeOnDelete = (el, doomed, lookup) => {
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
  const snapshotConnector = (el, kept, lookup) => {
    const c = connectorOf(el)
    if (!c) return null
    return {
      ...c.bake(el.properties, lookup),
      ...c.rebind(el.properties, (uuid) => (kept.has(uuid) ? uuid : null)),
    }
  }
  const remapConnector = (item, minted) => {
    const c = connectorOf(item)
    if (!c) return null
    return c.rebind(item.properties, (uuid) => (minted.has(uuid) ? minted.get(uuid) : null))
  }

  // --- toolbar tools ---
  const toolset = [
    NAVIGATION,
    DEFINITIONS.filter(d => d.tool).map(d => ({
      id: d.type,
      icon: d.tool.icon,
      shortcut: d.tool.shortcut,
    })),
  ]

  return {
    DEFINITIONS,
    elementOf, definitionOf, schemaOf, bindable,
    geometryOf, rawCorners, cornersOf, boundsOf,
    effectiveProperties, resolveElement, bakeOnDelete, snapshotConnector, remapConnector,
    toolset,
  }
}
