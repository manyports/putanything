"use client";

import { useSyncExternalStore } from "react";
import type { Camera, Doc, Item, Mark, Tool } from "./types";
import { idbDelete, idbGet, idbSet } from "./idb";
import { settleArrows } from "./bind";

export interface BoardMeta {
  id: string;
  name: string;
}

export interface BoardState {
  /** every board on this device, in tab order */
  boards: BoardMeta[];
  activeBoard: string;
  doc: Doc;
  selection: string[];
  camera: Camera;
  tool: Tool;
  /** colour for new lines and notes: "ink", "accent", or a hex */
  tone: string;
  pen: { style: import("./types").PenStyle; size: number };
  /** what the shape tool draws */
  shape: { shape: import("./types").ShapeKind; fill: import("./types").ShapeFill };
  /** how new notes are set */
  text: { font: import("./types").NoteFont; size: number; bold: boolean; align: "left" | "center" | "right" };
  loaded: boolean;
  editingNote: string | null;
  /** a shape whose label is being written */
  editingShape: string | null;
  saveState: "saved" | "saving" | "error";
  savedAt: number | null;
}

const initial: BoardState = {
  boards: [],
  activeBoard: "",
  doc: { items: [], marks: [] },
  selection: [],
  camera: { x: 0, y: 0, z: 1 },
  tool: "select",
  tone: "ink",
  pen: { style: "pen", size: 2 },
  text: { font: "hand", size: 1, bold: false, align: "left" },
  shape: { shape: "rect", fill: "none" },
  loaded: false,
  editingNote: null,
  editingShape: null,
  saveState: "saved",
  savedAt: null,
};

let state: BoardState = initial;
const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<BoardState> | ((s: BoardState) => Partial<BoardState>)) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBoard<T>(selector: (s: BoardState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}

/* ── History ─────────────────────────────────────────────────────────
   Every change that should be undoable goes through commit(). Drags and
   strokes call live() on every frame and settle into one step when the
   gesture ends. Typing in a widget coalesces by key so a sentence is one
   step, not forty. Each board keeps its own history.                   */
let past: Doc[] = [];
let future: Doc[] = [];
let lastKey: string | null = null;
let lastAt = 0;
let gestureBase: Doc | null = null;
const histories = new Map<string, { past: Doc[]; future: Doc[] }>();

function pushPast(prev: Doc) {
  past.push(prev);
  if (past.length > 200) past.shift();
  future = [];
}

export function commit(fn: (doc: Doc) => Doc, opts: { key?: string } = {}) {
  const prev = state.doc;
  const next = settleArrows(fn(prev));
  if (next === prev) return;
  const now = Date.now();
  const coalesce = opts.key && opts.key === lastKey && now - lastAt < 1200;
  if (!coalesce && !gestureBase) pushPast(prev);
  lastKey = opts.key ?? null;
  lastAt = now;
  setState({ doc: next });
}

export function live(fn: (doc: Doc) => Doc) {
  const next = settleArrows(fn(state.doc));
  if (next !== state.doc) setState({ doc: next });
}

export function beginGesture() {
  gestureBase = state.doc;
}

export function endGesture() {
  if (gestureBase && gestureBase !== state.doc) pushPast(gestureBase);
  gestureBase = null;
  lastKey = null;
}

/** Abandon a gesture that made nothing worth keeping (a click with the arrow tool). */
export function cancelGesture() {
  if (gestureBase) setState({ doc: gestureBase });
  gestureBase = null;
}

/** Record one step from `base` to `next`, for edits that were shown live first. */
export function commitFrom(base: Doc, next: Doc) {
  pushPast(base);
  lastKey = null;
  setState({ doc: settleArrows(next) });
}

function pruneSelection(doc: Doc, sel: string[]) {
  const ids = new Set([...doc.items.map((i) => i.id), ...doc.marks.map((m) => m.id)]);
  return sel.filter((id) => ids.has(id));
}

export function undo() {
  const prev = past.pop();
  if (!prev) return;
  future.push(state.doc);
  lastKey = null;
  setState((s) => ({ doc: prev, selection: pruneSelection(prev, s.selection), editingNote: null }));
}

export function redo() {
  const next = future.pop();
  if (!next) return;
  past.push(state.doc);
  lastKey = null;
  setState((s) => ({ doc: next, selection: pruneSelection(next, s.selection), editingNote: null }));
}

/* ── Doc helpers ─────────────────────────────────────────────────── */
export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function topZ(doc: Doc) {
  return doc.items.reduce((m, i) => Math.max(m, i.z), 0);
}

export function updateItem(id: string, fn: (item: Item) => Item, key?: string) {
  commit(
    (doc) => ({
      ...doc,
      items: doc.items.map((i) => (i.id === id ? fn(i) : i)),
    }),
    { key },
  );
}

export function updateItemData<D>(id: string, patch: Partial<D>, opts: { key?: string; history?: boolean } = {}) {
  const apply = (doc: Doc): Doc => ({
    ...doc,
    items: doc.items.map((i) => (i.id === id ? { ...i, data: { ...i.data, ...patch } } : i)),
  });
  if (opts.history === false) live(apply);
  else commit(apply, { key: opts.key ?? `data:${id}` });
}

export function updateMark(id: string, fn: (m: Mark) => Mark, key?: string) {
  commit((doc) => ({ ...doc, marks: doc.marks.map((m) => (m.id === id ? fn(m) : m)) }), { key });
}

export function deleteIds(ids: string[]) {
  if (!ids.length) return;
  const set = new Set(ids);
  commit((doc) => ({
    items: doc.items.filter((i) => !set.has(i.id)),
    marks: doc.marks.filter((m) => !set.has(m.id)),
  }));
  setState((s) => ({ selection: s.selection.filter((id) => !set.has(id)), editingNote: null }));
}

export function bringToFront(id: string) {
  const { doc } = state;
  const item = doc.items.find((i) => i.id === id);
  if (!item) return;
  const top = topZ(doc);
  if (item.z === top && doc.items.filter((i) => i.z === top).length === 1) return;
  // Stacking is housekeeping, not an edit: it never takes an undo step.
  live((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, z: top + 1 } : i)) }));
}

export function replaceDoc(doc: Doc) {
  commit(() => doc);
  setState({ selection: [], editingNote: null });
}

/* ── Saving ──────────────────────────────────────────────────────────
   Everything is written to this browser's IndexedDB: each board's doc
   and view under its own key, and the list of boards beside them.
   A change is written 400ms after the last edit, at once when the tab
   is hidden or closed, and before switching boards.                   */
const INDEX_KEY = "boards:v2";
const docKey = (id: string) => `doc:${id}`;
const camKey = (id: string) => `cam:${id}`;

let pendingDoc: { id: string; doc: Doc } | null = null;
let pendingCam: { id: string; cam: Camera } | null = null;
let docTimer: ReturnType<typeof setTimeout> | null = null;
let camTimer: ReturnType<typeof setTimeout> | null = null;

function writeDoc() {
  if (docTimer) clearTimeout(docTimer);
  docTimer = null;
  const p = pendingDoc;
  pendingDoc = null;
  if (!p) return Promise.resolve();
  return idbSet(docKey(p.id), p.doc)
    .then(() => {
      if (!pendingDoc) setState({ saveState: "saved", savedAt: Date.now() });
    })
    .catch(() => setState({ saveState: "error" }));
}

function writeCam() {
  if (camTimer) clearTimeout(camTimer);
  camTimer = null;
  const p = pendingCam;
  pendingCam = null;
  if (!p) return Promise.resolve();
  return idbSet(camKey(p.id), p.cam).catch(() => {});
}

function writeIndex() {
  return idbSet(INDEX_KEY, { boards: state.boards, active: state.activeBoard }).catch(() =>
    setState({ saveState: "error" }),
  );
}

export function flush() {
  return Promise.all([writeDoc(), writeCam()]);
}

/* ── Boards ──────────────────────────────────────────────────────── */
const cache = new Map<string, { doc: Doc; camera: Camera | null }>();
let cameraForDoc: (doc: Doc) => Camera = () => ({ x: 0, y: 0, z: 1 });
// a board switch sets doc and camera itself; the watcher must not read that as an edit
let switching = false;

export async function switchBoard(id: string) {
  if (id === state.activeBoard || !state.boards.some((b) => b.id === id)) return;
  cache.set(state.activeBoard, { doc: state.doc, camera: state.camera });
  histories.set(state.activeBoard, { past, future });
  await flush();

  let next = cache.get(id);
  if (!next) {
    const [doc, camera] = await Promise.all([idbGet<Doc>(docKey(id)), idbGet<Camera>(camKey(id))]);
    next = { doc: doc ?? { items: [], marks: [] }, camera: camera ?? null };
  }
  const h = histories.get(id) ?? { past: [], future: [] };
  past = h.past;
  future = h.future;
  lastKey = null;
  gestureBase = null;

  switching = true;
  setState({
    activeBoard: id,
    doc: next.doc,
    camera: next.camera ?? cameraForDoc(next.doc),
    selection: [],
    editingNote: null,
  });
  switching = false;
  writeIndex();
}

function nextBoardName() {
  const taken = new Set(state.boards.map((b) => b.name));
  for (let n = state.boards.length + 1; ; n++) if (!taken.has(`board ${n}`)) return `board ${n}`;
}

export async function addBoard(name?: string, start?: Doc) {
  const id = uid();
  const doc: Doc = settleArrows(start ?? { items: [], marks: [] });
  cache.set(id, { doc, camera: null });
  await idbSet(docKey(id), doc).catch(() => {});
  setState((s) => ({ boards: [...s.boards, { id, name: name ?? nextBoardName() }] }));
  await switchBoard(id);
  return id;
}

export function renameBoard(id: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) return;
  setState((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, name: clean } : b)) }));
  writeIndex();
}

export async function deleteBoard(id: string) {
  if (state.boards.length < 2) return;
  const i = state.boards.findIndex((b) => b.id === id);
  if (i < 0) return;
  if (id === state.activeBoard) {
    const neighbour = state.boards[i + 1] ?? state.boards[i - 1];
    await switchBoard(neighbour.id);
  }
  setState((s) => ({ boards: s.boards.filter((b) => b.id !== id) }));
  cache.delete(id);
  histories.delete(id);
  writeIndex();
  idbDelete(docKey(id)).catch(() => {});
  idbDelete(camKey(id)).catch(() => {});
}

/** A copy of a board, placed right after it, with fresh ids so the two never share a plate. */
export async function duplicateBoard(id: string) {
  const meta = state.boards.find((b) => b.id === id);
  if (!meta) return;
  let doc: Doc;
  if (id === state.activeBoard) doc = state.doc;
  else doc = cache.get(id)?.doc ?? (await idbGet<Doc>(docKey(id))) ?? { items: [], marks: [] };
  const copy: Doc = {
    items: doc.items.map((i) => ({ ...i, id: uid() })),
    marks: doc.marks.map((m) => ({ ...m, id: uid() })),
  };
  const nid = uid();
  cache.set(nid, { doc: copy, camera: id === state.activeBoard ? state.camera : (cache.get(id)?.camera ?? null) });
  await idbSet(docKey(nid), copy).catch(() => {});
  const at = state.boards.findIndex((b) => b.id === id) + 1;
  setState((s) => {
    const boards = [...s.boards];
    boards.splice(at, 0, { id: nid, name: `${meta.name} copy`.slice(0, 40) });
    return { boards };
  });
  await switchBoard(nid);
}

/** Every board's contents: the one on screen as it is now, the rest from memory or from storage. */
export async function allBoards(): Promise<{ id: string; name: string; doc: Doc }[]> {
  return Promise.all(
    state.boards.map(async (b) => {
      if (b.id === state.activeBoard) return { ...b, doc: state.doc };
      const doc = cache.get(b.id)?.doc ?? (await idbGet<Doc>(docKey(b.id))) ?? { items: [], marks: [] };
      return { ...b, doc };
    }),
  );
}

export function moveBoard(id: string, to: number) {
  setState((s) => {
    const boards = s.boards.filter((b) => b.id !== id);
    const b = s.boards.find((x) => x.id === id);
    if (!b) return {};
    boards.splice(Math.max(0, Math.min(to, boards.length)), 0, b);
    return { boards };
  });
  writeIndex();
}

/* ── Loading ─────────────────────────────────────────────────────── */
let loading = false;

export async function loadBoard(seed: () => Doc, cameraFor: (doc: Doc) => Camera, firstVisit?: () => { name: string; doc: Doc }[]) {
  if (loading) return;
  loading = true;
  cameraForDoc = cameraFor;

  // ask the browser not to clear this site's storage when space runs low
  navigator.storage?.persist?.().catch(() => {});

  let boards: BoardMeta[] = [];
  let active = "";
  let doc: Doc | undefined;
  let camera: Camera | undefined;

  try {
    const index = await idbGet<{ boards: BoardMeta[]; active: string }>(INDEX_KEY);
    if (index?.boards?.length) {
      boards = index.boards;
      active = boards.some((b) => b.id === index.active) ? index.active : boards[0].id;
      [doc, camera] = await Promise.all([idbGet<Doc>(docKey(active)), idbGet<Camera>(camKey(active))]);
    } else {
      // the single board from before there were tabs becomes the first tab
      const [old, oldCam] = await Promise.all([idbGet<Doc>("board:v1"), idbGet<Camera>("camera:v1")]);
      active = uid();
      boards = [{ id: active, name: "board 1" }];
      doc = old && Array.isArray(old.items) ? old : seed();
      camera = old ? oldCam : undefined;
      await idbSet(docKey(active), doc);
      if (camera) await idbSet(camKey(active), camera);
      // someone new: the walk-through waits in the next tab
      if (!old && firstVisit) {
        for (const extra of firstVisit()) {
          const id = uid();
          boards.push({ id, name: extra.name });
          await idbSet(docKey(id), settleArrows(extra.doc));
        }
      }
    }
  } catch {
    active = uid();
    boards = [{ id: active, name: "board 1" }];
    doc = seed();
  }
  const d = doc && Array.isArray(doc.items) ? doc : { items: [], marks: [] };
  setState({ boards, activeBoard: active, doc: d, camera: camera ?? cameraFor(d), loaded: true });
  writeIndex();

  let lastDoc = state.doc;
  let lastCam = state.camera;
  subscribe(() => {
    if (switching) {
      lastDoc = state.doc;
      lastCam = state.camera;
      return;
    }
    if (state.doc !== lastDoc) {
      lastDoc = state.doc;
      pendingDoc = { id: state.activeBoard, doc: state.doc };
      if (state.saveState !== "saving") setState({ saveState: "saving" });
      if (docTimer) clearTimeout(docTimer);
      docTimer = setTimeout(writeDoc, 400);
    }
    if (state.camera !== lastCam) {
      lastCam = state.camera;
      pendingCam = { id: state.activeBoard, cam: state.camera };
      if (camTimer) clearTimeout(camTimer);
      camTimer = setTimeout(writeCam, 600);
    }
  });

  const now = () => {
    flush();
  };
  window.addEventListener("pagehide", now);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && now());
}
