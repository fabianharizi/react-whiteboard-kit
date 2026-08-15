import styles from './Board.module.css'
import encodeContent from '../../utils/methods/encodeContent'
import { resolveElement } from '../../elements/connector'
import SelectionBox from '../SelectionBox/SelectionBox'
import Preview from '../Preview/Preview'

// The board is the camera viewport: it clips, carries the camera CSS variables,
// and receives all pointer/wheel input. The world div inside it is translated
// and scaled by the camera; its children are positioned in world coordinates.

export default function Board({boardRef, content, camera, toWorld, preview, selectedElements, getElement, updateElements, hitTest, selectionInteractive, editingElement, onEditStart, onEditEnd}){
  // The SelectionBox works on effective geometry: a connector's endpoints resolve
  // against the live content, so bounds/handles sit where it renders.
  const lookup = (uuid) => content.find(el => el.uuid === uuid)

  // The in-place edit session, assembled here because Board already owns the
  // write path. Edits go through updateElements like every other mutation.
  const editing = editingElement && {
    uuid: editingElement,
    onChange: (content) => updateElements([{ uuid: editingElement, properties: { content } }]),
    onEnd: onEditEnd,
  }

  return (
    <div
      className={styles.board}
      ref={boardRef}
      style={{
        '--cam-x': camera.x + 'px',
        '--cam-y': camera.y + 'px',
        '--cam-zoom': camera.zoom,
      }}
    >
      <div className={styles.world}>
        {encodeContent(content, selectedElements, editing)}
        {preview && <Preview {...preview} />}
        {selectedElements.length > 0 && <SelectionBox
          elements={selectedElements.map(getElement).filter(Boolean).map(el => resolveElement(el, lookup))}
          zoom={camera.zoom}
          toWorld={toWorld}
          updateElements={updateElements}
          hitTest={hitTest}
          interactive={selectionInteractive}
          onActivate={onEditStart}
        />}
      </div>
    </div>
  )
}
