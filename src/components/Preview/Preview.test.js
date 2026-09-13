// The drag ghost dispatches through the element registry, so the behaviour that
// matters most here is one no geometry test can reach: a type the engine has
// never heard of still gets a ghost. These render to static markup rather than
// to a DOM — no jsdom, so they run in the suite's existing `node` environment.
import { describe, it, expect } from "vitest"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createRegistry, BUILTIN_ELEMENTS } from "../../elements"
import defineElement from "../../elements/defineElement"
import { boxFrame } from "../../elements/frame"
import { RegistryProvider } from "../../elements/RegistryContext"
import sticky from "../../elements/sticky"
import Preview from "./Preview"

// A third-party type, declaring NO preview facet — the WYSIWYG fallback case.
const widget = defineElement({
  type: "widget",
  geometry: "box",
  defaults: { label: "hello" },
  render: (el, ctx) => h("div", {
    ...boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected }),
    className: "widget",
  }, el.properties.label),
})

const registry = createRegistry([...BUILTIN_ELEMENTS, sticky, widget])

const preview = (props) => renderToStaticMarkup(
  h(RegistryProvider, { value: registry },
    h(Preview, { startX: 0, startY: 0, endX: 100, endY: 50, ...props }))
)

describe("Preview", () => {
  it("draws a box type's ghost dashed", () => {
    const html = preview({ mode: "rectangle" })
    expect(html).toContain("--strokeStyle:dashed")
    expect(html).toContain("--fill:transparent")
  })

  it("previews text as its box, not as rendered text", () => {
    const html = preview({ mode: "text" })
    expect(html).toContain("--strokeStyle:dashed")
    expect(html).not.toContain("Lorem ipsum")
  })

  it("draws ink solid — a dashed freehand stroke reads as a fault", () => {
    const html = preview({ mode: "path", points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })
    expect(html).toContain("<svg")
    expect(html).not.toContain("stroke-dasharray")
  })

  it("draws a line ghost through the line component", () => {
    const html = preview({ mode: "line" })
    expect(html).toContain("<svg")
    expect(html).toContain("<path")
  })

  // The point of the facet: no engine file mentions `widget`.
  it("gives an unknown custom type a WYSIWYG ghost from its own render", () => {
    const html = preview({ mode: "widget" })
    expect(html).toContain('class="widget"')
    expect(html).toContain("hello")
  })

  it("previews a custom type with no override as the element itself", () => {
    expect(preview({ mode: "sticky" })).toContain("--color:#ffe066")
  })

  it("still draws the marquee, which is chrome rather than an element", () => {
    expect(preview({ mode: "select" })).toContain("--fill:#0088aa20")
  })

  it("renders nothing for a mode with no definition behind it", () => {
    expect(preview({ mode: "nope" })).toBe("")
  })

  // A ghost carrying data-uuid would be hit-testable and selectable mid-draw.
  it("never puts data-uuid on a ghost", () => {
    for (const mode of ["rectangle", "oval", "text", "line", "path", "sticky", "widget", "select"]) {
      expect(preview({ mode, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).not.toContain("data-uuid")
    }
  })
})
