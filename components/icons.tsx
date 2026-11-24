import type { SVGProps } from "react";

/* putanything's own marks. Drawn on a 20px grid like markings on an
   instrument: square-cut ends, sharp corners, and a soft wash of ink in
   the body of each thing, so it reads as an object, not an outline.  */

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeMiterlimit={3}
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** the wash: an object's body, lightly inked */
const W = ({ d }: { d: string }) => <path d={d} fill="currentColor" fillOpacity={0.16} stroke="none" />;
/** a solid mark: a dot, a pin, a tick */
const S = ({ d }: { d: string }) => <path d={d} fill="currentColor" stroke="none" />;

/* ── tools ─────────────────────────────────────────────────────── */
export const IconSelect = (p: P) => (
  <Svg {...p}>
    <W d="M4.5 3.5l10 5.3-4.4 1.3-1.6 4.4z" />
    <path d="M4.5 3.5l10 5.3-4.4 1.3-1.6 4.4z" />
    <path d="M11 11.2l3.6 3.6" />
  </Svg>
);
export const IconHand = (p: P) => (
  <Svg {...p}>
    <W d="M6 11.4V5.2h2.4v4-5.4h2.4v5.4-4.6h2.4v4.8-2.4h2.3v5.5c0 3-2 5-5 5H9.6c-1.7 0-3-.7-4-2.1L3.4 11.6l1.5-1.2z" />
    <path d="M6 11.4V5.2h2.4v4M8.4 9.2V3.8h2.4v5.4M10.8 9.2V4.6h2.4v4.8M13.2 9.4V7h2.3v5.5c0 3-2 5-5 5H9.6c-1.7 0-3-.7-4-2.1L3.4 11.6l1.5-1.2L6 11.4" />
  </Svg>
);
export const IconPen = (p: P) => (
  <Svg {...p}>
    <W d="M4 16l.9-3.4 8.6-8.6 2.5 2.5-8.6 8.6z" />
    <path d="M4 16l.9-3.4 8.6-8.6 2.5 2.5-8.6 8.6z" />
    <path d="M11.6 5.9l2.5 2.5" />
    <S d="M3.2 16.8l1.6-.4-1.2-1.2z" />
  </Svg>
);
export const IconArrow = (p: P) => (
  <Svg {...p}>
    <path d="M4 16L14.4 5.6" />
    <S d="M16.5 3.5l-1.4 6.1-4.7-4.7z" />
  </Svg>
);
export const IconText = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 5.5V4h11v1.5M10 4v12M7.5 16h5" />
  </Svg>
);
export const IconEraser = (p: P) => (
  <Svg {...p}>
    <W d="M7.2 16l-3.7-3.7 7.4-7.4 4.6 4.6L9.6 16z" />
    <path d="M7.2 16l-3.7-3.7 7.4-7.4 4.6 4.6L9.6 16z" />
    <path d="M6.2 9.8l4 4M9.6 16h7" />
  </Svg>
);
export const IconShapes = (p: P) => (
  <Svg {...p}>
    <W d="M3.5 3.5h7v7h-7z" />
    <path d="M3.5 3.5h7v7h-7z" />
    <circle cx="13.2" cy="13.2" r="3.6" fill="currentColor" fillOpacity={0.16} />
  </Svg>
);
export const IconRect = (p: P) => (
  <Svg {...p}>
    <W d="M3.5 5h13v10h-13z" />
    <path d="M3.5 5h13v10h-13z" />
  </Svg>
);
export const IconEllipse = (p: P) => (
  <Svg {...p}>
    <ellipse cx="10" cy="10" rx="7" ry="5.5" fill="currentColor" fillOpacity={0.16} />
  </Svg>
);
export const IconDiamond = (p: P) => (
  <Svg {...p}>
    <W d="M10 2.8l7.2 7.2-7.2 7.2L2.8 10z" />
    <path d="M10 2.8l7.2 7.2-7.2 7.2L2.8 10z" />
  </Svg>
);
export const IconTriangle = (p: P) => (
  <Svg {...p}>
    <W d="M10 3.5l7 12.5H3z" />
    <path d="M10 3.5l7 12.5H3z" />
  </Svg>
);
export const IconFillNone = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" />
  </Svg>
);
export const IconFillTint = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" fill="currentColor" fillOpacity={0.28} />
  </Svg>
);
export const IconFillSolid = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="6" fill="currentColor" />
  </Svg>
);

/* ── widgets ───────────────────────────────────────────────────── */
export const IconSticky = (p: P) => (
  <Svg {...p}>
    <W d="M4 4h12v8l-4 4H4z" />
    <path d="M4 4h12v8l-4 4H4z" />
    <path d="M12 16v-4h4" />
    <S d="M4 4h12v2H4z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <W d="M3.5 3.5h13v13h-13z" />
    <path d="M3.5 3.5h13v13h-13z" />
    <path d="M6.8 10.2l2.2 2.2 4.4-4.6" />
  </Svg>
);
export const IconTable = (p: P) => (
  <Svg {...p}>
    <W d="M3 4h14v3.5H3z" />
    <path d="M3 4h14v12H3zM3 7.5h14M3 11.8h14M8.2 7.5V16" />
  </Svg>
);
export const IconTableHeader = (p: P) => (
  <Svg {...p}>
    <S d="M3 4h14v3.8H3z" />
    <path d="M3 4h14v12H3zM3 12h14M8.2 7.8V16" />
  </Svg>
);
export const IconCalc = (p: P) => (
  <Svg {...p}>
    <W d="M4.5 2.5h11v15h-11z" />
    <path d="M4.5 2.5h11v15h-11z" />
    <S d="M6.5 4.5h7v3h-7z" />
    <S d="M6.5 10h2v2h-2zM9 10h2v2H9zM11.5 10h2v2h-2zM6.5 13h2v2h-2zM9 13h2v2H9zM11.5 13h2v2h-2z" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" fill="currentColor" fillOpacity={0.16} />
    <path d="M10 5.8V10l2.8 1.8" />
    <S d="M9.3 2.2h1.4v1.6H9.3z" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="3.4" fill="currentColor" fillOpacity={0.16} />
    <path d="M10 2v1.8M10 16.2V18M2 10h1.8M16.2 10H18M4.3 4.3l1.3 1.3M14.4 14.4l1.3 1.3M4.3 15.7l1.3-1.3M14.4 5.6l1.3-1.3" />
  </Svg>
);
export const IconMoon = (p: P) => (
  <Svg {...p}>
    <W d="M15.8 12.4A6.5 6.5 0 017.6 4.2a6.5 6.5 0 108.2 8.2z" />
    <path d="M15.8 12.4A6.5 6.5 0 017.6 4.2a6.5 6.5 0 108.2 8.2z" />
  </Svg>
);
export const IconMonitor = (p: P) => (
  <Svg {...p}>
    <W d="M2.5 3.5h15v10h-15z" />
    <path d="M2.5 3.5h15v10h-15zM7 17h6M10 13.5V17" />
  </Svg>
);
export const IconBook = (p: P) => (
  <Svg {...p}>
    <W d="M3 4.5h5.5c.8 0 1.5.7 1.5 1.5v10c0-.8-.7-1.5-1.5-1.5H3z" />
    <path d="M3 4.5h5.5c.8 0 1.5.7 1.5 1.5v10c0-.8-.7-1.5-1.5-1.5H3zM17 4.5h-5.5c-.8 0-1.5.7-1.5 1.5v10c0-.8.7-1.5 1.5-1.5H17z" />
  </Svg>
);
export const IconTimer = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="11" r="6.2" fill="currentColor" fillOpacity={0.16} />
    <path d="M10 7.6V11l2.2 1.4M8 2.5h4M10 2.5v2.3M15.2 5.4l1.2-1.2" />
  </Svg>
);
export const IconSwap = (p: P) => (
  <Svg {...p}>
    <path d="M6 7h10M4 13h10" />
    <S d="M3 7l4-3.5v7zM17 13l-4 3.5v-7z" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <W d="M3 4.5h14v12H3z" />
    <path d="M3 4.5h14v12H3zM3 8.5h14M6.5 2.5v3.5M13.5 2.5v3.5" />
    <S d="M12 11h3v3h-3z" />
  </Svg>
);
export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 11.5l3-3M10.8 6.3l1.7-1.7a3 3 0 014.2 4.2L15 10.5M9.2 13.7l-1.7 1.7a3 3 0 01-4.2-4.2L5 9.5" />
  </Svg>
);
export const IconImage = (p: P) => (
  <Svg {...p}>
    <W d="M2.5 4h15v12h-15z" />
    <path d="M2.5 4h15v12h-15z" />
    <S d="M2.5 16l4.8-5.4 3 3.2 2.2-2.2 5 4.4z" />
    <circle cx="13.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconBell = (p: P) => (
  <Svg {...p}>
    <W d="M5 13.5V9a5 5 0 0110 0v4.5l1.5 1.5h-13z" />
    <path d="M5 13.5V9a5 5 0 0110 0v4.5l1.5 1.5h-13z" />
    <S d="M8 16.5h4v1.5H8z" />
  </Svg>
);
export const IconSpeaker = (p: P) => (
  <Svg {...p}>
    <S d="M3 7.5h3l4-3.5v12l-4-3.5H3z" />
    <path d="M13 7.5a3.5 3.5 0 010 5M15.2 5.3a6.6 6.6 0 010 9.4" />
  </Svg>
);

/* ── actions ───────────────────────────────────────────────────── */
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M10 4v12M4 10h12" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M4 10h12" />
  </Svg>
);
export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M5 5l10 10M15 5L5 15" />
  </Svg>
);
export const IconPlay = (p: P) => (
  <Svg {...p}>
    <S d="M6 3.8v12.4L16 10z" />
  </Svg>
);
export const IconPause = (p: P) => (
  <Svg {...p}>
    <S d="M5.5 4h3.2v12H5.5zM11.3 4h3.2v12h-3.2z" />
  </Svg>
);
export const IconReset = (p: P) => (
  <Svg {...p}>
    <path d="M4.2 10a5.8 5.8 0 101.8-4.2" />
    <S d="M3 3.2v5.6h5.6z" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M15.6 9a5.8 5.8 0 00-10.4-2.6M4.4 11a5.8 5.8 0 0010.4 2.6" />
    <S d="M16.6 3.4v5.2h-5.2zM3.4 16.6v-5.2h5.2z" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M6 8.5h6a4 4 0 010 8H9" />
    <S d="M2.5 8.5L7 4.5v8z" />
  </Svg>
);
export const IconRedo = (p: P) => (
  <Svg {...p}>
    <path d="M14 8.5H8a4 4 0 000 8h3" />
    <S d="M17.5 8.5L13 4.5v8z" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="8.5" cy="8.5" r="5" fill="currentColor" fillOpacity={0.16} />
    <path d="M12.4 12.4l4.1 4.1" strokeWidth={2} />
  </Svg>
);
export const IconExternal = (p: P) => (
  <Svg {...p}>
    <path d="M9 4H4v12h12v-5M10 10l5-5" />
    <S d="M17 3v5.5L11.5 3z" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 12.5v-9h9" />
    <W d="M7 7h9.5v9.5H7z" />
    <path d="M7 7h9.5v9.5H7z" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <W d="M5 6h10l-.8 10.5H5.8z" />
    <path d="M5 6h10l-.8 10.5H5.8zM3.5 6h13M8 6V3.5h4V6" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M10 3v7.5" />
    <S d="M10 14l-4.5-4.5h9z" />
    <path d="M3.5 16.5h13" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M10 14.5V7" />
    <S d="M10 3.5l4.5 4.5h-9z" />
    <path d="M3.5 16.5h13" />
  </Svg>
);
export const IconKeyboard = (p: P) => (
  <Svg {...p}>
    <W d="M2 5h16v10H2z" />
    <path d="M2 5h16v10H2z" />
    <S d="M4.5 7.5h1.6v1.6H4.5zM7.4 7.5H9v1.6H7.4zM10.3 7.5h1.6v1.6h-1.6zM13.2 7.5h1.6v1.6h-1.6zM6 11.3h8v1.4H6z" />
  </Svg>
);
export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h8" />
  </Svg>
);
export const IconFit = (p: P) => (
  <Svg {...p}>
    <path d="M3 7.5V3h4.5M12.5 3H17v4.5M17 12.5V17h-4.5M7.5 17H3v-4.5" />
    <W d="M6.5 6.5h7v7h-7z" />
  </Svg>
);
export const IconGrip = (p: P) => (
  <Svg {...p}>
    <path d="M16 9l-7 7M16 13l-3 3" />
  </Svg>
);
export const IconChevron = (p: P) => (
  <Svg {...p}>
    <path d="M5 8l5 5 5-5" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M16 10H7" />
    <S d="M3 10l5-4.5v9z" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 10h9" />
    <S d="M17 10l-5-4.5v9z" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 8.5V6.5a3.5 3.5 0 017 0v2" />
    <S d="M4 8.5h12v8.5H4z" />
  </Svg>
);
export const IconUnlock = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 8.5V6.5a3.5 3.5 0 016.6-1.6" />
    <W d="M4 8.5h12v8.5H4z" />
    <path d="M4 8.5h12v8.5H4z" />
  </Svg>
);

/* ── type and arranging ────────────────────────────────────────── */
export const IconAlignLeft = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 5h13M3.5 8.3h8M3.5 11.6h13M3.5 14.9h8" />
  </Svg>
);
export const IconAlignCenter = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 5h13M6 8.3h8M3.5 11.6h13M6 14.9h8" />
  </Svg>
);
export const IconAlignRight = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 5h13M8.5 8.3h8M3.5 11.6h13M8.5 14.9h8" />
  </Svg>
);
/* edges: the line where things meet, solid blocks for the things */
export const IconAlign = ({ dir, ...p }: P & { dir: "left" | "center" | "right" | "top" | "middle" | "bottom" }) => {
  const v = dir === "left" || dir === "center" || dir === "right";
  const line = v
    ? dir === "left"
      ? "M4 3v14"
      : dir === "right"
        ? "M16 3v14"
        : "M10 3v14"
    : dir === "top"
      ? "M3 4h14"
      : dir === "bottom"
        ? "M3 16h14"
        : "M3 10h14";
  const blocks = v
    ? dir === "left"
      ? "M5.5 5.5h9v3h-9zM5.5 11.5h5.5v3H5.5z"
      : dir === "right"
        ? "M5.5 5.5h9v3h-9zM9 11.5h5.5v3H9z"
        : "M5 5.5h10v3H5zM7 11.5h6v3H7z"
    : dir === "top"
      ? "M5.5 5.5h3v9h-3zM11.5 5.5h3v5.5h-3z"
      : dir === "bottom"
        ? "M5.5 5.5h3v9h-3zM11.5 9h3v5.5h-3z"
        : "M5.5 5h3v10h-3zM11.5 7h3v6h-3z";
  return (
    <Svg size={15} {...p}>
      <path d={line} />
      <S d={blocks} />
    </Svg>
  );
};
export const IconDistribute = ({ axis, ...p }: P & { axis: "x" | "y" }) => (
  <Svg size={15} {...p}>
    {axis === "x" ? (
      <>
        <path d="M3 3v14M17 3v14" />
        <S d="M8.5 6h3v8h-3z" />
      </>
    ) : (
      <>
        <path d="M3 3h14M3 17h14" />
        <S d="M6 8.5h8v3H6z" />
      </>
    )}
  </Svg>
);
export const IconMap = (p: P) => (
  <Svg {...p}>
    <W d="M2.5 4.5l5-1.5 5 1.5 5-1.5v12.5l-5 1.5-5-1.5-5 1.5z" />
    <path d="M2.5 4.5l5-1.5 5 1.5 5-1.5v12.5l-5 1.5-5-1.5-5 1.5zM7.5 3v12.5M12.5 4.5V17" />
  </Svg>
);
export const IconFile = (p: P) => (
  <Svg {...p}>
    <W d="M5 2.5h6.5L15.5 6.5V17.5H5z" />
    <path d="M5 2.5h6.5L15.5 6.5V17.5H5zM11.5 2.5v4h4" />
  </Svg>
);
export const IconCode = (p: P) => (
  <Svg {...p}>
    <path d="M7 5.5L2.5 10 7 14.5M13 5.5l4.5 4.5-4.5 4.5" />
    <S d="M10.6 3.5h1.6l-2.8 13H7.8z" />
  </Svg>
);
export const IconGroup = (p: P) => (
  <Svg {...p}>
    <path d="M2.5 2.5h3M14.5 2.5h3v3M17.5 14.5v3h-3M5.5 17.5h-3v-3M2.5 5.5v-3" />
    <W d="M5.5 5.5h6v5h-6z" />
    <path d="M5.5 5.5h6v5h-6zM8.5 10.5v4h6v-6h-3" />
  </Svg>
);
export const IconUngroup = (p: P) => (
  <Svg {...p}>
    <W d="M3 3h7v6H3z" />
    <path d="M3 3h7v6H3zM10 11h7v6h-7z" />
  </Svg>
);
