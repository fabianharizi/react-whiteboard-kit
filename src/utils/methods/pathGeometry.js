// Pure geometry for freehand ink. Mirrors the bounds/pathD pair in
// lineGeometry.js: a bbox to position the svg at, and a `d` string in
// coordinates relative to that bbox. Nothing here touches React or the DOM.

// Bounding box over a stroke's points. An empty stroke has no extent, and a
// degenerate box at the origin keeps callers finite — `Math.min()` of nothing
// is Infinity, which would blow the selection chrome up to the whole plane.
export function pointsBounds(points) {
  if (!points?.length) return { left: 0, top: 0, right: 0, bottom: 0 }

  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const p of points) {
    if (p.x < left) left = p.x
    if (p.x > right) right = p.x
    if (p.y < top) top = p.y
    if (p.y > bottom) bottom = p.y
  }
  return { left, top, right, bottom }
}

// SVG path string for a stroke, in coordinates relative to (ox, oy).
//
// Quadratic curves through point MIDPOINTS, which is the standard ink trick: a
// straight polyline through the same samples reads as visibly faceted, because
// every sample becomes a corner. Here each sampled point becomes a control
// point instead and the curve passes through the midpoints between them, so the
// result is C1-continuous — smooth everywhere, no corners at all. It costs one
// pass and no extra data.
//
// Worth knowing: the curve therefore does NOT pass exactly through the sampled
// points, only near them. At ink densities that's invisible, and `pointsBounds`
// still covers the result because a quadratic stays inside the hull of its
// control points.
export function pointsPathD(points, ox = 0, oy = 0) {
  if (!points?.length) return ""

  const at = (p) => `${p.x - ox} ${p.y - oy}`
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

  // A single sample is a dot. Zero-length line + round linecap paints a circle;
  // an "M" alone paints nothing at all.
  if (points.length === 1) return `M ${at(points[0])} L ${at(points[0])}`
  if (points.length === 2) return `M ${at(points[0])} L ${at(points[1])}`

  let d = `M ${at(points[0])}`
  for (let i = 1; i < points.length - 1; i++) {
    d += ` Q ${at(points[i])}, ${at(mid(points[i], points[i + 1]))}`
  }
  // The final sample is a real endpoint, so land on it exactly rather than on a
  // midpoint — otherwise a stroke visibly stops short of where the pen lifted.
  d += ` L ${at(points[points.length - 1])}`
  return d
}
