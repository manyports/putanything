"use client";

import { useSyncExternalStore } from "react";

/** true on touch screens (phones, tablets), where there's a finger rather than a mouse */
export function useCoarse() {
  return useSyncExternalStore(
    (l) => {
      const m = window.matchMedia("(pointer: coarse)");
      m.addEventListener("change", l);
      return () => m.removeEventListener("change", l);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}
