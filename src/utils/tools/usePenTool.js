import { useRef } from 'react';
import usePointer from '../hooks/usePointer';
import UUID from '../methods/UUID'

// This hook is used to implement the "Pen" tool — freehand ink, committed as a
// `path` element holding the sampled points. It needs a condition to be active.
//
// Two things make it differ from the other drawing tools:
//
// 1. It reads the RAW pointer event, not just the snapshot, so it can pull
//    `getCoalescedEvents()` — the sub-frame samples the browser batched into one
//    pointermove. Without them a fast stroke is sampled once per frame and comes
//    out visibly faceted.
//
// 2. It must NOT trust `p.hasDragged`. That flag is distance from the
//    pointerdown origin, recomputed every move — not path length — so a stroke
//    that ends near where it began (a circle, an "o", any closed loop) reports
//    `false` at pointerup. Every other tool reads it to tell a drag from a
//    click; here that would silently throw the stroke away. The accumulated
//    point count is the honest signal.

// Skip samples closer than this to the previous one, measured in SCREEN px so
// the ink keeps a constant on-screen density at any zoom (and so the tool needs
// no `zoom` parameter). Purely a data-size measure — the smoothing in
// pointsPathD is what makes the result look continuous.
const MIN_SAMPLE_DISTANCE = 2

export default function usePenTool(ref, active, toWorld, enablePreview, disablePreview, addElements, setActiveTool) {
  // The stroke being drawn, in world coords.
  const points = useRef([])
  // Last accepted sample in SCREEN coords, for the thinning test.
  const lastScreen = useRef(null)

  // Accepts a screen-space sample if it's far enough from the previous one.
  const sample = (sx, sy) => {
    const last = lastScreen.current
    if (last && Math.hypot(sx - last.x, sy - last.y) < MIN_SAMPLE_DISTANCE) return
    lastScreen.current = { x: sx, y: sy }
    points.current.push(toWorld(sx, sy))
  }

  usePointer(ref, {
    active: active,
    cursor: "crosshair",
    onDown: (p) => {
      points.current = []
      lastScreen.current = null
      sample(p.x, p.y)
    },
    onMove: (p, setCursor, event) => {
      if (!points.current.length) return          // not our gesture

      // Coalesced events are the samples the browser collected since the last
      // dispatch; falling back to the event itself covers browsers without it.
      for (const ev of event?.getCoalescedEvents?.() ?? [event ?? { clientX: p.x, clientY: p.y }]) {
        sample(ev.clientX, ev.clientY)
      }

      // A fresh array each frame — React bails out of the re-render if the
      // preview state keeps the same array identity.
      enablePreview("path", 0, 0, 0, 0, { points: [...points.current] })
    },
    onUp: () => {
      const stroke = points.current
      points.current = []
      lastScreen.current = null
      disablePreview()
      setActiveTool("select")

      // A single point is a tap, not a stroke. Commit nothing rather than the
      // default-sized fallback the other tools use — a zero-length stroke has no
      // sensible default.
      if (stroke.length < 2) return

      addElements([{
        type: "path",
        uuid: UUID.generate("path"),
        properties: {
          points: stroke,
          strokeColor: "#ffffff",
          strokeWidth: 2,
          strokeStyle: "solid",
          opacity: 1,
        }
      }])
    }
  })
}
