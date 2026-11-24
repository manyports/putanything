import type { Metadata } from "next";
import { Contact, LegalPage, Section } from "@/components/legal/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "privacy · putanything",
  description: "what putanything keeps, where it keeps it, which outside services your browser talks to, and what you can do about it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      eyebrow="privacy"
      title={["your boards stay on your device.", "there's no account to keep them in."]}
      lede="putanything has no sign-up, no cookies, no analytics and no ads. what you put on a board is saved in your own browser. a few widgets ask outside services for things like the weather, and this page lists each one and exactly what it's told."
    >
      <Section title="who this is about.">
        <p>
          this policy covers the putanything website and the board it runs in your browser
          {SITE.operator ? `, run by ${SITE.operator}` : ""}. it&apos;s written for everyone who uses it, wherever you are.
          the short version: nothing you put on a board is sent to me, and I don&apos;t keep anything about you.
        </p>
      </Section>

      <Section title="what is kept on your device.">
        <p>
          everything on your boards is saved in this browser&apos;s <strong>IndexedDB</strong>, on the device you&apos;re
          using: notes, stickies, checklists, tables, code, drawings, shapes, pasted pictures, pages taken from PDFs, files you lay on
          a board, link cards and
          the previews fetched for them, the cities on your clocks and weather, words you&apos;ve looked up, timers,
          countdowns, and the names of your boards. it&apos;s written a moment after each change and again when you leave the
          tab. the site asks your browser to keep this storage rather than clear it when space runs low.
        </p>
        <p>
          a few small settings are kept in <strong>localStorage</strong>: your theme (light, dark or auto), whether the
          map is shown, and the fact that you agreed to these pages, with the version you agreed to. that&apos;s all. the
          site sets no cookies.
        </p>
        <p>
          because it lives in the browser, a board doesn&apos;t follow you to another browser or device, and anyone who can
          use this browser can see it. to move a board, save it as a file from the menu and open it on the other side.
        </p>
      </Section>

      <Section title="what reaches this site's server.">
        <p>
          <strong>pages and files.</strong> loading the site sends ordinary web requests to the server that hosts it. like
          any host, it may log each request&apos;s ip address, browser, time and page for security and to keep the site
          running, under its own retention rules. I don&apos;t use those logs to identify or follow anyone.
        </p>
        <p>
          <strong>link previews.</strong> when you paste a link, your browser sends that address to this site, which visits
          the page once to read its title, description, picture and icon and sends them back. for youtube links it asks
          youtube&apos;s oembed service instead. only public web addresses are fetched, and the addresses aren&apos;t stored
          or logged by the app.
        </p>
        <p>nothing else you do on a board is sent to the server: not your notes, not your pictures, not your boards.</p>
      </Section>

      <Section title="the outside services, and what each one hears.">
        <p>these are only contacted when you use the part of the board that needs them.</p>
        <ul>
          <li>
            <strong>open-meteo.com</strong>, for the weather widget: the place name you search for and the coordinates of
            the place you pick. the first time you add the widget, it searches for the city your time zone is named after
            (asia/almaty searches for &ldquo;almaty&rdquo;), so it can show your weather without asking.
          </li>
          <li>
            <strong>dictionaryapi.dev</strong>, for the dictionary: each word you look up. pressing the speaker plays a
            recording from the same service.
          </li>
          <li>
            <strong>frankfurter.dev</strong>, for currency in the converter: a request for the day&apos;s european central
            bank rates. nothing you type is sent; the sum is worked out in your browser.
          </li>
          <li>
            <strong>youtube</strong>, for youtube link cards: the card&apos;s picture loads from youtube&apos;s image server
            (i.ytimg.com) while the card is on a board you&apos;re looking at. the video player loads only when you press
            &ldquo;play here&rdquo;, from youtube-nocookie.com, youtube&apos;s privacy-enhanced address. once it&apos;s
            playing, youtube&apos;s own privacy policy applies, and it may store information in your browser as it would on
            any site that embeds a video.
          </li>
          <li>
            <strong>the sites you paste links to</strong>: a card&apos;s picture and icon load straight from that site, so
            it sees a visit from your browser the same way it would if you opened the page.
          </li>
        </ul>
        <p>
          the &ldquo;how it works&rdquo; board that opens on a first visit has a youtube card on it, so opening that board
          loads its picture from youtube and asks this site for its preview. if you&apos;d rather it didn&apos;t, delete the
          card or the board.
        </p>
        <p>
          like any website, each of these services sees your ip address and browser when it answers, may be in another
          country, and has its own privacy policy. the typefaces are served by this site itself, so no font service hears
          about your visit.
        </p>
      </Section>

      <Section title="things that stay with your browser.">
        <ul>
          <li>
            <strong>pictures and PDFs</strong> you paste or drop are read on your device. a PDF&apos;s pages are drawn into
            pictures in your browser; neither the file nor its pages is uploaded.
          </li>
          <li>
            <strong>files</strong> you paste or drop are kept on your device exactly as they are. they aren&apos;t opened,
            previewed, scanned or uploaded; code files are read as text so they can be shown and edited, still only in your
            browser.
          </li>
          <li>
            <strong>notifications.</strong> the timer and the countdown can notify you, but only after you switch on their
            bell and your browser asks you to allow it. notifications are made by your own browser and only while the board
            is open in a tab; nothing is sent to a push service.
          </li>
          <li>
            <strong>the clipboard.</strong> the board reads it only when you paste, and writes to it only when you copy.
          </li>
          <li>
            <strong>files you save or open</strong> (a board as a file, a board or selection as a picture) are made and read
            on your device. they hold everything on the board in plain form, so treat them like any document.
          </li>
        </ul>
      </Section>

      <Section title="what doesn't happen.">
        <p>
          no accounts, no cookies, no analytics or tracking scripts, no advertising, no profiling, and no selling or sharing
          of anything about you. what you put on a board isn&apos;t read by anyone, and isn&apos;t used to train anything.
        </p>
      </Section>

      <Section title="why each of these happens.">
        <p>
          where data protection law asks for a reason (the gdpr and laws like it): keeping your boards on your device, and
          calling an outside service when you use the widget that needs it, are what you asked the board to do. the
          host&apos;s request logs are kept for the legitimate purpose of running the site safely. your agreement on the
          first visit covers the rest.
        </p>
      </Section>

      <Section title="how long, and how to delete it.">
        <p>
          what&apos;s on your device stays there until you remove it. take a plate off a board, clear a board, or delete a
          board from its tab. to remove everything, including your settings and your agreement, clear this site&apos;s data
          in your browser settings. there&apos;s no copy anywhere else, so once it&apos;s gone I can&apos;t bring it back.
        </p>
        <p>I keep nothing about you, so there&apos;s nothing on my side to retain or delete.</p>
      </Section>

      <Section title="your rights.">
        <p>
          you have the right to know what&apos;s held about you, to correct it, to have it deleted, and to object to its
          use. since nothing about you is held by me, the answer to each is that it&apos;s already in your hands: it&apos;s
          in your browser, and you can see, change or remove it there. for what an outside service holds, ask that
          service. you can also complain to the data protection authority where you live.
        </p>
      </Section>

      <Section title="children.">
        <p>
          putanything isn&apos;t aimed at children under 13 and doesn&apos;t knowingly collect anything from anyone, of any
          age.
        </p>
      </Section>

      <Section title="keeping it safe.">
        <p>
          your boards are as safe as the device and browser they&apos;re on. the site is served over https in production,
          and the link-preview server refuses to reach private or local network addresses.
        </p>
      </Section>

      <Section title="if this page changes.">
        <p>
          the date at the top changes with it, and the board asks you to agree again before you carry on. if a change means
          something new would leave your device, it&apos;s listed here before it happens.
        </p>
      </Section>

      <Contact />
    </LegalPage>
  );
}
