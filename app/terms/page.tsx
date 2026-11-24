import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "terms · putanything",
  description: "the terms for using putanything: what it is, what's yours, and what it can't promise.",
};

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      eyebrow="terms"
      title={["a free board in your browser.", "here's what using it means."]}
      lede="by using putanything you agree to these terms. they're short because the app is: it keeps your things on your device, it asks a few public services for data, and it's offered as it is."
    >
      <Section title="what you put on it is yours.">
        <p>
          your notes, lists, drawings and pictures belong to you. they&apos;re stored in your browser, not on a server, so I
          don&apos;t have them and can&apos;t read, recover or restore them. if a board matters, save it as a file from the
          menu now and then.
        </p>
      </Section>

      <Section title="use it for ordinary things.">
        <p>please don&apos;t use putanything to:</p>
        <ul>
          <li>break the law, or help someone else break it;</li>
          <li>
            make the link-preview server fetch addresses in bulk, probe networks, or reach things you aren&apos;t allowed to
            reach;
          </li>
          <li>overload the site or the services it relies on, or get around the limits they set.</li>
        </ul>
        <p>if you do, access may be blocked.</p>
      </Section>

      <Section title="the outside data can be wrong.">
        <p>
          weather comes from <a href="https://open-meteo.com" rel="noreferrer">open-meteo.com</a> under the cc by 4.0
          licence. definitions come from <a href="https://dictionaryapi.dev" rel="noreferrer">dictionaryapi.dev</a>, which
          draws on wiktionary. exchange rates come from the european central bank through{" "}
          <a href="https://frankfurter.dev" rel="noreferrer">frankfurter.dev</a>, published once each working day, and,
          for currencies the central bank doesn&apos;t publish, from{" "}
          <a href="https://www.exchangerate-api.com" rel="noreferrer">exchange rate api</a>, updated daily.
        </p>
        <p>
          youtube videos that play in a card are youtube&apos;s, shown through youtube&apos;s own player and under its
          terms. link cards show what each page says about itself; that content belongs to its owners.
        </p>
        <p>
          any of these can be late, missing or wrong. don&apos;t rely on the forecast for anything safety-related, or on
          the rates for a trade. unit conversions are worked out in your browser and rounded for display.
        </p>
      </Section>

      <Section title="it comes as it is.">
        <p>
          putanything is provided free and without warranties of any kind: it may change, break, lose data in your browser,
          or stop being available, without notice. as far as the law allows, I&apos;m not liable for any loss that comes from
          using it, including lost boards, missed timers or a wrong conversion. some places don&apos;t allow these limits, and
          where they don&apos;t, they apply only as far as they can.
        </p>
      </Section>

      <Section title="privacy has its own page.">
        <p>
          what&apos;s kept, where, and which services hear about it is set out on the <Link href="/privacy">privacy page</Link>
          .
        </p>
      </Section>

      <Section title="if these terms change.">
        <p>
          the date at the top changes with them. carrying on with the board after a change means you accept the new
          version.
        </p>
      </Section>

      <Contact />
    </LegalPage>
  );
}
