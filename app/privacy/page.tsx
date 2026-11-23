import type { Metadata } from "next";
import { Contact, LegalPage, Section } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "privacy · putanything",
  description: "what putanything keeps, where it keeps it, and which outside services your browser talks to.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      eyebrow="privacy"
      title={["your boards stay on your device.", "there's no account to keep them in."]}
      lede="putanything has no sign-up, no cookies, no analytics and no ads. what you put on a board is saved in your own browser. a few widgets ask outside services for things like the weather, and this page lists each one and what it's told."
    >
      <Section title="what is kept, and where.">
        <p>
          everything on your boards is saved in this browser&apos;s <strong>IndexedDB</strong>, on the device you&apos;re
          using: notes, checklists, drawings, pasted pictures, link cards, the cities on your clocks, words you&apos;ve looked
          up, timers, and the names of your boards. it&apos;s written a moment after each change and again when you leave the
          tab.
        </p>
        <p>
          pictures and PDFs you paste or drop are read in your browser too: a PDF&apos;s pages are drawn into pictures on
          your device, and neither the file nor its pages is sent anywhere.
        </p>
        <p>
          your theme choice (light, dark or auto) is kept in <strong>localStorage</strong>. nothing else is stored, and no
          copy of your boards is sent to me or to anyone else.
        </p>
        <p>
          because it lives in the browser, a board doesn&apos;t follow you to another browser or device. to move one, save
          it as a file from the menu and open it on the other side.
        </p>
      </Section>

      <Section title="when you paste a link, this site fetches it.">
        <p>
          to turn a link into a card, the putanything server visits that address once to read its title, description,
          picture and icon, then sends those back to your browser. it only visits public web addresses, and it doesn&apos;t
          keep a list of what was fetched. the company hosting the server may keep ordinary request logs, as hosts do.
        </p>
        <p>
          a youtube card can play its video in place. only when you press &ldquo;play here&rdquo; does the board load
          youtube&apos;s player, from youtube-nocookie.com, youtube&apos;s privacy-enhanced address; from then on youtube
          sees the visit as it would on any site that embeds a video.
        </p>
        <p>
          the card&apos;s picture and icon are then loaded straight from that site, so it sees a visit from your browser the
          same way it would if you opened the page.
        </p>
      </Section>

      <Section title="three outside services, and what each one hears.">
        <ul>
          <li>
            <strong>open-meteo.com</strong>, for the weather widget: the place name you search for, and the coordinates of
            the place you pick. the first time you add the widget, it searches for the city your time zone is named after,
            so it can show your weather without asking.
          </li>
          <li>
            <strong>dictionaryapi.dev</strong>, for the dictionary: each word you look up. pressing the speaker plays a
            recording from the same service.
          </li>
          <li>
            <strong>frankfurter.dev</strong>, for currency in the converter: a request for today&apos;s european central bank
            rates. nothing you type is sent; the sum is worked out in your browser.
          </li>
        </ul>
        <p>
          like any website, each of these sees your ip address and browser when it answers. each has its own privacy
          policy. nothing is sent to any of them unless you use the widget that needs it. the typefaces are served by
          this site itself, so no font service hears about your visit.
        </p>
      </Section>

      <Section title="deleting is up to you, and it's final.">
        <p>
          take a plate off a board, clear a board, or delete a board from its tab. to remove everything, clear this
          site&apos;s data in your browser settings. there&apos;s no copy anywhere else, so once it&apos;s gone, I can&apos;t bring
          it back. files you saved from the menu are yours to keep or delete.
        </p>
      </Section>

      <Section title="if this page changes.">
        <p>
          the date at the top changes with it. if a change means something new leaves your device, it will be listed here
          before it happens.
        </p>
      </Section>

      <Contact />
    </LegalPage>
  );
}
