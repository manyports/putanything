"use client";

import { Skeleton } from "@blurrow/ui";
import { memo, useEffect, useRef, useState } from "react";
import { zoomedInto } from "../board/ChromeLayer";
import { live } from "@/lib/store";
import { IconCopy, IconExternal, IconLink, IconPlay } from "../icons";
import { RailKey, type WidgetProps } from "./parts";

export interface LinkData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site?: string;
  icon?: string;
  state: "loading" | "ok" | "failed";
  /** the words that came with the link when it was pasted */
  note?: string;
  /** a YouTube link playing in the card instead of showing its preview */
  embed?: boolean;
}

/** The video id in any of YouTube's address shapes, or null. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = /^\/(?:embed|shorts|live|v)\/([\w-]{6,})/.exec(u.pathname);
      return m ? m[1] : null;
    }
  } catch {}
  return null;
}

/** the start time a link carries (t=90, t=1m30s), in seconds */
function startAt(url: string) {
  try {
    const t = new URL(url).searchParams.get("t") ?? "";
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
    if (!m) return 0;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } catch {
    return 0;
  }
}

/* Switch a YouTube card between its preview and a player, and give the plate
   the shape that suits each: 16:9 for the player, the card's own for the preview. */
export function setEmbed(id: string, on: boolean) {
  live((d) => ({
    ...d,
    items: d.items.map((i) =>
      i.id === id ? { ...i, w: on ? Math.max(i.w, 560) : 380, h: on ? Math.round((Math.max(i.w, 560) - 10) * (9 / 16)) + 10 : 340, data: { ...i.data, embed: on } } : i,
    ),
  }));
}

// one request per address, however many times a card mounts (strict mode mounts twice)
const inflight = new Map<string, Promise<Partial<LinkData>>>();
function unfurl(url: string) {
  let p = inflight.get(url);
  if (!p) {
    p = fetch(`/api/unfurl?url=${encodeURIComponent(url)}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error("no preview"))));
    p.catch(() => inflight.delete(url));
    inflight.set(url, p);
  }
  return p;
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* A player is another site's page inside the card, and gestures over it go
   to that page, not the board. So it sits behind a glass pane until you
   press it: pinches and scrolls over the glass zoom and pan the board as
   anywhere else. Pressed, the player takes the pointer until it leaves
   the card. It starts playing by itself, so no press is needed to begin. */
function Player({ id, url, title }: { id: string; url: string; title?: string }) {
  const [live, setLive] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const start = startAt(url);
  // the page started to zoom while this one had the pointer: it goes back behind its glass,
  // and is remembered as what the person zoomed into
  useEffect(() => {
    if (!live) return;
    const v = window.visualViewport;
    if (!v) return;
    const check = () => {
      if (v.scale > 1.01) {
        zoomedInto.el = box.current;
        setLive(false);
      }
    };
    v.addEventListener("resize", check);
    return () => v.removeEventListener("resize", check);
  }, [live]);
  return (
    <div ref={box} className="absolute inset-0" onPointerLeave={() => setLive(false)} style={{ background: "#000" }}>
      <iframe
        title={title || "youtube video"}
        src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1&playsinline=1${start ? `&start=${start}` : ""}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full border-0"
        style={{ pointerEvents: live ? "auto" : "none" }}
      />
      {!live && (
        <button
          type="button"
          aria-label="use the player"
          title="press to use the player"
          onClick={() => setLive(true)}
          className="group/glass absolute inset-0 cursor-pointer"
        >
          <span className="absolute right-2 bottom-2 rounded-[6px] bg-black/55 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/glass:opacity-100">
            press to use the player
          </span>
        </button>
      )}
    </div>
  );
}

export const LinkCard = memo(function LinkCard({ id, data, set, h }: WidgetProps<LinkData>) {
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (data.state !== "loading") return;
    let gone = false;
    unfurl(data.url)
      .then((j) => {
        if (gone) return;
        set({ ...j, state: "ok" }, { history: false });
        // no picture to show: the card closes up around its words instead of keeping an empty space
        if (!j.image)
          live((d) => ({ ...d, items: d.items.map((i) => (i.id === id && i.h > 220 ? { ...i, h: data.note ? 216 : 190 } : i)) }));
      })
      .catch(() => !gone && set({ state: "failed" }, { history: false }));
    return () => {
      gone = true;
    };
  }, [data.state, data.url, data.note, id, set]);

  const showImage = data.image && imgOk && h > 200;
  const yt = youtubeId(data.url);

  if (yt && data.embed) return <Player id={yt} url={data.url} title={data.title} />;

  return (
    <div className="flex h-full flex-col">
      {data.state === "loading" ? (
        <div className="flex flex-1 flex-col gap-2 p-4">
          {data.note && <p className="mb-1 line-clamp-2 text-[13px] leading-[1.45] text-ink">{data.note}</p>}
          <Skeleton className="h-24 w-full rounded-[10px]" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : (
        <>
          {showImage && (
            <div className="relative min-h-0 flex-[1.2] overflow-hidden" style={{ background: "var(--media-well)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.image}
                alt=""
                referrerPolicy="no-referrer"
                draggable={false}
                onError={() => setImgOk(false)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col gap-1 px-4 pt-3 pb-3.5">
            {data.note && <p className="mb-1 line-clamp-2 text-[13px] leading-[1.45] text-ink">{data.note}</p>}
            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              {data.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.icon} alt="" width={14} height={14} referrerPolicy="no-referrer" className="rounded-[3px]" />
              )}
              <span className="truncate">{(data.site || host(data.url)).toLowerCase()}</span>
            </div>
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer noopener"
              draggable={false}
              className="line-clamp-2 text-[15px] font-medium leading-[1.3] tracking-[-0.01em] text-ink hover:underline decoration-ink-ghost underline-offset-[3px]"
            >
              {data.title || host(data.url)}
            </a>
            {data.description && (
              <p className="line-clamp-3 text-[13px] leading-[1.5] text-ink-body">{data.description}</p>
            )}
            {data.state === "failed" && (
              <p className="text-[12.5px] leading-[1.5] text-ink-muted">
                that page didn&apos;t share a preview. the link still works.
              </p>
            )}
            <div className="mt-auto flex items-center gap-2 pt-1">
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-faint">{data.url}</span>
              {yt && (
                <button
                  type="button"
                  onClick={() => setEmbed(id, true)}
                  className="raised-key flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12px] font-medium text-ink-label cursor-pointer"
                >
                  <IconPlay size={12} /> play here
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export function LinkRail({ id, data }: WidgetProps<LinkData>) {
  const [copied, setCopied] = useState(false);
  const yt = youtubeId(data.url);
  return (
    <>
      {yt && (
        <RailKey label={data.embed ? "back to the card" : "play it here"} onClick={() => setEmbed(id, !data.embed)}>
          {data.embed ? <IconLink size={13} /> : <IconPlay size={13} />}
        </RailKey>
      )}
      <RailKey
        label={copied ? "copied" : "copy the link"}
        onClick={() => {
          navigator.clipboard?.writeText(data.url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          });
        }}
      >
        <IconCopy size={13} />
      </RailKey>
      <RailKey label="open in a new tab" onClick={() => window.open(data.url, "_blank", "noopener,noreferrer")}>
        <IconExternal size={13} />
      </RailKey>
    </>
  );
}
