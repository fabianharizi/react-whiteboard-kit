import box from "./box"
import segment from "./segment"
import path from "./path"
import { definitionOf } from "../../elements"

// Which geometry an element type uses, and the element-level helpers built on
// top of it.
//
// This took the geometry-motivated `type === "line"` checks — footprint,
// rotation, translate, group-resize mapping — out of SelectionBox, hitTest and
// useSelectTool. The checks that remain elsewhere are deliberately NOT geometry:
// they are about BINDINGS (resolving, baking and remapping a connector's ends —
// useCommands, useContent, Properties, useSelectTool) or about CHROME (a lone
// line gets endpoint handles instead of a resize box — SelectionBox). Chrome is
// its own axis: a `path` will be segment-ish in storage but wants box chrome.
//
// Each kind implements the same contract:
//
//   storesRotation                     is `rotation` data, or baked into coords?
//   rotationOf(props)                  degrees about the centre
//   bounds(props)                      { left, top, right, bottom }
//   corners(props)                     visual footprint, rotation included
//   unrotatedCorners(props)            footprint ignoring rotation
//   center(props)                      the pivot
//   translate(props, dx, dy)           → properties patch
//   mapIntoBox(props, oldBox, newBox)  → properties patch (group resize)
//   rotate(props, pivot, degrees)      → properties patch
//
// Adding a kind is adding a file here plus a line in KINDS below; assigning it
// to an element type happens on that type's definition (its `geometry` name).
// `path` was the third, and it did what it was supposed to: box and segment had
// agreed on four of the methods, and path shares none of that implementation —
// only `translate` came through in recognisable form.

const KINDS = { box, segment, path }

// "Which geometry does this type use" now lives on the element definition (its
// `geometry` name); this resolves that name to the kind object. The registry is
// the single declaration — geometry no longer keeps its own type→kind table.
//
// Note this is NOT the same question as "can a line bind to it": bindability is
// its own flag on the definition (a path is box-shaped but must never be a
// connector target).
//
// Unknown types fall back to box: a new element type renders and transforms
// sensibly before anyone remembers to declare its kind.
export const geometryOf = (el) => KINDS[definitionOf(el?.type)?.geometry ?? "box"]

// The footprint with rotation ignored — enough to bound anything unrotated.
export const rawCorners = (el) => geometryOf(el).unrotatedCorners(el.properties)

// Every corner in world space, rotation included.
export const cornersOf = (el) => geometryOf(el).corners(el.properties)

// Bounding box over the selection (world coords). One element is just a group of
// one — same math for any count.
//
// `rotated` selects WHICH footprint, and the distinction is load-bearing: an
// axis-aligned box (any group) must cover each member's ROTATED corners or
// rotated members poke outside the chrome, whereas a lone box element's chrome
// rotates *with* it — there the bounds have to stay in the element's own
// unrotated frame, otherwise the rotation gets applied twice.
export const boundsOf = (elements, rotated = true) => {
  const points = elements.flatMap(el => (rotated ? cornersOf(el) : rawCorners(el)))
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  }
}
