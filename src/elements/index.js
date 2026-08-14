import rectangle from "./rectangle"
import oval from "./oval"
import line from "./line"
import text from "./text"
import path from "./path"
import sticky from "./sticky"

// The element-type registry: the one place that knows the set of types and what
// each one is. Everything that used to switch on `el.type` reads from here
// instead. Adding a type — built-in or, later, one a consumer passes to
// <Whiteboard> — is adding a definition to this list, not editing every surface.
//
// The built-ins register through the same defineElement() a third party would,
// so this list is also the contract's proof: if one of them couldn't be a plain
// definition, the shape would be wrong.

// `sticky` is an EXAMPLE custom element (see sticky.jsx) kept alongside the
// built-ins to prove the extension path — it registers through the exact same
// list. Remove it (and its demo seed in App) once the public API supersedes it.
const DEFINITIONS = [rectangle, oval, line, text, path, sticky]

const BY_TYPE = new Map(DEFINITIONS.map(def => [def.type, def]))

// The definition for an element instance (or null for an unknown type).
export const elementOf = (el) => BY_TYPE.get(el?.type) ?? null

// The definition for a type string.
export const definitionOf = (type) => BY_TYPE.get(type) ?? null

// The Properties-panel field list for a type (empty for unknown types).
export const schemaOf = (type) => BY_TYPE.get(type)?.schema ?? []

// Types a connector endpoint may attach to. Derived, so it can't drift from the
// definitions the way a hand-kept set in hitTest.js could.
export const BINDABLE = new Set(DEFINITIONS.filter(def => def.bindable).map(def => def.type))

export { DEFINITIONS }
