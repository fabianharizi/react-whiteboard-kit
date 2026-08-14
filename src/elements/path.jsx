import { PenTool } from "lucide-react"
import Path from "../components/Path/Path"
import defineElement from "./defineElement"

// Freehand ink. Self-positioning like line, for the same reason: its box is the
// stroke's point bounds, emitted bbox-relative inside its own <svg>. Bakes
// rotation into its points, so it has no rotation field.

export default defineElement({
  type: "path",

  render: (el, ctx) => (
    <Path uuid={el.uuid} selected={ctx.selected} properties={el.properties} />
  ),

  geometry: "path",
  bindable: false,

  schema: ["position", "size", "strokeColor", "strokeWidth", "strokeStyle", "opacity"],

  tool: { icon: PenTool, shortcut: "p", create: "pen" },
})
