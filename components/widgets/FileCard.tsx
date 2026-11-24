"use client";

import { memo } from "react";
import { resolveSrc } from "@/lib/assets";
import { formatBytes } from "@/lib/code";
import { IconDownload } from "../icons";
import { RailKey, type WidgetProps } from "./parts";

export interface FileData {
  /** the file itself, kept on the device ("asset:…") */
  src: string;
  name: string;
  size: number;
  type: string;
  modified?: number;
}

/** what kind of file, in a word, from its type or its ending */
function kindOf(name: string, type: string) {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const known: Record<string, string> = {
    zip: "archive", rar: "archive", "7z": "archive", gz: "archive", tar: "archive",
    doc: "document", docx: "document", pages: "document", odt: "document", rtf: "document",
    xls: "spreadsheet", xlsx: "spreadsheet", numbers: "spreadsheet", ods: "spreadsheet",
    ppt: "slides", pptx: "slides", key: "slides", odp: "slides",
    mp3: "audio", wav: "audio", m4a: "audio", flac: "audio", ogg: "audio",
    mp4: "video", mov: "video", mkv: "video", webm: "video", avi: "video",
    dmg: "disk image", iso: "disk image", exe: "program", app: "program", apk: "app",
    ttf: "font", otf: "font", woff: "font", woff2: "font", psd: "photoshop", fig: "figma", sketch: "sketch", ai: "illustrator",
    epub: "book", ics: "calendar", vcf: "contact",
  };
  if (known[ext]) return known[ext];
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("text/")) return "text";
  return ext ? `${ext} file` : "file";
}

/* A file laid on the board, the way it would sit on a desk: its kind, its
   name, how big it is. It isn't opened or previewed; the one key saves it
   back to your computer, byte for byte.                                */
export const FileCard = memo(function FileCard({ data }: WidgetProps<FileData>) {
  const ext = data.name.includes(".") ? data.name.split(".").pop()!.slice(0, 5).toLowerCase() : "file";
  return (
    <div className="flex h-full items-center gap-4 px-4">
      <div
        className="relative grid h-[68px] w-[54px] shrink-0 place-items-end pb-2"
        style={{ background: "var(--tile)", boxShadow: "var(--tile-shadow)", clipPath: "polygon(0 0, 72% 0, 100% 22%, 100% 100%, 0 100%)" }}
      >
        <span className="absolute top-0 right-0 h-[15px] w-[15px]" style={{ background: "var(--well)" }} />
        <span className="w-full text-center font-mono text-[11px] font-medium text-ink-label">.{ext}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink" title={data.name}>
          {data.name}
        </div>
        <div className="mt-0.5 text-[12px] text-ink-muted tabular-nums">
          {kindOf(data.name, data.type)} · {formatBytes(data.size)}
        </div>
        {data.modified && (
          <div className="text-[11.5px] text-ink-faint tabular-nums">
            {new Date(data.modified).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }).toLowerCase()}
          </div>
        )}
      </div>
    </div>
  );
});

export function FileRail({ data }: WidgetProps<FileData>) {
  return (
    <RailKey
      label="save to this computer"
      onClick={async () => {
        const url = await resolveSrc(data.src);
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = data.name;
        a.click();
      }}
    >
      <IconDownload size={13} />
    </RailKey>
  );
}
