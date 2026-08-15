import styles from "./SelectionBox.module.css"
import usePointer from './../../utils/hooks/usePointer';
import { useRef, useState } from "react";
import { rad, deg } from "../../utils/geometry/primitives";
import { HANDLES, MIN_SIZE, handleOffset, snap15, resizeBox } from "../../utils/geometry/resize";
import { useRegistry } from "../../elements/RegistryContext";
import BindPoint from "../BindPoint/BindPoint";

// `interactive` gates all dragging: only the select tool may resize/move/rotate.
// `zoom` converts pointer deltas (screen px) into world units; `toWorld` converts
// absolute pointer positions (needed for rotation angles). `hitTest` finds the
// bindable element under a dragged line endpoint. `onActivate(uuid)` fires when
// a lone selection is double-clicked — the box covers the element, so this
// overlay is the only thing that can see that gesture.
export default function SelectionBox({ elements, zoom, toWorld, updateElements, hitTest, interactive, onActivate }) {
  const registry = useRegistry()

  // Bind candidate under an endpoint drag — rendered as a highlight so the
  // user sees which element the endpoint will attach to on release.
  const [bindCandidate, setBindCandidate] = useState(null)

  // Body-drag: dragging the container interior moves the whole selection.
  const bodyRef = useBodyDrag(elements, zoom, updateElements, interactive, onActivate)

  // Endpoint handles are a line-type affordance (endpoint identity is per-line,
  // meaningless on a group), so they apply to a lone selected line only.
  const loneLine = elements.length === 1 && elements[0].type === "line" ? elements[0] : null

  // A lone box element rotates the whole chrome with it, so resize handles work
  // in the element's local frame. Groups keep an axis-aligned box (rotation 0),
  // and so does a lone segment — its kind reports no rotation to carry.
  const rotation = elements.length === 1 ? registry.geometryOf(elements[0]).rotationOf(elements[0].properties) : 0

  // Only the rotating-chrome case measures in the element's local frame; every
  // other selection needs bounds that cover rotated footprints — see boundsOf.
  const coverRotated = rotation === 0
  const box = registry.boundsOf(elements, coverRotated)

  return (
    <div
      className={[
        styles.box,
        interactive && styles.interactive,
        // A lone line's box is just its endpoints' bbox — meaningless as a
        // frame, so the outline is hidden and only the endpoint dots show.
        loneLine && styles.bare,
      ].filter(Boolean).join(" ")}
      ref={bodyRef}
      // The box covers whatever is selected and carries no `data-uuid`, so a
      // right-click on it would otherwise read as empty canvas and wipe the
      // very selection the user meant to act on. This marks it as "the
      // selection" for useContextMenu.
      data-selection-box=""
      style={{
        "--x": box.left + "px",
        "--y": box.top + "px",
        "--width": (box.right - box.left) + "px",
        "--height": (box.bottom - box.top) + "px",
        "--rotation": rotation + "deg",
      }}
    >
      {interactive && (loneLine
        ? <LineHandles element={loneLine} zoom={zoom} updateElements={updateElements} box={box} hitTest={hitTest} onCandidate={setBindCandidate} />
        : <>
            {HANDLES.map((h) => (
              <BoxHandle key={h.pos} spec={h} elements={elements} zoom={zoom} rotation={rotation} coverRotated={coverRotated} updateElements={updateElements} />
            ))}
            <RotateHandle elements={elements} toWorld={toWorld} updateElements={updateElements} />
          </>)}
      {/* Marks the exact anchor the endpoint will glue to. The endpoint has
          already snapped there, so this confirms the precise attachment point
          rather than "somewhere on that element". Offsets are box-relative
          because it renders inside this container, not the world div. */}
      {interactive && bindCandidate && <BindPoint
        x={bindCandidate.anchor.x - box.left}
        y={bindCandidate.anchor.y - box.top}
      />}
    </div>
  )
}

// Attaches a pointer drag to the box container that translates every selected
// element together. Pointer deltas are screen px → divide by zoom for world.
// Translation is rotation-independent, so rotated chrome needs no special case.
function useBodyDrag(elements, zoom, updateElements, interactive, onActivate) {
  const registry = useRegistry()
  const ref = useRef(null)
  const origin = useRef(null)

  usePointer(ref, {
    active: interactive,
    cursor: "move",
    // Double-clicking a lone selection activates it (text → edit in place).
    // Ambiguous for a group, so it only fires for a selection of one.
    onDblClick: () => {
      if (elements.length === 1) onActivate?.(elements[0].uuid)
    },
    onDown: () => {
      // Snapshots keep `type` so each member can be transformed by its own kind.
      origin.current = elements.map(el => ({ uuid: el.uuid, type: el.type, properties: { ...el.properties } }))
    },
    onMove: (p) => {
      if (!p.hasDragged) return
      const dx = (p.x - p.startX) / zoom
      const dy = (p.y - p.startY) / zoom
      updateElements(origin.current.map(o => ({
        uuid: o.uuid,
        properties: registry.geometryOf(o).translate(o.properties, dx, dy),
      })))
    },
  })

  return ref
}

// A resize handle. Dragging it resizes the group box, and every element's raw
// corners are mapped proportionally into the new box — one code path whether
// the selection holds one element or many.
function BoxHandle({ spec, elements, zoom, rotation, coverRotated, updateElements }) {
  const registry = useRegistry()
  const ref = useRef(null)
  const origin = useRef(null)   // group box + member corners snapshotted at drag start
  const off = handleOffset(spec.pos)

  usePointer(ref, {
    active: true,
    cursor: spec.cursor,
    onDown: () => {
      origin.current = {
        // Must match the box that was RENDERED, or the handle would resize
        // relative to a different rectangle than the one being dragged.
        box: registry.boundsOf(elements, coverRotated),
        members: elements.map(el => ({ uuid: el.uuid, type: el.type, properties: { ...el.properties } })),
        rotation,
      }
    },
    onMove: (p) => {
      if (!p.hasDragged) return
      const o = origin.current

      // Screen deltas → world. For a rotated lone element the handles live in
      // the element's rotated (local) frame, so rotate the delta back by
      // −rotation before applying it to the local box edges.
      let dx = (p.x - p.startX) / zoom
      let dy = (p.y - p.startY) / zoom
      if (o.rotation) {
        const a = rad(-o.rotation)
        const rx = dx * Math.cos(a) - dy * Math.sin(a)
        const ry = dx * Math.sin(a) + dy * Math.cos(a)
        dx = rx
        dy = ry
      }

      // The minimum size is a constant 10 SCREEN px at any zoom.
      let next = resizeBox(o.box, spec.edges, dx, dy, p.shiftKey, MIN_SIZE / zoom)

      // Rotation pivots about the element CENTER, and resizing moves the center
      // — which would silently swing the anchored corner through the rotation.
      // Compensate: translate the new box so the anchor stays fixed in world
      // space (anchor world drift = Δcenter − R(rotation)·Δcenter).
      if (o.rotation) {
        const a = rad(o.rotation)
        const dcx = (next.left + next.right) / 2 - (o.box.left + o.box.right) / 2
        const dcy = (next.top + next.bottom) / 2 - (o.box.top + o.box.bottom) / 2
        const driftX = dcx - (dcx * Math.cos(a) - dcy * Math.sin(a))
        const driftY = dcy - (dcx * Math.sin(a) + dcy * Math.cos(a))
        next = {
          left: next.left - driftX, right: next.right - driftX,
          top: next.top - driftY, bottom: next.bottom - driftY,
        }
      }

      // Each member maps itself from the old group box into the new one — a box
      // and a segment happen to do that identically today, but a path won't.
      updateElements(o.members.map(m => ({
        uuid: m.uuid,
        properties: registry.geometryOf(m).mapIntoBox(m.properties, o.box, next),
      })))
    },
  })

  return (
    <span
      className={styles.handle}
      ref={ref}
      data-handle={spec.pos}
      style={{ "--hx": off.x + "%", "--hy": off.y + "%" }}
    />
  )
}

// The rotate handle (dot above the top edge). Dragging it rotates the whole
// selection about the group center — one code path for any count: a single box
// element's group center IS its own center, so only its `rotation` changes.
// Box members orbit the center (corners translate, size intact) and accumulate
// `rotation`; line members have no rotation property — their endpoints rotate,
// which IS their rotation. Shift snaps to 15°: a single element snaps its
// resulting angle, a group snaps the drag delta (a group has no single angle).
function RotateHandle({ elements, toWorld, updateElements }) {
  const registry = useRegistry()
  const ref = useRef(null)
  const origin = useRef(null)

  usePointer(ref, {
    active: true,
    cursor: "grab",
    onDown: (p) => {
      const box = registry.boundsOf(elements)
      const center = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 }
      const pw = toWorld(p.x, p.y)
      origin.current = {
        center,
        startAngle: deg(Math.atan2(pw.y - center.y, pw.x - center.x)),
        members: elements.map(el => ({ uuid: el.uuid, type: el.type, properties: { ...el.properties } })),
        // Absolute snapping needs an angle to snap TO, which only a kind that
        // stores its rotation has. A lone segment falls back to delta snapping.
        single: elements.length === 1 && registry.geometryOf(elements[0]).storesRotation,
      }
    },
    onMove: (p) => {
      if (!p.hasDragged) return
      const o = origin.current
      const pw = toWorld(p.x, p.y)
      let delta = deg(Math.atan2(pw.y - o.center.y, pw.x - o.center.x)) - o.startAngle

      if (p.shiftKey) {
        const at = o.single ? registry.geometryOf(o.members[0]).rotationOf(o.members[0].properties) : 0
        delta = o.single ? snap15(at + delta) - at : snap15(delta)
      }

      updateElements(o.members.map(m => ({
        uuid: m.uuid,
        properties: registry.geometryOf(m).rotate(m.properties, o.center, delta),
      })))
    },
  })

  return <span className={styles.rotateHandle} ref={ref} data-handle="rotate" />
}

// A lone line gets one handle per endpoint, dragging the endpoint directly so
// the start→end direction (and therefore angle/arrowheads) is preserved.
// Endpoint drags are also how bindings are made and broken: hovering a
// bindable element snaps to its nearest side and binds on release; dropping on
// empty canvas detaches.
function LineHandles({ element, zoom, updateElements, box, hitTest, onCandidate }) {
  const p = element.properties
  return (
    <>
      <LineHandle
        element={element} zoom={zoom} updateElements={updateElements} box={box}
        hitTest={hitTest} onCandidate={onCandidate} bindKey="startBinding"
        keyX="startX" keyY="startY" x={p.startX} y={p.startY}
      />
      <LineHandle
        element={element} zoom={zoom} updateElements={updateElements} box={box}
        hitTest={hitTest} onCandidate={onCandidate} bindKey="endBinding"
        keyX="endX" keyY="endY" x={p.endX} y={p.endY}
      />
    </>
  )
}

function LineHandle({ element, zoom, updateElements, box, hitTest, onCandidate, bindKey, keyX, keyY, x, y }) {
  const ref = useRef(null)
  const origin = useRef(null)
  const candidate = useRef(null)

  usePointer(ref, {
    active: true,
    cursor: "move",
    onDown: () => { origin.current = { x: element.properties[keyX], y: element.properties[keyY] } },
    onMove: (p) => {
      if (!p.hasDragged) return
      const wx = origin.current.x + (p.x - p.startX) / zoom
      const wy = origin.current.y + (p.y - p.startY) / zoom

      // A moving endpoint is live (detached); over a bind candidate it snaps
      // to the anchor it would attach to. The binding itself commits on release.
      const hit = hitTest ? hitTest(wx, wy) : null
      candidate.current = hit
      onCandidate?.(hit)
      updateElements([{
        uuid: element.uuid,
        properties: {
          [keyX]: hit ? hit.anchor.x : wx,
          [keyY]: hit ? hit.anchor.y : wy,
          [bindKey]: null,
        }
      }])
    },
    onUp: () => {
      const hit = candidate.current
      candidate.current = null
      onCandidate?.(null)
      if (hit) updateElements([{
        uuid: element.uuid,
        properties: { [bindKey]: { uuid: hit.uuid, side: hit.side } }
      }])
    },
  })

  // Pixel offset of this endpoint inside the bounding-box container.
  return (
    <span
      className={styles.endpoint}
      ref={ref}
      style={{ "--hx": (x - box.left) + "px", "--hy": (y - box.top) + "px" }}
    />
  )
}
