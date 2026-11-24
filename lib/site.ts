/* Who runs this copy of putanything. The privacy and terms pages read
   from here; fill in the contact before you put the site in public.   */
export const SITE = {
  name: "putanything",
  /** a person or a company: "ada lovelace", "acme ltd" */
  operator: "",
  /** an email address people can write to about these pages */
  contact: "",
  /** the day these pages last changed */
  updated: "2026-11-24",
  /** bumped whenever the terms or privacy policy change, so everyone is asked to agree again */
  version: 3,
};

/* What changed in the terms and privacy policy, newest first. Someone who
   agreed to an earlier version is shown the entries since then, so a
   second request to agree never looks like something slipped past them. */
export const CHANGES: { version: number; date: string; changes: string[] }[] = [
  {
    version: 3,
    date: "2026-11-24",
    changes: [
      "files you drop on a board are kept on your device as they are: never opened, scanned or uploaded.",
      "currencies the european central bank doesn't publish (the tenge, for one) now come from exchangerate-api.com.",
    ],
  },
  {
    version: 2,
    date: "2026-11-23",
    changes: [
      "youtube cards are listed: their pictures load from youtube, and the player only when you press play.",
      "the policy now covers notifications, the clipboard, pdfs, saved files, your rights, children and security.",
    ],
  },
];

/** the version someone agreed to, from what's stored: "2026-11-23" (before versions) is 1 */
export function agreedVersion(stored: string | null): number | null {
  if (!stored) return null;
  const v = Number(stored.split("#")[1]);
  return Number.isFinite(v) && v > 0 ? v : 1;
}
