// The single entry every element type — built-in or third-party — is declared
// through. `rectangle`, `oval`, `line`, `text` and `path` all register with this
// exact call, so the built-ins ARE the API's own test suite: if a built-in can't
// be expressed as a definition, the definition shape is incomplete.
//
// Deliberately thin for now. Its job today is to (a) be the one seam a public
// `<Whiteboard elements={[...]}>` will grow from, and (b) fail loudly at
// registration rather than deep inside a render when a definition is malformed.
//
// A definition:
//   type       string, unique — the discriminator stored on every element.
//   render     (el, ctx) => JSX. `ctx` is { selected, editing, lookup }.
//              Box-shaped types build their positioning bag with boxFrame() and
//              spread it; self-positioning SVG types (line, path) ignore it and
//              own their own <svg> frame. This split is why `frame` is a helper a
//              definition opts into, not something the engine forces on render.
//   geometry   name of a geometry kind ("box" | "segment" | "path"). Metadata
//              today; the KIND_BY_TYPE map in utils/geometry moves onto this next.
//   schema     ordered list of Properties-panel fields. Each entry is either a
//              built-in field NAME (resolved against the panel's FIELDS catalog)
//              or an inline field DEFINITION object — that's what lets a custom
//              element expose a control the engine never heard of.
//   defaults   create-time properties. Metadata today; the per-tool hardcoded
//              defaults collapse onto this when the tools migrate.
//   bindable   may a connector endpoint attach to it. Defaults to false.
//   tool       creation affordance metadata (icon, shortcut, ...). Metadata today.

export default function defineElement(def) {
  if (!def || typeof def !== "object") {
    throw new Error("defineElement: expected a definition object")
  }
  if (!def.type) {
    throw new Error("defineElement: a definition needs a `type`")
  }
  if (typeof def.render !== "function") {
    throw new Error(`defineElement(${def.type}): \`render\` must be a function`)
  }

  return {
    bindable: false,
    schema: [],
    defaults: {},
    ...def,
  }
}
