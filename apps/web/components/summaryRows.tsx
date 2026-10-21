'use client';

import { useState } from 'react';
import Link from 'next/link';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { withViewReturn } from '@/lib/viewNavigation';
import { londonDay, type WeekIssue, type WeekReport, type WeekVariation } from '@/lib/weeklySummary';
import { dayShort } from '@/lib/dates';

/** Rows and words shared by the weekly and monthly summaries. */

export const fmtDay = (ymd: string, year = false) => dayShort(ymd, year);
export const fmtAt = (at: string) => fmtDay(londonDay(at));
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const KIND_WORD: Record<string, [string, string]> = { update: ['progress update', 'progress updates'], defect: ['defect', 'defects'], instruction: ['variation required', 'variations required'], access: ['access problem', 'access problems'] };

/** Cards by kind. An inspection's checks are said by `inspectionLine`, not counted as cards. */
export function kindLine(kinds: WeekReport['kinds']): string {
  return OBSERVATION_TYPES.filter(t => t.value !== 'check' && kinds[t.value]).map(t => { const [one, many] = KIND_WORD[t.value]!; return plural(kinds[t.value], one, many); }).join(', ') || 'no cards';
}

export function inspectionLine(i: NonNullable<WeekReport['inspection']>): string {
  return `${i.name}: ${plural(i.action, 'action')}, ${i.ok} satisfactory, ${i.na} not applicable`;
}

/** Updates shown on screen before "Show all"; each in full, so nothing is cut mid-sentence. Print always shows every one. */
export const WORK_SHOWN = 3;
/** What was done on a visit, in the engineer's words: where, then what. */
export function WorkDone({ r }: { r: WeekReport }) {
  const [all, setAll] = useState(false);
  if (!r.work.length) return null;
  return <div className={`week-work${all ? ' all' : ''}`}>
    <ul aria-label={`Work done, ${r.reference}`}>{r.work.map((w, n) => <li key={w.id} className={n >= WORK_SHOWN ? 'week-extra' : undefined}>
      {w.location && <b>{w.location}</b>}{w.location && w.text ? ': ' : ''}{w.text}</li>)}</ul>
    {r.work.length > WORK_SHOWN && <button type="button" className="week-noprint" aria-expanded={all} onClick={() => setAll(a => !a)}>
      {all ? 'Show less' : `Show all ${r.work.length} updates`}</button>}
  </div>;
}

export function IssueRows({ rows, empty, here }: { rows: WeekIssue[]; empty: string; here: string }) {
  if (!rows.length) return <p className="week-none">{empty}</p>;
  return <ul className="week-rows">{rows.map(i => <li key={i.id}>
    <span className="week-when">{fmtAt(i.at)}</span>
    <div><p><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link> <span className={`tag ${i.status === 'Closed' ? 'tag-sent' : 'tag-draft'}`}>{i.status}</span></p>
      <p className="week-desc">{i.description}</p>
      <p className="week-meta">{[i.location || 'No location recorded', i.owner || 'Not yet assigned', i.trade].filter(Boolean).join(' · ')}</p></div>
  </li>)}</ul>;
}

export function VariationRows({ rows, empty, here }: { rows: WeekVariation[]; empty: string; here: string }) {
  if (!rows.length) return <p className="week-none">{empty}</p>;
  return <ul className="week-rows">{rows.map(v => <li key={v.id}>
    <span className="week-when">{fmtAt(v.at)}</span>
    <div><p><Link className="ref" href={withViewReturn(`/variations/${v.id}`, here)}>{v.reference}</Link> <span className={`tag ${v.status === 'Instructed' ? 'tag-sent' : 'tag-draft'}`}>{v.status}</span>
      {v.workDone && v.status !== 'Instructed' && <span className="tag tag-alert">Done, not instructed</span>}</p>
      <p className="week-desc">{v.description}</p>
      {v.location && <p className="week-meta">{v.location}</p>}</div>
  </li>)}</ul>;
}

