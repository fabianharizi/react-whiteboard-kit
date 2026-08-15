import { useRef } from 'react';
import usePointer from '../hooks/usePointer';
import UUID from '../methods/UUID'
import { definitionOf } from '../../elements'

// This hook is used to implement the "Line" tool. Lines are connectors: a draw
// that starts or ends on a bindable element snaps to that element's nearest
// side and commits with the binding, so the finished line tracks the element.
// It needs a condition to be active.
//
// `hitTest(worldX, worldY)` is the same closure the SelectionBox endpoint drag
// uses (App owns it), so drawing a line and re-dragging its endpoint agree on
// what binds where — including the zoom-scaled pick radius.

export default function useLineTool(ref, active, hitTest, toWorld, enablePreview, disablePreview, addElements, setActiveTool) {
  // World position of the pointerdown — the line's start endpoint, snapped to
  // the bind anchor when the press lands on a bindable element.
  const start = useRef({ x: 0, y: 0 })
  const startBinding = useRef(null)

  usePointer(ref, {
    active: active,
    cursor: "crosshair",
    onDown: (p) => {
      const w = toWorld(p.x, p.y)
      const hit = hitTest(w.x, w.y)
      startBinding.current = hit ? { uuid: hit.uuid, side: hit.side } : null
      start.current = hit ? hit.anchor : w
    },
    onMove: (p) => {
      if(!p.hasDragged) return;
      const cur = toWorld(p.x, p.y)

      // Snap the ghost to the anchor it would bind to and ring that anchor, so
      // the pending attachment is visible while drawing — not a surprise on
      // release. The start anchor stays ringed for a draw that began bound.
      const hit = hitTest(cur.x, cur.y)
      const end = hit ? hit.anchor : cur
      const anchors = [
        ...(startBinding.current ? [start.current] : []),
        ...(hit ? [hit.anchor] : []),
      ]

      enablePreview("line", start.current.x, start.current.y, end.x, end.y, { anchors })
    },
    onUp: (p) => {
      const cur = toWorld(p.x, p.y)
      // Click-no-drag commits a default stub; only a real drag can bind the end.
      const endHit = p.hasDragged ? hitTest(cur.x, cur.y) : null
      const end = endHit ? endHit.anchor
        : p.hasDragged ? cur
        : { x: start.current.x + 100, y: start.current.y }

      addElements([{
        type: "line",
        uuid: UUID.generate("line"),
        // Registry create-defaults (routing, stroke, heads), then this draw's
        // endpoints and bindings on top.
        properties: {
          ...definitionOf("line").defaults,
          startX: start.current.x,
          startY: start.current.y,
          endX: end.x,
          endY: end.y,
          startBinding: startBinding.current,
          endBinding: endHit ? { uuid: endHit.uuid, side: endHit.side } : null,
        }
      }])
      disablePreview()
      setActiveTool("select")
    }
  })
}
