import { MousePointer2, Hand } from "lucide-react";
import { DEFINITIONS } from "../../elements";

// The toolbar's tools, as consumed by Toolbar and useShortcuts.
//
// shortcut: sticky key press that switches to the tool and stays.
// momentary: key that activates the tool only while held, restoring the
//            previous tool on release (e.g. hold Space to temporarily pan).
//
// NAVIGATION tools are NOT element types — they change how you interact with the
// canvas rather than create anything — so they're declared here by hand. The
// ELEMENT tools are derived from the registry: each definition's `tool` metadata
// (icon, shortcut) becomes a button, so adding an element type puts its tool in
// the toolbar with no edit to this file. `create` (which drawing gesture makes
// it) is carried through for App to wire the matching tool hook.

const NAVIGATION = [
  { id: "select", icon: MousePointer2, shortcut: "v" },
  { id: "move", icon: Hand, shortcut: "h", momentary: " " },
];

const ELEMENTS = DEFINITIONS
  .filter(def => def.tool)
  .map(def => ({
    id: def.type,
    icon: def.tool.icon,
    shortcut: def.tool.shortcut,
  }));

const toolset = [NAVIGATION, ELEMENTS];

export default toolset;
