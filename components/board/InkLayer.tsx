"use client";

import { getStroke } from "perfect-freehand";
import { memo, useEffect, useRef, useState } from "react";
import type { Arrow, Mark, Note, PenStyle, Shape, Stroke } from "@/lib/types";
import { markRect, rng, shapePoints, union } from "@/lib/geom";
import { inkColor } from "@/lib/colors";
import { LINE_HEIGHT, measureNote, noteFont } from "@/lib/notes";
import { commitFrom, getState, live, setState } from "@/lib/store";
import { asLink, putText } from "@/lib/actions";

const toneColor = inkColor;

function strokePath(points: number[][]) {
  if (!points.length) return "";
  const d = points.reduce(
    (acc: (string | number)[], [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"],
  );
  d.push("Z");
  return d.join(" ");
}

/* The widths on the size switch, per pen: index 0–3 is S, M, L, XL. */
export const PEN_SIZES: Record<PenStyle, number[]> = {
  pen: [2.5, 4, 7, 12],
  pencil: [3, 5, 8, 13],
  marker: [10, 16, 24, 36],
};

export function strokeOutline(s: Stroke) {
  const style = s.style ?? "pencil";
  const pressured = s.pts.some((p) => p[2] !== 0.5);
  // little streamline: the line stays under the pointer instead of trailing after it
  const opts =
    style === "pen"
      ? { thinning: 0.12, smoothing: 0.62, streamline: 0.22, simulatePressure: false }
      : style === "marker"
        ? { thinning: 0, smoothing: 0.7, streamline: 0.28, simulatePressure: false, start: { cap: true }, end: { cap: true } }
        : { thinning: 0.6, smoothing: 0.55, streamline: 0.25, simulatePressure: !pressured, start: { taper: 6 }, end: { taper: 10 } };
  return strokePath(getStroke(s.pts, { size: s.size, ...opts, last: true }));
}

/* A pencil line: a gentle bow from a seeded wobble and a head of two
   short strokes, so arrows read as drawn rather than as connectors.  */
function arrowPaths(a: Arrow) {
  const [x0, y0] = a.a;
  const [x1, y1] = a.b;
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const r = rng(a.seed);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const bow = (r() - 0.5) * Math.min(len * 0.12, 26);
  const cx = (x0 + x1) / 2 + nx * bow;
  const cy = (y0 + y1) / 2 + ny * bow;
  const shaft = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
  // the head follows the curve's last tangent
  const tx = x1 - cx;
  const ty = y1 - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const head = Math.min(16, len * 0.35);
  const spread = 0.48;
  const side = (s: number) => {
    const cos = Math.cos(s);
    const sin = Math.sin(s);
    const rx = ux * cos - uy * sin;
    const ry = ux * sin + uy * cos;
    return `M ${x1} ${y1} L ${x1 - rx * head + (r() - 0.5)} ${y1 - ry * head + (r() - 0.5)}`;
  };
  return { shaft, head: `${side(spread)} ${side(-spread)}` };
}

/* A shape drawn the way a pencil would: each side a slight bow, the whole
   outline traced twice a hair apart. The seed keeps the wobble the same
   every time it's drawn. The fill underneath is the clean shape.       */
function sketchOutline(m: Shape, pass: number) {
  const r = rng(m.seed + pass * 7919);
  const pts = shapePoints(m);
  const jitter = () => (r() - 0.5) * Math.min(3, Math.max(m.w, m.h) * 0.015);
  if (m.shape === "ellipse") {
    const j = pts.map(([x, y]) => [x + jitter() * 0.6, y + jitter() * 0.6]);
    let d = `M ${(j[0][0] + j[1][0]) / 2} ${(j[0][1] + j[1][1]) / 2}`;
    for (let i = 1; i <= j.length; i++) {
      const a = j[i % j.length];
      const b = j[(i + 1) % j.length];
      d += ` Q ${a[0]} ${a[1]} ${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}`;
    }
    return d;
  }
  let d = "";
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const bow = (r() - 0.5) * Math.min(len * 0.025, 4);
    const cx = (a[0] + b[0]) / 2 + (-(b[1] - a[1]) / len) * bow;
    const cy = (a[1] + b[1]) / 2 + ((b[0] - a[0]) / len) * bow;
    d += ` M ${a[0] + jitter()} ${a[1] + jitter()} Q ${cx} ${cy} ${b[0] + jitter()} ${b[1] + jitter()}`;
  });
  return d;
}

const ShapeMark = memo(function ShapeMark({ m }: { m: Shape }) {
  const c = toneColor(m.tone);
  const pts = shapePoints(m);
  const clean = `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;
  return (
    <g data-mark={m.id} style={{ pointerEvents: "none" }}>
      {m.fill !== "none" && <path d={clean} fill={c} fillOpacity={m.fill === "solid" ? 0.9 : 0.14} />}
      <path d={sketchOutline(m, 0)} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={sketchOutline(m, 1)} stroke={c} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.55} />
    </g>
  );
});

const StrokeMark = memo(function StrokeMark({ m, interactive }: { m: Stroke; interactive: boolean }) {
  return (
    <path
      data-mark={m.id}
      d={strokeOutline(m)}
      fill={toneColor(m.tone)}
      fillOpacity={m.style === "marker" ? 0.38 : 1}
      style={{ pointerEvents: interactive ? "visiblePainted" : "none", cursor: interactive ? "move" : undefined }}
    />
  );
});

const ArrowMark = memo(function ArrowMark({ m, interactive }: { m: Arrow; interactive: boolean }) {
  const { shaft, head } = arrowPaths(m);
  const c = toneColor(m.tone);
  return (
    <g data-mark={m.id} style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "move" : undefined }}>
      <path d={`${shaft} ${head}`} stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: interactive ? "stroke" : "none" }} />
      <path d={shaft} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d={head} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
});

/** one note's type, the same whether it's being read or written */
function noteStyle(n: Note): React.CSSProperties {
  const f = noteFont(n);
  return {
    left: n.x,
    top: n.y,
    fontSize: n.size,
    lineHeight: LINE_HEIGHT,
    fontFamily: f.css,
    fontWeight: n.bold ? 700 : f.weight,
    textAlign: n.align ?? "left",
    letterSpacing: n.font === "sans" && n.size >= 36 ? "-0.03em" : undefined,
    color: toneColor(n.tone),
  };
}

function NoteEditor({ note }: { note: Note }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(note.text);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  /** a note that holds nothing but links becomes link cards where it stood */
  const toCards = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !words.every((w) => asLink(w))) return false;
    const doc = getState().doc;
    const without = { ...doc, marks: doc.marks.filter((m) => m.id !== note.id) };
    if (note.text === "") live(() => without);
    else commitFrom(doc, without);
    setState({ editingNote: null, selection: [] });
    putText(text, [note.x + 160, note.y + 120]);
    return true;
  };

  const finish = () => {
    const text = (ref.current?.value ?? "").replace(/\s+$/, "");
    if (toCards(text)) return;
    const doc = getState().doc;
    const current = doc.marks.find((m) => m.id === note.id);
    const without = { ...doc, marks: doc.marks.filter((m) => m.id !== note.id) };
    // a new note is shown before it has words; it only becomes an undo step once it does
    const isNew = note.text === "";
    if (!text.trim()) {
      if (isNew) live(() => without);
      else commitFrom(doc, without);
    } else if (current && current.kind === "text" && text !== current.text) {
      commitFrom(isNew ? without : doc, { ...doc, marks: doc.marks.map((m) => (m.id === note.id ? { ...m, text } : m)) });
    }
    setState((s) => ({
      editingNote: s.editingNote === note.id ? null : s.editingNote,
      selection: text.trim() ? s.selection : s.selection.filter((id) => id !== note.id),
    }));
  };

  // sized from what's typed so far, in the note's own type, so nothing clips
  const box = measureNote({ ...note, text: draft || " " });
  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onPaste={(e) => {
        // a link pasted into an empty note becomes a card, not a note's words
        const t = e.clipboardData.getData("text");
        if (!draft.trim() && t && toCards(t)) {
          // handled here: the board's own paste mustn't make a second card
          e.preventDefault();
          e.nativeEvent.stopPropagation();
        }
      }}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      placeholder="write it down"
      spellCheck={false}
      className="absolute resize-none overflow-hidden whitespace-pre bg-transparent p-0 outline-none placeholder:text-ink-ghost"
      style={{
        ...noteStyle(note),
        width: Math.max(draft ? 0 : 140, box.w + note.size * 0.6),
        height: box.h + 2,
      }}
    />
  );
}

/* A shape's words: centred in it, in the pencil hand, coloured like its line
   (or, on a solid fill, in the page's colour so they still read).      */
function labelStyle(m: Shape): React.CSSProperties {
  // as large as the shape allows for the words in it: a short "3" fills a badge, a sentence settles smaller
  const longest = Math.max(1, ...(m.label ?? "").split("\n").map((l) => l.length));
  const lines = Math.max(1, (m.label ?? "").split("\n").length);
  const size = Math.max(14, Math.min(30, m.h / (1.6 + lines * 1.1), (m.w * 0.68) / (longest * 0.48)));
  return {
    left: m.x,
    top: m.y,
    width: m.w,
    height: m.h,
    padding: m.shape === "diamond" || m.shape === "triangle" ? `${m.h * 0.22}px ${m.w * 0.2}px ${m.shape === "triangle" ? m.h * 0.08 : m.h * 0.22}px` : "8px 12px",
    paddingTop: m.shape === "triangle" ? m.h * 0.42 : undefined,
    fontFamily: "var(--font-hand)",
    fontSize: size,
    lineHeight: 1.15,
    fontWeight: 500,
    color: m.fill === "solid" ? "var(--panel-face)" : toneColor(m.tone),
  };
}

function ShapeLabelEditor({ shape }: { shape: Shape }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);
  const finish = () => {
    const label = (ref.current?.value ?? "").trim();
    const doc = getState().doc;
    if (label !== (shape.label ?? "")) {
      commitFrom(doc, { ...doc, marks: doc.marks.map((m) => (m.id === shape.id ? { ...m, label: label || undefined } : m)) });
    }
    setState((s) => ({ editingShape: s.editingShape === shape.id ? null : s.editingShape }));
  };
  return (
    <div className="absolute flex items-center justify-center" style={labelStyle(shape)}>
      <textarea
        ref={ref}
        defaultValue={shape.label ?? ""}
        onBlur={finish}
        onKeyDown={(e) => {
          e.stopPropagation();
          // enter finishes; shift-enter starts a new line
          if (e.key === "Escape" || (e.key === "Enter" && !e.shiftKey)) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        rows={Math.max(1, (shape.label ?? "").split("\n").length)}
        onInput={(e) => (e.currentTarget.rows = Math.max(1, e.currentTarget.value.split("\n").length))}
        placeholder="label"
        spellCheck={false}
        className="w-full resize-none overflow-hidden bg-transparent p-0 text-center outline-none placeholder:text-ink-ghost"
        style={{ font: "inherit", color: "inherit", lineHeight: "inherit" }}
      />
    </div>
  );
}

interface Props {
  marks: Mark[];
  editingShape: string | null;
  selection: string[];
  interactive: boolean;
  editingNote: string | null;
  zoom: number;
}

export const InkLayer = memo(function InkLayer({ marks, selection, interactive, editingNote, editingShape, zoom }: Props) {
  const drawn = marks.filter((m): m is Stroke | Arrow | Shape => m.kind !== "text");
  const notes = marks.filter((m): m is Note => m.kind === "text");
  const box = union(drawn.map(markRect));
  const pad = 40;
  const sel = new Set(selection);
  const selected = marks.filter((m) => sel.has(m.id));

  return (
    <>
      {box && (
        <svg
          className="absolute overflow-visible"
          style={{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2, pointerEvents: "none" }}
          viewBox={`${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}`}
        >
          {drawn.map((m) =>
            m.kind === "stroke" ? (
              <StrokeMark key={m.id} m={m} interactive={interactive} />
            ) : m.kind === "shape" ? (
              <ShapeMark key={m.id} m={m} />
            ) : (
              <ArrowMark key={m.id} m={m} interactive={interactive} />
            ),
          )}
        </svg>
      )}
      {drawn.map((m) =>
        m.kind !== "shape" ? null : m.id === editingShape ? (
          <ShapeLabelEditor key={`l-${m.id}`} shape={m} />
        ) : m.label ? (
          <div
            key={`l-${m.id}`}
            aria-hidden
            className="pointer-events-none absolute flex items-center justify-center overflow-hidden text-center whitespace-pre-wrap break-words"
            style={labelStyle(m)}
          >
            {m.label}
          </div>
        ) : null,
      )}
      {notes.map((n) =>
        n.id === editingNote ? (
          <NoteEditor key={n.id} note={n} />
        ) : (
          <div
            key={n.id}
            data-mark={n.id}
            title={interactive ? "double-click to edit" : undefined}
            className="absolute whitespace-pre select-none"
            style={{
              ...noteStyle(n),
              minWidth: measureNote(n).w,
              pointerEvents: interactive ? "auto" : "none",
              cursor: interactive ? "move" : undefined,
            }}
          >
            {n.text}
          </div>
        ),
      )}
      {selected.length === 1 &&
        selected[0].kind === "text" &&
        !selected[0].locked &&
        selected[0].id !== editingNote &&
        interactive &&
        (() => {
          const r = markRect(selected[0]);
          const p = 6 / zoom;
          const g = 10 / zoom;
          const corners: [string, number, number, string][] = [
            ["nw", r.x - p, r.y - p, "nwse-resize"],
            ["ne", r.x + r.w + p, r.y - p, "nesw-resize"],
            ["sw", r.x - p, r.y + r.h + p, "nesw-resize"],
            ["se", r.x + r.w + p, r.y + r.h + p, "nwse-resize"],
          ];
          return corners.map(([c, x, y, cursor]) => (
            <div
              key={c}
              data-note-resize={selected[0].id}
              data-corner={c}
              className="absolute z-10 grid place-items-center"
              style={{ left: x - g, top: y - g, width: g * 2, height: g * 2, cursor }}
            >
              <span
                className="block rounded-none"
                style={{
                  width: 9 / zoom,
                  height: 9 / zoom,
                  background: "var(--panel-face)",
                  boxShadow: `0 0 0 ${1.5 / zoom}px var(--selection)`,
                }}
              />
            </div>
          ));
        })()}
      {selected.length === 1 &&
        selected[0].kind === "shape" &&
        !selected[0].locked &&
        interactive &&
        (() => {
          const r = markRect(selected[0]);
          const p = 6 / zoom;
          const g = 10 / zoom;
          const corners: [string, number, number, string][] = [
            ["nw", r.x - p, r.y - p, "nwse-resize"],
            ["ne", r.x + r.w + p, r.y - p, "nesw-resize"],
            ["sw", r.x - p, r.y + r.h + p, "nesw-resize"],
            ["se", r.x + r.w + p, r.y + r.h + p, "nwse-resize"],
          ];
          return corners.map(([c, x, y, cursor]) => (
            <div
              key={c}
              data-shape-resize={selected[0].id}
              data-corner={c}
              className="absolute z-10 grid place-items-center"
              style={{ left: x - g, top: y - g, width: g * 2, height: g * 2, cursor }}
            >
              <span
                className="block rounded-none"
                style={{ width: 9 / zoom, height: 9 / zoom, background: "var(--panel-face)", boxShadow: `0 0 0 ${1.5 / zoom}px var(--selection)` }}
              />
            </div>
          ));
        })()}
      {selected.map((m) => {
        const r = markRect(m);
        const p = 6 / zoom;
        return (
          <div
            key={`sel-${m.id}`}
            aria-hidden
            className="pointer-events-none absolute rounded-none"
            style={{
              left: r.x - p,
              top: r.y - p,
              width: r.w + p * 2,
              height: r.h + p * 2,
              outline: `${1.5 / zoom}px dashed var(--selection)`,
            }}
          />
        );
      })}
    </>
  );
});
