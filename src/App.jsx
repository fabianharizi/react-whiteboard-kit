import { useEffect, useRef, useState } from 'react';
import './App.css'
import Board from './components/Board/Board';
import Toolbar from './components/Toolbar/Toolbar';
import Properties from './components/Properties/Properties';
import ZoomBar from './components/ZoomBar/ZoomBar';
import ContextMenu from './components/ContextMenu/ContextMenu';
import useContent from './utils/hooks/useContent';
import useCamera from './utils/hooks/useCamera';
import usePreview from './utils/hooks/usePreview';
import useSelectTool from './utils/tools/useSelectTool';
import useMoveTool from './utils/tools/useMoveTool';
import useBoxTool from './utils/tools/useBoxTool';
import useLineTool from './utils/tools/useLineTool';
import useTextTool from './utils/tools/useTextTool';
import usePenTool from './utils/tools/usePenTool';
import useShortcuts from './utils/hooks/useShortcuts';
import useCommands from './utils/hooks/useCommands';
import useContextMenu from './utils/hooks/useContextMenu';
import { bindTargetAt } from './utils/methods/hitTest';
import { definitionOf } from './elements';

const SELECTION_TOOLS = ['select', 'move'];

// DEMO seed: one instance of the example `sticky` custom element (src/elements/
// sticky.jsx) on load, as a hello-world for the extension path. You can also
// draw your own with the sticky tool (N). Select it to see its inline color/text
// fields in the panel; move/resize/rotate work via the "box" geometry it reused.
// Safe to delete.
const DEMO_CONTENT = [
  {
    type: "sticky",
    uuid: "demo-sticky",
    properties: {
      startX: 160, startY: 140, endX: 380, endY: 300,
      color: "#ffe066",
      text: "I'm a custom element.\n\nDefined with defineElement —\nno engine edits, just a\ncomponent + a definition.",
    },
  },
];

export default function App(){
  const boardRef = useRef(null);

  const [activeTool, setActiveTool] = useState("select");
  const {content, selectedElements, getElement, addElements, selectElements, updateElements, deleteElements, undo, redo, canUndo, canRedo} = useContent(DEMO_CONTENT);
  const {camera, panBy, zoomTo, toWorld} = useCamera(boardRef);
  const {preview, enablePreview, disablePreview} = usePreview();

  // uuid of the element being edited in place, or null. Only text elements are
  // editable — SelectionBox reports the double-click, App decides what it means.
  const [editingElement, setEditingElement] = useState(null);
  const startEditing = (uuid) => {
    if (getElement(uuid)?.type === "text") setEditingElement(uuid);
  };

  // A session is only live while its element is still the selection. Clicking
  // away, switching tools and deleting all deselect, so deriving this closes
  // the session for every one of them — no sync effect, and no chance of a
  // stale uuid silently reopening an editor on the next selection.
  const editing = editingElement && selectedElements.includes(editingElement)
    ? editingElement
    : null;

  // One definition of "what would a line endpoint bind to at this world point",
  // shared by both binding gestures — drawing with the line tool and dragging an
  // endpoint handle — so they agree, including on the zoom-scaled pick radius.
  const hitTest = (wx, wy) => bindTargetAt(content, { x: wx, y: wy }, camera.zoom);

  // The command registry: every app verb declared once (delete/copy/cut/paste/
  // duplicate/zoom...), consumed by shortcuts, ZoomBar, and future menus.
  const {commands, runCommand} = useCommands({ selectedElements, getElement, addElements, deleteElements, camera, zoomTo, undo, redo, canUndo, canRedo });

  // Right-click: decides which menu the click means (and selects under the
  // cursor when needed). The menu itself renders the registry above.
  const {contextMenu, closeContextMenu} = useContextMenu(boardRef, {
    selectionActive: SELECTION_TOOLS.includes(activeTool),
    selectedElements, selectElements, getElement, toWorld,
  });

  useEffect(() => {
    if (selectedElements.length && !SELECTION_TOOLS.includes(activeTool)) selectElements([]);
  }, [activeTool, selectedElements]);

  // Install Tool Hooks. Element-creating tools are gated by their definition's
  // `create` gesture (from the registry), so adding a box-shaped type needs no
  // wiring here — it just declares `tool.create: "box"`. select/move aren't
  // element types, so they stay gated by name. Every hook is mounted
  // unconditionally and gated by the `active` boolean (Rules of Hooks).
  const create = definitionOf(activeTool)?.tool?.create;

  useSelectTool(
    boardRef,
    activeTool === 'select',
    content,
    selectElements,
    toWorld,
    enablePreview,
    disablePreview
  )
  useMoveTool(
    boardRef,
    activeTool === 'move',
    panBy
  )
  useBoxTool(
    boardRef,
    create === 'box',
    activeTool,
    toWorld,
    enablePreview,
    disablePreview,
    addElements,
    setActiveTool
  )
  useLineTool(
    boardRef,
    create === 'line',
    hitTest,
    toWorld,
    enablePreview,
    disablePreview,
    addElements,
    setActiveTool
  )
  useTextTool(
    boardRef,
    create === 'text',
    toWorld,
    enablePreview,
    disablePreview,
    addElements,
    setActiveTool
  )
  usePenTool(
    boardRef,
    create === 'pen',
    toWorld,
    enablePreview,
    disablePreview,
    addElements,
    setActiveTool
  )

  // Install shortcuts — key bindings come from the registry.
  useShortcuts(activeTool, setActiveTool, commands);

  return (
    <>
      <main className="container">
        <Board
          boardRef={boardRef}
          content={content}
          camera={camera}
          toWorld={toWorld}
          preview={preview}
          selectedElements={selectedElements}
          getElement={getElement}
          updateElements={updateElements}
          // The selection box covers the element it wraps, so it has to stand
          // down while editing or the caret could never reach the textarea.
          hitTest={hitTest}
          selectionInteractive={activeTool === 'select' && !editing}
          editingElement={editing}
          onEditStart={startEditing}
          onEditEnd={() => setEditingElement(null)}
        />
        <div className="interface">
          <div className="properties">
            <Properties
              selectedElements={selectedElements}
              getElement={getElement}
              updateElements={updateElements}
            />
          </div>
          <div className="toolbar">
            <Toolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
            />
          </div>
          <div className="zoombar">
            <ZoomBar zoom={camera.zoom} runCommand={runCommand} />
          </div>
          {/* Last, so it paints above the other panels. The first surface handed
              `commands` itself rather than just `runCommand` — a menu needs
              each command's label, shortcut and enabled() to render it. */}
          <ContextMenu
            menu={contextMenu}
            commands={commands}
            runCommand={runCommand}
            onClose={closeContextMenu}
          />
        </div>
      </main>
    </>
  )
}
