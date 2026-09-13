import { Square } from "lucide-react"
import Shape from "../components/Shape/Shape"
import defineElement from "./defineElement"
import { boxFrame } from "./frame"
import { GHOST } from "./preview"

// A rectangle. Shares the Shape component (and everything else) with oval — the
// two differ only by `type`, which Shape maps to a class. Box geometry, so it
// renders through the engine's positioning frame and never touches coordinates.

export default defineElement({
  type: "rectangle",

  render: (el, ctx) => (
    <Shape
      type="rectangle"
      properties={el.properties}
      frame={boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected })}
    />
  ),

  geometry: "box",
  bindable: true,

  defaults: {
    fill: "transparent", strokeColor: "#ffffff", strokeWidth: 2,
    strokeStyle: "solid", borderRadius: 0, opacity: 1, rotation: 0,
  },

  schema: ["position", "size", "rotation", "fill", "strokeColor", "strokeWidth", "strokeStyle", "borderRadius", "opacity"],

  // Drawn as a dashed outline rather than a solid shape, so a box being dragged
  // out reads as pending rather than placed.
  preview: { ...GHOST, fill: "transparent" },

  tool: { icon: Square, shortcut: "r", create: "box" },
})
