import type { Principal } from '@relay/platform';
import { canReadReport, ownsReport } from './auth/access';
import { londonDay } from './weeklySummary';
import type { Issue, Report, Variation } from './types';
import { reportTypeOf } from './reportTypes';

/**
 * What happened on a project while an engineer was away: reports other trades
 * sent, issues raised or moved on, and variations raised or answered. Shown on
 * the engineer's home so the first minute back on a site is spent reading one
 * list, not opening three registers.
 *
 * "Last visit" is the engineer's own latest sent report on the project from
 * an earlier day, so it needs no "mark as read" store and no setup. Today's
 * reports are left out of that, so the list still reads "since you were last
 * here" after the engineer sends today's update. Without an earlier report it
 * shows the last seven days. The engineer's own reports and acts, and the
 * issues and variations they raised, are left out: they know about the first,
 * and "Came back from the office" already lists the office's answers to the
 * rest, so nothing shows twice on the same screen.
 *
 * It only reads what is already recorded. Each record keeps its own event, so
 * an issue being put forward as fixed is never read as it being closed.
 */

export const FIRST_LOOK_DAYS = 7;

export interface CatchUpReport { id: string; reference: string; visitDate: string; at: string; author: string; trade?: string; cards: number; defects: number; correction: boolean;
  /** An inspection: its name and how many checks need action, said instead of a card count. */
  inspection?: { name: string; actions: number } }
export type IssueChange = 'raised' | 'fixed' | 'closed' | 'reopened' | 'assigned';
export interface CatchUpIssue { id: string; reference: string; location: string; description: string; at: string; by: string; change: IssueChange; owner: string; yourTrade: boolean }
export type VariationChange = 'raised' | 'instructed' | 'declined';
export interface CatchUpVariation { id: string; reference: string; location: string; description: string; at: string; by: string; change: VariationChange }
export interface SinceLastVisit {
  projectId: string;
  /** The engineer's own report that marks the last visit, or none on a first look. */
  lastVisit: { reportId: string; reference: string; visitDate: string } | null;
  /** Everything after this instant counts as new. */
  since: string;
  reports: CatchUpReport[];
  issues: CatchUpIssue[];
  variations: CatchUpVariation[];
}

export interface CatchUpSources { reports: Report[]; issues: Issue[]; variations: Variation[] }

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ');
const newestFirst = <T extends { at: string; reference: string }>(rows: T[]) => rows.sort((a, b) => b.at.localeCompare(a.at) || b.reference.localeCompare(a.reference, 'en', { numeric: true }));
const ISSUE_EVENT: Partial<Record<Issue['events'][number]['kind'], IssueChange>> = { closure_submitted: 'fixed', verified: 'closed', reopened: 'reopened', assigned: 'assigned' };

export function sinceLastVisit(sources: CatchUpSources, principal: Principal, projectId: string, now: Date): SinceLastVisit {
  const today = londonDay(now);
  const sent = sources.reports.filter(r => r.projectId === projectId && r.state === 'submitted' && canReadReport(principal, r));

  // The last visit is the latest earlier day with an original report of the
  // engineer's own. A correction sent later is not a visit, so it never moves
  // the line forward and hides what happened in between.
  const visits = sent.filter(r => ownsReport(principal, r) && !r.corrects && r.visitDate < today);
  const lastDay = visits.reduce((day, r) => r.visitDate > day ? r.visitDate : day, '');
  const onLastDay = visits.filter(r => r.visitDate === lastDay);
  const anchor = onLastDay.sort((a, b) => (b.serverAcknowledgedAt ?? '').localeCompare(a.serverAcknowledgedAt ?? ''))[0];
  // An old report without a receipt time counts from the end of its visit day.
  const since = anchor ? anchor.serverAcknowledgedAt ?? `${anchor.visitDate}T23:59:59.999Z` : new Date(now.getTime() - FIRST_LOOK_DAYS * 86_400_000).toISOString();
  const after = (at?: string) => !!at && at > since;

  // Others' sent reports. A report whose correction was also sent is shown once, as the correction.
  const superseded = new Set(sent.map(r => r.corrects).filter((id): id is string => Boolean(id)));
  const reports = newestFirst(sent.filter(r => !ownsReport(principal, r) && !superseded.has(r.id) && after(r.serverAcknowledgedAt)).map(r => ({
    id: r.id, reference: r.reference, visitDate: r.visitDate, at: r.serverAcknowledgedAt!, author: r.author, ...(r.authorTrade ? { trade: r.authorTrade } : {}),
    cards: r.observations.length, defects: r.observations.filter(o => o.type === 'defect').length, correction: !!r.corrects,
    ...(reportTypeOf(r).checklist ? { inspection: { name: reportTypeOf(r).name, actions: r.observations.filter(o => o.check?.answer === 'action').length } } : {}),
  })));

  // Each issue once, by the latest thing that happened to it since, unless the engineer did it.
  const mine = (actorId?: string) => !!actorId && actorId === principal.id;
  const issues = newestFirst(sources.issues.filter(i => i.projectId === projectId && i.confirmation !== 'withdrawn').flatMap((i): CatchUpIssue[] => {
    if (mine(i.reportedById ?? i.events[0]?.actorId)) return [];
    const moved = i.events.filter(e => ISSUE_EVENT[e.kind] && after(e.at)).at(-1);
    // The engineer made the latest move themselves (put it forward as fixed, say), so they already know where it stands.
    if (moved && mine(moved.actorId)) return [];
    // A move that has since been undone is not news: "closed" on an issue that is open again would mislead.
    const change = moved && ISSUE_EVENT[moved.kind];
    const stands = change && (change !== 'closed' || i.work === 'closed') && (change !== 'fixed' || i.work === 'awaiting_verification' || i.work === 'closed');
    const base = { id: i.id, reference: i.reference, location: tidy(i.location), description: i.description, owner: tidy(i.owner), yourTrade: !!principal.trade && i.affectedTrade === principal.trade };
    if (moved && change && stands) return [{ ...base, at: moved.at, by: moved.actor, change }];
    if (after(i.raisedAt)) return [{ ...base, at: i.raisedAt, by: i.reportedBy ?? i.events[0]?.actor ?? '', change: 'raised' }];
    return [];
  }));

  const variations = newestFirst(sources.variations.filter(v => v.projectId === projectId).flatMap((v): CatchUpVariation[] => {
    if (mine(v.raisedById)) return [];
    const base = { id: v.id, reference: v.reference, location: tidy(v.location), description: v.description };
    const answer = v.events.filter(e => (e.kind === 'instructed' || e.kind === 'declined') && after(e.at) && !mine(e.actorId)).at(-1);
    // Only the answer that still stands: one instructed and then reopened is not shown as instructed.
    if (answer && v.instruction === answer.kind) return [{ ...base, at: answer.at, by: answer.actor, change: answer.kind as VariationChange }];
    if (after(v.raisedAt)) return [{ ...base, at: v.raisedAt, by: v.raisedBy, change: 'raised' }];
    return [];
  }));

  return { projectId, lastVisit: anchor ? { reportId: anchor.id, reference: anchor.reference, visitDate: anchor.visitDate } : null, since, reports, issues, variations };
}
