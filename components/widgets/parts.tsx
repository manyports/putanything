"use client";

import { Button } from "@blurrow/ui";
import type { ReactNode } from "react";

export interface WidgetProps<D> {
  id: string;
  data: D;
  set: (patch: Partial<D>, opts?: { history?: boolean; key?: string }) => void;
  w: number;
  h: number;
}

/** A small flat key for a plate's rail. */
export function RailKey({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={["w-6! h-6! rounded-[8px]!", active ? "text-ink!" : ""].join(" ")}
    >
      {children}
    </Button>
  );
}

/** Two or three options in a sunken well with a raised thumb, sized for rails. */
export function MiniSwitch<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="well flex items-center rounded-[8px] p-[2px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={[
              "h-5 min-w-6 px-1.5 rounded-[6px] text-[11px] font-medium tabular-nums cursor-pointer transition-colors",
              on ? "text-ink" : "text-ink-faint hover:text-ink-label",
            ].join(" ")}
            style={
              on
                ? {
                    background: "var(--face)",
                    boxShadow: "var(--thumb-shadow)",
                    transition: "box-shadow 200ms var(--ease-out-soft)",
                  }
                : undefined
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A word you can press: presets, synonyms, recent lookups. Flat until pointed at. */
export function Chip({
  children,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        "inline-flex h-6 items-center rounded-[7px] px-1.5 text-[12.5px] font-medium cursor-pointer whitespace-nowrap transition-colors",
        active ? "text-ink bg-surface-active" : "text-ink-muted hover:text-ink hover:bg-surface-hover",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[12px] font-medium text-ink-muted ${className}`}>{children}</div>;
}

/** Plain text link, for actions that sit in a sentence. */
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12.5px] font-medium text-ink-muted hover:text-ink underline decoration-ink-ghost underline-offset-[3px] hover:decoration-ink-faint cursor-pointer transition-colors"
    >
      {children}
    </button>
  );
}
