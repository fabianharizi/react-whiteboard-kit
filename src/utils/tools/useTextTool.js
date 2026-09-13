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
      // Preview under this tool's OWN type: the text definition decides what its
      // ghost looks like (a dashed box), rather than this tool borrowing another
      // type's name to get the look it wanted.
      enablePreview("text", start.current.x, start.current.y, cur.x, cur.y)
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
