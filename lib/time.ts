export function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function zoneCity(zone: string) {
  const last = zone.split("/").pop() || zone;
  return last.replace(/_/g, " ").toLowerCase();
}

export function zoneRegion(zone: string) {
  const parts = zone.split("/");
  return parts.length > 1 ? parts.slice(0, -1).join(" / ").replace(/_/g, " ").toLowerCase() : "";
}

// Building a formatter costs far more than using one; keep one per zone.
const offsetFmt = new Map<string, Intl.DateTimeFormat>();
const partsFmt = new Map<string, Intl.DateTimeFormat>();

/** Minutes east of UTC for `zone` at instant `d`. */
export function zoneOffset(zone: string, d = new Date()) {
  let f = offsetFmt.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFmt.set(zone, f);
  }
  const parts = f.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

export function zoneParts(zone: string, d: Date) {
  let f = partsFmt.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    partsFmt.set(zone, f);
  }
  const parts = f.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday").toLowerCase(),
    day: Number(get("day")),
    month: get("month").toLowerCase(),
  };
}

export function formatClock(h: number, m: number, h24: boolean) {
  const mm = String(m).padStart(2, "0");
  if (h24) return `${String(h).padStart(2, "0")}:${mm}`;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${mm}`;
}

export function formatOffset(mins: number) {
  if (mins === 0) return "same time";
  const sign = mins > 0 ? "+" : "−";
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}h`;
}

export function allZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    const z = intl.supportedValuesOf?.("timeZone");
    if (z && z.length) return z;
  } catch {}
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Moscow",
    "Africa/Cairo",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Almaty",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** What someone types for a length of time, in seconds: "7:30", "1:15:00", "90" (minutes), "1h 20m", "45s", "2.5". */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/,/g, ".");
  if (!t) return null;
  if (/^\d+(:\d{1,2}){1,2}$/.test(t)) {
    const parts = t.split(":").map(Number);
    if (parts.slice(1).some((p) => p >= 60)) return null;
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  if (/^\d*\.?\d+$/.test(t)) return Math.round(Number(t) * 60);
  const re = /(\d*\.?\d+)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)/g;
  let total = 0;
  let matched = "";
  for (const m of t.matchAll(re)) {
    const n = Number(m[1]);
    const u = m[2][0];
    total += u === "h" ? n * 3600 : u === "m" ? n * 60 : n;
    matched += m[0];
  }
  if (!matched || t.replace(/\s+/g, "") !== matched.replace(/\s+/g, "")) return null;
  return Math.round(total);
}

/* Desktop notifications, for a timer that ends or a day that arrives while the
   tab is in the background. They only fire while the board is open in a tab. */
export async function askToNotify(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

export function notify(title: string, body?: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, silent: false });
  } catch {}
}
