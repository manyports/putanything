import Link from "next/link";
import type { ReactNode } from "react";
import { SITE } from "@/lib/site";
import { IconMenu } from "@/components/icons";

function updatedOn() {
  const [y, m, d] = SITE.updated.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toLowerCase();
}

const NAV = [
  { href: "/", label: "the board" },
  { href: "/privacy", label: "privacy" },
  { href: "/terms", label: "terms" },
  { href: "/credits", label: "credits" },
];

/* One grey page, one header, one column that hangs from the left edge. */
export function LegalPage({
  current,
  eyebrow,
  title,
  lede,
  children,
}: {
  current: "/privacy" | "/terms" | "/credits";
  eyebrow: string;
  title: [string, string];
  lede: string;
  children: ReactNode;
}) {
  return (
    // the page scrolls inside its own frame, so nothing set on html or body can pin it
    <div className="fixed inset-0 overflow-y-auto overscroll-contain bg-page">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        {/* the board's own top bar: the same plate, the same mark, pages as its tabs */}
        <header className="animate-header-in fixed top-4 left-4 z-10">
          <nav
            aria-label="site"
            className="inline-flex max-w-full items-center gap-1 rounded-[16px] p-[5px]"
            style={{ background: "var(--panel-bezel)", boxShadow: "var(--overlay-shadow)" }}
          >
            <Link
              href="/"
              className="flex h-9 shrink-0 items-center gap-2 rounded-[10px] pr-3 pl-2.5 text-[14px] font-medium tracking-[-0.02em] text-ink transition-colors hover:bg-surface-hover"
            >
              <IconMenu size={15} className="text-ink-muted" />
              <span className="max-sm:hidden">putanything</span>
            </Link>
            <span aria-hidden className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--divider)" }} />
            <div className="flex items-center gap-0.5">
              {NAV.filter((n) => n.href !== "/").map((n) => {
                const on = n.href === current;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    aria-current={on ? "page" : undefined}
                    className={[
                      "flex h-9 items-center rounded-[10px] px-3 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-200",
                      on ? "text-ink" : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                    ].join(" ")}
                    style={on ? { background: "var(--face)", boxShadow: "var(--face-shadow)", textShadow: "var(--emboss)" } : undefined}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </header>

        <main className="pt-32 pb-28 sm:pt-40 sm:pb-40">
          <div className="text-[13px] font-medium text-ink-muted">{eyebrow}</div>
          <h1 className="mt-3 text-[clamp(34px,5.6vw,72px)] font-medium leading-[1.02] tracking-[-0.05em] text-balance">
            <span className="block text-ink">{title[0]}</span>
            <span className="block text-ink-faint">{title[1]}</span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.6] text-ink-body text-pretty sm:text-[18px]">{lede}</p>
          <p className="mt-4 text-[13px] text-ink-faint">last changed {updatedOn()}</p>

          <div className="mt-16 max-w-[64ch] space-y-12 sm:mt-24">{children}</div>
        </main>

        <footer className="border-t border-[var(--divider)] py-10 text-[13px] text-ink-muted">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-ink transition-colors">
                {n.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-ink-faint">
            putanything keeps your boards in your browser, not on a server.
            {SITE.operator ? ` run by ${SITE.operator}.` : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[clamp(22px,2.4vw,28px)] font-medium leading-[1.15] tracking-[-0.03em] text-ink text-balance">{title}</h2>
      <div className="mt-4 space-y-4 text-[15.5px] leading-[1.65] text-ink-body text-pretty [&_a]:text-ink [&_a]:underline [&_a]:decoration-ink-ghost [&_a]:underline-offset-[3px] hover:[&_a]:decoration-ink-faint [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function Contact() {
  if (!SITE.contact) return null;
  return (
    <Section title="questions go to one inbox.">
      <p>
        write to <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>
        {SITE.operator ? `. it reaches ${SITE.operator}` : ""}.
      </p>
    </Section>
  );
}
