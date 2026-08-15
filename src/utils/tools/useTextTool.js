import { useRef } from 'react';
import usePointer from '../hooks/usePointer';
import UUID from '../methods/UUID'

// This hook is used to implement the "Text" tool.
// It needs a condition to be active.

export default function useTextTool(registry, ref, active, toWorld, enablePreview, disablePreview, addElements, setActiveTool) {
  // World position of the pointerdown — the text box's anchored corner.
  const start = useRef({ x: 0, y: 0 })

  usePointer(ref, {
    active: active,
    cursor: "crosshair",
    onDown: (p) => {
      start.current = toWorld(p.x, p.y)
    },
    onMove: (p) => {
      if(!p.hasDragged) return;
      const cur = toWorld(p.x, p.y)
      enablePreview("rectangle", start.current.x, start.current.y, cur.x, cur.y)
    },
    onUp: (p) => {
      const cur = toWorld(p.x, p.y)
      const coords = {
        startX: start.current.x,
        startY: start.current.y,
        endX: p.hasDragged ? cur.x : start.current.x + 200,
        endY: p.hasDragged ? cur.y : start.current.y + 50,
      }

      addElements([{
        type: "text",
        uuid: UUID.generate("text"),
        // Create-defaults come from the registry; the drawn box goes on top.
        properties: { ...registry.definitionOf("text").defaults, ...coords },
      }])
      disablePreview()
      setActiveTool("select")
    }
  })
}
