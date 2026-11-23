"use client";

import { useEffect, useState, type ReactNode } from "react";

/* The board catches every pinch it can. One it can't is a pinch over another
   site's page inside a card (a playing video): the browser zooms the whole
   page instead, and fixed bars would slide off screen. This layer keeps the
   bars pinned to what you can actually see, at their normal size, and says
   how to get back. (A transformed parent is also what fixed children
   position against, so the bars inside need no changes.)               */
/** what the person zoomed the page into (a video), so the zoom can be let go once it's out of sight */
export const zoomedInto: { el: HTMLElement | null } = { el: null };

/* Browsers don't let a page set its own pinch zoom, with one exception:
   Safari on iPhone and iPad re-reads the viewport tag, and a changed one
   brings the zoom back to normal. Elsewhere the person pinches out (the
   board lets that pinch through to the browser), guided by the note.    */
function resetPageZoom() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const was = meta.content;
  meta.content = `${was.replace(/,?\s*maximum-scale=[\d.]+/, "")}, maximum-scale=1.0001`;
  setTimeout(() => (meta.content = was), 400);
}

export function ChromeLayer({ children }: { children: ReactNode }) {
  const [vv, setVv] = useState<{ x: number; y: number; s: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    let resetting = false;
    const read = () => {
      setVv(v.scale > 1.01 ? { x: v.offsetLeft, y: v.offsetTop, s: v.scale, w: v.width, h: v.height } : null);
      if (v.scale <= 1.01) {
        zoomedInto.el = null;
        return;
      }
      // the thing that was zoomed into has gone out of sight: let the zoom go
      const el = zoomedInto.el;
      if (!el || resetting) return;
      const r = el.getBoundingClientRect();
      const seen = r.right > v.offsetLeft && r.left < v.offsetLeft + v.width && r.bottom > v.offsetTop && r.top < v.offsetTop + v.height;
      if (!el.isConnected || !seen) {
        resetting = true;
        resetPageZoom();
        setTimeout(() => (resetting = false), 800);
      }
    };
    read();
    v.addEventListener("resize", read);
    v.addEventListener("scroll", read);
    return () => {
      v.removeEventListener("resize", read);
      v.removeEventListener("scroll", read);
    };
  }, []);

  if (!vv) return <>{children}</>;
  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-40"
      style={{
        width: vv.w * vv.s,
        height: vv.h * vv.s,
        transform: `translate(${vv.x}px, ${vv.y}px) scale(${1 / vv.s})`,
        transformOrigin: "0 0",
      }}
    >
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 flex justify-center">
        <div
          role="status"
          className="rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium text-ink-label"
          style={{ background: "var(--panel-face)", boxShadow: "var(--panel-shadow)" }}
        >
          the page is zoomed in. pinch out to zoom it back.
        </div>
      </div>
    </div>
  );
}
