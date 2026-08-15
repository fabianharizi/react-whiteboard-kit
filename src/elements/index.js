import rectangle from "./rectangle"
import oval from "./oval"
import line from "./line"
import text from "./text"
import path from "./path"
import { createRegistry } from "./createRegistry"

// The element-type registry. `createRegistry(definitions)` builds an isolated one
// (see that file); each <Whiteboard> gets its own via RegistryContext, so element
// sets don't leak between instances.
//
// The built-ins register through the same list a consumer's custom types do — so
// this list is the API's own proof: if a built-in couldn't be a plain definition,
// the shape would be wrong.

export const BUILTIN_ELEMENTS = [rectangle, oval, line, text, path]

// A default registry over the built-ins, backing the free-function exports below
// (and the geometry / connector / toolset re-export shims) for the unit tests and
// any consumer that wants the built-in behavior without a <Whiteboard> instance.
// Custom types (e.g. the `sticky` example) reach the engine through
// <Whiteboard elements={[...]}>, which builds its own registry — never this one.
export const registry = createRegistry(BUILTIN_ELEMENTS)

export const elementOf = registry.elementOf
export const definitionOf = registry.definitionOf
export const schemaOf = registry.schemaOf
export const BINDABLE = registry.bindable
export const DEFINITIONS = registry.DEFINITIONS

export { createRegistry }
