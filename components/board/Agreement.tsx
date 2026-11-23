"use client";

import { Button, Checkbox } from "@blurrow/ui";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { SITE } from "@/lib/site";

/* The board doesn't open, and no widget calls anyone, until the terms and
   privacy policy have been agreed to on this device. The answer is kept
   with the date of the pages it agreed to, so a later change asks again. */
const KEY = "putanything:agreed";
// what was agreed to: the pages' date and version together
const AGREED = `${SITE.updated}#${SITE.version}`;
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function useAgreed() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read() === AGREED,
    () => null,
  );
}

function agree() {
  try {
    localStorage.setItem(KEY, AGREED);
  } catch {}
  listeners.forEach((l) => l());
}

export function Agreement({ children }: { children: ReactNode }) {
  const agreed = useAgreed();
  const [ticked, setTicked] = useState(false);

  // server render and first paint: a bare board, so a returning visitor never sees the card flash
  if (agreed === null) return <div className="board-dots fixed inset-0" style={{ backgroundSize: "24px 24px" }} />;
  if (agreed) return <>{children}</>;

  return (
    <div className="board-dots fixed inset-0 overflow-y-auto" style={{ backgroundSize: "24px 24px" }}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agree-title"
          className="animate-plate-drop w-full max-w-[440px] rounded-[24px] p-1.5"
          style={{ background: "var(--panel-bezel)", boxShadow: "var(--modal-shadow)" }}
        >
          <div className="plate-face rounded-[18px] px-6 pt-6 pb-5">
            <div className="text-[13px] font-medium text-ink-muted">before you start</div>
            <h1 id="agree-title" className="mt-2 text-[28px] font-medium leading-[1.05] tracking-[-0.04em] text-balance">
              <span className="block text-ink">your boards stay on this device.</span>
              <span className="block text-ink-faint">a few widgets ask outside services.</span>
            </h1>
            <p className="mt-4 text-[14.5px] leading-[1.55] text-ink-body text-pretty">
              there&apos;s no account and nothing is uploaded. the weather, dictionary and currency widgets ask public services
              for data, and pasted links are previewed through this site. the{" "}
              <a href="/privacy" target="_blank" className="text-ink underline decoration-ink-ghost underline-offset-[3px] hover:decoration-ink-faint">
                privacy policy
              </a>{" "}
              lists each one, and the{" "}
              <a href="/terms" target="_blank" className="text-ink underline decoration-ink-ghost underline-offset-[3px] hover:decoration-ink-faint">
                terms
              </a>{" "}
              say what using it means.
            </p>
            <div className="mt-5 rounded-[12px] px-3.5 py-3 well">
              <Checkbox
                checked={ticked}
                onChange={setTicked}
                label="I've read and agree to the terms and the privacy policy"
                className="flex-row-reverse! justify-end! gap-3!"
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-[12px] text-ink-faint">asked once on this device</span>
              <Button variant="primary" size="md" disabled={!ticked} onClick={agree}>
                open the board
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
