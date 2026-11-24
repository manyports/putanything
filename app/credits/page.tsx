import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "credits · putanything",
  description: "the typefaces and code putanything is made with, their authors, and their licences.",
};

/* Read at build time from the files this site serves, so what's shown here
   is exactly the licence that travels with the fonts and code.          */
function licence(file: string) {
  return readFileSync(path.join(process.cwd(), "public", "licenses", file), "utf8").trim();
}

const FONTS = [
  {
    name: "archivo",
    by: "the archivo project authors, designed by omnibus-type",
    use: "every word on the board and on these pages",
    source: "https://github.com/Omnibus-Type/Archivo",
    file: "archivo-OFL.txt",
  },
  {
    name: "caveat",
    by: "the caveat project authors, designed by pablo impallari",
    use: "handwritten notes",
    source: "https://github.com/googlefonts/caveat",
    file: "caveat-OFL.txt",
  },
];

const CODE = [
  { name: "pdf.js", by: "mozilla", licence: "apache 2.0", source: "https://github.com/mozilla/pdf.js", file: "pdfjs-Apache-2.0.txt", use: "reading pdf pages" },
  { name: "perfect-freehand", by: "steve ruiz", licence: "mit", source: "https://github.com/steveruizok/perfect-freehand", file: "perfect-freehand-MIT.txt", use: "the shape of pen lines" },
  { name: "next.js", by: "vercel", licence: "mit", source: "https://github.com/vercel/next.js", file: "next-MIT.txt", use: "the site itself" },
  { name: "react", by: "meta platforms", licence: "mit", source: "https://github.com/facebook/react", file: "react-MIT.txt", use: "the interface" },
  { name: "react-dom", by: "meta platforms", licence: "mit", source: "https://github.com/facebook/react", file: "react-dom-MIT.txt", use: "the interface" },
];

function LicenceText({ file }: { file: string }) {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer text-[13px] font-medium text-ink-muted hover:text-ink transition-colors">
        read the licence
      </summary>
      <pre className="well mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-[12px] p-4 font-mono text-[12px] leading-[1.6] text-ink-body scroll-thin">
        {licence(file)}
      </pre>
      <a href={`/licenses/${file}`} className="mt-2 inline-block text-[12.5px]">
        the same text as a file
      </a>
    </details>
  );
}

export default function CreditsPage() {
  return (
    <LegalPage
      current="/credits"
      eyebrow="credits"
      title={["made with other people's work.", "here's whose, and on what terms."]}
      lede="two typefaces and a handful of open-source libraries make this board. each is used under its licence, and each licence is published here in full, as those licences ask."
    >
      <Section title="two typefaces, both under the open font license.">
        <p>
          the sil open font license lets fonts be used and served freely, as long as the copyright notice and the licence
          travel with them and the fonts aren&apos;t sold on their own. neither font has a reserved name, and neither is
          changed here.
        </p>
        {FONTS.map((f) => (
          <div key={f.name} className="border-t border-[var(--divider)] pt-4">
            <div className="text-[16px] font-medium text-ink">{f.name}</div>
            <p className="mt-1">
              by {f.by}. used for {f.use}. licence: sil open font license 1.1.{" "}
              <a href={f.source} rel="noreferrer">
                source
              </a>
            </p>
            <LicenceText file={f.file} />
          </div>
        ))}
      </Section>

      <Section title="the code it's built on.">
        {CODE.map((c) => (
          <div key={c.name} className="border-t border-[var(--divider)] pt-4">
            <div className="text-[16px] font-medium text-ink">{c.name}</div>
            <p className="mt-1">
              by {c.by}, for {c.use}. licence: {c.licence}.{" "}
              <a href={c.source} rel="noreferrer">
                source
              </a>
            </p>
            <LicenceText file={c.file} />
          </div>
        ))}
      </Section>

      <Section title="the data the widgets show.">
        <p>
          weather from <a href="https://open-meteo.com" rel="noreferrer">open-meteo.com</a>, under cc by 4.0. definitions
          from the <a href="https://dictionaryapi.dev" rel="noreferrer">free dictionary api</a>, drawn from wiktionary under
          cc by-sa. exchange rates from the european central bank, through{" "}
          <a href="https://frankfurter.dev" rel="noreferrer">frankfurter.dev</a>, and{" "}
          <a href="https://www.exchangerate-api.com" rel="noreferrer">rates by exchange rate api</a> for the other
          currencies, like the kazakhstani tenge.
        </p>
      </Section>
    </LegalPage>
  );
}
