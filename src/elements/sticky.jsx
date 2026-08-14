import { StickyNote as StickyIcon } from "lucide-react"
import StickyNote from "./StickyNote"
import defineElement from "./defineElement"
import { boxFrame } from "./frame"

// An EXAMPLE of a developer-authored element type, kept in the tree as the
// working proof that the extension path holds. It touches no engine internals —
// only defineElement and boxFrame, the surface a consumer gets. It exercises
// every slot at once:
//   - render: a custom component positioned through the shared `frame`
//   - geometry: reuses the built-in "box" kind by name (move/resize/rotate free)
//   - schema: mixes built-in fields ("position", "size", "rotation") with two
//     INLINE field definitions (color, text) the panel never shipped with
//   - defaults: the create-time properties
//   - bindable: connector endpoints may attach to it
//
// Today it registers by being added to the DEFINITIONS list; once the public
// <Whiteboard elements={[...]}> API lands, a consumer passes exactly this object
// and examples like it move out of the core list.

export default defineElement({
  type: "sticky",

  render: (el, ctx) => (
    <StickyNote
      properties={el.properties}
      frame={boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected })}
    />
  ),

  geometry: "box",
  bindable: true,

  defaults: { color: "#ffe066", text: "New note" },

  schema: [
    "position", "size", "rotation",
    { key: "color", label: "Color", type: "color" },
    { key: "text", label: "Note", type: "textarea", default: "" },
  ],

  tool: { icon: StickyIcon, shortcut: "n" },
})
