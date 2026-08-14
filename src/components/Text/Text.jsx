import { useEffect, useRef } from "react"
import styles from "./Text.module.css"
import { fontStack } from "../../utils/methods/fonts"

// `frame` is the engine-computed positioning bag (see boxFrame): --x/--y/
// --width/--height/--rotation plus data-uuid / data-selected. Text spreads it
// like any box element, then overrides width/height to min-content for a small
// box — a per-element tweak on top of `...frame.style`.
//
// `editing` is the in-place edit session for THIS element, or null:
//   { onChange(value), onEnd() }
// It's handed down from Board (which owns the uuid match) so the component
// stays dumb — it renders a textarea instead of static text and reports
// changes; it never decides when editing starts or stops.
//
// Alignment: `horizontal` (left/center/right) feeds `text-align` directly;
// `vertical` (top/middle/bottom) is a grid `align-content`, so the stored words
// map to CSS keywords here rather than storing CSS in the data.

const VERTICAL = { top: "start", middle: "center", bottom: "end" }

export default function Text({
  properties,
  editing,
  frame
}){

  const p = {
    content: "Lorem ipsum dolor sit amet",
    horizontal: "left",
    vertical: "top",
    // Defaults match what the app rendered before font control existed (App.css
    // puts DM Sans on everything at the browser's default size), so elements
    // created earlier look identical.
    fontFamily: "DM Sans",
    fontSize: 16,
    fontWeight: "400",
    fontStyle: "normal",
    ...properties
  }

  // The stored box, to decide the min-content override. The frame already holds
  // the same width/height as px; this only needs the raw measure to branch.
  const width = Math.abs((p.endX ?? 0) - (p.startX ?? 0))
  const height = Math.abs((p.endY ?? 0) - (p.startY ?? 0))

  const editor = useRef(null)

  // Take focus when the session OPENS, selecting the existing text so typing
  // replaces it (double-click-to-edit convention).
  //
  // The dep is a boolean, deliberately NOT `editing`: Board rebuilds that
  // descriptor object on every render, so keying off it re-runs this after
  // every keystroke — re-selecting the text so the next character wipes it,
  // leaving a field that never holds more than one letter.
  const isEditing = !!editing
  useEffect(() => {
    if (!isEditing) return
    editor.current?.focus()
    editor.current?.select()
  }, [isEditing])

  return(
      <div className={editing ? `${styles.text} ${styles.editing}` : styles.text}
        {...frame}
        style={{
        ...frame.style,
        "--width": (width > 10) ? width + "px" : "min-content",
        "--height": (height > 10) ? height + "px" : "min-content",
        "--horizontal": p.horizontal,
        "--vertical": VERTICAL[p.vertical] ?? "start",
        "--fontFamily": fontStack(p.fontFamily),
        "--fontSize": p.fontSize + "px",
        "--fontWeight": p.fontWeight,
        "--fontStyle": p.fontStyle,
      }}>{editing
        ? <textarea
            ref={editor}
            className={styles.editor}
            value={p.content}
            onChange={(e) => editing.onChange(e.target.value)}
            onBlur={() => editing.onEnd()}
            // Escape ends the session; Enter stays a newline. Typing is already
            // safe from tool shortcuts — useShortcuts ignores textarea targets.
            onKeyDown={(e) => { if (e.key === "Escape") editing.onEnd() }}
            // Keep caret placement and text selection out of the board's hands:
            // otherwise a drag inside the textarea marquees, and a click
            // deselects the element (which would close the session).
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        : p.content}</div>
  )
}
