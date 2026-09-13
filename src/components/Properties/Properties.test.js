// The panel is schema-driven and now reads BOTH its fallback values and its
// position/size behaviour off the element definition, so what's worth pinning is
// that neither is a second source of truth: a path (which stores no corners) and
// a custom type (which the panel has never seen) both have to work.
import { describe, it, expect } from "vitest"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createRegistry, BUILTIN_ELEMENTS } from "../../elements"
import defineElement from "../../elements/defineElement"
import { boxFrame } from "../../elements/frame"
import { RegistryProvider } from "../../elements/RegistryContext"
import Properties from "./Properties"

const widget = defineElement({
  type: "widget",
  geometry: "box",
  defaults: { label: "hello" },
  schema: ["position", "size", { key: "label", label: "Label", type: "textarea" }],
  render: (el) => h("div", boxFrame(el.properties, { uuid: el.uuid })),
})

const registry = createRegistry([...BUILTIN_ELEMENTS, widget])

const panel = (element) => renderToStaticMarkup(
  h(RegistryProvider, { value: registry },
    h(Properties, {
      selectedElements: [element.uuid],
      getElement: (id) => (id === element.uuid ? element : undefined),
      updateElements: () => {},
    }))
)

describe("Properties", () => {
  it("reads a box element's position/size from its corners", () => {
    const html = panel({ type: "rectangle", uuid: "r1", properties: { startX: 10, startY: 20, endX: 110, endY: 120 } })
    expect(html).toContain('value="10"')
    expect(html).toContain('value="20"')
    expect(html).toContain('value="100"')
  })

  // A path stores `points` and no corners at all. Same two fields, because both
  // go through the geometry kind rather than through a shape check.
  it("reads a path's position/size from its points", () => {
    const html = panel({ type: "path", uuid: "p1", properties: { points: [{ x: 10, y: 20 }, { x: 110, y: 120 }] } })
    expect(html).toContain('value="10"')
    expect(html).toContain('value="20"')
    expect(html).toContain('value="100"')
  })

  // rectangle's definition declares fill: "transparent". The panel used to keep
  // its own table saying "#ffffff", and the two silently disagreed.
  it("takes an absent property's value from the definition's defaults", () => {
    const html = panel({ type: "rectangle", uuid: "r2", properties: { startX: 0, startY: 0, endX: 10, endY: 10 } })
    expect(html).toContain("checkbox")                      // nullable fill, shown OFF
    expect(html).not.toContain('value="#ffffff" checked')
  })

  it("renders a custom type's inline field from its defaults", () => {
    const html = panel({ type: "widget", uuid: "w1", properties: { startX: 0, startY: 0, endX: 10, endY: 10 } })
    expect(html).toContain("hello")
  })
})
