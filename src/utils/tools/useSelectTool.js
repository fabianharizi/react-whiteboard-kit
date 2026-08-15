import { useRef } from 'react';
import usePointer from '../hooks/usePointer';

// This hook is used to implement the "Select" tool.
// Click selects one element (empty canvas deselects); dragging draws a marquee
// and selects every element it overlaps. Both paths go through selectElements.
// Marquee bounds come from the passed `registry` (a connector's endpoints
// resolve, then the element's geometry kind gives the box).

export default function useSelectTool(registry, ref, active, content, selectElements, toWorld, enablePreview, disablePreview) {
  // World position of the pointerdown — the marquee's anchored corner.
  const start = useRef({ x: 0, y: 0 })

  usePointer(ref, {
    active: active,
    cursor: "default",
    onDown: (p) => {
      start.current = toWorld(p.x, p.y)
    },
    onMove: (p) => {
      if(!p.hasDragged) return;
      const cur = toWorld(p.x, p.y)
      enablePreview("select", start.current.x, start.current.y, cur.x, cur.y)
    },
    onUp: (p) => {
      disablePreview()

      // A plain click is handled in onClick; only a drag marquees.
      if (!p.hasDragged) return;

      // Marquee rect in world coords — the space elements are stored in.
      const cur = toWorld(p.x, p.y)
      const marquee = {
        left: Math.min(start.current.x, cur.x),
        top: Math.min(start.current.y, cur.y),
        right: Math.max(start.current.x, cur.x),
        bottom: Math.max(start.current.y, cur.y),
      }

      // Select every element whose bounding box overlaps the marquee (partial
      // or full); an empty result deselects all. The SelectionBox renders the
      // group box from the selection itself. A connector's bound endpoints
      // resolve to their targets' anchors — the marquee must test where it renders.
      const lookup = (uuid) => content.find(el => el.uuid === uuid)
      selectElements(content
        .filter(el => {
          const properties = registry.effectiveProperties(el, lookup);
          // NOTE: `bounds` ignores rotation, so a rotated element is still
          // marquee-tested by its unrotated box — a known issue, preserved here
          // deliberately. Switching to `cornersOf` is the one-line fix.
          const { left, top, right, bottom } = registry.geometryOf(el).bounds(properties);

          // AABB overlap: the two boxes intersect on both axes.
          return left < marquee.right
            && right > marquee.left
            && top < marquee.bottom
            && bottom > marquee.top;
        })
        .map(el => el.uuid))
    },
    onClick: (p) => {
      const el = p.target?.closest('[data-uuid]');
      selectElements(el ? [el.getAttribute('data-uuid')] : []);
      disablePreview()
    }
  })
}
