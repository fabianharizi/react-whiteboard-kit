import { describe, it, expect } from "vitest"
import box from "./box"
import segment from "./segment"
import path from "./path"
import { geometryOf } from "./index"

// The kind contract, asserted against every registered kind. Kind-specific
// behaviour lives in box/segment/path's own test files; this file is the
// specification any future kind must satisfy.

const props = (startX, startY, endX, endY, extra = {}) => ({ startX, startY, endX, endY, ...extra })

// Each kind stores its geometry differently, so the shared-contract block needs
// a per-kind way to build "a shape from this point to that one" and to read back
// where those two ends ended up. Everything else is asserted through `bounds`,
// which is storage-agnostic by definition.
const FIXTURES = {
  box: {
    make: (sx, sy, ex, ey) => props(sx, sy, ex, ey),
    ends: (p) => [{ x: p.startX, y: p.startY }, { x: p.endX, y: p.endY }],
  },
  segment: {
    make: (sx, sy, ex, ey) => props(sx, sy, ex, ey),
    ends: (p) => [{ x: p.startX, y: p.startY }, { x: p.endX, y: p.endY }],
  },
  path: {
    make: (sx, sy, ex, ey) => ({ points: [{ x: sx, y: sy }, { x: ex, y: ey }] }),
    ends: (p) => [p.points[0], p.points[p.points.length - 1]],
  },
}

describe("geometryOf", () => {
  it("maps the box-shaped types to the box kind", () => {
    for (const type of ["rectangle", "oval", "text"]) {
      expect(geometryOf({ type })).toBe(box)
    }
  })

  it("maps line to the segment kind", () => {
    expect(geometryOf({ type: "line" })).toBe(segment)
  })

  it("maps path to the path kind", () => {
    expect(geometryOf({ type: "path" })).toBe(path)
  })

  it("falls back to box for an unregistered type", () => {
    // A new element type should transform sensibly before anyone remembers to
    // register its kind.
    expect(geometryOf({ type: "sticky" })).toBe(box)
    expect(geometryOf({ type: undefined })).toBe(box)
  })
})

describe("the shared contract", () => {
  for (const [name, kind] of [["box", box], ["segment", segment], ["path", path]]) {
    const { make, ends } = FIXTURES[name]
    // Every method returns a PATCH, so applying it is how you see the result.
    const apply = (p, patch) => ({ ...p, ...patch })

    describe(name, () => {
      it("implements every member", () => {
        for (const m of ["rotationOf", "bounds", "corners", "unrotatedCorners", "center", "translate", "mapIntoBox", "rotate"]) {
          expect(typeof kind[m]).toBe("function")
        }
        expect(typeof kind.storesRotation).toBe("boolean")
      })

      it("bounds is independent of the order the ends were stored in", () => {
        expect(kind.bounds(make(100, 50, 0, 0)))
          .toEqual({ left: 0, top: 0, right: 100, bottom: 50 })
        expect(kind.bounds(make(0, 0, 100, 50)))
          .toEqual({ left: 0, top: 0, right: 100, bottom: 50 })
      })

      it("center is the middle of the bounds", () => {
        expect(kind.center(make(0, 0, 100, 50))).toEqual({ x: 50, y: 25 })
      })

      it("corners cover the bounds", () => {
        const p = make(0, 0, 100, 50)
        const xs = kind.corners(p).map(c => c.x)
        const ys = kind.corners(p).map(c => c.y)
        expect(Math.min(...xs)).toBe(0)
        expect(Math.max(...xs)).toBe(100)
        expect(Math.min(...ys)).toBe(0)
        expect(Math.max(...ys)).toBe(50)
      })

      it("translate moves the whole shape", () => {
        const p = make(0, 0, 100, 50)
        expect(kind.bounds(apply(p, kind.translate(p, 10, -5))))
          .toEqual({ left: 10, top: -5, right: 110, bottom: 45 })
      })

      it("translate does not mutate its input", () => {
        const p = make(0, 0, 100, 50)
        const before = JSON.parse(JSON.stringify(p))
        kind.translate(p, 10, 10)
        expect(p).toEqual(before)
      })

      it("mapIntoBox scales proportionally into the new group box", () => {
        const p = make(0, 0, 50, 50)
        const oldBox = { left: 0, top: 0, right: 100, bottom: 100 }
        const newBox = { left: 0, top: 0, right: 200, bottom: 200 }
        expect(kind.bounds(apply(p, kind.mapIntoBox(p, oldBox, newBox))))
          .toEqual({ left: 0, top: 0, right: 100, bottom: 100 })
      })

      it("mapIntoBox preserves which end is which", () => {
        // Mapping raw (never normalised) coordinates is what keeps a segment
        // pointing the same way — and a stroke drawn the same direction —
        // through a group resize.
        const p = make(100, 100, 0, 0)
        const oldBox = { left: 0, top: 0, right: 100, bottom: 100 }
        const newBox = { left: 0, top: 0, right: 200, bottom: 200 }
        const [first, last] = ends(apply(p, kind.mapIntoBox(p, oldBox, newBox)))
        expect(first.x).toBeGreaterThan(last.x)
        expect(first.y).toBeGreaterThan(last.y)
      })

      it("rotate does not mutate its input", () => {
        const p = make(0, 0, 100, 50)
        const before = JSON.parse(JSON.stringify(p))
        kind.rotate(p, { x: 0, y: 0 }, 45)
        expect(p).toEqual(before)
      })
    })
  }
})

describe("box", () => {
  it("stores rotation as data", () => {
    expect(box.storesRotation).toBe(true)
    expect(box.rotationOf(props(0, 0, 10, 10, { rotation: 45 }))).toBe(45)
  })

  it("reports no rotation when absent or null", () => {
    expect(box.rotationOf(props(0, 0, 10, 10))).toBe(0)
    expect(box.rotationOf(props(0, 0, 10, 10, { rotation: null }))).toBe(0)
  })

  it("gives two corners unrotated and four once rotated", () => {
    expect(box.corners(props(0, 0, 100, 50))).toHaveLength(2)
    expect(box.corners(props(0, 0, 100, 50, { rotation: 30 }))).toHaveLength(4)
  })

  describe("rotate", () => {
    it("accumulates the turn into rotation, in whole degrees", () => {
      const out = box.rotate(props(0, 0, 100, 50, { rotation: 10 }), { x: 50, y: 25 }, 20.4)
      expect(out.rotation).toBe(30)
    })

    it("keeps the size intact when turning about its own centre", () => {
      const p = props(0, 0, 100, 50, { rotation: 0 })
      const out = box.rotate(p, { x: 50, y: 25 }, 90)
      expect(out.endX - out.startX).toBeCloseTo(100)
      expect(out.endY - out.startY).toBeCloseTo(50)
    })

    it("orbits its centre about a group pivot", () => {
      // Centre (50,25) turned 180° about the origin lands at (-50,-25).
      const out = box.rotate(props(0, 0, 100, 50), { x: 0, y: 0 }, 180)
      expect((out.startX + out.endX) / 2).toBeCloseTo(-50)
      expect((out.startY + out.endY) / 2).toBeCloseTo(-25)
    })

    it("does not wrap past a full turn", () => {
      const out = box.rotate(props(0, 0, 10, 10, { rotation: 350 }), { x: 5, y: 5 }, 20)
      expect(out.rotation).toBe(370)
    })
  })
})

describe("segment", () => {
  it("bakes rotation into its coordinates rather than storing it", () => {
    expect(segment.storesRotation).toBe(false)
    expect(segment.rotationOf(props(0, 0, 10, 10))).toBe(0)
  })

  it("reports zero rotation even if a stray one is stored", () => {
    // Its endpoints already encode its angle; honouring a rotation property
    // would turn it twice.
    expect(segment.rotationOf(props(0, 0, 10, 10, { rotation: 90 }))).toBe(0)
  })

  it("always has exactly its two endpoints as corners", () => {
    expect(segment.corners(props(0, 0, 100, 0))).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }])
    expect(segment.corners(props(0, 0, 100, 0, { rotation: 90 }))).toHaveLength(2)
  })

  describe("rotate", () => {
    it("moves the endpoints and writes no rotation property", () => {
      const out = segment.rotate(props(0, 0, 100, 0), { x: 0, y: 0 }, 90)
      expect(out.startX).toBeCloseTo(0)
      expect(out.startY).toBeCloseTo(0)
      expect(out.endX).toBeCloseTo(0)
      expect(out.endY).toBeCloseTo(100)
      expect("rotation" in out).toBe(false)
    })

    it("preserves direction and length", () => {
      const p = props(10, 10, 60, 10)
      const out = segment.rotate(p, { x: 0, y: 0 }, 37)
      const lengthBefore = Math.hypot(p.endX - p.startX, p.endY - p.startY)
      const lengthAfter = Math.hypot(out.endX - out.startX, out.endY - out.startY)
      expect(lengthAfter).toBeCloseTo(lengthBefore)
    })
  })
})
