"use client";

import { CommandPalette, ContextMenu, Modal, Button, useToast } from "@blurrow/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Arrow, Doc, Item, Mark, Note, Rect, Shape, Stroke, Tool, Vec, WidgetKind } from "@/lib/types";
import {
  beginGesture,
  bringToFront,
  commit,
  deleteBoard,
  switchBoard,
  cancelGesture,
  deleteIds,
  endGesture,
  getState,
  live,
  loadBoard,
  redo,
  replaceDoc,
  setState,
  uid,
  undo,
  useBoard,
} from "@/lib/store";
import { contains, hitMark, itemRect, markRect, moveMark, toWorld, union, zoomAt } from "@/lib/geom";
import {
  addWidget,
  cloneLive,
  exportPng,
  toggleLock,
  duplicateSelection,
  zoomToSelection,
  exportBoard,
  fitAll,
  nudge,
  parseBoardFile,
  putFile,
  putText,
  resetZoom,
  selectAll,
  serializeSelection,
  trackPointer,
  zoomBy,
} from "@/lib/actions";
import { cameraFor, seedDoc } from "@/lib/seed";
import { targetAt } from "@/lib/bind";
import { tutorialDoc } from "@/lib/templates";
import { SHELF, WIDGETS } from "../widgets/registry";
import { WidgetFrame } from "./WidgetFrame";
import { InkLayer, PEN_SIZES } from "./InkLayer";
import { LINE_HEIGHT, NOTE_SIZES } from "@/lib/notes";
import { PdfImport } from "./PdfImport";
import { Search } from "./Search";
import { Minimap } from "./Minimap";
import { ChromeLayer } from "./ChromeLayer";
import { Toolbar } from "./Toolbar";
import { Header, HelpSheet, ZoomControls, modKey } from "./Chrome";
import {
  IconArrow,
  IconCopy,
  IconDownload,
  IconEraser,
  IconFit,
  IconHand,
  IconImage,
  IconLock,
  IconShapes,
  IconPen,
  IconSelect,
  IconText,
  IconTrash,
  IconUpload,
} from "../icons";

type Gesture =
  | { type: "pan"; sx: number; sy: number; cx: number; cy: number }
  | { type: "pinch"; d0: number; z0: number; mid0: Vec; cam0: { x: number; y: number } }
  | {
      type: "move";
      ids: string[];
      start: Vec;
      startS: Vec;
      moved: boolean;
      target?: HTMLElement;
      items0: Item[];
      marks0: Mark[];
    }
  | { type: "resize"; id: string; corner: string; r0: Rect; start: Vec; moved: boolean }
  | { type: "marquee"; start: Vec; base: string[] }
  | { type: "shape"; id: string; start: Vec }
  | { type: "shapeSize"; id: string; corner: string; r0: Rect; start: Vec; moved: boolean }
  | { type: "noteScale"; id: string; corner: string; r0: Rect; size0: number; width0?: number; start: Vec; moved: boolean }
  | { type: "pen"; id: string }
  | { type: "arrow"; id: string; start: Vec }
  | { type: "erase"; hit: boolean };

const DRAW_TOOLS: Tool[] = ["pen", "arrow", "text", "shape", "eraser"];

/** What a press on a plate leaves alone: anything you type in, press, or slide. */
const GRABLESS =
  'input, textarea, select, button, a[href], label, [contenteditable="true"], [role="slider"], [role="checkbox"], [role="radio"], [role="tab"], [role="combobox"], [role="listbox"], [data-nodrag], [data-keys] .no-grab';

function isEditable(el: Element | null) {
  return !!el?.closest('input, textarea, select, [contenteditable="true"], [data-keys], [role="dialog"], [role="listbox"], [role="menu"]');
}

/** Does this element (or a scrollable parent inside the plate) have room to scroll? */
function scrollsInside(target: HTMLElement) {
  let el: HTMLElement | null = target.closest("[data-scrollable]");
  while (el) {
    if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement?.closest("[data-scrollable]") ?? null;
  }
  return false;
}

/* Stretch a plate from one of its corners or edges. The opposite side stays
   where it is; pictures (or anything, with shift held) keep their shape. */
function resizeRect(item: Item, corner: string, r0: Rect, dx: number, dy: number, lock: boolean): Rect {
  const def = WIDGETS[item.kind];
  const minW = def.min.w;
  const minH = def.min.h;
  const left = corner.includes("w");
  const right = corner.includes("e");
  const top = corner.includes("n");
  const bottom = corner.includes("s");

  let w = r0.w + (right ? dx : left ? -dx : 0);
  let h = r0.h + (bottom ? dy : top ? -dy : 0);
  w = Math.max(minW, Math.round(w));
  h = Math.max(minH, Math.round(h));

  if (def.keepAspect || lock) {
    // the face keeps its proportions; the 10px bezel and nothing else ride along
    const chrome = 10;
    const ratio = def.keepAspect
      ? (item.data as { nw: number; nh: number }).nw / (item.data as { nw: number; nh: number }).nh
      : (r0.w - chrome) / (r0.h - chrome);
    const byWidth = left || right ? (corner.length === 1 ? true : Math.abs(dx) >= Math.abs(dy)) : false;
    if (byWidth) h = Math.round((w - chrome) / ratio + chrome);
    else w = Math.round((h - chrome) * ratio + chrome);
    if (w < minW) {
      w = minW;
      h = Math.round((w - chrome) / ratio + chrome);
    }
    if (h < minH) {
      h = minH;
      w = Math.round((h - chrome) * ratio + chrome);
    }
  }

  return {
    x: left ? r0.x + r0.w - w : r0.x,
    y: top ? r0.y + r0.h - h : r0.y,
    w,
    h,
  };
}

/** a new, empty note in the text style chosen on the strip, its first line centred on the click */
function newNote(at: Vec): Note {
  const { text, tone } = getState();
  const size = NOTE_SIZES[text.size] ?? 26;
  return {
    id: uid(),
    kind: "text",
    x: at[0],
    y: at[1] - (size * LINE_HEIGHT) / 2,
    text: "",
    size,
    tone,
    font: text.font,
    bold: text.bold || undefined,
    align: text.align === "left" ? undefined : text.align,
  };
}

/* Scale a note from one of its corners: the type grows with the drag and the
   opposite corner stays where it is.                                   */
function scaleNote(n: Note, corner: string, r0: Rect, size0: number, dx: number, dy: number, width0?: number): Note {
  // a side grip sets the width: the words wrap and the size stays as it is
  if (corner === "e" || corner === "w") {
    const w = Math.round(Math.max(n.size * 1.5, r0.w + (corner === "e" ? dx : -dx)));
    return { ...n, width: w, x: corner === "w" ? r0.x + r0.w - w : r0.x };
  }
  const sx = (r0.w + (corner.includes("e") ? dx : -dx)) / r0.w;
  const sy = (r0.h + (corner.includes("s") ? dy : -dy)) / r0.h;
  const k = Math.max(sx, sy);
  const size = Math.round(Math.min(240, Math.max(10, size0 * k)) * 2) / 2;
  const f = size / size0;
  return {
    ...n,
    size,
    // a wrapped note grows with its text, so it wraps the same way at the new size
    width: width0 ? Math.round(width0 * f) : n.width,
    x: corner.includes("w") ? r0.x + r0.w - r0.w * f : r0.x,
    y: corner.includes("n") ? r0.y + r0.h - r0.h * f : r0.y,
  };
}

function snapAngle(a: Vec, b: Vec): Vec {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 12;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
}

export function Board() {
  const camera = useBoard((s) => s.camera);
  const doc = useBoard((s) => s.doc);
  const selection = useBoard((s) => s.selection);
  const tool = useBoard((s) => s.tool);
  const loaded = useBoard((s) => s.loaded);
  const editingNote = useBoard((s) => s.editingNote);
  const editingShape = useBoard((s) => s.editingShape);
  const { toast } = useToast();

  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, Vec>());
  const spaceRef = useRef(false);
  const penSeen = useRef(false);
  // the paste listener is set up once; it reaches the current way of laying files down through this
  const layFilesRef = useRef<(files: File[], at?: Vec) => Promise<void>>(async () => {});
  const fileRef = useRef<HTMLInputElement>(null);
  const ctxAt = useRef<{ world: Vec; target: string | null }>({ world: [0, 0], target: null });

  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [guides, setGuides] = useState<{ x: number[]; y: number[]; box: Rect | null } | null>(null);
  const [panning, setPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [search, setSearch] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const boards = useBoard((st) => st.boards);
  const [ctxTarget, setCtxTarget] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  // which scrollable parts actually overflow, so only those take a finger's swipe as a scroll
  useEffect(() => {
    const mark = () =>
      document.querySelectorAll<HTMLElement>("[data-item] [data-scrollable]").forEach((el) => {
        const over = el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        if (over !== el.hasAttribute("data-overflows")) el.toggleAttribute("data-overflows", over);
      });
    mark();
    const t = setInterval(mark, 1200);
    window.addEventListener("resize", mark);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", mark);
    };
  }, [doc]);

  // the + tray's "picture or pdf" row asks for a file through this
  useEffect(() => {
    const pick = () => mediaRef.current?.click();
    window.addEventListener("putanything:pick-media", pick);
    return () => window.removeEventListener("putanything:pick-media", pick);
  }, []);

  useEffect(() => {
    loadBoard(seedDoc, cameraFor, () => [{ name: "how it works", doc: tutorialDoc() }]);
  }, []);

  // keep DOM order stable; stacking is zIndex alone, so raising a plate never moves a node (or steals focus)
  const items = doc.items;
  const selSet = useMemo(() => new Set(selection), [selection]);

  /* ── Removing, with a way back ─────────────────────────────────── */
  const removeWithNote = useCallback(
    (all: string[]) => {
      const { doc } = getState();
      const locked = new Set([...doc.items.filter((i) => i.locked), ...doc.marks.filter((m) => m.locked)].map((x) => x.id));
      const ids = all.filter((id) => !locked.has(id));
      if (all.length && !ids.length) {
        toast({ title: "it's locked. unlock it first.", duration: 2200 });
        return;
      }
      if (!ids.length) return;
      const widgets = doc.items.filter((i) => ids.includes(i.id));
      deleteIds(ids);
      if (widgets.length) {
        const what = widgets.length === 1 ? `the ${WIDGETS[widgets[0].kind].name}` : `${widgets.length} things`;
        toast({ title: `took ${what} off the board. ${modKey()} z puts it back.`, duration: 2600 });
      }
    },
    [toast],
  );

  const closeItem = useCallback((id: string) => removeWithNote([id]), [removeWithNote]);

  // messages from outside react (an export that failed) arrive as an event
  useEffect(() => {
    const show = (e: Event) => toast({ title: String((e as CustomEvent).detail), variant: "error" });
    window.addEventListener("putanything:toast", show);
    return () => window.removeEventListener("putanything:toast", show);
  }, [toast]);

  /* ── Pointer ───────────────────────────────────────────────────── */
  const startPan = (sx: number, sy: number) => {
    const { camera } = getState();
    gesture.current = { type: "pan", sx, sy, cx: camera.x, cy: camera.y };
    setPanning(true);
  };

  const selectFor = (id: string, additive: boolean) => {
    const { selection } = getState();
    if (additive) {
      setState({ selection: selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id] });
    } else if (!selection.includes(id)) {
      setState({ selection: [id] });
    }
  };

  const eraseAt = (p: Vec) => {
    const r = 8 / getState().camera.z;
    let hit = false;
    live((d) => {
      const marks = d.marks.filter((m) => m.locked || !hitMark(m, p, r));
      if (marks.length === d.marks.length) return d;
      hit = true;
      return { ...d, marks };
    });
    return hit;
  };

  /** Begin moving the selection. With alt held, the selection is copied first and the copies are what move. */
  const startMove = (world: Vec, sx: number, sy: number, alt: boolean, target?: HTMLElement) => {
    const { doc: d0 } = getState();
    const lockedIds = new Set([...d0.items.filter((i) => i.locked), ...d0.marks.filter((m) => m.locked)].map((x) => x.id));
    // locked things stay put; alt still copies them (the copy isn't locked)
    const ids = alt ? cloneLive(getState().selection) : getState().selection.filter((id) => !lockedIds.has(id));
    const set = new Set(ids);
    // an arrow dragged away from what it's attached to lets go of it (unless that comes along too)
    live((d) => ({
      ...d,
      marks: d.marks.map((m) =>
        m.kind === "arrow" && set.has(m.id) && ((m.from && !set.has(m.from)) || (m.to && !set.has(m.to)))
          ? { ...m, from: m.from && set.has(m.from) ? m.from : undefined, to: m.to && set.has(m.to) ? m.to : undefined }
          : m,
      ),
    }));
    const { doc } = getState();
    gesture.current = {
      type: "move",
      ids,
      start: world,
      startS: [sx, sy],
      moved: false,
      target,
      items0: doc.items.filter((i) => set.has(i.id)),
      marks0: doc.marks.filter((m) => set.has(m.id)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // a gesture may pass over an embedded player; it mustn't catch the pointer
    document.querySelectorAll<HTMLIFrameElement>("[data-item] iframe").forEach((f) => (f.style.pointerEvents = "none"));
    const t = e.target as HTMLElement;
    const s = getState();
    const sx = e.clientX;
    const sy = e.clientY;
    const world = toWorld(s.camera, sx, sy);

    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, [sx, sy]);
      if (touches.current.size === 2) {
        // a second finger means a pinch, even if the first had started moving a plate
        const g0 = gesture.current;
        if (g0 && g0.type !== "pan" && g0.type !== "marquee" && g0.type !== "pinch") {
          cancelGesture();
          document.querySelectorAll("[data-lifted]").forEach((el) => el.removeAttribute("data-lifted"));
        }
        const [a, b] = [...touches.current.values()];
        gesture.current = {
          type: "pinch",
          d0: Math.hypot(a[0] - b[0], a[1] - b[1]),
          z0: s.camera.z,
          mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          cam0: { x: s.camera.x, y: s.camera.y },
        };
        setMarquee(null);
        return;
      }
    }

    if (e.button === 1 || (e.button === 0 && (spaceRef.current || s.tool === "hand"))) {
      e.preventDefault();
      startPan(sx, sy);
      return;
    }
    if (e.button !== 0) return;

    if (e.pointerType === "pen") penSeen.current = true;
    if (t.closest("[data-capture]") && e.pointerType === "touch" && penSeen.current && s.tool !== "text") {
      // a pencil has been used: a finger (or a palm) moves the board instead of drawing
      e.preventDefault();
      startPan(sx, sy);
      return;
    }
    if (t.closest("[data-capture]")) {
      e.preventDefault();
      if (s.tool === "pen") {
        const stroke: Stroke = {
          id: uid(),
          kind: "stroke",
          pts: [[world[0], world[1], e.pointerType === "pen" ? e.pressure : 0.5]],
          tone: s.tone,
          style: s.pen.style,
          size: PEN_SIZES[s.pen.style][s.pen.size],
        };
        beginGesture();
        live((d) => ({ ...d, marks: [...d.marks, stroke] }));
        gesture.current = { type: "pen", id: stroke.id };
      } else if (s.tool === "arrow") {
        const arrow: Arrow = { id: uid(), kind: "arrow", a: world, b: world, tone: s.tone, seed: Math.floor(Math.random() * 1e9) };
        beginGesture();
        live((d) => ({ ...d, marks: [...d.marks, arrow] }));
        gesture.current = { type: "arrow", id: arrow.id, start: world };
      } else if (s.tool === "shape") {
        const shape: Shape = {
          id: uid(),
          kind: "shape",
          shape: s.shape.shape,
          fill: s.shape.fill,
          x: world[0],
          y: world[1],
          w: 0,
          h: 0,
          tone: s.tone,
          seed: Math.floor(Math.random() * 1e9),
        };
        beginGesture();
        live((d) => ({ ...d, marks: [...d.marks, shape] }));
        gesture.current = { type: "shape", id: shape.id, start: world };
      } else if (s.tool === "eraser") {
        beginGesture();
        gesture.current = { type: "erase", hit: eraseAt(world) };
      } else if (s.tool === "text") {
        const note = newNote(world);
        live((d) => ({ ...d, marks: [...d.marks, note] }));
        // selected while it's written, so the text strip changes this note
        setState({ editingNote: note.id, tool: "select", selection: [note.id] });
      }
      return;
    }

    if (t.closest("[data-nodrag]")) return;

    const shapeGrip = t.closest("[data-shape-resize]") as HTMLElement | null;
    if (shapeGrip) {
      e.preventDefault();
      const m = s.doc.marks.find((x) => x.id === shapeGrip.dataset.shapeResize);
      if (!m || m.kind !== "shape") return;
      beginGesture();
      gesture.current = { type: "shapeSize", id: m.id, corner: shapeGrip.dataset.corner ?? "se", r0: markRect(m), start: world, moved: false };
      return;
    }

    const noteGrip = t.closest("[data-note-resize]") as HTMLElement | null;
    if (noteGrip) {
      e.preventDefault();
      const n = s.doc.marks.find((m) => m.id === noteGrip.dataset.noteResize);
      if (!n || n.kind !== "text") return;
      beginGesture();
      gesture.current = {
        type: "noteScale",
        id: n.id,
        corner: noteGrip.dataset.corner ?? "se",
        r0: markRect(n),
        size0: n.size,
        width0: n.width,
        start: world,
        moved: false,
      };
      return;
    }

    const resizeEl = t.closest("[data-resize]") as HTMLElement | null;
    if (resizeEl) {
      e.preventDefault();
      const resizeId = resizeEl.dataset.resize!;
      const item = s.doc.items.find((i) => i.id === resizeId);
      if (!item || item.locked) return;
      setState({ selection: [resizeId] });
      bringToFront(resizeId);
      beginGesture();
      gesture.current = {
        type: "resize",
        id: resizeId,
        corner: resizeEl.dataset.corner ?? "se",
        r0: { x: item.x, y: item.y, w: item.w, h: item.h },
        start: world,
        moved: false,
      };
      return;
    }

    const dragId = (t.closest("[data-drag]") as HTMLElement | null)?.dataset.drag;
    if (dragId) {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      selectFor(dragId, e.shiftKey);
      bringToFront(dragId);
      beginGesture();
      startMove(world, sx, sy, e.altKey);
      return;
    }

    const itemId = (t.closest("[data-item]") as HTMLElement | null)?.dataset.item;
    if (itemId) {
      selectFor(itemId, e.shiftKey);
      bringToFront(itemId);
      // controls keep the press; anything else on the plate is something to hold it by
      if (t.closest(GRABLESS) || window.getSelection()?.toString()) return;
      // on a touch screen, a finger on a part that scrolls scrolls it
      if (e.pointerType === "touch" && scrollsInside(t)) return;
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      beginGesture();
      startMove(world, sx, sy, e.altKey, t);
      return;
    }

    const markId = (t.closest("[data-mark]") as HTMLElement | null)?.dataset.mark;
    if (markId && markId !== s.editingNote) {
      e.preventDefault();
      selectFor(markId, e.shiftKey);
      beginGesture();
      startMove(world, sx, sy, e.altKey);
      return;
    }

    if (!t.closest("[data-canvas]")) return;

    // lines and arrows are found by distance, not by their thin painted shape
    if (s.tool === "select") {
      const reach = 7 / s.camera.z;
      const hit = [...s.doc.marks].reverse().find((m) => m.kind !== "text" && hitMark(m, world, reach));
      if (hit) {
        e.preventDefault();
        selectFor(hit.id, e.shiftKey);
        beginGesture();
        startMove(world, sx, sy, e.altKey);
        return;
      }
    }

    // the bare board
    if (s.editingNote) (document.activeElement as HTMLElement | null)?.blur?.();
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (e.pointerType === "touch") {
      setState({ selection: [] });
      startPan(sx, sy);
      return;
    }
    e.preventDefault();
    if (!e.shiftKey) setState({ selection: [] });
    gesture.current = { type: "marquee", start: world, base: e.shiftKey ? s.selection : [] };
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const root = rootRef.current;
      const over = !!root && (e.target as HTMLElement)?.closest?.("[data-canvas]") !== null;
      trackPointer(e.clientX, e.clientY, over);

      if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
        touches.current.set(e.pointerId, [e.clientX, e.clientY]);
      }
      const g = gesture.current;
      if (!g) return;
      const s = getState();
      const w = toWorld(s.camera, e.clientX, e.clientY);

      switch (g.type) {
        case "pan":
          setState({ camera: { ...s.camera, x: g.cx + (e.clientX - g.sx), y: g.cy + (e.clientY - g.sy) } });
          break;
        case "pinch": {
          if (touches.current.size < 2) break;
          const [a, b] = [...touches.current.values()];
          const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          const mid: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const base = { x: g.cam0.x + (mid[0] - g.mid0[0]), y: g.cam0.y + (mid[1] - g.mid0[1]), z: g.z0 };
          setState({ camera: zoomAt(base, mid[0], mid[1], g.z0 * (d / g.d0)) });
          break;
        }
        case "move": {
          if (!g.moved) {
            if (Math.hypot(e.clientX - g.startS[0], e.clientY - g.startS[1]) < 3) return;
            g.moved = true;
            g.ids.forEach((id) => document.querySelector(`[data-item="${id}"]`)?.setAttribute("data-lifted", "true"));
          }
          let tdx = w[0] - g.start[0];
          let tdy = w[1] - g.start[1];
          const ids = new Set(g.ids);

          // snap the moving plates' edges and centres to the plates around them (⌘ to move freely)
          const lines: { x: number[]; y: number[]; box: Rect | null } = { x: [], y: [], box: null };
          if (!(e.metaKey || e.ctrlKey) && g.items0.length) {
            const box0 = union(g.items0.map(itemRect))!;
            const tol = 7 / s.camera.z;
            const others = s.doc.items.filter((i) => !ids.has(i.id));
            const pick = (mine: number[], theirs: number[]) => {
              let best: { d: number; at: number } | null = null;
              for (const a of mine) for (const b of theirs) if (Math.abs(b - a) < tol && (!best || Math.abs(b - a) < Math.abs(best.d))) best = { d: b - a, at: b };
              return best;
            };
            const xs = (r: Rect) => [r.x, r.x + r.w / 2, r.x + r.w];
            const ys = (r: Rect) => [r.y, r.y + r.h / 2, r.y + r.h];
            const moved = { ...box0, x: box0.x + tdx, y: box0.y + tdy };
            const sx = pick(xs(moved), others.flatMap((o) => xs(itemRect(o))));
            const sy = pick(ys(moved), others.flatMap((o) => ys(itemRect(o))));
            if (sx) {
              tdx += sx.d;
              lines.x.push(sx.at);
            }
            if (sy) {
              tdy += sy.d;
              lines.y.push(sy.at);
            }
            lines.box = { ...box0, x: box0.x + tdx, y: box0.y + tdy };
          }
          setGuides(lines.x.length || lines.y.length ? lines : null);

          const items0 = new Map(g.items0.map((i) => [i.id, i]));
          const marks0 = new Map(g.marks0.map((m) => [m.id, m]));
          live((d) => ({
            items: d.items.map((i) => {
              const o = items0.get(i.id);
              return o ? { ...i, x: o.x + tdx, y: o.y + tdy } : i;
            }),
            marks: marks0.size
              ? d.marks.map((m) => {
                  const o = marks0.get(m.id);
                  return o ? moveMark(o, tdx, tdy) : m;
                })
              : d.marks,
          }));
          break;
        }
        case "resize": {
          g.moved = true;
          live((d) => ({
            ...d,
            items: d.items.map((i) => (i.id === g.id ? { ...i, ...resizeRect(i, g.corner, g.r0, w[0] - g.start[0], w[1] - g.start[1], e.shiftKey) } : i)),
          }));
          break;
        }
        case "shape": {
          let dx = w[0] - g.start[0];
          let dy = w[1] - g.start[1];
          if (e.shiftKey) {
            // shift: a square, a circle, an even diamond
            const m = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx || 1) * m;
            dy = Math.sign(dy || 1) * m;
          }
          const r = { x: Math.min(g.start[0], g.start[0] + dx), y: Math.min(g.start[1], g.start[1] + dy), w: Math.abs(dx), h: Math.abs(dy) };
          live((d) => ({ ...d, marks: d.marks.map((m) => (m.id === g.id && m.kind === "shape" ? { ...m, ...r } : m)) }));
          break;
        }
        case "shapeSize": {
          g.moved = true;
          const dx = w[0] - g.start[0];
          const dy = w[1] - g.start[1];
          const { r0, corner } = g;
          let nw = r0.w + (corner.includes("e") ? dx : -dx);
          let nh = r0.h + (corner.includes("s") ? dy : -dy);
          if (e.shiftKey) {
            const k = Math.max(nw / r0.w, nh / r0.h);
            nw = r0.w * k;
            nh = r0.h * k;
          }
          nw = Math.max(8, nw);
          nh = Math.max(8, nh);
          const r = { x: corner.includes("w") ? r0.x + r0.w - nw : r0.x, y: corner.includes("n") ? r0.y + r0.h - nh : r0.y, w: nw, h: nh };
          live((d) => ({ ...d, marks: d.marks.map((m) => (m.id === g.id && m.kind === "shape" ? { ...m, ...r } : m)) }));
          break;
        }
        case "noteScale": {
          g.moved = true;
          live((d) => ({
            ...d,
            marks: d.marks.map((m) =>
              m.id === g.id && m.kind === "text" ? scaleNote(m, g.corner, g.r0, g.size0, w[0] - g.start[0], w[1] - g.start[1], g.width0) : m,
            ),
          }));
          break;
        }
        case "marquee": {
          const r: Rect = {
            x: Math.min(g.start[0], w[0]),
            y: Math.min(g.start[1], w[1]),
            w: Math.abs(w[0] - g.start[0]),
            h: Math.abs(w[1] - g.start[1]),
          };
          setMarquee(r);
          const hits = [
            ...s.doc.items.filter((i) => contains(r, itemRect(i))).map((i) => i.id),
            ...s.doc.marks.filter((m) => contains(r, markRect(m))).map((m) => m.id),
          ];
          const next = [...new Set([...g.base, ...hits])];
          if (next.join() !== s.selection.join()) setState({ selection: next });
          break;
        }
        case "pen": {
          // every position the pointer passed through since the last frame, not just the latest,
          // so a quick curve stays a curve instead of a run of straight cuts
          const evs = e.getCoalescedEvents?.() ?? [];
          const pts: [number, number, number][] = (evs.length ? evs : [e]).map((ev) => {
            const [x, y] = toWorld(s.camera, ev.clientX, ev.clientY);
            return [x, y, ev.pointerType === "pen" ? ev.pressure : 0.5];
          });
          live((d) => ({
            ...d,
            marks: d.marks.map((m) => (m.id === g.id && m.kind === "stroke" ? { ...m, pts: [...m.pts, ...pts] } : m)),
          }));
          break;
        }
        case "arrow": {
          const b = e.shiftKey ? snapAngle(g.start, w) : w;
          live((d) => ({
            ...d,
            marks: d.marks.map((m) => (m.id === g.id && m.kind === "arrow" ? { ...m, b } : m)),
          }));
          break;
        }
        case "erase":
          if (eraseAt(w)) g.hit = true;
          break;
      }
    };

    const onUp = (e: PointerEvent) => {
      document.querySelectorAll<HTMLIFrameElement>("[data-item] iframe").forEach((f) => (f.style.pointerEvents = ""));
      if (e.pointerType === "touch") {
        touches.current.delete(e.pointerId);
        const g = gesture.current;
        if (g?.type === "pinch") {
          if (touches.current.size === 1) {
            const [p] = [...touches.current.values()];
            startPan(p[0], p[1]);
          } else gesture.current = null;
          return;
        }
      }
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      switch (g.type) {
        case "pan":
          setPanning(false);
          break;
        case "move":
          setGuides(null);
          document.querySelectorAll("[data-lifted]").forEach((el) => el.removeAttribute("data-lifted"));
          if (g.moved) {
            // land on whole pixels so plates line up by eye
            const ids = new Set(g.ids);
            live((d) => ({
              ...d,
              items: d.items.map((i) => (ids.has(i.id) ? { ...i, x: Math.round(i.x), y: Math.round(i.y) } : i)),
            }));
            endGesture();
            // the plate travelled under the pointer; the click that follows isn't a press on what's beneath
            const swallow = (ev: MouseEvent) => {
              ev.stopPropagation();
              ev.preventDefault();
            };
            window.addEventListener("click", swallow, { capture: true, once: true });
            setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
          } else {
            cancelGesture();
            // a plain click still focuses a widget that listens for keys (the calculator)
            (g.target?.closest("[tabindex]") as HTMLElement | null)?.focus({ preventScroll: true });
          }
          break;
        case "resize":
          if (g.moved) endGesture();
          else cancelGesture();
          break;
        case "marquee":
          setMarquee(null);
          break;
        case "noteScale":
        case "shapeSize":
          if (g.moved) endGesture();
          else cancelGesture();
          break;
        case "shape": {
          const m = getState().doc.marks.find((x) => x.id === g.id);
          if (!m || m.kind !== "shape" || (m.w < 6 && m.h < 6)) {
            cancelGesture();
            break;
          }
          endGesture();
          // back to the pointer with the new shape in hand, ready to stretch or colour
          setState({ tool: "select", selection: [m.id] });
          break;
        }
        case "pen":
          endGesture();
          break;
        case "arrow": {
          const a = getState().doc.marks.find((m) => m.id === g.id) as Arrow | undefined;
          if (!a || Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]) < 6) {
            cancelGesture();
            break;
          }
          // an end that lands on a plate or a shape attaches to it
          const doc = getState().doc;
          const from = targetAt(doc, a.a);
          const to = targetAt(doc, a.b, from);
          if (from || to) live((d) => ({ ...d, marks: d.marks.map((m) => (m.id === a.id ? { ...m, from, to } : m)) }));
          endGesture();
          break;
        }
        case "erase":
          if (g.hit) endGesture();
          else cancelGesture();
          break;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  /* ── Wheel and trackpad ────────────────────────────────────────── */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    /* Listened for on the whole window, not just the board: a pinch or a
       ctrl-scroll over a bar would otherwise zoom the browser's page, push
       the bars off screen and leave no way back. Every pinch zooms the board. */
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement;
      const zoom = e.ctrlKey || e.metaKey;
      // the browser has zoomed the page (a pinch over a video): pinching out must reach it, or there'd be no way back
      const pageZoomed = (window.visualViewport?.scale ?? 1) > 1.01;
      if (zoom && pageZoomed && e.deltaY > 0) return;
      if (!zoom) {
        if (!root.contains(t) || scrollsInside(t)) return;
        if (t.closest("[role='dialog'], [role='listbox'], [role='menu']")) return;
      }
      e.preventDefault();
      const s = getState();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * unit * 0.0085);
        setState({ camera: zoomAt(s.camera, e.clientX, e.clientY, s.camera.z * factor) });
      } else {
        let dx = e.deltaX * unit;
        let dy = e.deltaY * unit;
        if (e.shiftKey && !dx) {
          dx = dy;
          dy = 0;
        }
        setState({ camera: { ...s.camera, x: s.camera.x - dx, y: s.camera.y - dy } });
      }
    };
    // Safari reports trackpad pinches as gestures rather than ctrl-wheel
    let gz = 1;
    const onGestureStart = (e: Event) => {
      // the page is zoomed: leave the gesture to the browser so it can zoom back out
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      e.preventDefault();
      gz = getState().camera.z;
    };
    const stopGesture = (e: Event) => {
      if ((window.visualViewport?.scale ?? 1) <= 1.01) e.preventDefault();
    };
    const onGestureChange = (e: Event) => {
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;
      e.preventDefault();
      const ge = e as Event & { scale: number; clientX: number; clientY: number };
      setState({ camera: zoomAt(getState().camera, ge.clientX, ge.clientY, gz * ge.scale) });
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("gesturestart", onGestureStart, { passive: false });
    window.addEventListener("gesturechange", onGestureChange, { passive: false });
    window.addEventListener("gestureend", stopGesture, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("gesturestart", onGestureStart);
      window.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("gestureend", stopGesture);
    };
  }, []);

  /* ── Keys ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const kinds: Record<string, WidgetKind> = Object.fromEntries(SHELF.filter((w) => w.key).map((w) => [w.key!, w.kind]));
    const toolKeys: Record<string, Tool> = { v: "select", h: "hand", p: "pen", a: "arrow", t: "text", r: "shape", o: "shape", e: "eraser" };

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (mod && k === "f") {
        e.preventDefault();
        setSearch(true);
        return;
      }
      // undo belongs to the board unless you're typing in a field (fields keep their own undo)
      if (mod && k === "z" && !document.activeElement?.closest('input, textarea, [contenteditable="true"]')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isEditable(document.activeElement) || isEditable(e.target as Element)) return;
      const s = getState();

      if (e.altKey && !mod && /^Digit[1-9]$/.test(e.code)) {
        e.preventDefault();
        const b = s.boards[Number(e.code.slice(5)) - 1];
        if (b) switchBoard(b.id);
        return;
      }

      if (e.key === " " && !e.repeat) {
        spaceRef.current = true;
        setSpaceDown(true);
        e.preventDefault();
        return;
      }
      if (mod) {
        if (k === "z") {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (k === "y") {
          e.preventDefault();
          redo();
        } else if (k === "d") {
          e.preventDefault();
          duplicateSelection();
        } else if (k === "a") {
          e.preventDefault();
          selectAll();
        } else if (k === "0") {
          e.preventDefault();
          resetZoom();
        } else if (k === "=" || k === "+") {
          e.preventDefault();
          zoomBy(1.25);
        } else if (k === "-") {
          e.preventDefault();
          zoomBy(1 / 1.25);
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === "Escape") {
        if (s.selection.length) setState({ selection: [] });
        else if (s.tool !== "select") setState({ tool: "select" });
        return;
      }
      if (e.key === "Enter" && s.selection.length === 1) {
        const m = s.doc.marks.find((x) => x.id === s.selection[0]);
        if (m?.kind === "text" || m?.kind === "shape") {
          e.preventDefault();
          setState(m.kind === "text" ? { editingNote: m.id } : { editingShape: m.id });
          return;
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeWithNote(s.selection);
        return;
      }
      if (e.key.startsWith("Arrow") && s.selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const [dx, dy] =
          e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : [0, step];
        nudge(dx, dy);
        return;
      }
      if (e.shiftKey && (e.code === "Digit1" || e.key === "!")) {
        e.preventDefault();
        fitAll();
        return;
      }
      if (e.shiftKey && (e.code === "Digit2" || e.key === "@")) {
        e.preventDefault();
        zoomToSelection();
        return;
      }
      if (e.shiftKey && (e.code === "Digit0" || e.key === ")")) {
        e.preventDefault();
        resetZoom();
        return;
      }
      if (e.key === "?") {
        setHelp(true);
        return;
      }
      if (e.shiftKey) return;
      if (toolKeys[k]) {
        setState({ tool: toolKeys[k], editingNote: null, ...(toolKeys[k] === "select" ? {} : { selection: [] }) });
        return;
      }
      if (k === "x") {
        setState({ tone: s.tone === "ink" ? "accent" : "ink" });
        return;
      }
      if (k === "n") {
        e.preventDefault();
        addWidget("sticky");
        return;
      }
      if (k === "w") {
        window.dispatchEvent(new Event("putanything:shelf"));
        return;
      }
      if (s.tool === "pen" && /^[1-4]$/.test(e.key)) {
        setState({ pen: { ...s.pen, size: Number(e.key) - 1 } });
        return;
      }
      if (kinds[e.key]) {
        e.preventDefault();
        addWidget(kinds[e.key]);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    const onBlur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [removeWithNote]);

  /* ── Clipboard and dropping ────────────────────────────────────── */
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (isEditable(document.activeElement) || window.getSelection()?.toString()) return;
      const text = serializeSelection();
      if (!text) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", text);
    };
    const onCut = (e: ClipboardEvent) => {
      if (isEditable(document.activeElement)) return;
      const text = serializeSelection();
      if (!text) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", text);
      deleteIds(getState().selection);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented) return;
      // only a real text field keeps a paste for itself; everything else puts it on the board
      if (document.activeElement?.closest('input, textarea, [contenteditable="true"]')) return;
      const dt = e.clipboardData;
      if (!dt) return;
      if (dt.files.length) {
        e.preventDefault();
        layFilesRef.current([...dt.files]);
        return;
      }
      // a copied link may arrive only as a uri list or as a single anchor in html
      const uri = dt.getData("text/uri-list").split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
      let text = dt.getData("text/plain");
      if (!text.trim() && uri.length) text = uri.join("\n");
      if (!text.trim()) {
        const html = dt.getData("text/html");
        const hrefs = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
        if (hrefs.length) text = hrefs.join("\n");
      }
      if (text.trim()) {
        e.preventDefault();
        putText(text);
      }
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [toast]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const at = toWorld(getState().camera, e.clientX, e.clientY);
    const files = [...e.dataTransfer.files];
    if (files.length) {
      await layFiles(files, at);
      return;
    }
    const uri = e.dataTransfer.getData("text/uri-list").split("\n").find((l) => l && !l.startsWith("#"));
    const text = uri || e.dataTransfer.getData("text/plain");
    if (text) putText(text, at);
  };

  /* ── Files of any kind ─────────────────────────────────────────── */
  const layFiles = async (files: File[], at?: Vec) => {
    const start = at ?? null;
    let i = 0;
    for (const f of files) {
      const here: Vec | undefined = start ? [start[0] + i * 36, start[1] + i * 36] : undefined;
      try {
        const r = await putFile(f, here);
        if (r === "pdf") setPdfFile(f);
        if (r === "board") importFile(f);
      } catch {
        toast({ title: `${f.name} couldn't be laid down. files up to 2 GB fit.`, variant: "error" });
      }
      i++;
    }
  };

  useEffect(() => {
    layFilesRef.current = layFiles;
  });

  /* ── Board files ───────────────────────────────────────────────── */
  const importFile = async (file: File) => {
    const next = parseBoardFile(await file.text());
    if (!next) {
      toast({ title: "that file isn't a board.", description: "boards are the .json files this app saves.", variant: "error" });
      return;
    }
    replaceDoc(next);
    setState({ camera: cameraFor(next) });
    toast({ title: `opened ${file.name}. ${modKey()} z goes back.`, duration: 3000 });
  };

  /* ── Context menu ──────────────────────────────────────────────── */
  const ctxItems = useMemo(() => {
    if (ctxTarget) {
      const isItem = doc.items.some((i) => i.id === ctxTarget);
      return [
        { key: "duplicate", label: "duplicate", shortcut: `${modKey()}d`, icon: <IconCopy size={15} /> },
        ...(isItem ? [{ key: "front", label: "bring to the front" }] : []),
        { key: "lock", label: [...doc.items, ...doc.marks].find((x) => x.id === ctxTarget)?.locked ? "unlock" : "lock in place", icon: <IconLock size={15} /> },
        { key: "div", label: "", divider: true },
        { key: "delete", label: "take off the board", shortcut: "⌫", danger: true, icon: <IconTrash size={15} /> },
      ];
    }
    return [
      ...SHELF.map((w) => ({ key: `add:${w.kind}`, label: `${w.name} here`, shortcut: w.key })),
      { key: "div", label: "", divider: true },
      { key: "fit", label: "show everything", shortcut: "⇧1", icon: <IconFit size={15} /> },
      { key: "all", label: "select everything", shortcut: `${modKey()}a` },
    ];
  }, [ctxTarget, doc.items, doc.marks]);

  const onCtxSelect = (key: string) => {
    const { world, target } = ctxAt.current;
    if (key.startsWith("add:")) addWidget(key.slice(4) as WidgetKind, world);
    else if (key === "fit") fitAll();
    else if (key === "all") selectAll();
    else if (target) {
      if (key === "duplicate") duplicateSelection();
      if (key === "front") bringToFront(target);
      if (key === "lock") toggleLock();
      if (key === "delete") removeWithNote(getState().selection);
    }
  };

  const onContextMenuCapture = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    // a table cell has its own menu
    if (t.closest("[data-cell]")) return;
    // fields keep the browser's own menu, with copy and paste
    if (t.closest("input, textarea, [contenteditable='true'], a[href]")) {
      e.stopPropagation();
      return;
    }
    const id =
      (t.closest("[data-item]") as HTMLElement | null)?.dataset.item ??
      (t.closest("[data-mark]") as HTMLElement | null)?.dataset.mark ??
      null;
    ctxAt.current = { world: toWorld(getState().camera, e.clientX, e.clientY), target: id };
    if (id && !getState().selection.includes(id)) setState({ selection: [id] });
    setCtxTarget(id);
  };

  /* ── Command palette ───────────────────────────────────────────── */
  const toolCmd = (t: Tool, label: string, key: string, icon: React.ReactNode) => ({
    key: `tool:${t}`,
    label,
    shortcut: key,
    icon,
    onSelect: () => setState({ tool: t }),
  });
  const sections = [
    {
      title: "put on the board",
      items: SHELF.map((w) => ({
        key: `add:${w.kind}`,
        label: w.name,
        description: w.blurb,
        shortcut: w.key,
        icon: <span className="[&_svg]:h-4 [&_svg]:w-4">{w.icon}</span>,
        onSelect: () => addWidget(w.kind),
      })),
    },
    {
      title: "tools",
      items: [
        toolCmd("select", "select and move", "v", <IconSelect size={16} />),
        toolCmd("hand", "pan", "h", <IconHand size={16} />),
        toolCmd("pen", "pen", "p", <IconPen size={16} />),
        toolCmd("arrow", "arrow", "a", <IconArrow size={16} />),
        toolCmd("text", "pencil note", "t", <IconText size={16} />),
        toolCmd("shape", "shapes", "r", <IconShapes size={16} />),
        toolCmd("eraser", "eraser", "e", <IconEraser size={16} />),
      ],
    },
    {
      title: "the board",
      items: [
        { key: "media", label: "a picture or pdf from this computer", icon: <IconImage size={16} />, onSelect: () => mediaRef.current?.click() },
        { key: "fit", label: "show everything", shortcut: "⇧1", icon: <IconFit size={16} />, onSelect: fitAll },
        { key: "zoom", label: "actual size", shortcut: "⇧0", onSelect: resetZoom },
        { key: "zoomsel", label: "zoom to the selection", shortcut: "⇧2", onSelect: zoomToSelection },
        { key: "export", label: "save the board as a file", icon: <IconDownload size={16} />, onSelect: exportBoard },
        { key: "png", label: "save the board as a picture", icon: <IconImage size={16} />, onSelect: () => exportPng("board") },
        { key: "pngsel", label: "save the selection as a picture", icon: <IconImage size={16} />, onSelect: () => exportPng("selection") },
        { key: "import", label: "open a board file", icon: <IconUpload size={16} />, onSelect: () => fileRef.current?.click() },
        { key: "find", label: "find on every board", shortcut: `${modKey()}f`, onSelect: () => setSearch(true) },
        { key: "keys", label: "keyboard shortcuts", shortcut: "?", onSelect: () => setHelp(true) },
        { key: "clear", label: "clear the board", icon: <IconTrash size={16} />, onSelect: () => setConfirmClear(true) },
      ],
    },
  ];

  /* ── Render ────────────────────────────────────────────────────── */
  const grid = 24 * camera.z * (camera.z < 0.5 ? 2 : 1);
  const drawing = DRAW_TOOLS.includes(tool);
  const cursor = panning
    ? "grabbing"
    : spaceDown || tool === "hand"
      ? "grab"
      : tool === "text"
        ? "text"
        : drawing
          ? "crosshair"
          : "default";
  const empty = loaded && doc.items.length === 0 && doc.marks.length === 0;

  return (
    <div className="fixed inset-0 overflow-hidden" onContextMenuCapture={onContextMenuCapture}>
      <ContextMenu items={ctxItems} onSelect={onCtxSelect} className="absolute inset-0 focus-visible:ring-0!">
        <div
          ref={rootRef}
          data-canvas
          className="board-dots absolute inset-0 touch-none select-none"
          style={{
            backgroundSize: `${grid}px ${grid}px`,
            backgroundPosition: `${camera.x}px ${camera.y}px`,
            cursor,
          }}
          onPointerDown={onPointerDown}
          onDoubleClick={(e) => {
            if (getState().tool !== "select") return;
            // a side grip, double-clicked: the note goes back to the width of its text
            const side = (e.target as HTMLElement).closest<HTMLElement>("[data-note-resize]");
            if (side && (side.dataset.corner === "e" || side.dataset.corner === "w")) {
              const id = side.dataset.noteResize!;
              commit((d) => ({ ...d, marks: d.marks.map((m) => (m.id === id && m.kind === "text" ? { ...m, width: undefined } : m)) }));
              return;
            }
            // a note: write in it again
            const noteId = (e.target as HTMLElement).closest<HTMLElement>("[data-mark]")?.dataset.mark;
            if (noteId && getState().doc.marks.some((m) => m.id === noteId && m.kind === "text")) {
              setState({ editingNote: noteId, selection: [noteId] });
              return;
            }
            if ((e.target as HTMLElement).dataset.canvas === undefined) return;
            // a shape: write its label
            const at = toWorld(getState().camera, e.clientX, e.clientY);
            const shape = [...getState().doc.marks].reverse().find((m) => m.kind === "shape" && (hitMark(m, at, 7 / getState().camera.z) || contains(markRect(m), { x: at[0], y: at[1], w: 0, h: 0 })));
            if (shape) {
              setState({ editingShape: shape.id, selection: [shape.id] });
              return;
            }
            const note = newNote(toWorld(getState().camera, e.clientX, e.clientY));
            live((d: Doc) => ({ ...d, marks: [...d.marks, note] }));
            setState({ editingNote: note.id, selection: [note.id] });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dropping) setDropping(true);
          }}
          onDragLeave={(e) => {
            if (e.target === e.currentTarget) setDropping(false);
          }}
          onDrop={onDrop}
        >
          <div
            data-world
            className="absolute top-0 left-0 origin-top-left"
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
              cursor: spaceDown || tool === "hand" ? "inherit" : undefined,
              pointerEvents: spaceDown || tool === "hand" ? "none" : undefined,
            }}
          >
            <div className="relative z-0 isolate">
              {items.map((item: Item) => (
                <WidgetFrame key={item.id} item={item} selected={selSet.has(item.id)} onClose={closeItem} />
              ))}
            </div>
            <div className="absolute top-0 left-0 z-10">
              <InkLayer
                marks={doc.marks}
                selection={selection}
                interactive={tool === "select" && !spaceDown}
                editingNote={editingNote}
                editingShape={editingShape}
                zoom={camera.z}
              />
              {guides?.box &&
                (() => {
                  const b = guides.box;
                  const others = doc.items;
                  return (
                    <>
                      {guides.x.map((x) => {
                        const near = others.filter((o) => [o.x, o.x + o.w / 2, o.x + o.w].some((v) => Math.abs(v - x) < 0.5));
                        const y0 = Math.min(b.y, ...near.map((o) => o.y)) - 12;
                        const y1 = Math.max(b.y + b.h, ...near.map((o) => o.y + o.h)) + 12;
                        return <div key={`gx${x}`} aria-hidden className="pointer-events-none absolute" style={{ left: x - 0.5 / camera.z, top: y0, width: 1 / camera.z, height: y1 - y0, background: "var(--selection)" }} />;
                      })}
                      {guides.y.map((y) => {
                        const near = others.filter((o) => [o.y, o.y + o.h / 2, o.y + o.h].some((v) => Math.abs(v - y) < 0.5));
                        const x0 = Math.min(b.x, ...near.map((o) => o.x)) - 12;
                        const x1 = Math.max(b.x + b.w, ...near.map((o) => o.x + o.w)) + 12;
                        return <div key={`gy${y}`} aria-hidden className="pointer-events-none absolute" style={{ top: y - 0.5 / camera.z, left: x0, height: 1 / camera.z, width: x1 - x0, background: "var(--selection)" }} />;
                      })}
                    </>
                  );
                })()}
              {marquee && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute rounded-none"
                  style={{
                    left: marquee.x,
                    top: marquee.y,
                    width: marquee.w,
                    height: marquee.h,
                    border: `${1 / camera.z}px solid var(--selection)`,
                    background: "color-mix(in oklab, var(--selection) 7%, transparent)",
                  }}
                />
              )}
            </div>
          </div>

          {drawing && tool !== "text" && <div data-capture className="absolute inset-0 z-20" style={{ cursor }} />}
          {tool === "text" && <div data-capture className="absolute inset-0 z-20" style={{ cursor }} />}

          {empty && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-4">
              <div className="max-w-[46ch]">
                <h1 className="text-[clamp(28px,4vw,44px)] font-medium leading-[1.02] tracking-[-0.05em] text-balance">
                  <span className="block text-ink">an empty board.</span>
                  <span className="block text-ink-faint">paste something onto it.</span>
                </h1>
                <p className="mt-4 text-[15px] leading-[1.55] text-ink-body text-pretty">
                  a link turns into a card, a picture lands where your pointer is, a list becomes boxes to tick. or press n for a
                  sticky, and w for the rest.
                </p>
              </div>
            </div>
          )}

          {dropping && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-3 rounded-[24px]"
              style={{ boxShadow: "inset 0 0 0 1.5px var(--selection)" }}
            />
          )}
        </div>
      </ContextMenu>

      <ChromeLayer>
      <Header
        onHelp={() => setHelp(true)}
        onExport={exportBoard}
        onImport={() => fileRef.current?.click()}
        onClear={() => setConfirmClear(true)}
        onDeleteBoard={(id) => {
          const meta = getState().boards.find((b) => b.id === id);
          const isActive = id === getState().activeBoard;
          // an empty board can go without asking
          if (isActive && getState().doc.items.length === 0 && getState().doc.marks.length === 0) deleteBoard(id);
          else if (meta) setConfirmDelete(id);
        }}
      />
      <Toolbar />
      <ZoomControls />
      <Minimap />
      </ChromeLayer>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importFile(f);
          e.target.value = "";
        }}
      />

      <input
        ref={mediaRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          await layFiles(files);
        }}
      />
      <PdfImport file={pdfFile} onDone={() => setPdfFile(null)} />

      <CommandPalette open={palette} onClose={() => setPalette(false)} sections={sections} placeholder="put, draw, or find…" />
      <HelpSheet open={help} onClose={() => setHelp(false)} />
      <Search open={search} onClose={() => setSearch(false)} />
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`delete ${boards.find((b) => b.id === confirmDelete)?.name ?? "this board"}?`}
        description="its plates and drawings go with it. this one can't be undone, so save it as a file first if you might want it back."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(null)}>
              keep it
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (confirmDelete) deleteBoard(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              delete it
            </Button>
          </>
        }
      />
      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="clear this board?"
        description={`everything comes off, drawings too. ${modKey()} z right after puts it all back.`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
              keep it
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                replaceDoc({ items: [], marks: [] });
                setConfirmClear(false);
              }}
            >
              clear it
            </Button>
          </>
        }
      />
    </div>
  );
}
