export interface Unit {
  key: string;
  label: string;
  /** multiply by this to get the category's base unit */
  factor?: number;
  toBase?: (v: number) => number;
  fromBase?: (v: number) => number;
}

export interface Category {
  key: string;
  label: string;
  units: Unit[];
  defaults: [string, string];
}

export const CATEGORIES: Category[] = [
  {
    key: "length",
    label: "length",
    defaults: ["km", "mi"],
    units: [
      { key: "mm", label: "millimetres", factor: 0.001 },
      { key: "cm", label: "centimetres", factor: 0.01 },
      { key: "m", label: "metres", factor: 1 },
      { key: "km", label: "kilometres", factor: 1000 },
      { key: "in", label: "inches", factor: 0.0254 },
      { key: "ft", label: "feet", factor: 0.3048 },
      { key: "yd", label: "yards", factor: 0.9144 },
      { key: "mi", label: "miles", factor: 1609.344 },
    ],
  },
  {
    key: "mass",
    label: "weight",
    defaults: ["kg", "lb"],
    units: [
      { key: "g", label: "grams", factor: 0.001 },
      { key: "kg", label: "kilograms", factor: 1 },
      { key: "oz", label: "ounces", factor: 0.028349523125 },
      { key: "lb", label: "pounds", factor: 0.45359237 },
      { key: "st", label: "stone", factor: 6.35029318 },
    ],
  },
  {
    key: "temp",
    label: "temperature",
    defaults: ["c", "f"],
    units: [
      { key: "c", label: "celsius", toBase: (v) => v, fromBase: (v) => v },
      { key: "f", label: "fahrenheit", toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { key: "k", label: "kelvin", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    ],
  },
  {
    key: "volume",
    label: "volume",
    defaults: ["l", "gal"],
    units: [
      { key: "ml", label: "millilitres", factor: 0.001 },
      { key: "l", label: "litres", factor: 1 },
      { key: "tsp", label: "teaspoons", factor: 0.00492892 },
      { key: "tbsp", label: "tablespoons", factor: 0.0147868 },
      { key: "cup", label: "cups (us)", factor: 0.24 },
      { key: "floz", label: "fluid ounces (us)", factor: 0.0295735 },
      { key: "gal", label: "gallons (us)", factor: 3.78541 },
    ],
  },
  {
    key: "speed",
    label: "speed",
    defaults: ["kmh", "mph"],
    units: [
      { key: "ms", label: "metres / second", factor: 1 },
      { key: "kmh", label: "km / hour", factor: 1 / 3.6 },
      { key: "mph", label: "miles / hour", factor: 0.44704 },
      { key: "kn", label: "knots", factor: 0.514444 },
    ],
  },
  {
    key: "data",
    label: "data",
    defaults: ["gb", "mb"],
    units: [
      { key: "kb", label: "kilobytes", factor: 1e3 },
      { key: "mb", label: "megabytes", factor: 1e6 },
      { key: "gb", label: "gigabytes", factor: 1e9 },
      { key: "tb", label: "terabytes", factor: 1e12 },
      { key: "kib", label: "kibibytes", factor: 1024 },
      { key: "mib", label: "mebibytes", factor: 1024 ** 2 },
      { key: "gib", label: "gibibytes", factor: 1024 ** 3 },
    ],
  },
  {
    key: "currency",
    label: "money",
    defaults: ["USD", "EUR"],
    // filled from today's rates when the widget mounts
    units: [],
  },
];

export function convert(cat: Category, from: string, to: string, v: number, rates?: Record<string, number>) {
  if (cat.key === "currency") {
    if (!rates || !rates[from] || !rates[to]) return null;
    return (v / rates[from]) * rates[to];
  }
  const a = cat.units.find((u) => u.key === from);
  const b = cat.units.find((u) => u.key === to);
  if (!a || !b) return null;
  const base = a.toBase ? a.toBase(v) : v * (a.factor ?? 1);
  return b.fromBase ? b.fromBase(base) : base / (b.factor ?? 1);
}

export const CURRENCY_NAMES: Record<string, string> = {
  USD: "us dollar",
  EUR: "euro",
  GBP: "pound sterling",
  JPY: "japanese yen",
  CNY: "chinese yuan",
  CHF: "swiss franc",
  CAD: "canadian dollar",
  AUD: "australian dollar",
  INR: "indian rupee",
  KRW: "south korean won",
  TRY: "turkish lira",
  BRL: "brazilian real",
  MXN: "mexican peso",
  SEK: "swedish krona",
  NOK: "norwegian krone",
  DKK: "danish krone",
  PLN: "polish złoty",
  CZK: "czech koruna",
  HUF: "hungarian forint",
  ILS: "israeli shekel",
  HKD: "hong kong dollar",
  SGD: "singapore dollar",
  NZD: "new zealand dollar",
  ZAR: "south african rand",
  THB: "thai baht",
  IDR: "indonesian rupiah",
  MYR: "malaysian ringgit",
  PHP: "philippine peso",
  ISK: "icelandic króna",
  RON: "romanian leu",
  BGN: "bulgarian lev",
};
