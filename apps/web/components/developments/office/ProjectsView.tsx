'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PhotoImage } from '@/components/PhotoImage';
import { getReport } from '@/lib/api';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { acknowledgementStatus, deliveryStatus, reviewStatus } from '@/lib/status';
import type { Issue, Report, ReportSummary } from '@/lib/types';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Bar, BarKey, Btn, BtnQ, ConfirmTag, DeliveryTag, Found, Meta, ReviewTag, SecH, Tag, WorkTag } from './bits';
import { CONFIRM_LABEL, WORK_LABEL, daysLate, daysSince, fmtDate, fmtDay, fmtWhen, isActive, isOverdue, shortRef, toneTag, type ProjectStats } from './model';

/* --------------------------------------------------------------- columns */
export function ProjectsView({ ctx }: { ctx: Ctx }) {
  const s = ctx.route.a ? ctx.statOf(ctx.route.a) : undefined;
  const kind = s && (ctx.route.b === 'report' || ctx.route.b === 'issue') ? ctx.route.b : null;
  const id = kind ? ctx.route.c : null;
  const depth = !s ? 1 : !kind ? 2 : 3;
  return <div className="cols" data-depth={depth}>
    <ProjectsCol ctx={ctx} current={s} />
    <RegisterCol ctx={ctx} s={s} kind={kind} id={id} />
    <div className="col">
      <div className="col-head">{s && <a className="col-back" href={kind ? `#/projects/${s.code}` : '#/projects'}>‹ {kind ? 'Register' : 'Projects'}</a>}<h4>Details</h4><i>{s ? s.code : 'Office'}</i></div>
      <div className="colpad">
        {!ctx.snap ? <div className="loading">Loading office records</div>
          : kind === 'report' && id ? <ReportReader ctx={ctx} id={id} />
          : kind === 'issue' && id ? <IssueSheet ctx={ctx} id={id} />
          : s ? <ProjectSheet ctx={ctx} s={s} /> : <OfficeSheet ctx={ctx} />}
      </div>
    </div>
  </div>;
}

function ProjectsCol({ ctx, current }: { ctx: Ctx; current?: ProjectStats }) {
  return <div className="col">
    <div className="col-head"><h4>Projects</h4><i>{ctx.projects.length} reportable</i></div>
    {ctx.projects.map(p => {
      const s = ctx.statOf(p.projectNumber);
      return <a key={p.id} className={`item ${current?.code === p.projectNumber ? 'on' : ''}`} href={`#/projects/${p.projectNumber}`}>
        <div className="item-top"><div className="rowtitle">{p.projectName}</div><span className="arrow">›</span></div>
        <div className="rowsub"><span className="ref">{p.projectNumber}</span> · {p.projectManager} · {p.division.replace('Leodis ', '')}{p.status === '5. Defects Liability' ? ' · Defects liability' : ''}</div>
        {s ? <><Bar c={s.rollup} /><Meta c={s.rollup} /></> : <div className="cbar" style={{ marginTop: 8 }} />}
      </a>;
    })}
    <div className="colpad sticky-foot"><BarKey /><div className="rowsub">Tenders and completed jobs are not listed.</div></div>
  </div>;
}

type Filter = 'action' | 'reports' | 'issues' | 'drafts';
function RegisterCol({ ctx, s, kind, id }: { ctx: Ctx; s?: ProjectStats; kind: string | null; id: string | null }) {
  const [filter, setFilter] = useState<Filter>('action');
  useEffect(() => { setFilter('action'); }, [s?.code]);
  if (!s) return <div className="col"><div className="col-head"><h4>Register</h4></div><div className="empty">Select a project to see its reports and issues.</div></div>;
  const day = ctx.day;
  const reportRow = (r: ReportSummary) => <a key={r.id} className={`arow ${kind === 'report' && id === r.id ? 'on' : ''}`} href={`#/projects/${s.code}/report/${r.id}`}>
    <span className="ref">{shortRef(r.reference)}{r.revision > 1 ? ` r${r.revision}` : ''}</span>
    <span className="nm">{r.author}{r.authorTrade ? ` · ${r.authorTrade}` : ''}<small>{fmtWhen(r.serverAcknowledgedAt)} · {foundWords(r)}</small></span>
    {r.review === 'pending' ? <Tag label="To review" cls="tag-caution" /> : r.review === 'returned' ? <Tag label="Returned" cls="tag-alert" /> : <DeliveryTag r={r} />}
  </a>;
  const issueRow = (i: Issue) => <a key={i.id} className={`arow ${kind === 'issue' && id === i.id ? 'on' : ''}`} href={`#/projects/${s.code}/issue/${i.id}`}>
    <span className="ref">{shortRef(i.reference)}</span>
    <span className="nm">{i.description}<small>{i.location || 'no location'} · {i.owner || 'unassigned'}{i.targetDate ? ` · target ${i.targetDate}` : ''}</small></span>
    <WorkTag i={i} day={day} />
  </a>;
  const draftRow = (r: ReportSummary) => <div key={r.id} className="arow"><span className="ref fine">DRAFT</span><span className="nm">{r.author}{r.authorTrade ? ` · ${r.authorTrade}` : ''} · visit {r.visitDate}<small>Saved {fmtWhen(r.lastSavedAt)} · {r.observationCount} section{r.observationCount === 1 ? '' : 's'} · {r.corrects ? 'correction in progress' : 'contents private until sent'}</small></span><Tag label="Draft" cls="tag-caution" /></div>;
  const attnReports = [...s.failed, ...s.pendingReview, ...s.returned];
  const attnIssues = [...new Map([...s.overdue, ...s.disputed, ...s.verify, ...s.unassigned].map(i => [i.id, i])).values()];
  const closed = s.issues.filter(i => !isActive(i));
  return <div className="col">
    <div className="col-head"><a className="col-back" href="#/projects">‹ Projects</a><h4>Register · {s.project.projectName}</h4><i>{s.reports.length} reports · {s.active.length} open</i></div>
    <div className="filters" style={{ border: 0, borderBottom: '1px solid var(--line)', padding: '8px 16px' }}>
      {([['action', `Needs action · ${s.needsAction}`], ['reports', `Reports · ${s.reports.length}`], ['issues', `Issues · ${s.issues.length}`], ['drafts', `Drafts · ${s.drafts.length}`]] as [Filter, string][]).map(([k, l]) => <button type="button" key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
    </div>
    {filter === 'action' && <>
      <div className="grp">Reports needing attention<i>{attnReports.length}</i></div>
      {attnReports.length ? attnReports.map(reportRow) : <div className="empty" style={{ padding: 14 }}>Nothing waits for review or correction.</div>}
      <div className="grp">Issues needing action<i>{attnIssues.length} of {s.active.length}</i></div>
      {attnIssues.length ? attnIssues.map(issueRow) : <div className="empty" style={{ padding: 14 }}>Nothing overdue, unassigned, disputed or waiting to be verified.</div>}
      {s.drafts.length > 0 && <><div className="grp">Drafts on site<i>{s.drafts.length}</i></div>{s.drafts.map(draftRow)}</>}
    </>}
    {filter === 'reports' && (s.reports.length ? s.reports.map(reportRow) : <div className="empty">No reports received on this project.</div>)}
    {filter === 'issues' && <>
      <div className="grp">Open<i>{s.active.length}</i></div>
      {s.active.length ? s.active.slice().sort((a, b) => Number(isOverdue(b, day)) - Number(isOverdue(a, day))).map(issueRow) : <div className="empty" style={{ padding: 14 }}>Nothing outstanding.</div>}
      <div className="grp">Closed or withdrawn<i>{closed.length}</i></div>
      {closed.map(issueRow)}
    </>}
    {filter === 'drafts' && (s.drafts.length ? s.drafts.map(draftRow) : <div className="empty">No drafts saved to the server on this project.</div>)}
    <div className="colpad sticky-foot"><div className="rowsub">{filter === 'action' ? `Needs action hides ${s.reports.length - attnReports.length} reports and ${s.issues.length - attnIssues.length} issues that need nobody.` : ''} Reports and issues share one column because the office reads them as one stream. Work held only on an engineer’s device is not visible here.</div></div>
  </div>;
}

function foundWords(r: ReportSummary): string {
  const k = r.kindCounts;
  if (!k) return r.defectCount ? `${r.defectCount} raising an issue` : `${r.observationCount} section${r.observationCount === 1 ? '' : 's'}`;
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
  const week = Date.now() - 7 * 86400000;
  const thisWeek = snap.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week);
  const overdue = ctx.stats.flatMap(s => s.overdue), verify = ctx.stats.flatMap(s => s.verify), notNotified = ctx.stats.flatMap(s => s.notNotified);
  const latest = snap.reports.slice(0, 6);
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs">Leodis Developments</div><h4>Office position</h4><div className="rowsub">{ctx.projects.length} reportable projects · {snap.reports.length} reports received · {snap.issues.filter(isActive).length} open issues · {fmtDate(snap.loadedAt)}</div></div>
      <div className="actions"><a className="btn btn-q btn-sm" href="#/inbox">Inbox</a><a className="btn btn-sm" href="#/issues">Issues</a></div></div>
    <dl className="tb three"><div><dt>Received this week</dt><dd className="big">{thisWeek.length}<small>{notNotified.length ? `${notNotified.length} PM notification${notNotified.length === 1 ? '' : 's'} pending` : 'project managers notified'}</small></dd></div><div><dt>Overdue actions</dt><dd className={`big ${overdue.length ? 'late' : ''}`}>{overdue.length}<small>{overdue.length ? `oldest ${Math.max(...overdue.map(i => daysLate(i.targetDate, ctx.day)))} days past target` : 'nothing past its target'}</small></dd></div><div><dt>Ready to verify</dt><dd className={`big ${verify.length ? 'soon' : ''}`}>{verify.length}<small>{verify.length ? 'closure submitted, needs a second pair of eyes' : 'nothing awaiting verification'}</small></dd></div></dl>
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
    ...st.disputed.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · disputed at review`, tag: { label: 'Triage', cls: 'tag-alert' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.verify.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · closure by ${i.closureSubmittedBy ?? 'unknown'}`, tag: { label: 'Verify', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
    ...st.unassigned.map(i => ({ key: i.id, ref: shortRef(i.reference), b: i.description, sub: `${st.project.projectName} · nobody owns it · raised ${fmtDay(i.raisedAt)}`, tag: { label: 'Unassigned', cls: 'tag-caution' }, go: `#/projects/${st.code}/issue/${i.id}` })),
  ]);
  const shown = [...new Map(items.map(i => [i.key, i])).values()].slice(0, limit);
  return <div className="rmenu">{shown.length ? shown.map(i => <a key={i.key} href={i.go}><span className="ref">{i.ref}</span><div className="rt"><b>{i.b}</b><span>{i.sub}</span></div><Tag {...i.tag} /></a>) : <div className="empty" style={{ padding: 14 }}>Nothing needs attention.</div>}</div>;
}

function LatestReports({ ctx, reports, showProject }: { ctx: Ctx; reports: ReportSummary[]; showProject?: boolean }) {
  const code = (r: ReportSummary) => ctx.projects.find(p => p.id === r.projectId)?.projectNumber ?? '';
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
      <div className="actions"><Link className="btn btn-q btn-sm" href={`/projects/${p.id}`}>Project page</Link><a className="btn btn-sm" href={`#/inbox`}>Inbox</a></div></div>
    <dl className="tb three"><div><dt>Received this week</dt><dd className="big">{thisWeek.length}<small>{s.reports.length ? `${s.reports.length} on file` : 'none yet'}{s.notNotified.length ? ` · ${s.notNotified.length} PM notification${s.notNotified.length === 1 ? '' : 's'} pending` : ''}</small></dd></div><div><dt>Overdue actions</dt><dd className={`big ${s.overdue.length ? 'late' : ''}`}>{s.overdue.length}<small>{s.overdue.length ? `oldest ${Math.max(...s.overdue.map(i => daysLate(i.targetDate, ctx.day)))} days past target` : 'nothing past its target'}</small></dd></div><div><dt>Ready to verify</dt><dd className={`big ${s.verify.length ? 'soon' : ''}`}>{s.verify.length}<small>{s.verify.length ? `closure submitted ${fmtDay(s.verify[0]!.events.at(-1)?.at)}` : 'nothing awaiting verification'}</small></dd></div></dl>
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
export function ReportReader({ ctx, id, crumbsHome }: { ctx: Ctx; id: string; crumbsHome?: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stopped = false; setReport(null); setError('');
    getReport(id).then(r => { if (stopped) return; if (r && r.state === 'submitted') setReport(r); else setError(r ? 'This is a draft. Its contents are private to the author until it is sent.' : 'That report could not be found.'); }).catch(e => { if (!stopped) setError(e.message); });
    return () => { stopped = true; };
  }, [id, ctx.snap?.loadedAt]);
  if (error) return <div className="sheet"><div className="empty">{error}</div></div>;
  if (!report) return <div className="sheet"><div className="loading" style={{ minHeight: 160 }}>Loading report</div></div>;
  const project = ctx.projects.find(p => p.id === report.projectId);
  const code = project?.projectNumber ?? '';
  const summary = ctx.snap?.reports.find(r => r.id === report.id);
  const review = reviewStatus(report), delivery = deliveryStatus(report), ack = acknowledgementStatus(report);
  const superseded = ctx.snap?.reports.find(r => r.corrects === report.id);
  const raised = ctx.snap?.issues.filter(i => i.raisedByReport === report.id) ?? [];
  const decisions = report.observations.filter(o => o.type === 'instruction' || o.actionNeeded.trim());
  const canReview = report.review === 'pending' && report.authorId !== ctx.me.id;
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={crumbsHome ?? `#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Site progress report</div><h4>Visit {fmtDate(report.visitDate)}</h4><div className="rowsub"><span className="ref">{report.reference}</span><span className="sep">/</span>{report.author}{report.authorTrade ? ` · ${report.authorTrade}` : ''}<span className="sep">/</span>Rev {report.revision}</div></div>
      <div className="actions"><Link className="btn btn-q btn-sm" href={`/reports/${report.id}/preview`}>Full report</Link><Link className="btn btn-q btn-sm" href={`/reports/${report.id}/pdf`}>PDF</Link>
        {canReview ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'review', report: summary })}>Review</Btn>
          : !report.acknowledged ? <Btn className="btn-sm" onClick={() => summary && ctx.setDialog({ kind: 'acknowledge', report: summary })}>Acknowledge</Btn> : null}</div></div>
    <dl className="tb"><div><dt>Received</dt><dd>{fmtWhen(report.serverAcknowledgedAt)}</dd></div><div><dt>Review</dt><dd>{review ? <Tag label={review.label} cls={toneTag(review.tone)} /> : '—'}</dd></div><div><dt>PDF and notification</dt><dd>{delivery ? <Tag label={delivery.label} cls={toneTag(delivery.tone)} /> : '—'}</dd></div><div><dt>Read</dt><dd>{ack ? <Tag label={ack.label} cls={toneTag(ack.tone)} /> : '—'}{report.acknowledged && <small>{fmtWhen(report.acknowledged.at)}{report.acknowledged.note ? ` · ${report.acknowledged.note}` : ''}</small>}</dd></div></dl>
    {report.review === 'returned' && <div className="note bad"><span><b>Sent back by {report.reviewedBy ?? 'the office'}</b>{report.reviewedAt ? ` on ${fmtDay(report.reviewedAt)}` : ''}: {report.reviewNote} {superseded ? '' : 'The engineer can send a corrected revision.'}</span></div>}
    {superseded && <div className="note info"><span><b>Superseded by rev {superseded.revision}</b>{superseded.state === 'draft' ? ', a correction in progress on site.' : '.'} </span>{superseded.state === 'submitted' && <a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${superseded.id}`}>Open rev {superseded.revision}</a>}</div>}
    {report.corrects && <div className="note info"><span><b>Rev {report.revision} supersedes rev {report.revision - 1}.</b> {report.correctionReason}</span><a className="btn btn-q btn-sm" href={`#/projects/${code}/report/${report.corrects}`}>Open rev {report.revision - 1}</a></div>}
    {report.review === 'pending' && !canReview && <div className="note warn"><span><b>Awaiting review.</b> You wrote this report, so someone else has to review it.</span></div>}
    {report.delivery === 'failed' && <div className="note bad"><span><b>Could not be processed.</b> {report.deliveryError ?? 'The worker gave up on this report.'} The report is on file; the PDF and the notification are what failed.</span></div>}
    {(report.delivery === 'outbox' || report.issued?.transport === 'outbox') && <div className="note"><span>{project?.projectManager ?? 'The project manager'} has not been notified by email yet: the pilot holds notification emails in a local outbox. The report is on file and readable here.</span></div>}
    {decisions.length > 0 && <><SecH>Actions and decisions</SecH>
      <div className="rmenu">{decisions.map(o => <div key={o.id}><div className="rt"><b>{o.type === 'instruction' ? 'Decision needed' : `Action for ${o.owner.trim() || 'nobody yet'}`} · {o.location || 'no location'}</b><span>{o.type === 'instruction' ? o.whatHappened : o.actionNeeded}{o.type !== 'instruction' && !o.owner.trim() && ' · no owner named'}</span></div>{o.type === 'instruction' ? <span className="kind tone-variation">Variation</span> : raisedRef(o.id, raised, code)}</div>)}</div></>}
    <SecH right={<span className="r">{report.observations.length} update{report.observations.length === 1 ? '' : 's'}</span>}>Found on this visit</SecH>
    {report.observations.length ? report.observations.map(o => {
      const type = OBSERVATION_TYPES.find(t => t.value === o.type);
      const linked = o.linkedIssueId ? ctx.snap?.issues.find(i => i.id === o.linkedIssueId) : undefined;
      const mine = raised.find(i => i.raisedByObservation === o.id);
      return <div key={o.id} className="hist"><span className="d"><span className={`kind tone-${type?.tone ?? 'neutral'}`}>{type?.label.split(' ')[0] ?? o.type}</span></span>
        <div className="b"><p><b>{o.location || 'Location not recorded'}</b> — {o.whatHappened}</p>
          <div className="rowsub">{o.actionNeeded && <>Action: {o.actionNeeded} · </>}{o.owner && <>Owner: {o.owner} · </>}{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}
            {linked && <> · further sighting of <a className="ref" href={`#/projects/${code}/issue/${linked.id}`}>{shortRef(linked.reference)}</a></>}
            {mine && <> · raised <a className="ref" href={`#/projects/${code}/issue/${mine.id}`}>{shortRef(mine.reference)}</a> · <ConfirmTag i={mine} /></>}</div>
          {o.photos.length > 0 && <div className="photos">{o.photos.map(ph => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || 'Site photograph'} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}
        </div></div>;
    }) : <div className="empty">No updates were recorded on this visit.</div>}
    <SecH>Signature</SecH>
    <div className="rowsub">{report.signature ? `Signed ${report.signature.name} · ${fmtWhen(report.signature.signedAt)}` : 'No signature captured'} · Generated by Leodis Relay</div>
  </div>;
}
function raisedRef(observationId: string, raised: Issue[], code: string) {
  const i = raised.find(x => x.raisedByObservation === observationId);
  return i ? <a className="ref" href={`#/projects/${code}/issue/${i.id}`}>{shortRef(i.reference)}</a> : <span className="rowsub">no issue</span>;
}

/* ----------------------------------------------------------------- issue */
const EVENT_LABEL: Record<string, string> = { raised: 'Raised', progress: 'Update', closure_submitted: 'Closure submitted', verified: 'Verified closed', reopened: 'Reopened', confirmation: 'Review', assigned: 'Assigned' };
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
  const project = ctx.projects.find(p => p.id === issue.projectId); const code = project?.projectNumber ?? '';
  const source = issue.raisedByReport ? ctx.snap?.reports.find(r => r.id === issue.raisedByReport) : undefined;
  const active = isActive(issue); const overdue = isOverdue(issue, ctx.day);
  const closureMine = issue.closureSubmittedById ? issue.closureSubmittedById === ctx.me.id : issue.closureSubmittedBy === ctx.me.name;
  const d = (kind: string) => ctx.setDialog(dialogFor(kind, issue, ctx));
  return <div className="sheet">
    <div className="sheet-title"><div><div className="crumbs"><a href={`#/projects/${code}`}>{project?.projectName ?? 'Project'}</a><span>›</span>Issue</div><h4>{issue.description}</h4><div className="rowsub"><span className="ref">{issue.reference}</span><span className="sep">/</span>{issue.location || 'Location not recorded'}<span className="sep">/</span>{issue.affectedTrade ?? (issue.reporterTrade ? `reported by ${issue.reporterTrade}` : 'trade not recorded')}</div></div>
      <div className="actions">
        <Link className="btn btn-q btn-sm" href={`/issues/${issue.id}`}>Issue page</Link>
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
    <dl className="tb two" style={{ marginTop: 12 }}><div><dt>Source</dt><dd>{source ? <>Raised by <a className="ref" href={`#/projects/${code}/report/${source.id}`}>{shortRef(source.reference)}</a> · {fmtDay(issue.raisedAt)}</> : issue.source === 'individual' ? <>Flagged on site by {issue.reportedBy ?? 'unknown'} · {fmtDay(issue.raisedAt)}</> : <>Raised {fmtDay(issue.raisedAt)}</>}<small>{issue.reportedBy ?? issue.events[0]?.actor ?? 'Reporter not recorded'}{issue.reporterTrade ? ` · ${issue.reporterTrade}` : ''}</small></dd></div><div><dt>Progress notes</dt><dd>Add updates and photographs on the issue page.<small>Engineers can submit the work as complete there; the office verifies here.</small></dd></div></dl>
    <SecH right={<span className="r">{issue.events.length}</span>}>History</SecH>
    {issue.events.slice().reverse().map((e, i) => <div key={i} className="hist"><span className="d">{fmtDay(e.at)}<div className="rowsub">{EVENT_LABEL[e.kind] ?? e.kind}</div></span><div className="b"><p>{e.note || <span className="fine">No note</span>}</p><div className="rowsub">{e.actor}</div>{e.photos.length > 0 && <div className="photos">{e.photos.map((ph, pi) => <figure key={ph.id}><PhotoImage src={ph.dataUrl} alt={ph.caption || `Photograph ${pi + 1}`} /><figcaption>{ph.caption}</figcaption></figure>)}</div>}</div></div>)}
  </div>;
}
