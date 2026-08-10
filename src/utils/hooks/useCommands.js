import { useRef } from "react";
import UUID from "../methods/UUID";
import { resolveLineEndpoints } from "../methods/lineGeometry";
import { geometryOf } from "../geometry";

// The command registry: every app function (verb) declared once as data, so
// each surface — shortcuts, buttons, future menus / context menu / palette —
// binds to the same declaration instead of re-implementing behavior.
//
// A command: { id, label, shortcut?, enabled?, run }
//   - shortcut: string or array of strings ("ctrl+c", ["delete","backspace"]);
//     consumed by useShortcuts with exact modifier matching.
//   - enabled:  optional predicate; falsy result blocks run() everywhere
//     (shortcuts no-op, buttons/menus can gray out).
//
// Commands are verbs (fire-and-forget). Tools are modes and stay in toolset.js;
// a command MAY activate a mode, never the reverse.

export default function useCommands({ selectedElements, getElement, addElements, deleteElements, camera, zoomTo, undo, redo, canUndo, canRedo }) {
  // Clipboard is copy/paste-internal state — it lives here, not in App.
  const clipboard = useRef(null);

  const hasSelection = () => selectedElements.length > 0;

  // Properties are otherwise flat, so a spread is enough — except for a path's
  // `points`, where a shared array reference would let a later edit reach back
  // into the clipboard (or vice versa).
  const cloneProperties = (properties) => ({
    ...properties,
    ...(properties.points ? { points: properties.points.map(p => ({ ...p })) } : {}),
  });

  // Type + properties snapshots of the current selection. `source` keeps the
  // copied element's uuid so bindings can be remapped at spawn (fresh uuids are
  // minted then). Line snapshots bake their RESOLVED endpoints and keep a
  // binding only when its target is also in the selection — a line copied
  // without its target pastes detached at its current position, never silently
  // bound to the original.
  const snapshotSelection = () => {
    const selected = new Set(selectedElements);
    return selectedElements
      .map(getElement)
      .filter(Boolean)
      .map(el => {
        // A shallow copy leaves array-valued properties (a path's `points`)
        // aliased between the snapshot and the live element, so clone those.
        if (el.type !== "line") return { type: el.type, source: el.uuid, properties: cloneProperties(el.properties) };

        const r = resolveLineEndpoints(el.properties, getElement);
        const keep = (binding) => (binding && selected.has(binding.uuid)) ? binding : null;
        return {
          type: "line",
          source: el.uuid,
          properties: {
            ...el.properties,
            startX: r.startX, startY: r.startY,
            endX: r.endX, endY: r.endY,
            startBinding: keep(el.properties.startBinding),
            endBinding: keep(el.properties.endBinding),
          }
        };
      });
  };

  // Materialize snapshots as new elements, offset so they don't cover their
  // sources; addElements selects exactly the spawned set. Uuids are minted for
  // the whole batch first so kept bindings remap onto the spawned copies.
  const spawnItems = (items) => {
    const minted = new Map(items.map(item => [item.source, UUID.generate(item.type.slice(0, 4))]));
    const remap = (binding) => (binding && minted.has(binding.uuid))
      ? { ...binding, uuid: minted.get(binding.uuid) }
      : null;

    addElements(items.map(item => ({
      type: item.type,
      uuid: minted.get(item.source),
      properties: {
        ...item.properties,
        // Each kind offsets itself. This used to add 20 to four hardcoded
        // coordinates, which a path (which has none) turned into NaN.
        ...geometryOf(item).translate(item.properties, 20, 20),
        ...(item.type === "line" ? {
          startBinding: remap(item.properties.startBinding),
          endBinding: remap(item.properties.endBinding),
        } : {}),
      }
    })));
  };

  // Declared so every surface can render them before they work; `run` lands
  // later. Disabled on purpose — a menu item that looks live but does nothing
  // is worse than a grey one. Filling one in = replace `enabled` and `run`.
  const pending = (id, label, shortcut) => ({ id, label, shortcut, enabled: () => false, run: () => {} });

  const commands = [
    // History first — this is also the order a future menu renders in.
    // useContent coalesces writes, so one drag or typing burst is one step.
    {
      id: "undo",
      label: "Undo",
      shortcut: "ctrl+z",
      enabled: () => canUndo,
      run: undo,
    },
    {
      id: "redo",
      label: "Redo",
      shortcut: ["ctrl+shift+z", "ctrl+y"],
      enabled: () => canRedo,
      run: redo,
    },
    {
      id: "delete",
      label: "Delete",
      shortcut: ["delete", "backspace"],
      enabled: hasSelection,
      run: () => deleteElements(selectedElements),
    },
    {
      id: "copy",
      label: "Copy",
      shortcut: "ctrl+c",
      enabled: hasSelection,
      run: () => { clipboard.current = snapshotSelection(); },
    },
    {
      id: "cut",
      label: "Cut",
      shortcut: "ctrl+x",
      enabled: hasSelection,
      run: () => {
        clipboard.current = snapshotSelection();
        deleteElements(selectedElements);
      },
    },
    {
      id: "paste",
      label: "Paste",
      shortcut: "ctrl+v",
      enabled: () => !!clipboard.current?.length,
      run: () => spawnItems(clipboard.current),
    },
    {
      id: "duplicate",
      label: "Duplicate",
      shortcut: "ctrl+d",
      enabled: hasSelection,
      run: () => spawnItems(snapshotSelection()),   // clipboard untouched
    },
    {
      id: "zoom-in",
      label: "Zoom in",
      shortcut: "ctrl+=",
      run: () => zoomTo(camera.zoom * 1.25),
    },
    {
      id: "zoom-out",
      label: "Zoom out",
      shortcut: "ctrl+-",
      run: () => zoomTo(camera.zoom / 1.25),
    },
    {
      id: "zoom-reset",
      label: "Zoom to 100%",
      shortcut: "ctrl+0",
      run: () => zoomTo(1),
    },

    // --- Not implemented yet -------------------------------------------------
    // The context menu renders these greyed. Note useShortcuts preventDefaults a
    // matched combo even when disabled, so these keys are already the app's.
    //
    // select-all is a one-liner when wanted: selectElements(content.map(el => el.uuid))
    // — it just needs `content` + `selectElements` added to this hook's deps.
    pending("select-all", "Select all", "ctrl+a"),
    // paste-here wants the world point under the cursor; spawnItems would need a
    // position parameter instead of its hardcoded +20 offset.
    pending("paste-here", "Paste here"),
    // Content array order IS z-order (see hitTest.js), but useContent exposes no
    // reorder mutator yet — these need one that goes through `mutate` to be undoable.
    pending("bring-front", "Bring to front", "ctrl+shift+]"),
    pending("bring-forward", "Bring forward", "ctrl+]"),
    pending("send-backward", "Send backward", "ctrl+["),
    pending("send-back", "Send to back", "ctrl+shift+["),
    pending("group", "Group", "ctrl+g"),
    pending("ungroup", "Ungroup", "ctrl+shift+g"),
  ];

  // For buttons/menus: run a command by id, honoring its enabled predicate.
  const runCommand = (id) => {
    const command = commands.find(c => c.id === id);
    if (!command || command.enabled?.() === false) return;
    command.run();
  };

  return {
    "commands": commands,
    "runCommand": runCommand
  };
}
