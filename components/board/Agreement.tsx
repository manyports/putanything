"use client";

import { Button, Checkbox } from "@blurrow/ui";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { CHANGES, SITE, agreedVersion } from "@/lib/site";

/* The board doesn't open, and no widget calls anyone, until the terms and
   privacy policy have been agreed to on this device. The answer is kept
   with the version of the pages it agreed to. When the pages change, the
   person is asked again, and shown exactly what changed since then.     */
const KEY = "putanything:agreed";
const AGREED = `${SITE.updated}#${SITE.version}`;
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** what's stored: a string, null if never agreed, undefined while the page is still being drawn on the server */
function useStored() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(),
    () => undefined,
  );
}

function agree() {
  try {
    localStorage.setItem(KEY, AGREED);
  } catch {}
  listeners.forEach((l) => l());
}

const TERMS_SHORT = [
  "it's free and comes as it is. it may change or break, so save boards you care about as files.",
  "what you put on a board is yours. it lives in your browser, so I can't see it, or bring it back if it's lost.",
  "outside data (weather, words, rates, link previews) can be late or wrong.",
  "use it for ordinary things; don't use it to break the law or to hammer other sites.",
];

const PRIVACY_SHORT = [
  "no account, no cookies, no analytics, no ads. nothing about you is kept or sold.",
  "your boards, pictures and files are saved on this device and never uploaded.",
  "a widget asks a public service only when you use it: open-meteo for weather, dictionaryapi.dev for words, the european central bank and exchangerate-api.com for rates.",
  "a pasted link is previewed through this site; youtube's player loads only when you press play.",
];

function Short({ title, lines, href }: { title: string; lines: string[]; href: string }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium text-ink">{title}</h2>
        <a href={href} target="_blank" className="text-[12px] text-ink-muted underline decoration-ink-ghost underline-offset-[3px] hover:text-ink">
          read it all
        </a>
      </div>
      <ul className="mt-2 space-y-1.5">
        {lines.map((l) => (
          <li key={l} className="flex gap-2 text-[13px] leading-[1.5] text-ink-body">
            <span aria-hidden className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
            <span className="text-pretty">{l}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
};

export function Agreement({ children }: { children: ReactNode }) {
  const stored = useStored();
  const [ticked, setTicked] = useState(false);

  // server render and first paint: a bare board, so a returning visitor never sees the card flash
  if (stored === undefined) return <div className="board-dots fixed inset-0" style={{ backgroundSize: "24px 24px" }} />;
  if (stored === AGREED) return <>{children}</>;

  const was = agreedVersion(stored);
  const returning = was !== null;
  const since = returning ? CHANGES.filter((c) => c.version > was) : [];

  return (
    <div className="board-dots fixed inset-0 overflow-y-auto" style={{ backgroundSize: "24px 24px" }}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agree-title"
          className="animate-plate-drop w-full max-w-[520px] rounded-[24px] p-1.5"
          style={{ background: "var(--panel-bezel)", boxShadow: "var(--modal-shadow)" }}
        >
          <div className="plate-face rounded-[18px] px-6 pt-6 pb-5">
            <div className="text-[13px] font-medium text-ink-muted">{returning ? "a few things changed" : "before you start"}</div>
            <h1 id="agree-title" className="mt-2 text-[28px] font-medium leading-[1.05] tracking-[-0.04em] text-balance">
              {returning ? (
                <>
                  <span className="block text-ink">the pages changed a little.</span>
                  <span className="block text-ink-faint">here&apos;s what, before you carry on.</span>
                </>
              ) : (
                <>
                  <span className="block text-ink">your boards stay on this device.</span>
                  <span className="block text-ink-faint">a few widgets ask outside services.</span>
                </>
              )}
            </h1>

            {returning && since.length > 0 && (
              // only what changed since the version this person agreed to, newest first
              <div className="well mt-5 rounded-[12px] px-4 py-3.5">
                <div className="text-[12px] font-medium text-ink-muted">since you last agreed</div>
                <ol className="mt-2 space-y-3">
                  {since.map((c) => (
                    <li key={c.version}>
                      <div className="text-[11.5px] font-medium text-ink-faint tabular-nums">{day(c.date)}</div>
                      <ul className="mt-1 space-y-1">
                        {c.changes.map((line) => (
                          <li key={line} className="flex gap-2 text-[13px] leading-[1.5] text-ink-body">
                            <span aria-hidden className="text-ink-faint">+</span>
                            <span className="text-pretty">{line}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-[12px] leading-[1.5] text-ink-muted">
                  nothing new leaves your device without you using the widget that needs it.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-4">
              <Short title="the terms, in short" lines={TERMS_SHORT} href="/terms" />
              <div className="h-px" style={{ background: "var(--divider)" }} />
              <Short title="privacy, in short" lines={PRIVACY_SHORT} href="/privacy" />
            </div>

            <div className="well mt-5 rounded-[12px] px-3.5 py-3">
              <Checkbox
                checked={ticked}
                onChange={setTicked}
                label={returning ? "I've read what changed and agree to the updated terms and privacy policy" : "I've read and agree to the terms and the privacy policy"}
                className="flex-row-reverse! justify-end! gap-3!"
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[12px] text-ink-faint">
                {returning ? "your boards are all still here" : "asked once on this device"}
              </span>
              <Button variant="primary" size="md" disabled={!ticked} onClick={agree}>
                {returning ? "agree and carry on" : "open the board"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
