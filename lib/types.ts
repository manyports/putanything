export type Vec = [number, number];

export type WidgetKind =
  | "sticky"
  | "todo"
  | "calc"
  | "clock"
  | "weather"
  | "dict"
  | "timer"
  | "convert"
  | "countdown"
  | "link"
  | "image"
  | "table"
  | "code"
  | "file";

/* A widget plate placed on the board. `data` belongs to the widget. */
export interface Item<D = Record<string, unknown>> {
  id: string;
  kind: WidgetKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  data: D;
  /** can't be moved, stretched or deleted until unlocked */
  locked?: boolean;
}

export interface Stroke {
  id: string;
  kind: "stroke";
  /** x, y, pressure */
  pts: [number, number, number][];
  /** "ink" follows the theme, "accent" is the kit's violet, anything else is a hex */
  tone: string;
  locked?: boolean;
  size: number;
  /** "pen" is even, "pencil" tapers with speed or pressure, "marker" is wide and see-through */
  style?: PenStyle;
}

export type PenStyle = "pen" | "pencil" | "marker";

export interface Arrow {
  id: string;
  kind: "arrow";
  a: Vec;
  b: Vec;
  tone: string;
  locked?: boolean;
  seed: number;
  /** a plate or shape the tail is attached to */
  from?: string;
  /** a plate or shape the head is attached to */
  to?: string;
}

export interface Note {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  size: number;
  tone: string;
  locked?: boolean;
  font?: NoteFont;
  /** the text wraps at this width; without it a note is as wide as its longest line */
  width?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
}

export type NoteFont = "hand" | "sans" | "serif" | "mono";

export type ShapeKind = "rect" | "ellipse" | "diamond" | "triangle";
export type ShapeFill = "none" | "tint" | "solid";

export interface Shape {
  id: string;
  kind: "shape";
  shape: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: string;
  fill: ShapeFill;
  seed: number;
  locked?: boolean;
  /** words written inside the shape */
  label?: string;
}

export type Mark = Stroke | Arrow | Note | Shape;

export interface Doc {
  items: Item[];
  marks: Mark[];
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export type Tool = "select" | "hand" | "pen" | "arrow" | "text" | "shape" | "eraser";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
