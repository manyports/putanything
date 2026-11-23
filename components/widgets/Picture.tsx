"use client";

import { memo } from "react";
import { IconDownload } from "../icons";
import { RailKey, type WidgetProps } from "./parts";

export interface PictureData {
  src: string;
  name: string;
  nw: number;
  nh: number;
}

export const Picture = memo(function Picture({ data }: WidgetProps<PictureData>) {
  return (
    <div className="relative h-full w-full" style={{ background: "var(--media-well)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.src} alt={data.name} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
    </div>
  );
});

export function PictureRail({ data }: WidgetProps<PictureData>) {
  return (
    <RailKey
      label="save the picture"
      onClick={() => {
        const a = document.createElement("a");
        a.href = data.src;
        a.download = data.name || "picture";
        a.click();
      }}
    >
      <IconDownload size={13} />
    </RailKey>
  );
}

/** Pictures are kept on the board itself, so shrink big ones before they land. */
export async function readImage(file: Blob, name = "picture"): Promise<PictureData> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const isGif = file.type === "image/gif" || file.type === "image/svg+xml";
    let src: string;
    if (isGif || (scale === 1 && file.size < 400_000)) {
      src = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(file);
      });
    } else {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      src = c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.86);
      if (src.length > 1_500_000) src = c.toDataURL("image/jpeg", 0.82);
    }
    return { src, name, nw: w, nh: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
