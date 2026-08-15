import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Whiteboard.module.css';
import { createRegistry, BUILTIN_ELEMENTS } from './elements';
import { RegistryProvider } from './elements/RegistryContext';
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

const SELECTION_TOOLS = ['select', 'move'];

// The embeddable whiteboard — the engine's public entry point.
//
//   defaultContent   initial elements for UNCONTROLLED use: the canvas owns its
//                    content state; `onChange` reports every change back out.
//   content          CONTROLLED use: pass this (with onChange) and the parent owns
//                    content — drive it by setting the prop, pass it back as-is in
//                    onChange. When present it wins over defaultContent.
//   onChange(content) called whenever content changes (not on mount).
//   elements         custom element definitions (from defineElement), added to
//                    the built-ins for THIS instance's registry only — two
//                    whiteboards can carry different type sets.
//   theme            optional token overrides, e.g. { accent: "#e11", surface:
//                    "#0b0b12" }. Each key maps to the `--wb-<key>` CSS variable
//                    on the root (a full `--wb-…` key is passed through as-is);
//                    tokens cascade to every panel and canvas element. Equivalent
//                    to setting the same variables via `style`.
//   className/style  applied to the root, which fills its positioned parent.
//
// The instance registry is the spine: provided to child components via context
// and passed to the hooks and pure helpers (which can't read context) as an
// argument, so nothing reaches for a module-level global.
// Map a `theme` object to CSS custom properties: `accent` → `--wb-accent`, and a
// key already in `--wb-…` form is kept verbatim.
function themeVars(theme) {
  if (!theme) return null;
  const out = {};
  for (const [key, value] of Object.entries(theme)) {
    out[key.startsWith("--") ? key : `--wb-${key}`] = value;
  }
  return out;
}

export default function Whiteboard({ defaultContent = [], content, onChange, elements = [], theme, className, style }) {
  const boardRef = useRef(null);
  // The focusable instance root. Keyboard shortcuts attach here (not window), so
  // two whiteboards on a page don't share key handling — only the focused one
  // responds. A canvas pointerdown focuses it (below).
  const rootRef = useRef(null);

  // Built-ins + the consumer's custom types, rebuilt only when the custom set
  // changes.
  const registry = useMemo(() => createRegistry([...BUILTIN_ELEMENTS, ...elements]), [elements]);

  const [activeTool, setActiveTool] = useState("select");
  // Controlled when `content` is passed, else uncontrolled from defaultContent.
  const {content: liveContent, selectedElements, getElement, addElements, selectElements, updateElements, deleteElements, undo, redo, canUndo, canRedo} = useContent(registry, content ?? defaultContent, content);
  const {camera, panBy, zoomTo, toWorld} = useCamera(boardRef);
  const {preview, enablePreview, disablePreview} = usePreview();

  // Uncontrolled + onChange: emit content changes to the consumer, skipping the
  // initial mount so `onChange` means "changed", not "mounted". `onChange` rides
  // a ref so a consumer's inline callback doesn't re-fire the effect on identity
  // change — only a real content change does.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) onChangeRef.current?.(liveContent);
    else mounted.current = true;
  }, [liveContent]);

  // uuid of the element being edited in place, or null. Only text elements are
  // editable — SelectionBox reports the double-click, this decides what it means.
  const [editingElement, setEditingElement] = useState(null);
  const startEditing = (uuid) => {
    if (getElement(uuid)?.type === "text") setEditingElement(uuid);
  };

  // A session is only live while its element is still the selection. Clicking
  // away, switching tools and deleting all deselect, so deriving this closes the
  // session for every one of them — no sync effect, and no stale-uuid reopen.
  const editing = editingElement && selectedElements.includes(editingElement)
    ? editingElement
    : null;

  // One definition of "what would a line endpoint bind to at this world point",
  // shared by both binding gestures (drawing a line, dragging an endpoint), so
  // they agree — including the zoom-scaled pick radius and this instance's set
  // of bindable types.
  const hitTest = (wx, wy) => bindTargetAt(registry, liveContent, { x: wx, y: wy }, camera.zoom);

  // The command registry: every app verb declared once, consumed by shortcuts,
  // ZoomBar and the context menu.
  const {commands, runCommand} = useCommands({ registry, selectedElements, getElement, addElements, deleteElements, camera, zoomTo, undo, redo, canUndo, canRedo });

  // Right-click: decides which menu the click means (and selects under the
  // cursor when needed).
  const {contextMenu, closeContextMenu} = useContextMenu(boardRef, {
    selectionActive: SELECTION_TOOLS.includes(activeTool),
    selectedElements, selectElements, getElement, toWorld,
  });

  useEffect(() => {
    if (selectedElements.length && !SELECTION_TOOLS.includes(activeTool)) selectElements([]);
  }, [activeTool, selectedElements]);

  // Install Tool Hooks. Element-creating tools are gated by their definition's
  // `create` gesture (from the registry), so adding a box-shaped type needs no
  // wiring here. select/move aren't element types, so they stay gated by name.
  // Every hook is mounted unconditionally and gated by the `active` boolean
  // (Rules of Hooks).
  const create = registry.definitionOf(activeTool)?.tool?.create;

  useSelectTool(registry, boardRef, activeTool === 'select', liveContent, selectElements, toWorld, enablePreview, disablePreview)
  useMoveTool(boardRef, activeTool === 'move', panBy)
  useBoxTool(registry, boardRef, create === 'box', activeTool, toWorld, enablePreview, disablePreview, addElements, setActiveTool)
  useLineTool(registry, boardRef, create === 'line', hitTest, toWorld, enablePreview, disablePreview, addElements, setActiveTool)
  useTextTool(registry, boardRef, create === 'text', toWorld, enablePreview, disablePreview, addElements, setActiveTool)
  usePenTool(registry, boardRef, create === 'pen', toWorld, enablePreview, disablePreview, addElements, setActiveTool)

  useShortcuts(registry, rootRef, activeTool, setActiveTool, commands);

  // Focus the instance so its shortcuts fire here — but not when the user is
  // engaging a control that needs its own focus (panel inputs, the in-canvas text
  // editor), which would otherwise steal the caret. Buttons don't keep focus, so
  // clicking a tool still activates the canvas.
  const focusSelf = (e) => {
    if (!e.target.closest('input, textarea, select, [contenteditable="true"]')) {
      rootRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <RegistryProvider value={registry}>
      <div
        ref={rootRef}
        tabIndex={-1}
        onPointerDown={focusSelf}
        className={className ? `${styles.whiteboard} ${className}` : styles.whiteboard}
        style={{ ...themeVars(theme), ...style }}
      >
        <Board
          boardRef={boardRef}
          content={liveContent}
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
        <div className={styles.interface}>
          <div className={styles.properties}>
            <Properties
              selectedElements={selectedElements}
              getElement={getElement}
              updateElements={updateElements}
            />
          </div>
          <div className={styles.toolbar}>
            <Toolbar
              activeTool={activeTool}
              setActiveTool={setActiveTool}
            />
          </div>
          <div className={styles.zoombar}>
            <ZoomBar zoom={camera.zoom} runCommand={runCommand} />
          </div>
          {/* Last, so it paints above the other panels. The first surface handed
              `commands` itself rather than just `runCommand` — a menu needs each
              command's label, shortcut and enabled() to render it. */}
          <ContextMenu
            menu={contextMenu}
            commands={commands}
            runCommand={runCommand}
            onClose={closeContextMenu}
          />
        </div>
      </div>
    </RegistryProvider>
  )
}
