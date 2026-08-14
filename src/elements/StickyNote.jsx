import styles from "./StickyNote.module.css"

// An EXAMPLE custom element — the kind a developer using the engine would write.
// It imports nothing from the engine's internals: it receives `properties` and
// the engine-computed `frame`, spreads the frame (position + data-uuid, so
// selection and hit-testing just work), and draws itself. That's the whole
// contract — a third-party element is a plain component plus a definition, with
// no edits to the engine.

export default function StickyNote({ properties, frame }) {
  const p = { color: "#ffe066", text: "", ...properties }

  return (
    <div
      className={styles.sticky}
      {...frame}
      style={{ ...frame.style, "--color": p.color }}
    >
      {p.text}
    </div>
  )
}
