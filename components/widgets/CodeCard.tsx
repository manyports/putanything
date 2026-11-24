"use client";

import { Button, Modal } from "@blurrow/ui";
import { memo, useMemo, useState } from "react";
import { TOKEN_CLASS, extFor, highlight } from "@/lib/code";
import { IconCopy, IconDownload, IconExternal, IconPen } from "../icons";
import { RailKey, type WidgetProps } from "./parts";

export interface CodeData {
  code: string;
  lang: string;
  /** the file it came from, if it came from one */
  name?: string;
  /** being edited in place */
  editing?: boolean;
  /** open in the big reading view */
  open?: boolean;
}

/** numbered, coloured lines of code */
function CodeLines({ code, lang, size = 12.5 }: { code: string; lang: string; size?: number }) {
  const lines = useMemo(() => highlight(code, lang), [code, lang]);
  const gutter = String(lines.length).length;
  return (
    <>
      {lines.map((toks, i) => (
        <div key={i} className="flex" style={{ fontSize: size }}>
          <span aria-hidden className="shrink-0 pr-3 pl-3.5 text-right text-ink-ghost select-none" style={{ width: `${gutter + 3.2}ch` }}>
            {i + 1}
          </span>
          <span className="pr-4 whitespace-pre">
            {toks.length
              ? toks.map((t, j) => (
                  <span key={j} className={TOKEN_CLASS[t.t]}>
                    {t.v}
                  </span>
                ))
              : " "}
          </span>
        </div>
      ))}
    </>
  );
}

/* A block of code on the board: coloured, monospaced, line-numbered. Double-
   click (or the pencil key) to edit it in place; the open key shows it big. */
export const CodeCard = memo(function CodeCard({ data, set }: WidgetProps<CodeData>) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-3.5 py-2">
        <span className="truncate font-mono text-[12px] text-ink-label">{data.name ?? "snippet"}</span>
        <span className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium text-ink-muted" style={{ background: "var(--well)", boxShadow: "var(--well-shadow)" }}>
          {data.lang === "code" ? "code" : data.lang}
        </span>
      </div>
      {data.editing ? (
        <textarea
          autoFocus
          value={data.code}
          onChange={(e) => set({ code: e.target.value }, { key: "code" })}
          onBlur={() => set({ editing: false }, { history: false })}
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
            // tab indents instead of leaving the field
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const a = el.selectionStart;
              const next = data.code.slice(0, a) + "  " + data.code.slice(el.selectionEnd);
              set({ code: next }, { key: "code" });
              requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2));
            }
          }}
          spellCheck={false}
          data-scrollable
          className="min-h-0 flex-1 resize-none bg-transparent px-3.5 py-3 font-mono text-[12.5px] leading-[1.65] text-ink-soft outline-none scroll-thin"
          style={{ tabSize: 2, whiteSpace: "pre", overflowWrap: "normal" }}
        />
      ) : (
        <pre
          data-scrollable
          title="double-click to edit"
          onDoubleClick={() => set({ editing: true }, { history: false })}
          className="min-h-0 flex-1 overflow-auto py-3 font-mono text-[12.5px] leading-[1.65] text-ink-soft scroll-thin"
          style={{ tabSize: 2 }}
        >
          <CodeLines code={data.code} lang={data.lang} />
        </pre>
      )}
      <Modal
        open={!!data.open}
        onClose={() => set({ open: false }, { history: false })}
        title={data.name ?? "snippet"}
        description={`${data.lang === "code" ? "code" : data.lang} · ${data.code.split("\n").length} lines`}
        className="max-w-[min(1000px,94vw)]!"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              navigator.clipboard?.writeText(data.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              })
            }
          >
            <IconCopy size={14} /> {copied ? "copied" : "copy"}
          </Button>
        }
      >
        {/* the same colours as on the board, bigger, and as tall as the screen allows */}
        <pre className="well max-h-[66vh] overflow-auto rounded-[12px] py-4 font-mono leading-[1.7] text-ink-soft scroll-thin" style={{ tabSize: 2 }}>
          <CodeLines code={data.code} lang={data.lang} size={13.5} />
        </pre>
      </Modal>
    </div>
  );
});

export function CodeRail({ data, set }: WidgetProps<CodeData>) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <RailKey label="open it big" onClick={() => set({ open: true }, { history: false })}>
        <IconExternal size={13} />
      </RailKey>
      <RailKey label={data.editing ? "done editing" : "edit"} active={data.editing} onClick={() => set({ editing: !data.editing }, { history: false })}>
        <IconPen size={13} />
      </RailKey>
      <RailKey
        label={copied ? "copied" : "copy the code"}
        onClick={() =>
          navigator.clipboard?.writeText(data.code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
        }
      >
        <IconCopy size={13} />
      </RailKey>
      <RailKey
        label="save as a file"
        onClick={() => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([data.code], { type: "text/plain" }));
          a.download = data.name ?? `snippet.${extFor(data.lang)}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }}
      >
        <IconDownload size={13} />
      </RailKey>
    </>
  );
}
