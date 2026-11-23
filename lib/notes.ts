import type { Note, NoteFont } from "./types";

/* How a note's words are set. Hand is the pencil (Caveat); the others are
   for notes that should read as type: a label, a heading, a code name.  */
export const NOTE_FONTS: Record<NoteFont, { css: string; label: string; weight: number }> = {
  hand: { css: "var(--font-hand)", label: "hand", weight: 500 },
  sans: { css: "var(--font-sans)", label: "sans", weight: 500 },
  serif: { css: 'ui-serif, "Iowan Old Style", Georgia, serif', label: "serif", weight: 400 },
  mono: { css: "var(--font-mono)", label: "mono", weight: 450 },
};

/** the four sizes on the text strip: S, M, L, XL */
export const NOTE_SIZES = [18, 26, 40, 64];
export const LINE_HEIGHT = 1.15;

export function noteFont(n: Pick<Note, "font">) {
  return NOTE_FONTS[n.font ?? "hand"];
}

/* Measured the way the browser will draw it, so selections and grips sit on
   the real edges of the words. Falls back to an estimate before fonts load. */
let ctx: CanvasRenderingContext2D | null = null;
const familyCache = new Map<string, string>();

function resolveFamily(css: string) {
  if (typeof document === "undefined") return "sans-serif";
  const hit = familyCache.get(css);
  if (hit) return hit;
  const m = /^var\((--[\w-]+)\)/.exec(css);
  const fam = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "sans-serif" : css;
  if (fam !== "sans-serif") familyCache.set(css, fam);
  return fam;
}

export function measureNote(n: Pick<Note, "text" | "size" | "font" | "bold">) {
  const lines = (n.text || " ").split("\n");
  const h = lines.length * n.size * LINE_HEIGHT;
  if (typeof document === "undefined") {
    const longest = Math.max(...lines.map((l) => l.length), 1);
    return { w: longest * n.size * 0.5 + 4, h };
  }
  ctx ??= document.createElement("canvas").getContext("2d");
  const f = noteFont(n);
  ctx!.font = `${n.bold ? 700 : f.weight} ${n.size}px ${resolveFamily(f.css)}`;
  const w = Math.max(...lines.map((l) => ctx!.measureText(l || " ").width), n.size * 0.6);
  return { w: Math.ceil(w) + 4, h };
}
