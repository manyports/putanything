"use client";

import { Button, Checkbox, Input, Modal, Spinner, Tabs } from "@blurrow/ui";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { formatRange, openPdf, parseRange, renderPage } from "@/lib/pdf";
import { putPages, type PageLayout } from "@/lib/actions";

/* A PDF arrives: pick the pages, choose how they lie on the board, and
   whether arrows should lead from one to the next in reading order.    */
export function PdfImport({ file, onDone }: { file: File | null; onDone: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [picked, setPicked] = useState<number[]>([]);
  const [range, setRange] = useState("");
  const [layout, setLayout] = useState<PageLayout>("row");
  const [arrows, setArrows] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!file) return;
    cancelled.current = false;
    let opened: PDFDocumentProxy | null = null;
    openPdf(file)
      .then(async (d) => {
        if (cancelled.current) return d.destroy();
        opened = d;
        setDoc(d);
        const first = Array.from({ length: Math.min(d.numPages, 12) }, (_, i) => i + 1);
        setPicked(first);
        setRange(formatRange(first));
        // thumbnails one after another, so the first pages show while the rest draw
        for (let n = 1; n <= d.numPages && !cancelled.current; n++) {
          const t = await renderPage(d, n, 220, 0.7).catch(() => null);
          if (t && !cancelled.current) setThumbs((m) => ({ ...m, [n]: t.src }));
        }
      })
      .catch(() => setError("that file couldn't be opened as a PDF. it may be damaged or password-protected."));
    return () => {
      cancelled.current = true;
      opened?.destroy();
      setDoc(null);
      setThumbs({});
      setPicked([]);
      setError(null);
      setBusy(null);
    };
  }, [file]);

  const count = doc?.numPages ?? 0;
  const toggle = (n: number) => {
    const next = picked.includes(n) ? picked.filter((p) => p !== n) : [...picked, n].sort((a, b) => a - b);
    setPicked(next);
    setRange(formatRange(next));
  };

  const put = async () => {
    if (!doc || !picked.length) return;
    setBusy({ done: 0, of: picked.length });
    const pages = [];
    for (const n of picked) {
      if (cancelled.current) return;
      const r = await renderPage(doc, n, 1500).catch(() => null);
      if (r) pages.push({ ...r, name: `${file?.name.replace(/\.pdf$/i, "") ?? "pdf"} · p${n}` });
      setBusy({ done: pages.length, of: picked.length });
    }
    await putPages(pages, layout, arrows && picked.length > 1);
    onDone();
  };

  return (
    <Modal
      open={!!file}
      onClose={onDone}
      title={file ? `pages from ${file.name}` : ""}
      description={count ? `${count} ${count === 1 ? "page" : "pages"}. press a page to leave it out or bring it back.` : undefined}
      className="max-w-[720px]!"
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onDone}>
            cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!picked.length || !!busy} onClick={put}>
            {busy ? `drawing ${busy.done} of ${busy.of}…` : `put ${picked.length} ${picked.length === 1 ? "page" : "pages"} on the board`}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-[14px] leading-[1.55] text-ink-body">{error}</p>
      ) : !doc ? (
        <div className="grid h-40 place-items-center">
          <Spinner label="opening the pdf" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="pages"
                value={range}
                onChange={(e) => {
                  setRange(e.target.value);
                  setPicked(parseRange(e.target.value, count));
                }}
                placeholder="1–3, 7"
                hint={`type a range, or press the pages below. ${picked.length} picked.`}
                fullWidth
              />
            </div>
            <div className="flex shrink-0 gap-1 pb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const all = Array.from({ length: count }, (_, i) => i + 1);
                  setPicked(all);
                  setRange(formatRange(all));
                }}
              >
                all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPicked([]);
                  setRange("");
                }}
              >
                none
              </Button>
            </div>
          </div>

          <div data-scrollable className="well grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto rounded-[14px] p-2.5 scroll-thin sm:grid-cols-6">
            {Array.from({ length: count }, (_, i) => i + 1).map((n) => {
              const on = picked.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  aria-label={`page ${n}`}
                  onClick={() => toggle(n)}
                  className="group/page relative flex flex-col items-center gap-1 cursor-pointer"
                >
                  <span
                    className="relative block aspect-[3/4] w-full overflow-hidden rounded-[6px] bg-white transition-[opacity,box-shadow,transform] duration-200"
                    style={{
                      boxShadow: on ? "0 0 0 2px var(--selection), var(--tile-shadow)" : "var(--tile-shadow)",
                      opacity: on ? 1 : 0.45,
                      transform: on ? "none" : "scale(0.96)",
                      transitionTimingFunction: "var(--ease-spring)",
                    }}
                  >
                    {thumbs[n] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbs[n]} alt="" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center">
                        <Spinner size="sm" />
                      </span>
                    )}
                  </span>
                  <span className={["text-[11px] font-medium tabular-nums", on ? "text-ink" : "text-ink-faint"].join(" ")}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="[&_[role=tab]]:h-9 [&_[role=tab]]:py-0">
              <Tabs
                tabs={[
                  { key: "row", label: "in a row" },
                  { key: "column", label: "in a column" },
                  { key: "grid", label: "in a grid" },
                  { key: "pile", label: "in a pile" },
                ]}
                defaultTab={layout}
                onChange={(k) => setLayout(k as PageLayout)}
              />
            </div>
            <Checkbox
              checked={arrows && layout !== "pile"}
              disabled={layout === "pile"}
              onChange={setArrows}
              label="arrows between them, in order"
              className="flex-row-reverse! justify-end! gap-2.5!"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
