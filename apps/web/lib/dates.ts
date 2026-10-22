/**
 * Dates and times in one style on every page: "Wed 21 Oct", "Wednesday 21
 * October 2026", "21 Oct 2026", "Wed 21 Oct, 14:05", always UK time.
 *
 * Written out from parts rather than with the browser's own en-GB pattern,
 * because the phone and the server do not agree on it: Chromium writes
 * "Wed, 21 Oct" and "Sept" where Node writes "Wed 21 Oct" and "Sep", so the
 * same date read differently from page to page, and even within one page
 * between the first paint and the next.
 *
 * Each takes an ISO time ("2026-10-21T13:05:00Z") or a calendar day
 * ("2026-10-21"). A calendar day is the day as written, never shifted by a
 * time zone. Anything missing or unreadable gives ''.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const short = (word: string) => word.slice(0, 3);

const LONDON = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

interface Parts { year: number; month: number; day: number; weekday: number; time?: string }

function parts(value: string | undefined | null): Parts | undefined {
  if (!value) return undefined;
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (calendar) {
    const [year, month, day] = [Number(calendar[1]), Number(calendar[2]), Number(calendar[3])];
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCMonth() === month - 1 ? { year, month, day, weekday: d.getUTCDay() } : undefined;
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return undefined;
  const p = Object.fromEntries(LONDON.formatToParts(at).map(x => [x.type, x.value]));
  const [year, month, day] = [Number(p.year), Number(p.month), Number(p.day)];
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), time: `${p.hour}:${p.minute}` };
}

const thisYear = () => Number(LONDON.formatToParts(new Date()).find(x => x.type === 'year')?.value);
/** 'auto' adds the year only when it is not this year. */
type Year = boolean | 'auto';
const yearPart = (p: Parts, year: Year) => (year === true || (year === 'auto' && p.year !== thisYear()) ? ` ${p.year}` : '');

/** "Wed 21 Oct" (with " 2026" when asked, or when not this year). */
export function dayShort(value: string | undefined | null, year: Year = 'auto'): string {
  const p = parts(value);
  return p ? `${short(DAYS[p.weekday]!)} ${p.day} ${short(MONTHS[p.month - 1]!)}${yearPart(p, year)}` : '';
}

/** "Wednesday 21 October 2026". */
export function dayLong(value: string | undefined | null, year: Year = true): string {
  const p = parts(value);
  return p ? `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}${yearPart(p, year)}` : '';
}

/** "21 Oct 2026": a date inside a sentence or a list, where the weekday adds nothing. */
export function dateShort(value: string | undefined | null, year: Year = true): string {
  const p = parts(value);
  return p ? `${p.day} ${short(MONTHS[p.month - 1]!)}${yearPart(p, year)}` : '';
}

/** "Wed 21 Oct, 14:05": when something was sent, saved or received. A calendar day has no time. */
export function whenShort(value: string | undefined | null, year: Year = 'auto'): string {
  const p = parts(value);
  return p ? `${dayShort(value, year)}${p.time ? `, ${p.time}` : ''}` : '';
}

/** "14:05", UK time. */
export function timeOf(value: string | undefined | null): string {
  return parts(value)?.time ?? '';
}

/** Whole calendar days from `from` to `to`, both "YYYY-MM-DD" ("2026-10-21" to "2026-10-22" is 1); 0 when either is unreadable. */
export function daysBetween(from: string, to: string): number {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  return Number.isFinite(days) ? days : 0;
}

/**
 * "1 day past target", "349 days past target": how long a late item has
 * waited, in the words of the office issue sheet. Said instead of the target
 * date, which without its year reads as a day still to come.
 */
export function pastTarget(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'} past target`;
}
