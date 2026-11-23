"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

/* pdf.js is only fetched when a PDF actually arrives. Its worker is served
   from this site (public/pdf.worker.min.mjs), never from a CDN.        */
let lib: typeof import("pdfjs-dist") | null = null;

async function pdfjs() {
  if (!lib) {
    lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return lib;
}

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const { getDocument } = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  return getDocument({ data }).promise;
}

/** Draw one page (1-based) so its longer side is `longest` pixels, as a JPEG. */
export async function renderPage(doc: PDFDocumentProxy, n: number, longest: number, quality = 0.86) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const scale = longest / Math.max(base.width, base.height);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d")!;
  // pages are paper: white under the ink, whatever the theme
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  return { src: canvas.toDataURL("image/jpeg", quality), nw: canvas.width, nh: canvas.height };
}

/** "1-3, 7, 9-" → the page numbers it names, within 1..count. */
export function parseRange(text: string, count: number): number[] {
  const out = new Set<number>();
  for (const part of text.split(/[,\s]+/).filter(Boolean)) {
    const m = /^(\d*)\s*[-–]\s*(\d*)$/.exec(part);
    if (m) {
      const a = m[1] ? Number(m[1]) : 1;
      const b = m[2] ? Number(m[2]) : count;
      for (let i = Math.max(1, Math.min(a, b)); i <= Math.min(count, Math.max(a, b)); i++) out.add(i);
    } else if (/^\d+$/.test(part)) {
      const n = Number(part);
      if (n >= 1 && n <= count) out.add(n);
    }
  }
  return [...out].sort((x, y) => x - y);
}

/** The shortest range text for a set of pages: [1,2,3,7] → "1–3, 7". */
export function formatRange(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.join(", ");
}
