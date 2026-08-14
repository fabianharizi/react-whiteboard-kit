import { TypeIcon } from "lucide-react"
import Text from "../components/Text/Text"
import defineElement from "./defineElement"
import { boxFrame } from "./frame"

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

  schema: ["position", "size", "rotation", "fontFamily", "fontSize", "fontWeight", "fontStyle", "align", "content"],

  tool: { icon: TypeIcon, shortcut: "t" },
})
