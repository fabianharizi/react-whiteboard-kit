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
//   - preview: deliberately ABSENT — with no ghost override the drag preview is
//     the note itself, rendered from `defaults`. That WYSIWYG fallback is the
//     whole point of the preview facet: a custom type gets a drag ghost without
//     the engine knowing it exists.
//
// It is registered through <Whiteboard elements={[sticky]}> in App.jsx, exactly
// as a third party would — no entry in BUILTIN_ELEMENTS, and no engine file
// mentions it. Deleting this file and that prop removes it cleanly.

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

  tool: { icon: StickyIcon, shortcut: "n", create: "box" },
})
