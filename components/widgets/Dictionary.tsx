"use client";

import { Input, Spinner } from "@blurrow/ui";
import { memo, useEffect, useRef, useState } from "react";
import { IconSearch, IconSpeaker } from "../icons";
import { Chip, Eyebrow, type WidgetProps } from "./parts";

export interface DictData {
  word: string;
  recent: string[];
}

interface Entry {
  word: string;
  phonetic?: string;
  phonetics: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string; synonyms: string[]; antonyms: string[] }[];
    synonyms: string[];
    antonyms: string[];
  }[];
}

const cache = new Map<string, Entry[] | "missing">();

async function lookup(word: string): Promise<Entry[] | "missing"> {
  const key = word.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`);
  if (r.status === 404) {
    cache.set(key, "missing");
    return "missing";
  }
  if (!r.ok) throw new Error("dictionary");
  const j = (await r.json()) as Entry[];
  cache.set(key, j);
  return j;
}

/* Fold every entry for a word into one reading: one block per part of
   speech, definitions in order, all synonyms and antonyms pooled.     */
function fold(entries: Entry[]) {
  const phonetic = entries.find((e) => e.phonetic)?.phonetic ?? entries.flatMap((e) => e.phonetics).find((p) => p.text)?.text;
  const audio =
    entries.flatMap((e) => e.phonetics).find((p) => p.audio && /-us\.mp3$/.test(p.audio))?.audio ??
    entries.flatMap((e) => e.phonetics).find((p) => p.audio)?.audio;
  const parts = new Map<string, { defs: { d: string; ex?: string }[]; syn: Set<string>; ant: Set<string> }>();
  for (const e of entries) {
    for (const m of e.meanings) {
      const p = parts.get(m.partOfSpeech) ?? { defs: [], syn: new Set(), ant: new Set() };
      for (const d of m.definitions) {
        p.defs.push({ d: d.definition, ex: d.example });
        d.synonyms.forEach((s) => p.syn.add(s));
        d.antonyms.forEach((s) => p.ant.add(s));
      }
      m.synonyms.forEach((s) => p.syn.add(s));
      m.antonyms.forEach((s) => p.ant.add(s));
      parts.set(m.partOfSpeech, p);
    }
  }
  return { word: entries[0].word, phonetic, audio, parts: [...parts.entries()] };
}

export const Dictionary = memo(function Dictionary({ data, set }: WidgetProps<DictData>) {
  const [q, setQ] = useState(data.word);
  const [result, setResult] = useState<ReturnType<typeof fold> | "missing" | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data.word) {
      setResult(null);
      return;
    }
    let gone = false;
    setBusy(true);
    lookup(data.word)
      .then((r) => !gone && setResult(r === "missing" ? "missing" : fold(r)))
      .catch(() => !gone && setResult("error"))
      .finally(() => !gone && setBusy(false));
    scroller.current?.scrollTo({ top: 0 });
    return () => {
      gone = true;
    };
  }, [data.word]);

  const go = (w: string) => {
    const word = w.trim().toLowerCase();
    if (!word) return;
    setQ(word);
    set(
      { word, recent: [word, ...data.recent.filter((r) => r !== word)].slice(0, 8) },
      { key: `look:${word}` },
    );
  };

  const play = (src: string) => {
    const a = new Audio(src);
    a.play().catch(() => {});
  };

  return (
    <div className="flex h-full flex-col">
      <form
        className="px-3 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <Input
          placeholder="look up a word"
          aria-label="word"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          iconLeft={<IconSearch size={15} />}
          iconRight={busy ? <Spinner size="sm" /> : undefined}
          fullWidth
          autoComplete="off"
          spellCheck={false}
        />
      </form>

      <div ref={scroller} data-scrollable className="min-h-0 flex-1 overflow-y-auto scroll-thin px-4 pt-3 pb-4">
        {result === null && !busy && (
          <div>
            <p className="text-[13px] leading-[1.55] text-ink-muted max-w-[34ch]">
              definitions, how it sounds, and words that mean the same. press any of those to look it up next.
            </p>
            {data.recent.length > 0 && (
              <>
                <Eyebrow className="mt-4 mb-2">looked up lately</Eyebrow>
                <div className="-ml-1.5 flex flex-wrap gap-0.5">
                  {data.recent.map((r) => (
                    <Chip key={r} onClick={() => go(r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {result === "missing" && (
          <p className="text-[13.5px] leading-[1.55] text-ink-body">
            “{data.word}” isn&apos;t in this dictionary. check the spelling, or try the word without an ending.
          </p>
        )}
        {result === "error" && (
          <p className="text-[13.5px] leading-[1.55] text-ink-body">the dictionary didn&apos;t answer. you might be offline.</p>
        )}

        {result && typeof result === "object" && (
          <article>
            <div className="flex items-center gap-2">
              <h3 className="text-[24px] font-medium leading-tight tracking-[-0.03em] text-ink">{result.word}</h3>
              {result.audio && (
                <button
                  type="button"
                  aria-label={`hear ${result.word}`}
                  onClick={() => play(result.audio!)}
                  className="grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                >
                  <IconSpeaker size={14} />
                </button>
              )}
            </div>
            {result.phonetic && <div className="mt-0.5 text-[13px] text-ink-muted">{result.phonetic}</div>}

            {result.parts.map(([pos, p]) => (
              <section key={pos} className="mt-4">
                <Eyebrow className="mb-1.5">{pos}</Eyebrow>
                <ol className="space-y-2">
                  {p.defs.slice(0, 5).map((d, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-[1.5] text-ink-body">
                      <span className="w-3 shrink-0 text-right text-[12px] text-ink-faint tabular-nums">{i + 1}</span>
                      <span>
                        {d.d}
                        {d.ex && <span className="mt-0.5 block text-ink-muted">“{d.ex}”</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                {p.syn.size > 0 && (
                  <div className="mt-2 -ml-1.5 flex flex-wrap items-center gap-0.5">
                    <span className="ml-1.5 mr-1 text-[12px] text-ink-faint">same as</span>
                    {[...p.syn].slice(0, 8).map((s) => (
                      <Chip key={s} onClick={() => go(s)} title={`look up ${s}`}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}
                {p.ant.size > 0 && (
                  <div className="mt-0.5 -ml-1.5 flex flex-wrap items-center gap-0.5">
                    <span className="ml-1.5 mr-1 text-[12px] text-ink-faint">opposite</span>
                    {[...p.ant].slice(0, 6).map((s) => (
                      <Chip key={s} onClick={() => go(s)} title={`look up ${s}`}>
                        {s}
                      </Chip>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </article>
        )}
      </div>
    </div>
  );
});
