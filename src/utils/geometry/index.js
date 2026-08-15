import { registry } from "../../elements"

// Element-aware geometry dispatch — "which geometry kind does this element's type
// use, and the element-level helpers built on it" — now lives on the registry
// (see elements/createRegistry.js), because the type→kind map is per element set.
// These re-exports keep the long-standing import path working for the call sites
// and unit tests that use the default registry; components thread a per-instance
// registry instead and call the same methods on it.
//
// The geometry KINDS themselves (box / segment / path) and all the coordinate
// math stay where they are — they operate on `properties`, independent of any
// type set. Each kind implements the shared contract:
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

export const geometryOf = registry.geometryOf
export const rawCorners = registry.rawCorners
export const cornersOf = registry.cornersOf
export const boundsOf = registry.boundsOf
