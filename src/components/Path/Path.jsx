import styles from "./Path.module.css"
import { pointsBounds, pointsPathD } from "../../utils/methods/pathGeometry"

// Freehand ink. Renders as SVG for the same reasons Line does, and uses the
// same positioning trick: the svg root is only a frame at the stroke's bbox,
// path data is emitted bbox-relative, and the root ignores pointer events so a
// diagonal stroke's rectangle never swallows clicks on what's underneath —
// only the invisible fat hit stroke is clickable.
//
// The component is dumb: it draws whatever points it's given, which is what
// lets the Preview ghost pass an in-progress stroke through unchanged.

export default function Path({
  uuid, selected,
  properties
}){

  const p = {
    strokeColor: "#ffffff",
    strokeWidth: 2,
    strokeStyle: "solid",
    opacity: 1,
    points: [],
    ...properties
  }

  const b = pointsBounds(p.points)
  const d = pointsPathD(p.points, b.left, b.top)

  const dash = p.strokeStyle === "dashed" ? `${p.strokeWidth * 3} ${p.strokeWidth * 2}`
             : p.strokeStyle === "dotted" ? `0.1 ${p.strokeWidth * 2}`
             : undefined

  return(
    <svg className={styles.path} data-uuid={uuid} data-selected={selected} style={{
      "--x": b.left + "px",
      "--y": b.top + "px",
      "--width": Math.max(1, b.right - b.left) + "px",
      "--height": Math.max(1, b.bottom - b.top) + "px",
      "--opacity": p.opacity,
    }}>
      <path
        className={styles.hit}
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={p.strokeWidth + 8}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke={p.strokeColor}
        strokeWidth={p.strokeWidth}
        strokeDasharray={dash}
        // Round caps and joins unconditionally — this is ink, and mitred joins
        // spike outward at the sharp turns a fast stroke produces.
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
