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

let ratesPromise: Promise<{ date: string; rates: Record<string, number> }> | null = null;
function loadRates() {
  if (!ratesPromise) {
    ratesPromise = fetch("https://api.frankfurter.dev/v1/latest?base=EUR")
      .then((r) => {
        if (!r.ok) throw new Error("rates");
        return r.json();
      })
      .then((j) => ({ date: j.date as string, rates: { EUR: 1, ...(j.rates as Record<string, number>) } }))
      .catch((e) => {
        ratesPromise = null;
        throw e;
      });
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
  const [rates, setRates] = useState<{ date: string; rates: Record<string, number> } | null>(null);
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
              ? `rates from ${rates.date}, european central bank.`
              : "fetching today's rates…"
          : ""}
      </p>
    </div>
  );
});
