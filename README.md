# react-whiteboard-kit

A whiteboard **engine** for React — the canvas machinery you'd otherwise spend months rebuilding, so you can put your effort into whatever makes your app different.

Infinite pannable/zoomable canvas, multi-select with group transforms, connector lines that stay glued to the shapes they join, a properties panel, undo/redo that groups a drag into one step, and a command registry that keyboard shortcuts, buttons and menus all bind to. Written from scratch in React — no canvas library underneath.

> **Status: pre-alpha, not yet packaged.** It mounts as a `<Whiteboard>` component today — controlled or uncontrolled, with custom element types — but isn't published to npm yet, and nothing here is API-stable. See [Roadmap](#roadmap).

---

## The core idea

Most canvas apps render to `<canvas>` or SVG: excellent for drawing, but everything on the surface is a picture. This canvas is built from **native DOM elements** in a transformed "world" div — every object is a real node with its own markup and styles, and the browser does all the coordinate mapping and hit-testing for you.

That has a practical payoff: any element type you can render as a DOM node — a rich text block, a chart, a form, a video — is a canvas element, with no bespoke rendering or hit-testing code.

## What's built

- **Camera viewport** — pan anywhere, zoom 10%–800% anchored at the cursor. Wheel pans, Shift+wheel pans horizontally, Ctrl/⌘+wheel (or trackpad pinch) zooms. The grid and origin crosshair stay 1px-crisp at any zoom.
- **Selection** — click or marquee, any number of elements. One selection box for any count, with move, proportional resize (Shift locks aspect) and rotation (Shift snaps to 15°).
- **Connector lines** — an endpoint binds to a shape's edge and stays glued through move, resize and rotate. Straight, curved or elbow routing with arrowheads. Bindings resolve at read time, so moving a shape re-routes its lines with no write cascade.
- **Undo / redo** — whole-snapshot history where writes coalesce by *which elements × which properties*, so one drag or one burst of typing is a single `Ctrl+Z`. Undo and redo stand down while a pointer gesture is in flight, so a drag can never be undone out from under itself.
- **Command registry** — every verb declared once as `{ id, label, shortcut, enabled, run }`. Shortcuts, the zoom bar and the context menu all bind to the same declaration; no surface contains behavior.
- **Context menu** — right-click, with different menus for empty canvas, a single element (keyed by element type) and a multi-selection. Nested submenus, viewport-edge flipping, keyboard navigation.
- **Properties panel** — schema-driven live editing of the selected element's geometry and style, including a font picker and connector routing controls.
- **Element types** — rectangle, oval, line, text, and freehand ink. Three geometry kinds behind them (corner-box, directed segment, point list), each owning its own bounds/translate/resize/rotate, so a new kind is a new file rather than an edit to every transform.
- **Custom element types** — a type is a `defineElement({...})` definition: its component, geometry kind, property schema, create-defaults, toolbar tool and drag ghost. Register it through the `elements` prop and it draws, selects, resizes, rotates, binds and previews like a built-in. The sticky note in the demo is one, added with no engine edits.
- **Freehand pen** — samples coalesced pointer events for sub-frame resolution and renders quadratics through point midpoints, so strokes stay smooth at speed instead of faceting.
- **Editable text** — double-click to edit in place.

## Keyboard shortcuts

**Tools** — `V` select · `H` move · `R` rectangle · `O` oval · `L` line · `T` text · `P` pen · hold `Space` to pan momentarily, releasing returns to the previous tool

**Commands** — `Delete`/`Backspace` delete · `Ctrl+C` copy · `Ctrl+X` cut · `Ctrl+V` paste · `Ctrl+D` duplicate · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo · `Ctrl+=` / `Ctrl+-` / `Ctrl+0` zoom in / out / reset

---

## Architecture

React 19 + Vite. No state library, no router, CSS Modules. The guiding rule: **UI components are thin; all real behavior lives in custom hooks.**

- **`useCamera`** — owns `{ x, y, zoom }`. The Board is a clipping viewport div containing a world div with `transform: translate(pan) scale(zoom)`. Elements are stored in world coordinates and render untouched. `toWorld(screenX, screenY)` is the single conversion; drag deltas divide by zoom.
- **`usePointer`** — the event bridge: Pointer Events with capture, drag slop, and gesture ownership, so callbacks only fire for gestures that began on their own element.
- **Pointer session** — one per `<Whiteboard>`, shared by every `usePointer` on that canvas. It pairs the two clicks of a double-click (which land on different nodes once the selection box mounts over the element) and counts in-flight gestures, which is what lets undo stand down mid-drag. Two whiteboards on a page never see each other's clicks or gestures.
- **`useContent`** — elements plus selection, behind one internal writer with a live ref mirror so several writes in a tick each see the previous one's result. The undo stack (`methods/history.js`) and the state transitions (`methods/contentState.js`) are pure modules under unit test; the hook is what's left — React state, the mirror, and `onChange`. All operations are **plural-only** — a single element is a one-element array. Selection is a uuid list and the only source of truth; elements carry no `selected` flag, which is why a history snapshot can just be content.
- **`useCommands`** — the command registry above.
- **Tools** are hooks composing `usePointer`, all mounted unconditionally and gated by an `active` boolean.
- **`elements/`** — the element-type registry. Each type is a `defineElement({ type, render, geometry, schema, defaults, bindable, tool, preview, connector })` module, and the built-ins register through the same call a consumer will. Rendering, the property schema, geometry, connector behavior, the toolbar, tool activation and create-defaults all dispatch through it — no engine code switches on element type. A box-shaped type positions by spreading the engine-computed `boxFrame` (it never touches coordinates or the `data-uuid` hit-testing hook); lines and ink self-position, since their box is the rendered route. Adding a type is adding a definition. A definition's optional `preview` facet is its drag ghost — an object of property overrides drawn by the type's own `render`, or a function when the ghost isn't the element; omit it and the ghost *is* the element, rendered from its defaults.
- **`createRegistry` + `RegistryContext`** — the registry is a value, not a global: `createRegistry(definitions)` bundles every type-aware operation onto one object, and each `<Whiteboard>` builds its own from the built-ins plus the consumer's `elements`. Child components read it via `useRegistry()`; the hooks and pure helpers that can't read context take it as an argument. Two whiteboards on a page can carry different type sets without leaking into each other.

## Usage

```jsx
import { Whiteboard, defineElement, boxFrame } from "react-whiteboard-kit"; // (packaging pending; today: import from src)

// A custom element type — a plain component plus a definition, no engine edits.
// `boxFrame` gives a box-shaped element its position, size, rotation and the
// hit-testing hook; the component just spreads it onto its root node.
const sticky = defineElement({
  type: "sticky",
  render: (el, ctx) => (
    <StickyNote properties={el.properties} frame={boxFrame(el.properties, { uuid: el.uuid, selected: ctx.selected })} />
  ),
  geometry: "box",                        // reuse the built-in kind: move/resize/rotate for free
  bindable: true,                         // connector lines may attach to it
  defaults: { color: "#ffe066", text: "New note" },
  schema: [
    "position", "size", "rotation",       // built-in panel fields by name
    { key: "color", label: "Color", type: "color" },     // inline fields the panel never shipped with
    { key: "text", label: "Note", type: "textarea" },
  ],
  tool: { icon: StickyIcon, shortcut: "n", create: "box" },
  // No `preview`: the drag ghost is the note itself, rendered from `defaults`.
});

// Hoisted, not inline: `elements` is a dependency of the instance registry, so a
// new array each render would rebuild it every frame. A module constant or
// useMemo — the same rule as any React dependency.
const ELEMENTS = [sticky];

function App() {
  return (
    // Fills its positioned parent. Uncontrolled: it owns content; onChange reports out.
    // (For controlled use, pass `content` instead of `defaultContent` and feed it back.)
    <div style={{ width: "100vw", height: "100vh" }}>
      <Whiteboard
        defaultContent={[]}
        elements={ELEMENTS}
        onChange={(content) => console.log(content.length, "elements")}
        theme={{ accent: "#e11d48", surface: "#0b0b12" }}   // re-brand via CSS tokens
      />
    </div>
  );
}
```

Uncontrolled by default (`defaultContent` + `onChange`). Pass `content` for **controlled** use, which works the way a controlled `<input>` does: the prop is what renders, so the canvas only moves when you feed an edit back through `onChange`. Ignoring an edit, filtering it, or dropping it entirely — a read-only board — all work by simply not storing it. `onChange` fires on internal edits only, so content you pass in never echoes back out; replacing content from outside resets undo history, since the stack describes a document you discarded. Switching between controlled and uncontrolled mid-life isn't supported.

```jsx
const [content, setContent] = useState([]);

// Reject anything that would exceed a budget — the canvas simply won't move.
<Whiteboard content={content} onChange={(next) => next.length <= 50 && setContent(next)} />
```

`theme` overrides `--wb-*` design tokens (`accent`, `surface`, `grid`, `panel-bg`, `panel-fg`) that cascade to the panels and canvas — or set the same variables via `style`/CSS. Keyboard shortcuts are scoped to the focused instance, so several whiteboards coexist on one page.

## Running locally

```bash
npm install
npm run dev      # vite dev server
npm run build    # production build
npm run preview  # serve the production build
npm run lint     # eslint
npm test         # vitest
```

---

## Roadmap

Toward an engine other people can build on:

- [x] Canvas foundation — camera, DOM elements, multi-select, resize/rotate, properties panel
- [x] Connector lines with edge binding
- [x] Command registry, shortcuts, context menu
- [x] Pluggable geometry kinds + freehand pen, with a unit-test suite over the geometry
- [x] **Element-type registry** — every type is a `defineElement({...})` module in `src/elements`, registered through the same call a consumer will use, so the built-ins dogfood the extension API. Rendering, the property schema (including inline, element-supplied fields), geometry, connector bindability and behavior, the toolbar, tool activation and create-defaults all dispatch through the definitions. What still checks `type` is UI-specific, not behavior dispatch: the lone-connector endpoint chrome and text edit-activation (both selection/interaction concerns). The `sticky` note is a worked example of a custom type — component, definition, toolbar tool and all — added with no engine edits.
- [x] **`<Whiteboard>` API** — a `<Whiteboard defaultContent content onChange elements theme>` component. Uncontrolled (`defaultContent`) or fully controlled (`content` is what renders, so an edit only lands if you feed it back — see Usage), with an `onChange` readout; custom element types through `elements` (dogfooded by the `sticky` example, registered this way, not built in); re-branding through `theme` / `--wb-*` CSS tokens. Each instance owns an isolated registry via `createRegistry` + `RegistryContext`.
- [x] **Embeddability, first pass** — styles are scoped inside `Whiteboard.module.css` (no global `*`/`body` rules); the root fills its positioned parent rather than the viewport; keyboard shortcuts and the pointer session are per instance, so several whiteboards coexist on one page without sharing key handling or clicks.
- [x] **Controlled mode** — `content` is what renders, exactly like a controlled `<input>`, so vetoing, filtering and read-only boards work by doing nothing; a declined edit rolls back its undo step too.
- [ ] **Embedding hardening (next)** — board-relative pointer math (today the board must sit at the viewport's top-left), opt-in font loading instead of a Google Fonts import, `touch-action` for touch input, Cmd as well as Ctrl on macOS, the line/text/pen gestures for custom types (only `create: "box"` is generic today), memoized element rendering, and dev-mode validation of incoming content.
- [ ] **Packaging** — Vite library mode, exports map, React as a peer dependency, a license
- [ ] Z-order operations and grouping
- [ ] Persistence and a serialization format
- [ ] TypeScript, once the API has settled

## Known limitations

Things a consumer will hit today, most consequential first. The first group is what the *Embedding hardening* roadmap item covers.

- **The board must sit at the viewport's top-left.** Pointer input is converted with viewport coordinates, but the camera is board-relative, so a whiteboard below a header or beside a sidebar draws, selects and binds at an offset. Drags are unaffected. The demo works because its host is full-viewport.
- **Fonts load from Google.** The UI font is an `@import` in the engine's stylesheet and the text-element families come from the demo's `index.html`, so the engine makes network requests on mount and has no offline or strict-CSP story yet.
- **Mouse and trackpad only.** `touch-action` isn't set, so touch drags fight the page scroll, and there's no two-finger pinch — zoom is wheel-only.
- **Shortcuts are Ctrl-only.** Cmd+Z, Cmd+C and friends don't match on macOS. Ctrl still works there.
- **Only `create: "box"` is generic.** A custom type declaring the `line`, `text` or `pen` gesture gets the built-in type drawn instead of itself. Bind anchors also read box corners directly, so a bindable custom type on the `path` kind can't be bound to.
- **A definition's `render` is called as a function, not mounted as a component.** If it needs hooks, return a component element (as every built-in does) rather than calling hooks inline.
- **Nothing is memoized.** Every pointermove re-renders every element, which is fine for a few hundred and not for a few thousand.
- **Incoming content isn't validated.** Duplicate uuids or an element without `properties` fail deep inside rendering rather than at the prop.
- **Text has no colour property**, and only six theme tokens exist; a light theme isn't achievable yet.
- **No programmatic API.** No `onSelectionChange`, no way to select or move the camera from outside, no zoom-to-fit. `onChange` fires on every pointermove of a drag with no end-of-gesture signal.
- **Copy and paste are internal** to one instance — nothing reaches the system clipboard.
- **The content format is unversioned.** `[{ type, uuid, properties }]` is the persistence shape, with no migration path declared yet.
- The marquee ignores rotation — it tests unrotated bounding boxes, so a rotated element's visual overhang doesn't register hits. Click-selection is exact.
- Line chrome and marquee hit-testing are routing-unaware: a curve's belly or an elbow's stubs fall outside the selection box.
- Elbow routes have no obstacle avoidance.
- Group resize scales a text element's box, not its font size.
- No persistence — reloading clears the canvas.
- Tests cover the pure modules — geometry, the element registry, history and content transitions — plus `Preview` and `Properties` through static rendering. The React wiring itself (hooks, pointer gestures, camera) is hand-verified.
