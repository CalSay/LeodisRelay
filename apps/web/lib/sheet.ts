/**
 * What every register spreadsheet shares, so the issue, variation, permit and
 * toolbox talk files read as one set: one way to write a cell (with the
 * formula protection from the security review), one way to write a day and a
 * time, and one way to name the file.
 *
 * House order for a register's columns: the record's own reference (when it
 * has one), then `Project number` and `Project`, then what it is, then each
 * event as "<event> on" before "<event> by", then the status. A record
 * withdrawn by mistake keeps its row, with `Withdrawn on`, `Withdrawn by` and
 * `Withdrawn because` last.
 *
 * Pure, and free of the register rules, so a project page can build its file
 * without loading the office's.
 */

export type Cell = string | number | undefined;

/**
 * A cell that starts with = + - @ (or a tab or carriage return) would be run
 * as a formula when the file is opened in Excel, so typed text is led with an
 * apostrophe. Numbers are written as numbers, so a negative margin stays a sum.
 */
function cell(value: Cell): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 rows with CRLF endings, led by a byte-order mark so Excel reads £ and accents as UTF-8. */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export type RegisterKind = 'issues' | 'variations' | 'permits' | 'toolbox-talks';

/** `relay-issues-2026-10-20.csv`, or `relay-permits-011LME-2026-10-21.csv` when the file is for one project. */
export function registerFileName(kind: RegisterKind, day: string, projectNumber?: string): string {
  const scope = projectNumber?.replace(/[^A-Za-z0-9-]+/g, '') || '';
  return `relay-${kind}${scope ? `-${scope}` : ''}-${day}.csv`;
}

const LONDON = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function london(iso: string | undefined): { day: string; time: string } | undefined {
  if (!iso) return undefined;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return undefined;
  const p = Object.fromEntries(LONDON.formatToParts(at).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * A day for a spreadsheet, `2026-10-21`, which Excel and LibreOffice read as a
 * date. A moment (an ISO time) gives its day in the UK, so something raised at
 * half past midnight in summer is on the day people saw it, not the day
 * before in UTC; a plain day is kept as it is.
 */
export function sheetDay(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return london(value)?.day;
}

/** A moment for a spreadsheet, `2026-10-21 08:14` in UK time, which Excel reads as a date and time. */
export function sheetTime(iso: string | undefined): string | undefined {
  const p = london(iso);
  return p ? `${p.day} ${p.time}` : undefined;
}
