import { describe, it, expect } from "vitest"
import path from "./path"

// The kind that actually exercised the geometry contract — it shares no
// implementation with box or segment beyond `translate`'s shape.

const props = (...pairs) => ({ points: pairs.map(([x, y]) => ({ x, y })) })

// An L: (0,0) → (0,100) → (100,100). Bbox 100x100, but the points are NOT
// evenly distributed, which is what separates the bbox midpoint from the
// point average.
const L = props([0, 0], [0, 100], [100, 100])

describe("rotation", () => {
  it("does not store rotation — it bakes into the points", () => {
    expect(path.storesRotation).toBe(false)
    expect(path.rotationOf(L)).toBe(0)
  })

  it("reports zero even if a stray rotation is stored", () => {
    expect(path.rotationOf({ ...L, rotation: 90 })).toBe(0)
  })
})

describe("bounds", () => {
  it("covers every point", () => {
    expect(path.bounds(L)).toEqual({ left: 0, top: 0, right: 100, bottom: 100 })
  })

  it("guards an empty or absent points array", () => {
    // Math.min() of nothing is Infinity, which would make boundsOf produce an
    // infinite selection box.
    expect(path.bounds({ points: [] })).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
    expect(path.bounds({})).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
  })

  it("handles a single point", () => {
    expect(path.bounds(props([5, 9]))).toEqual({ left: 5, top: 9, right: 5, bottom: 9 })
  })
})

describe("center", () => {
  it("is the bbox midpoint, NOT the average of the points", () => {
    // The L has two points on its left edge and one on its right, so the point
    // average is (33.3, 66.6) — which would put the rotate pivot somewhere the
    // selection box's centre isn't.
    expect(path.center(L)).toEqual({ x: 50, y: 50 })
  })
})

describe("corners", () => {
  it("returns the four bbox corners rather than every point", () => {
    // Equivalent for boundsOf (same min/max) but O(1) per element instead of
    // O(n), and this runs on every SelectionBox render.
    const corners = path.corners(L)
    expect(corners).toHaveLength(4)
    expect(corners).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ])
  })

  it("stays four corners for a long stroke", () => {
    const many = { points: Array.from({ length: 500 }, (_, i) => ({ x: i, y: i })) }
    expect(path.corners(many)).toHaveLength(4)
  })

  it("has no rotation to ignore, so unrotatedCorners matches", () => {
    expect(path.unrotatedCorners(L)).toEqual(path.corners(L))
  })
})

describe("translate", () => {
  it("offsets every point", () => {
    expect(path.translate(props([0, 0], [10, 10]), 5, -5))
      .toEqual({ points: [{ x: 5, y: -5 }, { x: 15, y: 5 }] })
  })

  it("returns new point objects and does not mutate the input", () => {
    const p = props([0, 0], [10, 10])
    const before = JSON.parse(JSON.stringify(p))
    const out = path.translate(p, 5, 5)
    expect(p).toEqual(before)
    expect(out.points[0]).not.toBe(p.points[0])
  })
})

describe("mapIntoBox", () => {
  const oldBox = { left: 0, top: 0, right: 100, bottom: 100 }

  it("scales every point proportionally", () => {
    const out = path.mapIntoBox(L, oldBox, { left: 0, top: 0, right: 200, bottom: 200 })
    expect(out.points).toEqual([{ x: 0, y: 0 }, { x: 0, y: 200 }, { x: 200, y: 200 }])
  })

  it("carries the new origin", () => {
    const out = path.mapIntoBox(props([0, 0]), oldBox, { left: 10, top: 20, right: 110, bottom: 120 })
    expect(out.points).toEqual([{ x: 10, y: 20 }])
  })

  it("degenerates to a translation on a zero-size axis", () => {
    // A perfectly horizontal stroke has no height to scale.
    const flat = props([0, 5], [100, 5])
    const flatBox = { left: 0, top: 5, right: 100, bottom: 5 }
    const out = path.mapIntoBox(flat, flatBox, { left: 0, top: 25, right: 100, bottom: 25 })
    expect(out.points).toEqual([{ x: 0, y: 25 }, { x: 100, y: 25 }])
  })

  it("does not mutate the input", () => {
    const p = props([0, 0], [10, 10])
    const before = JSON.parse(JSON.stringify(p))
    path.mapIntoBox(p, oldBox, { left: 0, top: 0, right: 50, bottom: 50 })
    expect(p).toEqual(before)
  })
})

describe("rotate", () => {
  it("turns every point about the pivot and writes no rotation property", () => {
    const out = path.rotate(props([10, 0], [20, 0]), { x: 0, y: 0 }, 90)
    expect(out.points[0].x).toBeCloseTo(0)
    expect(out.points[0].y).toBeCloseTo(10)
    expect(out.points[1].x).toBeCloseTo(0)
    expect(out.points[1].y).toBeCloseTo(20)
    expect("rotation" in out).toBe(false)
  })

  it("preserves the shape's extent through a quarter turn", () => {
    const out = path.rotate(L, path.center(L), 90)
    const b = path.bounds(out)
    expect(b.right - b.left).toBeCloseTo(100)
    expect(b.bottom - b.top).toBeCloseTo(100)
  })

  it("does not mutate the input", () => {
    const p = props([1, 2], [3, 4])
    const before = JSON.parse(JSON.stringify(p))
    path.rotate(p, { x: 0, y: 0 }, 45)
    expect(p).toEqual(before)
  })
})
