'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { Issue, IssueEvent } from '@/lib/types';
import { IssueSyncStatus } from '@/components/SharePointStatus';
import { PhotoImage } from '@/components/PhotoImage';
import { withViewReturn } from '@/lib/viewNavigation';
import type { Ctx } from './ctx';
import { dialogFor } from './OfficeDesk';
import { Btn, BtnQ } from './bits';
import { Band, CardList, Mark, StubCard, type MarkKind } from './marks';
import { daysLate, fmtDay, fmtWhen, isActive, isDisputed, isNotReviewed, isOverdue, shortRef } from './model';
import './issues.css';

type Stage = 'open' | 'assigned' | 'verify' | 'closed';
type Group = 'urgency' | 'owner' | 'project';
const STAGES: { k: Stage; label: string; test: (i: Issue) => boolean }[] = [
  { k: 'open', label: 'Open issue', test: i => isActive(i) && !i.owner.trim() && i.work !== 'awaiting_verification' },
  { k: 'assigned', label: 'Assigned', test: i => isActive(i) && !!i.owner.trim() && i.work !== 'awaiting_verification' },
  { k: 'verify', label: 'Ready to verify', test: i => isActive(i) && i.work === 'awaiting_verification' },
  { k: 'closed', label: 'Closed', test: i => !isActive(i) },
];
const stageOf = (i: Issue): Stage => STAGES.find(s => s.test(i))?.k ?? 'open';
const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'];
const needsSync = (i: Issue) => !!i.sync && i.sync.status !== 'synced';

/** Which urgency band an issue falls in: the first that applies. */
type Urgency = 'overdue' | 'disputed' | 'notReviewed' | 'sync' | 'onTrack' | 'closed';
const BANDS: { k: Urgency; label: string; mark: MarkKind }[] = [
  { k: 'overdue', label: 'Overdue', mark: 'urgent' }, { k: 'disputed', label: 'Disputed', mark: 'action' },
  { k: 'notReviewed', label: 'Not reviewed', mark: 'action' }, { k: 'sync', label: 'SharePoint needs attention', mark: 'sync' },
  { k: 'onTrack', label: 'On track', mark: 'none' }, { k: 'closed', label: 'Closed', mark: 'done' },
];
function urgency(i: Issue, day: string): Urgency {
  if (!isActive(i)) return 'closed';
  if (isOverdue(i, day)) return 'overdue';
  if (isDisputed(i)) return 'disputed';
  if (isNotReviewed(i)) return 'notReviewed';
  return needsSync(i) ? 'sync' : 'onTrack';
}
const rankOf = (u: Urgency) => BANDS.findIndex(b => b.k === u);
const byTarget = (a: Issue, b: Issue) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999') || a.reference.localeCompare(b.reference);
/** A date-only target as "Fri 18 Sep". */
const fmtTarget = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) : d;

const EVENT: Record<IssueEvent['kind'], [string, string]> = {
  raised: ['Raised', 'gold'], assigned: ['Assigned', 'gold'], progress: ['Update', ''], closure_submitted: ['Submitted as complete', 'warn'],
  verified: ['Verified closed', 'ok'], reopened: ['Reopened', 'bad'], confirmation: ['Review', ''], note: ['Note', ''],
};

/** The issue register across projects: a stage bar, a grouped list, and the selected issue beside it. */
export function IssuesView({ ctx }: { ctx: Ctx }) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [group, setGroup] = useState<Group>('urgency');
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [owner, setOwner] = useState('');
  const snap = ctx.snap; const day = ctx.day;
  const linked = ctx.route.a ? snap?.issues.find(i => i.id === ctx.route.a) : undefined;
  // A link to an issue opens the stage it sits in.
  useEffect(() => { if (linked) setStage(stageOf(linked)); }, [linked?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;

  const scoped = snap.issues.filter(i => (!project || i.projectId === project) && (!trade || i.affectedTrade === trade || (!i.affectedTrade && i.reporterTrade === trade)) && (!owner || i.owner.trim() === owner));
  const current: Stage = stage ?? (scoped.some(STAGES[1].test) ? 'assigned' : 'open');
  const stageDef = STAGES.find(s => s.k === current)!;
  const items = scoped.filter(stageDef.test);
  const ordered = [...items].sort((a, b) => rankOf(urgency(a, day)) - rankOf(urgency(b, day)) || byTarget(a, b));
  const selected = items.find(i => i.id === ctx.route.a) ?? ordered[0];
  const owners = [...new Set(snap.issues.map(i => i.owner.trim()).filter(Boolean))].sort();
  const proj = (id: string) => ctx.projects.find(p => p.id === id);
  const closureMine = (i: Issue) => i.closureSubmittedById ? i.closureSubmittedById === ctx.me.id : i.closureSubmittedBy === ctx.me.name;
  const pickStage = (k: Stage) => { setStage(k); if (ctx.route.a) ctx.go('#/issues'); };

  const card = (i: Issue) => {
    const u = urgency(i, day); const band = BANDS[rankOf(u)];
    const aside = !isActive(i) ? `${i.confirmation === 'withdrawn' ? 'Withdrawn' : 'Closed'} ${fmtDay(i.events.at(-1)?.at ?? i.raisedAt)}`
      : i.work === 'awaiting_verification' ? `Done by ${ctx.nameOf(i.closureSubmittedById, i.closureSubmittedBy ?? 'unknown')}`
      : isOverdue(i, day) ? <b className="ro-is-late">{daysLate(i.targetDate, day)}d late</b>
      : i.targetDate ? `Due ${fmtTarget(i.targetDate)}` : 'No target';
    const sub = <>{i.owner.trim() ? <b>{i.owner}</b> : <b className="ro-is-late">No owner</b>} · {proj(i.projectId)?.projectName ?? i.projectId}{i.location && ` · ${i.location}`}</>;
    return <StubCard key={i.id} href={`#/issues/${i.id}`} on={selected?.id === i.id} quiet={u === 'closed'} project={proj(i.projectId)?.projectNumber ?? i.projectId}
      code={shortRef(i.reference)} title={i.description} sub={sub} aside={aside} mark={band.mark} markLabel={u === 'onTrack' ? 'On track' : band.label} />;
  };

  let list: ReactNode;
  if (!items.length) list = <div className="ro-empty"><Mark kind="done" /><b>Nothing here</b><span>No {stageDef.label.toLowerCase()} issues{project || trade || owner ? ' in this scope' : ''}.</span></div>;
  else if (group === 'urgency') list = BANDS.map(b => { const g = ordered.filter(i => urgency(i, day) === b.k); return g.length ? <div key={b.k}><Band kind={b.mark} label={b.label} count={g.length} /><CardList>{g.map(card)}</CardList></div> : null; });
  else {
    const keyOf = (i: Issue) => group === 'owner' ? i.owner.trim() || 'No owner' : proj(i.projectId)?.projectName ?? i.projectId;
    const groups = [...new Set(ordered.map(keyOf))].map(k => { const g = ordered.filter(i => keyOf(i) === k); return { k, g, late: g.filter(i => isOverdue(i, day)).length }; })
      .sort((a, b) => b.late - a.late || b.g.length - a.g.length || a.k.localeCompare(b.k));
    list = groups.map(({ k, g, late }) => <div key={k}><div className="ro-is-grouphead"><span>{k} · {g.length}{late > 0 && <> · <b className="ro-is-late">{late} late</b></>}</span></div><CardList>{g.map(card)}</CardList></div>);
  }

  return <div className="ro-is">
    <div className="ro-is-pipe" role="group" aria-label="Issue stage">
      {STAGES.map(s => {
        const g = scoped.filter(s.test); const late = g.filter(i => isOverdue(i, day)).length; const disp = g.filter(isDisputed).length; const prov = g.filter(isNotReviewed).length;
        return <button type="button" key={s.k} className={`ro-is-stage ${s.k === 'closed' ? 'closed' : ''}`} aria-pressed={current === s.k} onClick={() => pickStage(s.k)}>
          <span className="ro-is-sl">{s.label}</span><span className="ro-is-sn">{g.length}</span>
          <span className="ro-is-sf">{late > 0 && <span><Mark kind="urgent" size="sm" />{late} late</span>}{disp > 0 && <span><Mark kind="action" size="sm" label="Disputed" />{disp} disputed</span>}{prov > 0 && <span><Mark kind="action" size="sm" label="Not reviewed" />{prov} not reviewed</span>}{!late && !disp && !prov && <span>Nothing flagged</span>}</span>
        </button>;
      })}
    </div>
    <div className="ro-is-bar">
      <label>Group by <select value={group} onChange={e => setGroup(e.target.value as Group)}><option value="urgency">Urgency</option><option value="owner">Owner (chase list)</option><option value="project">Project</option></select></label>
      <span className="ro-is-grow" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      <label>Owner <select value={owner} onChange={e => setOwner(e.target.value)}><option value="">Anyone</option>{owners.map(o => <option key={o} value={o}>{o}</option>)}</select></label>
    </div>
    <div className="ro-is-body">
      <section className="col" aria-label={`${stageDef.label} issues`}>
        <div className="col-head"><h4>{stageDef.label}</h4><i>{items.length} issue{items.length === 1 ? '' : 's'} · {new Set(items.map(i => i.projectId)).size} projects</i></div>
        <div className="ro-is-scroll">{list}</div>
      </section>
      <section className="col focus" aria-label="Issue detail">
        <div className="col-head"><h4>Issue detail</h4>{selected && <i>{selected.reference}</i>}</div>
        {selected ? <Detail ctx={ctx} i={selected} stage={STAGES.find(s => s.k === stageOf(selected))!.label} mine={closureMine(selected)} /> : <div className="ro-empty"><b>No issue selected</b><span>Choose an issue from the list.</span></div>}
      </section>
    </div>
  </div>;
}

function Detail({ ctx, i, stage, mine }: { ctx: Ctx; i: Issue; stage: string; mine: boolean }) {
  const day = ctx.day; const active = isActive(i); const late = isOverdue(i, day);
  const p = ctx.projects.find(x => x.id === i.projectId);
  const report = i.raisedByReport ? ctx.snap?.reports.find(r => r.id === i.raisedByReport) : undefined;
  const raised = i.events.find(e => e.kind === 'raised');
  const assign = () => ctx.setDialog(dialogFor('assign', i, ctx));
  const next = (kind: MarkKind, title: string, why: ReactNode, buttons?: ReactNode) => <div className="ro-is-next">
    <div className="ro-is-why"><Mark kind={kind} /><span><b>{title}</b>{why}</span></div>{buttons && <div className="ro-is-btns">{buttons}</div>}</div>;

  let step: ReactNode;
  if (i.confirmation === 'withdrawn') step = next('none', 'Withdrawn', 'This issue was withdrawn and needs nothing further.');
  else if (!active) step = next('done', 'Closed', 'Verified closed. Reopen it if the problem has come back.', <BtnQ onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Reopen</BtnQ>);
  else if (isDisputed(i)) step = next('action', 'Decide whether it stands', 'The report that raised it was returned, so someone has to triage it.', <Btn onClick={() => ctx.setDialog(dialogFor('triage', i, ctx))}>Triage</Btn>);
  else if (isNotReviewed(i)) step = next('action', 'Review the issue', 'Confirm it is a real issue, or withdraw it with a reason.', <><Btn onClick={() => ctx.setDialog(dialogFor('confirm', i, ctx))}>Confirm</Btn><BtnQ onClick={() => ctx.setDialog({ kind: 'withdraw', issue: i })}>Withdraw</BtnQ></>);
  else if (!i.owner.trim()) step = next('action', 'Assign an owner', 'Nobody is responsible for putting this right yet.', <Btn onClick={assign}>Assign owner</Btn>);
  else if (i.work === 'awaiting_verification') step = next('action', 'Verify the work', `${ctx.nameOf(i.closureSubmittedById, i.closureSubmittedBy ?? 'Someone')} submitted this as complete. Check it and close it, or send it back.`, <>
    <Btn disabled={mine} onClick={() => ctx.setDialog(dialogFor('verify', i, ctx))}>Verify</Btn>
    <BtnQ onClick={() => ctx.setDialog({ kind: 'reopen', issue: i })}>Not finished</BtnQ>
    {mine && <span className="ro-is-locked">You submitted this as complete, so someone else has to verify it.</span>}</>);
  else step = next(late ? 'urgent' : 'none', late ? `${daysLate(i.targetDate, day)} days late: chase ${i.owner}` : `With ${i.owner}`,
    <>{late ? `The target was ${fmtTarget(i.targetDate)}.` : i.targetDate ? `Due ${fmtTarget(i.targetDate)}.` : 'No target date is set.'} Engineers submit the work as complete from the issue page.</>,
    <BtnQ onClick={assign}>Reassign or change target</BtnQ>);

  return <div className="ro-is-scroll"><div className="ro-is-detail">
    <div><div className="ro-is-code">{shortRef(i.reference)}</div><h3>{i.description}</h3></div>
    <div className="ro-is-pills">
      <span className="ro-is-pill stage">{i.confirmation === 'withdrawn' ? 'Withdrawn' : stage}</span>
      {late && <span className="ro-is-pill urgent">{daysLate(i.targetDate, day)}d late</span>}
      {isDisputed(i) && <span className="ro-is-pill action">Disputed</span>}
      {isNotReviewed(i) && <span className="ro-is-pill action">Not reviewed</span>}
      {needsSync(i) && <span className="ro-is-pill sync">SharePoint</span>}
    </div>
    {step}
    {needsSync(i) && <IssueSyncStatus issue={i} />}
    <dl className="ro-is-facts">
      <dt>Project</dt><dd>{p ? `${p.projectNumber} · ${p.projectName}` : i.projectId}</dd>
      <dt>Location</dt><dd>{i.location || 'Not recorded'}</dd>
      <dt>Trade</dt><dd>{i.affectedTrade ?? (i.reporterTrade ? `Reported by ${i.reporterTrade}` : 'Not recorded')}</dd>
      <dt>Owner</dt><dd>{i.owner.trim() || <span className="ro-is-late">No owner</span>}</dd>
      <dt>Target</dt><dd>{i.targetDate ? fmtTarget(i.targetDate) : 'Not set'}</dd>
      <dt>Raised in</dt><dd>{report ? <a href={`#/projects/${i.projectId}/report/${i.raisedByReport}`}>{shortRef(report.reference)}</a> : `Flagged on site by ${i.reportedBy ? ctx.nameOf(i.reportedById, i.reportedBy) : ctx.nameOf(raised?.actorId, raised?.actor ?? 'unknown')}`} · {fmtDay(i.raisedAt)}</dd>
      {i.actionNeeded && <><dt>Action needed</dt><dd>{i.actionNeeded}</dd></>}
    </dl>
    {!!raised?.photos.length && <div className="ro-is-photos">{raised.photos.map((ph, n) => <PhotoImage key={ph.id} src={ph.dataUrl} alt={ph.caption || `Photograph ${n + 1}`} />)}</div>}
    <div>
      <h5 className="ro-is-h">Timeline</h5>
      <ol className="ro-is-tl">{i.events.map((e, n) => <li key={n}><span className={`ro-is-dot ${EVENT[e.kind]?.[1] ?? ''}`} aria-hidden="true" /><span className="ro-is-tb">
        <b>{EVENT[e.kind]?.[0] ?? e.kind}</b>{e.note && <q>{e.note}</q>}<small>{ctx.nameOf(e.actorId, e.actor)} · {fmtWhen(e.at)}</small>
        {e.kind !== 'raised' && e.photos.length > 0 && <span className="ro-is-photos">{e.photos.map((ph, k) => <PhotoImage key={ph.id} src={ph.dataUrl} alt={ph.caption || `Photograph ${k + 1}`} />)}</span>}
      </span></li>)}</ol>
    </div>
    <a className="ro-is-page" href={withViewReturn(`/issues/${i.id}`, '/office#/issues')}>Issue page</a>
  </div></div>;
}
