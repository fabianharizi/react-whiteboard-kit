import { rotatePoint, mapCoord } from "./primitives"

// A path: an arbitrary run of points, for freehand ink. Like a segment it has no
// stored rotation — turning it moves every point — but unlike either other kind
// its geometry is NOT the two stored corners, so it deliberately does not spread
// `shared`: every method there is corner arithmetic and would return NaN here.
//
// This is the kind that actually exercises the contract. Only `translate`
// survived the move from shared in recognisable form, exactly as shared.js
// predicted it would.

const pointsOf = (props) => props.points ?? []

// A stroke with no points has no meaningful extent. Returning a degenerate box
// at the origin keeps `boundsOf` finite — `Math.min()` of nothing is Infinity,
// which would blow the selection chrome up to the whole plane.
const EMPTY = { left: 0, top: 0, right: 0, bottom: 0 }

const boundsOfPoints = (points) => {
  if (!points.length) return EMPTY
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const p of points) {
    if (p.x < left) left = p.x
    if (p.x > right) right = p.x
    if (p.y < top) top = p.y
    if (p.y > bottom) bottom = p.y
  }
  return { left, top, right, bottom }
}

export default {
  // Rotation bakes into the points, so there is nothing to store and nothing to
  // report. Consequences: the chrome stays axis-aligned, and Shift-rotate snaps
  // the delta rather than an absolute angle.
  storesRotation: false,
  rotationOf: () => 0,

  bounds: (props) => boundsOfPoints(pointsOf(props)),

  // The bbox MIDPOINT, not the average of the points. The average drifts toward
  // wherever samples happen to be dense — a slow curve at one end of a stroke
  // would pull it — and the rotate pivot would then disagree with the visible
  // centre of the selection box.
  center: (props) => {
    const b = boundsOfPoints(pointsOf(props))
    return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 }
  },

  // The four bbox corners rather than all N points. `boundsOf` only takes
  // min/max over whatever this returns, so the result is identical — but it
  // keeps that O(1) per element instead of O(n), and it runs on every
  // SelectionBox render and every resize-handle press.
  corners: (props) => {
    const b = boundsOfPoints(pointsOf(props))
    return [
      { x: b.left, y: b.top }, { x: b.right, y: b.top },
      { x: b.right, y: b.bottom }, { x: b.left, y: b.bottom },
    ]
  },

  // No rotation to ignore, so the unrotated footprint is the same four corners.
  unrotatedCorners(props) { return this.corners(props) },

  translate: (props, dx, dy) => ({
    points: pointsOf(props).map(p => ({ ...p, x: p.x + dx, y: p.y + dy })),
  }),

  mapIntoBox: (props, oldBox, newBox) => {
    const oldW = oldBox.right - oldBox.left
    const oldH = oldBox.bottom - oldBox.top
    const newW = newBox.right - newBox.left
    const newH = newBox.bottom - newBox.top
    // mapCoord already degenerates to a translation on a zero-size axis, which
    // is what a perfectly straight stroke gives you on one of them.
    return {
      points: pointsOf(props).map(p => ({
        ...p,
        x: mapCoord(p.x, oldBox.left, oldW, newBox.left, newW),
        y: mapCoord(p.y, oldBox.top, oldH, newBox.top, newH),
      })),
    }
  },

  rotate: (props, pivot, degrees) => ({
    points: pointsOf(props).map(p => ({ ...p, ...rotatePoint(p, pivot, degrees) })),
  }),
}
