"use client";

import { useEffect, useState } from "react";
import { idbDelete, idbGet, idbKeys, idbSet } from "./idb";

/* Pictures live in their own place in IndexedDB, as binary files, apart from
   the boards. A plate refers to its picture as "asset:<id>". So a picture is
   written once, the moment it arrives, and saving a board writes only the
   board's own small description, never the pictures again. Plates from
   before this keep their pictures inline (data: urls) and still work.    */

const PREFIX = "asset:";
const KEY = (id: string) => `asset:${id}`;
const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

export const isAsset = (src: string | undefined) => !!src && src.startsWith(PREFIX);

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bytes = head.includes(";base64") ? Uint8Array.from(atob(body), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
  return new Blob([bytes], { type });
}

/** Keep a picture on the device and get the src a plate should hold. Resolves only once it's written. */
export async function putAsset(picture: Blob | string): Promise<string> {
  const blob = typeof picture === "string" ? dataUrlToBlob(picture) : picture;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await idbSet(KEY(id), blob);
  urls.set(id, URL.createObjectURL(blob));
  return PREFIX + id;
}

/** A src a page can show: the asset's object url, or the src itself if it isn't an asset. */
export async function resolveSrc(src: string): Promise<string | null> {
  if (!isAsset(src)) return src;
  const id = src.slice(PREFIX.length);
  const hit = urls.get(id);
  if (hit) return hit;
  let p = loading.get(id);
  if (!p) {
    p = idbGet<Blob>(KEY(id)).then((blob) => {
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    });
    loading.set(id, p);
  }
  return p;
}

/** The picture as a data: url, for files that must carry their pictures inside (a saved board). */
export async function srcAsDataUrl(src: string): Promise<string> {
  if (!isAsset(src)) return src;
  const blob = await idbGet<Blob>(KEY(src.slice(PREFIX.length)));
  if (!blob) return src;
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export function useAssetSrc(src: string): string | null {
  const [url, setUrl] = useState<string | null>(() => (isAsset(src) ? (urls.get(src.slice(PREFIX.length)) ?? null) : src));
  useEffect(() => {
    let gone = false;
    resolveSrc(src).then((u) => !gone && setUrl(u));
    return () => {
      gone = true;
    };
  }, [src]);
  return url;
}

/** Remove pictures no board refers to any more (pictures taken off a board, boards deleted). */
export async function sweepAssets(inUse: Set<string>) {
  const keys = await idbKeys(PREFIX);
  await Promise.all(keys.filter((k) => !inUse.has(k)).map((k) => idbDelete(k)));
}
