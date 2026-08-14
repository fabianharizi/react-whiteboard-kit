import { Circle } from "lucide-react"
import Shape from "../components/Shape/Shape"
import defineElement from "./defineElement"
import { boxFrame } from "./frame"

// An oval. Identical to rectangle but for its `type` (which Shape renders with
// border-radius: 100%) and the absence of a corner-radius field.

export default defineElement({
  type: "oval",

  render: (el, ctx) => (
    <Shape
      type="oval"
      properties={el.properties}
      frame={boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected })}
    />
  ),

  geometry: "box",
  bindable: true,

  defaults: {
    fill: "transparent", strokeColor: "#ffffff", strokeWidth: 2,
    strokeStyle: "solid", opacity: 1, rotation: 0,
  },

  schema: ["position", "size", "rotation", "fill", "strokeColor", "strokeWidth", "strokeStyle", "opacity"],

  tool: { icon: Circle, shortcut: "o", create: "box" },
})
