"use client";

import { Checkbox } from "@blurrow/ui";
import { memo, useState } from "react";
import { IconPlus, IconX } from "../icons";
import { TextLink, type WidgetProps } from "./parts";

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}
export interface ChecklistData {
  title: string;
  items: TodoItem[];
}

const rid = () => Math.random().toString(36).slice(2, 9);

export const Checklist = memo(function Checklist({ data, set }: WidgetProps<ChecklistData>) {
  const [draft, setDraft] = useState("");
  const open = data.items.filter((i) => !i.done);
  const done = data.items.filter((i) => i.done);
  const ordered = [...open, ...done];

  const add = () => {
    const lines = draft
      .split("\n")
      .map((l) => l.replace(/^[-*•\s]*(\[[ x]\])?\s*/i, "").trim())
      .filter(Boolean);
    if (!lines.length) return;
    set({ items: [...data.items, ...lines.map((text) => ({ id: rid(), text, done: false }))] }, { key: "add" });
    setDraft("");
  };

  const toggle = (id: string, v: boolean) =>
    set({ items: data.items.map((i) => (i.id === id ? { ...i, done: v } : i)) }, { key: `t:${id}` });
  const remove = (id: string) => set({ items: data.items.filter((i) => i.id !== id) }, { key: `r:${id}` });

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-3.5 pb-2.5">
        <input
          value={data.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="name this list"
          aria-label="list name"
          className="w-full bg-transparent text-[16px] font-medium tracking-[-0.01em] text-ink placeholder:text-ink-faint outline-none"
        />
      </div>

      <ul data-scrollable className="min-h-0 flex-1 overflow-y-auto scroll-thin px-3 pb-1">
        {ordered.map((item) => (
          <li
            key={item.id}
            className="group flex items-start gap-1 rounded-[10px] px-1 py-1.5 hover:bg-surface-hover transition-colors"
          >
            <div className={["min-w-0 flex-1", item.done ? "opacity-60" : ""].join(" ")}>
              <Checkbox
                checked={item.done}
                onChange={(v) => toggle(item.id, v)}
                label={item.text}
                className="flex-row-reverse! justify-end! items-start! gap-2.5! [&_span]:font-normal! [&_span]:text-[13.5px]!"
              />
            </div>
            <button
              type="button"
              onClick={() => remove(item.id)}
              aria-label={`remove ${item.text}`}
              className="mt-0.5 shrink-0 rounded-md p-1 text-ink-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink transition-opacity cursor-pointer"
            >
              <IconX size={13} />
            </button>
          </li>
        ))}
        {data.items.length === 0 && (
          <li className="px-1 py-2 text-[13px] leading-[1.5] text-ink-muted">
            nothing yet. paste a list below and each line becomes a box.
          </li>
        )}
      </ul>

      <div className="flex items-center gap-2 border-t border-[var(--divider)] px-4 py-2">
        <IconPlus size={14} className="shrink-0 text-ink-faint" />
        <textarea
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData("text");
            if (t.includes("\n")) {
              e.preventDefault();
              setDraft(t);
            }
          }}
          placeholder="add"
          aria-label="add an item"
          className="min-w-0 flex-1 resize-none bg-transparent py-1 text-[13.5px] text-ink placeholder:text-ink-faint outline-none"
        />
        {done.length > 0 && (
          <TextLink onClick={() => set({ items: open }, { key: "clear" })}>clear {done.length} done</TextLink>
        )}
      </div>
    </div>
  );
});
