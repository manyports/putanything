"use client";

import type { Camera, Doc, Item, Mark, Rect, Vec, WidgetKind } from "./types";
import { commit, getState, live, setState, topZ, uid } from "./store";
import { clamp, itemRect, markRect, moveMark, toWorld, union } from "./geom";
import { WIDGETS } from "@/components/widgets/registry";
import { readImage } from "@/components/widgets/Picture";
import { parseGrid } from "@/components/widgets/Table";

/* ── Where things land ───────────────────────────────────────────── */
let lastPointer: { x: number; y: number; over: boolean } = { x: 0, y: 0, over: false };
export function trackPointer(x: number, y: number, over: boolean) {
  lastPointer = { x, y, over };
}

export function viewportCenter(): Vec {
  const { camera } = getState();
  return toWorld(camera, window.innerWidth / 2, window.innerHeight / 2);
}

/** The pointer if it's over the board, otherwise the middle of the screen. */
export function placementPoint(): Vec {
  if (lastPointer.over) return toWorld(getState().camera, lastPointer.x, lastPointer.y);
  return viewportCenter();
}

const overlaps = (a: Rect, b: Rect, gap = 16) =>
  a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

/** Look outward from `want` for a spot where the new plate touches nothing. */
export function findRoom(want: Rect, doc: Doc): Rect {
  const rects = doc.items.map(itemRect);
  if (!rects.some((r) => overlaps(want, r))) return want;
  const step = 40;
  for (let ring = 1; ring < 30; ring++) {
    for (let i = -ring; i <= ring; i++) {
      for (const [dx, dy] of [
        [i, -ring],
        [i, ring],
        [-ring, i],
        [ring, i],
      ]) {
        const r = { ...want, x: want.x + dx * step, y: want.y + dy * step };
        if (!rects.some((o) => overlaps(r, o))) return r;
      }
    }
  }
  return { ...want, x: want.x + 24, y: want.y + 24 };
}

export function makeItem(kind: WidgetKind, at: Vec, data?: unknown, size?: { w: number; h: number }): Item {
  const def = WIDGETS[kind];
  const { w, h } = size ?? def.size;
  const doc = getState().doc;
  const spot = findRoom({ x: Math.round(at[0] - w / 2), y: Math.round(at[1] - h / 2), w, h }, doc);
  return {
    id: uid(),
    kind,
    x: spot.x,
    y: spot.y,
    w,
    h,
    z: topZ(doc) + 1,
    data: (data ?? def.create()) as Record<string, unknown>,
  };
}

export function addWidget(kind: WidgetKind, at?: Vec, data?: unknown, size?: { w: number; h: number }) {
  const item = makeItem(kind, at ?? placementPoint(), data, size);
  commit((d) => ({ ...d, items: [...d.items, item] }));
  setState({ selection: [item.id], tool: "select" });
  revealRect(itemRect(item));
  return item.id;
}

/** Pan just enough that a rect is fully on screen. */
export function revealRect(r: Rect) {
  const { camera } = getState();
  const pad = 80;
  const sx0 = r.x * camera.z + camera.x;
  const sy0 = r.y * camera.z + camera.y;
  const sx1 = sx0 + r.w * camera.z;
  const sy1 = sy0 + r.h * camera.z;
  let dx = 0;
  let dy = 0;
  if (sx0 < pad) dx = pad - sx0;
  else if (sx1 > window.innerWidth - pad) dx = window.innerWidth - pad - sx1;
  if (sy0 < pad) dy = pad - sy0;
  else if (sy1 > window.innerHeight - 96) dy = window.innerHeight - 96 - sy1;
  if (dx || dy) setState({ camera: { ...camera, x: camera.x + dx, y: camera.y + dy } });
}

/* ── Camera ──────────────────────────────────────────────────────── */
export function fitRect(r: Rect | null, maxZ = 1): Camera {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!r) return { x: W / 2, y: H / 2, z: 1 };
  const padX = W < 640 ? 24 : 80;
  const padTop = 84;
  const padBottom = 104;
  const z = clamp(Math.min((W - padX * 2) / r.w, (H - padTop - padBottom) / r.h), 0.2, maxZ);
  return {
    z,
    x: (W - r.w * z) / 2 - r.x * z,
    y: padTop + (H - padTop - padBottom - r.h * z) / 2 - r.y * z,
  };
}

export function docBounds(doc: Doc) {
  return union([...doc.items.map(itemRect), ...doc.marks.map(markRect)]);
}

export function fitAll() {
  const r = docBounds(getState().doc);
  setState({ camera: fitRect(r) });
}

export function zoomBy(factor: number) {
  const { camera } = getState();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const [wx, wy] = toWorld(camera, cx, cy);
  const z = clamp(camera.z * factor, 0.15, 3);
  setState({ camera: { z, x: cx - wx * z, y: cy - wy * z } });
}

export function resetZoom() {
  const { camera } = getState();
  zoomBy(1 / camera.z);
}

/* ── Selection ───────────────────────────────────────────────────── */
export function selectAll() {
  const { doc } = getState();
  setState({ selection: [...doc.items.map((i) => i.id), ...doc.marks.map((m) => m.id)] });
}

export function nudge(dx: number, dy: number) {
  const { selection } = getState();
  if (!selection.length) return;
  const set = new Set(selection);
  commit(
    (d) => ({
      items: d.items.map((i) => (set.has(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)),
      marks: d.marks.map((m) => (set.has(m.id) ? moveMark(m, dx, dy) : m)),
    }),
    { key: "nudge" },
  );
}

/* ── Copy, paste, duplicate ──────────────────────────────────────── */
const CLIP = "putanything/v1:";

function selectedParts() {
  const { doc, selection } = getState();
  const set = new Set(selection);
  return { items: doc.items.filter((i) => set.has(i.id)), marks: doc.marks.filter((m) => set.has(m.id)) };
}

export function serializeSelection() {
  const parts = selectedParts();
  if (!parts.items.length && !parts.marks.length) return null;
  return CLIP + JSON.stringify(parts);
}

function placeCopies(items: Item[], marks: Mark[], dx: number, dy: number) {
  const doc = getState().doc;
  let z = topZ(doc);
  const newItems = items.map((i) => ({ ...i, id: uid(), x: i.x + dx, y: i.y + dy, z: ++z }));
  const newMarks = marks.map((m) => ({ ...moveMark(m, dx, dy), id: uid() }));
  commit((d) => ({ items: [...d.items, ...newItems], marks: [...d.marks, ...newMarks] }));
  setState({ selection: [...newItems.map((i) => i.id), ...newMarks.map((m) => m.id)], tool: "select" });
}

/** Copies of these, in the same places, shown live (alt-drag moves the copies; the drag is the undo step). */
export function cloneLive(ids: string[]): string[] {
  const { doc } = getState();
  const set = new Set(ids);
  let z = topZ(doc);
  const items = doc.items.filter((i) => set.has(i.id)).map((i) => ({ ...i, id: uid(), z: ++z }));
  const marks = doc.marks.filter((m) => set.has(m.id)).map((m) => ({ ...m, id: uid() }));
  live((d) => ({ items: [...d.items, ...items], marks: [...d.marks, ...marks] }));
  const next = [...items.map((i) => i.id), ...marks.map((m) => m.id)];
  setState({ selection: next });
  return next;
}

/** Bring the selection to the middle of the screen, as large as fits (up to twice life size). */
export function zoomToSelection() {
  const { doc, selection } = getState();
  const set = new Set(selection);
  const r = union([...doc.items.filter((i) => set.has(i.id)).map(itemRect), ...doc.marks.filter((m) => set.has(m.id)).map(markRect)]);
  if (!r) return fitAll();
  setState({ camera: fitRect(r, 2) });
}

export function duplicateSelection() {
  const { items, marks } = selectedParts();
  if (!items.length && !marks.length) return;
  placeCopies(items, marks, 28, 28);
}

function pasteParts(raw: string) {
  try {
    const parts = JSON.parse(raw.slice(CLIP.length)) as { items: Item[]; marks: Mark[] };
    const box = union([...parts.items.map(itemRect), ...parts.marks.map(markRect)]);
    if (!box) return;
    const [px, py] = placementPoint();
    placeCopies(parts.items, parts.marks, Math.round(px - (box.x + box.w / 2)), Math.round(py - (box.y + box.h / 2)));
  } catch {}
}

const LIST_RE = /^\s*(?:[-*•]|\[[ xX]?\]|\d+[.)])\s+/;
// a link with its scheme, or a bare address like example.com or www.example.com/page
const LINK_IN_TEXT =
  /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]|\b(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|app|co|ai|me|so|gg|tv|edu|gov|uk|de|fr|kz|ru|jp|ca|au|xyz|info|site|news|blog|page|link)(?:\/[^\s<>"'()]*[^\s<>"'().,;:!?])?/gi;

/** One word as a web address, or null: "https://…", "www.…", or a bare "example.com/page". */
export function asLink(word: string): string | null {
  // wrapping people put around links: <…>, "…", (…), a full stop after it
  let w = word.replace(/^[<"'[]+/, "").replace(/[>"'\],.;:!?]+$/, "");
  if (w.startsWith("(") && w.endsWith(")")) w = w.slice(1, -1);
  // a closing bracket belongs to the address only if the address opened one (wikipedia does)
  while (w.endsWith(")") && (w.match(/\(/g) || []).length < (w.match(/\)/g) || []).length) w = w.slice(0, -1);
  let url = w;
  if (!/^https?:\/\//i.test(url)) {
    if (!/^(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i.test(url)) return null;
    url = `https://${url}`;
  }
  try {
    const u = new URL(url);
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function findLinks(text: string): string[] {
  const found = text.match(LINK_IN_TEXT) ?? [];
  const seen = new Set<string>();
  return found
    .filter((u) => !/@/.test(u))
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`))
    .filter((u) => {
      try {
        new URL(u);
      } catch {
        return false;
      }
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

/** Text arrives: links become cards, a list becomes a checklist, anything else a sticky. */
export function putText(text: string, at?: Vec) {
  const t = text.trim();
  if (!t) return;
  if (t.startsWith(CLIP)) return pasteParts(t);

  // a paste that is nothing but web addresses (one, or several on their own lines) becomes cards;
  // a link inside a sentence is writing, and stays a note with the words around it
  const tokens = t.split(/\s+/).filter(Boolean);
  const asLinks = tokens.map(asLink);
  if (asLinks.length && asLinks.every(Boolean)) return putLinks([...new Set(asLinks as string[])], at);

  // a block copied out of a spreadsheet (tabs), or csv with matching columns, becomes a table
  const grid = parseGrid(text);
  if (grid && grid.length >= 2) {
    const cols = Math.max(...grid.map((r) => r.length));
    return addWidget("table", at, { header: true, rows: grid }, { w: clamp(cols * 150 + 56, 340, 960), h: clamp(grid.length * 37 + 84, 180, 640) });
  }

  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2 && lines.filter((l) => LIST_RE.test(l)).length >= Math.ceil(lines.length * 0.6)) {
    const items = lines.map((l) => ({
      id: uid(),
      text: l.replace(LIST_RE, "").trim(),
      done: /^\s*\[[xX]\]/.test(l),
    }));
    return addWidget("todo", at, { title: "", items }, { w: 280, h: clamp(170 + items.length * 34, 260, 520) });
  }
  const long = t.length;
  const w = long > 400 ? 340 : long > 140 ? 280 : 240;
  const h = clamp(90 + Math.ceil(long / (w / 8.2)) * 23 + lines.length * 8, 160, 440);
  return addWidget("sticky", at, { text: t, tint: "plain" }, { w, h });
}

/** One card per link, side by side, each fetching its own preview. */
function putLinks(links: string[], at?: Vec) {
  if (links.length === 1) return addWidget("link", at, { url: links[0], state: "loading" });
  const [px, py] = at ?? placementPoint();
  const w = 380;
  const h = 340;
  const gap = 28;
  const total = links.length * w + (links.length - 1) * gap;
  const spot = findRoom({ x: Math.round(px - total / 2), y: Math.round(py - h / 2), w: total, h }, getState().doc);
  let z = topZ(getState().doc);
  const items: Item[] = links.map((url, i) => ({
    id: uid(),
    kind: "link",
    x: spot.x + i * (w + gap),
    y: spot.y,
    w,
    h,
    z: ++z,
    data: { url, state: "loading" },
  }));
  commit((d) => ({ ...d, items: [...d.items, ...items] }));
  setState({ selection: items.map((i) => i.id), tool: "select" });
  revealRect(union(items.map(itemRect))!);
}

export async function putImage(file: Blob, at?: Vec, name?: string) {
  const data = await readImage(file, name ?? (file instanceof File ? file.name : "pasted picture"));
  const maxW = 480;
  const maxH = 420;
  const s = Math.min(1, maxW / data.nw, maxH / data.nh);
  const fw = Math.max(120, Math.round(data.nw * s));
  const fh = Math.max(80, Math.round(data.nh * s));
  // the plate adds a 5px bezel around the face
  return addWidget("image", at, data, { w: fw + 10, h: fh + 10 });
}

/* ── The whole board as a file ───────────────────────────────────── */
export function exportBoard() {
  const { doc } = getState();
  const blob = new Blob([JSON.stringify({ app: "putanything", version: 1, doc }, null, 1)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  const name = (getState().boards.find((b) => b.id === getState().activeBoard)?.name ?? "board").replace(/[^\w-]+/g, "-");
  a.download = `${name}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function parseBoardFile(text: string): Doc | null {
  try {
    const j = JSON.parse(text);
    const doc = j?.doc ?? j;
    if (!Array.isArray(doc?.items) || !Array.isArray(doc?.marks)) return null;
    const kinds = new Set(Object.keys(WIDGETS));
    return {
      items: doc.items.filter((i: Item) => kinds.has(i.kind) && Number.isFinite(i.x) && Number.isFinite(i.y)),
      marks: doc.marks.filter((m: Mark) => ["stroke", "arrow", "text"].includes(m.kind)),
    };
  } catch {
    return null;
  }
}

/* ── Pages from a PDF ────────────────────────────────────────────── */
export type PageLayout = "row" | "column" | "grid" | "pile";

/** Put rendered pages down in reading order, as one undo step, optionally joined by arrows. */
export function putPages(
  pages: { src: string; nw: number; nh: number; name: string }[],
  layout: PageLayout,
  arrows: boolean,
) {
  if (!pages.length) return;
  const doc = getState().doc;
  const faceW = 360;
  const gap = arrows && layout !== "pile" ? 76 : 32;
  const sizes = pages.map((p) => ({ w: faceW + 10, h: Math.round((faceW * p.nh) / p.nw) + 10 }));
  const cols = layout === "row" ? pages.length : layout === "column" ? 1 : layout === "grid" ? Math.ceil(Math.sqrt(pages.length)) : 1;
  const rowH: number[] = [];
  sizes.forEach((s, i) => {
    const r = Math.floor(i / cols);
    rowH[r] = Math.max(rowH[r] ?? 0, s.h);
  });

  // lay out from 0,0, then centre the whole set on where it should land
  const rects = sizes.map((s, i) => {
    if (layout === "pile") return { x: i * 18, y: i * 18, ...s };
    const c = i % cols;
    const r = Math.floor(i / cols);
    const y = rowH.slice(0, r).reduce((a, b) => a + b + gap, 0);
    return { x: c * (faceW + 10 + gap), y, ...s };
  });
  const bounds = union(rects)!;
  const [px, py] = placementPoint();
  // the whole set looks for clear space together, so no page lands on another plate
  const spot = findRoom({ x: Math.round(px - bounds.w / 2), y: Math.round(py - bounds.h / 2), w: bounds.w, h: bounds.h }, doc);
  const dx = spot.x;
  const dy = spot.y;

  let z = topZ(doc);
  const items: Item[] = pages.map((p, i) => ({
    id: uid(),
    kind: "image",
    x: rects[i].x + dx,
    y: rects[i].y + dy,
    w: rects[i].w,
    h: rects[i].h,
    z: ++z,
    data: { src: p.src, name: p.name, nw: p.nw, nh: p.nh },
  }));

  const marks: Mark[] = [];
  if (arrows && layout !== "pile") {
    for (let i = 0; i + 1 < items.length; i++) {
      const a = items[i];
      const b = items[i + 1];
      const sameRow = Math.abs(a.y - b.y) < 1;
      const from: Vec = sameRow ? [a.x + a.w + 10, a.y + a.h / 2] : [a.x + a.w / 2, a.y + a.h + 10];
      const to: Vec = sameRow ? [b.x - 10, b.y + b.h / 2] : [b.x + b.w / 2, b.y - 10];
      marks.push({ id: uid(), kind: "arrow", a: from, b: to, tone: getState().tone, seed: Math.floor(Math.random() * 1e9), from: a.id, to: b.id });
    }
  }

  commit((d) => ({ items: [...d.items, ...items], marks: [...d.marks, ...marks] }));
  setState({ selection: items.map((i) => i.id), tool: "select" });
  const all = union([...items.map(itemRect), ...marks.map(markRect)])!;
  if (all.w * getState().camera.z > window.innerWidth - 160 || all.h * getState().camera.z > window.innerHeight - 200) {
    setState({ camera: fitRect(all) });
  } else revealRect(all);
}

/* ── Pictures of the board ───────────────────────────────────────── */
/** Save the board, or just what's selected, as a PNG at twice screen resolution. */
export async function exportPng(only: "board" | "selection" = "board") {
  const { doc, selection, boards, activeBoard } = getState();
  const set = new Set(selection);
  const pick = only === "selection" && selection.length;
  const items = pick ? doc.items.filter((i) => set.has(i.id)) : doc.items;
  const marks = pick ? doc.marks.filter((m) => set.has(m.id)) : doc.marks;
  const r = union([...items.map(itemRect), ...marks.map(markRect)]);
  const world = document.querySelector<HTMLElement>("[data-world]");
  if (!r || !world) return false;
  const pad = 40;
  const box = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };

  // outlines and hover keys belong to the screen, not the picture
  setState({ selection: [], editingNote: null, editingShape: null });
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  const { toPng } = await import("html-to-image");
  const keep = pick ? set : null;
  try {
    const url = await toPng(world, {
      width: Math.ceil(box.w),
      height: Math.ceil(box.h),
      pixelRatio: 2,
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      style: { transform: `translate(${-box.x}px, ${-box.y}px)`, transformOrigin: "0 0" },
      // a picture from another site that won't share itself stays a blank space instead of failing the export
      imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      filter: (node) => {
        const el = node as HTMLElement;
        // pictures from other sites usually refuse to be copied into a canvas: leave them out
        if (el.tagName === "IMG") {
          const src = (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src;
          if (src && !src.startsWith("data:") && !src.startsWith("blob:") && new URL(src, location.href).origin !== location.origin) return false;
        }
        if (el.tagName === "IFRAME") return false;
        if (!el.dataset) return true;
        if (el.dataset.nodrag !== undefined || el.dataset.resize !== undefined || el.dataset.noteResize !== undefined || el.dataset.shapeResize !== undefined) return false;
        if (keep && el.dataset.item && !keep.has(el.dataset.item)) return false;
        if (keep && el.dataset.mark && !keep.has(el.dataset.mark)) return false;
        return true;
      },
    });
    const a = document.createElement("a");
    a.href = url;
    const name = (boards.find((b) => b.id === activeBoard)?.name ?? "board").replace(/[^\w-]+/g, "-");
    a.download = `${name}${pick ? "-selection" : ""}.png`;
    a.click();
    return true;
  } catch {
    window.dispatchEvent(new CustomEvent("putanything:toast", { detail: "the picture couldn't be made. try again, or save the board as a file." }));
    return false;
  } finally {
    setState({ selection });
  }
}

/* ── Arranging ───────────────────────────────────────────────────── */
type Edge = "left" | "center" | "right" | "top" | "middle" | "bottom";

function selected() {
  const { doc, selection } = getState();
  const set = new Set(selection);
  return {
    items: doc.items.filter((i) => set.has(i.id) && !i.locked),
    marks: doc.marks.filter((m) => set.has(m.id) && !m.locked),
  };
}

/** move each selected thing by its own offset, as one undo step */
function shiftEach(offsets: Map<string, Vec>) {
  commit((d) => ({
    items: d.items.map((i) => {
      const o = offsets.get(i.id);
      return o ? { ...i, x: Math.round(i.x + o[0]), y: Math.round(i.y + o[1]) } : i;
    }),
    marks: d.marks.map((m) => {
      const o = offsets.get(m.id);
      return o ? moveMark(m, o[0], o[1]) : m;
    }),
  }));
}

export function alignSelection(edge: Edge) {
  const { items, marks } = selected();
  const things = [...items.map((i) => ({ id: i.id, r: itemRect(i) })), ...marks.map((m) => ({ id: m.id, r: markRect(m) }))];
  if (things.length < 2) return;
  const box = union(things.map((t) => t.r))!;
  const offsets = new Map<string, Vec>();
  for (const { id, r } of things) {
    const dx =
      edge === "left" ? box.x - r.x : edge === "right" ? box.x + box.w - (r.x + r.w) : edge === "center" ? box.x + box.w / 2 - (r.x + r.w / 2) : 0;
    const dy =
      edge === "top" ? box.y - r.y : edge === "bottom" ? box.y + box.h - (r.y + r.h) : edge === "middle" ? box.y + box.h / 2 - (r.y + r.h / 2) : 0;
    if (dx || dy) offsets.set(id, [dx, dy]);
  }
  shiftEach(offsets);
}

/** equal gaps between neighbours, keeping the first and last where they are */
export function distributeSelection(axis: "x" | "y") {
  const { items, marks } = selected();
  const things = [...items.map((i) => ({ id: i.id, r: itemRect(i) })), ...marks.map((m) => ({ id: m.id, r: markRect(m) }))];
  if (things.length < 3) return;
  const pos = (r: Rect) => (axis === "x" ? r.x : r.y);
  const size = (r: Rect) => (axis === "x" ? r.w : r.h);
  things.sort((a, b) => pos(a.r) - pos(b.r));
  const first = things[0].r;
  const last = things[things.length - 1].r;
  const span = pos(last) + size(last) - pos(first);
  const gap = (span - things.reduce((s, t) => s + size(t.r), 0)) / (things.length - 1);
  let at = pos(first);
  const offsets = new Map<string, Vec>();
  for (const t of things) {
    const d = at - pos(t.r);
    if (Math.abs(d) > 0.01) offsets.set(t.id, axis === "x" ? [d, 0] : [0, d]);
    at += size(t.r) + gap;
  }
  shiftEach(offsets);
}

/** lock everything selected, or unlock it all if it's all locked already */
export function toggleLock(ids = getState().selection) {
  const set = new Set(ids);
  const { doc } = getState();
  const all = [...doc.items.filter((i) => set.has(i.id)), ...doc.marks.filter((m) => set.has(m.id))];
  if (!all.length) return;
  const lock = !all.every((x) => x.locked);
  commit((d) => ({
    items: d.items.map((i) => (set.has(i.id) ? { ...i, locked: lock || undefined } : i)),
    marks: d.marks.map((m) => (set.has(m.id) ? { ...m, locked: lock || undefined } : m)),
  }));
  return lock;
}
