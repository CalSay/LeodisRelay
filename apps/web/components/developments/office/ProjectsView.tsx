'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { PhotoImage } from '@/components/PhotoImage';
import { getReport, getVariation } from '@/lib/api';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { answerLabel, reportTypeOf } from '@/lib/reportTypes';
import { SubmissionStages } from '@/components/SubmissionStages';
import { useFeatures } from '@/components/FeaturesContext';
import { projectStatusGroups } from '@/lib/projectGroups';
import { officeActions, sinceWords } from '@/lib/officeActions';
import { withViewReturn } from '@/lib/viewNavigation';
import { confirmationNote } from '@/lib/issueConfirmation';
import type { Issue, Report, ReportSummary, Variation } from '@/lib/types';
import { INSTRUCTION_LABEL, estimatedMargin, expectedCost, fmtHours, fmtMoney, fmtPct, marginPct, signedCopyLink, variationValue } from '@/lib/variations';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Bar, BarKey, Btn, BtnQ, ConfirmTag, DeliveryTag, Found, InstructionTag, Meta, Money, ReviewTag, SecH, Tag, WorkTag } from './bits';
import { WORK_LABEL, notAcknowledged, daysLate, daysSince, fmtDate, fmtDay, fmtWhen, isActive, isOverdue, deliveryItems, permitItems, safetyItems, shortRef, toneTag, type ProjectStats } from './model';
import { signatureMethod } from '@/lib/signature';
import { LATEST_DAYS, progressLines, recentDay, type ProjectStanding } from '@/lib/projectStanding';

/* --------------------------------------------------------------- columns */
export function ProjectsView({ ctx }: { ctx: Ctx }) {
  const s = ctx.route.a ? ctx.statOf(ctx.route.a) : undefined;
  const kind = s && (ctx.route.b === 'report' || ctx.route.b === 'issue' || ctx.route.b === 'variation') ? ctx.route.b : null;
  const id = kind ? ctx.route.c : null;
  const depth = !s ? 1 : !kind ? 2 : 3;
  // A phone shows one stacked page, so a new record starts at its top, not where the last one was scrolled to.
  useEffect(() => { if (window.matchMedia('(max-width:700px)').matches) window.scrollTo(0, 0); }, [depth, s?.code, id]);
  const projects = <ProjectsCol key="projects" ctx={ctx} current={s} />;
  const main = <div key="main" className="col col-main">
      <div className="col-head">{s && <a className="col-back" href={kind ? `#/projects/${s.code}` : '#/projects'}>‹ {kind ? 'Register' : 'Projects'}</a>}<h2>{s ? 'Details' : 'Overview'}</h2><i>{s ? s.project.projectNumber : 'Office'}</i></div>
      <div className="colpad">
        {!ctx.snap ? <div className="loading">Loading office records</div>
          : kind === 'report' && id ? <ReportReader ctx={ctx} id={id} />
          : kind === 'issue' && id ? <IssueSheet ctx={ctx} id={id} />
          : kind === 'variation' && id ? <VariationSheet ctx={ctx} id={id} />
          : s ? <ProjectSheet ctx={ctx} s={s} /> : <OfficeSheet ctx={ctx} />}
      </div>
    </div>;
  // With no project chosen the office position comes first in reading order, as it does on a phone; the desk still places it on the right.
  return <div className="cols" data-depth={depth}>
    {!s ? [main, projects] : [projects, <RegisterCol key="register" ctx={ctx} s={s} kind={kind} id={id} />, main]}
  </div>;
}

/** "1 report", "3 issues". */
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
function officeReturn(ctx: Ctx): string {
  const route = [ctx.route.tab, ctx.route.a, ctx.route.b, ctx.route.c].filter((part): part is string => !!part);
  return `/office#/${route.join('/')}`;
}

function ProjectsCol({ ctx, current }: { ctx: Ctx; current?: ProjectStats }) {
  return <div className="col col-projects">
    <div className="col-head"><h2>Projects</h2><i>{ctx.projects.length} reportable</i></div>
    {projectStatusGroups(ctx.projects).map(group => <div key={group.status} className={`project-group project-group-${group.tone}`}>
      <div className="grp project-group-title">{group.label}<i>{group.projects.length}</i></div>
      {group.projects.map(p => {
      const s = ctx.statOf(p.id);
      return <a key={p.id} className={`item ${current?.code === p.id ? 'on' : ''}`} href={`#/projects/${p.id}`}>
        <div className="item-top"><div className="rowtitle">{p.projectName}</div><span className="arrow">›</span></div>
        <div className="rowsub"><span className="ref">{p.projectNumber}</span> · {p.projectManager} · {p.division.replace('Leodis ', '')}</div>
        {s ? <><Bar c={s.rollup} /><Meta c={s.rollup} /><VisitMeta s={s} day={ctx.day} />{s.pendingVariations.length > 0 && <div className="meta"><span className={s.exposedVariations.length ? 'late' : ''}>{s.pendingVariations.length} variation{s.pendingVariations.length === 1 ? '' : 's'} awaiting instruction</span></div>}</> : <div className="cbar" style={{ marginTop: 8 }} />}
      </a>;
      })}
    </div>)}
    <div className="colpad sticky-foot"><BarKey /><div className="rowsub">Tenders and completed jobs are not listed.</div></div>
  </div>;
}

/** "Last visit today · Electrical", or how long an active site has gone without a report. */
function VisitMeta({ s, day }: { s: ProjectStats; day: string }) {
  const v = lastVisitWords(s.standing, day);
  const last = s.standing.last;
  return <div className="meta"><span className={v.quiet ? 'late' : ''}>{v.quiet ?? (last ? `Last visit ${visitDay(last.visitDate, day)}${last.trade ? ` · ${last.trade}` : ''}` : 'No visit yet')}</span></div>;
}

/** True on a phone, where the register stands in for the project sheet. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-width:700px)'); const on = () => setPhone(m.matches);
    on(); m.addEventListener('change', on); return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

type Filter = 'action' | 'reports' | 'issues' | 'variations' | 'drafts';
function RegisterCol({ ctx, s, kind, id }: { ctx: Ctx; s: ProjectStats; kind: string | null; id: string | null }) {
  const [filter, setFilter] = useState<Filter>('action');
  useEffect(() => { setFilter('action'); }, [s.code]);
  const phone = usePhone();
  const day = ctx.day;
  const reportRow = (r: ReportSummary) => <a key={r.id} className={`arow ${kind === 'report' && id === r.id ? 'on' : ''}`} href={`#/projects/${s.code}/report/${r.id}`}>
    <span className="ref">{shortRef(r.reference)}{r.revision > 1 ? ` r${r.revision}` : ''}</span>
    <span className="nm">{r.author}{r.authorTrade ? ` · ${r.authorTrade}` : ''}<small>{fmtWhen(r.serverAcknowledgedAt)} · {foundWords(r)}</small></span>
    {r.review === 'pending' ? <Tag label="To review" cls="tag-caution" /> : r.review === 'returned' ? <Tag label="Returned" cls="tag-alert" /> : <DeliveryTag r={r} />}
  </a>;
  const issueRow = (i: Issue) => <a key={i.id} className={`arow ${kind === 'issue' && id === i.id ? 'on' : ''}`} href={`#/projects/${s.code}/issue/${i.id}`}>
    <span className="ref">{shortRef(i.reference)}</span>
    <span className="nm">{i.description}<small>{i.location || 'no location'} · {i.owner || 'unassigned'}{i.targetDate ? ` · target ${fmtDay(i.targetDate)}` : ''}</small></span>
    <WorkTag i={i} day={day} />
  </a>;
  const variationRow = (v: Variation) => <a key={v.id} className={`arow ${kind === 'variation' && id === v.id ? 'on' : ''}`} href={`#/projects/${s.code}/variation/${v.id}`}>
    <span className="ref">{shortRef(v.reference)}</span>
    <span className="nm">{v.description}<small>{v.location || 'no location'} · {v.instruction === 'instructed' ? `${fmtMoney(variationValue(v))} · ${v.instructionReference}` : v.quotedValue !== undefined ? `quoted ${fmtMoney(v.quotedValue)}` : 'not priced'}{v.workDone && v.instruction === 'pending' ? ' · work done' : ''}</small></span>
    <InstructionTag v={v} />
  </a>;
  const draftRow = (r: ReportSummary) => <div key={r.id} className="arow"><span className="ref fine">DRAFT</span><span className="nm">{r.author}{r.authorTrade ? ` · ${r.authorTrade}` : ''} · visit {fmtDay(r.visitDate)}<small>Saved {fmtWhen(r.lastSavedAt)} · {r.observationCount} card{r.observationCount === 1 ? '' : 's'} · {r.corrects ? 'correction in progress' : 'contents private until sent'}</small></span><Tag label="Draft" cls="tag-caution" /></div>;
  const attnReports = [...s.failed, ...s.pendingReview, ...s.returned];
  const attnIssues = [...new Map([...s.overdue, ...s.disputed, ...s.verify, ...s.unassigned].map(i => [i.id, i])).values()];
  const attnVariations = [...new Map([...s.exposedVariations, ...s.unpricedVariations].map(v => [v.id, v])).values()];
  // Safety, permits and deliveries for this project, the same lines as the sheet's Needs attention, so a phone (which shows this column, not the sheet) sees them too.
  const onSite = siteItems(ctx, s);
  const closed = s.issues.filter(i => !isActive(i));
  const settled = s.variations.filter(v => v.instruction !== 'pending');
  return <div className="col">
    <div className="col-head"><a className="col-back" href="#/projects">‹ Projects</a><h2>Register · {s.project.projectName}</h2><i>{s.reports.length} report{s.reports.length === 1 ? '' : 's'} · {s.active.length} open</i></div>
    {/* A phone shows this column in place of the project sheet, so where the project stands and what site said come first. */}
    {phone && <div className="phone-only register-standing"><VisitMeta s={s} day={day} /><LatestFromSite ctx={ctx} s={s} shown={2} /></div>}
    <div className="filters" style={{ border: 0, borderBottom: '1px solid var(--line)', padding: '8px 16px' }}>
      {([['action', `Needs action · ${s.needsAction + onSite.length}`], ['reports', `Reports · ${s.reports.length}`], ['issues', `Issues · ${s.issues.length}`], ['variations', `Variations · ${s.variations.length}`], ['drafts', `Drafts · ${s.drafts.length}`]] as [Filter, string][]).map(([k, l]) => <button type="button" key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
    </div>
    {filter === 'action' && <>
      {onSite.length > 0 && <><div className="grp">Safety, permits and deliveries<i>{onSite.length}</i></div>{onSite.map(i => <Link key={i.key} className="arow" href={i.go}><span className="ref">{i.projectNumber}</span><span className="nm">{i.title}<small>{i.sub}</small></span><Tag {...i.tag} /></Link>)}</>}
      <div className="grp">Reports needing attention<i>{attnReports.length}</i></div>
      {attnReports.length ? attnReports.map(reportRow) : <div className="empty" style={{ padding: 14 }}>{s.reviewOn ? 'Nothing waits for review or correction.' : 'No report needs attention.'}</div>}
      <div className="grp">Issues needing action<i>{attnIssues.length} of {s.active.length}</i></div>
      {attnIssues.length ? attnIssues.map(issueRow) : <div className="empty" style={{ padding: 14 }}>Nothing overdue, unassigned, disputed or waiting to be checked.</div>}
      {attnVariations.length > 0 && <><div className="grp">Variations needing a quote or an instruction<i>{attnVariations.length} of {s.pendingVariations.length}</i></div>{attnVariations.map(variationRow)}</>}
      {s.drafts.length > 0 && <><div className="grp">Drafts on site<i>{s.drafts.length}</i></div>{s.drafts.map(draftRow)}</>}
    </>}
    {filter === 'reports' && (s.reports.length ? s.reports.map(reportRow) : <div className="empty">No reports received on this project.</div>)}
    {filter === 'issues' && <>
      <div className="grp">Open<i>{s.active.length}</i></div>
      {s.active.length ? s.active.slice().sort((a, b) => Number(isOverdue(b, day)) - Number(isOverdue(a, day))).map(issueRow) : <div className="empty" style={{ padding: 14 }}>Nothing outstanding.</div>}
      <div className="grp">Closed or withdrawn<i>{closed.length}</i></div>
      {closed.map(issueRow)}
    </>}
    {filter === 'variations' && <>
      <div className="grp">Awaiting instruction<i>{s.pendingVariations.length}</i></div>
      {s.pendingVariations.length ? s.pendingVariations.map(variationRow) : <div className="empty" style={{ padding: 14 }}>Nothing awaiting instruction.</div>}
      <div className="grp">Instructed or declined<i>{settled.length}{s.instructedValue ? ` · ${fmtMoney(s.instructedValue)} instructed` : ''}</i></div>
      {settled.length ? settled.map(variationRow) : <div className="empty" style={{ padding: 14 }}>No variations instructed or declined yet.</div>}
    </>}
    {filter === 'drafts' && (s.drafts.length ? s.drafts.map(draftRow) : <div className="empty">No drafts saved to the server on this project.</div>)}
    {/* And the project's other pages after its records. */}
    <div className="phone-only"><ProjectLinks ctx={ctx} projectId={s.project.id} heading="h3" projectPage /></div>
    <div className="colpad sticky-foot"><div className="rowsub">{filter === 'action' ? `${onSite.length ? 'Safety, permit and delivery lines each open their own page. ' : ''}Needs action hides ${count(s.reports.length - attnReports.length, 'report')}, ${count(s.issues.length - attnIssues.length, 'issue')} and ${count(s.variations.length - attnVariations.length, 'variation')} that need nobody.` : ''} Reports, issues and variations share one column because the office reads them as one stream. Work held only on an engineer’s device is not visible here.</div></div>
  </div>;
}

function foundWords(r: ReportSummary): string {
  // An inspection says what it is and how many checks need action.
  if (r.checks) return `${reportTypeOf(r).name.toLowerCase()}${r.inspected ? ` of ${r.inspected}` : ''}, ${r.checks.action ? `${r.checks.action} action${r.checks.action === 1 ? '' : 's'}` : 'no actions'}`;
  const k = r.kindCounts;
  if (!k) return r.defectCount ? `${r.defectCount} raising an issue` : `${r.observationCount} card${r.observationCount === 1 ? '' : 's'}`;
  const parts: string[] = [];
  if (k.defect) parts.push(`${k.defect} defect${k.defect === 1 ? '' : 's'}`);
  if (k.instruction) parts.push(`${k.instruction} variation${k.instruction === 1 ? '' : 's'}`);
  if (k.access) parts.push(`${k.access} access`);
  if (!parts.length) parts.push('progress only');
  return parts.join(', ');
}

/* ---------------------------------------------------------------- sheets */
function OfficeSheet({ ctx }: { ctx: Ctx }) {
  const snap = ctx.snap!;
  const pendingVariations = ctx.stats.flatMap(s => s.pendingVariations);
  const openIssues = snap.issues.filter(isActive).length;
  const groups = actionGroups(ctx);
  // Read with the rest of the desk, so the button, the bell and Needs attention count from one answer.
  const safety = snap.safety?.totals;
  // Switched off by the office (lib/featureSwitch.ts): no button to a page that is not in use.
  const { safetyRecords } = useFeatures();
  // Where each project stands comes first: it is the question the office opens RELAY to answer.
  // The totals, overdue count and latest reports that used to sit here are in that list, the
  // action groups and the Inbox, so they are no longer repeated.
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs">Leodis Developments</div><h3>Office position</h3><div className="rowsub">{ctx.projects.length} reportable project{ctx.projects.length === 1 ? '' : 's'} · {snap.reports.length} report{snap.reports.length === 1 ? '' : 's'} received · {openIssues} open issue{openIssues === 1 ? '' : 's'} · {pendingVariations.length} variation{pendingVariations.length === 1 ? '' : 's'} awaiting instruction · {fmtDate(snap.loadedAt)}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={`/coverage?${new URLSearchParams({ returnTo: officeReturn(ctx) })}`}>Site coverage</Link><Link className="btn btn-q btn-sm" href={`/companies?${new URLSearchParams({ returnTo: officeReturn(ctx) })}`}>Issues by company</Link>{safetyRecords && <Link className="btn btn-q btn-sm" href={`/safety-actions?${new URLSearchParams({ returnTo: officeReturn(ctx) })}`}>Safety actions{safety ? ` · ${safety.open} open` : ''}</Link>}</div></div>
    {!snap.reports.length && !snap.issues.length && !snap.variations.length && <div className="note info office-first" role="status"><span>
      <b>Nothing has come in from site yet.</b> Reports arrive in the Inbox as engineers send them, and their defects and variations fill the Issues and Variations registers. Choose a project to see its sheet, or open Help for how RELAY works.
    </span></div>}
    <ActionStrip groups={groups} />
    <ProjectGlance ctx={ctx} />
    <ActionGroups groups={groups} />
    <SecH right={<a href="#/issues">All →</a>}>Also needs attention</SecH>
    <AttentionList ctx={ctx} limit={6} skipActions />
    <p className="rowsub" style={{ marginTop: 16 }}>A report is <b>received</b> when the server has it and on file from then on. The email to the project manager is a notification that it came in, and <b>read</b> means someone in the office acknowledged it. Choose a project to drill in.</p>
  </div>;
}

/** "today", "yesterday" or "Mon 19 Oct". */
function visitDay(visitDate: string, day: string): string {
  return recentDay(visitDate, day) ?? fmtDay(visitDate);
}
/** The last visit in words, with whether an active site has gone quiet. */
function lastVisitWords(st: ProjectStanding, day: string): { when: string; who: string; quiet: string | null } {
  if (!st.last) return { when: 'No visit yet', who: 'no report sent from site', quiet: st.quiet ? 'No report yet' : null };
  const when = visitDay(st.last.visitDate, day);
  return { when: when.charAt(0).toUpperCase() + when.slice(1), who: `${st.last.author}${st.last.trade ? `, ${st.last.trade}` : ''}`,
    quiet: st.quiet ? `No report for ${count(st.workingDaysSince ?? 0, 'working day')}` : null };
}

/**
 * Every project on one list, each answering the office's questions in the
 * same place: when was somebody last there, how much was reported this week
 * and by whom, what is still open, which variations wait, and how much needs
 * the office. Built from the records the desk already holds.
 */
function ProjectGlance({ ctx }: { ctx: Ctx }) {
  const day = ctx.day;
  return <section className="glance" aria-labelledby="glance-h">
    <SecH right={<Link href={`/coverage?${new URLSearchParams({ returnTo: officeReturn(ctx) })}`}>Day by day →</Link>}><span id="glance-h">Where each project stands</span></SecH>
    {projectStatusGroups(ctx.projects).filter(g => g.projects.length).map(group => <div key={group.status} className="glance-group">
      <div className="grp">{group.label}<i>{group.projects.length}</i></div>
      <ul className="glance-list">{group.projects.map(p => {
        const s = ctx.statOf(p.id); if (!s) return null;
        const v = lastVisitWords(s.standing, day);
        const exposed = s.exposedVariations.length, unpriced = s.unpricedVariations.length;
        // The same count as the project register's Needs action chip; reports not yet read are said beside it.
        const action = s.needsAction + siteItems(ctx, s).length, unread = s.reports.filter(notAcknowledged).length;
        return <li key={p.id}><a className="glance-row" href={`#/projects/${p.id}`}>
          <span className="glance-name"><b>{p.projectName}</b><span className="rowsub"><span className="ref">{p.projectNumber}</span> · {p.projectManager}</span></span>
          <dl className="glance-cells">
            <div><dt>Last visit</dt><dd className={v.quiet ? 'late' : ''}>{v.when}<small>{v.quiet ?? v.who}</small></dd></div>
            <div><dt>This week</dt><dd>{count(s.standing.thisWeek, 'visit')}<small>{s.standing.tradesThisWeek.join(', ') || 'nobody yet'}</small></dd></div>
            <div><dt>Open issues</dt><dd className={s.overdue.length ? 'late' : ''}>{s.active.length}<small>{s.overdue.length ? `${s.overdue.length} overdue` : 'none overdue'}</small></dd></div>
            <div><dt>Variations waiting</dt><dd className={exposed ? 'late' : unpriced ? 'soon' : ''}>{s.pendingVariations.length}<small>{exposed ? `${exposed} done, not instructed` : unpriced ? `${unpriced} to price` : s.pendingVariations.length ? 'priced, with the client' : 'none waiting'}</small></dd></div>
            <div><dt>Needs action</dt><dd className={action ? 'soon' : ''}>{action}<small>{action ? 'for the office' : 'nothing for the office'}{unread ? ` · ${count(unread, 'report')} not read` : ''}</small></dd></div>
          </dl>
          <span className="arrow" aria-hidden="true">›</span>
        </a></li>;
      })}</ul>
    </div>)}
  </section>;
}

/** A project's safety, permit and delivery lines for Needs attention, in the order model.ts `attention` gives them. */
function siteItems(ctx: Ctx, s: ProjectStats) {
  const safety = safetyItems([s], ctx.snap?.safety, officeReturn(ctx));
  return [...safety.filter(i => i.kind !== 'inspection'), ...permitItems([s], ctx.snap?.permits, officeReturn(ctx)), ...safety.filter(i => i.kind === 'inspection'), ...deliveryItems([s], ctx.snap?.deliveries, officeReturn(ctx))];
}

function AttentionList({ ctx, s, limit, skipActions }: { ctx: Ctx; s?: ProjectStats; limit: number; skipActions?: boolean }) {
  const scope = s ? [s] : ctx.stats;
  const failed = scope.flatMap(st => st.failed.map(r => ({ key: r.id, ref: shortRef(r.reference), b: 'Report could not be processed', sub: `${st.project.projectName} · ${r.author} · received ${fmtDay(r.serverAcknowledgedAt)}`, tag: { label: 'Processing', cls: 'tag-alert' }, go: `#/projects/${st.code}/report/${r.id}` })));
  // Safety lines go straight after a failed report, as in the Attention list (model.ts `attention`).
  // Permits past their end time come after open safety actions, as in model.ts `attention`.
  const safetyLines = safetyItems(scope, ctx.snap?.safety, officeReturn(ctx));
  const safety = [...safetyLines.filter(i => i.kind !== 'inspection'), ...permitItems(scope, ctx.snap?.permits, officeReturn(ctx)), ...safetyLines.filter(i => i.kind === 'inspection')]
    .map(i => ({ key: i.key, ref: i.projectNumber, b: i.title, sub: i.sub, tag: i.tag, go: i.go }));
  // Deliveries still to sort come after work done with no instruction, as in model.ts `attention`.
  const deliveries = deliveryItems(scope, ctx.snap?.deliveries, officeReturn(ctx)).map(i => ({ key: i.key, ref: i.projectNumber, b: i.title, sub: i.sub, tag: i.tag, go: i.go }));
  const items = [...failed, ...safety, ...scope.flatMap(st => [
    ...st.pendingReview.map(r => ({ key: r.id, ref: shortRef(r.reference), b: 'Awaiting review', sub: `${st.project.projectName} · ${r.author}`, tag: { label: 'Review', cls: 'tag-caution' }, go: `#/projects/${st.code}/report/${r.id}` })),
    ...st.overdue.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · ${i.owner || 'unassigned'} · target ${fmtDay(i.targetDate)}`, tag: { label: `${daysLate(i.targetDate, ctx.day)}d overdue`, cls: 'tag-alert' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.exposedVariations.map(v => ({ key: v.id, ref: shortRef(v.reference), b: v.description, sub: `${st.project.projectName} · work done, no written instruction`, tag: { label: 'Not instructed', cls: 'tag-alert' }, go: `#/projects/${st.code}/variation/${v.id}` })),
    ...deliveries.filter(d => d.key === `dl-${st.code}`),
    ...st.disputed.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · disputed at review`, tag: { label: 'Triage', cls: 'tag-alert' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    // The office position lists verification and unassigned issues in their own groups above.
    ...(skipActions ? [] : st.verify).map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · closure by ${i.closureSubmittedBy ?? 'unknown'}`, tag: { label: 'Fixed, to check', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...(skipActions ? [] : st.unassigned).map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · nobody owns it · raised ${fmtDay(i.raisedAt)}`, tag: { label: 'Unassigned', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.unpricedVariations.filter(v => !v.workDone).map(v => ({ key: v.id, ref: shortRef(v.reference), b: v.description, sub: `${st.project.projectName} · variation, no quote yet · raised ${fmtDay(v.raisedAt)}`, tag: { label: 'Needs a quote', cls: 'tag-caution' }, go: `#/projects/${st.code}/variation/${v.id}` })),
  ])];
  const shown = [...new Map(items.map(i => [i.key, i])).values()].slice(0, limit);
  return <div className="rmenu">{shown.length ? shown.map(i => <a key={i.key} href={i.go}><span className="ref">{i.ref}</span><div className="rt"><b>{i.b}</b><span>{i.sub}</span></div><Tag {...i.tag} /></a>) : <div className="empty" style={{ padding: 14 }}>Nothing needs attention.</div>}</div>;
}

/** New, not yet read, unassigned and fixed, to check: what a project manager acts on, each with its count. */
interface ActionGroup { key: string; title: string; sub: string; n: number; tone: string; all: string; empty: string; rows: ReactNode[] }
function actionGroups(ctx: Ctx): ActionGroup[] {
  const reports = ctx.stats.flatMap(s => s.reports), issues = ctx.stats.flatMap(s => s.issues);
  const a = officeActions(reports, issues, ctx.day);
  // "Every report has been read" with none received reads as if some had been.
  const anyReports = reports.length > 0, anyOpen = issues.some(isActive);
  const project = (id: string) => ctx.statOf(id)?.project.projectName ?? id;
  const closureMine = (i: Issue) => i.closureSubmittedById ? i.closureSubmittedById === ctx.me.id : i.closureSubmittedBy === ctx.me.name;
  const reportRow = (r: ReportSummary, action?: ReactNode) => <div key={r.id}><a className="rt" href={`#/projects/${r.projectId}/report/${r.id}`}><b>{project(r.projectId)} · {r.author}</b><span>{shortRef(r.reference)} · received {fmtWhen(r.serverAcknowledgedAt)}</span></a>{action}</div>;
  const issueRow = (i: Issue, sub: string, action?: ReactNode) => <div key={i.id}><a className="rt" href={`#/projects/${i.projectId}/issue/${i.id}`}><b>{i.description}</b><span>{project(i.projectId)} · {sub}</span></a>{action}</div>;
  return [
    { key: 'new', title: 'New reports', sub: `Received ${sinceWords(a.since, ctx.day)}`, n: a.newReports.length, tone: '', all: '#/inbox/show/new', empty: `No reports received ${sinceWords(a.since, ctx.day)}.`,
      rows: a.newReports.slice(0, 4).map(r => reportRow(r, r.acknowledged ? <Tag label="Read" cls="tag-ok" /> : <DeliveryTag r={r} />)) },
    { key: 'notAck', title: 'Not yet read', sub: 'Received, nobody has acknowledged it', n: a.notRead.length, tone: 'soon', all: '#/inbox/show/notAck', empty: anyReports ? 'Every report has been read.' : 'No reports received yet.',
      rows: a.notRead.slice(0, 4).map(r => reportRow(r, <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'acknowledge', report: r })}>Acknowledge</BtnQ>)) },
    { key: 'unassigned', title: 'Unassigned issues', sub: 'Open, nobody owns the action', n: a.unassigned.length, tone: 'soon', all: '#/issues/show/unassigned', empty: anyOpen ? 'Every open issue has an owner.' : 'No open issues.',
      rows: a.unassigned.slice(0, 4).map(i => issueRow(i, `${i.location || 'no location'} · raised ${fmtDay(i.raisedAt)}`, i.work === 'awaiting_verification' ? <span className="rowsub">Verify first</span> : <Btn className="btn-sm" onClick={() => ctx.setDialog(dialogFor('assign', i, ctx))}>Assign</Btn>)) },
    { key: 'verify', title: 'Fixed, to check', sub: 'Put forward as fixed; someone else checks it', n: a.verify.length, tone: 'soon', all: '#/issues/show/verify', empty: 'Nothing waiting to be checked.',
      rows: a.verify.slice(0, 4).map(i => issueRow(i, `closure by ${i.closureSubmittedBy ?? 'unknown'} · waiting ${daysSince(i.events.at(-1)?.at)} days`, closureMine(i) ? <span className="rowsub">You submitted it</span> : <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue: i })}>Verify</Btn>)) },
  ];
}
/** On a phone the groups stack under the project list, so their counts are gathered at the top, each a tap from its group. */
function ActionStrip({ groups }: { groups: ActionGroup[] }) {
  const jump = (key: string) => {
    const el = document.querySelector<HTMLElement>(`.act[data-group="${key}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.focus({ preventScroll: true });
  };
  return <div className="act-strip" role="group" aria-label="What needs you">{groups.map(g => <button type="button" key={g.key} data-group={g.key} onClick={() => jump(g.key)}><b className={g.n ? g.tone : ''}>{g.n}</b><span>{g.title}</span></button>)}</div>;
}
function ActionGroups({ groups }: { groups: ActionGroup[] }) {
  return <div className="acts">{groups.map(g => <section key={g.key} className="act" data-group={g.key} tabIndex={-1} aria-label={`${g.title}: ${g.n}`}>
    <div className="act-h"><h4>{g.title}</h4><b className={`act-n ${g.n ? g.tone : ''}`}>{g.n}</b></div>
    <div className="act-sub">{g.sub}</div>
    <div className="rmenu">{g.rows.length ? g.rows : <div className="empty">{g.empty}</div>}</div>
    {g.n > 0 && <a className="act-all" href={g.all}>{g.n > g.rows.length ? `Show all ${g.n}` : 'Open the list'} →</a>}
  </section>)}</div>;
}

function LatestReports({ ctx, reports }: { ctx: Ctx; reports: ReportSummary[] }) {
  return <table className="reg tight"><thead><tr><th>Ref</th><th>Engineer</th><th>Received</th><th>Found</th><th>Status</th></tr></thead><tbody>
    {reports.length ? reports.map(r => <tr key={r.id} className="clickable" onClick={() => ctx.go(`#/projects/${r.projectId}/report/${r.id}`)}><td><span className="ref">{shortRef(r.reference)}</span></td><td>{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due">{r.serverAcknowledgedAt ? fmtWhen(r.serverAcknowledgedAt) : '—'}</td><td><Found r={r} /></td><td>{r.review === 'pending' ? <Tag label="To review" cls="tag-caution" /> : r.review === 'returned' ? <Tag label="Returned" cls="tag-alert" /> : r.acknowledged ? <Tag label="Read" cls="tag-ok" /> : <DeliveryTag r={r} />}</td></tr>) : <tr><td colSpan={5} className="empty">No reports received yet.</td></tr>}
  </tbody></table>;
}

/**
 * The project's own pages: its reports and records first, then issues. The
 * safety, permits and deliveries pages only while the office has them on
 * (lib/featureSwitch.ts).
 */
const PROJECT_LINKS: { title: string; links: [string, string][]; safetyRecords?: true }[] = [
  { title: 'Reports and records', links: [['/weekly-summary', 'Weekly summary'], ['/diary', 'Site diary'], ['/photos', 'Photographs'], ['/site-notes', 'Notes for the next visit']] },
  { title: 'Issues', links: [['/issue-trend', 'Issues over time'], ['/handover', 'Before handover']] },
  { title: 'Safety, permits and deliveries', safetyRecords: true, links: [['/safety-actions', 'Safety actions'], ['/toolbox-talks', 'Toolbox talks'], ['/permits', 'Permits to work'], ['/deliveries', 'Deliveries']] },
];
function ProjectLinks({ ctx, projectId, heading: H = 'h4', projectPage }: { ctx: Ctx; projectId: string; heading?: 'h3' | 'h4'; projectPage?: boolean }) {
  const { safetyRecords } = useFeatures();
  return <nav className="sheet-links" aria-label="On this project">
    {PROJECT_LINKS.filter(g => safetyRecords || !g.safetyRecords).map((g, n) => <div key={g.title} className="sheet-links-group"><H>{g.title}</H><div>{g.links.map(([path, label]) => <Link key={path} className="btn btn-q btn-sm" href={`${path}?${new URLSearchParams({ project: projectId, returnTo: officeReturn(ctx) })}`}>{label}</Link>)}
      {/* The sheet's title has "Project page"; on a phone, where the sheet is not shown, it goes with the records. */}
      {projectPage && n === 0 && <Link className="btn btn-q btn-sm" href={withViewReturn(`/projects/${projectId}`, officeReturn(ctx))}>Project page</Link>}</div></div>)}
  </nav>;
}

function ProjectSheet({ ctx, s }: { ctx: Ctx; s: ProjectStats }) {
  const p = s.project;
  // A phone hides the sheet behind the register, which shows Latest from site itself.
  const phone = usePhone();
  const month = Date.now() - 30 * 86400000;
  const engineers = [...new Set(s.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > month).map(r => r.author))];
  const v = lastVisitWords(s.standing, ctx.day);
  // Where it stands, then what site said, then what needs the office; the project's other pages and its details after them.
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href="#/projects">Projects</a><span>›</span>Project</div><h3>{p.projectName}</h3><div className="rowsub"><span className="ref">{p.projectNumber}</span><span className="sep">/</span>{p.clientName}<span className="sep">/</span>{p.division}<span className="sep">/</span>{p.status}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={withViewReturn(`/projects/${p.id}`, officeReturn(ctx))}>Project page</Link></div></div>
    <dl className="tb"><div><dt>Last visit</dt><dd className={`big ${v.quiet ? 'late' : ''}`}>{v.when}<small>{v.quiet ? `${v.quiet} · ` : ''}{v.who} · {count(s.standing.thisWeek, 'visit')} this week</small></dd></div><div><dt>Overdue actions</dt><dd className={`big ${s.overdue.length ? 'late' : ''}`}>{s.overdue.length}<small>{s.overdue.length ? `oldest ${Math.max(...s.overdue.map(i => daysLate(i.targetDate, ctx.day)))} days past target` : 'nothing past its target'} · {s.active.length} open</small></dd></div><div><dt>Fixed, to check</dt><dd className={`big ${s.verify.length ? 'soon' : ''}`}>{s.verify.length}<small>{s.verify.length ? `put forward ${fmtDay(s.verify[0]!.events.at(-1)?.at)}` : 'nothing waiting to be checked'}</small></dd></div><div><dt>Variations</dt><dd className={`big ${s.exposedVariations.length ? 'late' : s.pendingVariations.length ? 'soon' : ''}`}>{s.pendingVariations.length}<small>{s.pendingVariations.length ? `awaiting instruction${s.unpricedVariations.length ? ` · ${s.unpricedVariations.length} to price` : ''}` : 'none awaiting instruction'}{s.instructedValue ? ` · ${fmtMoney(s.instructedValue)} instructed` : ''}</small></dd></div></dl>
    <div style={{ marginTop: 12 }}><Bar c={s.rollup} /><Meta c={s.rollup} /></div>
    {!phone && <LatestFromSite ctx={ctx} s={s} />}
    <SecH>Needs attention</SecH>
    <AttentionList ctx={ctx} s={s} limit={6} />
    <SecH right={<span className="r">{s.reports.length} on file</span>}>Latest reports</SecH>
    <LatestReports ctx={ctx} reports={s.reports.slice(0, 5)} />
    {s.drafts.length > 0 && <p className="rowsub" style={{ marginTop: 12 }}>{s.drafts.length} draft{s.drafts.length === 1 ? '' : 's'} in progress on site. Contents stay private until sent.</p>}
    <ProjectLinks ctx={ctx} projectId={p.id} />
    <dl className="tb" style={{ marginTop: 12 }}><div><dt>Project manager</dt><dd>{p.projectManager}<small>{p.projectManagerEmail}</small></dd></div><div><dt>Client account</dt><dd className="num">{p.clientAccountNumber}</dd></div><div><dt>Review</dt><dd>{p.reviewRequired ? 'Required' : 'Not required'}<small>{p.reviewRequired ? 'reports wait for a decision' : 'reports issue on submission'}</small></dd></div><div><dt>Engineers · 30 days</dt><dd>{engineers.length}<small>{engineers.join(', ') || 'no reports in the last month'}</small></dd></div></dl>
  </div>;
}

/** How many progress lines each trade shows before "and N more in the report"; a phone's register shows two. */
const LINES_SHOWN = 4;
/**
 * What site last said about progress, trade by trade: each trade's newest
 * site update in the last fortnight, its progress and access cards in the
 * order written. Defects and variations are in the registers, so they are
 * counted here, not repeated. Reads the reports the register lists.
 */
function LatestFromSite({ ctx, s, shown = LINES_SHOWN }: { ctx: Ctx; s: ProjectStats; shown?: number }) {
  const latest = s.standing.latest;
  const ids = latest.map(r => r.id).join(',');
  const [loaded, setLoaded] = useState<{ ids: string; reports: Map<string, Report> } | null>(null);
  const [failed, setFailed] = useState('');
  // A load that failed is tried again with the desk's next refresh.
  const retry = failed === ids ? ctx.snap?.loadedAt : '';
  useEffect(() => {
    if (!ids) return;
    let stopped = false; setFailed('');
    Promise.all(ids.split(',').map(id => getReport(id)))
      .then(rs => { if (!stopped) setLoaded({ ids, reports: new Map(rs.filter((r): r is Report => !!r).map(r => [r.id, r])) }); })
      .catch(() => { if (!stopped) setFailed(ids); });
    return () => { stopped = true; };
  }, [ids, retry]);
  const body = !latest.length ? <div className="empty" style={{ padding: 14 }}>No site update in the last {LATEST_DAYS} days.</div>
    : failed === ids ? <div className="empty" style={{ padding: 14 }}>The latest reports could not be loaded just now. RELAY will try again; each one also opens from the project’s reports.</div>
    : loaded?.ids !== ids ? <div className="loading" style={{ minHeight: 80 }}>Loading what site said</div>
    : <div className="from-site">{latest.map(r => {
      const full = loaded.reports.get(r.id); const lines = full ? progressLines(full) : [];
      const others = foundOthers(r);
      return <article key={r.id} className="from-site-visit">
        <a className="from-site-h" href={`#/projects/${s.code}/report/${r.id}`}><b>{r.authorTrade ?? 'Trade not recorded'}</b><span>{r.author} · {visitDay(r.visitDate, ctx.day)} · <span className="ref">{shortRef(r.reference)}</span></span><span className="arrow" aria-hidden="true">›</span></a>
        {lines.length ? <ul>{lines.slice(0, shown).map(l => <li key={l.id}>{l.kind === 'access' && <span className="kind tone-access">Access</span>}<b>{l.location || 'No location'}</b>{l.text ? ` — ${l.text}` : ''}</li>)}</ul>
          : <p className="rowsub">{full ? 'No progress written on this visit.' : 'This report could not be opened here.'}</p>}
        {(lines.length > shown || others) && <p className="rowsub">{lines.length > shown ? `And ${lines.length - shown} more in the report.` : ''}{lines.length > shown && others ? ' ' : ''}{others ? `Also raised ${others}.` : ''}</p>}
      </article>;
    })}</div>;
  return <section aria-labelledby={`from-site-${s.code}`}>
    <SecH right={<span className="r">each trade’s newest update</span>}><span id={`from-site-${s.code}`}>Latest from site</span></SecH>
    {body}
  </section>;
}
/** "2 defects and 1 variation", or '' when the visit raised neither. */
function foundOthers(r: ReportSummary): string {
  const k = r.kindCounts; if (!k) return r.defectCount ? count(r.defectCount, 'defect') : '';
  const parts = [k.defect ? count(k.defect, 'defect') : '', k.instruction ? count(k.instruction, 'variation') : ''].filter(Boolean);
  return parts.join(' and ');
}

/* ---------------------------------------------------------------- reader */
export function ReportReader({ ctx, id, crumbsHome }: { ctx: Ctx; id: string; crumbsHome?: string }) {
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
  if (error && loadedId !== id) return <div className="sheet"><div className="empty">{error}</div></div>;
  if (!report || loadedId !== id) return <div className="sheet"><div className="loading" style={{ minHeight: 160 }}>Loading report</div></div>;
  const project = ctx.projects.find(p => p.id === report.projectId);
  const code = project?.id ?? '';
  const summary = ctx.snap?.reports.find(r => r.id === report.id);
  const superseded = ctx.snap?.reports.find(r => r.corrects === report.id);
  const raised = ctx.snap?.issues.filter(i => i.raisedByReport === report.id) ?? [];
  const variationOf = (observationId: string) => ctx.snap?.variations.find(v => v.raisedByObservation === observationId);
  const decisions = report.observations.filter(o => o.type === 'instruction' || o.actionNeeded.trim());
  const canReview = report.review === 'pending' && report.authorId !== ctx.me.id;
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
    <div className="sheet-title"><div><div className="crumbs"><a href={crumbsHome ?? `#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>{reportTypeOf(report).document}</div><h3>Visit {fmtDate(report.visitDate)}</h3>{report.inspected && reportTypeOf(report).inspects && <div className="rowsub sheet-inspected">{reportTypeOf(report).inspects!.label}: <b>{report.inspected}</b></div>}<div className="rowsub"><span className="ref">{report.reference}</span><span className="sep">/</span>{report.author}{report.authorTrade ? ` · ${report.authorTrade}` : ''}<span className="sep">/</span>Rev {report.revision}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={withViewReturn(`/reports/${report.id}/preview`, officeReturn(ctx))}>Full report</Link><Link className="btn btn-q btn-sm" href={withViewReturn(`/reports/${report.id}/pdf`, officeReturn(ctx))}>PDF</Link>
        {canReview ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'review', report: summary })}>Review</Btn>
          : !report.acknowledged ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'acknowledge', report: summary })}>Acknowledge</Btn> : null}
        {ctx.me.admin && report.sharepoint?.status === 'failed' && <Btn className="btn-sm" disabled={retryingSharePoint} onClick={() => void retrySharePoint()}>{retryingSharePoint ? 'Queuing…' : 'Retry SharePoint'}</Btn>}</div></div>
    <SubmissionStages report={report} tagClass={t => `tag ${toneTag(t)}`} when={fmtWhen} />
    {sharePointRetry && <div className="note"><span>{sharePointRetry}</span></div>}
    {report.review === 'returned' && <div className="note bad"><span><b>Sent back by {report.reviewedBy ?? 'the office'}</b>{report.reviewedAt ? ` on ${fmtDay(report.reviewedAt)}` : ''}: {report.reviewNote} {superseded ? '' : 'The engineer can send a corrected revision.'}</span></div>}
    {superseded && <div className="note info"><span><b>Superseded by rev {superseded.revision}</b>{superseded.state === 'draft' ? ', a correction in progress on site.' : '.'} </span>{superseded.state === 'submitted' && <a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${superseded.id}`}>Open rev {superseded.revision}</a>}</div>}
    {report.corrects && <div className="note info"><span><b>Rev {report.revision} supersedes rev {report.revision - 1}.</b> {report.correctionReason}</span><a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${report.corrects}`}>Open rev {report.revision - 1}</a></div>}
    {report.review === 'pending' && !canReview && <div className="note warn"><span><b>Awaiting review.</b> You wrote this report, so someone else has to review it.</span></div>}
    {report.delivery === 'failed' && <div className="note bad"><span><b>{report.deliveryErrorStage === 'delivery' ? 'Could not be delivered.' : 'Could not be processed.'}</b> {report.deliveryError ?? 'The worker gave up on this report.'} The report is on file; {report.deliveryErrorStage === 'delivery' ? 'the notification is what failed.' : report.deliveryErrorStage === 'pdf' ? 'making the PDF is what failed.' : 'the PDF and the notification are what failed.'}</span></div>}
    {(report.delivery === 'outbox' || report.issued?.transport === 'outbox') && <div className="note"><span>{project?.projectManager ?? 'The project manager'} has not been notified by email yet: the pilot holds notification emails in a local outbox. The report is on file and readable here.</span></div>}
    {decisions.length > 0 && <><SecH>Actions and decisions</SecH>
      <div className="rmenu">{decisions.map(o => { const vo = o.type === 'instruction' ? variationOf(o.id) : undefined; return <div key={o.id}><div className="rt"><b>{o.type === 'instruction' ? 'Variation to instruct' : `Action for ${o.owner.trim() || 'nobody yet'}`} · {o.check ? `${o.check.question}${o.location.trim() ? ` · ${o.location}` : ''}` : o.location || 'no location'}</b><span>{o.type === 'instruction' ? o.whatHappened : o.actionNeeded}{o.type !== 'instruction' && !o.owner.trim() && ' · no owner named'}</span></div>{o.type === 'instruction' ? (vo ? <><a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a><InstructionTag v={vo} /></> : <span className="kind tone-variation">Variation</span>) : o.check && !reportTypeOf(report).raisesRecords ? <span className="kind tone-defect">On this inspection</span> : raisedRef(o.id, raised, code, o.linkedIssueId ? ctx.snap?.issues.find(i => i.id === o.linkedIssueId) : undefined)}</div>; })}</div></>}
    {reportTypeOf(report).checklist
      ? <SecH right={<span className="r">{report.observations.length} checks</span>}>Inspection results</SecH>
      : <SecH right={<span className="r">{report.observations.length} update{report.observations.length === 1 ? '' : 's'}</span>}>Found on this visit</SecH>}
    {report.observations.length ? report.observations.map(o => {
      const type = OBSERVATION_TYPES.find(t => t.value === o.type);
      // A check moved off Action needed in a correction keeps its link, but no longer speaks for the issue.
      const linked = o.linkedIssueId && (!o.check || o.check.answer === 'action') ? ctx.snap?.issues.find(i => i.id === o.linkedIssueId) : undefined;
      const mine = raised.find(i => i.raisedByObservation === o.id);
      const vo = o.type === 'instruction' ? variationOf(o.id) : undefined;
      return <div key={o.id} className="hist"><span className="d">{o.check ? <span className={`kind ${o.check.answer === 'action' ? 'tone-defect' : 'tone-neutral'}`}>{answerLabel(o.check.answer)}</span> : <span className={`kind tone-${type?.tone ?? 'neutral'}`}>{type?.label.split(' ')[0] ?? o.type}</span>}</span>
        <div className="b"><p><b>{o.check ? `${o.check.question}${o.location.trim() ? ` · ${o.location}` : ''}` : o.location || 'Location not recorded'}</b>{o.whatHappened.trim() ? ` — ${o.whatHappened}` : ''}</p>
          <div className="rowsub">{o.actionNeeded && <>Action: {o.actionNeeded} · </>}{o.owner && <>Owner: {o.owner} · </>}{o.affectedTrade && <>Trade: {o.affectedTrade} · </>}{o.variationReason && <>{o.variationReason} · </>}{o.workDone && <><span className="late">already carried out</span> · </>}{o.askedBy && <>asked for by {o.askedBy} · </>}{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}
            {linked && <> · further sighting of <a className="ref" href={`#/projects/${code}/issue/${linked.id}`}>{shortRef(linked.reference)}</a></>}
            {mine && <> · raised <a className="ref" href={`#/projects/${code}/issue/${mine.id}`}>{shortRef(mine.reference)}</a> · <ConfirmTag i={mine} reviewOn={!!ctx.statOf(mine.projectId)?.reviewOn} /></>}
            {vo && <> · raised <a className="ref" href={`#/projects/${code}/variation/${vo.id}`}>{shortRef(vo.reference)}</a> · <InstructionTag v={vo} /></>}</div>
          {o.photos.length > 0 && <div className="photos">{o.photos.map(ph => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || 'Site photograph'} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}
        </div></div>;
    }) : <div className="empty">No updates were recorded on this visit.</div>}
    <SecH>Signature</SecH>
    {/* Typed or drawn is said in words, so the office never mistakes one for the other. */}
    <div className="rowsub">{report.signature ? `${SIGNED_HOW[signatureMethod(report.signature)]} ${report.signature.name} · ${fmtWhen(report.signature.signedAt)}${report.signature.typed && report.signature.signedInAs ? ` · signed in as ${report.signature.signedInAs}` : ''}` : 'No signature captured'} · Generated by Leodis Relay</div>
    {report.signature?.typed && report.signature.statement && <div className="rowsub">They ticked: “{report.signature.statement}”</div>}
  </div>;
}
const SIGNED_HOW = { drawn: 'Signature drawn by', typed: 'Signed by typing the name', 'name only': 'Signed' } as const;
function raisedRef(observationId: string, raised: Issue[], code: string, linked?: Issue) {
  // A correction raises nothing new: its updates point at the issue the original raised.
  const i = raised.find(x => x.raisedByObservation === observationId) ?? linked;
  return i ? <a className="ref" href={`#/projects/${code}/issue/${i.id}`}>{shortRef(i.reference)}</a> : <span className="rowsub">no issue</span>;
}

/* ----------------------------------------------------------------- issue */
const EVENT_LABEL: Record<string, string> = { raised: 'Raised', progress: 'Update', closure_submitted: 'Closure submitted', verified: 'Verified closed', reopened: 'Reopened', confirmation: 'Confirmation', assigned: 'Assigned' };
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
  const active = isActive(issue); const overdue = isOverdue(issue, ctx.day); const reviewOn = !!ctx.statOf(issue.projectId)?.reviewOn;
  const closureMine = issue.closureSubmittedById ? issue.closureSubmittedById === ctx.me.id : issue.closureSubmittedBy === ctx.me.name;
  const d = (kind: string) => ctx.setDialog(dialogFor(kind, issue, ctx));
  const linkedVariations = ctx.snap?.variations.filter(v => v.linkedIssueId === issue.id) ?? [];
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Issue</div><h3>{issue.description}</h3><div className="rowsub"><span className="ref">{issue.reference}</span><span className="sep">/</span>{issue.location || 'Location not recorded'}<span className="sep">/</span>{issue.affectedTrade ?? (issue.reporterTrade ? `reported by ${issue.reporterTrade}` : 'trade not recorded')}</div></div>
      <div className="actions">
        <Link className="btn btn-q btn-sm" href={withViewReturn(`/issues/${issue.id}`, officeReturn(ctx))}>Issue page</Link>
        {active && issue.work !== 'awaiting_verification' && (issue.owner ? <BtnQ className="btn-sm" onClick={() => d('assign')}>Reassign</BtnQ> : <Btn className="btn-sm" onClick={() => d('assign')}>Assign</Btn>)}
        {active && issue.work === 'awaiting_verification' && !closureMine && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'verify', issue })}>Verify</Btn>}
        {active && issue.work === 'awaiting_verification' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue })}>Not finished</BtnQ>}
        {issue.work === 'closed' && issue.confirmation !== 'withdrawn' && <BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'reopen', issue })}>Reopen</BtnQ>}
        {active && issue.confirmation === 'disputed' && <Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'triage', issue })}>Triage</Btn>}
        {active && issue.confirmation === 'provisional' && <><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'confirm', issue })}>Confirm</BtnQ><BtnQ className="btn-sm" onClick={() => ctx.setDialog({ kind: 'withdraw', issue })}>Withdraw</BtnQ></>}
      </div></div>
    <dl className="tb"><div><dt>Work</dt><dd><WorkTag i={issue} day={ctx.day} /><small>{WORK_LABEL[issue.work]}{overdue ? ` · ${daysLate(issue.targetDate, ctx.day)} days past target` : ''}</small></dd></div><div><dt>Confirmation</dt><dd><ConfirmTag i={issue} reviewOn={reviewOn} /><small>{confirmationNote(issue.confirmation, reviewOn)}</small></dd></div><div><dt>Owner</dt><dd>{issue.owner.trim() || <span className="late">Unassigned</span>}</dd></div><div><dt>Target</dt><dd className={`num ${overdue ? 'late' : ''}`}>{issue.targetDate || '—'}</dd></div></dl>
    {issue.actionNeeded && <div className="note info"><span><b>Action needed.</b> {issue.actionNeeded}</span></div>}
    {issue.confirmation === 'disputed' && <div className="note bad"><span><b>Disputed.</b> The report that raised this was sent back. Any work already done stands; the observation needs a decision.</span></div>}
    {issue.work === 'awaiting_verification' && <div className={`note ${closureMine ? 'warn' : 'good'}`}><span><b>Closure submitted by {issue.closureSubmittedBy ?? 'unknown'}</b> · waiting {daysSince(issue.events.at(-1)?.at)} days. {closureMine ? 'You submitted this closure, so someone else has to verify it.' : 'Verify it if the work is done, or send it back as not finished.'}</span></div>}
    {linkedVariations.length > 0 && <div className="note info"><span><b>Variation{linkedVariations.length === 1 ? '' : 's'} on this issue:</b> {linkedVariations.map((v, i) => <span key={v.id}>{i > 0 && ', '}<a className="ref" href={`#/projects/${code}/variation/${v.id}`}>{shortRef(v.reference)}</a> {INSTRUCTION_LABEL[v.instruction].toLowerCase()}</span>)}.</span></div>}
    <dl className="tb two" style={{ marginTop: 12 }}><div><dt>Source</dt><dd>{source ? <>Raised by <a className="ref" href={`#/projects/${code}/report/${source.id}`}>{shortRef(source.reference)}</a> · {fmtDay(issue.raisedAt)}</> : issue.source === 'individual' ? <>Flagged on site by {issue.reportedBy ?? 'unknown'} · {fmtDay(issue.raisedAt)}</> : <>Raised {fmtDay(issue.raisedAt)}</>}<small>{issue.reportedBy ?? issue.events[0]?.actor ?? 'Reporter not recorded'}{issue.reporterTrade ? ` · ${issue.reporterTrade}` : ''}</small></dd></div><div><dt>Progress notes</dt><dd>Add updates and photographs on the issue page.<small>Engineers can submit the work as complete there; the office verifies here.</small></dd></div></dl>
    <SecH right={<span className="r">{issue.events.length}</span>}>History</SecH>
    {issue.events.slice().reverse().map((e, i) => <div key={i} className="hist"><span className="d">{fmtDay(e.at)}<div className="rowsub">{EVENT_LABEL[e.kind] ?? e.kind}</div></span><div className="b">{e.kind === 'assigned' && e.to && <p>To {e.to}{e.targetDate ? `, by ${fmtDay(e.targetDate)}` : ''}</p>}{(e.note || !(e.kind === 'assigned' && e.to)) && <p>{e.note || <span className="fine">No note</span>}</p>}<div className="rowsub">{e.actor}</div>{e.photos.length > 0 && <div className="photos">{e.photos.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}</div></div>)}
  </div>;
}

/* ------------------------------------------------------------- variation */
const VARIATION_EVENT: Record<string, string> = { raised: 'Raised', details: 'Details', priced: 'Priced', instructed: 'Instructed', declined: 'Declined', reopened: 'Reopened', note: 'Note' };
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
  const project = ctx.projects.find(p => p.id === v.projectId); const code = project?.id ?? '';
  const source = v.raisedByReport ? ctx.snap?.reports.find(r => r.id === v.raisedByReport) : undefined;
  const linked = v.linkedIssueId ? ctx.snap?.issues.find(i => i.id === v.linkedIssueId) : undefined;
  const cost = expectedCost(v), value = variationValue(v), margin = estimatedMargin(v), pct = marginPct(v);
  const evidence = v.events.find(e => e.kind === 'raised')?.photos ?? [];
  const d = (kind: 'variation-price' | 'variation-instruct' | 'variation-decline' | 'variation-reopen' | 'variation-details') => ctx.setDialog({ kind, variation: v });
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Variation</div><h3>{v.description}</h3><div className="rowsub"><span className="ref">{v.reference}</span><span className="sep">/</span>{v.location || 'Location not recorded'}<span className="sep">/</span>{v.trade ?? 'trade not set'}<span className="sep">/</span>{v.reason ?? 'reason not set'}</div></div>
      <div className="actions">
        <BtnQ className="btn-sm" onClick={() => d('variation-details')}>Edit details</BtnQ>
        {v.instruction === 'pending' && (v.quotedValue === undefined ? <Btn className="btn-sm" onClick={() => d('variation-price')}>Price</Btn> : <BtnQ className="btn-sm" onClick={() => d('variation-price')}>Reprice</BtnQ>)}
        {v.instruction === 'pending' && (v.quotedValue === undefined ? <BtnQ className="btn-sm" onClick={() => d('variation-instruct')}>Instruct</BtnQ> : <Btn className="btn-sm" onClick={() => d('variation-instruct')}>Instruct</Btn>)}
        {v.instruction === 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-decline')}>Decline</BtnQ>}
        {v.instruction !== 'pending' && <BtnQ className="btn-sm" onClick={() => d('variation-reopen')}>Reopen</BtnQ>}
      </div></div>
    <dl className="tb"><div><dt>Instruction</dt><dd><InstructionTag v={v} /><small>{v.instruction === 'instructed' ? `${v.instructionReference} · ${v.instructedBy} · ${v.instructedOn}` : v.instruction === 'declined' ? 'the client will not instruct it' : v.quotedValue === undefined ? 'price it before it can be put to the client' : 'quoted, waiting on the client'}</small></dd></div><div><dt>Quoted</dt><dd><Money n={v.quotedValue} /><small>{cost !== undefined ? `expected cost ${fmtMoney(cost)}` : 'not costed'}</small></dd></div><div><dt>Instructed value</dt><dd><Money n={v.instruction === 'instructed' ? value : undefined} /><small>{v.instruction === 'instructed' ? (v.instructedValue === undefined ? 'on rates; quote carried' : v.instructedValue === v.quotedValue ? 'as quoted' : `quoted ${fmtMoney(v.quotedValue)}`) : 'fixed once instructed'}</small></dd></div><div><dt>Estimated margin</dt><dd className={margin !== undefined && margin < 0 ? 'late' : ''}><Money n={v.instruction === 'declined' ? undefined : margin} /><small>{pct !== undefined && v.instruction !== 'declined' ? `${fmtPct(pct)} of ${v.instruction === 'instructed' ? 'the instructed value' : 'the quote'}` : 'needs a cost and a value'}</small></dd></div></dl>
    {v.workDone && v.instruction === 'pending' && <div className="note bad"><span><b>Work already carried out with nothing in writing.</b> Get the client’s sign-off recorded as a chargeable variation before it is invoiced; a signature that only confirms attendance is not an instruction. See the variation sign-off note in the docs.</span></div>}
    {v.instruction === 'pending' && v.quotedValue === undefined && !v.workDone && <div className="note warn"><span><b>Not yet priced.</b> Labour, parts, plant and an uplift give the expected cost and a suggested quote; the quoted value is the office’s call.</span></div>}
    {v.instruction === 'instructed' && v.signedInstruction && <div className="note good"><span><b>Signed copy on file.</b></span>{signedCopyLink(v) && <a className="btn btn-q btn-sm" href={signedCopyLink(v)} target="_blank" rel="noreferrer">Open signed copy ↗</a>}</div>}
    {v.instruction === 'instructed' && !v.signedInstruction && <div className="note warn"><span><b>No signed copy linked.</b> The instruction is recorded as {v.instructionReference}; add the link to the signed document when it is filed.</span></div>}
    <dl className="tb two" style={{ marginTop: 12 }}>
      <div><dt>Source</dt><dd>{source ? <>Raised by <a className="ref" href={`#/projects/${code}/report/${source.id}`}>{shortRef(source.reference)}</a> · {fmtDay(v.raisedAt)}</> : <>Raised {fmtDay(v.raisedAt)}</>}<small>{v.raisedBy}{v.raiserTrade ? ` · ${v.raiserTrade}` : ''}{v.askedBy && <> · asked for on site by {v.askedBy}</>}{linked && <> · on issue <a className="ref" href={`#/projects/${code}/issue/${linked.id}`}>{shortRef(linked.reference)}</a></>}</small></dd></div>
      <div><dt>Expected cost</dt><dd>{cost === undefined ? <span className="fine">Not costed</span> : <span className="money">{fmtMoney(cost)}</span>}<small>{cost === undefined ? 'labour × rate + parts + plant' : `${fmtHours(v.labourHours)} × ${fmtMoney(v.labourRate)} labour · ${fmtMoney(v.partsCost)} parts · ${fmtMoney(v.plantSubcontract)} plant${v.upliftPct !== undefined ? ` · ${v.upliftPct}% uplift` : ''}`}</small></dd></div>
    </dl>
    {evidence.length > 0 && <><SecH right={<span className="r">{evidence.length}</span>}>Evidence from the visit</SecH><div className="photos">{evidence.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div></>}
    <SecH right={<span className="r">{v.events.length}</span>}>History</SecH>
    {v.events.slice().reverse().map((e, i) => <div key={i} className="hist"><span className="d">{fmtDay(e.at)}<div className="rowsub">{VARIATION_EVENT[e.kind] ?? e.kind}</div></span><div className="b"><p>{e.note || <span className="fine">No note</span>}</p><div className="rowsub">{e.actor}</div>{e.photos.length > 0 && e.kind !== 'raised' && <div className="photos">{e.photos.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}</div></div>)}
  </div>;
}
