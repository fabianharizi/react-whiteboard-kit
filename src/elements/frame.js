// The positioning contract for box-shaped elements. The engine derives it from
// the two stored corners so an element author never touches coordinates and
// never forgets the `data-uuid` hook that hit-testing (closest('[data-uuid]'))
// depends on — they just spread it onto their root node:
//
//   render: (el, ctx) => <div {...boxFrame(el.properties, ctx)}>...</div>
//
// It sets the --x/--y/--width/--height/--rotation CSS variables the element's
// stylesheet reads, plus data-uuid / data-selected. A component may still
// override any of these in its own `style` (Text swaps width/height to
// min-content when the box is tiny) — merge with `...frame.style` to keep the
// position the engine computed.
//
// SHARED WITH PREVIEW. The drag ghost is the same box math with no element
// behind it, so it calls boxFrame with raw coords and no uuid — which is exactly
// right: a ghost carries no data-uuid and must not be hit-testable. This is why
// the math lives here and not inside Shape, which renders on both paths.
//
// NOT for line/path. Their rendered box is the route's bbox — arrowheads, curve
// belly, stroke width — which geometry alone can't know, so they self-position
// inside their own <svg> and ignore this helper entirely.

export function boxFrame(properties, { uuid, selected } = {}) {
  const { startX = 0, startY = 0, endX = 0, endY = 0, rotation = 0 } = properties

  const frame = {
    style: {
      "--x": Math.min(startX, endX) + "px",
      "--y": Math.min(startY, endY) + "px",
      "--width": Math.abs(endX - startX) + "px",
      "--height": Math.abs(endY - startY) + "px",
      "--rotation": rotation + "deg",
    },
  }

  // A ghost has no uuid: omit the attribute so it stays out of hit-testing.
  if (uuid !== undefined) frame["data-uuid"] = uuid
  frame["data-selected"] = !!selected

  return frame
}
