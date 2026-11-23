"use client";

import { useRef, useSyncExternalStore } from "react";
import { getState, setState, useBoard } from "@/lib/store";
import { docBounds } from "@/lib/actions";
import { itemRect, markRect, union } from "@/lib/geom";

/* The whole board, small, with a frame where you're looking. Press or drag
   in it to look somewhere else. Only shown when there's somewhere to go. */
const KEY = "putanything:minimap";
const listeners = new Set<() => void>();
export function useMinimapOn(): [boolean, (v: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => {
      try {
        return localStorage.getItem(KEY) !== "off";
      } catch {
        return true;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {}
    listeners.forEach((l) => l());
  };
  return [on, set];
}

const W = 184;
const H = 124;

export function Minimap() {
  const [on] = useMinimapOn();
  const doc = useBoard((s) => s.doc);
  const camera = useBoard((s) => s.camera);
  const ref = useRef<HTMLDivElement>(null);
  if (!on || typeof window === "undefined") return null;

  const view = { x: -camera.x / camera.z, y: -camera.y / camera.z, w: window.innerWidth / camera.z, h: window.innerHeight / camera.z };
  const content = docBounds(doc);
  if (!content) return null;
  // nothing off screen: no map needed
  const offscreen = content.x < view.x || content.y < view.y || content.x + content.w > view.x + view.w || content.y + content.h > view.y + view.h;
  if (!offscreen) return null;

  const world = union([content, view])!;
  const pad = 0.06;
  const s = Math.min(W / (world.w * (1 + pad * 2)), H / (world.h * (1 + pad * 2)));
  const ox = (W - world.w * s) / 2 - world.x * s;
  const oy = (H - world.h * s) / 2 - world.y * s;
  const toMap = (r: { x: number; y: number; w: number; h: number }) => ({ left: r.x * s + ox, top: r.y * s + oy, width: Math.max(1.5, r.w * s), height: Math.max(1.5, r.h * s) });

  const lookAt = (clientX: number, clientY: number) => {
    const box = ref.current!.getBoundingClientRect();
    const wx = (clientX - box.left - ox) / s;
    const wy = (clientY - box.top - oy) / s;
    const { camera: c } = getState();
    setState({ camera: { ...c, x: window.innerWidth / 2 - wx * c.z, y: window.innerHeight / 2 - wy * c.z } });
  };

  return (
    <div className="animate-header-in pointer-events-none fixed right-4 bottom-4 z-40 max-md:hidden">
      <div className="pointer-events-auto rounded-[16px] p-[5px]" style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}>
        <div
          ref={ref}
          role="img"
          aria-label="map of the board"
          title="press to look there"
          className="well relative cursor-pointer overflow-hidden rounded-[11px]"
          style={{ width: W, height: H }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            lookAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => e.buttons & 1 && lookAt(e.clientX, e.clientY)}
        >
          {doc.items.map((i) => (
            <span key={i.id} className="absolute rounded-[2px]" style={{ ...toMap(itemRect(i)), background: "var(--ink-ghost)" }} />
          ))}
          {doc.marks.map((m) => (
            <span key={m.id} className="absolute rounded-[1px]" style={{ ...toMap(markRect(m)), background: "var(--ink-faint)", opacity: 0.5 }} />
          ))}
          <span
            aria-hidden
            className="absolute rounded-[3px]"
            style={{ ...toMap(view), boxShadow: "0 0 0 1.5px var(--selection)", background: "color-mix(in oklab, var(--selection) 8%, transparent)" }}
          />
        </div>
      </div>
    </div>
  );
}
