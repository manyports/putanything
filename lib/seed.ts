"use client";

import type { Doc, Item, Mark } from "./types";
import { WIDGETS } from "@/components/widgets/registry";
import { uid } from "./store";
import { fitRect, docBounds } from "./actions";

const mod = () => (typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform) ? "⌘" : "ctrl ");

/* What a first visit opens on: a few plates you'd actually keep, and a
   list that teaches the board by asking you to use it.               */
function clocks() {
  // where you are, and two places people usually need to reach
  const d = WIDGETS.clock.create() as { zones: string[]; h24: boolean };
  return { ...d, zones: d.zones.slice(0, 3) };
}

export function seedDoc(): Doc {
  let z = 0;
  const put = (kind: Item["kind"], x: number, y: number, data?: unknown, size?: { w: number; h: number }): Item => {
    const def = WIDGETS[kind];
    return {
      id: uid(),
      kind,
      x,
      y,
      w: size?.w ?? def.size.w,
      h: size?.h ?? def.size.h,
      z: ++z,
      data: (data ?? def.create()) as Record<string, unknown>,
    };
  };

  const items: Item[] = [
    put(
      "sticky",
      -330,
      40,
      { tint: "amber", text: `paste a link, a picture or a list anywhere on the board.\n\nn is a sticky. w is everything else. ${mod()}k finds anything.` },
      { w: 300, h: 260 },
    ),
    put("clock", 0, 0, clocks(), { w: 360, h: 300 }),
    put("weather", 390, -20, undefined, { w: 360, h: 440 }),
    put("calc", 780, 10, undefined, { w: 300, h: 430 }),
    put("countdown", 0, 330, undefined, { w: 300, h: 190 }),
  ];

  const marks: Mark[] = [];

  return { items, marks };
}

export function cameraFor(doc: Doc) {
  // frame everything, never bigger than life
  return fitRect(docBounds(doc));
}
