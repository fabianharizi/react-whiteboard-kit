import { cloneElement } from "react"
import { elementOf } from "../../elements"

// Pure content → JSX. Each element's definition owns its own render (component,
// props, positioning frame); this just looks the definition up and calls it, so
// adding a type never touches this file. Lines are the one type whose stored
// properties aren't render-ready — their definition resolves bound endpoints
// against `lookup`, the same content being encoded, so a line follows its
// targets by construction.
//
// `selectedElements` is the uuid list from useContent — the single source of
// truth for selection. Elements don't store a `selected` flag; it's derived here
// at render, so nothing can desync (and so a history snapshot is just content).
//
// `editing` is the optional in-place edit session — `{ uuid, onChange, onEnd }`
// — handed to the one element it names (text only, today).

export default function encodeContent(content, selectedElements = [], editing = null) {
  const byId = new Map(content.map(el => [el.uuid, el]))
  const lookup = (uuid) => byId.get(uuid)
  const selected = new Set(selectedElements)

  return content.map(el => {
    const def = elementOf(el)
    if (!def) return null                      // unknown type renders nothing

    const node = def.render(el, {
      selected: selected.has(el.uuid),
      editing: editing?.uuid === el.uuid ? editing : null,
      lookup,
    })

    // The definition returns a bare element; the key is the engine's concern.
    return node ? cloneElement(node, { key: el.uuid }) : null
  })
}
