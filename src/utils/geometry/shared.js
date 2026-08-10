import { bboxOf, centerOf, cornerPoints, mapCoord } from "./primitives"

// The parts of the geometry contract that every kind implements the same way,
// because they only touch the two stored corners.
//
// Worth being honest about: box and segment agree on four of the seven methods,
// so the fact that this file exists is NOT evidence the interface is well shaped.
// A `path` kind (points[], for freehand ink) is what will actually test it —
// bounds and mapIntoBox stop being corner arithmetic there, and only `translate`
// is likely to survive as-is.

export default {
  // → { left, top, right, bottom }, ignoring rotation.
  bounds: (props) => bboxOf(props),

  // → { x, y }, the pivot a rotation turns about.
  center: (props) => centerOf(props),

  // The unrotated footprint. Kinds that rotate override this.
  corners: (props) => cornerPoints(props),

  // The footprint with rotation deliberately ignored — what a lone rotated
  // element's chrome measures, since the chrome carries the rotation itself and
  // measuring the rotated footprint would apply it twice. Only `box` differs
  // from `corners` here, but it must be dispatched rather than assumed: the
  // dispatch layer used to call `cornerPoints` directly, which is a four-corner
  // assumption a path can't satisfy.
  unrotatedCorners: (props) => cornerPoints(props),

  // → a properties patch.
  translate: (props, dx, dy) => ({
    startX: props.startX + dx, startY: props.startY + dy,
    endX: props.endX + dx, endY: props.endY + dy,
  }),

  // Map this element proportionally from one group box into another — the
  // group-resize primitive. Mapping RAW corners (never normalised ones) is what
  // preserves a segment's direction through the resize.
  mapIntoBox: (props, oldBox, newBox) => {
    const oldW = oldBox.right - oldBox.left
    const oldH = oldBox.bottom - oldBox.top
    const newW = newBox.right - newBox.left
    const newH = newBox.bottom - newBox.top
    return {
      startX: mapCoord(props.startX, oldBox.left, oldW, newBox.left, newW),
      endX:   mapCoord(props.endX,   oldBox.left, oldW, newBox.left, newW),
      startY: mapCoord(props.startY, oldBox.top,  oldH, newBox.top,  newH),
      endY:   mapCoord(props.endY,   oldBox.top,  oldH, newBox.top,  newH),
    }
  },
}
