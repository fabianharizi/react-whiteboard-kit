import { useRef } from 'react';
import usePointer from '../hooks/usePointer';

// This hook is used to implement the "Move" tool: dragging pans the camera, so
// the content follows the cursor. It needs a condition to be active.

export default function useMoveTool(ref, active, panBy, session) {
  // Last pointer position — panning applies incremental deltas.
  const last = useRef({ x: 0, y: 0 })

  usePointer(ref, {
    active: active,
    cursor: "grab",
    onDown: (p, setCursor) => {
      last.current = { x: p.x, y: p.y }
      setCursor("grabbing")
    },
    onMove: (p) => {
      if(!p.hasDragged) return;
      panBy(p.x - last.current.x, p.y - last.current.y)
      last.current = { x: p.x, y: p.y }
    },
    onUp: (p, setCursor) => {
      setCursor()
    }
  }, session)
}
