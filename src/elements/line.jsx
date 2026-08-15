import { MoveUpRight } from "lucide-react"
import Line from "../components/Line/Line"
import defineElement from "./defineElement"
import { resolveLineEndpoints } from "../utils/methods/lineGeometry"

// A connector line. SELF-POSITIONING: its rendered box is the route's bbox —
// arrowheads, curve belly, stroke width — which geometry can't derive, so it
// owns its own <svg> frame and does not use boxFrame. This is the "full custom
// rendering" tier of the render contract, and lines are why that tier exists.
//
// Bound endpoints aren't render-ready in storage; they resolve here against the
// live content (via ctx.lookup) so the line follows its targets by construction.
// The broader connector concern (baking on target delete, remapping on paste)
// still lives outside the definition for now — that's a later consolidation.

export default defineElement({
  type: "line",

  render: (el, ctx) => (
    <Line
      uuid={el.uuid}
      selected={ctx.selected}
      properties={{ ...el.properties, ...resolveLineEndpoints(el.properties, ctx.lookup) }}
    />
  ),

  geometry: "segment",
  bindable: false,

  // Connector facet: a line is defined by its attachments. The engine calls
  // these (wrapped as registry methods in createRegistry.js) instead of ever
  // checking `type === "line"`, to resolve endpoints for rendering/selection and
  // to keep bindings honest across delete and copy/paste. Any future connector
  // type implements the same four methods.
  connector: {
    // Present bindings, as { key, uuid } — what the engine scans and rewrites.
    refs: (p) => [
      ...(p.startBinding ? [{ key: "startBinding", uuid: p.startBinding.uuid }] : []),
      ...(p.endBinding ? [{ key: "endBinding", uuid: p.endBinding.uuid }] : []),
    ],

    // Resolve bound endpoints against `lookup` — the render/effective overlay.
    resolve: (p, lookup) => resolveLineEndpoints(p, lookup),

    // Freeze resolved endpoints into raw coords (a persistable patch), so a line
    // stays put when a binding is dropped instead of snapping to a stale coord.
    bake: (p, lookup) => {
      const r = resolveLineEndpoints(p, lookup)
      return { startX: r.startX, startY: r.startY, endX: r.endX, endY: r.endY }
    },

    // Rewrite bindings: each present target uuid goes through `next`, which
    // returns a replacement uuid, or null to detach that end.
    rebind: (p, next) => {
      const map = (b) => {
        if (!b) return b
        const u = next(b.uuid)
        return u ? { ...b, uuid: u } : null
      }
      return { startBinding: map(p.startBinding), endBinding: map(p.endBinding) }
    },
  },

  defaults: {
    routing: "straight",
    strokeColor: "#ffffff",
    strokeWidth: 2,
    strokeStyle: "solid",
    headStart: "none",
    headEnd: "arrow",
  },

  schema: ["start", "end", "routing", "strokeColor", "strokeWidth", "strokeStyle", "headStart", "headEnd"],

  tool: { icon: MoveUpRight, shortcut: "l", create: "line" },
})
