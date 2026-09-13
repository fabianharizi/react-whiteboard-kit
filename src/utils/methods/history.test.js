import { describe, it, expect } from "vitest"
import { emptyHistory, record, travel, canUndo, canRedo, COALESCE_MS, HISTORY_LIMIT } from "./history"

// Coalescing is the whole reason this module is separate from a plain stack, and
// it's the part that's easy to get subtly wrong: too eager and a drag buries the
// edit before it, too shy and one drag costs sixty Ctrl+Zs. `now` is a parameter
// rather than a clock read, so all of it is testable without faking timers.

// Snapshots are opaque to the stack, so a string is as good as a content array.
const at = (history, now, key, snapshot) => record(history, key, snapshot, now)

describe("record", () => {
  it("pushes the state being left behind", () => {
    const h = record(emptyHistory(), null, "a", 0)
    expect(h.past).toEqual(["a"])
    expect(canUndo(h)).toBe(true)
  })

  it("gives every null-keyed write its own step", () => {
    let h = emptyHistory()
    h = at(h, 0, null, "a")
    h = at(h, 1, null, "b")      // same tick, still two steps
    expect(h.past).toEqual(["a", "b"])
  })

  it("collapses consecutive writes that share a key", () => {
    let h = emptyHistory()
    h = at(h, 0, "drag", "a")
    h = at(h, 100, "drag", "b")
    h = at(h, 200, "drag", "c")
    expect(h.past).toEqual(["a"])     // one step, landing back before the drag
  })

  // The window runs from the PREVIOUS write, not from the start of the gesture,
  // so a slow thirty-second drag is still one step as long as it keeps moving.
  it("keeps extending the window while writes keep arriving", () => {
    let h = emptyHistory()
    h = at(h, 0, "drag", "a")
    for (let t = 100; t <= 10_000; t += 100) h = at(h, t, "drag", "x")
    expect(h.past).toEqual(["a"])
  })

  it("starts a new step once the window lapses", () => {
    let h = emptyHistory()
    h = at(h, 0, "drag", "a")
    h = at(h, COALESCE_MS + 1, "drag", "b")
    expect(h.past).toEqual(["a", "b"])
  })

  it("starts a new step when the interaction changes", () => {
    let h = emptyHistory()
    h = at(h, 0, "update:one>x", "a")
    h = at(h, 10, "update:two>x", "b")
    expect(h.past).toEqual(["a", "b"])
  })

  it("never coalesces a null key into a preceding null key", () => {
    let h = emptyHistory()
    h = at(h, 0, null, "a")
    h = at(h, 10, null, "b")
    expect(h.past).toHaveLength(2)
  })

  it("forks the timeline: editing after an undo drops the redo stack", () => {
    let h = { ...emptyHistory(), future: ["undone"] }
    h = at(h, 0, null, "a")
    expect(h.future).toEqual([])
  })

  // A coalesced write isn't a new step, so it must not clear redo either — it's
  // a continuation of a step that already did.
  it("leaves the stacks alone entirely when a write coalesces", () => {
    let h = at(emptyHistory(), 0, "drag", "a")
    const before = h.past
    h = at(h, 100, "drag", "b")
    expect(h.past).toBe(before)
    expect(h.at).toBe(100)          // but the window still slides
  })

  it("drops the oldest entry past the depth limit", () => {
    let h = emptyHistory()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = at(h, i * 1000, null, i)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(5)                       // 0..4 fell off the bottom
    expect(h.past.at(-1)).toBe(HISTORY_LIMIT + 4)
  })

  it("returns a new history rather than mutating the one it was given", () => {
    const before = emptyHistory()
    const after = record(before, null, "a", 0)
    expect(before.past).toEqual([])
    expect(after).not.toBe(before)
  })
})

describe("travel", () => {
  const stacked = () => {
    let h = emptyHistory()
    h = at(h, 0, null, "one")
    h = at(h, 1000, null, "two")
    return h
  }

  it("returns null when there's nowhere to go", () => {
    expect(travel(emptyHistory(), "past", "future", "now")).toBe(null)
    expect(travel(emptyHistory(), "future", "past", "now")).toBe(null)
  })

  it("hands back the most recent snapshot and moves the current one across", () => {
    const moved = travel(stacked(), "past", "future", "now")
    expect(moved.state).toBe("two")
    expect(moved.history.past).toEqual(["one"])
    expect(moved.history.future).toEqual(["now"])
  })

  // Otherwise the next edit could coalesce into the step that was just restored,
  // and a redo would land somewhere the user never was.
  it("clears the coalescing key so the next edit opens a fresh step", () => {
    let h = at(emptyHistory(), 0, "drag", "a")
    const moved = travel(h, "past", "future", "now")
    expect(moved.history.key).toBe(null)

    const next = record(moved.history, "drag", "restored", 10)
    expect(next.past).toEqual(["restored"])       // pushed, not coalesced
  })

  it("round-trips undo then redo back to where it started", () => {
    const start = stacked()
    const undone = travel(start, "past", "future", "live")
    const redone = travel(undone.history, "future", "past", undone.state)

    expect(redone.state).toBe("live")
    expect(redone.history.past).toEqual(start.past)
    expect(canRedo(redone.history)).toBe(false)
  })

  it("walks all the way back and reports when it's exhausted", () => {
    let h = stacked()
    let current = "live"
    for (const expected of ["two", "one"]) {
      const moved = travel(h, "past", "future", current)
      expect(moved.state).toBe(expected)
      h = moved.history
      current = moved.state
    }
    expect(canUndo(h)).toBe(false)
    expect(travel(h, "past", "future", current)).toBe(null)
  })
})
