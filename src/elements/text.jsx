import { TypeIcon } from "lucide-react"
import Text from "../components/Text/Text"
import Shape from "../components/Shape/Shape"
import defineElement from "./defineElement"
import { boxFrame } from "./frame"
import { GHOST } from "./preview"

// Editable text. The hardest built-in to express as a definition — this is the
// one that proves the contract. It carries the in-place edit session down as
// `ctx.editing` (Board decides whose session is live; the component only renders
// a textarea and reports changes), and its schema mixes plain fields with the
// `align` combo. Box geometry, so it positions through the frame like a shape —
// then overrides width/height to min-content for an empty box, which is exactly
// the kind of per-element tweak spreading `...frame.style` is meant to allow.

export default defineElement({
  type: "text",

  render: (el, ctx) => (
    <Text
      properties={el.properties}
      editing={ctx.editing}
      frame={boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected })}
    />
  ),

  geometry: "box",
  bindable: true,

  defaults: {
    content: "Lorem ipsum dolor sit amet",
    rotation: 0,
    horizontal: "left",
    vertical: "top",
    fontFamily: "DM Sans",
    fontSize: 16,
    fontWeight: "400",
    fontStyle: "normal",
  },

  schema: ["position", "size", "rotation", "fontFamily", "fontSize", "fontWeight", "fontStyle", "align", "content"],

  // The one built-in whose ghost is NOT itself, so it uses the function form of
  // the facet. What the user is dragging out is the text BOX; there is no typed
  // content yet, and previewing the placeholder would draw a ghost the commit
  // then throws away. A dashed rectangle shows the box being sized instead.
  preview: (el) => (
    <Shape
      type="rectangle"
      properties={{ ...GHOST, fill: "transparent" }}
      frame={boxFrame(el.properties)}
    />
  ),

  tool: { icon: TypeIcon, shortcut: "t", create: "text" },
})
