"use client";

import { Tooltip } from "@blurrow/ui";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/* The one control both bars are built from: a sunken well holding a row
   of keys, with a single raised thumb under the chosen one. It uses the
   same measurements as the kit's Tabs (13px well, 4px lip, 9px thumb,
   36px keys), so the board tabs, the tools and the theme switch read as
   one family. The thumb springs to a new key; it never fades.         */

export interface SegItem {
  key: string;
  /** text, or an icon for square keys */
  label: ReactNode;
  ariaLabel?: string;
  tooltip?: string;
  onDoubleClick?: () => void;
}

export function Segmented({
  items,
  value,
  onChange,
  ariaLabel,
  square = false,
  trailing,
  className = "",
}: {
  items: SegItem[];
  value: string | null;
  onChange: (key: string) => void;
  ariaLabel: string;
  /** square icon keys instead of words */
  square?: boolean;
  /** an extra key at the end of the well, like "new board" */
  trailing?: ReactNode;
  className?: string;
}) {
  const wellRef = useRef<HTMLDivElement>(null);
  const keys = useRef<Record<string, HTMLButtonElement | null>>({});
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const [pressed, setPressed] = useState(false);

  useLayoutEffect(() => {
    const well = wellRef.current;
    if (!well) return;
    const measure = () => {
      const btn = value ? keys.current[value] : null;
      if (!btn) return setThumb(null);
      // layout offsets, summed up to the well: a key may sit in a tooltip's wrapper, and
      // the bar may be mid-animation (scaled), which would throw off on-screen rects
      // the well is positioned, so walking up offset parents always arrives at it
      let left = 0;
      let el: HTMLElement | null = btn;
      while (el && el !== well) {
        left += el.offsetLeft;
        el = el.offsetParent as HTMLElement | null;
      }
      setThumb({ left, width: btn.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(well);
    return () => ro.disconnect();
  }, [value, items.length]);

  return (
    <div
      ref={wellRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`well relative flex min-w-0 items-center rounded-[13px] p-1 ${className}`}
      onPointerDown={(e) => (e.target as HTMLElement).closest("[role=radio]") && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {thumb && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-[9px]"
          style={{
            left: thumb.left,
            width: thumb.width,
            background: "var(--face)",
            boxShadow: pressed ? "var(--face-pressed)" : "var(--thumb-shadow)",
            transform: pressed ? "scale(0.97)" : "none",
            transition:
              "left 340ms var(--ease-spring), width 340ms var(--ease-spring), transform 180ms var(--ease-spring), box-shadow 160ms ease-out",
          }}
        />
      )}
      {items.map((it) => {
        const on = it.key === value;
        const key = (
          <button
            key={it.key}
            ref={(el) => {
              keys.current[it.key] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={it.ariaLabel}
            onClick={() => onChange(it.key)}
            onDoubleClick={it.onDoubleClick}
            className={[
              "relative z-10 flex h-9 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
              square ? "w-9" : "max-w-[168px] px-3.5",
              on ? "text-ink" : "text-ink-muted hover:text-ink-soft",
            ].join(" ")}
          >
            <span className={square ? "" : "truncate"}>{it.label}</span>
          </button>
        );
        return it.tooltip ? (
          <Tooltip key={it.key} content={it.tooltip}>
            {key}
          </Tooltip>
        ) : (
          key
        );
      })}
      {trailing}
    </div>
  );
}

/** A plate the bars sit on: the same bezel as the widgets, floating a little higher. */
export function BarPlate({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`pointer-events-auto flex items-center gap-[5px] rounded-[18px] p-[5px] ${className}`}
      style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
    >
      {children}
    </div>
  );
}

/** A single key in its own well: same height as a Segmented, for actions. */
export function WellKey({
  children,
  onClick,
  label,
  tone = "face",
  active,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  tone?: "face" | "inverse";
  active?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  const inverse = tone === "inverse";
  return (
    <div className="well rounded-[13px] p-1">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={[
          "group/wk grid h-9 w-9 place-items-center rounded-[9px] cursor-pointer transition-[transform,box-shadow] duration-200 active:scale-[0.96]",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink",
          inverse ? "text-ink-inverse" : "text-ink-label",
        ].join(" ")}
        style={{
          background: inverse ? "var(--face-inverse)" : "var(--face)",
          boxShadow: active
            ? inverse
              ? "var(--face-inverse-pressed)"
              : "var(--face-pressed)"
            : inverse
              ? "var(--face-inverse-shadow)"
              : "var(--thumb-shadow)",
          textShadow: inverse ? "var(--emboss-inverse)" : "var(--emboss)",
          transitionTimingFunction: "var(--ease-spring)",
        }}
        {...rest}
      >
        {children}
      </button>
    </div>
  );
}
