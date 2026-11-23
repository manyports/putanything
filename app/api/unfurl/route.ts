import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/* Reads a page's title, description, picture and icon so a pasted link
   lands as a card. It only fetches public http(s) addresses: anything
   that resolves to this machine or a private network is refused.      */

function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivate(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivate(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function meta(html: string, keys: string[]) {
  for (const k of keys) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`,
      "i",
    );
    const m = html.match(re);
    const v = m?.[1] ?? m?.[2];
    if (v) return decode(v);
  }
  return undefined;
}

export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url") ?? "";
  let url = await safeUrl(target);
  if (!url) return Response.json({ error: "that address can't be previewed" }, { status: 400 });

  try {
    let res: Response | null = null;
    // follow redirects by hand so each hop gets the same check
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(url!, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; putanything-preview/1.0)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = await safeUrl(new URL(loc, url!).toString());
        if (!next) return Response.json({ error: "redirected somewhere private" }, { status: 400 });
        url = next;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return Response.json({ error: "no preview" }, { status: 502 });

    const type = res.headers.get("content-type") ?? "";
    if (type.startsWith("image/")) {
      return Response.json({ title: url.pathname.split("/").pop() || url.hostname, image: url.toString() });
    }

    // the head is all we need; stop reading after 400 kB
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        html += dec.decode(value, { stream: true });
        if (size > 400_000 || /<\/head>/i.test(html)) {
          reader.cancel().catch(() => {});
          break;
        }
      }
    }

    const abs = (v?: string) => {
      if (!v) return undefined;
      try {
        const u = new URL(v, url!);
        return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
      } catch {
        return undefined;
      }
    };

    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const iconHref =
      html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i)?.[1] ??
      html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
      "/favicon.ico";

    return Response.json(
      {
        url: url.toString(),
        title: meta(html, ["og:title", "twitter:title"]) ?? (titleTag ? decode(titleTag) : undefined),
        description: meta(html, ["og:description", "twitter:description", "description"]),
        image: abs(meta(html, ["og:image", "og:image:url", "twitter:image", "twitter:image:src"])),
        site: meta(html, ["og:site_name", "application-name"]),
        icon: abs(iconHref),
      },
      { headers: { "cache-control": "public, max-age=86400" } },
    );
  } catch {
    return Response.json({ error: "no preview" }, { status: 502 });
  }
}
