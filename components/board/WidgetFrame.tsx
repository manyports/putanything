"use client";

import { memo, useCallback } from "react";
import type { Item } from "@/lib/types";
import { updateItemData } from "@/lib/store";
import { WIDGETS } from "../widgets/registry";
import { IconLock, IconUnlock, IconX } from "../icons";
import { toggleLock } from "@/lib/actions";

/* Every corner and edge stretches the plate. Corners are bigger targets and
   show a small grip when the plate is pointed at or selected.           */
const HANDLES: { corner: string; cursor: string; className: string }[] = [
  { corner: "nw", cursor: "nwse-resize", className: "absolute -top-2 -left-2 z-20 h-5 w-5" },
  { corner: "ne", cursor: "nesw-resize", className: "absolute -top-2 -right-2 z-20 h-5 w-5" },
  { corner: "sw", cursor: "nesw-resize", className: "absolute -bottom-2 -left-2 z-20 h-5 w-5" },
  { corner: "se", cursor: "nwse-resize", className: "absolute -right-2 -bottom-2 z-20 h-5 w-5" },
  { corner: "n", cursor: "ns-resize", className: "absolute -top-1.5 right-3 left-3 z-10 h-3" },
  { corner: "s", cursor: "ns-resize", className: "absolute right-3 -bottom-1.5 left-3 z-10 h-3" },
  { corner: "w", cursor: "ew-resize", className: "absolute top-3 bottom-3 -left-1.5 z-10 w-3" },
  { corner: "e", cursor: "ew-resize", className: "absolute top-3 -right-1.5 bottom-3 z-10 w-3" },
];

interface Props {
  item: Item;
  selected: boolean;
  onClose: (id: string) => void;
}

/* A plate is one object: a bezel holding a face. You pick it up by any
   part that isn't a control, the way you'd pick up a thing on a desk.
   Its keys only come out when you're pointing at it or it's selected. */
export const WidgetFrame = memo(function WidgetFrame({ item, selected, onClose }: Props) {
  const def = WIDGETS[item.kind];
  const set = useCallback(
    (patch: Record<string, unknown>, opts?: { history?: boolean; key?: string }) =>
      updateItemData(item.id, patch, { history: opts?.history, key: opts?.key ? `${item.id}:${opts.key}` : undefined }),
    [item.id],
  );
  const { Component, Rail } = def;

  return (
    <div
      data-item={item.id}
      data-selected={selected || undefined}
      data-locked={item.locked || undefined}
      className="plate group/plate flex flex-col rounded-none p-[5px]"
      style={{
        // the kit's .rim sets position outside tailwind's layers; plates never use it
        position: "absolute",
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        zIndex: item.z,
        outline: selected ? "1.5px solid var(--selection)" : "1.5px solid transparent",
        outlineOffset: 3,
        transition: "outline-color 150ms var(--ease-out-soft), box-shadow 220ms var(--ease-out-soft)",
      }}
    >
      {/* keys: sit on a bridge above the plate so the pointer can travel to them */}
      <div
        data-nodrag
        className="pointer-events-none absolute right-0 bottom-full flex pb-2 opacity-0 transition-opacity duration-150 group-hover/plate:pointer-events-auto group-hover/plate:opacity-100 group-data-[selected]/plate:pointer-events-auto group-data-[selected]/plate:opacity-100"
      >
        <div
          className="flex items-center gap-0.5 rounded-[10px] p-[2px]"
          style={{ background: "var(--panel-face)", boxShadow: "var(--panel-shadow)" }}
        >
          {Rail && !item.locked && <Rail id={item.id} data={item.data} set={set} w={item.w} h={item.h} />}
          <button
            type="button"
            aria-label={item.locked ? "unlock" : "lock in place"}
            title={item.locked ? "locked. press to unlock" : "lock in place"}
            onClick={() => toggleLock([item.id])}
            className={[
              "grid h-6 w-6 place-items-center rounded-[8px] transition-colors hover:bg-surface-hover cursor-pointer",
              item.locked ? "text-ink" : "text-ink-faint hover:text-ink",
            ].join(" ")}
          >
            {item.locked ? <IconLock size={12} /> : <IconUnlock size={12} />}
          </button>
          {!item.locked && <button
            type="button"
            aria-label={`take the ${def.name} off the board`}
            title="take it off the board"
            onClick={() => onClose(item.id)}
            className="grid h-6 w-6 place-items-center rounded-[8px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
          >
            <IconX size={12} />
          </button>}
        </div>
      </div>

      <div className="plate-face relative min-h-0 flex-1 overflow-hidden rounded-none" style={def.faceStyle?.(item.data)}>
        <Component id={item.id} data={item.data} set={set} w={item.w} h={item.h} />
      </div>

      {!item.locked && HANDLES.map((h) => (
        <div key={h.corner} data-resize={item.id} data-corner={h.corner} aria-hidden className={h.className} style={{ cursor: h.cursor }}>
          {h.corner.length === 2 && (
            <span
              className="pointer-events-none absolute top-1/2 left-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-none opacity-0 transition-opacity duration-150 group-hover/plate:opacity-100 group-data-[selected]/plate:opacity-100"
              style={{ background: "var(--panel-face)", boxShadow: "0 0 0 1.5px var(--selection), 0 1px 2px rgba(0,0,0,.12)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
});
