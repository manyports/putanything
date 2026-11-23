"use client";

import type { Arrow, Doc, Item, Mark, Note, Shape, Stroke, WidgetKind } from "./types";
import { WIDGETS } from "@/components/widgets/registry";
import { uid } from "./store";

/* Ready-made boards for the things people sit down to do. Every plate is a
   real, working widget; nothing is filler text to delete.              */
export interface Template {
  key: string;
  name: string;
  blurb: string;
  build: () => Doc;
}

/** k scales a layout that was drawn for smaller plates; the tutorial is drawn at size (1) */
function board(k = 1.2) {
  let z = 0;
  const items: Item[] = [];
  const put = (kind: WidgetKind, x: number, y: number, data?: object, size?: { w: number; h: number }) => {
    const def = WIDGETS[kind];
    items.push({
      id: uid(),
      kind,
      x: Math.round(x * k),
      y: Math.round(y * k),
      w: size ? Math.round(size.w * k) : def.size.w,
      h: size ? Math.round(size.h * k) : def.size.h,
      z: ++z,
      data: { ...(def.create() as object), ...(data ?? {}) } as Record<string, unknown>,
    });
  };
  return { items, put };
}

const todo = (...texts: string[]) => texts.map((text) => ({ id: uid(), text, done: false }));

export const TEMPLATES: Template[] = [
  {
    key: "week",
    name: "week planner",
    blurb: "a list for each day this week, and a note for the week",
    build: () => {
      const { items, put } = board();
      const now = new Date();
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        const title = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" }).toLowerCase();
        put("todo", i * 236, 0, { title, items: [] }, { w: 220, h: 300 });
      }
      put("sticky", 0, 330, { tint: "amber", text: "" }, { w: 456, h: 200 });
      put("countdown", 472, 330, { label: "the weekend", date: (() => { const s = new Date(monday); s.setDate(s.getDate() + 5); return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`; })() }, { w: 240, h: 150 });
      return { items, marks: [] };
    },
  },
  {
    key: "meeting",
    name: "meeting",
    blurb: "an agenda, notes, actions with owners, a timer and the clocks",
    build: () => {
      const { items, put } = board();
      put("todo", 0, 0, { title: "agenda", items: todo("what's happened since last time", "decisions to make", "who does what next") }, { w: 280, h: 280 });
      put("sticky", 300, 0, { tint: "plain", text: "" }, { w: 320, h: 280 });
      put("table", 0, 300, { header: true, rows: [["who", "what", "by when"], ["", "", ""], ["", "", ""], ["", "", ""]] }, { w: 620, h: 220 });
      put("timer", 640, 0, { label: "meeting", duration: 30 * 60, left: 30 * 60 }, { w: 240, h: 200 });
      put("clock", 640, 220, undefined, { w: 300, h: 244 });
      return { items, marks: [] };
    },
  },
  {
    key: "study",
    name: "study session",
    blurb: "a 25-minute focus timer, topics, questions, a dictionary and a scientific calculator",
    build: () => {
      const { items, put } = board();
      put("timer", 0, 0, { label: "focus", duration: 25 * 60, left: 25 * 60 }, { w: 240, h: 200 });
      put("todo", 0, 220, { title: "today's topics", items: [] }, { w: 240, h: 280 });
      put("sticky", 260, 0, { tint: "lilac", text: "questions to ask:\n" }, { w: 260, h: 220 });
      put("dict", 260, 240, undefined, { w: 300, h: 320 });
      put("calc", 580, 0, { mode: "sci" }, { w: 420, h: 340 });
      return { items, marks: [] };
    },
  },
  {
    key: "trip",
    name: "trip",
    blurb: "a countdown, the packing list, weather, clocks, money and a day-by-day plan",
    build: () => {
      const { items, put } = board();
      put("countdown", 0, 0, { label: "the trip", date: null, editing: true }, { w: 260, h: 210 });
      put("todo", 0, 230, { title: "packing", items: todo("passport", "chargers", "tickets", "travel insurance") }, { w: 260, h: 300 });
      // (the plan sits under everything, across the full width)
      put("weather", 280, 0, undefined, { w: 300, h: 384 });
      put("clock", 600, 0, undefined, { w: 300, h: 244 });
      put("convert", 600, 264, { cat: "currency", from: "USD", to: "EUR", value: "100", side: "from" }, { w: 300, h: 250 });
      put("table", 0, 550, { header: true, rows: [["day", "where", "notes"], ["1", "", ""], ["2", "", ""], ["3", "", ""]] }, { w: 900, h: 200 });
      return { items, marks: [] };
    },
  },
];

/* ── The tutorial ────────────────────────────────────────────────────
   Ten numbered steps, each a pencil badge, a line in the hand, and the
   real thing to try. Arrows lead from one step to the next and stick to
   the badges. The drawings are drawn with the same pen you'll use.     */

const seed = () => Math.floor(Math.random() * 1e9);
const pt = (x: number, y: number): [number, number, number] => [x, y, 0.5];

function note(x: number, y: number, text: string, size = 26, extra: Partial<Note> = {}): Note {
  return { id: uid(), kind: "text", x, y, text, size, tone: "ink", ...extra };
}
function shape(x: number, y: number, w: number, h: number, kind: Shape["shape"], label?: string, extra: Partial<Shape> = {}): Shape {
  return { id: uid(), kind: "shape", shape: kind, x, y, w, h, tone: "ink", fill: "none", seed: seed(), label, ...extra };
}
function arrow(a: [number, number], b: [number, number], extra: Partial<Arrow> = {}): Arrow {
  return { id: uid(), kind: "arrow", a, b, tone: "ink", seed: seed(), ...extra };
}
function stroke(pts: [number, number, number][], extra: Partial<Stroke> = {}): Stroke {
  return { id: uid(), kind: "stroke", pts, tone: "ink", size: 4, style: "pen", ...extra };
}

/** a drawn smiley: a wobbly round face, two eyes, a grin */
function smiley(cx: number, cy: number, r: number, tone = "ink"): Stroke[] {
  const face = Array.from({ length: 41 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (1 + Math.sin(i * 1.7) * 0.025);
    return pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  });
  const eye = (x: number) => [pt(x, cy - r * 0.28), pt(x + 0.5, cy - r * 0.16)];
  const grin = Array.from({ length: 14 }, (_, i) => {
    const a = Math.PI * 0.18 + (i / 13) * Math.PI * 0.64;
    return pt(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.5);
  });
  return [
    stroke(face, { tone }),
    stroke(eye(cx - r * 0.32), { tone, size: 6 }),
    stroke(eye(cx + r * 0.32), { tone, size: 6 }),
    stroke(grin, { tone }),
  ];
}

/** a five-point star in one go, the way you'd doodle it */
function star(cx: number, cy: number, r: number, tone = "ink"): Stroke {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    return pt(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  });
  return stroke(pts, { tone, style: "pencil", size: 5 });
}

/** a heart, drawn as one line */
function heart(cx: number, cy: number, s: number, tone = "accent"): Stroke {
  const pts = Array.from({ length: 48 }, (_, i) => {
    const t = (i / 47) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return pt(cx + (x * s) / 16, cy + (y * s) / 16);
  });
  return stroke(pts, { tone, size: 4.5 });
}

/** a quick underline with a little lift at the end */
function underline(x: number, y: number, w: number, tone = "accent"): Stroke {
  const pts = Array.from({ length: 12 }, (_, i) => pt(x + (i / 11) * w, y + Math.sin(i / 2) * 1.5 - (i > 9 ? (i - 9) * 3 : 0)));
  return stroke(pts, { tone, style: "marker", size: 12 });
}

export function tutorialDoc(): Doc {
  // drawn at full size: plates and the notes about them share one set of positions
  const { items, put } = board(1);
  const marks: Mark[] = [];
  const mod = typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform) ? "⌘" : "ctrl ";

  // the welcome
  marks.push(note(0, -230, "hi! this is your board :)", 64, { font: "hand" }));
  marks.push(underline(4, -152, 560));
  marks.push(note(0, -120, "follow the numbers. everything here is real, so poke at it — you can't break anything.", 26));
  marks.push(...smiley(760, -180, 46, "accent"));

  const COL = 620;
  const ROW = 720;
  const badges: Shape[] = [];
  // a number on the path, the step's name under it, then the thing to try
  const step = (i: number, title: string) => {
    const ox = (i % 5) * COL;
    const oy = Math.floor(i / 5) * ROW;
    const b = shape(ox, oy, 72, 72, "ellipse", String(i + 1), { fill: "tint", tone: "accent" });
    badges.push(b);
    marks.push(b);
    marks.push(note(ox, oy + 88, title, 34));
    return { ox, oy: oy + 150 };
  };

  // 1 · move
  {
    const { ox, oy } = step(0, "grab & move");
    put("sticky", ox, oy, { tint: "amber", text: "grab me anywhere and drag me around.\n\nlet go and i stay put. go on, i don't mind :)" });
    marks.push(note(ox + 4, oy + 300, "tip: hold alt while dragging to leave a copy behind", 22, { tone: "accent" }));
  }
  // 2 · stretch
  {
    const { ox, oy } = step(1, "stretch it");
    put("sticky", ox, oy, { tint: "mint", text: "pull any corner or edge to make me bigger or smaller.\n\nshift keeps my shape." }, { w: 250, h: 190 });
    marks.push(arrow([ox + 360, oy + 290], [ox + 262, oy + 200], { tone: "accent" }));
    marks.push(note(ox + 340, oy + 296, "this corner!", 26, { tone: "accent" }));
  }
  // 3 · paste
  {
    const { ox, oy } = step(2, "paste anything");
    put("link", ox, oy, { url: "https://en.wikipedia.org/wiki/Post-it_Note", state: "loading" }, { w: 380, h: 300 });
    marks.push(note(ox, oy + 320, `copy a link, press ${mod}v on the board → a card!\npictures, pdfs and spreadsheet cells work too.`, 22));
  }
  // 4 · draw
  {
    const { ox, oy } = step(3, "doodle");
    marks.push(...smiley(ox + 90, oy + 110, 70));
    marks.push(star(ox + 270, oy + 100, 52, "accent"));
    marks.push(
      stroke(Array.from({ length: 30 }, (_, i) => pt(ox + 30 + i * 13, oy + 240 + Math.sin(i / 2.2) * 18)), { style: "marker", size: 16, tone: "#16a34a" }),
    );
    marks.push(note(ox, oy + 300, "press p, then draw. like this :)\npen, pencil or marker — and 1–4 for the width.", 22));
  }
  // 5 · shapes and arrows
  {
    const { ox, oy } = step(4, "shapes & arrows");
    const idea = shape(ox, oy + 20, 170, 96, "rect", "an idea");
    const ask = shape(ox + 270, oy + 6, 170, 124, "diamond", "try it?", { fill: "tint", tone: "accent" });
    const yes = shape(ox + 285, oy + 200, 140, 80, "ellipse", "yes!", { fill: "tint", tone: "#16a34a" });
    marks.push(idea, ask, yes);
    marks.push(arrow([0, 0], [0, 0], { from: idea.id, to: ask.id }));
    marks.push(arrow([0, 0], [0, 0], { from: ask.id, to: yes.id }));
    marks.push(note(ox, oy + 320, "r for shapes, a for arrows. double-click a shape to label it.\narrows stick: move \"an idea\" and watch.", 22));
  }
  // 6 · write
  {
    const { ox, oy } = step(5, "write anywhere");
    marks.push(note(ox, oy + 4, "double-click the board", 34));
    marks.push(note(ox, oy + 62, "and pick a typeface,", 26, { font: "sans" }));
    marks.push(note(ox, oy + 104, "a size,", 40, { font: "serif" }));
    marks.push(note(ox, oy + 162, "or a colour.", 26, { font: "mono", tone: "accent" }));
    marks.push(note(ox, oy + 226, "select a note and press enter to change what it says.", 22));
    marks.push(heart(ox + 360, oy + 120, 40));
  }
  // 7 · widgets
  {
    const { ox, oy } = step(6, "widgets");
    put("timer", ox, oy, { label: "a short break", duration: 5 * 60, left: 5 * 60 }, { w: 300, h: 250 });
    marks.push(note(ox, oy + 280, "the + at the bottom (or w) has clocks, weather,\na calculator, a dictionary and more.\nclick the time to type your own.", 22));
    marks.push(arrow([ox + 420, oy + 150], [ox + 312, oy + 222], { tone: "accent" }));
    marks.push(note(ox + 370, oy + 110, "press play :)", 26, { tone: "accent" }));
  }
  // 8 · tables
  {
    const { ox, oy } = step(7, "tables");
    put(
      "table",
      ox,
      oy,
      { header: true, rows: [["snack", "how good", "price"], ["toast", "8", "1.50"], ["mango", "10", "2.20"], ["crackers", "6", "0.90"]] },
      { w: 470, h: 260 },
    );
    marks.push(note(ox, oy + 290, "tab and enter move between cells.\nright-click a cell to sort or add rows.", 22));
  }
  // 9 · boards and search
  {
    const { ox, oy } = step(8, "boards & search");
    put(
      "todo",
      ox,
      oy,
      {
        title: "things to try",
        items: todo("tick me", "make a new board with the + up top", `press ${mod}f and look for "mango"`, `press ${mod}k to do anything by name`, "drop a photo on the board"),
      },
      { w: 360, h: 340 },
    );
  }
  // 10 · keys
  {
    const { ox, oy } = step(9, "the keys");
    put(
      "sticky",
      ox,
      oy,
      {
        tint: "lilac",
        text: `v select · p pen · a arrow\nt note · r shapes · e eraser\nn sticky · w widgets\n\n${mod}z undo · ${mod}d duplicate\nspace + drag to look around\n⇧1 to see everything\n\n? shows every key`,
      },
      { w: 320, h: 320 },
    );
  }

  // along each row, an arrow from one step's number to the next (a new row starts fresh at the left)
  for (let i = 0; i + 1 < badges.length; i++) {
    if ((i + 1) % 5 === 0) continue;
    marks.push(arrow([0, 0], [0, 0], { from: badges[i].id, to: badges[i + 1].id, tone: "accent" }));
  }

  // the sign-off
  marks.push(note(0, 2 * ROW, "that's it! have fun, and make it yours :)", 44));
  marks.push(heart(860, 2 * ROW + 26, 32));
  marks.push(...smiley(960, 2 * ROW + 26, 34, "accent"));

  return { items, marks };
}

TEMPLATES.unshift({
  key: "tutorial",
  name: "how it works",
  blurb: "ten small steps through everything, with things to try",
  build: tutorialDoc,
});
