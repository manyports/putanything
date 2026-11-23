"use client";

import { useToast } from "@blurrow/ui";
import { memo, useEffect, useRef, useState } from "react";
import { mmss, notify, askToNotify, parseDuration } from "@/lib/time";
import { IconBell, IconPause, IconPlay, IconReset, IconSpeaker } from "../icons";
import { Chip, RailKey, type WidgetProps } from "./parts";

export interface TimerData {
  label: string;
  /** seconds the timer is set to */
  duration: number;
  /** epoch ms when a running timer reaches zero; survives a reload */
  endsAt: number | null;
  /** seconds left while paused */
  left: number;
  ring: boolean;
  /** also send a desktop notification when it's done */
  notify?: boolean;
}

const PRESETS = [5, 15, 25, 50];

/* Two soft bell partials, a beat apart. Only ever played because a timer
   the reader started has run out.                                      */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const strike = (at: number, f: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 1.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 1.5);
    };
    strike(0, 880);
    strike(0.18, 1318.5);
    strike(0.9, 880);
    strike(1.08, 1318.5);
    setTimeout(() => ctx.close(), 2800);
  } catch {}
}

export const Timer = memo(function Timer({ data, set }: WidgetProps<TimerData>) {
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [bad, setBad] = useState(false);
  const running = data.endsAt !== null;
  const left = running ? Math.min(data.left || Infinity, Math.max(0, (data.endsAt! - now) / 1000)) : data.left;
  const finished = running && left <= 0;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  // tell the tab, so a timer behind other windows still shows
  useEffect(() => {
    if (!running || finished) return;
    const prev = document.title;
    document.title = `${mmss(left)} · ${data.label || "timer"}`;
    return () => {
      document.title = prev.includes(" · ") ? "putanything" : prev;
    };
  });

  useEffect(() => {
    if (!finished || firedFor.current === data.endsAt) return;
    firedFor.current = data.endsAt;
    const late = Date.now() - (data.endsAt ?? 0) > 5000;
    if (!late) {
      if (data.ring) chime();
      if (data.notify) notify(`${data.label || "the timer"} is done.`, `${mmss(data.duration)} went by.`);
      toast({ title: `${data.label || "the timer"} is done.`, description: `${mmss(data.duration)} went by.` });
    }
    set({ endsAt: null, left: 0 }, { history: false });
  }, [finished, data.endsAt, data.ring, data.notify, data.label, data.duration, set, toast]);

  const start = () => {
    const secs = data.left > 0 ? data.left : data.duration;
    const t = Date.now();
    setNow(t);
    set({ endsAt: t + secs * 1000, left: secs }, { history: false });
  };
  const pause = () => set({ endsAt: null, left: Math.ceil(left) }, { history: false });
  const reset = () => set({ endsAt: null, left: data.duration }, { history: false });
  const setMinutes = (m: number) => set({ duration: m * 60, left: m * 60, endsAt: null }, { key: "duration" });

  const spent = data.duration ? 1 - left / data.duration : 0;

  return (
    <div className="flex h-full flex-col px-4 pt-3.5 pb-3.5">
      <input
        value={data.label}
        onChange={(e) => set({ label: e.target.value })}
        placeholder="name it"
        aria-label="timer label"
        className="w-full bg-transparent text-[13px] font-medium text-ink-label placeholder:text-ink-faint outline-none"
      />
      <div className="flex flex-1 flex-col justify-center">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const secs = parseDuration(draft);
              if (secs && secs > 0 && secs <= 24 * 3600) {
                set({ duration: secs, left: secs, endsAt: null }, { key: "duration" });
                setEditing(false);
              } else setBad(true);
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setBad(false);
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              aria-label="how long"
              aria-invalid={bad || undefined}
              placeholder="7:30, 90, 1h 20m"
              className="field w-full rounded-[12px] px-3 py-1.5 text-[34px] font-medium leading-tight tracking-[-0.04em] text-ink tabular-nums"
            />
            <div className={["mt-1 text-[11.5px]", bad ? "text-danger" : "text-ink-faint"].join(" ")}>
              {bad ? "try 7:30, 90 (minutes), or 1h 20m" : "enter to set it, esc to leave it"}
            </div>
          </form>
        ) : (
          <button
            type="button"
            disabled={running}
            title={running ? undefined : "type a time"}
            onClick={() => {
              setDraft(mmss(data.duration));
              setEditing(true);
            }}
            className={[
              "text-left text-[52px] font-medium leading-none tracking-[-0.05em] tabular-nums transition-colors rounded-[10px] -mx-1 px-1",
              left === 0 ? "text-ink-faint" : running ? "text-ink" : "text-ink-label hover:bg-surface-hover cursor-text",
            ].join(" ")}
            aria-live="off"
          >
            {mmss(left)}
          </button>
        )}
        <div className="mt-3 h-[2px] rounded-full" style={{ background: "var(--line-strong)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(1, Math.max(0, spent)) * 100}%`,
              background: "var(--ink-label)",
              transition: "width 250ms linear",
            }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center">
        <div className="-ml-1.5 flex items-center">
          {PRESETS.map((m) => (
            <Chip key={m} onClick={() => setMinutes(m)} active={!running && data.duration === m * 60}>
              {m}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          aria-label="reset"
          title="reset"
          onClick={reset}
          className="ml-auto grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
        >
          <IconReset size={14} />
        </button>
        <button
          type="button"
          aria-label={running ? "pause" : "start"}
          title={running ? "pause" : "start"}
          onClick={running ? pause : start}
          className="ml-1 grid h-9 w-9 place-items-center rounded-full text-ink-inverse cursor-pointer active:translate-y-px transition-transform"
          style={{ background: "var(--face-inverse)", boxShadow: "var(--face-inverse-shadow)" }}
        >
          {running ? <IconPause size={14} /> : <IconPlay size={14} />}
        </button>
      </div>
    </div>
  );
});

export function TimerRail({ data, set }: WidgetProps<TimerData>) {
  return (
    <>
    <RailKey
      label={data.notify ? "sends a notification when done. press to stop" : "send a notification when done"}
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
    <RailKey
      label={data.ring ? "rings when done. press to mute" : "muted. press to ring when done"}
      active={data.ring}
      onClick={() => set({ ring: !data.ring }, { key: "ring" })}
    >
      <span className={data.ring ? "" : "opacity-40"}>
        <IconSpeaker size={13} />
      </span>
    </RailKey>
    </>
  );
}
