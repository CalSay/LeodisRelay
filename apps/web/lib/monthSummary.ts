import { naturalOrder } from './naturalOrder';
import type { Principal } from '@relay/platform';
import type { Issue } from './types';
import { reportTypeOf } from './reportTypes';
import { isSafetyRecordType } from './featureSwitch';
import { companyKey } from './companyIssues';
import { isLateOn, isOpenOn, isToCheckOn } from './issueTrend';
import { isActiveIssue } from './officeActions';
import { londonDay, periodSummary, sentReports, shiftWeek, weekEnd, weekStart, type WeekIssue, type WeekSources, type WeeklySummary } from './weeklySummary';

/**
 * One project's calendar month on one page, for the monthly progress meeting:
 * the month's figures with a row a week, where work moved on (grouped by
 * place, not report by report), what is behind or stuck, what is still open
 * and with whom at the end of the month, and a few photographs.
 *
 * Built on the weekly summary (lib/weeklySummary.ts `periodSummary`), so a
 * report, issue or variation is counted on the month exactly as it is on the
 * week it falls in. Issue standing at the month's end uses the rules Issues
 * over time uses (lib/issueTrend.ts), which on today are the register's own
 * (lib/officeActions.ts), so this month's figures match the project sheet.
 * Health and safety records are not read. It changes nothing.
 */

const MONTH = /^(\d{4})-(\d{2})$/;
const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

/** The month holding `ym` ("2026-10"), or `today`'s month when it is not a real month, as "YYYY-MM". */
export function monthOf(ym: string | undefined, today: string): string {
  const m = ym ? MONTH.exec(ym) : null;
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? ym! : today.slice(0, 7);
}
export const monthFirst = (ym: string) => `${ym}-01`;
export function monthLast(ym: string): string { const [y, m] = ym.split('-').map(Number) as [number, number]; return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); }
export function shiftMonth(ym: string, months: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
}

/** A week of the month, cut to the days that fall in the month. */
export interface MonthWeek {
  /** The Monday that starts the week, which may be in the month before: the weekly page for it. */
  monday: string;
  from: string;
  to: string;
  daysOnSite: number;
  reports: number;
  issuesRaised: number;
  issuesClosed: number;
  variationsRaised: number;
  variationsInstructed: number;
}

/** One place's progress this month: the newest line written about it, and how many there were. */
export interface MonthPlace {
  place: string;
  updates: number;
  first: string;
  latest: { day: string; text: string; author: string; trade?: string; reportId: string; reference: string };
}

/** A place where access was a problem on more than one visit this month. */
export interface MonthAccess { place: string; times: number; days: string[]; latest: string }

export interface MonthLateIssue extends WeekIssue { targetDate: string; daysLate: number }

/** A company's open issues on the project at the end of the month, the past-target ones marked. */
export interface MonthCompany { owner: string; open: MonthLateIssue[]; pastTarget: number }

export interface MonthPhoto { src: string; place: string; day: string; author: string; trade?: string; reportId: string; reference: string; caption: string }

export interface MonthSummary {
  projectId: string;
  month: string;
  start: string;
  end: string;
  /** True while the month is still going: its standing is then as of today. */
  current: boolean;
  /** The day "still open" and "past target" are read on: the month's last day, or today while it is going. */
  asOf: string;
  /** The month as the weekly summary counts it: every report, issue and variation change in the month. */
  period: WeeklySummary;
  weeks: MonthWeek[];
  places: MonthPlace[];
  /** Progress updates that said what was done but not where. */
  unplaced: number;
  pastTarget: MonthLateIssue[];
  access: MonthAccess[];
  /** Every issue open at `asOf`, by company. */
  companies: MonthCompany[];
  openAtEnd: number;
  photos: MonthPhoto[];
}

/** Up to this many places get a photograph. */
export const MONTH_PHOTOS = 8;

/** `ym` is "YYYY-MM"; `today` is today in the office calendar. Talks, permits, deliveries and safety inspections in `sources` are ignored. */
export function monthSummary(sources: WeekSources, principal: Principal, projectId: string, ym: string, today: string): MonthSummary {
  const start = monthFirst(ym), end = monthLast(ym);
  const current = today >= start && today <= end;
  const asOf = current ? today : end;
  // Progress only: safety inspections stay off the month whether or not the office has them switched on.
  const progress = sources.reports.filter(r => !isSafetyRecordType(r.reportType));
  const period = periodSummary({ reports: progress, issues: sources.issues, variations: sources.variations }, principal, projectId, start, end, today);

  // A row a week, each cut to the month, so the rows add up to the month's figures.
  const weeks: MonthWeek[] = [];
  for (let monday = weekStart(start, start); monday <= end; monday = shiftWeek(monday, 1)) {
    const from = monday < start ? start : monday, to = weekEnd(monday) > end ? end : weekEnd(monday);
    const inRow = (ymd: string) => ymd >= from && ymd <= to;
    const atIn = (rows: { at: string }[]) => rows.filter(r => inRow(londonDay(r.at))).length;
    weeks.push({ monday, from, to,
      daysOnSite: period.siteDays.filter(inRow).length,
      reports: period.reports.filter(r => inRow(r.visitDate)).length,
      issuesRaised: atIn(period.issuesRaised), issuesClosed: atIn(period.issuesClosed),
      variationsRaised: atIn(period.variationsRaised), variationsInstructed: atIn(period.variationsInstructed) });
  }

  // Where work moved on: every progress line in the month, grouped by place as written (ignoring case and spacing).
  const reports = sentReports(progress, principal, projectId).filter(r => r.visitDate >= start && r.visitDate <= end && !reportTypeOf(r).checklist)
    .sort((a, b) => a.visitDate.localeCompare(b.visitDate) || naturalOrder(a.reference, b.reference));
  const places = new Map<string, MonthPlace>();
  const access = new Map<string, MonthAccess>();
  let unplaced = 0;
  const photoAt: { key: string; photo: MonthPhoto; at: string }[] = [];
  for (const r of reports) for (const o of r.observations) {
    const place = tidy(o.location), key = place.toLowerCase(), text = tidy(o.whatHappened);
    if (o.type === 'access' && place) {
      const a = access.get(key) ?? { place, times: 0, days: [], latest: '' };
      a.times++; if (!a.days.includes(r.visitDate)) a.days.push(r.visitDate); if (text) a.latest = text;
      access.set(key, a);
    }
    if (o.type !== 'update' || !(text || place)) continue;
    if (!place) { unplaced++; continue; }
    const latest = { day: r.visitDate, text, author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}), reportId: r.id, reference: r.reference };
    const p = places.get(key);
    if (p) { p.updates++; if (text || !p.latest.text) p.latest = latest; }
    else places.set(key, { place, updates: 1, first: r.visitDate, latest });
    for (const ph of o.photos) if (ph.dataUrl) photoAt.push({ key, at: `${r.visitDate}|${ph.capturedAt ?? ''}`, photo: { src: ph.dataUrl, place, day: r.visitDate, author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}), reportId: r.id, reference: r.reference, caption: tidy(ph.caption ?? '') } });
  }

  // The newest progress photograph from each place, newest places first, up to eight.
  const photos: MonthPhoto[] = [];
  const pictured = new Set<string>();
  for (const { key, photo } of photoAt.sort((a, b) => b.at.localeCompare(a.at))) {
    if (pictured.has(key)) continue;
    // Named as the place is everywhere else on the page: as first written this month.
    pictured.add(key); photos.push({ ...photo, place: places.get(key)?.place ?? photo.place });
    if (photos.length === MONTH_PHOTOS) break;
  }

  // Standing at the month's end, as Issues over time reads it.
  const issues = sources.issues.filter(i => i.projectId === projectId);
  const asIssue = (i: Issue): MonthLateIssue => {
    const trade = i.affectedTrade ?? i.reporterTrade;
    const late = isLateOn(i, asOf, today);
    return { id: i.id, reference: i.reference, location: tidy(i.location), description: i.description, owner: tidy(i.owner), ...(trade ? { trade } : {}), at: i.raisedAt,
      status: late ? 'Past target' : isToCheckOn(i, asOf, today) ? 'Fixed, to check' : 'Open', targetDate: i.targetDate, daysLate: late ? Math.max(0, daysBetween(i.targetDate, asOf)) : 0 };
  };
  // Today, the register's own rule, so an issue with no recorded raise date still counts as it does on the sheet.
  const open = issues.filter(i => asOf === today ? isActiveIssue(i) : isOpenOn(i, asOf)).map(asIssue).sort((a, b) => naturalOrder(a.reference, b.reference));
  const pastTarget = open.filter(i => i.status === 'Past target').sort((a, b) => b.daysLate - a.daysLate || naturalOrder(a.reference, b.reference));
  const byCompany = new Map<string, MonthCompany>();
  for (const i of open) {
    const key = companyKey(i.owner);
    const c = byCompany.get(key) ?? { owner: i.owner, open: [], pastTarget: 0 };
    c.open.push(i); if (i.status === 'Past target') c.pastTarget++;
    byCompany.set(key, c);
  }
  const companies = [...byCompany.values()].sort((a, b) => b.pastTarget - a.pastTarget || b.open.length - a.open.length || (a.owner ? b.owner ? a.owner.localeCompare(b.owner) : -1 : 1));

  return {
    projectId, month: ym, start, end, current, asOf, period, weeks,
    places: [...places.values()].sort((a, b) => b.latest.day.localeCompare(a.latest.day) || naturalOrder(a.place, b.place)),
    unplaced, pastTarget,
    access: [...access.values()].filter(a => a.days.length > 1).sort((a, b) => b.times - a.times || naturalOrder(a.place, b.place)),
    companies, openAtEnd: open.length, photos,
  };
}
