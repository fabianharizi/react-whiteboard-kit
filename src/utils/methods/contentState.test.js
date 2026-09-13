import { describe, it, expect } from "vitest"
import * as ops from "./contentState"
import { registry } from "../../elements"

// These transitions are where "plural-only" and "selection is a uuid list" stop
// being conventions and become behaviour. Several assertions below are about
// reference IDENTITY rather than equality — untouched elements must keep their
// reference, or history snapshots stop sharing structure and content re-renders
// when only the selection changed.

const rect = (uuid, x = 0) => ({ type: "rectangle", uuid, properties: { startX: x, startY: 0, endX: x + 10, endY: 10 } })

const stateOf = (content, selection = []) => ({ content, selection })

describe("addElements", () => {
  it("appends and selects exactly the new set", () => {
    const before = stateOf([rect("a")], ["a"])
    const next = ops.addElements(before, [rect("b"), rect("c")])

    expect(next.content.map(el => el.uuid)).toEqual(["a", "b", "c"])
    expect(next.selection).toEqual(["b", "c"])     // the draw/paste becomes the selection
  })

  it("stores only type, uuid and properties", () => {
    const next = ops.addElements(stateOf([]), [{ ...rect("a"), selected: true, stray: 1 }])
    expect(Object.keys(next.content[0]).sort()).toEqual(["properties", "type", "uuid"])
  })

  it("keeps existing elements by reference", () => {
    const a = rect("a")
    expect(ops.addElements(stateOf([a]), [rect("b")]).content[0]).toBe(a)
  })
})

describe("selectElements", () => {
  const before = stateOf([rect("a"), rect("b")], ["a"])

  it("selects exactly what it's given", () => {
    expect(ops.selectElements(before, ["a", "b"]).selection).toEqual(["a", "b"])
  })

  it("drops ids that aren't in content", () => {
    expect(ops.selectElements(before, ["a", "ghost"]).selection).toEqual(["a"])
  })

  it("deselects on an empty or absent list", () => {
    expect(ops.selectElements(before, []).selection).toEqual([])
    expect(ops.selectElements(before, null).selection).toEqual([])
    expect(ops.selectElements(before, undefined).selection).toEqual([])
  })

  // Selecting isn't an edit. Content keeping its identity is what lets React
  // skip re-rendering the whole canvas on a click.
  it("leaves content identical", () => {
    expect(ops.selectElements(before, ["b"]).content).toBe(before.content)
  })
})

describe("updateElements", () => {
  it("merges a patch into an element's properties", () => {
    const next = ops.updateElements(stateOf([rect("a")]), [{ uuid: "a", properties: { startX: 99 } }])
    expect(next.content[0].properties).toMatchObject({ startX: 99, endX: 10 })   // merged, not replaced
  })

  it("applies patches to several elements in one pass", () => {
    const before = stateOf([rect("a"), rect("b"), rect("c")])
    const next = ops.updateElements(before, [
      { uuid: "a", properties: { startX: 1 } },
      { uuid: "c", properties: { startX: 3 } },
    ])
    expect(next.content.map(el => el.properties.startX)).toEqual([1, 0, 3])
  })

  it("leaves unpatched elements by reference", () => {
    const before = stateOf([rect("a"), rect("b")])
    const next = ops.updateElements(before, [{ uuid: "a", properties: { startX: 1 } }])
    expect(next.content[1]).toBe(before.content[1])
    expect(next.content[0]).not.toBe(before.content[0])
  })

  it("ignores a patch for an element that isn't there", () => {
    const before = stateOf([rect("a")])
    expect(ops.updateElements(before, [{ uuid: "ghost", properties: { startX: 1 } }]).content)
      .toEqual(before.content)
  })

  it("preserves the selection", () => {
    const next = ops.updateElements(stateOf([rect("a")], ["a"]), [{ uuid: "a", properties: { startX: 1 } }])
    expect(next.selection).toEqual(["a"])
  })
})

describe("updateKey", () => {
  const key = (patches) => ops.updateKey(patches)

  it("is stable across the writes of one gesture", () => {
    expect(key([{ uuid: "a", properties: { startX: 1 } }]))
      .toBe(key([{ uuid: "a", properties: { startX: 2 } }]))
  })

  it("changes when a different element is touched", () => {
    expect(key([{ uuid: "a", properties: { startX: 1 } }]))
      .not.toBe(key([{ uuid: "b", properties: { startX: 1 } }]))
  })

  it("changes when a different field is touched", () => {
    expect(key([{ uuid: "a", properties: { startX: 1 } }]))
      .not.toBe(key([{ uuid: "a", properties: { startY: 1 } }]))
  })

  // A group drag builds its patches by mapping over the selection, whose order
  // isn't guaranteed to be stable — an order-sensitive key would split one drag
  // into several undo steps.
  it("doesn't depend on the order of the patches", () => {
    const a = { uuid: "a", properties: { startX: 1 } }
    const b = { uuid: "b", properties: { startX: 1 } }
    expect(key([a, b])).toBe(key([b, a]))
  })

  it("doesn't depend on the order of the property names", () => {
    expect(key([{ uuid: "a", properties: { startX: 1, startY: 2 } }]))
      .toBe(key([{ uuid: "a", properties: { startY: 2, startX: 1 } }]))
  })

  it("separates a multi-element write from a single-element one", () => {
    expect(key([{ uuid: "a", properties: { startX: 1 } }]))
      .not.toBe(key([{ uuid: "a", properties: { startX: 1 } }, { uuid: "b", properties: { startX: 1 } }]))
  })
})

describe("deleteElements", () => {
  // A line bound to the rectangle's left side — anchor (0, 50). Its stored
  // endX/endY are deliberately stale, so baking is visible.
  const target = { type: "rectangle", uuid: "t", properties: { startX: 0, startY: 0, endX: 100, endY: 100 } }
  const line = {
    type: "line", uuid: "l",
    properties: { startX: 5, startY: 5, endX: 7, endY: 7, startBinding: null, endBinding: { uuid: "t", side: "left" } },
  }

  it("removes the elements and prunes them from the selection", () => {
    const before = stateOf([rect("a"), rect("b")], ["a", "b"])
    const next = ops.deleteElements(before, ["a"], registry)
    expect(next.content.map(el => el.uuid)).toEqual(["b"])
    expect(next.selection).toEqual(["b"])
  })

  it("leaves survivors by reference", () => {
    const before = stateOf([rect("a"), rect("b")])
    expect(ops.deleteElements(before, ["a"], registry).content[0]).toBe(before.content[1])
  })

  // The connector has to freeze where it was RENDERING, not snap back to the
  // stale coords it had cached.
  it("bakes and detaches a connector whose target is deleted", () => {
    const next = ops.deleteElements(stateOf([target, line]), ["t"], registry)
    const survivor = next.content[0]

    expect(next.content).toHaveLength(1)
    expect(survivor.properties.endX).toBe(0)
    expect(survivor.properties.endY).toBe(50)
    expect(survivor.properties.endBinding).toBe(null)
  })

  it("leaves a connector alone when its target survives", () => {
    const before = stateOf([target, line, rect("z")])
    const next = ops.deleteElements(before, ["z"], registry)
    expect(next.content[1]).toBe(line)
  })

  it("handles deleting the connector and its target together", () => {
    const next = ops.deleteElements(stateOf([target, line]), ["t", "l"], registry)
    expect(next.content).toEqual([])
  })
})

describe("clearContent", () => {
  it("empties both content and selection", () => {
    expect(ops.clearContent()).toEqual({ content: [], selection: [] })
  })
})

describe("adoptContent", () => {
  it("takes the parent's array by reference", () => {
    const incoming = [rect("a")]
    expect(ops.adoptContent(stateOf([]), incoming).content).toBe(incoming)
  })

  it("trims the selection to what survived the replacement", () => {
    const before = stateOf([rect("a"), rect("b")], ["a", "b"])
    expect(ops.adoptContent(before, [rect("b")]).selection).toEqual(["b"])
  })

  it("keeps a selection the replacement still contains", () => {
    const before = stateOf([rect("a")], ["a"])
    expect(ops.adoptContent(before, [rect("a"), rect("b")]).selection).toEqual(["a"])
  })

  it("clears the selection when the parent replaces everything", () => {
    expect(ops.adoptContent(stateOf([rect("a")], ["a"]), []).selection).toEqual([])
  })
})
