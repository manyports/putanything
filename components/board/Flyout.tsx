"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* Every popup on the board is built the same way: one plate (a 5px bezel
   holding a face), opening from the key that summoned it, closing on a
   click outside, on Escape, or once you've picked something. The menu,
   the widget tray and the colour panel are all this one thing.        */
export function Flyout({
  open,
  onClose,
  side,
  align = "start",
  width,
  children,
  label,
  at,
}: {
  /** open at a point on screen instead of beside an anchor (context menus) */
  at?: { x: number; y: number };
  open: boolean;
  onClose: () => void;
  side: "above" | "below";
  align?: "start" | "center" | "end";
  width: number;
  children: ReactNode;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest?.("[data-flyout-anchor]")?.contains(ref.current)) return;
      // a panel that a control inside this flyout opened (the colour picker) counts as inside
      if (t.closest?.("[role=dialog]") && !t.closest("[data-flyout]")) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key, true);
    };
  }, [open, onClose]);

  if (!open) return null;
  const panel = (
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      data-nodrag
      data-flyout
      className={[
        "z-50 rounded-[18px] p-[5px]",
        at
          ? "fixed origin-top-left animate-drop-in"
          : [
              "absolute",
              side === "above" ? "bottom-[calc(100%+8px)] origin-bottom animate-shelf-in" : "top-[calc(100%+8px)] origin-top animate-drop-in",
              align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
            ].join(" "),
      ].join(" ")}
      style={{
        width,
        background: "var(--panel-bezel)",
        boxShadow: "var(--overlay-shadow)",
        ...(at ? { left: Math.min(at.x, window.innerWidth - width - 8), top: at.y } : null),
      }}
    >
      <div className="plate-face rounded-[13px] p-1">{children}</div>
    </div>
  );
  // a menu at a point on screen escapes any zoomed or transformed parent (a plate on the board)
  return at ? createPortal(panel, document.body) : panel;
}

/** One line in a flyout: an icon, a name, and the key that does the same. */
export function FlyRow({
  icon,
  children,
  hint,
  onClick,
  danger,
  title,
}: {
  icon?: ReactNode;
  children: ReactNode;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      title={title}
      onClick={onClick}
      className={[
        "flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium transition-colors cursor-pointer",
        danger ? "text-danger hover:bg-danger-wash" : "text-ink-soft hover:bg-surface-hover hover:text-ink",
      ].join(" ")}
    >
      {icon && (
        <span className={["grid w-4 shrink-0 place-items-center [&_svg]:h-[15px] [&_svg]:w-[15px]", danger ? "" : "text-ink-faint"].join(" ")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11.5px] font-normal text-ink-faint tabular-nums">{hint}</span>}
    </button>
  );
}

export function FlySep() {
  return <div aria-hidden className="mx-2.5 my-1 h-px" style={{ background: "var(--divider)" }} />;
}

export function FlyLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-2 pb-1 text-[11.5px] font-medium text-ink-faint">{children}</div>;
}
