import { describe, it, expect } from "vitest"
import { createRegistry } from "./createRegistry"
import { BUILTIN_ELEMENTS, registry as defaultRegistry } from "./index"
import defineElement from "./defineElement"
import box from "../utils/geometry/box"
import pathKind from "../utils/geometry/path"

// The registry is the engine's type system. What's worth pinning here is the
// part no geometry test can reach: behaviour with types the engine has never
// seen. `geometryOf`'s dispatch over the BUILT-IN types is already covered in
// utils/geometry/kinds.test.js — this file covers custom registration, the
// isolation claim, and the connector ops (which had no coverage at all).

// A third-party box type.
const widget = defineElement({
  type: "widget",
  geometry: "box",
  bindable: true,
  schema: ["position"],
  defaults: { label: "hi" },
  render: () => null,
  tool: { icon: () => null, shortcut: "w", create: "box" },
})

// A type with no creation affordance — it can exist on the canvas (pasted,
// loaded from a document) without being drawable from the toolbar.
const plain = defineElement({ type: "plain", render: () => null })

// A CUSTOM connector, deliberately shaped nothing like `line`: one binding
// instead of two, and a property named `anchorTo` rather than startBinding /
// endBinding. If the registry's connector ops are genuinely facet-driven, they
// work on this without knowing anything about it.
const noodle = defineElement({
  type: "noodle",
  geometry: "segment",
  render: () => null,
  connector: {
    refs: (p) => (p.anchorTo ? [{ key: "anchorTo", uuid: p.anchorTo }] : []),
    resolve: (p, lookup) => {
      const target = p.anchorTo ? lookup(p.anchorTo) : undefined
      return target ? { endX: target.properties.startX, endY: target.properties.startY } : {}
    },
    bake: (p, lookup) => {
      const target = p.anchorTo ? lookup(p.anchorTo) : undefined
      return target ? { endX: target.properties.startX, endY: target.properties.startY } : {}
    },
    rebind: (p, next) => ({ anchorTo: p.anchorTo ? next(p.anchorTo) : null }),
  },
})

const registry = createRegistry([...BUILTIN_ELEMENTS, widget, plain, noodle])

// A 100×100 rectangle at the origin. Its side midpoints — the anchors a bound
// endpoint glues to — are left (0,50), right (100,50), top (50,0), bottom (50,100).
const rect = { type: "rectangle", uuid: "r", properties: { startX: 0, startY: 0, endX: 100, endY: 100 } }
const other = { type: "rectangle", uuid: "s", properties: { startX: 200, startY: 200, endX: 300, endY: 300 } }

// A line whose END is bound to the rectangle's left side. Its stored endX/endY
// are deliberately WRONG (nowhere near the anchor), because a bound end's stored
// coords are only a fallback — every assertion below that reads 0,50 is proving
// the resolver ran rather than the cache being read.
const line = {
  type: "line",
  uuid: "l",
  properties: { startX: 5, startY: 5, endX: 7, endY: 7, startBinding: null, endBinding: { uuid: "r", side: "left" } },
}

const lookup = (uuid) => [rect, other, line].find(el => el.uuid === uuid)

describe("registration and lookup", () => {
  it("resolves a definition from an element, and from a bare type", () => {
    expect(registry.elementOf(rect)).toBe(registry.definitionOf("rectangle"))
    expect(registry.definitionOf("widget")).toBe(widget)
  })

  it("returns null rather than throwing on anything unregistered", () => {
    expect(registry.elementOf({ type: "nope" })).toBe(null)
    expect(registry.elementOf({})).toBe(null)
    expect(registry.elementOf(undefined)).toBe(null)
    expect(registry.definitionOf("nope")).toBe(null)
  })

  // Properties maps over this, so [] rather than undefined is load-bearing:
  // an unknown type must render an empty panel, not crash the app.
  it("gives an unknown type an empty schema, not undefined", () => {
    expect(registry.schemaOf("nope")).toEqual([])
    expect(registry.schemaOf("widget")).toEqual(["position"])
  })
})

describe("registry isolation", () => {
  // The headline claim of making the registry a value instead of a module global.
  it("keeps custom types out of other registries", () => {
    const bare = createRegistry(BUILTIN_ELEMENTS)
    expect(bare.definitionOf("widget")).toBe(null)
    expect(registry.definitionOf("widget")).toBe(widget)
  })

  it("never leaks a custom type into the default registry", () => {
    createRegistry([...BUILTIN_ELEMENTS, widget])
    expect(defaultRegistry.definitionOf("widget")).toBe(null)
    expect(defaultRegistry.bindable.has("widget")).toBe(false)
  })
})

describe("bindable", () => {
  it("is derived from the definitions, not a hardcoded allowlist", () => {
    expect(registry.bindable.has("rectangle")).toBe(true)
    expect(registry.bindable.has("oval")).toBe(true)
    expect(registry.bindable.has("text")).toBe(true)
    expect(registry.bindable.has("widget")).toBe(true)
  })

  // A connector binding to a connector is the loop this prevents.
  it("excludes the connector types", () => {
    expect(registry.bindable.has("line")).toBe(false)
    expect(registry.bindable.has("path")).toBe(false)
  })

  it("defaults to false when a definition doesn't declare it", () => {
    expect(registry.bindable.has("plain")).toBe(false)
  })
})

describe("geometry dispatch for custom types", () => {
  it("resolves a custom type's declared kind by name", () => {
    expect(registry.geometryOf({ type: "noodle" }).storesRotation).toBe(false)
    expect(registry.geometryOf({ type: "widget" })).toBe(box)
  })

  it("lets a custom type reuse the path kind", () => {
    const inky = defineElement({ type: "inky", geometry: "path", render: () => null })
    expect(createRegistry([inky]).geometryOf({ type: "inky" })).toBe(pathKind)
  })

  // Documented as a SILENT fallback: forgetting `geometry` writes corner patches
  // onto an element that may have no corners.
  it("falls back to box when a definition omits geometry", () => {
    expect(registry.geometryOf({ type: "plain" })).toBe(box)
  })
})

describe("connector ops: resolve", () => {
  it("overlays a bound endpoint onto the stored properties", () => {
    const p = registry.effectiveProperties(line, lookup)
    expect(p.endX).toBe(0)
    expect(p.endY).toBe(50)
    expect(p.startX).toBe(5)          // the unbound end is left alone
  })

  it("returns a non-connector's properties untouched", () => {
    expect(registry.effectiveProperties(rect, lookup)).toBe(rect.properties)
    expect(registry.resolveElement(rect, lookup)).toBe(rect)
  })

  it("resolveElement returns a new element and never mutates the original", () => {
    const resolved = registry.resolveElement(line, lookup)
    expect(resolved).not.toBe(line)
    expect(resolved.properties.endX).toBe(0)
    expect(line.properties.endX).toBe(7)
  })
})

describe("connector ops: bakeOnDelete", () => {
  it("leaves a non-connector alone", () => {
    expect(registry.bakeOnDelete(rect, new Set(["x"]), lookup)).toBe(rect)
  })

  // Identity matters, not just equality: useContent maps this over the whole
  // content array on every delete, and an unchanged element must keep its
  // reference or every snapshot stops sharing structure.
  it("leaves a connector alone when none of its targets are doomed", () => {
    expect(registry.bakeOnDelete(line, new Set(["s"]), lookup)).toBe(line)
  })

  it("freezes the resolved coords in and detaches the dead binding", () => {
    const baked = registry.bakeOnDelete(line, new Set(["r"]), lookup)
    expect(baked.properties.endX).toBe(0)         // where it was RENDERING...
    expect(baked.properties.endY).toBe(50)
    expect(baked.properties.endBinding).toBe(null)  // ...not where it was stored
    expect(baked.properties.startX).toBe(5)
  })

  it("keeps a surviving binding when the other end's target dies", () => {
    const both = {
      ...line,
      properties: { ...line.properties, startBinding: { uuid: "s", side: "top" } },
    }
    const baked = registry.bakeOnDelete(both, new Set(["r"]), lookup)
    expect(baked.properties.endBinding).toBe(null)
    expect(baked.properties.startBinding).toEqual({ uuid: "s", side: "top" })
  })
})

describe("connector ops: copy and paste", () => {
  it("has nothing to snapshot for a non-connector", () => {
    expect(registry.snapshotConnector(rect, new Set(["r"]), lookup)).toBe(null)
    expect(registry.remapConnector(rect, new Map())).toBe(null)
  })

  it("keeps a binding whose target is copied too", () => {
    const patch = registry.snapshotConnector(line, new Set(["l", "r"]), lookup)
    expect(patch.endBinding).toEqual({ uuid: "r", side: "left" })
  })

  // A connector copied WITHOUT its target must paste detached — silently staying
  // bound to the original would tie the copy to a shape the user didn't copy.
  it("drops a binding whose target was left behind, baking where it rendered", () => {
    const patch = registry.snapshotConnector(line, new Set(["l"]), lookup)
    expect(patch.endBinding).toBe(null)
    expect(patch.endX).toBe(0)
    expect(patch.endY).toBe(50)
  })

  it("remaps a kept binding onto the uuid minted for the copy", () => {
    const patch = registry.remapConnector(line, new Map([["r", "r-copy"]]))
    expect(patch.endBinding).toEqual({ uuid: "r-copy", side: "left" })
  })

  it("detaches at spawn when the target wasn't minted", () => {
    expect(registry.remapConnector(line, new Map()).endBinding).toBe(null)
  })
})

// The reason the connector facet exists rather than a `type === "line"` check.
describe("connector ops on a CUSTOM connector type", () => {
  const noodleEl = { type: "noodle", uuid: "n", properties: { startX: 1, startY: 1, endX: 2, endY: 2, anchorTo: "r" } }

  it("resolves through the custom facet", () => {
    expect(registry.effectiveProperties(noodleEl, lookup).endX).toBe(0)
  })

  it("bakes and detaches its own binding property", () => {
    const baked = registry.bakeOnDelete(noodleEl, new Set(["r"]), lookup)
    expect(baked.properties.endX).toBe(0)
    expect(baked.properties.anchorTo).toBe(null)
  })

  it("survives copy/paste remapping", () => {
    expect(registry.snapshotConnector(noodleEl, new Set(["n", "r"]), lookup).anchorTo).toBe("r")
    expect(registry.snapshotConnector(noodleEl, new Set(["n"]), lookup).anchorTo).toBe(null)
    expect(registry.remapConnector(noodleEl, new Map([["r", "r2"]])).anchorTo).toBe("r2")
  })
})

describe("toolset", () => {
  it("puts the navigation tools first, ahead of the element tools", () => {
    expect(registry.toolset[0].map(t => t.id)).toEqual(["select", "move"])
  })

  it("derives element tools from the definitions that declare one", () => {
    const ids = registry.toolset[1].map(t => t.id)
    expect(ids).toContain("rectangle")
    expect(ids).toContain("widget")
    expect(ids).not.toContain("plain")      // no `tool` facet
    expect(ids).not.toContain("noodle")
  })

  it("carries each tool's shortcut through for useShortcuts to bind", () => {
    expect(registry.toolset[1].find(t => t.id === "widget").shortcut).toBe("w")
  })
})
