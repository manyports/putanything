"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Doc, Item, Mark } from "@/lib/types";
import { allBoards, getState, setState, switchBoard } from "@/lib/store";
import { fitRect } from "@/lib/actions";
import { itemRect, markRect } from "@/lib/geom";
import { WIDGETS } from "../widgets/registry";
import { IconSearch } from "../icons";

interface Hit {
  board: string;
  boardName: string;
  id: string;
  what: string;
  text: string;
}

/** every piece of text a thing on a board holds, as one string to search */
function itemText(i: Item): string {
  const d = i.data as Record<string, unknown>;
  switch (i.kind) {
    case "sticky":
      return String(d.text ?? "");
    case "todo":
      return [d.title, ...((d.items as { text: string }[]) ?? []).map((x) => x.text)].filter(Boolean).join(" · ");
    case "table":
      return ((d.rows as string[][]) ?? []).map((r) => r.filter(Boolean).join(" ")).filter(Boolean).join(" · ");
    case "link":
      return [d.title, d.description, d.url].filter(Boolean).join(" · ");
    case "timer":
    case "countdown":
      return String(d.label ?? "");
    case "dict":
      return [d.word, ...((d.recent as string[]) ?? [])].filter(Boolean).join(" · ");
    case "image":
    case "file":
      return String(d.name ?? "");
    case "code":
      return [d.name, d.code].filter(Boolean).join(" · ");
    case "weather":
      return String((d.place as { name?: string } | null)?.name ?? "");
    case "clock":
      return ((d.zones as string[]) ?? []).map((z) => z.split("/").pop()?.replace(/_/g, " ")).join(" · ");
    default:
      return "";
  }
}

function markText(m: Mark): string {
  if (m.kind === "text") return m.text;
  if (m.kind === "shape") return m.label ?? "";
  return "";
}

function index(board: { id: string; name: string; doc: Doc }): Hit[] {
  const hits: Hit[] = [];
  for (const i of board.doc.items) {
    const text = itemText(i);
    if (text.trim()) hits.push({ board: board.id, boardName: board.name, id: i.id, what: WIDGETS[i.kind].name, text });
  }
  for (const m of board.doc.marks) {
    const text = markText(m);
    if (text.trim()) hits.push({ board: board.id, boardName: board.name, id: m.id, what: m.kind === "text" ? "note" : "shape", text });
  }
  return hits;
}

/** the words around the match, so a long sticky shows the part that matched */
function snippet(text: string, q: string) {
  const flat = text.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(q);
  const start = Math.max(0, at - 30);
  const piece = flat.slice(start, start + 110);
  const rel = at - start;
  return { before: (start > 0 ? "…" : "") + piece.slice(0, rel), hit: piece.slice(rel, rel + q.length), after: piece.slice(rel + q.length) + (start + 110 < flat.length ? "…" : "") };
}

export function Search({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let gone = false;
    allBoards().then((boards) => !gone && setAll(boards.flatMap(index)));
    requestAnimationFrame(() => input.current?.select());
    return () => {
      gone = true;
    };
  }, [open]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => (query ? all.filter((h) => h.text.toLowerCase().includes(query)).slice(0, 40) : []), [all, query]);
  const current = getState().activeBoard;

  const go = async (h: Hit) => {
    onClose();
    if (h.board !== getState().activeBoard) await switchBoard(h.board);
    const { doc } = getState();
    const item = doc.items.find((i) => i.id === h.id);
    const mark = doc.marks.find((m) => m.id === h.id);
    const r = item ? itemRect(item) : mark ? markRect(mark) : null;
    if (!r) return;
    setState({ selection: [h.id], tool: "select", camera: fitRect({ x: r.x - 120, y: r.y - 120, w: r.w + 240, h: r.h + 240 }, 1) });
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-center px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-label="search the boards"
        className="animate-drop-in h-fit w-full max-w-[560px] rounded-[20px] p-[5px]"
        style={{ background: "var(--panel-bezel)", boxShadow: "var(--modal-shadow)" }}
      >
        <div className="plate-face rounded-[15px]">
          <div className="flex items-center gap-2.5 border-b border-[var(--divider)] px-4">
            <IconSearch size={16} className="shrink-0 text-ink-faint" />
            <input
              ref={input}
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(results.length - 1, a + 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                }
                if (e.key === "Enter" && results[active]) go(results[active]);
              }}
              placeholder="find on every board"
              aria-label="find"
              className="h-12 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint outline-none"
            />
            <span className="shrink-0 text-[11.5px] text-ink-faint tabular-nums">{query ? `${results.length}${results.length === 40 ? "+" : ""} found` : ""}</span>
          </div>
          <ul role="listbox" aria-label="matches" className="max-h-[52vh] overflow-y-auto scroll-thin p-1.5">
            {query && results.length === 0 && <li className="px-3 py-3 text-[13px] text-ink-muted">nothing on any board says “{q.trim()}”.</li>}
            {!query && <li className="px-3 py-3 text-[13px] text-ink-muted">stickies, notes, lists, tables, link cards and shape labels, on all your boards.</li>}
            {results.map((h, i) => {
              const s = snippet(h.text, query);
              return (
                <li key={`${h.board}:${h.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={["w-full rounded-[10px] px-3 py-2 text-left cursor-pointer transition-colors", i === active ? "bg-surface-hover" : ""].join(" ")}
                  >
                    <div className="truncate text-[13.5px] text-ink-body">
                      {s.before}
                      <mark className="rounded-[3px] bg-transparent font-medium text-ink underline decoration-[var(--selection)] decoration-2 underline-offset-[3px]">{s.hit}</mark>
                      {s.after}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-ink-faint">
                      {h.what}
                      {h.board !== current ? ` · ${h.boardName}` : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
