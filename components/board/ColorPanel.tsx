"use client";

import { ColorPicker } from "@blurrow/ui";
import { PALETTE, swatchColor } from "@/lib/colors";

export interface ColorOption {
  value: string;
  label: string;
}

function Swatch({ fill, on, label, onClick }: { fill: string; on: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full cursor-pointer transition-transform duration-200 hover:-translate-y-px"
      style={{ transitionTimingFunction: "var(--ease-spring)" }}
    >
      <span
        className="block h-[22px] w-[22px] rounded-full"
        style={{
          background: fill,
          boxShadow: on
            ? "0 0 0 2px var(--panel-face), 0 0 0 3.5px var(--ink-label)"
            : "inset 0 0 0 0.5px rgba(0,0,0,.14), inset 0 1px 1px rgba(255,255,255,.3)",
        }}
      />
    </button>
  );
}

/* The colours for one kind of thing: its own named choices first (graphite
   for lines, papers for stickies), then the shared palette, then a last
   swatch that opens the system picker for any colour at all.          */
export function ColorPanel({
  title,
  value,
  onChange,
  base,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  base: ColorOption[];
}) {
  const options: ColorOption[] = [...base, ...PALETTE.map((hex) => ({ value: hex, label: hex }))];
  const isCustom = value.startsWith("#") && !PALETTE.includes(value.toLowerCase());
  return (
    <div className="px-1.5 pt-1 pb-1.5">
      <div className="px-1 pt-1 pb-1.5 text-[11.5px] font-medium text-ink-faint">{title}</div>
      <div
        role="radiogroup"
        aria-label={title}
        className="grid justify-items-center gap-0.5"
        style={{ gridTemplateColumns: `repeat(${colorColumns(base.length)}, 32px)` }}
      >
        {options.map((o) => (
          <Swatch
            key={o.value}
            fill={swatchColor(o.value)}
            on={o.value.toLowerCase() === value.toLowerCase()}
            label={o.label}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
      {/* any other colour: the kit's own picker, a field that opens its panel */}
      <div className="mt-2 border-t border-[var(--divider)] px-0.5 pt-2.5">
        <ColorPicker
          value={value.startsWith("#") ? value : PALETTE[0]}
          onChange={onChange}
          swatches={[]}
          fullWidth
          label={isCustom ? "your colour" : "any colour"}
        />
      </div>
    </div>
  );
}

/** two even rows: the named choices, the palette, and the any-colour swatch */
export function colorColumns(baseCount: number) {
  return Math.max(5, Math.ceil((baseCount + PALETTE.length) / 2));
}

/** the flyout width that fits a panel exactly */
export function colorPanelWidth(baseCount: number) {
  const cols = colorColumns(baseCount);
  return cols * 32 + (cols - 1) * 2 + 12 + 8 + 10;
}

export const PAPERS: ColorOption[] = [
  { value: "plain", label: "plain paper" },
  { value: "amber", label: "amber paper" },
  { value: "mint", label: "mint paper" },
  { value: "lilac", label: "lilac paper" },
  { value: "rose", label: "rose paper" },
];

export const GRAPHITE: ColorOption[] = [{ value: "ink", label: "graphite, follows the theme" }];
