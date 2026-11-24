"use client";

import { Select } from "@blurrow/ui";
import { memo, useEffect, useMemo, useState } from "react";
import { evaluate, formatNumber } from "@/lib/calc";
import { CATEGORIES, CURRENCY_NAMES, convert, type Category } from "@/lib/units";
import { IconSwap } from "../icons";
import type { WidgetProps } from "./parts";

export interface ConvertData {
  cat: string;
  from: string;
  to: string;
  /** what the reader typed, on whichever side they typed it */
  value: string;
  side: "from" | "to";
}

type Rates = { date: string; rates: Record<string, number>; ecb: Set<string> };
let ratesPromise: Promise<Rates> | null = null;

/* Two sources, each doing what it's best at. The european central bank's
   reference rates for the ~30 currencies it publishes; ExchangeRate-API's
   open rates for the rest of the world (the tenge, the dirham, the naira…).
   Both are based on the euro, so they sit in one table. If one is down,
   the other still answers.                                              */
function loadRates(): Promise<Rates> {
  if (!ratesPromise) {
    const ecb = fetch("https://api.frankfurter.dev/v1/latest?base=EUR")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ecb"))))
      .then((j) => ({ date: j.date as string, rates: { EUR: 1, ...(j.rates as Record<string, number>) } }));
    const world = fetch("https://open.er-api.com/v6/latest/EUR")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("world"))))
      .then((j) => {
        if (j.result !== "success") throw new Error("world");
        return { date: new Date((j.time_last_update_unix as number) * 1000).toISOString().slice(0, 10), rates: j.rates as Record<string, number> };
      });
    ratesPromise = Promise.allSettled([ecb, world]).then(([e, w]) => {
      if (e.status === "rejected" && w.status === "rejected") throw new Error("rates");
      const fromEcb = e.status === "fulfilled" ? e.value : null;
      const fromWorld = w.status === "fulfilled" ? w.value : null;
      return {
        date: fromEcb?.date ?? fromWorld!.date,
        // the central bank's figure wins wherever it has one
        rates: { ...(fromWorld?.rates ?? {}), ...(fromEcb?.rates ?? {}) },
        ecb: new Set(Object.keys(fromEcb?.rates ?? {})),
      };
    });
    ratesPromise.catch(() => (ratesPromise = null));
  }
  return ratesPromise;
}

function Row({
  value,
  onValue,
  unit,
  onUnit,
  options,
  label,
}: {
  value: string;
  onValue: (v: string) => void;
  unit: string;
  onUnit: (u: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-1.5">
      <input
        value={value}
        onChange={(e) => onValue(e.target.value)}
        inputMode="decimal"
        aria-label={label}
        className="field h-10 min-w-0 rounded-[10px] px-3 text-[16px] font-medium text-ink tabular-nums"
      />
      <Select options={options} value={unit} onChange={onUnit} fullWidth />
    </div>
  );
}

export const Converter = memo(function Converter({ data, set }: WidgetProps<ConvertData>) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [rateErr, setRateErr] = useState(false);
  const cat = CATEGORIES.find((c) => c.key === data.cat) ?? CATEGORIES[0];

  useEffect(() => {
    if (cat.key !== "currency" || rates) return;
    loadRates()
      .then(setRates)
      .catch(() => setRateErr(true));
  }, [cat.key, rates]);

  const unitOptions = useMemo(() => {
    if (cat.key === "currency") {
      const codes = rates ? Object.keys(rates.rates).sort() : ["EUR", "USD", "GBP"];
      return codes.map((c) => ({ value: c, label: `${c.toLowerCase()} · ${CURRENCY_NAMES[c] ?? c.toLowerCase()}` }));
    }
    return cat.units.map((u) => ({ value: u.key, label: u.label }));
  }, [cat, rates]);

  // the field you typed in may hold a sum: "3*12" in feet reads as 36 ft
  const typed = evaluate(data.value);
  const out =
    typed === null
      ? null
      : data.side === "from"
        ? convert(cat, data.from, data.to, typed, rates?.rates)
        : convert(cat, data.to, data.from, typed, rates?.rates);
  // money reads to the cent; everything else to eight significant figures
  const shown = out === null ? "" : cat.key === "currency" ? formatNumber(Math.round(out * 100) / 100) : formatNumber(Number(out.toPrecision(8)));

  const fromValue = data.side === "from" ? data.value : shown;
  const toValue = data.side === "to" ? data.value : shown;

  const pickCat = (key: string) => {
    const c = CATEGORIES.find((x) => x.key === key) as Category;
    set({ cat: key, from: c.defaults[0], to: c.defaults[1] }, { key: "cat" });
  };

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      <Select
        options={CATEGORIES.map((c) => ({ value: c.key, label: c.label }))}
        value={cat.key}
        onChange={pickCat}
        fullWidth
      />
      <Row
        label="from"
        value={fromValue}
        onValue={(v) => set({ value: v, side: "from" }, { key: "value" })}
        unit={data.from}
        onUnit={(u) => set({ from: u }, { key: "unit" })}
        options={unitOptions}
      />
      <div className="-my-1 flex justify-center">
        <button
          type="button"
          aria-label="swap units"
          title="swap"
          onClick={() => set({ from: data.to, to: data.from, value: shown || data.value, side: data.side })}
          className="grid h-6 w-6 rotate-90 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
        >
          <IconSwap size={13} />
        </button>
      </div>
      <Row
        label="to"
        value={toValue}
        onValue={(v) => set({ value: v, side: "to" }, { key: "value" })}
        unit={data.to}
        onUnit={(u) => set({ to: u }, { key: "unit" })}
        options={unitOptions}
      />
      <p className="mt-auto text-[12px] leading-[1.45] text-ink-muted">
        {cat.key === "currency"
          ? rateErr
            ? "couldn't fetch today's rates. you might be offline."
            : rates
              ? (
                  <>
                    rates from {rates.date}
                    {[data.from, data.to].every((c) => rates.ecb.has(c)) ? (
                      ", european central bank."
                    ) : (
                      <>
                        , by{" "}
                        <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline decoration-ink-ghost underline-offset-2 hover:text-ink">
                          exchange rate api
                        </a>
                        {rates.ecb.size ? " and the european central bank." : "."}
                      </>
                    )}
                  </>
                )
              : "fetching today's rates…"
          : ""}
      </p>
    </div>
  );
});
