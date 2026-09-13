import { describe, it, expect } from "vitest"
import defineElement from "./defineElement"

// defineElement is the first engine code a third party ever calls, so its
// throws are part of the public API: they're the error messages someone sees
// when their element type doesn't work. The point of validating here at all is
// to fail at REGISTRATION rather than deep inside a render, where the stack
// trace no longer mentions the definition that caused it.

const ok = { type: "widget", render: () => null }

describe("validation", () => {
  it("rejects anything that isn't a definition object", () => {
    for (const bad of [undefined, null, "widget", 42, () => null]) {
      expect(() => defineElement(bad)).toThrow(/expected a definition object/)
    }
  })

  it("requires a type", () => {
    expect(() => defineElement({ render: () => null })).toThrow(/needs a `type`/)
    expect(() => defineElement({ type: "", render: () => null })).toThrow(/needs a `type`/)
  })

  it("requires render to be a function", () => {
    expect(() => defineElement({ type: "widget" })).toThrow(/`render` must be a function/)
    expect(() => defineElement({ type: "widget", render: "<div/>" })).toThrow(/`render` must be a function/)
  })

  // With several custom types registered at once, "render must be a function"
  // is useless without saying whose.
  it("names the offending type in the render error", () => {
    expect(() => defineElement({ type: "sticky" })).toThrow(/defineElement\(sticky\)/)
  })

  // An array is typeof "object", so it slips past the first guard — it then
  // fails on `type`, which is still a sensible message rather than a crash.
  it("rejects an array on the type check rather than passing it through", () => {
    expect(() => defineElement([])).toThrow(/needs a `type`/)
  })

  it("accepts the minimum viable definition", () => {
    expect(() => defineElement(ok)).not.toThrow()
  })
})

describe("normalisation", () => {
  it("fills in the optional facets so consumers never guard on them", () => {
    const def = defineElement(ok)
    expect(def.bindable).toBe(false)
    expect(def.schema).toEqual([])
    expect(def.defaults).toEqual({})
  })

  it("never overrides what the definition declared", () => {
    const def = defineElement({ ...ok, bindable: true, schema: ["position"], defaults: { a: 1 } })
    expect(def.bindable).toBe(true)
    expect(def.schema).toEqual(["position"])
    expect(def.defaults).toEqual({ a: 1 })
  })

  it("passes the facets it doesn't know about straight through", () => {
    const tool = { icon: () => null, shortcut: "w", create: "box" }
    const connector = { refs: () => [], resolve: () => ({}), bake: () => ({}), rebind: () => ({}) }
    const preview = { strokeStyle: "dashed" }
    const def = defineElement({ ...ok, geometry: "segment", tool, connector, preview })

    expect(def.geometry).toBe("segment")
    expect(def.tool).toBe(tool)
    expect(def.connector).toBe(connector)
    expect(def.preview).toBe(preview)
  })

  it("returns a new object and leaves the caller's input alone", () => {
    const input = { ...ok }
    const def = defineElement(input)
    expect(def).not.toBe(input)
    expect(input.bindable).toBeUndefined()
    expect(input.schema).toBeUndefined()
  })

  // The filled-in blanks must be per-definition. A shared [] or {} across every
  // type would let one definition's mutation surface in an unrelated one.
  it("gives each definition its own empty schema and defaults", () => {
    const a = defineElement({ type: "a", render: () => null })
    const b = defineElement({ type: "b", render: () => null })
    expect(a.schema).not.toBe(b.schema)
    expect(a.defaults).not.toBe(b.defaults)
  })
})
