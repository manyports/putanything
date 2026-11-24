"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { WidgetKind } from "@/lib/types";
import { localZone, zoneCity } from "@/lib/time";
import { paperColor } from "@/lib/colors";
import {
  IconBook,
  IconCalc,
  IconCalendar,
  IconCheck,
  IconClock,
  IconImage,
  IconLink,
  IconSticky,
  IconSun,
  IconSwap,
  IconTimer,
  IconTable,
  IconCode,
  IconFile,
} from "../icons";
import type { WidgetProps } from "./parts";
import { Sticky, StickyRail, type StickyData } from "./Sticky";
import { Checklist } from "./Checklist";
import { Calculator, CalculatorRail } from "./Calculator";
import { Clocks, ClocksRail } from "./Clocks";
import { Weather, WeatherRail } from "./Weather";
import { Dictionary } from "./Dictionary";
import { Timer, TimerRail } from "./Timer";
import { Converter } from "./Converter";
import { Countdown, CountdownRail } from "./Countdown";
import { LinkCard, LinkRail, type LinkData } from "./LinkCard";
import { Picture, PictureRail } from "./Picture";
import { Table, TableRail } from "./Table";
import { CodeCard, CodeRail, type CodeData } from "./CodeCard";
import { FileCard, FileRail } from "./FileCard";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface WidgetDef {
  kind: WidgetKind;
  name: string;
  /** what it does, physically, in one line */
  blurb: string;
  /** number key that drops one on the board */
  key?: string;
  icon: ReactNode;
  size: { w: number; h: number };
  min: { w: number; h: number };
  keepAspect?: boolean;
  create: () => any;
  title?: (data: any) => string;
  faceStyle?: (data: any) => CSSProperties | undefined;
  Component: ComponentType<WidgetProps<any>>;
  Rail?: ComponentType<WidgetProps<any>>;
  /** shown on the shelf; pasted-only kinds stay off it */
  onShelf: boolean;
}

function nextNewYear() {
  const y = new Date().getFullYear() + 1;
  return `${y}-01-01`;
}

export const WIDGETS: Record<WidgetKind, WidgetDef> = {
  sticky: {
    kind: "sticky",
    name: "sticky",
    blurb: "a square of paper. five colours to sort by.",
    key: "1",
    icon: <IconSticky />,
    size: { w: 300, h: 280 },
    min: { w: 160, h: 120 },
    create: (): StickyData => ({ text: "", tint: "amber" }),
    title: () => "sticky",
    faceStyle: (d: StickyData) => ({ background: paperColor(d.tint) }),
    Component: Sticky,
    Rail: StickyRail,
    onShelf: true,
  },
  todo: {
    kind: "todo",
    name: "checklist",
    blurb: "paste a list and each line becomes a box. done ones sink.",
    key: "2",
    icon: <IconCheck />,
    size: { w: 320, h: 360 },
    min: { w: 220, h: 180 },
    create: () => ({ title: "", items: [] }),
    title: (d) => (d.title ? "checklist" : "checklist"),
    Component: Checklist,
    onShelf: true,
  },
  calc: {
    kind: "calc",
    name: "calculator",
    blurb: "keeps a tape. switch to sci for trig, logs, powers and factorials.",
    key: "3",
    icon: <IconCalc />,
    size: { w: 300, h: 430 },
    min: { w: 230, h: 300 },
    create: () => ({ expr: "", tape: [] }),
    Component: Calculator,
    Rail: CalculatorRail,
    onShelf: true,
  },
  clock: {
    kind: "clock",
    name: "world clocks",
    blurb: "cities side by side. slide forward to find a time that suits everyone.",
    key: "7",
    icon: <IconClock />,
    size: { w: 360, h: 300 },
    min: { w: 240, h: 170 },
    create: () => {
      const here = localZone();
      const others = ["America/New_York", "Europe/London", "Asia/Tokyo"].filter((z) => z !== here);
      return { zones: [here, ...others].slice(0, 4), h24: true };
    },
    Component: Clocks,
    Rail: ClocksRail,
    onShelf: true,
  },
  weather: {
    kind: "weather",
    name: "weather",
    blurb: "now, the next twelve hours, and the week, from open-meteo.",
    key: "8",
    icon: <IconSun />,
    size: { w: 360, h: 440 },
    min: { w: 250, h: 240 },
    create: () => ({ place: null, unit: "c", guess: zoneCity(localZone()) }),
    Component: Weather,
    Rail: WeatherRail,
    onShelf: true,
  },
  dict: {
    kind: "dict",
    name: "dictionary",
    blurb: "definitions, how it sounds, and words that mean the same.",
    key: "9",
    icon: <IconBook />,
    size: { w: 380, h: 440 },
    min: { w: 240, h: 200 },
    create: () => ({ word: "", recent: [] }),
    Component: Dictionary,
    onShelf: true,
  },
  timer: {
    kind: "timer",
    name: "timer",
    blurb: "keeps running when you close the tab, and rings when it's done.",
    key: "4",
    icon: <IconTimer />,
    size: { w: 300, h: 250 },
    min: { w: 220, h: 180 },
    create: () => ({ label: "", duration: 25 * 60, left: 25 * 60, endsAt: null, ring: true }),
    Component: Timer,
    Rail: TimerRail,
    onShelf: true,
  },
  convert: {
    kind: "convert",
    name: "converter",
    blurb: "lengths, weights, temperatures, data, and money at today's rate.",
    key: "5",
    icon: <IconSwap />,
    size: { w: 340, h: 300 },
    min: { w: 240, h: 220 },
    create: () => ({ cat: "length", from: "km", to: "mi", value: "10", side: "from" }),
    Component: Converter,
    onShelf: true,
  },
  countdown: {
    kind: "countdown",
    name: "countdown",
    blurb: "days until something. or days since.",
    key: "6",
    icon: <IconCalendar />,
    size: { w: 300, h: 190 },
    min: { w: 200, h: 140 },
    create: () => ({ label: "new year", date: nextNewYear() }),
    Component: Countdown,
    Rail: CountdownRail,
    onShelf: true,
  },
  table: {
    kind: "table",
    name: "table",
    blurb: "rows and columns. paste from a spreadsheet; numbers get a total.",
    icon: <IconTable />,
    size: { w: 540, h: 290 },
    min: { w: 220, h: 140 },
    create: () => ({ header: true, rows: [["item", "qty", "price"], ["", "", ""], ["", "", ""]] }),
    Component: Table,
    Rail: TableRail,
    onShelf: true,
  },
  code: {
    kind: "code",
    name: "code",
    blurb: "paste code or drop a code file. coloured, editable, opens big.",
    icon: <IconCode />,
    size: { w: 480, h: 320 },
    min: { w: 220, h: 120 },
    create: (): CodeData => ({ code: "", lang: "javascript", editing: true }),
    title: (d: CodeData) => d.name ?? "code",
    Component: CodeCard,
    Rail: CodeRail,
    onShelf: true,
  },
  file: {
    kind: "file",
    name: "file",
    blurb: "drop any file to keep it on the board.",
    icon: <IconFile />,
    size: { w: 320, h: 110 },
    min: { w: 220, h: 96 },
    create: () => ({ src: "", name: "", size: 0, type: "" }),
    Component: FileCard,
    Rail: FileRail,
    onShelf: false,
  },
  link: {
    kind: "link",
    name: "link",
    blurb: "paste a link anywhere on the board.",
    icon: <IconLink />,
    size: { w: 380, h: 340 },
    min: { w: 220, h: 120 },
    create: () => ({ url: "", state: "loading" }),
    title: (d: LinkData) => {
      try {
        return new URL(d.url).hostname.replace(/^www\./, "");
      } catch {
        return "link";
      }
    },
    Component: LinkCard,
    Rail: LinkRail,
    onShelf: false,
  },
  image: {
    kind: "image",
    name: "picture",
    blurb: "paste or drop a picture.",
    icon: <IconImage />,
    size: { w: 320, h: 240 },
    min: { w: 100, h: 80 },
    keepAspect: true,
    create: () => ({ src: "", name: "", nw: 1, nh: 1 }),
    title: (d) => d.name || "picture",
    Component: Picture,
    Rail: PictureRail,
    onShelf: false,
  },
};

export const SHELF = Object.values(WIDGETS).filter((w) => w.onShelf);
