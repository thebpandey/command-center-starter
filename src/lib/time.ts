import { OWNER_TIMEZONE } from "./env-public";

export type Range = "today" | "week" | "month";

function parts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(d)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute, s: p.second };
}

/** Local calendar date (YYYY-MM-DD) in the owner's time zone. */
export function localDate(d: Date = new Date(), tz = OWNER_TIMEZONE): string {
  const p = parts(d, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function tzOffsetMs(d: Date, tz: string): number {
  const p = parts(d, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for a YYYY-MM-DD date in tz. */
export function startOfLocalDay(date: string, tz = OWNER_TIMEZONE): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const off = tzOffsetMs(guess, tz);
  const first = new Date(guess.getTime() - off);
  const off2 = tzOffsetMs(first, tz);
  return off2 === off ? first : new Date(guess.getTime() - off2);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function rangeBounds(range: Range, now: Date = new Date(), tz = OWNER_TIMEZONE) {
  const today = localDate(now, tz);
  const days = range === "today" ? 1 : range === "week" ? 7 : 30;
  const endDate = addDays(today, days);
  return {
    startDate: today,
    endDateExclusive: endDate,
    from: startOfLocalDay(today, tz),
    to: startOfLocalDay(endDate, tz),
  };
}

const fmt = (opts: Intl.DateTimeFormatOptions, tz = OWNER_TIMEZONE) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts });

export const fmtTime = (iso: string) => fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const fmtTime24 = (iso: string) => fmt({ hour: "numeric", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(/^0(?=\d:)/, "");
export const fmtDayShort = (iso: string) => fmt({ weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
export const fmtHeaderDate = (d: Date = new Date()) => fmt({ weekday: "short", month: "short", day: "numeric" }).format(d);

/** "9:14 AM" if today, "Yesterday", else "Oct 21". */
export function fmtWhen(iso: string, now: Date = new Date()): string {
  const day = localDate(new Date(iso));
  const today = localDate(now);
  if (day === today) return fmtTime(iso);
  if (day === addDays(today, -1)) return "Yesterday";
  return fmt({ month: "short", day: "numeric" }).format(new Date(iso));
}

/** Due-date label for a date-only value: Today, Tomorrow, weekday within a week, else "Oct 21". */
export function fmtDueDate(date: string, now: Date = new Date()): string {
  const today = localDate(now);
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  if (date === addDays(today, -1)) return "Yesterday";
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const diff = (Date.parse(date) - Date.parse(today)) / 86400000;
  const opts: Intl.DateTimeFormatOptions = Math.abs(diff) < 7 ? { weekday: "short" } : { month: "short", day: "numeric" };
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(noonUtc);
}

export function greeting(now: Date = new Date()): string {
  const h = parts(now, OWNER_TIMEZONE).h;
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
