"use client";

import { memo, useCallback, useState } from "react";
import { swatchColor } from "@/lib/colors";
import { ColorPanel, PAPERS, colorPanelWidth } from "../board/ColorPanel";
import { Flyout } from "../board/Flyout";
import type { WidgetProps } from "./parts";

/** a named paper, or any hex from the picker */
export type Tint = string;
export interface StickyData {
  text: string;
  tint: Tint;
}


export const Sticky = memo(function Sticky({ data, set }: WidgetProps<StickyData>) {
  return (
    <div className="flex h-full flex-col">
      {/* the gummed edge: where you'd pinch a real one */}
      <div aria-hidden className="h-4 shrink-0" style={{ background: "color-mix(in oklab, var(--paper-ink) 4%, transparent)" }} />
      <textarea
      value={data.text}
      onChange={(e) => set({ text: e.target.value })}
      placeholder="write something, or paste it."
      spellCheck
      data-scrollable
      className="min-h-0 w-full flex-1 resize-none bg-transparent px-4 pt-2.5 pb-3.5 text-[15px] leading-[1.5] text-[var(--paper-ink)] placeholder:text-ink-faint outline-none scroll-thin"
    />
    </div>
  );
});

export function StickyRail({ data, set }: WidgetProps<StickyData>) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div data-flyout-anchor className="relative">
      <button
        type="button"
        aria-label="change the paper"
        title="change the paper"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-6 w-6 place-items-center rounded-[8px] hover:bg-surface-hover cursor-pointer"
      >
        <span
          className="block h-3.5 w-3.5 rounded-full"
          style={{ background: swatchColor(data.tint || "plain"), boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,.18)" }}
        />
      </button>
      <Flyout open={open} onClose={close} side="above" align="end" width={colorPanelWidth(PAPERS.length)} label="paper">
        <ColorPanel title="paper" value={data.tint || "plain"} base={PAPERS} onChange={(t) => set({ tint: t }, { key: "tint" })} />
      </Flyout>
    </div>
  );
}
