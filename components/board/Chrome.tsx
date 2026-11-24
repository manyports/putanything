"use client";

import { Button, Input, Kbd, Modal, Tabs } from "@blurrow/ui";
import { Flyout, FlyLabel, FlyRow, FlySep } from "./Flyout";
import { useMinimapOn } from "./Minimap";
import { useCoarse } from "./useCoarse";
import { TEMPLATES } from "@/lib/templates";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { addBoard, duplicateBoard, getState, moveBoard, redo, renameBoard, switchBoard, undo, useBoard } from "@/lib/store";
import { exportPng, fitAll, resetZoom } from "@/lib/actions";
import {
  IconDownload,
  IconFit,
  IconKeyboard,
  IconMenu,
  IconPen,
  IconPlus,
  IconTrash,
  IconUpload,
  IconImage,
  IconMap,
  IconUndo,
  IconRedo,
  IconX,
  IconCopy,
  IconArrowLeft,
  IconArrowRight,
} from "../icons";

export type Theme = "light" | "dark" | "system";

const themeListeners = new Set<() => void>();

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (l) => {
      themeListeners.add(l);
      return () => themeListeners.delete(l);
    },
    () => (document.documentElement.dataset.theme as Theme) || "system",
    () => "system" as Theme,
  );
  const set = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("putanything:theme", t);
    } catch {}
    themeListeners.forEach((l) => l());
  };
  return [theme, set];
}

export const isMac = () => typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform);
export const modKey = () => (isMac() ? "⌘" : "ctrl");


const noop = () => () => {};
/** false while server-rendering and hydrating, true after */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}

function RenameBoard({ id, onDone }: { id: string | null; onDone: () => void }) {
  const boards = useBoard((s) => s.boards);
  const name = boards.find((b) => b.id === id)?.name ?? "";
  const [draft, setDraft] = useState(name);
  const [forId, setForId] = useState(id);
  const field = useRef<HTMLFormElement>(null);
  if (forId !== id) {
    setForId(id);
    setDraft(name);
  }
  // the dialog moves focus to its close key as it opens; take it to the name, selected, after that
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => {
      const input = field.current?.querySelector("input");
      input?.focus();
      input?.select();
    }, 80);
    return () => clearTimeout(t);
  }, [id]);
  const save = () => {
    if (id) renameBoard(id, draft);
    onDone();
  };
  return (
    <Modal
      open={!!id}
      onClose={onDone}
      title="rename this board"
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onDone}>
            cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save}>
            rename
          </Button>
        </>
      }
    >
      <form
        ref={field}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="board name" maxLength={40} fullWidth autoFocus />
      </form>
    </Modal>
  );
}

/* Boards read as tabs: plain names, and a raised face under the one you're
   on, the way the kit marks the current page. Double-click to rename.  */
function BoardTabs({
  onRename,
  onMenu,
}: {
  onRename: (id: string) => void;
  onMenu: (id: string, at: { x: number; y: number }) => void;
}) {
  const boards = useBoard((s) => s.boards);
  const active = useBoard((s) => s.activeBoard);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [face, setFace] = useState<{ left: number; top: number; width: number } | null>(null);

  // one raised face that slides to the board you switch to, on the kit's spring
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const tab = tabRefs.current[active];
      if (!tab) return setFace(null);
      setFace({ left: tab.offsetLeft, top: tab.offsetTop, width: tab.offsetWidth });
    };
    measure();
    tabRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [active, boards]);

  return (
    // a scrolling strip clips anything outside its padding box, so the padding is the room
    // the raised face needs for its shadow; the negative margin keeps the bar the same size
    <div
      ref={listRef}
      role="tablist"
      aria-label="boards"
      className="no-scrollbar relative -mx-1 -my-[5px] flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 py-[5px]"
    >
      {face && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-9 rounded-[10px]"
          style={{
            top: face.top,
            left: face.left,
            width: face.width,
            background: "var(--face)",
            boxShadow: "var(--face-shadow)",
            transition: "left 340ms var(--ease-spring), width 340ms var(--ease-spring)",
          }}
        />
      )}
      {boards.map((b, i) => {
        const on = b.id === active;
        return (
          <button
            key={b.id}
            ref={(el) => {
              tabRefs.current[b.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            title={`${b.name}${i < 9 ? `  ·  alt ${i + 1}` : ""}  ·  double-click to rename`}
            onClick={() => switchBoard(b.id)}
            onDoubleClick={() => onRename(b.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              onMenu(b.id, { x: r.left, y: r.bottom + 10 });
            }}
            className={[
              "relative z-10 h-9 max-w-[160px] shrink-0 truncate rounded-[10px] px-3 text-[13px] font-medium cursor-pointer transition-colors duration-200",
              on ? "text-ink" : "text-ink-muted hover:text-ink",
            ].join(" ")}
            style={on ? { textShadow: "var(--emboss)" } : undefined}
          >
            {b.name}
          </button>
        );
      })}
      <NewBoardKey />
    </div>
  );
}

/* A new board: empty, or one of the ready-made ones. */
function NewBoardKey() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="new board"
        title="new board"
        aria-expanded={open}
        onClick={() => {
          const r = ref.current!.getBoundingClientRect();
          setAt({ x: r.left, y: r.bottom + 10 });
          setOpen((v) => !v);
        }}
        data-flyout-anchor
        className={[
          "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-colors cursor-pointer",
          open ? "bg-surface-active text-ink" : "text-ink-faint hover:bg-surface-hover hover:text-ink",
        ].join(" ")}
      >
        <IconPlus size={15} />
      </button>
      <Flyout open={open} onClose={close} side="below" at={at} width={300} label="new board">
        <FlyRow icon={<IconPlus />} onClick={() => (setOpen(false), addBoard())}>
          empty board
        </FlyRow>
        <FlySep />
        <FlyLabel>ready-made</FlyLabel>
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              addBoard(t.name, t.build());
            }}
            className="w-full rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-surface-hover cursor-pointer"
          >
            <div className="text-[13px] font-medium text-ink-soft">{t.name}</div>
            <div className="text-[12px] leading-[1.4] text-ink-faint">{t.blurb}</div>
          </button>
        ))}
      </Flyout>
    </>
  );
}

function SaveLine() {
  const saveState = useBoard((s) => s.saveState);
  return (
    <div
      className={["px-2.5 pt-1.5 pb-2 text-[11.5px]", saveState === "error" ? "text-danger" : "text-ink-faint"].join(" ")}
      role="status"
    >
      {saveState === "error"
        ? "couldn't save. save a copy as a file."
        : saveState === "saving"
          ? "saving…"
          : "every change is saved on this device"}
    </div>
  );
}

export function Header({
  onHelp,
  onExport,
  onImport,
  onClear,
  onDeleteBoard,
}: {
  onHelp: () => void;
  onExport: () => void;
  onImport: () => void;
  onClear: () => void;
  onDeleteBoard: (id: string) => void;
}) {
  const [theme, setTheme] = useTheme();
  const mounted = useMounted();
  const boards = useBoard((s) => s.boards);
  const active = useBoard((s) => s.activeBoard);
  const saveState = useBoard((s) => s.saveState);
  const [renaming, setRenaming] = useState<string | null>(null);
  const touch = useCoarse();
  const [menu, setMenu] = useState(false);
  const [mapOn, setMap] = useMinimapOn();
  const close = useCallback(() => setMenu(false), []);
  const [tabMenu, setTabMenu] = useState<{ id: string; at: { x: number; y: number } } | null>(null);
  const closeTab = useCallback(() => setTabMenu(null), []);
  /** act on a board that may not be the one on screen: bring it up first */
  const onBoard = (id: string, fn: () => void) => async () => {
    setTabMenu(null);
    if (id !== getState().activeBoard) await switchBoard(id);
    fn();
  };
  const run = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <>
      <header
        className="animate-header-in pointer-events-none fixed z-40 flex gap-2"
        style={{
          top: "max(16px, env(safe-area-inset-top))",
          left: "max(16px, env(safe-area-inset-left))",
          right: "max(16px, env(safe-area-inset-right))",
        }}
      >
        <div
          className="pointer-events-auto flex min-w-0 max-w-full items-center gap-1 rounded-[16px] p-[5px]"
          style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
        >
          <div data-flyout-anchor className="relative shrink-0">
            <button
              type="button"
              aria-label="menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className={[
                "flex h-9 items-center gap-2 rounded-[10px] pr-3 pl-2.5 text-[14px] font-medium tracking-[-0.02em] text-ink cursor-pointer transition-colors",
                menu ? "bg-surface-active" : "hover:bg-surface-hover",
              ].join(" ")}
            >
              <IconMenu size={15} className="text-ink-muted" />
              <span className="max-sm:hidden">putanything</span>
              {saveState === "error" && <span aria-label="not saved" className="h-1.5 w-1.5 rounded-full bg-danger" />}
            </button>
            <Flyout open={menu} onClose={close} side="below" align="start" width={268} label="menu">
              <div className="px-1.5 pt-1.5 pb-1 [&_[role=tablist]]:flex! [&_[role=tablist]]:w-full! [&_[role=tab]]:flex-1!">
                {mounted && (
                  <Tabs
                    tabs={[
                      { key: "light", label: "light" },
                      { key: "dark", label: "dark" },
                      { key: "system", label: "auto" },
                    ]}
                    defaultTab={theme}
                    onChange={(k) => setTheme(k as Theme)}
                  />
                )}
              </div>
              <FlySep />
              <FlyRow icon={<IconPlus />} onClick={run(() => addBoard())}>
                new board
              </FlyRow>
              <FlyRow icon={<IconPen />} hint="double-click" onClick={run(() => setRenaming(active))}>
                rename this board
              </FlyRow>
              <FlyRow icon={<IconFit />} hint="⇧1" onClick={run(fitAll)}>
                show everything
              </FlyRow>
              <FlyRow icon={<IconMap />} onClick={run(() => setMap(!mapOn))}>
                {mapOn ? "hide the map" : "show the map"}
              </FlyRow>
              <FlyRow icon={<IconKeyboard />} hint="?" onClick={run(onHelp)}>
                keyboard shortcuts
              </FlyRow>
              <FlySep />
              <FlyRow icon={<IconDownload />} onClick={run(onExport)}>
                save this board as a file
              </FlyRow>
              <FlyRow icon={<IconImage />} onClick={run(() => exportPng(getState().selection.length ? "selection" : "board"))}>
                save as a picture
              </FlyRow>
              <FlyRow icon={<IconUpload />} onClick={run(onImport)}>
                open a board file
              </FlyRow>
              <FlyRow icon={<IconTrash />} onClick={run(onClear)}>
                clear this board
              </FlyRow>
              {boards.length > 1 && (
                <FlyRow icon={<IconX />} danger onClick={run(() => onDeleteBoard(active))}>
                  delete this board
                </FlyRow>
              )}
              <FlySep />
              <div className="flex items-center gap-3 px-2.5 pt-1 text-[12px] font-medium text-ink-muted">
                <a href="/privacy" target="_blank" className="hover:text-ink transition-colors">
                  privacy
                </a>
                <a href="/terms" target="_blank" className="hover:text-ink transition-colors">
                  terms
                </a>
                <a href="/credits" target="_blank" className="hover:text-ink transition-colors">
                  credits
                </a>
              </div>
              <SaveLine />
            </Flyout>
          </div>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--divider)" }} />
          <BoardTabs onRename={setRenaming} onMenu={(id, at) => setTabMenu({ id, at })} />
        </div>
        {touch && (
          // no keyboard on a phone: undo and redo get keys of their own
          <div
            className="pointer-events-auto ml-auto flex shrink-0 items-center gap-0.5 rounded-[16px] p-[5px]"
            style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
          >
            <button type="button" aria-label="undo" onClick={undo} className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-label active:bg-surface-active cursor-pointer">
              <IconUndo size={17} />
            </button>
            <button type="button" aria-label="redo" onClick={redo} className="grid h-9 w-9 place-items-center rounded-[10px] text-ink-label active:bg-surface-active cursor-pointer">
              <IconRedo size={17} />
            </button>
          </div>
        )}
      </header>
      <RenameBoard id={renaming} onDone={() => setRenaming(null)} />
      {tabMenu &&
        (() => {
          const i = boards.findIndex((b) => b.id === tabMenu.id);
          const b = boards[i];
          if (!b) return null;
          return (
            <Flyout open onClose={closeTab} side="below" at={tabMenu.at} width={232} label={`${b.name} options`}>
              <FlyLabel>{b.name}</FlyLabel>
              <FlyRow icon={<IconPen />} hint="double-click" onClick={onBoard(b.id, () => setRenaming(b.id))}>
                rename
              </FlyRow>
              <FlyRow icon={<IconCopy />} onClick={() => (setTabMenu(null), duplicateBoard(b.id))}>
                duplicate
              </FlyRow>
              {i > 0 && (
                <FlyRow icon={<IconArrowLeft />} onClick={() => (setTabMenu(null), moveBoard(b.id, i - 1))}>
                  move left
                </FlyRow>
              )}
              {i < boards.length - 1 && (
                <FlyRow icon={<IconArrowRight />} onClick={() => (setTabMenu(null), moveBoard(b.id, i + 1))}>
                  move right
                </FlyRow>
              )}
              <FlySep />
              <FlyRow icon={<IconDownload />} onClick={onBoard(b.id, onExport)}>
                save as a file
              </FlyRow>
              <FlyRow icon={<IconTrash />} onClick={onBoard(b.id, onClear)}>
                clear
              </FlyRow>
              {boards.length > 1 && (
                <FlyRow icon={<IconX />} danger onClick={() => (setTabMenu(null), onDeleteBoard(b.id))}>
                  delete
                </FlyRow>
              )}
            </Flyout>
          );
        })()}
    </>
  );
}

/** Just the scale. Click it for actual size; pinch or ctrl-scroll to change it. */
export function ZoomControls() {
  const z = useBoard((s) => s.camera.z);
  return (
    <div className="animate-header-in pointer-events-none fixed bottom-4 left-4 z-40 max-md:hidden">
      <button
        type="button"
        title={z === 1 ? "show everything · shift 1" : "actual size · shift 0"}
        onClick={() => (Math.abs(z - 1) < 0.001 ? fitAll() : resetZoom())}
        className="pointer-events-auto h-8 rounded-[9px] px-2 text-[12px] font-medium text-ink-faint tabular-nums hover:bg-surface-hover hover:text-ink-label cursor-pointer transition-colors"
      >
        {Math.round(z * 100)}%
      </button>
    </div>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const m = modKey();
  const groups: { title: string; rows: [string[], string][] }[] = [
    {
      title: "tools",
      rows: [
        [["v"], "select and move"],
        [["space"], "hold to pan"],
        [["p"], "pen; then 1–4 for its width"],
        [["a"], "arrow, shift snaps the angle; drag its ends to stretch it"],
        [["t"], "note, or double-click the board"],
        [["↵"], "edit the selected note (or double-click it)"],
        [["drag", "side"], "set a note's width; its words wrap"],
        [["r"], "shapes; shift for a square or circle"],
        [["e"], "eraser"],
        [["x"], "graphite or violet"],
      ],
    },
    {
      title: "putting things down",
      rows: [
        [["n"], "sticky"],
        [["1", "9"], "each widget, in shelf order"],
        [["w"], "open the shelf"],
        [[m, "v"], "paste a link, picture or text"],
        [[m, "k"], "everything, by name"],
        [[m, "f"], "find words on every board"],
      ],
    },
    {
      title: "arranging",
      rows: [
        [[m, "d"], "duplicate"],
        [[m, "g"], "group what's selected; add shift to ungroup"],
        [["drag", "corner"], "with several selected, scale them all together"],
        [["alt", "drag"], "drag a copy away"],
        [[m, "drag"], "move without snapping"],
        [["⌫"], "take it off the board"],
        [["shift"], "while stretching, keep the shape"],
        [["←", "→"], "nudge, shift for ten"],
        [[m, "a"], "select everything"],
        [[m, "z"], "undo, add shift to redo"],
      ],
    },
    {
      title: "looking around",
      rows: [
        [["⇧", "1"], "show everything"],
        [["⇧", "0"], "actual size"],
        [["⇧", "2"], "zoom to the selection"],
        [["alt", "1"], "go to board 1, and so on"],
        [[m, "scroll"], "zoom where you point"],
        [["scroll"], "pan; inside a widget it scrolls the widget"],
      ],
    },
  ];
  return (
    <Modal open={open} onClose={onClose} title="keys" description="everything here also works with the mouse.">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title}>
            <div className="mb-2 text-[12.5px] font-medium text-ink-muted">{g.title}</div>
            <ul className="space-y-1.5">
              {g.rows.map(([keys, what]) => (
                <li key={what} className="flex items-center justify-between gap-3 text-[13px] text-ink-body">
                  <span>{what}</span>
                  <span className="flex shrink-0 gap-1">
                    {keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
