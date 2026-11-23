"use client";

import { Input, Spinner } from "@blurrow/ui";
import { memo, useCallback, useEffect, useState } from "react";
import { IconRefresh, IconSearch } from "../icons";
import { RailKey, TextLink, type WidgetProps } from "./parts";

export interface Place {
  name: string;
  country: string;
  admin?: string;
  lat: number;
  lon: number;
}
export interface WeatherData {
  place: Place | null;
  unit: "c" | "f";
  /** a city name to look up on first open, taken from the time zone */
  guess?: string;
  /** bumped by the rail's refresh key */
  nonce?: number;
  searching?: boolean;
}

interface Forecast {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    is_day: number;
  };
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; weather_code: number[] };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
  };
  current_units: { wind_speed_10m: string };
  utc_offset_seconds: number;
}

type Sky = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

function sky(code: number): { kind: Sky; words: string } {
  if (code === 0) return { kind: "clear", words: "clear" };
  if (code === 1) return { kind: "partly", words: "mostly clear" };
  if (code === 2) return { kind: "partly", words: "some cloud" };
  if (code === 3) return { kind: "cloudy", words: "overcast" };
  if (code === 45 || code === 48) return { kind: "fog", words: "fog" };
  if (code >= 51 && code <= 57) return { kind: "drizzle", words: "drizzle" };
  if (code >= 61 && code <= 67) return { kind: "rain", words: code >= 65 ? "heavy rain" : "rain" };
  if (code >= 71 && code <= 77) return { kind: "snow", words: code >= 75 ? "heavy snow" : "snow" };
  if (code >= 80 && code <= 82) return { kind: "rain", words: "showers" };
  if (code === 85 || code === 86) return { kind: "snow", words: "snow showers" };
  if (code >= 95) return { kind: "storm", words: "thunderstorm" };
  return { kind: "cloudy", words: "cloudy" };
}

/* Weather marks, drawn in the current ink like every other line on the board. */
export function SkyGlyph({ kind, day = true, size = 18 }: { kind: Sky; day?: boolean; size?: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const cloud = <path d="M7 18h9.5a3.5 3.5 0 00.4-7 5 5 0 00-9.6-1.2A4 4 0 007 18z" {...s} />;
  const sun = day ? (
    <g {...s}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1" />
    </g>
  ) : (
    <path d="M18 14.5A6.5 6.5 0 019.5 6a6.5 6.5 0 108.5 8.5z" {...s} />
  );
  const body = (() => {
    switch (kind) {
      case "clear":
        return sun;
      case "partly":
        return (
          <>
            <g transform="translate(-3 -3) scale(0.8)">{sun}</g>
            <path d="M9 19h8a3 3 0 00.3-6 4.3 4.3 0 00-8.2-1A3.5 3.5 0 009 19z" {...s} />
          </>
        );
      case "cloudy":
        return cloud;
      case "fog":
        return <path d="M4 9h16M6 13h12M4 17h16" {...s} />;
      case "drizzle":
        return (
          <>
            <g transform="translate(0 -3)">{cloud}</g>
            <path d="M9 18.5v1M13 18.5v1M17 18.5v1" {...s} />
          </>
        );
      case "rain":
        return (
          <>
            <g transform="translate(0 -3)">{cloud}</g>
            <path d="M9 17.5l-1 3M13 17.5l-1 3M17 17.5l-1 3" {...s} />
          </>
        );
      case "snow":
        return (
          <>
            <g transform="translate(0 -3)">{cloud}</g>
            <path d="M9 19h.01M13 20h.01M17 19h.01" {...s} strokeWidth={2.4} />
          </>
        );
      case "storm":
        return (
          <>
            <g transform="translate(0 -3)">{cloud}</g>
            <path d="M12.5 15.5l-2 3.5h3l-2 3" {...s} />
          </>
        );
    }
  })();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {body}
    </svg>
  );
}

async function geocode(q: string): Promise<Place[]> {
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
  );
  if (!r.ok) throw new Error("geocode");
  const j = await r.json();
  return (j.results ?? []).map((p: { name: string; country?: string; admin1?: string; latitude: number; longitude: number }) => ({
    name: p.name,
    country: p.country ?? "",
    admin: p.admin1,
    lat: p.latitude,
    lon: p.longitude,
  }));
}

const cache = new Map<string, { at: number; data: Forecast }>();

async function forecast(p: Place, unit: "c" | "f", force = false): Promise<Forecast> {
  const key = `${p.lat},${p.lon},${unit}`;
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < 10 * 60_000) return hit.data;
  const params = new URLSearchParams({
    latitude: String(p.lat),
    longitude: String(p.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: unit === "f" ? "fahrenheit" : "celsius",
    wind_speed_unit: unit === "f" ? "mph" : "kmh",
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!r.ok) throw new Error("forecast");
  const data = (await r.json()) as Forecast;
  cache.set(key, { at: Date.now(), data });
  return data;
}

const round = (n: number) => Math.round(n);

/** The place's wall clock as an ISO-ish string, to find "this hour" in hourly data. */
function placeHourKey(offsetSec: number) {
  const d = new Date(Date.now() + offsetSec * 1000);
  return d.toISOString().slice(0, 13);
}

function PlaceSearch({ onPick, onCancel, initial = "" }: { onPick: (p: Place) => void; onCancel?: () => void; initial?: string }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setResults(await geocode(q.trim()));
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <Input
          aria-label="place"
          placeholder="a city or a town"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          iconLeft={<IconSearch size={15} />}
          iconRight={busy ? <Spinner size="sm" /> : undefined}
          fullWidth
          autoFocus
        />
      </form>
      <ul data-scrollable className="mt-2 min-h-0 flex-1 overflow-y-auto scroll-thin">
        {results?.map((p, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPick(p)}
              className="w-full rounded-[10px] px-2.5 py-2 text-left hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <div className="text-[14px] font-medium text-ink">{p.name.toLowerCase()}</div>
              <div className="text-[12px] text-ink-muted">
                {[p.admin, p.country].filter(Boolean).join(", ").toLowerCase()}
              </div>
            </button>
          </li>
        ))}
        {results && results.length === 0 && (
          <li className="px-2.5 py-2 text-[13px] text-ink-muted">nothing by that name. try the nearest big town.</li>
        )}
      </ul>
      {onCancel && (
        <div className="pt-2">
          <TextLink onClick={onCancel}>back to the forecast</TextLink>
        </div>
      )}
    </div>
  );
}

export const Weather = memo(function Weather({ data, set }: WidgetProps<WeatherData>) {
  const [fc, setFc] = useState<Forecast | null>(null);
  const [err, setErr] = useState(false);
  const searching = !!data.searching;
  const setSearching = (v: boolean) => set({ searching: v }, { history: false });

  // first open: find the city the time zone is named after
  useEffect(() => {
    if (data.place || !data.guess) return;
    let gone = false;
    geocode(data.guess)
      .then((r) => {
        if (!gone && r[0]) set({ place: r[0], guess: undefined }, { history: false });
        else if (!gone) set({ guess: undefined }, { history: false });
      })
      .catch(() => !gone && set({ guess: undefined }, { history: false }));
    return () => {
      gone = true;
    };
  }, [data.place, data.guess, set]);

  const load = useCallback(
    (force = false) => {
      if (!data.place) return;
      forecast(data.place, data.unit, force)
        .then((f) => {
          setFc(f);
          setErr(false);
        })
        .catch(() => setErr(true));
    },
    [data.place, data.unit],
  );

  useEffect(() => {
    load(!!data.nonce);
    const t = setInterval(() => load(true), 30 * 60_000);
    return () => clearInterval(t);
  }, [load, data.nonce]);

  if (!data.place || searching) {
    if (data.guess && !searching) {
      return (
        <div className="grid h-full place-items-center">
          <Spinner label="finding the forecast" />
        </div>
      );
    }
    return (
      <PlaceSearch
        onCancel={data.place ? () => setSearching(false) : undefined}
        onPick={(p) => {
          setFc(null);
          set({ place: p, searching: false }, { key: "place" });
        }}
      />
    );
  }

  if (err && !fc) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-2 p-5">
        <div className="text-[14px] font-medium text-ink">the forecast didn&apos;t load.</div>
        <p className="text-[13px] leading-[1.5] text-ink-muted">open-meteo might be busy, or you&apos;re offline.</p>
        <TextLink onClick={() => load(true)}>try again</TextLink>
      </div>
    );
  }

  if (!fc) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner label="loading the forecast" />
      </div>
    );
  }

  const now = sky(fc.current.weather_code);
  const day = fc.current.is_day === 1;
  const key = placeHourKey(fc.utc_offset_seconds);
  const start = Math.max(0, fc.hourly.time.findIndex((t) => t.startsWith(key)));
  const hours = fc.hourly.time.slice(start, start + 6).map((t, i) => ({
    hour: Number(t.slice(11, 13)),
    temp: fc.hourly.temperature_2m[start + i],
    code: fc.hourly.weather_code[start + i],
  }));
  const days = fc.daily.time.slice(0, 5);
  const lo = Math.min(...fc.daily.temperature_2m_min.slice(0, 5));
  const hi = Math.max(...fc.daily.temperature_2m_max.slice(0, 5));
  const span = hi - lo || 1;

  return (
    <div data-scrollable className="flex h-full flex-col overflow-y-auto scroll-thin px-4 pt-3 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] text-ink-muted">{data.place.name.toLowerCase()}</div>
          <div className="mt-1 text-[44px] font-medium leading-none tracking-[-0.05em] text-ink tabular-nums">
            {round(fc.current.temperature_2m)}°
          </div>
          <div className="mt-1.5 text-[13px] text-ink-body tabular-nums">
            {now.words}, feels {round(fc.current.apparent_temperature)}°
          </div>
        </div>
        <div className="pt-5 text-ink-label">
          <SkyGlyph kind={now.kind} day={day} size={30} />
        </div>
      </div>

      <div className="mt-4 flex shrink-0 justify-between">
        {hours.map((h, i) => (
          <div key={i} className="flex min-w-[34px] flex-col items-center gap-1 text-ink-label">
            <span className="text-[11px] text-ink-faint tabular-nums">{i === 0 ? "now" : h.hour}</span>
            <SkyGlyph kind={sky(h.code).kind} day={h.hour >= 6 && h.hour < 19} size={15} />
            <span className="text-[12.5px] text-ink tabular-nums">{round(h.temp)}°</span>
          </div>
        ))}
      </div>

      <ul className="mt-3 shrink-0 border-t border-[var(--divider)] pt-1.5">
        {days.map((t, i) => {
          const d = new Date(`${t}T12:00:00`);
          const name = i === 0 ? "today" : d.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
          const min = fc.daily.temperature_2m_min[i];
          const max = fc.daily.temperature_2m_max[i];
          return (
            <li key={t} className="flex items-center gap-2.5 py-[5px] text-[12.5px] tabular-nums">
              <span className="w-10 text-ink-muted">{name}</span>
              <span className="text-ink-faint">
                <SkyGlyph kind={sky(fc.daily.weather_code[i]).kind} size={14} />
              </span>
              <span className="w-6 text-right text-ink-faint">{round(min)}°</span>
              <span className="relative h-[3px] flex-1 rounded-full" style={{ background: "var(--line-strong)" }}>
                <span
                  className="absolute top-0 bottom-0 rounded-full"
                  style={{
                    left: `${((min - lo) / span) * 100}%`,
                    right: `${100 - ((max - lo) / span) * 100}%`,
                    background: "var(--ink-label)",
                  }}
                />
              </span>
              <span className="w-6 text-ink">{round(max)}°</span>
            </li>
          );
        })}
      </ul>
      <a
        href="https://open-meteo.com"
        target="_blank"
        rel="noreferrer"
        className="mt-auto self-start pt-1 text-[10.5px] text-ink-ghost transition-colors hover:text-ink-faint"
      >
        open-meteo.com
      </a>
    </div>
  );
});

export function WeatherRail({ data, set }: WidgetProps<WeatherData>) {
  return (
    <>
      <RailKey label="change the place" active={data.searching} onClick={() => set({ searching: !data.searching }, { history: false })}>
        <IconSearch size={13} />
      </RailKey>
      <RailKey label="refresh" onClick={() => set({ nonce: Date.now() }, { history: false })}>
        <IconRefresh size={13} />
      </RailKey>
      <RailKey
        label={data.unit === "c" ? "show fahrenheit" : "show celsius"}
        onClick={() => set({ unit: data.unit === "c" ? "f" : "c" }, { key: "unit" })}
      >
        <span className="text-[11px] font-medium">°{data.unit}</span>
      </RailKey>
    </>
  );
}
