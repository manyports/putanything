/* One palette for everything you can colour: lines, arrows, notes and
   stickies. "ink" follows the theme (graphite in light, chalk in dark);
   the rest are fixed hues, and the picker adds any hex you like.     */
export const INK = "ink";
export const ACCENT = "accent";

export const PALETTE = ["#7c3aed", "#dc2626", "#ea580c", "#d97706", "#16a34a", "#0d9488", "#2563eb", "#db2777"];

/** what to paint a line, an arrow or a note with */
export function inkColor(tone: string | undefined) {
  if (!tone || tone === INK) return "var(--stroke-ink)";
  if (tone === ACCENT) return "var(--accent-soft)";
  return tone;
}

/* Stickies are paper: a hue is mixed into the face so text stays readable
   in both themes. The five named papers keep their hand-tuned tints.   */
const PAPERS = ["plain", "amber", "mint", "lilac", "rose"];
export function paperColor(tint: string | undefined) {
  if (!tint || tint === "plain" || tint === INK) return "var(--paper-plain)";
  if (PAPERS.includes(tint)) return `var(--paper-${tint})`;
  if (tint === ACCENT) return "color-mix(in oklab, var(--accent-soft) 22%, var(--panel-face))";
  return `color-mix(in oklab, ${tint} 24%, var(--panel-face))`;
}

/** a swatch for the picker: what the colour looks like at full strength */
export function swatchColor(value: string) {
  if (value === INK) return "var(--stroke-ink)";
  if (value === ACCENT) return "var(--accent-soft)";
  if (PAPERS.includes(value)) return `var(--paper-${value === "plain" ? "plain" : value})`;
  return value;
}
