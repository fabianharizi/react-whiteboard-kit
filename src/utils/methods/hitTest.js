import { anchorPoint } from "./lineGeometry"
import { rotatePoint } from "../geometry/primitives"
import { geometryOf } from "../geometry"
import { BINDABLE } from "../../elements"

// Bind-target hit-testing for line endpoints: which element (and which of its
// sides) should a dragged endpoint attach to. Which types are bindable is
// declared per element definition (`bindable: true`) and derived into the
// BINDABLE set by the registry — lines opt out, so they can't bind to lines or
// to themselves.

// Padding around the target's box, in SCREEN px (divided by zoom at use), so a
// drop just outside the border still binds.
const BIND_PAD = 10

// Topmost bindable element under a world point. Returns the target's uuid, the
// nearest side (the one a dropped endpoint should anchor to) and that side's
// anchor point — which is both where the endpoint snaps and where the UI marks
// the pending attachment. Null when the point is over empty canvas.
export function bindTargetAt(content, worldPt, zoom = 1) {
  const pad = BIND_PAD / zoom

  // Content order is z-order, so scan topmost-first.
  for (let i = content.length - 1; i >= 0; i--) {
    const el = content[i]
    if (!BINDABLE.has(el.type)) continue

    const geometry = geometryOf(el)
    const { left, right, top, bottom } = geometry.bounds(el.properties)
    const rotation = geometry.rotationOf(el.properties)
    const center = geometry.center(el.properties)

    // Test in the element's local frame: un-rotate the point instead of
    // rotating the box.
    const p = rotation ? rotatePoint(worldPt, center, -rotation) : worldPt
    if (p.x < left - pad || p.x > right + pad || p.y < top - pad || p.y > bottom + pad) continue

    const distances = {
      left: Math.abs(p.x - left),
      right: Math.abs(p.x - right),
      top: Math.abs(p.y - top),
      bottom: Math.abs(p.y - bottom),
    }
    const side = Object.keys(distances).reduce((a, b) => (distances[a] <= distances[b] ? a : b))

    return { uuid: el.uuid, side, anchor: anchorPoint(el, side) }
  }
  return null
}
