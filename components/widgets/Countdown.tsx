"use client";

import { Button, DatePicker } from "@blurrow/ui";
import { memo, useEffect, useState } from "react";
import { IconBell, IconCalendar } from "../icons";
import { askToNotify, notify } from "@/lib/time";
import { RailKey, type WidgetProps } from "./parts";

export interface CountdownData {
  label: string;
  /** yyyy-mm-dd */
  date: string | null;
  editing?: boolean;
  /** a desktop notification on the day itself */
  notify?: boolean;
  /** the day it already notified for, so it says so once */
  notified?: string;
}

function parse(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const Countdown = memo(function Countdown({ data, set }: WidgetProps<CountdownData>) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // on the day, once: a notification (only while the board is open in a tab)
  const due = !!data.date && parse(data.date).getTime() <= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  useEffect(() => {
    if (!data.notify || !data.date || !due || data.notified === data.date) return;
    notify(`${data.label || "the day"} is today.`, "from your countdown on putanything");
    set({ notified: data.date }, { history: false });
  }, [data.notify, data.date, data.notified, data.label, due, set]);

  if (!data.date || data.editing) {
    return (
      <div className="flex h-full flex-col gap-2.5 p-3.5">
        <input
          value={data.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="what are you waiting for"
          aria-label="what it counts to"
          className="field h-10 rounded-[10px] px-3 text-[14px] text-ink placeholder:text-ink-faint"
        />
        <DatePicker
          value={data.date ? parse(data.date) : null}
          onChange={(d) => d && set({ date: toISO(d) }, { key: "date" })}
          placeholder="pick the day"
          fullWidth
          format={{ weekday: "short", day: "numeric", month: "short", year: "numeric" }}
        />
        <div className="mt-auto">
          <Button variant="primary" size="sm" fullWidth disabled={!data.date} onClick={() => set({ editing: false })}>
            count it
          </Button>
        </div>
      </div>
    );
  }

  const target = parse(data.date);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const hoursLeft = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 3_600_000));
  const label = data.label || "the day";

  let big: string, unit: string, line: string;
  if (days === 0) {
    big = "today";
    unit = "";
    line = `${label} is today.`;
  } else if (days === 1) {
    big = String(hoursLeft);
    unit = hoursLeft === 1 ? "hour" : "hours";
    line = `until ${label}, tomorrow.`;
  } else if (days > 0) {
    big = String(days);
    unit = "days";
    line = `until ${label}.`;
  } else {
    big = String(-days);
    unit = -days === 1 ? "day" : "days";
    line = `since ${label}.`;
  }

  return (
    <div className="flex h-full flex-col justify-between px-4 pt-3 pb-3.5">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[52px] font-medium leading-none tracking-[-0.05em] text-ink tabular-nums">{big}</span>
          {unit && <span className="text-[15px] font-medium text-ink-label">{unit}</span>}
        </div>
        <p className="mt-2 text-[14px] leading-[1.45] text-ink-body text-pretty">{line}</p>
      </div>
      <div className="flex items-center justify-between text-[12px] text-ink-muted tabular-nums">
        <span>
          {target
            .toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
            .toLowerCase()}
        </span>
      </div>
    </div>
  );
});

export function CountdownRail({ data, set }: WidgetProps<CountdownData>) {
  if (!data.date || data.editing) return null;
  return (
    <>
      <RailKey
        label={data.notify ? "notifies you on the day. press to stop" : "notify me on the day"}
        active={data.notify}
        onClick={async () => {
          if (data.notify) return set({ notify: false }, { key: "notify" });
          if (await askToNotify()) set({ notify: true }, { key: "notify" });
        }}
      >
        <span className={data.notify ? "" : "opacity-40"}>
          <IconBell size={13} />
        </span>
      </RailKey>
      <RailKey label="change the day" onClick={() => set({ editing: true }, { history: false })}>
        <IconCalendar size={13} />
      </RailKey>
    </>
  );
}
