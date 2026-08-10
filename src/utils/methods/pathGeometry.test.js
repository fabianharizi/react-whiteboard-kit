import { describe, it, expect } from "vitest"
import { pointsBounds, pointsPathD } from "./pathGeometry"

const pts = (...pairs) => pairs.map(([x, y]) => ({ x, y }))

describe("pointsBounds", () => {
  it("covers every point", () => {
    expect(pointsBounds(pts([10, 20], [0, 50], [30, 5])))
      .toEqual({ left: 0, top: 5, right: 30, bottom: 50 })
  })

  it("returns a zero-area box for a single point", () => {
    expect(pointsBounds(pts([7, 7]))).toEqual({ left: 7, top: 7, right: 7, bottom: 7 })
  })

  it("handles negative world coordinates", () => {
    expect(pointsBounds(pts([-40, -10], [-5, -30])))
      .toEqual({ left: -40, top: -30, right: -5, bottom: -10 })
  })

  it("returns a degenerate box at the origin for no points", () => {
    // NOT ±Infinity: an empty stroke must not blow the selection chrome up to
    // the whole plane.
    expect(pointsBounds([])).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
    expect(pointsBounds(undefined)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
  })

  it("gives a zero-height box for a perfectly horizontal stroke", () => {
    expect(pointsBounds(pts([0, 5], [100, 5])))
      .toEqual({ left: 0, top: 5, right: 100, bottom: 5 })
  })
})

describe("pointsPathD", () => {
  it("returns an empty string for no points", () => {
    expect(pointsPathD([])).toBe("")
    expect(pointsPathD(undefined)).toBe("")
  })

  it("draws a single point as a zero-length line, so a round cap paints a dot", () => {
    // "M 5 5" alone paints nothing at all.
    expect(pointsPathD(pts([5, 5]))).toBe("M 5 5 L 5 5")
  })

  it("draws two points as a straight line", () => {
    expect(pointsPathD(pts([0, 0], [10, 20]))).toBe("M 0 0 L 10 20")
  })

  it("smooths three or more points with quadratics through the midpoints", () => {
    // Control point is the sample; the curve passes through the midpoint
    // between consecutive samples. The last sample is a real endpoint, so the
    // stroke lands on it exactly rather than stopping at a midpoint.
    expect(pointsPathD(pts([0, 0], [10, 10], [20, 0])))
      .toBe("M 0 0 Q 10 10, 15 5 L 20 0")
  })

  it("chains one quadratic per interior point", () => {
    const d = pointsPathD(pts([0, 0], [10, 0], [20, 0], [30, 0]))
    expect(d.match(/Q/g)).toHaveLength(2)      // two interior points
    expect(d.startsWith("M 0 0")).toBe(true)
    expect(d.endsWith("L 30 0")).toBe(true)
  })

  it("subtracts the origin so the svg can draw in local coords", () => {
    expect(pointsPathD(pts([100, 50], [120, 70]), 100, 50)).toBe("M 0 0 L 20 20")
  })

  it("never emits NaN for finite input", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ x: i * 3.7, y: Math.sin(i) * 12 }))
    expect(pointsPathD(many, 1.5, -2.5)).not.toContain("NaN")
  })
})
