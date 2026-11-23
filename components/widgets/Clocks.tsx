"use client";

import { Combobox, Slider } from "@blurrow/ui";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  allZones,
  formatClock,
  formatOffset,
  localZone,
  zoneCity,
  zoneOffset,
  zoneParts,
  zoneRegion,
} from "@/lib/time";
import { IconPlus, IconX } from "../icons";
import { RailKey, TextLink, type WidgetProps } from "./parts";

export interface ClockData {
  zones: string[];
  h24: boolean;
  adding?: boolean;
}

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // tick on the boundary so every clock on the board changes together
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(new Date());
      clearTimeout(t);
      t = setTimeout(tick, ms - (Date.now() % ms) + 5);
    };
    t = setTimeout(tick, ms - (Date.now() % ms) + 5);
    // a hidden tab's timers are slowed to about once a minute: catch up the moment it's seen again
    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [ms]);
  return now;
}

/* The strip under each city covers the same 24 real hours for every row,
   centred on now, so a column is one moment everywhere. Each cell is
   shaded by what that hour is in that city: work, awake, or asleep.   */
function DayStrip({ zone, start, marker }: { zone: string; start: number; marker: number }) {
  const work = Array.from({ length: 24 }, (_, i) => {
    const h = zoneParts(zone, new Date(start + i * 3600_000)).hour;
    return h >= 9 && h < 18;
  });
  return (
    <div className="relative mt-2 h-[4px] rounded-full" style={{ background: "var(--track)", boxShadow: "var(--track-shadow)" }}>
      {work.map((on, i) =>
        on ? (
          <span
            key={i}
            className="absolute top-0 bottom-0"
            style={{
              left: `${(i / 24) * 100}%`,
              width: `${100 / 24}%`,
              background: "var(--ink-faint)",
              borderTopLeftRadius: !work[i - 1] ? 999 : 0,
              borderBottomLeftRadius: !work[i - 1] ? 999 : 0,
              borderTopRightRadius: !work[i + 1] ? 999 : 0,
              borderBottomRightRadius: !work[i + 1] ? 999 : 0,
            }}
          />
        ) : null,
      )}
      <span
        aria-hidden
        className="absolute -top-[4px] -bottom-[4px] w-[2px] rounded-full"
        style={{ left: `calc(${marker * 100}% - 1px)`, background: "var(--accent-soft)", transition: "left 200ms var(--ease-out-soft)" }}
      />
    </div>
  );
}

export const Clocks = memo(function Clocks({ data, set }: WidgetProps<ClockData>) {
  const now = useNow(1000);
  const [shift, setShiftRaw] = useState(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setShift = (v: number) => {
    setShiftRaw(v);
    if (idle.current) clearTimeout(idle.current);
    // left alone for a minute, the clocks go back to telling the time
    if (v !== 0) idle.current = setTimeout(() => setShiftRaw(0), 60_000);
  };
  useEffect(() => () => {
    if (idle.current) clearTimeout(idle.current);
  }, []);
  const here = useMemo(() => localZone(), []);
  const at = new Date(now.getTime() + shift * 3600_000);
  const hereOffset = zoneOffset(here, at);

  const hourStart = Math.floor(now.getTime() / 3600_000) * 3600_000 - 12 * 3600_000;
  const marker = (at.getTime() - hourStart) / (24 * 3600_000);

  const options = useMemo(
    () =>
      allZones()
        .filter((z) => !data.zones.includes(z))
        .map((z) => ({ value: z, label: zoneCity(z), description: zoneRegion(z), keywords: [z] })),
    [data.zones],
  );

  const hereDay = zoneParts(here, at).day;

  return (
    <div className="flex h-full flex-col">
      {data.adding && (
        <div className="px-3 pt-3">
          <Combobox
            options={options}
            placeholder="type a city"
            emptyText="no zone by that name"
            fullWidth
            onChange={(v) => set(v ? { zones: [...data.zones, v], adding: false } : { adding: false })}
          />
        </div>
      )}
      <ul data-scrollable className="min-h-0 flex-1 overflow-y-auto scroll-thin px-4 pt-1.5">
        {data.zones.map((z) => {
          const p = zoneParts(z, at);
          const off = zoneOffset(z, at) - hereOffset;
          const dayWord = p.day === hereDay ? "" : off > 0 ? "tmrw " : "yday ";
          const night = p.hour < 6 || p.hour >= 21;
          return (
            <li key={z} className="group relative py-2">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate text-[14px] font-medium text-ink">{zoneCity(z)}</span>
                  <span className="shrink-0 text-[12px] text-ink-faint tabular-nums">
                    {z === here ? "here" : `${dayWord}${formatOffset(off)}`}
                  </span>
                  {data.zones.length > 1 && (
                    <button
                      type="button"
                      aria-label={`remove ${zoneCity(z)}`}
                      onClick={() => set({ zones: data.zones.filter((x) => x !== z) })}
                      className="self-center rounded-md p-0.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink cursor-pointer"
                    >
                      <IconX size={11} />
                    </button>
                  )}
                </div>
                <span
                  className={[
                    "text-[20px] font-medium leading-none tracking-[-0.03em] tabular-nums transition-colors",
                    shift !== 0 ? "text-accent-soft" : night ? "text-ink-muted" : "text-ink",
                  ].join(" ")}
                >
                  {formatClock(p.hour, p.minute, data.h24)}
                  {!data.h24 && <span className="ml-0.5 text-[11px] text-ink-faint">{p.hour < 12 ? "am" : "pm"}</span>}
                </span>
              </div>
              <DayStrip zone={z} start={hourStart} marker={marker} />
            </li>
          );
        })}
      </ul>

      <div className="px-4 pt-1 pb-3">
        <Slider min={-12} max={12} step={0.5} value={shift} onChange={(v) => setShift(v)} />
        <div className="mt-1 flex h-5 items-center justify-between text-[12px] text-ink-faint tabular-nums">
          {shift === 0 ? (
            <span>slide to plan a call</span>
          ) : (
            <>
              <span className="font-medium text-accent-soft">planning · {shift > 0 ? `in ${shift}h` : `${-shift}h ago`}</span>
              <TextLink onClick={() => setShift(0)}>back to now</TextLink>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export function ClocksRail({ data, set }: WidgetProps<ClockData>) {
  return (
    <>
      <RailKey label="add a city" active={data.adding} onClick={() => set({ adding: !data.adding }, { history: false })}>
        <IconPlus size={13} />
      </RailKey>
      <RailKey label={data.h24 ? "switch to 12-hour" : "switch to 24-hour"} onClick={() => set({ h24: !data.h24 }, { key: "h24" })}>
        <span className="text-[10.5px] font-medium tabular-nums">{data.h24 ? "24h" : "12h"}</span>
      </RailKey>
    </>
  );
}
