// The Google Fonts a text element may use. The family name is what gets stored
// in element properties; `fallback` keeps text readable while the webfont loads
// (and if the request fails). ONE list, consumed by both Text.jsx (to build the
// CSS font stack) and the Properties panel (to build the picker) — a second copy
// would drift and offer fonts that don't render.
//
// Every family here is requested in index.html at the weights WEIGHTS exposes,
// except DM Sans, which App.css already loads as the app's own UI font. Adding a
// family means adding it to that <link> too, and checking its axis coverage
// first: Google Fonts rejects the whole request if a family lacks a requested
// value, which is why Caveat (no italic) is declared separately there.

export const FONTS = [
  // Sans
  { family: "DM Sans", fallback: "sans-serif" },
  { family: "Inter", fallback: "sans-serif" },
  { family: "Roboto", fallback: "sans-serif" },
  { family: "Open Sans", fallback: "sans-serif" },
  { family: "Montserrat", fallback: "sans-serif" },
  { family: "Poppins", fallback: "sans-serif" },
  { family: "Work Sans", fallback: "sans-serif" },
  { family: "Nunito", fallback: "sans-serif" },
  // Serif
  { family: "Playfair Display", fallback: "serif" },
  { family: "Lora", fallback: "serif" },
  { family: "Merriweather", fallback: "serif" },
  // Mono
  { family: "JetBrains Mono", fallback: "monospace" },
  { family: "Roboto Mono", fallback: "monospace" },
  // Handwriting — the one that actually feels like a whiteboard
  { family: "Caveat", fallback: "cursive" },
]

export const FONT_FAMILIES = FONTS.map(f => f.family)

// Weights every family above supports (each is either variable across this
// range or ships these as static faces), so the picker can't offer a weight
// that silently falls back to a synthesized one.
export const WEIGHTS = ["400", "500", "600", "700"]

// Quoted family + category fallback, e.g. `"Lora", serif`. An absent family
// yields the bare fallback rather than a quoted "undefined", so a text element
// stored without one still renders.
export const fontStack = (family) => {
  if (!family) return "sans-serif"
  const font = FONTS.find(f => f.family === family)
  return font ? `"${font.family}", ${font.fallback}` : `"${family}", sans-serif`
}
