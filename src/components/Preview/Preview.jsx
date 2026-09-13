import Shape from "../Shape/Shape";
import BindPoint from "../BindPoint/BindPoint";
import { useRegistry } from "../../elements/RegistryContext";
import { boxFrame } from "../../elements/frame";
import { GHOST } from "../../elements/preview";

// The drag ghost. WHICH ghost to draw is the element definition's business, not
// this file's: the type being drawn is looked up in the registry and previewed
// through its `preview` facet — or, absent one, through its own `render`, which
// gives a WYSIWYG ghost for free. A custom type therefore previews with no edit
// here, which is what this file used to require (a hardcoded mode table, keyed
// by type name, that a consumer's type could never appear in).
//
// Coordinates are world coords — the ghost renders inside the world div, so the
// camera maps it like any element.

// The marquee is the one preview that is NOT an element ghost: it's selection
// chrome the select tool draws, with no type behind it and nothing in the
// registry to dispatch on. So it stays here, explicitly.
const MARQUEE = { ...GHOST, fill: "#0088aa20" };

// A ghost isn't in the content yet and carries no bindings, so there is nothing
// for a connector to resolve against. Definitions still get the standard ctx.
const NO_LOOKUP = () => undefined;

export default function Preview({ mode, startX, startY, endX, endY, anchors, ...extra }) {
  const registry = useRegistry();
  const coords = { startX, startY, endX, endY };

  return (
    <>
      {mode === "select"
        ? <Shape type="rectangle" properties={{ ...coords, ...MARQUEE }} frame={boxFrame(coords)} />
        : elementGhost(registry, mode, coords, extra)}
      {/* Pending bind anchors, in world coords (this renders inside the world
          div). The ghost has already snapped to them, so these confirm exactly
          where each end will attach. */}
      {anchors?.map((a, i) => <BindPoint key={i} x={a.x} y={a.y} />)}
    </>
  );
}

// Draw `type`'s ghost at the drag's coordinates, through its own definition.
function elementGhost(registry, type, coords, extra) {
  const def = registry.definitionOf(type);
  if (!def) return null;                     // unknown type previews nothing

  // The type's create-defaults, its ghost overrides, then this drag's data —
  // i.e. the properties the commit is about to write, minus the uuid.
  const properties = {
    ...def.defaults,
    ...(typeof def.preview === "object" ? def.preview : null),
    ...coords,
    ...extra,        // mode-specific drag data, e.g. the pen's in-progress points
  };

  // No uuid: boxFrame omits data-uuid (and the self-positioning types leave the
  // attribute off), so a ghost is never hit-testable.
  const element = { type: def.type, uuid: undefined, properties };
  const ctx = { selected: false, editing: null, lookup: NO_LOOKUP };

  return typeof def.preview === "function"
    ? def.preview(element, ctx)
    : def.render(element, ctx);
}
