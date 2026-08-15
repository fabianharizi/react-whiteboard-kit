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
