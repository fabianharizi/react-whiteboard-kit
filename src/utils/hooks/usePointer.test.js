import { describe, it, expect } from "vitest"
import { createPointerSession } from "./usePointer"

// The hook itself needs a DOM and isn't covered here. Its session is pure,
// though — and the session is where the two things worth pinning live: the
// double-click pairing rule, and the gesture count that undo consults.
//
// Timings use wide margins rather than the module's own constants (400ms / 6px),
// so the tests describe intent instead of restating the implementation.

describe("double-click pairing", () => {
  it("never pairs the first click", () => {
    expect(createPointerSession().pairClick(0, 0, 1000)).toBe(false)
  })

  it("pairs a second click that's close in time and space", () => {
    const s = createPointerSession()
    s.pairClick(100, 100, 1000)
    expect(s.pairClick(102, 101, 1100)).toBe(true)
  })

  it("doesn't pair a click that comes too late", () => {
    const s = createPointerSession()
    s.pairClick(100, 100, 1000)
    expect(s.pairClick(100, 100, 3000)).toBe(false)
  })

  it("doesn't pair a click that lands too far away", () => {
    const s = createPointerSession()
    s.pairClick(100, 100, 1000)
    expect(s.pairClick(400, 400, 1100)).toBe(false)
  })

  // Otherwise a rapid triple-click would fire two double-clicks.
  it("consumes the pair, so a third rapid click starts over", () => {
    const s = createPointerSession()
    s.pairClick(100, 100, 1000)
    expect(s.pairClick(100, 100, 1100)).toBe(true)
    expect(s.pairClick(100, 100, 1200)).toBe(false)
  })

  // A click that failed to pair still becomes the new reference point.
  it("re-arms from the click that didn't pair", () => {
    const s = createPointerSession()
    s.pairClick(100, 100, 1000)
    expect(s.pairClick(400, 400, 1100)).toBe(false)
    expect(s.pairClick(401, 400, 1200)).toBe(true)
  })
})

describe("gesture tracking", () => {
  it("is idle with nothing in flight", () => {
    expect(createPointerSession().isIdle()).toBe(true)
  })

  it("stops being idle while a gesture runs", () => {
    const s = createPointerSession()
    s.beginGesture()
    expect(s.isIdle()).toBe(false)
    s.endGesture()
    expect(s.isIdle()).toBe(true)
  })

  // Not expected in practice (a pointer press is exclusive), but the count must
  // survive it rather than going idle on the first release.
  it("needs every gesture to end before it's idle again", () => {
    const s = createPointerSession()
    s.beginGesture()
    s.beginGesture()
    s.endGesture()
    expect(s.isIdle()).toBe(false)
    s.endGesture()
    expect(s.isIdle()).toBe(true)
  })
})

// The whole reason the session exists as a value instead of module state: two
// whiteboards on one page must not see each other's clicks or gestures.
describe("isolation between sessions", () => {
  it("doesn't pair clicks across two sessions", () => {
    const a = createPointerSession()
    const b = createPointerSession()
    a.pairClick(100, 100, 1000)
    expect(b.pairClick(100, 100, 1100)).toBe(false)
  })

  it("doesn't let one canvas's drag block the other's undo", () => {
    const a = createPointerSession()
    const b = createPointerSession()
    a.beginGesture()
    expect(a.isIdle()).toBe(false)
    expect(b.isIdle()).toBe(true)
  })
})
