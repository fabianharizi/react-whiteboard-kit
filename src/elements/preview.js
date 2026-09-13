// Shared ghost chrome for the drag preview.
//
// Every element type is previewed through its own definition (see the `preview`
// facet in defineElement.js), which is what lets a custom type get a drag ghost
// with no engine edit. But ghosts should still LOOK alike across types — a
// pending shape reads as pending because of the dashed cyan stroke, not because
// of which type it is — and only the definition knows which of its properties
// carry stroke and fill. So the engine publishes the look here and each
// definition maps it onto its own property names:
//
//   preview: { ...GHOST, fill: "transparent" }
//
// A consumer's element type spreads the same constant to match.
//
// Plain values rather than the --wb-* theme tokens on purpose: line and path
// ghosts pass these straight to SVG presentation attributes, where var() is not
// resolved.

export const GHOST = {
  strokeColor: "#0088aaaa",
  strokeWidth: 2,
  strokeStyle: "dashed",
}
