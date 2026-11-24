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

/** Break one paragraph into the lines the browser will draw at `max` px: at spaces, and inside a word only if it can't fit. */
function wrap(text: string, max: number, measure: (s: string) => number): string[] {
  if (!text) return [""];
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const part of words) {
    if (!part) continue;
    const next = line + part;
    if (measure(next.replace(/\s+$/, "")) <= max || !line.trim()) {
      // a single word wider than the line breaks where it must
      if (!line.trim() && measure(part) > max && part.trim()) {
        let chunk = "";
        for (const ch of part) {
          if (measure(chunk + ch) > max && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = next;
    } else {
      lines.push(line.replace(/\s+$/, ""));
      line = part.trimStart();
    }
  }
  lines.push(line);
  return lines;
}

export function measureNote(n: Pick<Note, "text" | "size" | "font" | "bold" | "width">) {
  const paragraphs = (n.text || " ").split("\n");
  if (typeof document === "undefined") {
    const longest = Math.max(...paragraphs.map((l) => l.length), 1);
    const w = n.width ?? longest * n.size * 0.5 + 4;
    const perLine = Math.max(1, Math.floor(w / (n.size * 0.5)));
    const lines = n.width ? paragraphs.reduce((sum, p) => sum + Math.max(1, Math.ceil(p.length / perLine)), 0) : paragraphs.length;
    return { w, h: lines * n.size * LINE_HEIGHT };
  }
  ctx ??= document.createElement("canvas").getContext("2d");
  const f = noteFont(n);
  ctx!.font = `${n.bold ? 700 : f.weight} ${n.size}px ${resolveFamily(f.css)}`;
  const measure = (s: string) => ctx!.measureText(s || " ").width;
  if (n.width) {
    // a set width: the text wraps inside it, and the note is as tall as its wrapped lines
    const lines = paragraphs.reduce((sum, p) => sum + wrap(p, n.width! - 4, measure).length, 0);
    return { w: n.width, h: lines * n.size * LINE_HEIGHT };
  }
  const w = Math.max(...paragraphs.map((l) => measure(l)), n.size * 0.6);
  return { w: Math.ceil(w) + 4, h: paragraphs.length * n.size * LINE_HEIGHT };
}
