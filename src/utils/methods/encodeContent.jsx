import Shape from "../../components/Shape/Shape"
import Line from "../../components/Line/Line"
import Text from "../../components/Text/Text"
import Path from "../../components/Path/Path"
import { resolveLineEndpoints } from "./lineGeometry"

// Pure content → JSX (extracted from useContent so any consumer can encode
// without instantiating a second content state). Lines are the one type whose
// stored properties aren't render-ready: bound endpoints resolve here against
// the same content being encoded, so a line follows its targets by construction.
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
    switch (el.type) {
      case "rectangle":
      case "oval":
        return <Shape
          key={el.uuid}
          uuid={el.uuid}
          selected={selected.has(el.uuid)}
          type={el.type}
          properties={el.properties}
        />

      case "line":
        return <Line
          key={el.uuid}
          uuid={el.uuid}
          selected={selected.has(el.uuid)}
          properties={{ ...el.properties, ...resolveLineEndpoints(el.properties, lookup) }}
        />

      case "text":
        return <Text
          key={el.uuid}
          uuid={el.uuid}
          selected={selected.has(el.uuid)}
          properties={el.properties}
          editing={editing?.uuid === el.uuid ? editing : null}
        />

      case "path":
        return <Path
          key={el.uuid}
          uuid={el.uuid}
          selected={selected.has(el.uuid)}
          properties={el.properties}
        />
    }
  })
}
