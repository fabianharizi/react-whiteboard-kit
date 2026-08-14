import { useEffect, useRef, useState } from "react"
import {
  AlignLeft, AlignCenter, AlignRight,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  ChevronDown, Italic, Type,
} from "lucide-react"
import styles from "./Properties.module.css"
import { resolveLineEndpoints } from "../../utils/methods/lineGeometry"
import { geometryOf } from "../../utils/geometry"
import { schemaOf } from "../../elements"
import { FONT_FAMILIES, WEIGHTS, fontStack } from "../../utils/methods/fonts"
import {
  StrokeSolid, StrokeDashed, StrokeDotted,
  HeadNone, HeadArrowStart, HeadArrowEnd,
  RouteStraight, RouteCurved, RouteElbow,
} from "./icons"

// Which properties each element type exposes, and in what order, now lives on
// the element definitions (schemaOf, from the registry) — this panel no longer
// knows the set of types. A schema entry is either a built-in field NAME below
// or an inline field DEFINITION object; resolveField handles both.
//
// Geometry note: elements store two corners (startX, startY, endX, endY) in
// WORLD coords. Shapes and text expose a derived position/size box; lines
// expose their endpoints directly, because a line's direction is meaningful.
// A bound line endpoint displays its RESOLVED (glued) position; typing into
// either of its fields bakes both coords and detaches that end — predictable,
// instead of numbers that fight the resolver.

// Mirrors the per-component defaults, so an absent property still shows a value.
const DEFAULTS = {
  fill: "#ffffff",
  strokeColor: "#ffffff",
  strokeWidth: 2,
  strokeStyle: "solid",
  borderRadius: 0,
  opacity: 1,
  rotation: 0,
  content: "",
  horizontal: "left",
  vertical: "top",
  fontFamily: "DM Sans",
  fontSize: 16,
  fontWeight: "400",
  fontStyle: "normal",
  routing: "straight",
  headStart: "none",
  headEnd: "arrow",
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)

// Field types whose row can't be a <label>: they hold several controls, or
// buttons rather than a labelable input.
const MULTI_CONTROL = new Set(["pair", "combo", "icons", "iconSelect"])

// Elements that don't store two corners need their box derived and written back
// differently. `position`/`size` are shared across every box-ish type, so the
// branch lives here rather than in a per-type field — which is exactly the kind
// of scattering the element-type registry is meant to remove. When that lands,
// these should collapse into each type's own schema.
const isPath = (p) => Array.isArray(p.points)
const pathBounds = (p) => geometryOf({ type: "path" }).bounds(p)

// Move a path so its bounding box's `edge` (left/top) lands on `v`.
const movePathTo = (p, edge, v) => {
  const b = pathBounds(p)
  const d = v - b[edge]
  return geometryOf({ type: "path" }).translate(p, edge === "left" ? d : 0, edge === "left" ? 0 : d)
}

// Scale a path so its bounding box takes on `v` along one axis, anchored at its
// top-left — the same corner `size` anchors a box at.
const scalePathTo = (p, axis, v) => {
  const b = pathBounds(p)
  const next = axis === "width"
    ? { ...b, right: b.left + v }
    : { ...b, bottom: b.top + v }
  return geometryOf({ type: "path" }).mapIntoBox(p, b, next)
}

// A "pair" field renders two number inputs on one row. Each part derives its value
// from the stored corners (`get`) and returns the corner patch to write (`set`),
// so `position`/`size` stay a single conceptual property in the schema.
const FIELDS = {
  position: {
    label: "Position",
    type: "pair",
    parts: [
      { key: "x", prefix: "X",
        get: (p) => Math.round(isPath(p) ? pathBounds(p).left : Math.min(num(p.startX), num(p.endX))),
        set: (p, v) => isPath(p)
          ? movePathTo(p, "left", v)
          : ({ startX: v, endX: v + Math.abs(num(p.endX) - num(p.startX)) }) },
      { key: "y", prefix: "Y",
        get: (p) => Math.round(isPath(p) ? pathBounds(p).top : Math.min(num(p.startY), num(p.endY))),
        set: (p, v) => isPath(p)
          ? movePathTo(p, "top", v)
          : ({ startY: v, endY: v + Math.abs(num(p.endY) - num(p.startY)) }) },
    ],
  },

  size: {
    label: "Size",
    type: "pair",
    parts: [
      { key: "width", prefix: "W", min: 0,
        get: (p) => Math.round(isPath(p)
          ? pathBounds(p).right - pathBounds(p).left
          : Math.abs(num(p.endX) - num(p.startX))),
        set: (p, v) => {
          if (isPath(p)) return scalePathTo(p, "width", v)
          const x = Math.min(num(p.startX), num(p.endX))
          return { startX: x, endX: x + v }
        } },
      { key: "height", prefix: "H", min: 0,
        get: (p) => Math.round(isPath(p)
          ? pathBounds(p).bottom - pathBounds(p).top
          : Math.abs(num(p.endY) - num(p.startY))),
        set: (p, v) => {
          if (isPath(p)) return scalePathTo(p, "height", v)
          const y = Math.min(num(p.startY), num(p.endY))
          return { startY: y, endY: y + v }
        } },
    ],
  },

  // Editing a bound endpoint detaches it: both coords bake (the untyped axis
  // would otherwise fall back to a stale raw value) and the binding clears.
  start: {
    label: "Start",
    type: "pair",
    parts: [
      { key: "startX", prefix: "X", get: (p) => Math.round(num(p.startX)), set: (p, v) => ({ startX: v, startY: num(p.startY), startBinding: null }) },
      { key: "startY", prefix: "Y", get: (p) => Math.round(num(p.startY)), set: (p, v) => ({ startX: num(p.startX), startY: v, startBinding: null }) },
    ],
  },

  end: {
    label: "End",
    type: "pair",
    parts: [
      { key: "endX", prefix: "X", get: (p) => Math.round(num(p.endX)), set: (p, v) => ({ endX: v, endY: num(p.endY), endBinding: null }) },
      { key: "endY", prefix: "Y", get: (p) => Math.round(num(p.endY)), set: (p, v) => ({ endX: num(p.endX), endY: v, endBinding: null }) },
    ],
  },

  fill:         { label: "Fill",          type: "color", nullable: true },
  strokeColor:  { label: "Stroke",        type: "color", nullable: true },
  strokeWidth:  { label: "Stroke width",  type: "number", min: 0, max: 50,  step: 1 },
  // `iconSelect` = dropdown whose items are drawn previews; `icons` = a
  // segmented row of buttons (radio semantics, one visible choice).
  strokeStyle: {
    label: "Stroke style", type: "iconSelect",
    options: [
      { value: "solid",  icon: StrokeSolid,  title: "Solid" },
      { value: "dashed", icon: StrokeDashed, title: "Dashed" },
      { value: "dotted", icon: StrokeDotted, title: "Dotted" },
    ],
  },

  // Each option previews itself — the family in its own face, the weight at its
  // own weight (in the element's current family, since weight reads differently
  // per typeface).
  fontFamily: {
    label: "Font", type: "select", options: FONT_FAMILIES,
    optionStyle: (family) => ({ fontFamily: fontStack(family) }),
  },
  fontSize:   { label: "Font size", type: "number", min: 1, max: 400, step: 1 },
  fontWeight: {
    label: "Weight", type: "select", options: WEIGHTS,
    optionStyle: (weight, properties) => ({
      fontWeight: weight,
      fontFamily: fontStack(properties.fontFamily ?? DEFAULTS.fontFamily),
    }),
  },
  fontStyle: {
    label: "Style", type: "icons",
    options: [
      { value: "normal", icon: Type,   title: "Normal" },
      { value: "italic", icon: Italic, title: "Italic" },
    ],
  },

  horizontal: {
    label: "Horizontal", type: "icons",
    options: [
      { value: "left",   icon: AlignLeft,   title: "Align left" },
      { value: "center", icon: AlignCenter, title: "Align center" },
      { value: "right",  icon: AlignRight,  title: "Align right" },
    ],
  },
  vertical: {
    label: "Vertical", type: "icons",
    options: [
      { value: "top",    icon: AlignStartHorizontal,  title: "Align top" },
      { value: "middle", icon: AlignCenterHorizontal, title: "Align middle" },
      { value: "bottom", icon: AlignEndHorizontal,    title: "Align bottom" },
    ],
  },
  // Unlabelled and full-width: two groups of three need the room, and alignment
  // icons are self-evident (every design tool ships them bare).
  align: { type: "combo", fields: ["horizontal", "vertical"] },

  routing: {
    label: "Routing", type: "icons",
    options: [
      { value: "straight", icon: RouteStraight, title: "Straight" },
      { value: "curved",   icon: RouteCurved,   title: "Curved" },
      { value: "elbow",    icon: RouteElbow,    title: "Elbow" },
    ],
  },
  headStart: {
    label: "Start head", type: "iconSelect",
    options: [
      { value: "none",  icon: HeadNone,       title: "None" },
      { value: "arrow", icon: HeadArrowStart, title: "Arrow" },
    ],
  },
  headEnd: {
    label: "End head", type: "iconSelect",
    options: [
      { value: "none",  icon: HeadNone,     title: "None" },
      { value: "arrow", icon: HeadArrowEnd, title: "Arrow" },
    ],
  },
  rotation:     { label: "Rotation",      type: "number", step: 1 },
  borderRadius: { label: "Corner radius", type: "number", min: 0, max: 500, step: 1 },
  opacity:      { label: "Opacity",       type: "range",  min: 0, max: 1,   step: 0.05 },
  content:      { label: "Text",          type: "textarea" },
}

// "No fill" is stored as the CSS keyword `transparent`, since <input type="color">
// has no empty state. (`none` is not valid for background-color.)
const NONE = "transparent"
const isNone = (value) => !value || value === NONE

// <input type="color"> only understands #rrggbb, but colors are stored with an
// optional alpha suffix (#ffffff88). Strip it to display, restore it on write.
const toHex6 = (value) => (typeof value === "string" && value.startsWith("#") ? value.slice(0, 7) : "#000000")
const withAlpha = (hex6, previous) =>
  typeof previous === "string" && previous.length === 9 ? hex6 + previous.slice(7) : hex6

// A color that can be switched off. The last picked color is remembered locally so
// toggling back on restores it rather than snapping to some default.
function ColorInput({ value, nullable, label, onCommit }) {
  const off = isNone(value)
  const [lastColor, setLastColor] = useState(off ? "#ffffff" : value)

  const handlePick = (e) => {
    const next = withAlpha(e.target.value, off ? lastColor : value)
    setLastColor(next)
    onCommit(next)          // picking a color also switches it back on
  }

  if (!nullable) {
    return <input type="color" className={styles.color} value={toHex6(value)} onChange={handlePick} />
  }

  const noun = label.toLowerCase()

  return (
    <div className={styles.colorField}>
      <input
        type="checkbox"
        className={styles.toggle}
        checked={!off}
        title={off ? `Enable ${noun}` : `Disable ${noun}`}
        onChange={(e) => onCommit(e.target.checked ? lastColor : NONE)}
      />
      <input
        type="color"
        className={off ? `${styles.color} ${styles.colorOff}` : styles.color}
        value={toHex6(off ? lastColor : value)}
        onChange={handlePick}
      />
    </div>
  )
}

const clamp = (n, min, max) => {
  if (min != null) n = Math.max(min, n)
  if (max != null) n = Math.min(max, n)
  return n
}

// A controlled number input can't hold intermediate text like "" or "-", and
// Number("") is 0 — so committing on every keystroke makes negatives untypable
// (typing "-" would immediately write 0). Keep the raw string as a local draft
// while editing, commit only when it parses, and resync to the store on blur.
function NumberInput({ value, min, max, step, className, onCommit }) {
  const [draft, setDraft] = useState(null)

  const handleChange = (e) => {
    const raw = e.target.value
    setDraft(raw)

    if (raw === "" || raw === "-") return   // intermediate: show it, don't commit

    const n = Number(raw)
    if (Number.isFinite(n)) onCommit(clamp(n, min, max))
  }

  return (
    <input
      type="number"
      className={className}
      min={min} max={max} step={step ?? 1}
      value={draft ?? value}
      onChange={handleChange}
      onBlur={() => setDraft(null)}
    />
  )
}

// A dropdown whose options are drawn, not written — a native <select> can't
// render SVG, so this is a button plus a popup listbox. Closes on outside
// press, Escape, or a choice.
function IconSelect({ value, options, label, onCommit }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPress = (e) => { if (!root.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("pointerdown", onPress)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPress)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const current = options.find((o) => o.value === value) ?? options[0]
  const Current = current.icon

  return (
    <div className={styles.iconSelect} ref={root}>
      <button
        type="button"
        className={styles.iconTrigger}
        title={current.title}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.title}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Current size={16} />
        <ChevronDown size={12} className={styles.chevron} />
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" aria-label={label}>
          {options.map((option) => {
            const Icon = option.icon
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={active ? `${styles.menuItem} ${styles.menuItemActive}` : styles.menuItem}
                  onClick={() => { onCommit(option.value); setOpen(false) }}
                >
                  <Icon size={16} />
                  <span>{option.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// A segmented row of icon buttons — one choice visible at a glance, no popup.
function IconGroup({ value, options, label, onCommit }) {
  return (
    <div className={styles.iconGroup} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const Icon = option.icon
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? `${styles.iconButton} ${styles.iconButtonActive}` : styles.iconButton}
            title={option.title}
            onClick={() => onCommit(option.value)}
          >
            <Icon size={15} />
          </button>
        )
      })}
    </div>
  )
}

// A schema entry is either a built-in field NAME (resolved against the FIELDS
// catalog) or an inline field DEFINITION object carrying its own
// { key, label, type, ... }. The inline form is how a custom element type
// contributes a control the panel never shipped with — the same field renderers
// (color, number, select, ...), driven by a definition the element supplies.
function resolveField(entry) {
  return typeof entry === "string"
    ? { name: entry, field: FIELDS[entry] }
    : { name: entry.key, field: entry }
}

function Field({ entry, properties, onPatch }) {
  const { name, field } = resolveField(entry)

  // Composite row: render the named sub-fields side by side. Recurses, so a
  // combo can hold any field type (both of today's are icon groups).
  if (field.type === "combo") {
    return (
      <div className={styles.combo}>
        {field.fields.map((sub) => (
          <Field key={resolveField(sub).name} entry={sub} properties={properties} onPatch={onPatch} />
        ))}
      </div>
    )
  }

  // Pair fields own their own read/write per part.
  if (field.type === "pair") {
    return (
      <div className={styles.pair}>
        {field.parts.map((part) => (
          <div key={part.key} className={styles.part}>
            <span className={styles.prefix}>{part.prefix}</span>
            <NumberInput
              min={part.min}
              max={part.max}
              step={part.step}
              value={part.get(properties)}
              onCommit={(n) => onPatch(part.set(properties, n))}
            />
          </div>
        ))}
      </div>
    )
  }

  // Plain fields map 1:1 to a stored property. An inline field may carry its own
  // `default`; the built-in catalog falls back to DEFAULTS.
  const value = properties[name] ?? field.default ?? DEFAULTS[name]
  const onChange = (v) => onPatch({ [name]: v })

  switch (field.type) {
    case "color":
      return <ColorInput value={value} nullable={field.nullable} label={field.label} onCommit={onChange} />

    case "number":
      return (
        <NumberInput
          className={styles.input}
          min={field.min} max={field.max} step={field.step}
          value={value}
          onCommit={onChange}
        />
      )

    case "range":
      return (
        <div className={styles.range}>
          <input
            type="range"
            min={field.min} max={field.max} step={field.step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className={styles.readout}>{Math.round(value * 100)}%</span>
        </div>
      )

    case "icons":
      return <IconGroup value={value} options={field.options} label={field.label} onCommit={onChange} />

    case "iconSelect":
      return <IconSelect value={value} options={field.options} label={field.label} onCommit={onChange} />

    case "select":
      // `optionStyle` lets an option preview itself (a family in its own face, a
      // weight at its own weight). Applied to the closed control too, so the
      // current choice previews without opening it. Styled <option>s render in
      // Chrome/Edge/Firefox; Safari ignores them and shows plain text.
      return (
        <select
          className={styles.input}
          value={value}
          style={field.optionStyle?.(value, properties)}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} value={option} style={field.optionStyle?.(option, properties)}>
              {option}
            </option>
          ))}
        </select>
      )

    case "textarea":
      return (
        <textarea
          className={styles.textarea}
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )

    default:
      return null
  }
}

export default function Properties({ selectedElements, getElement, updateElements }) {
  // The panel edits exactly one element. Multi-editing needs mixed-value
  // handling (a later feature), so it stays closed for 0 or 2+ selected.
  const raw = selectedElements.length === 1 ? getElement(selectedElements[0]) : undefined

  // Bound line endpoints display where they actually render.
  const element = raw?.type === "line"
    ? { ...raw, properties: { ...raw.properties, ...resolveLineEndpoints(raw.properties, getElement) } }
    : raw

  if (!element) return null

  const fields = schemaOf(element.type)

  return (
    <aside className={styles.properties}>
      <header className={styles.header}>
        <span className={styles.type}>{element.type}</span>
        <span className={styles.uuid}>{element.uuid}</span>
      </header>

      {/* keyed by uuid so each element gets fresh inputs (no stale NumberInput drafts) */}
      <div className={styles.fields} key={element.uuid}>
        {fields.map((entry) => {
          const { name, field } = resolveField(entry)
          // A <label> may only wrap a single labelable control, which rules out
          // multi-control rows and the button-based ones (those carry their own
          // aria-label / title instead).
          const Row = MULTI_CONTROL.has(field.type) ? "div" : "label"

          return (
            <Row key={name} className={styles.field}>
              {field.label && <span className={styles.label}>{field.label}</span>}
              <Field
                entry={entry}
                properties={element.properties}
                onPatch={(patch) => updateElements([{ uuid: element.uuid, properties: patch }])}
              />
            </Row>
          )
        })}
      </div>
    </aside>
  )
}
