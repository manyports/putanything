import type { Arrow, Doc, Rect, Vec } from "./types";

/* Arrows that start or end on a plate or a shape stay attached to it: when the
   thing moves or changes size, the arrow's end follows, meeting its edge with
   a small gap, aimed at whatever is at the other end.                  */
const GAP = 8;

function center(r: Rect): Vec {
  return [r.x + r.w / 2, r.y + r.h / 2];
}

/** where a line from the middle of `r` towards `toward` leaves it, plus a gap */
function edgePoint(r: Rect, toward: Vec): Vec {
  const [cx, cy] = center(r);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [cx, cy];
  const sx = dx ? r.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy ? r.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s + (dx / len) * GAP, cy + dy * s + (dy / len) * GAP];
}

export function targetRects(doc: Doc) {
  const rects = new Map<string, Rect>();
  for (const i of doc.items) rects.set(i.id, { x: i.x, y: i.y, w: i.w, h: i.h });
  for (const m of doc.marks) if (m.kind === "shape") rects.set(m.id, { x: m.x, y: m.y, w: m.w, h: m.h });
  return rects;
}

/** the plate or shape under a point, topmost first, if any */
export function targetAt(doc: Doc, p: Vec, exclude?: string): string | undefined {
  const inside = (r: Rect) => p[0] >= r.x - 4 && p[0] <= r.x + r.w + 4 && p[1] >= r.y - 4 && p[1] <= r.y + r.h + 4;
  const shapes = [...doc.marks].reverse().filter((m) => m.kind === "shape" && m.id !== exclude);
  for (const m of shapes) if (m.kind === "shape" && inside(m)) return m.id;
  const items = [...doc.items].sort((a, b) => b.z - a.z);
  for (const i of items) if (i.id !== exclude && inside(i)) return i.id;
  return undefined;
}

/** Bring every attached arrow up to date with what it's attached to. Returns the same doc if nothing changed. */
export function settleArrows(doc: Doc): Doc {
  if (!doc.marks.some((m) => m.kind === "arrow" && (m.from || m.to))) return doc;
  const rects = targetRects(doc);
  let changed = false;
  const marks = doc.marks.map((m) => {
    if (m.kind !== "arrow" || (!m.from && !m.to)) return m;
    const A = m.from ? rects.get(m.from) : undefined;
    const B = m.to ? rects.get(m.to) : undefined;
    const refA = A ? center(A) : m.a;
    const refB = B ? center(B) : m.b;
    const a = A ? edgePoint(A, refB) : m.a;
    const b = B ? edgePoint(B, refA) : m.b;
    const next: Arrow = {
      ...m,
      a,
      b,
      // something it was attached to is gone: it keeps its last place
      from: A ? m.from : undefined,
      to: B ? m.to : undefined,
    };
    const same =
      Math.abs(a[0] - m.a[0]) < 0.01 && Math.abs(a[1] - m.a[1]) < 0.01 && Math.abs(b[0] - m.b[0]) < 0.01 && Math.abs(b[1] - m.b[1]) < 0.01 && next.from === m.from && next.to === m.to;
    if (same) return m;
    changed = true;
    return next;
  });
  return changed ? { ...doc, marks } : doc;
}
