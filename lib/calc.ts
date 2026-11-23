/* A small recursive-descent evaluator, so the calculator never calls eval.
   Grammar:  expr    := term (('+'|'-') term)*
             term    := power (('*'|'/') power | power)*     (the bare one is "2π", "3(4+1)")
             power   := unary ('^' power)?
             unary   := '-' unary | postfix
             postfix := atom ('%' | '!')*
             atom    := number | constant | fn atom | '(' expr ')'
   "200 + 10%" reads the way a till does: 220, not 200.1.
   Trigonometry follows `deg`: sin(30) is ½ in degrees, sin(π/6) in radians. */

type Val = { v: number; pct: boolean };

export interface EvalOptions {
  /** angles in degrees rather than radians */
  deg?: boolean;
  /** the last answer, for "ans" */
  ans?: number;
}

function factorial(n: number) {
  if (n < 0 || !Number.isFinite(n)) return NaN;
  if (Number.isInteger(n)) {
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }
  // Γ(n+1): climb past 10 with Γ(x) = Γ(x+1)/x, then Stirling's series, good to ~15 digits
  let x = n + 1;
  let shift = 1;
  while (x < 10) {
    shift *= x;
    x += 1;
  }
  const lg =
    (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) +
    1 / (12 * x) - 1 / (360 * x ** 3) + 1 / (1260 * x ** 5) - 1 / (1680 * x ** 7);
  return Math.exp(lg) / shift;
}

/** Tidy the float dust off results that should be whole: sin(180°) is 0, not 1.2e-16. */
function snap(v: number) {
  const r = Math.round(v);
  return Math.abs(v - r) < 1e-12 ? r : v;
}

export function evaluate(src: string, opts: EvalOptions = {}): number | null {
  const s = src
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/−/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .toLowerCase();
  if (!s) return null;
  const toRad = (x: number) => (opts.deg ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (opts.deg ? (x * 180) / Math.PI : x);

  const FNS: Record<string, (x: number) => number> = {
    asinh: Math.asinh,
    acosh: Math.acosh,
    atanh: Math.atanh,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
    sin: (x) => snap(Math.sin(toRad(x))),
    cos: (x) => snap(Math.cos(toRad(x))),
    tan: (x) => snap(Math.tan(toRad(x))),
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    "√": Math.sqrt,
    "∛": Math.cbrt,
    exp: Math.exp,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
  };
  // longest names first, so "asinh" never reads as "a" + "sinh"
  const fnNames = Object.keys(FNS).sort((a, b) => b.length - a.length);

  let i = 0;
  const peek = () => s[i];
  const eat = (c: string) => {
    if (s[i] === c) {
      i++;
      return true;
    }
    return false;
  };
  const startsAtom = () => {
    const c = s[i];
    return c !== undefined && /[\d.(πe√∛a-z]/.test(c);
  };

  function expr(): Val {
    let left = term();
    for (;;) {
      if (eat("+")) {
        const r = term();
        left = { v: r.pct ? left.v + left.v * r.v : left.v + r.v, pct: false };
      } else if (eat("-")) {
        const r = term();
        left = { v: r.pct ? left.v - left.v * r.v : left.v - r.v, pct: false };
      } else return left;
    }
  }

  function term(): Val {
    let left = power();
    for (;;) {
      const c = peek();
      if (c === "*") {
        i++;
        left = { v: left.v * power().v, pct: false };
      } else if (c === "/") {
        i++;
        left = { v: left.v / power().v, pct: false };
      } else if (startsAtom()) {
        left = { v: left.v * power().v, pct: false };
      } else return left;
    }
  }

  function power(): Val {
    const base = unary();
    if (eat("^")) {
      const exp = power();
      return { v: Math.pow(base.v, exp.v), pct: false };
    }
    return base;
  }

  function unary(): Val {
    if (eat("-")) {
      const u = unary();
      return { v: -u.v, pct: u.pct };
    }
    if (eat("+")) return unary();
    return postfix();
  }

  function postfix(): Val {
    let a = atom();
    for (;;) {
      if (eat("%")) a = { v: a.v / 100, pct: true };
      else if (eat("!")) a = { v: factorial(a.v), pct: false };
      else return a;
    }
  }

  function atom(): Val {
    if (eat("(")) {
      const v = expr();
      eat(")"); // forgive a missing close bracket at the end
      return { v: v.v, pct: false };
    }
    const rest = s.slice(i);
    const fn = fnNames.find((k) => rest.startsWith(k));
    if (fn) {
      i += fn.length;
      const arg = postfixAtom();
      return { v: FNS[fn](arg), pct: false };
    }
    if (rest.startsWith("ans")) {
      i += 3;
      return { v: opts.ans ?? 0, pct: false };
    }
    if (rest.startsWith("pi") || rest.startsWith("π")) {
      i += rest.startsWith("pi") ? 2 : 1;
      return { v: Math.PI, pct: false };
    }
    const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(rest);
    if (m) {
      i += m[0].length;
      return { v: parseFloat(m[0]), pct: false };
    }
    if (rest.startsWith("e")) {
      i += 1;
      return { v: Math.E, pct: false };
    }
    throw new Error("unexpected");
  }

  /** a function's argument: "sin 30", "√2", "sin(30)²" all read naturally */
  function postfixAtom(): number {
    const a = atom();
    let v = a.v;
    while (eat("!")) v = factorial(v);
    return v;
  }

  try {
    const out = expr();
    if (i !== s.length) return null;
    return Number.isFinite(out.v) ? out.v : null;
  } catch {
    return null;
  }
}

export function formatNumber(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e15 || abs < 1e-9)) return n.toExponential(8).replace(/\.?0+e/, "e");
  const rounded = Math.round(n * 1e10) / 1e10;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 10 });
}
