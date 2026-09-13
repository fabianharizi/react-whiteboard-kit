import { PenTool } from "lucide-react"
import Path from "../components/Path/Path"
import defineElement from "./defineElement"
import { GHOST } from "./preview"

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

  defaults: {
    strokeColor: "#ffffff",
    strokeWidth: 2,
    strokeStyle: "solid",
    opacity: 1,
  },

  schema: ["position", "size", "strokeColor", "strokeWidth", "strokeStyle", "opacity"],

  // Ink previews SOLID where the other ghosts are dashed: the pen's ghost is the
  // stroke itself rather than an outline around it, and a dashed freehand line
  // reads as a rendering fault.
  preview: { ...GHOST, strokeStyle: "solid" },

  tool: { icon: PenTool, shortcut: "p", create: "pen" },
})
