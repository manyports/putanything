"use client";

import { memo, useCallback, useRef, useState } from "react";
import { formatNumber } from "@/lib/calc";
import { Flyout, FlyRow, FlySep } from "../board/Flyout";
import { IconCopy, IconPlus, IconTableHeader, IconTrash } from "../icons";
import { RailKey, type WidgetProps } from "./parts";

export interface TableData {
  rows: string[][];
  /** the first row names the columns */
  header: boolean;
  /** each column's width in board pixels */
  widths?: number[];
}

const MIN_W = 56;
const DEFAULT_W = 150;

/** a cell's text as a number, if it reads as one: "1,200", "$12.50", "45%", "-3" */
function asNumber(s: string): number | null {
  const t = s.trim().replace(/[\s,]/g, "").replace(/^[$€£¥₸]/, "").replace(/%$/, "");
  if (!t || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(t)) return null;
  return Number(t);
}

/** Spreadsheet text (tab-separated, or comma-separated with quotes) as rows of cells. */
export function parseGrid(text: string): string[][] | null {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  if (lines.length < 1) return null;
  if (lines.some((l) => l.includes("\t"))) {
    const rows = lines.map((l) => l.split("\t"));
    const w = Math.max(...rows.map((r) => r.length));
    return w >= 2 ? rows.map((r) => [...r, ...Array(w - r.length).fill("")]) : null;
  }
  const parse = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") {
        out.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    out.push(cur.trim());
    return out;
  };
  if (lines.length < 2) return null;
  const rows = lines.map(parse);
  const w = rows[0].length;
  // prose with a comma per line isn't a table: csv fields are short
  return w >= 2 && rows.every((r) => r.length === w && r.every((f) => f.length <= 40)) ? rows : null;
}

export function toTSV(rows: string[][]) {
  return rows.map((r) => r.map((c) => c.replace(/[\t\n]/g, " ")).join("\t")).join("\n");
}

/* A table built like a spreadsheet: a grid of hairlines, a shaded header,
   a ring on the cell you're in. Strips along the bottom and the right edge
   add rows and columns; header edges stretch columns; right-click a cell
   for everything else.                                                   */
export const Table = memo(function Table({ data, set }: WidgetProps<TableData>) {
  const wrap = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ r: number; c: number; at: { x: number; y: number } } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const rows = data.rows;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) => data.widths?.[c] ?? DEFAULT_W);
  const bodyStart = data.header ? 1 : 0;

  const write = (next: string[][], extra: Partial<TableData> = {}) => set({ rows: next, ...extra }, { key: "cells" });
  const setCell = (r: number, c: number, v: string) =>
    write(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : (row[j] ?? ""))) : row)));
  const insertRow = (at: number) => write([...rows.slice(0, at), Array(cols).fill(""), ...rows.slice(at)]);
  const insertCol = (at: number) =>
    write(
      rows.map((r) => [...r.slice(0, at), "", ...r.slice(at)]),
      { widths: [...widths.slice(0, at), DEFAULT_W, ...widths.slice(at)] },
    );
  const deleteRow = (r: number) => rows.length > 1 && write(rows.filter((_, i) => i !== r));
  const deleteCol = (c: number) =>
    cols > 1 && write(rows.map((row) => row.filter((_, j) => j !== c)), { widths: widths.filter((_, j) => j !== c) });
  const sortBy = (c: number, dir: 1 | -1) => {
    const head = data.header ? [rows[0]] : [];
    const body = [...rows.slice(bodyStart)].sort((a, b) => {
      const x = asNumber(a[c] ?? "");
      const y = asNumber(b[c] ?? "");
      if (x !== null && y !== null) return (x - y) * dir;
      // empty cells sink to the bottom either way
      if (!(a[c] ?? "").trim()) return 1;
      if (!(b[c] ?? "").trim()) return -1;
      return (a[c] ?? "").localeCompare(b[c] ?? "", undefined, { numeric: true }) * dir;
    });
    write([...head, ...body]);
  };

  const focus = (r: number, c: number, caret: "start" | "end" = "end") =>
    requestAnimationFrame(() => {
      const el = wrap.current?.querySelector<HTMLInputElement>(`[data-cell="${r}:${c}"]`);
      if (!el) return;
      el.focus();
      const at = caret === "start" ? 0 : el.value.length;
      el.setSelectionRange(at, at);
    });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length;
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) return r > 0 && focus(r - 1, c);
      if (r === rows.length - 1) insertRow(rows.length);
      focus(r + 1, c);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (r < rows.length - 1) focus(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (r > 0) focus(r - 1, c);
    } else if (e.key === "ArrowLeft" && atStart && c > 0) {
      e.preventDefault();
      focus(r, c - 1);
    } else if (e.key === "ArrowRight" && atEnd && c < cols - 1) {
      e.preventDefault();
      focus(r, c + 1, "start");
    } else if (e.key === "Tab" && !e.shiftKey && c === cols - 1 && r === rows.length - 1) {
      e.preventDefault();
      insertRow(rows.length);
      focus(r + 1, 0);
    } else if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      deleteRow(r);
      focus(Math.max(0, r - 1), c);
    }
  };

  // a block pasted into a cell spreads across the grid from there, growing it if needed
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const grid = parseGrid(e.clipboardData.getData("text"));
    if (!grid || (grid.length === 1 && grid[0].length === 1)) return;
    e.preventDefault();
    const h = Math.max(rows.length, r + grid.length);
    const w = Math.max(cols, c + Math.max(...grid.map((g) => g.length)));
    const next = Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => rows[i]?.[j] ?? ""));
    grid.forEach((g, i) => g.forEach((v, j) => (next[r + i][c + j] = v)));
    write(next, { widths: Array.from({ length: w }, (_, j) => widths[j] ?? DEFAULT_W) });
  };

  // stretching a column by its header's right edge
  const startResize = (e: React.PointerEvent, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const w0 = widths[c];
    // the board may be zoomed: how wide one board pixel is on screen
    const scale = (wrap.current?.getBoundingClientRect().width ?? 1) / (wrap.current?.offsetWidth || 1);
    let last = widths;
    const move = (ev: PointerEvent) => {
      const w = Math.max(MIN_W, Math.round(w0 + (ev.clientX - x0) / scale));
      last = widths.map((x, j) => (j === c ? w : x));
      set({ widths: last }, { history: false });
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      set({ widths: last }, { key: "widths" });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  const numeric = Array.from({ length: cols }, (_, c) => {
    const vals = rows.slice(bodyStart).map((r) => (r[c] ?? "").trim()).filter(Boolean);
    return vals.length >= 2 && vals.every((v) => asNumber(v) !== null);
  });
  // a column that numbers or dates its rows (1, 2, 3 · day · year · #) is a label, not an amount
  const isCount = (c: number) => {
    const name = (data.header ? rows[0]?.[c] : "")?.trim().toLowerCase() ?? "";
    if (/^(#|no\.?|n|id|day|days|week|month|year|rank|step|row|item no\.?)$/.test(name)) return true;
    const vals = rows.slice(bodyStart).map((r) => asNumber(r[c] ?? "")).filter((n): n is number => n !== null);
    return vals.length >= 2 && vals.every((v, i) => v === vals[0] + i && Number.isInteger(v));
  };
  const totals = numeric.map((n, c) => (n && !isCount(c) ? rows.slice(bodyStart).reduce((s, r) => s + (asNumber(r[c] ?? "") ?? 0), 0) : null));
  const alignRight = numeric.map((n, c) => n && !isCount(c));
  // columns keep at least the width they were given, and share out any room the plate has
  const template = widths.map((w) => `minmax(${w}px, 1fr)`).join(" ");
  const line = "1px solid var(--line-strong)";

  return (
    <div className="relative h-full">
      <div ref={wrap} data-scrollable className="h-full overflow-auto scroll-thin p-2">
        <div className="group/table relative w-max min-w-full pr-6 pb-6">
          <div className="overflow-hidden rounded-none" style={{ boxShadow: "inset 0 0 0 1px var(--line-strong)" }}>
            {rows.map((row, r) => {
              const isHead = data.header && r === 0;
              return (
                <div
                  key={r}
                  className="grid"
                  style={{ gridTemplateColumns: template, background: isHead ? "var(--surface-hover)" : undefined, borderTop: r === 0 ? undefined : line }}
                >
                  {Array.from({ length: cols }, (_, c) => (
                    <div key={c} className="relative" style={{ borderLeft: c === 0 ? undefined : line }}>
                      <input
                        data-cell={`${r}:${c}`}
                        value={row[c] ?? ""}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, r, c)}
                        onPaste={(e) => onPaste(e, r, c)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenu({ r, c, at: { x: e.clientX, y: e.clientY } });
                        }}
                        placeholder={isHead ? `column ${c + 1}` : ""}
                        aria-label={isHead ? `heading ${c + 1}` : `row ${r + 1 - bodyStart}, ${rows[0]?.[c] || `column ${c + 1}`}`}
                        className={[
                          "block h-9 w-full bg-transparent px-3 text-[13px] outline-none placeholder:text-ink-ghost",
                          "focus:bg-panel-face focus:shadow-[inset_0_0_0_1.5px_var(--selection)]",
                          isHead ? "font-medium text-ink" : "text-ink-body",
                          !isHead && alignRight[c] ? "text-right tabular-nums" : "",
                        ].join(" ")}
                      />
                      {isHead && (
                        <span
                          data-nodrag
                          aria-hidden
                          title="drag to widen"
                          onPointerDown={(e) => startResize(e, c)}
                          className="absolute top-0 -right-[3px] z-10 h-full w-[6px] cursor-col-resize"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
            {totals.some((t) => t !== null) && (
              <div className="grid" style={{ gridTemplateColumns: template, borderTop: line, background: "var(--surface-hover)" }}>
                {totals.map((t, c) => (
                  <div
                    key={c}
                    className="flex h-8 items-center justify-end px-3 text-[12px] font-medium text-ink-muted tabular-nums"
                    style={{ borderLeft: c === 0 ? undefined : line }}
                  >
                    {t !== null ? formatNumber(t) : c === 0 ? <span className="mr-auto text-ink-faint">total</span> : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* the two edges that grow the table */}
          <button
            type="button"
            aria-label="add a column"
            title="add a column"
            onClick={() => {
              insertCol(cols);
              focus(0, cols);
            }}
            className="absolute top-0 right-0 bottom-6 grid w-5 place-items-center rounded-[8px] text-ink-faint opacity-0 transition-opacity group-hover/table:opacity-70 hover:bg-surface-hover hover:text-ink hover:opacity-100! focus-visible:opacity-100 cursor-pointer"
          >
            <IconPlus size={12} />
          </button>
          <button
            type="button"
            aria-label="add a row"
            title="add a row"
            onClick={() => {
              insertRow(rows.length);
              focus(rows.length, 0);
            }}
            className="absolute right-6 bottom-0 left-0 grid h-5 place-items-center rounded-[8px] text-ink-faint opacity-0 transition-opacity group-hover/table:opacity-70 hover:bg-surface-hover hover:text-ink hover:opacity-100! focus-visible:opacity-100 cursor-pointer"
          >
            <IconPlus size={12} />
          </button>
        </div>
      </div>

      {menu && (
        <Flyout open onClose={closeMenu} side="below" at={menu.at} width={236} label="cell">
          <FlyRow onClick={() => (insertRow(menu.r), closeMenu())}>row above</FlyRow>
          <FlyRow onClick={() => (insertRow(menu.r + 1), closeMenu())}>row below</FlyRow>
          <FlyRow onClick={() => (insertCol(menu.c), closeMenu())}>column to the left</FlyRow>
          <FlyRow onClick={() => (insertCol(menu.c + 1), closeMenu())}>column to the right</FlyRow>
          <FlySep />
          <FlyRow onClick={() => (sortBy(menu.c, 1), closeMenu())}>sort this column, low to high</FlyRow>
          <FlyRow onClick={() => (sortBy(menu.c, -1), closeMenu())}>sort this column, high to low</FlyRow>
          <FlySep />
          <FlyRow onClick={() => (setCell(menu.r, menu.c, ""), closeMenu())}>clear the cell</FlyRow>
          {rows.length > 1 && (
            <FlyRow icon={<IconTrash />} danger onClick={() => (deleteRow(menu.r), closeMenu())}>
              delete the row
            </FlyRow>
          )}
          {cols > 1 && (
            <FlyRow icon={<IconTrash />} danger onClick={() => (deleteCol(menu.c), closeMenu())}>
              delete the column
            </FlyRow>
          )}
        </Flyout>
      )}
    </div>
  );
});

export function TableRail({ data, set }: WidgetProps<TableData>) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <RailKey
        label={data.header ? "the first row is a header. press to make it ordinary" : "make the first row a header"}
        active={data.header}
        onClick={() => set({ header: !data.header }, { key: "header" })}
      >
        <span className={data.header ? "" : "opacity-45"}>
          <IconTableHeader size={13} />
        </span>
      </RailKey>
      <RailKey
        label={copied ? "copied" : "copy, to paste into a spreadsheet"}
        onClick={() => {
          navigator.clipboard?.writeText(toTSV(data.rows)).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        <IconCopy size={13} />
      </RailKey>
    </>
  );
}
