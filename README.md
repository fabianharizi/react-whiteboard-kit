# react-whiteboard-kit

A whiteboard **engine** for React — the canvas machinery you'd otherwise spend months rebuilding, so you can put your effort into whatever makes your app different.

Infinite pannable/zoomable canvas, multi-select with group transforms, connector lines that stay glued to the shapes they join, a properties panel, undo/redo that groups a drag into one step, and a command registry that keyboard shortcuts, buttons and menus all bind to. Written from scratch in React — no canvas library underneath.

> **Status: pre-alpha, not yet packaged.** This runs today as an app you can clone and drive. The extension API and npm distribution are the next milestones — see [Roadmap](#roadmap). Nothing here is API-stable.

---

## The core idea

Most canvas apps render to `<canvas>` or SVG: excellent for drawing, but everything on the surface is a picture. This canvas is built from **native DOM elements** in a transformed "world" div — every object is a real node with its own markup and styles, and the browser does all the coordinate mapping and hit-testing for you.

That has a practical payoff: any element type you can render as a DOM node — a rich text block, a chart, a form, a video — is a canvas element, with no bespoke rendering or hit-testing code.

## What's built

- **Camera viewport** — pan anywhere, zoom 10%–800% anchored at the cursor. Wheel pans, Shift+wheel pans horizontally, Ctrl/⌘+wheel (or trackpad pinch) zooms. The grid and origin crosshair stay 1px-crisp at any zoom.
- **Selection** — click or marquee, any number of elements. One selection box for any count, with move, proportional resize (Shift locks aspect) and rotation (Shift snaps to 15°).
- **Connector lines** — an endpoint binds to a shape's edge and stays glued through move, resize and rotate. Straight, curved or elbow routing with arrowheads. Bindings resolve at read time, so moving a shape re-routes its lines with no write cascade.
- **Undo / redo** — whole-snapshot history where writes coalesce by *which elements × which properties*, so one drag or one burst of typing is a single `Ctrl+Z`.
- **Command registry** — every verb declared once as `{ id, label, shortcut, enabled, run }`. Shortcuts, the zoom bar and the context menu all bind to the same declaration; no surface contains behavior.
- **Context menu** — right-click, with different menus for empty canvas, a single element (keyed by element type) and a multi-selection. Nested submenus, viewport-edge flipping, keyboard navigation.
- **Properties panel** — schema-driven live editing of the selected element's geometry and style, including a font picker and connector routing controls.
- **Element types** — rectangle, oval, line, text, and freehand ink. Three geometry kinds behind them (corner-box, directed segment, point list), each owning its own bounds/translate/resize/rotate, so a new kind is a new file rather than an edit to every transform.
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
- **`useContent`** — elements plus selection, behind one internal writer with a live ref mirror so several writes in a tick each see the previous one's result. All operations are **plural-only** — a single element is a one-element array. Selection is a uuid list and the only source of truth; elements carry no `selected` flag, which is why a history snapshot can just be content.
- **`useCommands`** — the command registry above.
- **Tools** are hooks composing `usePointer`, all mounted unconditionally and gated by an `active` boolean.
- **`elements/`** — the element-type registry. Each type is a `defineElement({ type, render, geometry, schema, defaults, bindable, tool })` module, and the built-ins register through the same call a consumer will. Rendering (`encodeContent`) and the property schema dispatch through it today. A box-shaped type positions by spreading the engine-computed `boxFrame` (it never touches coordinates or the `data-uuid` hit-testing hook); lines and ink self-position, since their box is the rendered route. Adding a type is adding a definition.

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
- [~] **Element-type registry** *(in progress)* — every type is a `defineElement({...})` module in `src/elements`, registered through the same call a consumer will use, so the built-ins dogfood the extension API. Rendering, the property schema (including inline, element-supplied fields), the geometry kind, connector bindability, the toolbar and tool activation all dispatch through it today; the remaining per-tool create-defaults and the connector special-cases are next. The `sticky` note is a worked example of a custom type — component, definition, toolbar tool and all — added with no engine edits.
- [ ] **Embeddability** — drop the global `*`/`body` CSS, container-relative layout instead of `100vw/100vh`, listeners scoped to the board
- [ ] **`<Whiteboard>` API** — `content`/`onChange`, custom element types, theming
- [ ] **Packaging** — Vite library mode, exports map, React as a peer dependency, a license
- [ ] Z-order operations and grouping
- [ ] Persistence and a serialization format
- [ ] TypeScript, once the API has settled

## Known limitations

- The marquee ignores rotation — it tests unrotated bounding boxes, so a rotated element's visual overhang doesn't register hits. Click-selection is exact.
- Line chrome and marquee hit-testing are routing-unaware: a curve's belly or an elbow's stubs fall outside the selection box.
- Elbow routes have no obstacle avoidance.
- Group resize scales a text element's box, not its font size.
- No persistence — reloading clears the canvas.
- Tests cover the geometry and math modules only; nothing exercises the React components.
