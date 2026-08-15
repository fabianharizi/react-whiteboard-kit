import { useRef } from 'react';
import usePointer from '../hooks/usePointer';
import UUID from '../methods/UUID'

// The box-draw creation tool: drag a rectangle to size, or click for a default
// square. It serves ANY element type whose definition declares `tool.create:
// "box"` (rectangle, oval, sticky, ...). App passes the active type; the tool
// takes that type's create-time `defaults` straight from the registry, so a new
// box-shaped type is drawable with no edit here. The drag ghost previews under
// the type's own name (each has a matching Preview mode).

export default function useBoxTool(registry, ref, active, type, toWorld, enablePreview, disablePreview, addElements, setActiveTool) {
  // World position of the pointerdown — the box's anchored corner.
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
      enablePreview(type, start.current.x, start.current.y, cur.x, cur.y)
    },
    onUp: (p) => {
      const cur = toWorld(p.x, p.y)
      const coords = {
        startX: start.current.x,
        startY: start.current.y,
        endX: p.hasDragged ? cur.x : start.current.x + 100,
        endY: p.hasDragged ? cur.y : start.current.y + 100,
      }

      addElements([{
        type,
        uuid: UUID.generate(type.slice(0, 4)),
        // The type's own create defaults, then the drawn box on top.
        properties: { ...(registry.definitionOf(type)?.defaults ?? {}), ...coords },
      }])
      disablePreview()
      setActiveTool("select")
    }
  })
}
