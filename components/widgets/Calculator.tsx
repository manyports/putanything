"use client";

import { memo, useRef } from "react";
import { evaluate, formatNumber } from "@/lib/calc";
import { updateItem } from "@/lib/store";
import { MiniSwitch, type WidgetProps } from "./parts";

export interface CalcData {
  expr: string;
  tape: { expr: string; result: string }[];
  /** the display holds an answer; the next digit starts a new sum */
  done?: boolean;
  /** "basic" keypad, or the scientific one beside it */
  mode?: "basic" | "sci";
  /** angles in radians; degrees otherwise */
  rad?: boolean;
  /** second function: inverse trig, eˣ, 10ˣ, ∛, x³ */
  second?: boolean;
  /** the last answer, for "ans" */
  ans?: number;
}

type Kind = "digit" | "op" | "fn" | "eq" | "sci";
type Key = { k: string; label?: string; kind: Kind; aria?: string };

const BASIC: Key[] = [
  { k: "C", kind: "fn", aria: "clear" },
  { k: "⌫", kind: "fn", aria: "delete" },
  { k: "%", kind: "fn", aria: "percent" },
  { k: "÷", kind: "op", aria: "divide" },
  { k: "7", kind: "digit" },
  { k: "8", kind: "digit" },
  { k: "9", kind: "digit" },
  { k: "×", kind: "op", aria: "multiply" },
  { k: "4", kind: "digit" },
  { k: "5", kind: "digit" },
  { k: "6", kind: "digit" },
  { k: "−", kind: "op", aria: "minus" },
  { k: "1", kind: "digit" },
  { k: "2", kind: "digit" },
  { k: "3", kind: "digit" },
  { k: "+", kind: "op", aria: "plus" },
  { k: "()", kind: "fn", aria: "brackets" },
  { k: "0", kind: "digit" },
  { k: ".", kind: "digit", aria: "point" },
  { k: "=", kind: "eq", aria: "equals" },
];

/* Fifteen scientific keys in three columns beside the keypad, one row per
   keypad row. With 2nd on, the top keys become their inverses, the way a
   real calculator's shift key works, and it lets go after one use.      */
function sciKeys(second: boolean): Key[] {
  return [
    { k: "2nd", kind: "sci", aria: "second function" },
    second ? { k: "e^(", label: "eˣ", kind: "sci" } : { k: "ln(", label: "ln", kind: "sci" },
    second ? { k: "10^(", label: "10ˣ", kind: "sci" } : { k: "log(", label: "log", kind: "sci" },
    second ? { k: "asin(", label: "sin⁻¹", kind: "sci" } : { k: "sin(", label: "sin", kind: "sci" },
    second ? { k: "acos(", label: "cos⁻¹", kind: "sci" } : { k: "cos(", label: "cos", kind: "sci" },
    second ? { k: "atan(", label: "tan⁻¹", kind: "sci" } : { k: "tan(", label: "tan", kind: "sci" },
    second ? { k: "^3", label: "x³", kind: "sci" } : { k: "^2", label: "x²", kind: "sci" },
    { k: "^", label: "xʸ", kind: "sci", aria: "to the power of" },
    second ? { k: "∛(", label: "∛", kind: "sci" } : { k: "√(", label: "√", kind: "sci" },
    { k: "^(-1)", label: "1/x", kind: "sci", aria: "reciprocal" },
    { k: "!", label: "x!", kind: "sci", aria: "factorial" },
    { k: "±", kind: "sci", aria: "change sign" },
    { k: "π", kind: "sci", aria: "pi" },
    { k: "e", kind: "sci", aria: "e" },
    { k: "ans", kind: "sci", aria: "last answer" },
  ];
}

const OPS = "+−×÷^";
/** how much wider the plate gets for the scientific columns */
const SCI_EXTRA_W = 190;

export const Calculator = memo(function Calculator({ data, set }: WidgetProps<CalcData>) {
  const tapeRef = useRef<HTMLDivElement>(null);
  const expr = data.expr;
  const sci = data.mode === "sci";
  const opts = { deg: !data.rad, ans: data.ans };
  const preview = expr ? evaluate(expr, opts) : null;
  const lastIsOp = OPS.includes(expr.slice(-1));

  const write = (next: string, extra: Partial<CalcData> = {}) => set({ expr: next, done: false, ...extra }, { key: "expr" });

  const press = (k: string) => {
    if (k === "C") return write("");
    if (k === "⌫") {
      // a function name goes in one press, not letter by letter
      const fn = /(asin|acos|atan|sin|cos|tan|ln|log|√|∛|e\^|10\^)\($/.exec(expr) ?? /ans$/.exec(expr);
      return write(fn ? expr.slice(0, -fn[0].length) : expr.slice(0, -1));
    }
    if (k === "2nd") return set({ second: !data.second }, { history: false });
    if (k === "=") {
      const v = evaluate(expr, opts);
      if (v === null) return;
      const result = formatNumber(v).replace(/,/g, "");
      // the tape shows the sum the way it was worked out, brackets closed
      const unclosed = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
      const shown = expr + ")".repeat(Math.max(0, unclosed));
      set(
        { expr: result, done: true, ans: v, second: false, tape: [...data.tape, { expr: shown, result: formatNumber(v) }].slice(-60) },
        { key: `eq:${data.tape.length}` },
      );
      requestAnimationFrame(() => tapeRef.current?.scrollTo({ top: 1e6 }));
      return;
    }
    if (k === "±") {
      // flip the sign of the number being typed
      const m = /(-?)(\d*\.?\d+)$/.exec(expr);
      if (!m) return write(`-${expr}`);
      return write(expr.slice(0, m.index) + (m[1] ? "" : "-") + m[2]);
    }
    if (k === "()") {
      const open = (expr.match(/\(/g) || []).length;
      const close = (expr.match(/\)/g) || []).length;
      const prev = expr.slice(-1);
      const wantsClose = open > close && /[\d).%!πe]/.test(prev);
      return write(expr + (wantsClose ? ")" : /[\d).%!πe]/.test(prev) ? "×(" : "("));
    }
    if (OPS.includes(k)) {
      if (!expr && k !== "−") return write(`0${k}`);
      if (lastIsOp) return write(expr.slice(0, -1) + k);
      return write(expr + k);
    }
    if (data.done && (/^\d$/.test(k) || k === ".")) return write(k === "." ? "0." : k);
    if (k === ".") {
      const tail = expr.split(/[+−×÷^()]/).pop() ?? "";
      if (tail.includes(".")) return;
      return write(expr + (tail === "" ? "0." : "."));
    }
    // a function or constant after an answer starts a new sum; a power or ! carries on from it
    const continues = k.startsWith("^") || k === "!" || k === "%";
    const base = data.done && !continues ? "" : expr;
    write(base + k, k.length > 1 && data.second ? { second: false } : {});
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const map: Record<string, string> = {
      "*": "×",
      x: "×",
      "/": "÷",
      "-": "−",
      "+": "+",
      "^": "^",
      "%": "%",
      "!": "!",
      ".": ".",
      ",": ".",
      Enter: "=",
      "=": "=",
      Backspace: "⌫",
      Escape: "C",
      Delete: "C",
      "(": "(",
      ")": ")",
      p: "π",
      s: "sin(",
      c: "cos(",
      t: "tan(",
      l: "ln(",
      r: "√(",
    };
    const k = /^\d$/.test(e.key) ? e.key : map[e.key];
    if (!k) return;
    e.preventDefault();
    e.stopPropagation();
    press(k);
  };

  const keyClass = (kind: Kind) =>
    [
      "h-10 rounded-[10px] tabular-nums cursor-pointer transition-colors select-none",
      kind === "eq"
        ? "text-[16px] text-ink-inverse"
        : kind === "digit"
          ? "text-[16px] text-ink hover:bg-surface-hover active:bg-surface-active"
          : kind === "op"
            ? "text-[16px] text-ink-label hover:bg-surface-hover active:bg-surface-active"
            : kind === "sci"
              ? "text-[13px] font-medium text-ink-muted hover:bg-surface-hover hover:text-ink active:bg-surface-active"
              : "text-[14px] text-ink-faint hover:bg-surface-hover hover:text-ink-label active:bg-surface-active",
    ].join(" ");

  return (
    <div tabIndex={0} data-keys onKeyDown={onKeyDown} className="flex h-full flex-col gap-1 p-2 outline-none">
      <div className="calc-display flex min-h-0 flex-1 flex-col px-2.5 pt-1.5 pb-2">
        <div ref={tapeRef} data-scrollable className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          {data.tape.map((t, i) => (
            <button
              key={i}
              type="button"
              title="use this result"
              onClick={() => write(t.result.replace(/,/g, ""))}
              className="flex w-full justify-end gap-1.5 text-right text-[12px] leading-[1.7] text-ink-faint hover:text-ink-label tabular-nums cursor-pointer"
            >
              <span className="truncate">{t.expr}</span>
              <span>=</span>
              <span className="text-ink-muted">{t.result}</span>
            </button>
          ))}
        </div>
        <div className="flex min-h-[20px] items-center justify-between gap-2 text-[13px] text-ink-muted tabular-nums" aria-live="polite">
          <span className="flex gap-1.5 text-[11px] font-medium text-ink-faint">
            {sci && <span>{data.rad ? "rad" : "deg"}</span>}
            {sci && data.second && <span className="text-accent-soft">2nd</span>}
          </span>
          <span className="truncate">
            {expr && preview !== null && expr.replace(/,/g, "") !== String(preview) ? `= ${formatNumber(preview)}` : ""}
          </span>
        </div>
        <div className="truncate text-right text-[28px] font-medium leading-tight tracking-[-0.03em] text-ink tabular-nums">
          {expr || "0"}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-[var(--divider)] pt-1.5">
        {sci && (
          <div className="grid shrink-0 grid-cols-3 gap-0.5" style={{ width: SCI_EXTRA_W - 8 }}>
            {sciKeys(!!data.second).map((key) => (
              <button
                key={key.k}
                type="button"
                aria-label={key.aria ?? key.label ?? key.k}
                aria-pressed={key.k === "2nd" ? !!data.second : undefined}
                onClick={() => press(key.k)}
                className={[keyClass("sci"), key.k === "2nd" && data.second ? "bg-surface-active text-ink!" : ""].join(" ")}
              >
                {key.label ?? key.k}
              </button>
            ))}
          </div>
        )}
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-0.5">
          {BASIC.map((key) => (
            <button
              key={key.k}
              type="button"
              aria-label={key.aria ?? key.k}
              onClick={() => press(key.k)}
              className={keyClass(key.kind)}
              style={key.kind === "eq" ? { background: "var(--face-inverse)", boxShadow: "var(--face-inverse-shadow)" } : undefined}
            >
              {key.k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

/* The plate's keys: basic or scientific (the plate widens to fit), and,
   when scientific, whether angles are degrees or radians.              */
export function CalculatorRail({ id, data, set }: WidgetProps<CalcData>) {
  const sci = data.mode === "sci";
  return (
    <>
      {sci && (
        <MiniSwitch
          label="angles"
          value={data.rad ? "rad" : "deg"}
          options={[
            { value: "deg", label: "deg" },
            { value: "rad", label: "rad" },
          ]}
          onChange={(v) => set({ rad: v === "rad" }, { key: "rad" })}
        />
      )}
      <MiniSwitch
        label="keypad"
        value={sci ? "sci" : "basic"}
        options={[
          { value: "basic", label: "basic" },
          { value: "sci", label: "sci" },
        ]}
        onChange={(v) => {
          if ((v === "sci") === sci) return;
          set({ mode: v as "basic" | "sci", second: false }, { key: "mode" });
          updateItem(id, (i) => ({ ...i, w: Math.max(240, i.w + (v === "sci" ? SCI_EXTRA_W : -SCI_EXTRA_W)) }), `mode:${id}`);
        }}
      />
    </>
  );
}
