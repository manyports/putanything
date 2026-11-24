"use client";

import { useCallback, useEffect, useState } from "react";
import type { Note, NoteFont, PenStyle, Shape, ShapeFill, ShapeKind, Tool, WidgetKind } from "@/lib/types";
import { NOTE_FONTS, NOTE_SIZES } from "@/lib/notes";
import { commit, deleteIds, getState, setState, useBoard } from "@/lib/store";
import { inkColor, swatchColor } from "@/lib/colors";
import { addWidget, alignSelection, distributeSelection, duplicateSelection, toggleLock } from "@/lib/actions";
import { useCoarse } from "./useCoarse";
import { Tooltip } from "@blurrow/ui";
import { WIDGETS } from "../widgets/registry";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrow,
  IconDiamond,
  IconEllipse,
  IconEraser,
  IconFillNone,
  IconFillSolid,
  IconFillTint,
  IconAlign,
  IconCopy,
  IconDistribute,
  IconTrash,
  IconImage,
  IconLock,
  IconUnlock,
  IconPen,
  IconPlus,
  IconRect,
  IconSelect,
  IconShapes,
  IconText,
  IconTriangle,
} from "../icons";
import { Segmented } from "./Segmented";
import { ColorPanel, GRAPHITE, PAPERS, colorPanelWidth } from "./ColorPanel";
import { Flyout, FlyRow, FlySep } from "./Flyout";

/* Panning needs no tool: space, the middle button, or two fingers. */
const TOOLS: { tool: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { tool: "select", label: "select", key: "v", icon: <IconSelect size={17} /> },
  { tool: "pen", label: "pen", key: "p", icon: <IconPen size={17} /> },
  { tool: "arrow", label: "arrow", key: "a", icon: <IconArrow size={17} /> },
  { tool: "text", label: "note", key: "t", icon: <IconText size={17} /> },
  { tool: "shape", label: "shape", key: "r", icon: <IconShapes size={17} /> },
  { tool: "eraser", label: "eraser", key: "e", icon: <IconEraser size={17} /> },
];

/* The tray, in three plain groups: things you write, things that work
   something out, things that look something up.                       */
const GROUPS: WidgetKind[][] = [
  ["sticky", "todo", "table"],
  ["calc", "timer", "convert", "countdown"],
  ["clock", "weather", "dict"],
];

/* A key that sits in the channel beside the tools, the same 36px. */
function ChannelKey({
  label,
  title,
  onClick,
  pressed,
  inverse,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  pressed?: boolean;
  inverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={pressed}
      title={title}
      onClick={onClick}
      className={[
        "relative z-10 grid h-9 w-9 place-items-center rounded-[9px] cursor-pointer transition-[box-shadow,transform] duration-200 active:scale-[0.96]",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
        inverse ? "text-ink-inverse" : "text-ink-label",
      ].join(" ")}
      style={{
        background: inverse ? "var(--face-inverse)" : pressed ? "var(--face)" : "transparent",
        boxShadow: inverse
          ? pressed
            ? "var(--face-inverse-pressed)"
            : "var(--face-inverse-shadow)"
          : pressed
            ? "var(--thumb-shadow)"
            : "none",
        transitionTimingFunction: "var(--ease-spring)",
      }}
    >
      {children}
    </button>
  );
}

/* The colour key shows what the next line will be drawn in, or, when
   lines, notes or stickies are selected, what they're coloured now.
   Picking a colour then changes them.                                 */
function ColorKey() {
  const tone = useBoard((s) => s.tone);
  const selection = useBoard((s) => s.selection);
  const doc = useBoard((s) => s.doc);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const sel = new Set(selection);
  const marks = doc.marks.filter((m) => sel.has(m.id));
  const stickies = doc.items.filter((i) => sel.has(i.id) && i.kind === "sticky");
  const editing = marks.length + stickies.length > 0;
  const onlyStickies = editing && marks.length === 0;
  const current = editing ? (marks[0]?.tone ?? ((stickies[0]?.data as { tint?: string })?.tint || "plain")) : tone;

  const apply = (c: string) => {
    if (!editing) return setState({ tone: c });
    const ms = new Set(marks.map((m) => m.id));
    const ss = new Set(stickies.map((i) => i.id));
    commit(
      (d) => ({
        items: d.items.map((i) => (ss.has(i.id) ? { ...i, data: { ...i.data, tint: c === "ink" ? "plain" : c } } : i)),
        marks: d.marks.map((m) => (ms.has(m.id) ? { ...m, tone: c === "plain" ? "ink" : c } : m)),
      }),
      { key: `recolor:${selection.join()}` },
    );
    if (marks.length) setState({ tone: c === "plain" ? "ink" : c });
  };

  const base = onlyStickies ? PAPERS : GRAPHITE;
  const label = editing ? "colour of the selection" : "colour for new lines";
  return (
    <div data-flyout-anchor className="relative">
      <ChannelKey label={label} title={editing ? label : `${label} · x`} pressed={open} onClick={() => setOpen((v) => !v)}>
        <span
          className="block h-4 w-4 rounded-full transition-colors duration-200"
          style={{
            background: onlyStickies ? swatchColor(current) : inkColor(current),
            boxShadow: "0 0 0 2px var(--panel-face), 0 0 0 2.5px var(--line-strong), inset 0 1px 1px rgba(255,255,255,.3)",
          }}
        />
      </ChannelKey>
      <Flyout open={open} onClose={close} side="above" align="center" width={colorPanelWidth(base.length)} label={label}>
        <ColorPanel
          title={editing ? (onlyStickies ? "paper for the selection" : "colour of the selection") : "colour for new lines and notes"}
          value={current}
          onChange={apply}
          base={base}
        />
      </Flyout>
    </div>
  );
}

function AddKey() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("putanything:shelf", show);
    return () => window.removeEventListener("putanything:shelf", show);
  }, []);
  const pick = (k: WidgetKind) => {
    setOpen(false);
    addWidget(k);
  };
  return (
    <div data-flyout-anchor className="relative">
      <ChannelKey
        inverse
        label={open ? "close" : "put something on the board"}
        title="put something on the board · w"
        pressed={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="transition-transform duration-[380ms]"
          style={{ transform: open ? "rotate(45deg)" : "none", transitionTimingFunction: "var(--ease-spring)" }}
        >
          <IconPlus size={17} />
        </span>
      </ChannelKey>
      <Flyout open={open} onClose={close} side="above" align="end" width={232} label="put something on the board">
        <FlyRow
          icon={<IconImage />}
          hint="or paste"
          title="a picture, or pages from a pdf"
          onClick={() => {
            setOpen(false);
            window.dispatchEvent(new Event("putanything:pick-media"));
          }}
        >
          picture or pdf
        </FlyRow>
        <FlySep />
        {GROUPS.map((g, gi) => (
          <div key={gi}>
            {gi > 0 && <FlySep />}
            {g.map((k) => {
              const w = WIDGETS[k];
              return (
                <FlyRow key={k} icon={w.icon} hint={w.key} title={w.blurb} onClick={() => pick(k)}>
                  {w.name}
                </FlyRow>
              );
            })}
          </div>
        ))}
      </Flyout>
    </div>
  );
}

/* While the pen is in hand, a second strip rises over the bar: what kind of
   pen, and how wide. Same well and thumb as the tools, one row of each.  */
function PenStrip() {
  const pen = useBoard((s) => s.pen);
  const tone = useBoard((s) => s.tone);
  const colour = inkColor(tone);
  const styles: { key: PenStyle; label: string }[] = [
    { key: "pen", label: "pen" },
    { key: "pencil", label: "pencil" },
    { key: "marker", label: "marker" },
  ];
  return (
    <div className="animate-shelf-in absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2">
      <div
        className="no-scrollbar flex max-w-[calc(100vw-24px)] items-center gap-[5px] overflow-x-auto rounded-[18px] p-[5px]"
        style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
      >
        <Segmented
          ariaLabel="pen type"
          value={pen.style}
          onChange={(k) => setState({ pen: { ...pen, style: k as PenStyle } })}
          items={styles.map((st) => ({ key: st.key, label: st.label }))}
        />
        <Segmented
          ariaLabel="width"
          square
          value={String(pen.size)}
          onChange={(k) => setState({ pen: { ...pen, size: Number(k) } })}
          items={[0, 1, 2, 3].map((i) => {
            const d = [4, 7, 10, 14][i];
            return {
              key: String(i),
              ariaLabel: ["thin", "medium", "thick", "extra thick"][i],
              tooltip: `${["thin", "medium", "thick", "extra thick"][i]} · ${i + 1}`,
              label: (
                <span
                  className="block rounded-full"
                  style={{ width: d, height: d, background: colour, opacity: pen.style === "marker" ? 0.45 : 1 }}
                />
              ),
            };
          })}
        />
      </div>
    </div>
  );
}

/* While writing, or with notes selected, the text strip rises: typeface,
   size, bold and alignment. With notes selected it changes them (one undo
   step per change); otherwise it sets how the next note is written.    */
function TextStrip() {
  const text = useBoard((s) => s.text);
  const selection = useBoard((s) => s.selection);
  const marks = useBoard((s) => s.doc.marks);
  const sel = new Set(selection);
  const notes = marks.filter((m): m is Note => m.kind === "text" && sel.has(m.id));
  const first = notes[0];
  const current = first
    ? {
        font: first.font ?? "hand",
        size: NOTE_SIZES.reduce((best, v, i) => (Math.abs(v - first.size) < Math.abs(NOTE_SIZES[best] - first.size) ? i : best), 0),
        exact: NOTE_SIZES.includes(first.size),
        bold: !!first.bold,
        align: first.align ?? "left",
      }
    : { ...text, exact: true };

  const apply = (patch: Partial<Note>, defaults: Partial<typeof text>) => {
    setState((st) => ({ text: { ...st.text, ...defaults } }));
    if (!notes.length) return;
    const ids = new Set(notes.map((n) => n.id));
    commit((d) => ({
      ...d,
      marks: d.marks.map((m) => (ids.has(m.id) && m.kind === "text" ? { ...m, ...patch } : m)),
    }));
  };

  const fonts: NoteFont[] = ["hand", "sans", "serif", "mono"];
  const aligns = [
    { key: "left", icon: <IconAlignLeft size={15} /> },
    { key: "center", icon: <IconAlignCenter size={15} /> },
    { key: "right", icon: <IconAlignRight size={15} /> },
  ];
  return (
    // pressing the strip never takes focus, so a note being written keeps its caret
    <div className="animate-shelf-in absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2" onMouseDown={(e) => e.preventDefault()}>
      <div
        className="no-scrollbar flex max-w-[calc(100vw-24px)] items-center gap-[5px] overflow-x-auto rounded-[18px] p-[5px]"
        style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
      >
        <Segmented
          ariaLabel="typeface"
          value={current.font}
          onChange={(k) => apply({ font: k as NoteFont }, { font: k as NoteFont })}
          items={fonts.map((f) => ({
            key: f,
            ariaLabel: NOTE_FONTS[f].label,
            tooltip: NOTE_FONTS[f].label,
            label: (
              <span style={{ fontFamily: NOTE_FONTS[f].css, fontSize: f === "hand" ? 18 : 14, fontWeight: NOTE_FONTS[f].weight }}>Aa</span>
            ),
          }))}
        />
        <Segmented
          ariaLabel="text size"
          value={current.exact ? String(current.size) : null}
          onChange={(k) => apply({ size: NOTE_SIZES[Number(k)] }, { size: Number(k) })}
          items={["S", "M", "L", "XL"].map((l, i) => ({ key: String(i), label: l, tooltip: `${NOTE_SIZES[i]}px` }))}
        />
        <Segmented
          ariaLabel="weight"
          square
          value={current.bold ? "bold" : null}
          onChange={() => apply({ bold: !current.bold || undefined }, { bold: !current.bold })}
          items={[{ key: "bold", ariaLabel: "bold", tooltip: "bold", label: <span className="text-[15px] font-bold">B</span> }]}
        />
        <Segmented
          ariaLabel="alignment"
          square
          value={current.align}
          onChange={(k) =>
            apply({ align: k === "left" ? undefined : (k as Note["align"]) }, { align: k as "left" | "center" | "right" })
          }
          items={aligns.map((a) => ({ key: a.key, ariaLabel: `align ${a.key}`, tooltip: `align ${a.key}`, label: a.icon }))}
        />
        {/* lit while a note is as wide as its text; press it to undo a width set with the side grips */}
        <Segmented
          ariaLabel="width"
          value={notes.some((n) => n.width) ? null : "fit"}
          onChange={() => {
            if (!notes.length) return;
            const ids = new Set(notes.map((n) => n.id));
            commit((d) => ({ ...d, marks: d.marks.map((m) => (ids.has(m.id) && m.kind === "text" ? { ...m, width: undefined } : m)) }));
          }}
          items={[
            {
              key: "fit",
              ariaLabel: "width fits the text",
              tooltip: notes.some((n) => n.width) ? "fit the width to the text" : "width fits the text · drag a side to wrap",
              label: "fit",
            },
          ]}
        />
      </div>
    </div>
  );
}

/* Drawing shapes, or with shapes selected: which shape, and how it's filled.
   With shapes selected the strip changes them; otherwise the next one.   */
function ShapeStrip() {
  const pref = useBoard((s) => s.shape);
  const selection = useBoard((s) => s.selection);
  const marks = useBoard((s) => s.doc.marks);
  const tool = useBoard((s) => s.tool);
  const sel = new Set(selection);
  // with the shape tool in hand the strip sets up the next shape; it only edits shapes from the pointer
  const shapes = tool === "select" ? marks.filter((m): m is Shape => m.kind === "shape" && sel.has(m.id)) : [];
  const current = shapes[0] ? { shape: shapes[0].shape, fill: shapes[0].fill } : pref;

  const apply = (patch: Partial<Shape>) => {
    setState((st) => ({ shape: { ...st.shape, ...(patch.shape ? { shape: patch.shape } : {}), ...(patch.fill ? { fill: patch.fill } : {}) } }));
    if (!shapes.length) return;
    const ids = new Set(shapes.map((x) => x.id));
    commit((d) => ({ ...d, marks: d.marks.map((m) => (ids.has(m.id) && m.kind === "shape" ? { ...m, ...patch } : m)) }));
  };

  const kinds: { key: ShapeKind; label: string; icon: React.ReactNode }[] = [
    { key: "rect", label: "rectangle", icon: <IconRect size={16} /> },
    { key: "ellipse", label: "ellipse", icon: <IconEllipse size={16} /> },
    { key: "diamond", label: "diamond", icon: <IconDiamond size={16} /> },
    { key: "triangle", label: "triangle", icon: <IconTriangle size={16} /> },
  ];
  const fills: { key: ShapeFill; label: string; icon: React.ReactNode }[] = [
    { key: "none", label: "outline", icon: <IconFillNone size={16} /> },
    { key: "tint", label: "tinted", icon: <IconFillTint size={16} /> },
    { key: "solid", label: "solid", icon: <IconFillSolid size={16} /> },
  ];
  return (
    <div className="animate-shelf-in absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2" onMouseDown={(e) => e.preventDefault()}>
      <div
        className="no-scrollbar flex max-w-[calc(100vw-24px)] items-center gap-[5px] overflow-x-auto rounded-[18px] p-[5px]"
        style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
      >
        <Segmented
          ariaLabel="shape"
          square
          value={current.shape}
          onChange={(k) => apply({ shape: k as ShapeKind })}
          items={kinds.map((k) => ({ key: k.key, ariaLabel: k.label, tooltip: k.label, label: k.icon }))}
        />
        <Segmented
          ariaLabel="fill"
          square
          value={current.fill}
          onChange={(k) => apply({ fill: k as ShapeFill })}
          items={fills.map((f) => ({ key: f.key, ariaLabel: f.label, tooltip: f.label, label: f.icon }))}
        />
      </div>
    </div>
  );
}

/* Two or more things selected: line them up, or space them evenly, or lock
   them. Rises above any other strip that's showing.                     */
function ArrangeStrip({ raised, touch }: { raised: boolean; touch: boolean }) {
  const count = useBoard((s) => s.selection.length);
  const allLocked = useBoard((s) => {
    const set = new Set(s.selection);
    const all = [...s.doc.items.filter((i) => set.has(i.id)), ...s.doc.marks.filter((m) => set.has(m.id))];
    return all.length > 0 && all.every((x) => x.locked);
  });
  const key = (label: string, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <Tooltip key={label} content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="grid h-9 w-9 place-items-center rounded-[9px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-30 cursor-pointer"
      >
        {icon}
      </button>
    </Tooltip>
  );
  return (
    <div
      className="animate-shelf-in absolute left-1/2 -translate-x-1/2"
      style={{ bottom: raised ? "calc(100% + 70px)" : "calc(100% + 8px)" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="no-scrollbar flex max-w-[calc(100vw-24px)] items-center gap-[5px] overflow-x-auto rounded-[18px] p-[5px]" style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}>
        {touch && (
          <div className="well flex shrink-0 items-center rounded-[13px] p-1">
            {key("duplicate", () => duplicateSelection(), <IconCopy size={15} />)}
            {key("take off the board", () => deleteUnlocked(), <IconTrash size={15} />)}
          </div>
        )}
        {count >= 2 && (
        <>
        <div className="well flex shrink-0 items-center rounded-[13px] p-1">
          {key("align left edges", () => alignSelection("left"), <IconAlign dir="left" />)}
          {key("align centres", () => alignSelection("center"), <IconAlign dir="center" />)}
          {key("align right edges", () => alignSelection("right"), <IconAlign dir="right" />)}
          <span aria-hidden className="groove-v" />
          {key("align top edges", () => alignSelection("top"), <IconAlign dir="top" />)}
          {key("align middles", () => alignSelection("middle"), <IconAlign dir="middle" />)}
          {key("align bottom edges", () => alignSelection("bottom"), <IconAlign dir="bottom" />)}
        </div>
        <div className="well flex shrink-0 items-center rounded-[13px] p-1">
          {key("space evenly across", () => distributeSelection("x"), <IconDistribute axis="x" />, count < 3)}
          {key("space evenly down", () => distributeSelection("y"), <IconDistribute axis="y" />, count < 3)}
        </div>
        </>
        )}
        <div className="well flex shrink-0 items-center rounded-[13px] p-1">
          {key(allLocked ? "unlock them" : "lock them in place", () => toggleLock(), allLocked ? <IconLock size={15} /> : <IconUnlock size={15} />)}
        </div>
      </div>
    </div>
  );
}

/** delete what's selected, leaving anything locked where it is */
function deleteUnlocked() {
  const { doc, selection } = getState();
  const locked = new Set([...doc.items.filter((i) => i.locked), ...doc.marks.filter((m) => m.locked)].map((x) => x.id));
  deleteIds(selection.filter((id) => !locked.has(id)));
}

export function Toolbar() {
  const tool = useBoard((s) => s.tool);
  const touch = useCoarse();
  const selection = useBoard((s) => s.selection);
  const marks = useBoard((s) => s.doc.marks);
  const notesSelected = selection.length > 0 && marks.some((m) => m.kind === "text" && selection.includes(m.id));
  const shapesSelected = selection.length > 0 && marks.some((m) => m.kind === "shape" && selection.includes(m.id));
  return (
    <div
      className="animate-header-in pointer-events-none fixed inset-x-0 z-40 flex justify-center px-3 sm:px-4"
      style={{ bottom: "max(16px, calc(env(safe-area-inset-bottom) + 8px))" }}
    >
      <div
        className="pointer-events-auto relative rounded-[18px] p-[5px]"
        style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
      >
        {tool === "pen" && <PenStrip />}
        {(tool === "text" || (tool === "select" && notesSelected)) && <TextStrip />}
        {(tool === "shape" || (tool === "select" && shapesSelected && !notesSelected)) && <ShapeStrip />}
        {tool === "select" && (selection.length >= 2 || (touch && selection.length >= 1)) && (
          <ArrangeStrip raised={notesSelected || shapesSelected} touch={touch} />
        )}
        {/* one channel: the tools, a groove, then the colour and the tray */}
        <Segmented
          ariaLabel="tools"
          square
          value={tool}
          onChange={(k) => setState({ tool: k as Tool, editingNote: null, ...(k === "select" ? {} : { selection: [] }) })}
          items={TOOLS.map((t) => ({ key: t.tool, label: t.icon, ariaLabel: t.label, tooltip: `${t.label} · ${t.key}` }))}
          trailing={
            <>
              <span aria-hidden className="groove-v" />
              <ColorKey />
              <AddKey />
            </>
          }
        />
      </div>
    </div>
  );
}
