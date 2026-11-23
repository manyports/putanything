import type { Camera, Item, Mark, Rect, Vec } from "./types";
import { measureNote } from "./notes";

export const MIN_Z = 0.15;
export const MAX_Z = 3;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function toWorld(cam: Camera, sx: number, sy: number): Vec {
  return [(sx - cam.x) / cam.z, (sy - cam.y) / cam.z];
}

export function toScreen(cam: Camera, wx: number, wy: number): Vec {
  return [wx * cam.z + cam.x, wy * cam.z + cam.y];
}

/** Zoom about a fixed screen point, so whatever is under the cursor stays put. */
export function zoomAt(cam: Camera, sx: number, sy: number, nextZ: number): Camera {
  const z = clamp(nextZ, MIN_Z, MAX_Z);
  const [wx, wy] = toWorld(cam, sx, sy);
  return { z, x: sx - wx * z, y: sy - wy * z };
}

export function itemRect(i: Item): Rect {
  return { x: i.x, y: i.y, w: i.w, h: i.h };
}

export { measureNote as noteSize } from "./notes";

export function markRect(m: Mark): Rect {
  if (m.kind === "stroke") {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of m.pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    const pad = m.size / 2;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }
  if (m.kind === "arrow") {
    const x0 = Math.min(m.a[0], m.b[0]);
    const y0 = Math.min(m.a[1], m.b[1]);
    return { x: x0 - 6, y: y0 - 6, w: Math.abs(m.a[0] - m.b[0]) + 12, h: Math.abs(m.a[1] - m.b[1]) + 12 };
  }
  if (m.kind === "shape") return { x: m.x, y: m.y, w: m.w, h: m.h };
  const s = measureNote(m);
  return { x: m.x, y: m.y, w: s.w, h: s.h };
}

/** A shape's outline as points, clockwise from the top-left (ellipses as 48 points). */
export function shapePoints(s: { shape: string; x: number; y: number; w: number; h: number }): Vec[] {
  const { x, y, w, h } = s;
  if (s.shape === "rect") return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  if (s.shape === "diamond") return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
  if (s.shape === "triangle") return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
  const cx = x + w / 2;
  const cy = y + h / 2;
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return [cx + (Math.cos(a) * w) / 2, cy + (Math.sin(a) * h) / 2] as Vec;
  });
}

function inPolygon(p: Vec, pts: Vec[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function contains(outer: Rect, inner: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function union(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function distToSegment(p: Vec, a: Vec, b: Vec) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len : 0;
  t = clamp(t, 0, 1);
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

/** Is world point `p` within `r` world units of the mark's ink? */
export function hitMark(m: Mark, p: Vec, r: number): boolean {
  if (m.kind === "stroke") {
    const pts = m.pts;
    const reach = r + m.size / 2;
    if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= reach;
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(p, [pts[i - 1][0], pts[i - 1][1]], [pts[i][0], pts[i][1]]) <= reach) return true;
    }
    return false;
  }
  if (m.kind === "arrow") return distToSegment(p, m.a, m.b) <= r + 3;
  if (m.kind === "shape") {
    // an outline is picked up by its line; a filled shape anywhere inside it
    const pts = shapePoints(m);
    if (m.fill !== "none" && inPolygon(p, pts)) return true;
    return pts.some((a, i) => distToSegment(p, a, pts[(i + 1) % pts.length]) <= r + 3);
  }
  const b = markRect(m);
  return p[0] >= b.x - r && p[0] <= b.x + b.w + r && p[1] >= b.y - r && p[1] <= b.y + b.h + r;
}

export function moveMark(m: Mark, dx: number, dy: number): Mark {
  if (m.kind === "stroke") return { ...m, pts: m.pts.map(([x, y, p]) => [x + dx, y + dy, p]) };
  if (m.kind === "arrow") return { ...m, a: [m.a[0] + dx, m.a[1] + dy], b: [m.b[0] + dx, m.b[1] + dy] };
  return { ...m, x: m.x + dx, y: m.y + dy };
}

/** Seeded wobble so a pencil line looks drawn, and draws the same way every render. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}
