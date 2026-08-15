// The single entry every element type — built-in or third-party — is declared
// through. `rectangle`, `oval`, `line`, `text` and `path` all register with this
// exact call, so the built-ins ARE the API's own test suite: if a built-in can't
// be expressed as a definition, the definition shape is incomplete.
//
// Its job is to (a) be the one seam a public `<Whiteboard elements={[...]}>` will
// grow from, and (b) fail loudly at registration rather than deep inside a render
// when a definition is malformed.
//
// A definition:
//   type       string, unique — the discriminator stored on every element.
//   render     (el, ctx) => JSX. `ctx` is { selected, editing, lookup }.
//              Box-shaped types build their positioning bag with boxFrame() and
//              spread it; self-positioning SVG types (line, path) ignore it and
//              own their own <svg> frame. This split is why `frame` is a helper a
//              definition opts into, not something the engine forces on render.
//   geometry   name of a geometry kind ("box" | "segment" | "path"); geometryOf
//              resolves it to the kind's transform/bounds implementation.
//   schema     ordered list of Properties-panel fields. Each entry is either a
//              built-in field NAME (resolved against the panel's FIELDS catalog)
//              or an inline field DEFINITION object — that's what lets a custom
//              element expose a control the engine never heard of.
//   defaults   create-time properties; the drawing tools read these so no created
//              element's initial properties are hardcoded in a tool.
//   bindable   may a connector endpoint attach to it. Defaults to false.
//   tool       creation affordance: { icon, shortcut, create }. `create` names the
//              drawing gesture ("box" | "text" | "line" | "pen") — the toolbar and
//              App's tool-hook activation are both derived from it.
//   connector  OPTIONAL. For an element defined by its attachments (a line): the
//              { refs, resolve, bake, rebind } the engine calls (via
//              elements/connector.js) to resolve endpoints and keep bindings
//              honest across delete and copy/paste, instead of any type check.

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
