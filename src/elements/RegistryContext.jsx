/* eslint-disable react-refresh/only-export-components -- this is a context
   module: it intentionally exports the provider, the hook and the context object
   together, none of which are fast-refreshable components. */
import { createContext, useContext } from "react"

// The per-instance registry, handed to every child of a <Whiteboard> so
// components resolve element types against THIS canvas's set — its built-ins plus
// whatever custom types the consumer passed. Hooks and pure helpers can't read
// context, so <Whiteboard> passes them the same registry object as a parameter;
// this is only for the component tree below the provider.

const RegistryContext = createContext(null)

export const RegistryProvider = RegistryContext.Provider

export function useRegistry() {
  const registry = useContext(RegistryContext)
  if (!registry) throw new Error("useRegistry must be used within a <Whiteboard>")
  return registry
}

export default RegistryContext
