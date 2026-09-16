'use client';
import Link from 'next/link';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PhotoImage } from '@/components/PhotoImage';
import { getReport, getVariation, listCorrections, recordCorrection } from '@/lib/api';
import { toast } from '@/components/workspace/hooks';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { acknowledgementStatus, deliveryStatus, reviewStatus } from '@/lib/status';
import { projectStatusGroups } from '@/lib/projectGroups';
import { withViewReturn } from '@/lib/viewNavigation';
import type { Correction, CorrectionAction, Issue, Observation, Report, ReportSummary, Variation } from '@/lib/types';
import { INSTRUCTION_LABEL, estimatedMargin, expectedCost, fmtHours, fmtMoney, fmtPct, marginPct, variationValue } from '@/lib/variations';
import { sectionOf } from '@/lib/sectionMatch';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Bar, Btn, BtnQ, ConfirmTag, DeliveryTag, Found, InstructionTag, Meta, Money, ReviewTag, SecH, Tag, WorkTag } from './bits';
import { Band, CardList, GroupHead, Mark, StubCard, type MarkKind } from './marks';
import { CONFIRM_LABEL, WORK_LABEL, daysLate, daysSince, fmtDate, fmtDay, fmtWhen, instructionTag, isActive, isDisputed, isNotReviewed, isOverdue, isUnassigned, isVerify, shortRef, toneTag, type ProjectStats } from './model';
import { OUR_CONTRACT, duplicateOf, isWithinContract, modesFor, pickMark, pickPool, priorOwner, type Target } from './corrections';
import './projects.css';
import './quickactions.css';

/* --------------------------------------------------------------- columns */
export function ProjectsView({ ctx }: { ctx: Ctx }) {
  const s = ctx.route.a ? ctx.statOf(ctx.route.a) : undefined;
  const kind = s && (ctx.route.b === 'report' || ctx.route.b === 'issue' || ctx.route.b === 'variation') ? ctx.route.b : null;
  const id = kind ? ctx.route.c : null;
  const depth = !s ? 1 : !kind ? 2 : 3;
  return <div className="cols" data-depth={depth}>
    <ProjectsCol ctx={ctx} current={s} />
    {s ? <RegisterCol key={s.code} ctx={ctx} s={s} kind={kind} id={id} />
      : <div className="col"><div className="col-head"><h4>Register</h4></div><div className="pr-empty">Select a project to see its reports, issues and variations.</div></div>}
    <div className="col">
      <div className="col-head">{s && <a className="col-back" href={kind ? `#/projects/${s.code}` : '#/projects'}>‹ {kind ? 'Register' : 'Projects'}</a>}<h4>Details</h4><i>{s ? s.project.projectNumber : 'Office'}</i></div>
      <div className="colpad">
        {!ctx.snap ? <div className="loading">Loading office records</div>
          : kind === 'report' && id ? <ReportReader ctx={ctx} id={id} />
          : kind === 'issue' && id ? <IssueSheet ctx={ctx} id={id} />
          : kind === 'variation' && id ? <VariationSheet ctx={ctx} id={id} />
          : s ? <ProjectSheet ctx={ctx} s={s} /> : <OfficeSheet ctx={ctx} />}
      </div>
    </div>
  </div>;
}

function officeReturn(ctx: Ctx): string {
  const route = [ctx.route.tab, ctx.route.a, ctx.route.b, ctx.route.c].filter((part): part is string => !!part);
  return `/office#/${route.join('/')}`;
}

/* ------------------------------------------------------------ status marks */
const unsynced = (x: { sync?: { status: string } | undefined }): boolean => !!x.sync && x.sync.status !== 'synced';

/** One mark per issue, worst first, so every issue sits in exactly one band. */
function issueMark(i: Issue, day: string): MarkKind {
  if (isOverdue(i, day)) return 'urgent';
  if (isDisputed(i) || isNotReviewed(i) || isVerify(i) || isUnassigned(i)) return 'action';
  if (unsynced(i)) return 'sync';
  return isActive(i) ? 'none' : 'done';
}
function issueWhy(i: Issue, day: string, m: MarkKind): string {
  if (m === 'urgent') return `${daysLate(i.targetDate, day)} days overdue`;
  if (m === 'action') return isDisputed(i) ? 'Disputed' : isVerify(i) ? 'Ready to verify' : isNotReviewed(i) ? 'Not reviewed' : 'Unassigned';
  if (m === 'sync') return `SharePoint ${i.sync?.status ?? 'not synced'}`;
  return m === 'done' ? (i.confirmation === 'withdrawn' ? 'Withdrawn' : 'Closed') : 'Open, nothing due';
}
function variationMark(v: Variation): MarkKind {
  if (v.instruction === 'instructed') return 'done';
  if (v.instruction === 'declined') return 'none';
  return v.workDone ? 'urgent' : 'action';
}
const deliveryFailed = (r: ReportSummary): boolean => r.delivery === 'failed' || (r.issued?.records ?? []).some(x => x.failure);
function reportMark(r: ReportSummary): MarkKind {
  if (deliveryFailed(r)) return 'urgent';
  if (r.sharepoint?.status === 'failed') return 'sync';
  return r.review === 'pending' || r.review === 'returned' ? 'action' : 'done';
}
function reportWhy(r: ReportSummary, m: MarkKind): string {
  return m === 'urgent' ? 'Could not be processed' : m === 'sync' ? 'SharePoint filing failed' : m === 'action' ? (r.review === 'returned' ? 'Returned' : 'Awaiting review') : 'Received';
}

/** Project card counts: the register's bands added up, each record counted once. */
function projectCounts(s: ProjectStats, day: string): Record<'urgent' | 'action' | 'sync', number> {
  const n = { urgent: 0, action: 0, sync: 0 };
  const add = (m: MarkKind) => { if (m === 'urgent' || m === 'action' || m === 'sync') n[m]++; };
  s.issues.forEach(i => add(issueMark(i, day)));
  s.variations.forEach(v => add(variationMark(v)));
  s.reports.forEach(r => add(reportMark(r)));
  return n;
}
const COUNT_WORDS = { urgent: 'urgent', action: 'need action', sync: 'need SharePoint attention' } as const;

/* ---------------------------------------------------------- project list */
function ProjectsCol({ ctx, current }: { ctx: Ctx; current?: ProjectStats }) {
  return <div className="col pr-projects">
    <div className="col-head"><h4>Projects</h4><i>{ctx.projects.length} reportable</i></div>
    {projectStatusGroups(ctx.projects).filter(g => g.projects.length).map(group => <div key={group.status}>
      <div className={`pr-pband ${group.tone}`}><span><span className="dot" aria-hidden="true" />{group.label}</span><i>{group.projects.length}</i></div>
      <div className="pr-plist">{group.projects.map(p => {
        const s = ctx.statOf(p.id), on = current?.code === p.id;
        const c = s ? projectCounts(s, ctx.day) : undefined;
        const marks = c ? (['urgent', 'action', 'sync'] as const).filter(k => c[k] > 0) : [];
        return <a key={p.id} className={`pr-pcard ${on ? 'on' : ''}`} href={`#/projects/${p.id}`} aria-current={on ? 'true' : undefined}>
          <span className="pt"><span>{p.projectName}</span><span className="arrow" aria-hidden="true">›</span></span>
          <span className="ps"><b>{p.projectNumber}</b> · {p.projectManager}</span>
          {c && <span className="pm">{marks.length ? marks.map(k => <Fragment key={k}><Mark kind={k} size="sm" label={`${c[k]} ${COUNT_WORDS[k]}`} /><span className="n" aria-hidden="true">{c[k]}</span></Fragment>) : <span className="n quiet">No open items</span>}</span>}
        </a>;
      })}</div>
    </div>)}
    <div className="pr-foot">Tenders and completed jobs are not listed.</div>
  </div>;
}

/* -------------------------------------------------------------- register */
type Filter = 'all' | 'issues' | 'variations' | 'reports';
type Bands = [MarkKind, string][];
const ISSUE_BANDS: Bands = [['urgent', 'Urgent'], ['action', 'Action needed'], ['sync', 'SharePoint'], ['none', 'Open'], ['done', 'Dealt with']];
const VARIATION_BANDS: Bands = [['urgent', 'Urgent'], ['action', 'Action needed'], ['done', 'Dealt with'], ['none', 'Declined']];
const REPORT_BANDS: Bands = [['urgent', 'Urgent'], ['action', 'Action needed'], ['sync', 'SharePoint']];

function banded<T>(items: T[], markOf: (t: T) => MarkKind, bands: Bands, card: (t: T) => ReactNode): ReactNode {
  return bands.map(([k, label]) => {
    const g = items.filter(x => markOf(x) === k);
    return g.length ? <Fragment key={k}><Band kind={k} label={label} count={g.length} /><CardList>{g.map(card)}</CardList></Fragment> : null;
  });
}

/** Visit day as YYYY-MM-DD, falling back to the day it was received. */
const dayOf = (r: ReportSummary): string => /^\d{4}-\d{2}-\d{2}/.test(r.visitDate) ? r.visitDate.slice(0, 10) : (r.serverAcknowledgedAt ?? r.lastSavedAt ?? '').slice(0, 10);
const isDay = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d);
const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const visitDay = (d: string): string => isDay(d) ? utc(d).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '') : 'No visit date';
const monthName = (m: string): string => /^\d{4}-\d{2}$/.test(m) ? utc(`${m}-01`).toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : 'No visit date';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const byVisit = (a: ReportSummary, b: ReportSummary) => dayOf(b).localeCompare(dayOf(a));
function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of items) { const k = key(x); out.set(k, [...(out.get(k) ?? []), x]); }
  return out;
}

function RegisterCol({ ctx, s, kind, id }: { ctx: Ctx; s: ProjectStats; kind: string | null; id: string | null }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'month' | 'calendar'>('month');
  const day = ctx.day, pn = s.project.projectNumber;
  const selectedReport = kind === 'report' ? id : null;
  const issueCard = (i: Issue) => { const m = issueMark(i, day); return <StubCard key={i.id} href={`#/projects/${s.code}/issue/${i.id}`} on={kind === 'issue' && id === i.id} project={pn} code={shortRef(i.reference)} title={i.description} sub={`${i.location || 'No location'} · ${i.owner.trim() || 'No owner'}`} mark={m} markLabel={issueWhy(i, day, m)} quiet={m === 'done'} />; };
  const variationCard = (v: Variation) => {
    const m = variationMark(v);
    const aside = v.instruction === 'instructed' ? fmtMoney(variationValue(v)) : v.quotedValue !== undefined ? `${fmtMoney(v.quotedValue)} quoted` : v.instruction === 'pending' ? 'Not priced' : undefined;
    return <StubCard key={v.id} href={`#/projects/${s.code}/variation/${v.id}`} on={kind === 'variation' && id === v.id} project={pn} code={shortRef(v.reference)} title={v.description} aside={aside} mark={m} markLabel={instructionTag(v).label} quiet={m === 'none'} />;
  };
  const reportCard = (r: ReportSummary) => { const m = reportMark(r); return <StubCard key={r.id} slim href={`#/projects/${s.code}/report/${r.id}`} on={selectedReport === r.id} project={pn} code={`${shortRef(r.reference)}${r.revision > 1 ? ` r${r.revision}` : ''}`} title={`${ctx.nameOf(r.authorId, r.author)} · ${visitDay(dayOf(r))}`} mark={m} markLabel={reportWhy(r, m)} />; };
  const draftRow = (r: ReportSummary) => <div key={r.id} className="ro-card slim pr-draft">
    <span className="ro-stub"><small>{pn}</small><b>DRAFT</b></span>
    <span className="ro-card-body"><span className="ro-card-title">{r.author} · {visitDay(dayOf(r))}</span><span className="ro-card-sub">Saved {fmtWhen(r.lastSavedAt)} · {plural(r.observationCount, 'section')} · {r.corrects ? 'correction in progress' : 'contents private until sent'}</span></span>
    <span className="ro-card-mark"><Mark kind="none" size="sm" label="Draft, nothing due" /></span>
  </div>;

  const attn = s.reports.filter(r => reportMark(r) !== 'done');
  const latest = s.reports.slice(0, 5);
  const hot = s.overdue.length > 0 || s.exposedVariations.length > 0;
  const chips: [Filter, string, number][] = [['all', 'All', s.issues.length + s.variations.length + s.reports.length], ['issues', 'Issues', s.issues.length], ['variations', 'Variations', s.variations.length], ['reports', 'Reports', s.reports.length]];
  const noReports = <div className="pr-empty">No reports received on this project.</div>;
  const issues = s.issues.length ? banded(s.issues, i => issueMark(i, day), ISSUE_BANDS, issueCard) : <div className="pr-empty">No issues on this project.</div>;
  const variations = s.variations.length ? banded(s.variations, variationMark, VARIATION_BANDS, variationCard) : <div className="pr-empty">No variations on this project.</div>;

  return <div className="col focus pr-register">
    <div className="col-head"><a className="col-back" href="#/projects">‹ Projects</a><h4>Register · {s.project.projectName}</h4><i>{plural(s.reports.length, 'report')} · {s.active.length} open</i></div>
    <div className="ro-toolbar" role="group" aria-label="Show in register">
      {chips.map(([k, label, n]) => <button type="button" key={k} className={`chip ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}
        title={k === 'all' && hot ? 'Something is overdue or done without an instruction' : undefined}>{k === 'all' && hot && <span className="pr-hotdot" aria-hidden="true" />}{label} · {n}</button>)}
      {filter === 'reports' && <span className="pr-seg" role="group" aria-label="Report layout">
        <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>By month</button>
        <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
      </span>}
    </div>
    <div className="pr-body">
      {filter === 'all' && <>
        <GroupHead label="Issues" right={`${s.active.length} open`} />{issues}
        <GroupHead label="Variations" right={`${s.pendingVariations.length} pending`} />{variations}
        <GroupHead label="Reports" right={s.reports.length > 5 ? `latest 5 of ${s.reports.length}` : plural(s.reports.length, 'report')} />
        {s.reports.length ? <>
          {banded(attn.filter(r => !latest.includes(r)), reportMark, REPORT_BANDS, reportCard)}
          <Band kind="none" label="Most recent" count={latest.length} />
          <CardList>{latest.map(reportCard)}{s.reports.length > 5 && <button type="button" className="pr-more" onClick={() => setFilter('reports')}>See all {s.reports.length} reports ›</button>}</CardList>
        </> : noReports}
      </>}
      {filter === 'issues' && issues}
      {filter === 'variations' && variations}
      {filter === 'reports' && view === 'month' && <>
        {attn.length > 0 && <><GroupHead label="Needs attention" right={attn.length} />{banded(attn, reportMark, REPORT_BANDS, reportCard)}</>}
        {s.drafts.length > 0 && <><GroupHead label="Drafts on site" right={s.drafts.length} /><CardList>{s.drafts.map(draftRow)}</CardList></>}
        <GroupHead label="Filed reports" right={s.reports.length} />
        {s.reports.length ? <ReportMonths reports={s.reports} selected={selectedReport} card={reportCard} /> : noReports}
      </>}
      {filter === 'reports' && view === 'calendar' && (s.reports.length ? <ReportCalendar reports={s.reports} selected={selectedReport} card={reportCard} /> : noReports)}
    </div>
  </div>;
}

function ReportMonths({ reports, selected, card }: { reports: ReportSummary[]; selected: string | null; card: (r: ReportSummary) => ReactNode }) {
  const months = [...groupBy(reports.slice().sort(byVisit), r => dayOf(r).slice(0, 7))];
  const [open, setOpen] = useState<Set<string>>(() => {
    const picked = reports.find(r => r.id === selected);
    return new Set([months[0]?.[0] ?? '', picked ? dayOf(picked).slice(0, 7) : ''].filter(Boolean));
  });
  const toggle = (m: string) => setOpen(prev => { const next = new Set(prev); if (!next.delete(m)) next.add(m); return next; });
  return <>{months.map(([m, list]) => {
    const flagged = list.filter(r => reportMark(r) !== 'done').length, done = list.length - flagged, isOpen = open.has(m);
    return <Fragment key={m}>
      <button type="button" className="pr-month" aria-expanded={isOpen} onClick={() => toggle(m)}>
        <span className="chev" aria-hidden="true">›</span>
        <span className="mname">{monthName(m)}</span>
        <span className="msum">{flagged > 0 && <><Mark kind="action" size="sm" label={`${flagged} need attention`} /><span aria-hidden="true">{flagged}</span></>}<Mark kind="done" size="sm" label={`${done} complete`} /><span aria-hidden="true">{done}</span></span>
        <span className="mcount">{plural(list.length, 'report')}</span>
      </button>
      {isOpen && <div className="pr-month-list"><CardList>{list.map(card)}</CardList></div>}
    </Fragment>;
  })}</>;
}

const WORST: MarkKind[] = ['urgent', 'action', 'sync'];
function ReportCalendar({ reports, selected, card }: { reports: ReportSummary[]; selected: string | null; card: (r: ReportSummary) => ReactNode }) {
  const byDay = groupBy(reports.filter(r => isDay(dayOf(r))).sort(byVisit), dayOf);
  const days = [...byDay.keys()];
  const months = [...new Set(days.map(d => d.slice(0, 7)))].sort();
  const [day, setDay] = useState(() => { const picked = reports.find(r => r.id === selected); return picked && byDay.has(dayOf(picked)) ? dayOf(picked) : days[0] ?? ''; });
  const [month, setMonth] = useState(() => day.slice(0, 7) || months.at(-1) || '');
  if (!months.length) return <div className="pr-empty">No reports have a visit date to place on the calendar.</div>;
  const idx = months.indexOf(month);
  const go = (m: string) => { setMonth(m); setDay(days.find(d => d.startsWith(m)) ?? ''); };
  const [y, mo] = month.split('-').map(Number) as [number, number];
  const offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7, length = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const inMonth = days.filter(d => d.startsWith(month)).reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
  const chosen = byDay.get(day);
  return <>
    <div className="pr-cal">
      <div className="pr-cal-head">
        <button type="button" className="pr-cal-nav" disabled={idx <= 0} onClick={() => go(months[idx - 1]!)} aria-label="Previous month with reports">‹</button>
        <span><b>{monthName(month)}</b><i>{plural(inMonth, 'report')}</i></span>
        <button type="button" className="pr-cal-nav" disabled={idx >= months.length - 1} onClick={() => go(months[idx + 1]!)} aria-label="Next month with reports">›</button>
      </div>
      <div className="pr-cal-grid">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d} className="pr-cal-dow" aria-hidden="true">{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`pad${i}`} />)}
        {Array.from({ length }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, '0')}`, list = byDay.get(key), weekend = (offset + i) % 7 >= 5;
          if (!list) return <span key={key} className={`pr-cal-day ${weekend ? 'wk' : ''}`}><span className="dn">{i + 1}</span></span>;
          const worst = WORST.find(k => list.some(r => reportMark(r) === k));
          return <button type="button" key={key} className={`pr-cal-day has ${weekend ? 'wk' : ''} ${day === key ? 'sel' : ''}`} aria-pressed={day === key} onClick={() => setDay(key)}
            aria-label={`${visitDay(key)}: ${plural(list.length, 'report')}${worst ? ', needs attention' : ''}`}>
            <span className="dn" aria-hidden="true">{i + 1}</span>
            <span className="dc" aria-hidden="true">{worst ? <Mark kind={worst} size="sm" /> : list.length}</span>
          </button>;
        })}
      </div>
    </div>
    {chosen ? <><Band kind="none" label={`Visits on ${visitDay(day)}`} count={chosen.length} /><CardList>{chosen.map(card)}</CardList></>
      : <div className="pr-empty">Choose a highlighted day to see its reports.</div>}
  </>;
}

/* ---------------------------------------------------------------- sheets */
function OfficeSheet({ ctx }: { ctx: Ctx }) {
  const snap = ctx.snap!;
  const week = Date.now() - 7 * 86400000;
  const thisWeek = snap.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week);
  const overdue = ctx.stats.flatMap(s => s.overdue), verify = ctx.stats.flatMap(s => s.verify), notNotified = ctx.stats.flatMap(s => s.notNotified);
  const pendingVariations = ctx.stats.flatMap(s => s.pendingVariations), exposed = ctx.stats.flatMap(s => s.exposedVariations);
  const latest = snap.reports.slice(0, 6);
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs">Leodis Developments</div><h4>Office position</h4><div className="rowsub">{ctx.projects.length} reportable projects · {snap.reports.length} reports received · {snap.issues.filter(isActive).length} open issues · {pendingVariations.length} variation{pendingVariations.length === 1 ? '' : 's'} awaiting instruction · {fmtDate(snap.loadedAt)}</div></div>
      <div className="actions"><a className="btn btn-q btn-sm" href="#/inbox">Inbox</a><a className="btn btn-q btn-sm" href="#/variations">Variations</a><a className="btn btn-sm" href="#/issues">Issues</a></div></div>
    <dl className="tb"><div><dt>Received this week</dt><dd className="big">{thisWeek.length}<small>{notNotified.length ? `${notNotified.length} PM notification${notNotified.length === 1 ? '' : 's'} pending` : 'project managers notified'}</small></dd></div><div><dt>Overdue actions</dt><dd className={`big ${overdue.length ? 'late' : ''}`}>{overdue.length}<small>{overdue.length ? `oldest ${Math.max(...overdue.map(i => daysLate(i.targetDate, ctx.day)))} days past target` : 'nothing past its target'}</small></dd></div><div><dt>Ready to verify</dt><dd className={`big ${verify.length ? 'soon' : ''}`}>{verify.length}<small>{verify.length ? 'closure submitted, needs a second pair of eyes' : 'nothing awaiting verification'}</small></dd></div><div><dt>Variations pending</dt><dd className={`big ${exposed.length ? 'late' : pendingVariations.length ? 'soon' : ''}`}>{pendingVariations.length}<small>{exposed.length ? `${exposed.length} done without an instruction` : pendingVariations.some(v => v.quotedValue === undefined) ? `${pendingVariations.filter(v => v.quotedValue === undefined).length} still to price` : 'all priced, awaiting the client'}</small></dd></div></dl>
    <SecH right={<a href="#/issues">All →</a>}>Needs attention</SecH>
    <AttentionList ctx={ctx} limit={6} />
    <SecH right={<a href="#/inbox">All {snap.reports.length} →</a>}>Latest reports</SecH>
    <LatestReports ctx={ctx} reports={latest} showProject />
    <p className="rowsub" style={{ marginTop: 16 }}>A report is <b>received</b> when the server has it and on file from then on. The email to the project manager is a notification that it came in, and <b>read</b> means someone in the office acknowledged it. Select a project on the left to drill in.</p>
  </div>;
}

function AttentionList({ ctx, s, limit }: { ctx: Ctx; s?: ProjectStats; limit: number }) {
  const items = (s ? [s] : ctx.stats).flatMap(st => [
    ...st.failed.map(r => ({ key: r.id, ref: shortRef(r.reference), b: 'Report could not be processed', sub: `${st.project.projectName} · ${r.author} · received ${fmtDay(r.serverAcknowledgedAt)}`, tag: { label: 'Processing', cls: 'tag-alert' }, go: `#/projects/${st.code}/report/${r.id}` })),
    ...st.pendingReview.map(r => ({ key: r.id, ref: shortRef(r.reference), b: 'Awaiting review', sub: `${st.project.projectName} · ${r.author}`, tag: { label: 'Review', cls: 'tag-caution' }, go: `#/projects/${st.code}/report/${r.id}` })),
    ...st.overdue.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · ${i.owner || 'unassigned'} · target ${i.targetDate}`, tag: { label: `${daysLate(i.targetDate, ctx.day)}d overdue`, cls: 'tag-alert' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.exposedVariations.map(v => ({ key: v.id, ref: shortRef(v.reference), b: v.description, sub: `${st.project.projectName} · work done, no written instruction`, tag: { label: 'Not instructed', cls: 'tag-alert' }, go: `#/projects/${st.code}/variation/${v.id}` })),
    ...st.disputed.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · disputed at review`, tag: { label: 'Triage', cls: 'tag-alert' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.verify.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · closure by ${i.closureSubmittedBy ?? 'unknown'}`, tag: { label: 'Verify', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.unassigned.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · nobody owns it · raised ${fmtDay(i.raisedAt)}`, tag: { label: 'Unassigned', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.unpricedVariations.filter(v => !v.workDone).map(v => ({ key: v.id, ref: shortRef(v.reference), b: v.description, sub: `${st.project.projectName} · variation, no quote yet · raised ${fmtDay(v.raisedAt)}`, tag: { label: 'Needs a quote', cls: 'tag-caution' }, go: `#/projects/${st.code}/variation/${v.id}` })),
  ]);
  const shown = [...new Map(items.map(i => [i.key, i])).values()].slice(0, limit);
  return <div className="rmenu">{shown.length ? shown.map(i => <a key={i.key} href={i.go}><span className="ref">{i.ref}</span><div className="rt"><b>{i.b}</b><span>{i.sub}</span></div><Tag {...i.tag} /></a>) : <div className="empty" style={{ padding: 14 }}>Nothing needs attention.</div>}</div>;
}

function LatestReports({ ctx, reports, showProject }: { ctx: Ctx; reports: ReportSummary[]; showProject?: boolean }) {
  const code = (r: ReportSummary) => ctx.projects.find(p => p.id === r.projectId)?.id ?? '';
  return <table className="reg tight"><thead><tr><th>Ref</th>{showProject && <th>Project</th>}<th>Engineer</th><th>Received</th><th>Found</th><th>Status</th></tr></thead><tbody>
    {reports.length ? reports.map(r => <tr key={r.id} className="clickable" onClick={() => ctx.go(`#/projects/${code(r)}/report/${r.id}`)}><td><span className="ref">{shortRef(r.reference)}</span></td>{showProject && <td>{ctx.projects.find(p => p.id === r.projectId)?.projectName ?? r.projectId}</td>}<td>{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due">{fmtDay(r.serverAcknowledgedAt)} {r.serverAcknowledgedAt ? new Date(r.serverAcknowledgedAt).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }) : ''}</td><td><Found r={r} /></td><td>{r.review === 'pending' ? <Tag label="To review" cls="tag-caution" /> : r.review === 'returned' ? <Tag label="Returned" cls="tag-alert" /> : r.acknowledged ? <Tag label="Read" cls="tag-ok" /> : <DeliveryTag r={r} />}</td></tr>) : <tr><td colSpan={showProject ? 6 : 5} className="empty">No reports received yet.</td></tr>}
  </tbody></table>;
}

function ProjectSheet({ ctx, s }: { ctx: Ctx; s: ProjectStats }) {
  const p = s.project;
  const month = Date.now() - 30 * 86400000;
  const engineers = [...new Set(s.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > month).map(r => r.author))];
  const week = Date.now() - 7 * 86400000;
  const thisWeek = s.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week);
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href="#/projects">Projects</a><span>›</span>Project</div><h4>{p.projectName}</h4><div className="rowsub"><span className="ref">{p.projectNumber}</span><span className="sep">/</span>{p.clientName}<span className="sep">/</span>{p.division}<span className="sep">/</span>{p.status}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={withViewReturn(`/projects/${p.id}`, officeReturn(ctx))}>Project page</Link><a className="btn btn-sm" href={`#/inbox`}>Inbox</a></div></div>
    <dl className="tb"><div><dt>Received this week</dt><dd className="big">{thisWeek.length}<small>{s.reports.length ? `${s.reports.length} on file` : 'none yet'}{s.notNotified.length ? ` · ${s.notNotified.length} PM notification${s.notNotified.length === 1 ? '' : 's'} pending` : ''}</small></dd></div><div><dt>Overdue actions</dt><dd className={`big ${s.overdue.length ? 'late' : ''}`}>{s.overdue.length}<small>{s.overdue.length ? `oldest ${Math.max(...s.overdue.map(i => daysLate(i.targetDate, ctx.day)))} days past target` : 'nothing past its target'}</small></dd></div><div><dt>Ready to verify</dt><dd className={`big ${s.verify.length ? 'soon' : ''}`}>{s.verify.length}<small>{s.verify.length ? `closure submitted ${fmtDay(s.verify[0]!.events.at(-1)?.at)}` : 'nothing awaiting verification'}</small></dd></div><div><dt>Variations</dt><dd className={`big ${s.exposedVariations.length ? 'late' : s.pendingVariations.length ? 'soon' : ''}`}>{s.pendingVariations.length}<small>{s.pendingVariations.length ? `awaiting instruction${s.unpricedVariations.length ? ` · ${s.unpricedVariations.length} to price` : ''}` : 'none awaiting instruction'}{s.instructedValue ? ` · ${fmtMoney(s.instructedValue)} instructed` : ''}</small></dd></div></dl>
    <div style={{ marginTop: 12 }}><Bar c={s.rollup} /><Meta c={s.rollup} /></div>
    <dl className="tb" style={{ marginTop: 12 }}><div><dt>Project manager</dt><dd>{p.projectManager}<small>{p.projectManagerEmail}</small></dd></div><div><dt>Client account</dt><dd className="num">{p.clientAccountNumber}</dd></div><div><dt>Review</dt><dd>{p.reviewRequired ? 'Required' : 'Not required'}<small>{p.reviewRequired ? 'reports wait for a decision' : 'reports issue on submission'}</small></dd></div><div><dt>Engineers · 30 days</dt><dd>{engineers.length}<small>{engineers.join(', ') || 'no reports in the last month'}</small></dd></div></dl>
    <SecH>Needs attention</SecH>
    <AttentionList ctx={ctx} s={s} limit={6} />
    <SecH right={<span className="r">{s.reports.length} on file</span>}>Latest reports</SecH>
    <LatestReports ctx={ctx} reports={s.reports.slice(0, 5)} />
    {s.drafts.length > 0 && <p className="rowsub" style={{ marginTop: 12 }}>{s.drafts.length} draft{s.drafts.length === 1 ? '' : 's'} in progress on site. Contents stay private until sent.</p>}
  </div>;
}

/* ---------------------------------------------------------------- reader */
export function ReportReader({ ctx, id, crumbsHome, corrections: correcting, onWiden, onCorrections }: {
  ctx: Ctx; id: string; crumbsHome?: string;
  /** Offer quick actions on each section and show the change log. Pass only for a Manager or Admin. */
  corrections?: boolean;
  /** Called with true when a quick action opens (the Inbox widens the reader) and false when it closes. */
  onWiden?: (open: boolean) => void;
  /** Called whenever this report's corrections are loaded, so a list can show a count. */
  onCorrections?: (reportId: string, list: Correction[]) => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loadedId, setLoadedId] = useState('');
  const [error, setError] = useState('');
  const [retryingSharePoint, setRetryingSharePoint] = useState(false);
  const [sharePointRetry, setSharePointRetry] = useState('');
  useEffect(() => {
    let stopped = false; setError('');
    getReport(id).then(r => { if (stopped) return; if (r && r.state === 'submitted') { setReport(r); setLoadedId(id); } else setError(r ? 'This is a draft. Its contents are private to the author until it is sent.' : 'That report could not be found.'); }).catch(e => { if (!stopped) setError(e.message); });
    return () => { stopped = true; };
  }, [id, ctx.snap?.loadedAt]);
  const [fixes, setFixes] = useState<{ reportId: string; list: Correction[] } | null>(null);
  const [fixError, setFixError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [reloadFixes, setReloadFixes] = useState(0);
  const sections = useRef<Record<string, HTMLDivElement | null>>({});
  const reportFixes = useRef(onCorrections); reportFixes.current = onCorrections;
  useEffect(() => { setActing(null); }, [id]);
  useEffect(() => {
    if (!correcting) return;
    let stopped = false;
    listCorrections(id).then(list => { if (stopped) return; setFixes({ reportId: id, list }); setFixError(''); reportFixes.current?.(id, list); })
      .catch(e => { if (!stopped) setFixError(e instanceof Error ? e.message : 'Corrections could not be loaded.'); });
    return () => { stopped = true; };
  }, [id, correcting, ctx.snap?.loadedAt, reloadFixes]);
  useEffect(() => {
    if (!acting) return;
    // Two frames: let the widened layout settle before measuring.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { const el = sections.current[acting]; if (el) scrollIntoColumn(el); }); });
    return () => cancelAnimationFrame(frame);
  }, [acting]);
  const toggleActing = useCallback((observationId: string) => {
    const next = acting === observationId ? null : observationId;
    setActing(next);
    onWiden?.(next !== null);
  }, [acting, onWiden]);
  if (error && loadedId !== id) return <div className="sheet"><div className="empty">{error}</div></div>;
  if (!report || loadedId !== id) return <div className="sheet"><div className="loading" style={{ minHeight: 160 }}>Loading report</div></div>;
  const project = ctx.projects.find(p => p.id === report.projectId);
  const code = project?.id ?? '';
  const summary = ctx.snap?.reports.find(r => r.id === report.id);
  const review = reviewStatus(report), delivery = deliveryStatus(report), ack = acknowledgementStatus(report);
  const superseded = ctx.snap?.reports.find(r => r.corrects === report.id);
  const raised = ctx.snap?.issues.filter(i => i.raisedByReport === report.id) ?? [];
  const variationOf = (observationId: string) => ctx.snap?.variations.find(v => sectionOf(v, report) === observationId);
  const decisions = report.observations.filter(o => o.type === 'instruction' || o.actionNeeded.trim());
  const canReview = report.review === 'pending' && report.authorId !== ctx.me.id;
  const corrections = correcting && fixes?.reportId === report.id ? fixes.list : [];
  const correctedCount = new Set(corrections.map(c => c.observationId)).size;
  const engineer = ctx.nameOf(report.authorId, report.author);
  const recordRef = (type: 'issue' | 'variation', recordId: string | undefined) => {
    const r = !recordId ? undefined : type === 'issue' ? ctx.snap?.issues.find(i => i.id === recordId) : ctx.snap?.variations.find(v => v.id === recordId);
    return r ? <a className="ref" href={`#/projects/${code}/${type}/${r.id}`}>{shortRef(r.reference)}</a> : <span className="ref">{type === 'issue' ? 'another issue' : 'another variation'}</span>;
  };
  async function retrySharePoint() {
    setRetryingSharePoint(true); setSharePointRetry('');
    try {
      const response = await fetch('/api/admin/sharepoint', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reportId:report!.id}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.reason ?? 'The SharePoint retry could not be queued.');
      setSharePointRetry('Retry queued. This report will refresh when processing finishes.');
      await ctx.refresh();
    } catch (retryError) {
      setSharePointRetry(retryError instanceof Error ? retryError.message : 'The SharePoint retry could not be queued.');
    } finally { setRetryingSharePoint(false); }
  }
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={crumbsHome ?? `#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Site progress report</div><h4>Visit {fmtDate(report.visitDate)}</h4><div className="rowsub"><span className="ref">{report.reference}</span><span className="sep">/</span>{ctx.nameOf(report.authorId, report.author)}{report.authorTrade ? ` · ${report.authorTrade}` : ''}<span className="sep">/</span>Rev {report.revision}{correctedCount > 0 && <><span className="sep">/</span><span className="ro-qa-chip">{correctedCount} corrected</span></>}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={withViewReturn(`/reports/${report.id}/preview`, officeReturn(ctx))}>Full report</Link><Link className="btn btn-q btn-sm" href={withViewReturn(`/reports/${report.id}/pdf`, officeReturn(ctx))}>PDF</Link>
        {canReview ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'review', report: summary })}>Review</Btn>
          : !report.acknowledged ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'acknowledge', report: summary })}>Acknowledge</Btn> : null}
        {ctx.me.admin && report.sharepoint?.status === 'failed' && <Btn className="btn-sm" disabled={retryingSharePoint} onClick={() => void retrySharePoint()}>{retryingSharePoint ? 'Queuing…' : 'Retry SharePoint'}</Btn>}</div></div>
    <dl className="tb"><div><dt>Received</dt><dd>{fmtWhen(report.serverAcknowledgedAt)}</dd></div><div><dt>Review</dt><dd>{review ? <Tag label={review.label} cls={toneTag(review.tone)} /> : '—'}</dd></div><div><dt>PDF and notification</dt><dd>{delivery ? <Tag label={delivery.label} cls={toneTag(delivery.tone)} /> : '—'}</dd></div><div><dt>Read</dt><dd>{ack ? <Tag label={ack.label} cls={toneTag(ack.tone)} /> : '—'}{report.acknowledged && <small>{fmtWhen(report.acknowledged.at)}{report.acknowledged.note ? ` · ${report.acknowledged.note}` : ''}</small>}</dd></div></dl>
    {sharePointRetry && <div className="note"><span>{sharePointRetry}</span></div>}
    {correcting && fixError && <div className="note warn"><span><b>Quick actions unavailable.</b> {fixError}</span></div>}
    {report.review === 'returned' && <div className="note bad"><span><b>Sent back by {report.reviewedBy ? ctx.nameOf(report.reviewedById, report.reviewedBy) : 'the office'}</b>{report.reviewedAt ? ` on ${fmtDay(report.reviewedAt)}` : ''}: {report.reviewNote} {superseded ? '' : 'The engineer can send a corrected revision.'}</span></div>}
    {superseded && <div className="note info"><span><b>Superseded by rev {superseded.revision}</b>{superseded.state === 'draft' ? ', a correction in progress on site.' : '.'} </span>{superseded.state === 'submitted' && <a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${superseded.id}`}>Open rev {superseded.revision}</a>}</div>}
    {report.corrects && <div className="note info"><span><b>Rev {report.revision} supersedes rev {report.revision - 1}.</b> {report.correctionReason}</span><a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${report.corrects}`}>Open rev {report.revision - 1}</a></div>}
    {report.review === 'pending' && !canReview && <div className="note warn"><span><b>Awaiting review.</b> You wrote this report, so someone else has to review it.</span></div>}
    {report.delivery === 'failed' && <div className="note bad"><span><b>Could not be processed.</b> {report.deliveryError ?? 'The worker gave up on this report.'} The report is on file; the PDF and the notification are what failed.</span></div>}
    {(report.delivery === 'outbox' || report.issued?.transport === 'outbox') && <div className="note"><span>{project?.projectManager ?? 'The project manager'} has not been notified by email yet: the pilot holds notification emails in a local outbox. The report is on file and readable here.</span></div>}
    {decisions.length > 0 && <><SecH>Actions and decisions</SecH>
      <div className="rmenu">{decisions.map(o => { const vo = o.type === 'instruction' ? variationOf(o.id) : undefined; return <div key={o.id}><div className="rt"><b>{o.type === 'instruction' ? 'Variation to instruct' : `Action for ${o.owner.trim() || 'nobody yet'}`} · {o.location || 'no location'}</b><span>{o.type === 'instruction' ? o.whatHappened : o.actionNeeded}{o.type !== 'instruction' && !o.owner.trim() && ' · no owner named'}</span></div>{o.type === 'instruction' ? (vo ? <><a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a><InstructionTag v={vo} /></> : <span className="kind tone-variation">Variation</span>) : raisedRef(o.id, raised, code, report)}</div>; })}</div></>}
    <SecH right={<span className="r">{report.observations.length} update{report.observations.length === 1 ? '' : 's'}</span>}>Found on this visit</SecH>
    {report.observations.length ? report.observations.map(o => {
      const type = OBSERVATION_TYPES.find(t => t.value === o.type);
      const linked = o.linkedIssueId ? ctx.snap?.issues.find(i => i.id === o.linkedIssueId) : undefined;
      const mine = raised.find(i => sectionOf(i, report) === o.id);
      const vo = o.type === 'instruction' ? variationOf(o.id) : undefined;
      const cs = corrections.filter(c => c.observationId === o.id);
      const dupIssue = mine ? (cs.find(c => c.action === 'already_raised' && c.targetType === 'issue')?.relatedId ?? duplicateOf(mine)) : undefined;
      const dupVo = vo ? (cs.find(c => c.action === 'already_raised' && c.targetType === 'variation')?.relatedId ?? duplicateOf(vo)) : undefined;
      const ownerFix = mine ? [...cs].reverse().find(c => c.action === 'within_contract' && c.targetType === 'issue') : undefined;
      const voWithin = !!vo && (isWithinContract(vo) || cs.some(c => c.action === 'within_contract' && c.targetType === 'variation'));
      const target: Target = (o.type === 'defect' || o.type === 'access') && mine ? { type: 'issue', record: mine } : vo ? { type: 'variation', record: vo } : { type: 'observation' };
      const open = !!correcting && acting === o.id;
      const head = <p><b>{o.location || 'Location not recorded'}</b> — {o.whatHappened}</p>;
      return <div key={o.id} ref={el => { sections.current[o.id] = el; }} className={`hist${correcting ? ' ro-qa-sec' : ''}${open ? ' ro-qa-acting' : ''}${cs.length ? ' ro-qa-corrected' : ''}`}><span className="d"><span className={`kind tone-${type?.tone ?? 'neutral'}`}>{type?.label.split(' ')[0] ?? o.type}</span>{cs.length > 0 && <span className="ro-qa-chip">Corrected</span>}</span>
        <div className="b">{correcting
            ? <div className="ro-qa-head">{head}<button type="button" className="ro-qa-btn" aria-expanded={open} onClick={() => toggleActing(o.id)}>{open ? 'Close' : 'Quick actions'}</button></div>
            : head}
          <div className="rowsub">{o.actionNeeded && <>Action: {o.actionNeeded} · </>}{o.owner && !ownerFix && <>Owner: {o.owner} · </>}{o.affectedTrade && <>Trade: {o.affectedTrade} · </>}{o.variationReason && <>{o.variationReason} · </>}{o.workDone && <><span className="late">already carried out</span> · </>}{o.askedBy && <>asked for by {o.askedBy} · </>}{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}
            {linked && <> · further sighting of <a className="ref" href={`#/projects/${code}/issue/${linked.id}`}>{shortRef(linked.reference)}</a></>}
            {mine && (dupIssue
              ? <> · raised <s><a className="ref" href={`#/projects/${code}/issue/${mine.id}`}>{shortRef(mine.reference)}</a></s> linked to {recordRef('issue', dupIssue)}</>
              : <> · raised <a className="ref" href={`#/projects/${code}/issue/${mine.id}`}>{shortRef(mine.reference)}</a> · <ConfirmTag i={mine} /></>)}
            {mine && ownerFix && !dupIssue && <> · Owner: <s>{priorOwner(ownerFix, o.owner)}</s> {mine.owner.trim() || OUR_CONTRACT}</>}
            {vo && (dupVo
              ? <> · raised <s><a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a></s> linked to {recordRef('variation', dupVo)}</>
              : voWithin
                ? <> · raised <a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a> · <s>Awaiting instruction</s> Within contract · not chargeable</>
                : <> · raised <a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a> · <InstructionTag v={vo} /></>)}</div>
          {o.photos.length > 0 && <div className="photos">{o.photos.map(ph => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || 'Site photograph'} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}
          {open && <QuickActions ctx={ctx} report={report} observation={o} target={target} engineer={engineer}
            onCancel={() => toggleActing(o.id)}
            onDone={() => { setActing(null); onWiden?.(false); setReloadFixes(n => n + 1); void ctx.refresh(); }} />}
          {correcting && cs.length > 0 && <ChangeLog ctx={ctx} list={cs} engineer={engineer} />}
        </div></div>;
    }) : <div className="empty">No updates were recorded on this visit.</div>}
    <SecH>Signature</SecH>
    <div className="rowsub">{report.signature ? `Signed ${report.signature.name} · ${fmtWhen(report.signature.signedAt)}` : 'No signature captured'} · Generated by Leodis Relay</div>
  </div>;
}
/* --------------------------------------------------------- quick actions */
/** Scroll the nearest scrolling ancestor so the element sits at its top. */
function scrollIntoColumn(el: HTMLElement) {
  let p = el.parentElement;
  while (p && !(/(auto|scroll)/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight)) p = p.parentElement;
  if (!p) { el.scrollIntoView({ block: 'start' }); return; }
  p.scrollTop += el.getBoundingClientRect().top - p.getBoundingClientRect().top - 8;
}

const MODE_LABEL: Record<CorrectionAction, string> = { within_contract: 'Falls under our contract', already_raised: 'Already raised', note: 'Add a note' };

/** One section's quick actions: pick a mode, see what it will do, confirm. */
function QuickActions({ ctx, report, observation, target, engineer, onCancel, onDone }: {
  ctx: Ctx; report: Report; observation: Observation; target: Target; engineer: string; onCancel: () => void; onDone: () => void;
}) {
  const rules = modesFor(target);
  const modes = (Object.keys(MODE_LABEL) as CorrectionAction[]).filter(m => rules[m]);
  const [mode, setMode] = useState<CorrectionAction | null>(target.type === 'observation' ? 'note' : null);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = engineer.split(' ')[0] || 'the engineer';
  const code = target.type === 'observation' ? '' : shortRef(target.record.reference);
  const pool = target.type === 'observation' ? [] : pickPool(target, ctx.snap?.issues ?? [], ctx.snap?.variations ?? []);
  const q = query.trim().toLowerCase();
  const shown = pool.filter(r => !q || `${shortRef(r.reference)} ${r.description} ${r.location}`.toLowerCase().includes(q));
  const picked = pool.find(r => r.id === pick);
  const blocked = modes.filter(m => !rules[m]!.on);
  const choose = (m: CorrectionAction) => { setMode(m); setPick(null); setError(''); };

  async function submit() {
    if (!mode) return;
    setBusy(true); setError('');
    try {
      await recordCorrection({
        reportId: report.id, observationId: observation.id, action: mode,
        targetType: target.type, targetId: target.type === 'observation' ? undefined : target.record.id,
        relatedId: mode === 'already_raised' ? pick ?? undefined : undefined, note: note.trim(),
      });
      toast(mode === 'within_contract'
        ? target.type === 'variation' ? `${code} marked within contract. ${first} will see this.` : `${code} moved to ${OUR_CONTRACT}. ${first} will see this.`
        : mode === 'already_raised' ? `${code} linked to ${picked ? shortRef(picked.reference) : 'the existing record'}. ${first} will see this.`
          : `Note saved. ${first} will see this.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That correction did not go through.');
      setBusy(false);
    }
  }

  const noteField = (label: string, placeholder: string, rows = 2) => <label className="ro-qa-label">{label}
    <textarea rows={rows} value={note} placeholder={placeholder} onChange={e => setNote(e.target.value)} disabled={busy} /></label>;
  const buttons = (label: string, disabled: boolean) => <div className="ro-qa-btns">
    <Btn className="btn-sm" disabled={disabled || busy} onClick={() => void submit()}>{busy ? 'Saving…' : label}</Btn>
    <BtnQ className="btn-sm" disabled={busy} onClick={onCancel}>Cancel</BtnQ></div>;

  let body: ReactNode;
  if (mode === 'within_contract' && target.type !== 'observation') {
    const owner = target.type === 'issue' ? target.record.owner.trim() || 'no owner' : '';
    body = <>
      <p className="ro-qa-what">{target.type === 'issue'
        ? <>Responsibility for <b>{code}</b> moves from <b>{owner}</b> to <b>{OUR_CONTRACT}</b>. It won&rsquo;t be chased with another company.</>
        : <><b>{code}</b> will be marked <b>within contract</b>. It won&rsquo;t be priced or charged.</>}</p>
      {noteField(`Why? (kept in the change log and recorded for ${first})`, 'e.g. On the M&E spec, rev C')}
      {buttons('Confirm change', false)}
    </>;
  } else if (mode === 'already_raised' && target.type !== 'observation') {
    const noun = target.type === 'issue' ? 'issue' : 'variation';
    const project = ctx.projects.find(p => p.id === report.projectId);
    body = <>
      <p className="ro-qa-what"><b>{code}</b> will be {target.type === 'issue' ? 'withdrawn' : 'declined'} as a duplicate and linked to the record you choose. A note is added to that record.</p>
      <label className="ro-qa-label">Find the existing {noun} on {project?.projectName ?? 'this project'}
        <input type="search" value={query} placeholder="Search code, title or location" onChange={e => setQuery(e.target.value)} disabled={busy} /></label>
      <div className="ro-qa-picks" role="radiogroup" aria-label={`Open ${noun}s`}>
        {shown.length ? shown.map(r => { const m = pickMark(r, ctx.day); return <button key={r.id} type="button" role="radio" aria-checked={pick === r.id} className="ro-qa-pick" onClick={() => setPick(r.id)} disabled={busy}>
          <span className="ro-qa-pk-code">{shortRef(r.reference)}</span>
          <span className="ro-qa-pk-t">{r.description || 'No description'}<small>{r.location || 'Location not recorded'}</small></span>
          <Mark kind={m.kind} label={m.label} size="sm" />
        </button>; }) : <div className="ro-qa-none">{pool.length ? 'No open records match.' : `No other open ${noun}s on this project.`}</div>}
      </div>
      {noteField('Note (optional)', 'e.g. Raised on 2 Sep, still outstanding')}
      {buttons(picked ? `Link to ${shortRef(picked.reference)}` : 'Choose a record', !picked)}
    </>;
  } else if (mode === 'note') {
    body = <>
      {noteField(`Note (kept in the change log and recorded for ${first})`, 'e.g. Good photos, but add the room number next time', 3)}
      {buttons('Save note', !note.trim())}
    </>;
  } else {
    body = <p className="ro-qa-what">Choose what to change. The report and its PDF stay as the engineer sent them.</p>;
  }

  return <div className="ro-qa">
    <div className="ro-qa-modes" role="group" aria-label="Quick actions">
      {modes.map(m => <button key={m} type="button" aria-pressed={mode === m} disabled={!rules[m]!.on || busy} onClick={() => choose(m)}>{MODE_LABEL[m]}</button>)}
    </div>
    {blocked.length > 0 && <p className="ro-qa-why">{[...new Set(blocked.map(m => rules[m]!.why))].join(' ')} You can still add a note.</p>}
    {body}
    {error && <p className="ro-qa-error" role="alert">{error}</p>}
  </div>;
}

/** What the office changed on one section, oldest first. */
function ChangeLog({ ctx, list, engineer }: { ctx: Ctx; list: Correction[]; engineer: string }) {
  return <div className="ro-qa-clog"><h6>Change log · {list.length}</h6>
    {list.map(c => <div key={c.id} className="ro-qa-centry">
      <span className="ro-qa-cwhen">{fmtWhen(c.at)}</span>
      <span className="ro-qa-cbody"><b>{c.title}</b>{c.detail && <span>{c.detail}</span>}{c.note && <q>{c.note}</q>}
        <small>{ctx.nameOf(c.actorId, c.actor)} · {c.engineerId || c.engineer ? ctx.nameOf(c.engineerId, c.engineer ?? engineer) : engineer} will see this</small></span>
    </div>)}
  </div>;
}

function raisedRef(observationId: string, raised: Issue[], code: string, report: Report) {
  const i = raised.find(x => sectionOf(x, report) === observationId);
  return i ? <a className="ref" href={`#/projects/${code}/issue/${i.id}`}>{shortRef(i.reference)}</a> : <span className="rowsub">no issue</span>;
}

/* ----------------------------------------------------------------- issue */
const EVENT_LABEL: Record<string, string> = { raised: 'Raised', progress: 'Update', closure_submitted: 'Closure submitted', verified: 'Verified closed', reopened: 'Reopened', confirmation: 'Review', assigned: 'Assigned', note: 'Note' };
export function IssueSheet({ ctx, id }: { ctx: Ctx; id: string }) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false; setError('');
    fetch(`/api/issues/${id}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(new Error('That issue could not be found.'))).then(i => { if (!stopped) setIssue(i); }).catch(e => { if (!stopped) setError(e.message); });
    return () => { stopped = true; };
  }, [id, ctx.snap?.loadedAt]);
  if (error) return <div className="sheet"><div className="empty">{error}</div></div>;
  if (!issue) return <div className="sheet"><div className="loading" style={{ minHeight: 160 }}>Loading issue</div></div>;
  const project = ctx.projects.find(p => p.id === issue.projectId); const code = project?.id ?? '';
  const source = issue.raisedByReport ? ctx.snap?.reports.find(r => r.id === issue.raisedByReport) : undefined;
  const active = isActive(issue); const overdue = isOverdue(issue, ctx.day);
  const closureMine = issue.closureSubmittedById ? issue.closureSubmittedById === ctx.me.id : issue.closureSubmittedBy === ctx.me.name;
  const d = (kind: string) => ctx.setDialog(dialogFor(kind, issue, ctx));
  const linkedVariations = ctx.snap?.variations.filter(v => v.linkedIssueId === issue.id) ?? [];
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Issue</div><h4>{issue.description}</h4><div className="rowsub"><span className="ref">{issue.reference}</span><span className="sep">/</span>{issue.location || 'Location not recorded'}<span className="sep">/</span>{issue.affectedTrade ?? (issue.reporterTrade ? `reported by ${issue.reporterTrade}` : 'trade not recorded')}</div></div>
      <div className="actions">
        <Link className="btn btn-q btn-sm" href={withViewReturn(`/issues/${issue.id}`, officeReturn(ctx))}>Issue page</Link>
        {active && issue.work !== 'awaiting_verification' && (issue.owner ? <BtnQ className="btn-sm" onClick={() => d('assign')}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => d('assign')}>Assign</Btn>)}
        {active && issue.work === 'awaiting_verification' && !closureMine && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue })}>Verify</Btn>}
        {active && issue.work === 'awaiting_verification' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue })}>Not finished</BtnQ>}
        {issue.work === 'closed' && issue.confirmation !== 'withdrawn' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue })}>Reopen</BtnQ>}
        {active && issue.confirmation === 'disputed' && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'triage', issue })}>Triage</Btn>}
        {active && issue.confirmation === 'provisional' && <><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'confirm', issue })}>Confirm</BtnQ><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'withdraw', issue })}>Withdraw</BtnQ></>}
      </div></div>
    <dl className="tb"><div><dt>Work</dt><dd><WorkTag i={issue} day={ctx.day} /><small>{WORK_LABEL[issue.work]}{overdue ? ` · ${daysLate(issue.targetDate, ctx.day)} days past target` : ''}</small></dd></div><div><dt>Confirmation</dt><dd><ConfirmTag i={issue} /><small>{CONFIRM_LABEL[issue.confirmation]}</small></dd></div><div><dt>Owner</dt><dd>{issue.owner.trim() || <span className="late">Unassigned</span>}</dd></div><div><dt>Target</dt><dd className={`num ${overdue ? 'late' : ''}`}>{issue.targetDate || '—'}</dd></div></dl>
    {issue.actionNeeded && <div className="note info"><span><b>Action needed.</b> {issue.actionNeeded}</span></div>}
    {issue.confirmation === 'disputed' && <div className="note bad"><span><b>Disputed.</b> The report that raised this was sent back. Any work already done stands; the observation needs a decision.</span></div>}
    {issue.work === 'awaiting_verification' && <div className={`note ${closureMine ? 'warn' : 'good'}`}><span><b>Closure submitted by {issue.closureSubmittedBy ?? 'unknown'}</b> · waiting {daysSince(issue.events.at(-1)?.at)} days. {closureMine ? 'You submitted this closure, so someone else has to verify it.' : 'Verify it if the work is done, or send it back as not finished.'}</span></div>}
    {linkedVariations.length > 0 && <div className="note info"><span><b>Variation{linkedVariations.length === 1 ? '' : 's'} on this issue:</b> {linkedVariations.map((v, i) => <span key={v.id}>{i > 0 && ', '}<a className="ref" href={`#/projects/${code}/variation/${v.id}`}>{shortRef(v.reference)}</a> {INSTRUCTION_LABEL[v.instruction].toLowerCase()}</span>)}.</span></div>}
    <dl className="tb two" style={{ marginTop: 12 }}><div><dt>Source</dt><dd>{source ? <>Raised by <a className="ref" href={`#/projects/${code}/report/${source.id}`}>{shortRef(source.reference)}</a> · {fmtDay(issue.raisedAt)}</> : issue.source === 'individual' ? <>Flagged on site by {issue.reportedBy ?? 'unknown'} · {fmtDay(issue.raisedAt)}</> : <>Raised {fmtDay(issue.raisedAt)}</>}<small>{issue.reportedBy ?? issue.events[0]?.actor ?? 'Reporter not recorded'}{issue.reporterTrade ? ` · ${issue.reporterTrade}` : ''}</small></dd></div><div><dt>Progress notes</dt><dd>Add updates and photographs on the issue page.<small>Engineers can submit the work as complete there; the office verifies here.</small></dd></div></dl>
    <SecH right={<span className="r">{issue.events.length}</span>}>History</SecH>
    {issue.events.slice().reverse().map((e, i) => <div key={i} className="hist"><span className="d">{fmtDay(e.at)}<div className="rowsub">{EVENT_LABEL[e.kind] ?? e.kind}</div></span><div className="b"><p>{e.note || <span className="fine">No note</span>}</p><div className="rowsub">{ctx.nameOf(e.actorId, e.actor)}</div>{e.photos.length > 0 && <div className="photos">{e.photos.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}</div></div>)}
  </div>;
}

/* ------------------------------------------------------------- variation */
const VARIATION_EVENT: Record<string, string> = { raised: 'Raised', details: 'Details', priced: 'Priced', instructed: 'Instructed', declined: 'Declined', within_contract: 'Within contract', reopened: 'Reopened', note: 'Note' };
export function VariationSheet({ ctx, id }: { ctx: Ctx; id: string }) {
  const [v, setV] = useState<Variation | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false; setError('');
    getVariation(id).then(x => { if (!stopped) setV(x); }).catch(e => { if (!stopped) setError(e instanceof Error ? e.message : 'That variation could not be found.'); });
    return () => { stopped = true; };
  }, [id, ctx.snap?.loadedAt]);
  if (error) return <div className="sheet"><div className="empty">{error}</div></div>;
  if (!v) return <div className="sheet"><div className="loading" style={{ minHeight: 160 }}>Loading variation</div></div>;
  const project = ctx.projects.find(p => p.id === v.projectId); const code = project?.projectNumber ?? '';
  const source = v.raisedByReport ? ctx.snap?.reports.find(r => r.id === v.raisedByReport) : undefined;
  const linked = v.linkedIssueId ? ctx.snap?.issues.find(i => i.id === v.linkedIssueId) : undefined;
  const cost = expectedCost(v), value = variationValue(v), margin = estimatedMargin(v), pct = marginPct(v);
  const evidence = v.events.find(e => e.kind === 'raised')?.photos ?? [];
  const d = (kind: 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details') => ctx.setDialog({ kind, variation: v });
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Variation</div><h4>{v.description}</h4><div className="rowsub"><span className="ref">{v.reference}</span><span className="sep">/</span>{v.location || 'Location not recorded'}<span className="sep">/</span>{v.trade ?? 'trade not set'}<span className="sep">/</span>{v.reason ?? 'reason not set'}</div></div>
      <div className="actions">
        <BtnQ className="btn-sm" onClick={() => d('variation-details')}>Edit details</BtnQ>
        {v.instruction === 'pending' && (v.quotedValue === undefined ? <Btn className="btn-sm" onClick={() => d('variation-price')}>Price</Btn> : <BtnQ className="btn-sm" onClick={() => d('variation-price')}>Reprice</BtnQ>)}
        {v.instruction === 'pending' && (v.quotedValue === undefined ? <BtnQ className="btn-sm" onClick={() => d('variation-instruct')}>Instruct</BtnQ> : <Btn className="btn-sm" onClick={() => d('variation-instruct')}>Instruct</Btn>)}
        {v.instruction === 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-decline')}>Decline</BtnQ>}
        {v.instruction !== 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-reopen')}>Reopen</BtnQ>}
      </div></div>
    <dl className="tb"><div><dt>Instruction</dt><dd><InstructionTag v={v} /><small>{v.instruction === 'instructed' ? `${v.instructionReference} · ${v.instructedBy} · ${v.instructedOn}` : v.instruction === 'declined' ? 'the client will not instruct it' : v.instruction === 'within_contract' ? 'within our contract, not chargeable' : v.quotedValue === undefined ? 'price it before it can be put to the client' : 'quoted, waiting on the client'}</small></dd></div><div><dt>Quoted</dt><dd><Money n={v.quotedValue} /><small>{cost !== undefined ? `expected cost ${fmtMoney(cost)}` : 'not costed'}</small></dd></div><div><dt>Instructed value</dt><dd><Money n={v.instruction === 'instructed' ? value : undefined} /><small>{v.instruction === 'instructed' ? (v.instructedValue === undefined ? 'on rates; quote carried' : v.instructedValue === v.quotedValue ? 'as quoted' : `quoted ${fmtMoney(v.quotedValue)}`) : 'fixed once instructed'}</small></dd></div><div><dt>Estimated margin</dt><dd className={margin !== undefined && margin < 0 ? 'late' : ''}><Money n={v.instruction === 'declined' ? undefined : margin} /><small>{pct !== undefined && v.instruction !== 'declined' ? `${fmtPct(pct)} of ${v.instruction === 'instructed' ? 'the instructed value' : 'the quote'}` : 'needs a cost and a value'}</small></dd></div></dl>
    {v.workDone && v.instruction === 'pending' && <div className="note bad"><span><b>Work already carried out with nothing in writing.</b> Get the client’s sign-off recorded as a chargeable variation before it is invoiced; a signature that only confirms attendance is not an instruction. See the variation sign-off note in the docs.</span></div>}
    {v.instruction === 'pending' && v.quotedValue === undefined && !v.workDone && <div className="note warn"><span><b>Not yet priced.</b> Labour, parts, plant and an uplift give the expected cost and a suggested quote; the quoted value is the office’s call.</span></div>}
    {v.instruction === 'instructed' && v.signedInstruction && <div className="note good"><span><b>Signed copy on file.</b></span><a className="btn btn-q btn-sm" href={v.signedInstruction} target="_blank" rel="noreferrer">Open signed copy ↗</a></div>}
    {v.instruction === 'instructed' && !v.signedInstruction && <div className="note warn"><span><b>No signed copy linked.</b> The instruction is recorded as {v.instructionReference}; add the link to the signed document when it is filed.</span></div>}
    <dl className="tb two" style={{ marginTop: 12 }}>
      <div><dt>Source</dt><dd>{source ? <>Raised by <a className="ref" href={`#/projects/${code}/report/${source.id}`}>{shortRef(source.reference)}</a> · {fmtDay(v.raisedAt)}</> : <>Raised {fmtDay(v.raisedAt)}</>}<small>{v.raisedBy}{v.raiserTrade ? ` · ${v.raiserTrade}` : ''}{v.askedBy && <> · asked for on site by {v.askedBy}</>}{linked && <> · on issue <a className="ref" href={`#/projects/${code}/issue/${linked.id}`}>{shortRef(linked.reference)}</a></>}</small></dd></div>
      <div><dt>Expected cost</dt><dd>{cost === undefined ? <span className="fine">Not costed</span> : <span className="money">{fmtMoney(cost)}</span>}<small>{cost === undefined ? 'labour × rate + parts + plant' : `${fmtHours(v.labourHours)} × ${fmtMoney(v.labourRate)} labour · ${fmtMoney(v.partsCost)} parts · ${fmtMoney(v.plantSubcontract)} plant${v.upliftPct !== undefined ? ` · ${v.upliftPct}% uplift` : ''}`}</small></dd></div>
    </dl>
    {evidence.length > 0 && <><SecH right={<span className="r">{evidence.length}</span>}>Evidence from the visit</SecH><div className="photos">{evidence.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div></>}
    <SecH right={<span className="r">{v.events.length}</span>}>History</SecH>
    {v.events.slice().reverse().map((e, i) => <div key={i} className="hist"><span className="d">{fmtDay(e.at)}<div className="rowsub">{VARIATION_EVENT[e.kind] ?? e.kind}</div></span><div className="b"><p>{e.note || <span className="fine">No note</span>}</p><div className="rowsub">{ctx.nameOf(e.actorId, e.actor)}</div>{e.photos.length > 0 && e.kind !== 'raised' && <div className="photos">{e.photos.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}</div></div>)}
  </div>;
}
