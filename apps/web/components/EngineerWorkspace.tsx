'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, createReport, getReport, listReports, projectIssues, projectVariations } from '@/lib/api';
import { listHeld, type HeldDraft } from '@/lib/localDraft';
import { offlineProjectsKey } from '@/lib/offlineStart';
import { unfinishedReports, type UnfinishedReport } from '@/lib/unfinishedReports';
import type { FixtureProject } from '@/lib/fixtures';
import type { Issue, ReportSummary, Variation } from '@/lib/types';
import { usePrincipal } from './PrincipalContext';
import { ownsReport } from '@/lib/auth/access';
import { EngineerIssueList } from './EngineerIssueList';
import { IndividualDefect } from './IndividualDefect';
import { SinceLastVisit } from './SinceLastVisit';
import { PageTitle } from './PageTitle';
import { acknowledgementStatus, deliveryStatus, reviewStatus, toneClass } from '@/lib/status';
import { fmtMoney, variationValue } from '@/lib/variations';
import { projectStatusGroups } from '@/lib/projectGroups';
import { withViewReturn } from '@/lib/viewNavigation';
import { CHECKLIST_TYPES, reportTypeOf, type ReportTypeId } from '@/lib/reportTypes';
import { useWhatsNewCount } from './useWhatsNew';

/**
 * The same words the office uses. A report is received when the server has
 * it, reviewed when a person decided, and delivered when the email went; an
 * engineer who can only see "Received" assumes the project manager has it.
 */
function ReportTags({r}:{r:ReportSummary}) {
  if (r.state === 'draft') return <span className="tag tag-draft">{r.corrects ? 'Correction draft' : 'Your draft'}</span>;
  const review = reviewStatus(r), delivery = deliveryStatus(r), ack = acknowledgementStatus(r);
  return <>
    <span className="tag tag-sent">Received</span>
    {review && review.label !== 'No review required' && <span className={toneClass(review.tone)}>{review.label}</span>}
    {ack && r.acknowledged && <span className={toneClass(ack.tone)}>{ack.label}</span>}
    {delivery && <span className={toneClass(delivery.tone)}>{delivery.label}</span>}
  </>;
}
const WORK: Record<Issue['work'], string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', awaiting_verification: 'Ready for verification', closed: 'Closed' };
function IssueTags({i}:{i:Issue}) {
  if (i.confirmation === 'withdrawn') return <span className="tag tag-draft">Withdrawn</span>;
  if (i.work === 'closed') return <span className="tag tag-sent">Closed</span>;
  return <><span className={`tag ${i.confirmation === 'disputed' ? 'tag-alert' : 'tag-draft'}`}>{WORK[i.work]}</span>{i.owner.trim() ? <span>{i.owner}{i.targetDate ? ` · target ${i.targetDate}` : ''}</span> : <span>not yet assigned</span>}</>;
}
/** The office's answer on a variation the engineer raised. */
export function VariationTags({v}:{v:Variation}) {
  if (v.instruction === 'instructed') return <><span className="tag tag-sent">Instructed</span><span>{v.instructionReference} · {fmtMoney(variationValue(v))}</span></>;
  if (v.instruction === 'declined') return <span className="tag tag-draft">Declined</span>;
  if (v.workDone) return <><span className="tag tag-alert">Done, not instructed</span><span>the office is getting the client’s sign-off</span></>;
  if (v.quotedValue !== undefined) return <><span className="tag tag-draft">Quoted {fmtMoney(v.quotedValue)}</span><span>awaiting the client</span></>;
  return <><span className="tag tag-draft">With the office</span><span>not yet priced</span></>;
}

const LONDON = { timeZone: 'Europe/London' } as const;
const fmtWhen = (iso?: string) => iso ? new Date(iso).toLocaleString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
/** A visit day, with its year when it is not this year, since the list pages back through older reports. */
const fmtVisit = (day: string) => { const d = new Date(`${day}T12:00:00Z`); return Number.isNaN(d.getTime()) ? day : d.toLocaleDateString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short', ...(day.slice(0, 4) === new Date().toISOString().slice(0, 4) ? {} : { year: 'numeric' }) }); };
const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short' }) : '';

type View = 'home' | 'projects' | 'issues' | 'reports' | 'defect';
const viewOf = (value?:string):View => ['projects','issues','reports','defect'].includes(value ?? '') ? value as View : 'home';
const VIEW_TITLES: Record<View, string> = { home: 'Site', projects: 'Projects', issues: 'Issues', reports: 'Reports', defect: 'Flag a defect' };
interface Back { at: string; key: string; href: string; title: string; sub: string; tags: ReactNode; late?: boolean }

/** Where an unfinished report stands, in words an engineer can act on. */
function UnfinishedTags({r}:{r:UnfinishedReport}) {
  if (r.signed) return <><span className="tag tag-caution">Signed · not sent yet</span><span>{r.problem ? `not sent yet: ${r.problem}` : `signed on this phone ${fmtWhen(r.changedAt)} · goes to the office by itself when RELAY reaches the server`}</span></>;
  if (r.started) return <><span className="tag tag-alert">Only on this phone</span><span>{r.problem ? `not accepted yet: ${r.problem}` : `started without signal ${fmtWhen(r.changedAt)} · goes up when RELAY can reach the server`}</span></>;
  if (r.device === 'only') return <><span className="tag tag-alert">Only on this phone</span><span>changed {fmtWhen(r.changedAt)} · open it with signal to save</span></>;
  if (r.device === 'unsent') return <><span className="tag tag-alert">Not yet on the server</span><span>changed {fmtWhen(r.changedAt)}{r.savedAt ? ` · last saved ${fmtWhen(r.savedAt)}` : ''}</span></>;
  return <><span className="tag tag-draft">Draft</span><span>{r.savedAt ? `saved ${fmtWhen(r.savedAt)}` : 'saved on server'}</span></>;
}

/** Line icons for the navigation; the label beside each one carries the meaning. */
const navIcon = (paths: ReactNode) => <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>;
const navIcons = {
  home: navIcon(<><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/></>),
  issues: navIcon(<><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4"/><path d="M12 17h.01"/></>),
  reports: navIcon(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></>),
  projects: navIcon(<><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>),
  search: navIcon(<><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>),
};

export function EngineerWorkspace({projects,drafts,initialProject,initialView}: {
  projects:FixtureProject[]; drafts:ReportSummary[]; initialProject?:string; initialView?:string;
}) {
  const principal = usePrincipal();
  const router = useRouter();
  const [projectId,setProjectId] = useState(projects.find(p => p.id === initialProject)?.id ?? drafts[0]?.projectId ?? projects[0]?.id ?? '');
  const [view,setView] = useState<View>(viewOf(initialView));
  const [ready,setReady] = useState(false);
  const [scope,setScope] = useState('current');
  const [reports,setReports] = useState<ReportSummary[] | null>(null);
  const [issues,setIssues] = useState<Issue[] | null>(null);
  const [back,setBack] = useState<{ rows: Back[]; open: number; reports: number } | null>(null);
  const [error,setError] = useState('');
  const [creating,setCreating] = useState(false);
  const [offset,setOffset] = useState(0);
  const [next,setNext] = useState<number | null>(null);
  const [retry,setRetry] = useState(0);
  const [held,setHeld] = useState<{ copies: HeldDraft[]; deviceOnly: Set<string> }>({ copies: [], deviceOnly: new Set() });
  const project = projects.find(p => p.id === projectId);
  const ownDrafts = drafts.filter(r => r.projectId === projectId);
  // The site update in progress, and any inspection in progress, kept apart so
  // "Request a variation" never lands on an inspection's checklist.
  const currentDraft = ownDrafts.find(r => reportTypeOf(r).id === 'progress');
  // One tile per checklist type: carry on with its draft, or start one.
  const inspections = CHECKLIST_TYPES.map(type => ({ type, draft: ownDrafts.find(r => reportTypeOf(r).id === type.id) }));
  const preference = `relay-project:${principal?.id}`;
  const engineerReturn = (target: View = 'home') => `/engineer?project=${encodeURIComponent(projectId)}${target === 'home' ? '' : `&view=${target}`}`;

  useEffect(() => {
    if (!initialProject) {
      try { const saved = localStorage.getItem(preference); if(projects.some(p => p.id === saved))setProjectId(saved!); } catch {}
    }
    setReady(true);
  },[initialProject,preference,projects]);
  // The offline page offers these when a report is started with no signal (offlineStart.ts).
  useEffect(() => {
    if (!principal) return;
    try { localStorage.setItem(offlineProjectsKey(principal.id),JSON.stringify(projects.map(p => ({ id:p.id, projectNumber:p.projectNumber, projectName:p.projectName })))); } catch {}
  },[principal,projects]);

  // Copies on this device that the server has not acknowledged. One the server
  // did not list is shown only if the server cannot be asked about it: if it
  // answers, the report was sent or removed elsewhere and the copy is stale.
  useEffect(() => {
    if (!principal) return;
    let cancelled = false;
    void listHeld(principal.id).then(async copies => {
      const unlisted = copies.filter(c => !c.started && !drafts.some(d => d.id === c.reportId));
      const answers = await Promise.all(unlisted.map(c => getReport(c.reportId).then(() => null, e => e instanceof ApiError && e.offline ? c.reportId : null)));
      if (!cancelled) setHeld({ copies, deviceOnly: new Set(answers.filter((id): id is string => !!id)) });
    });
    return () => {cancelled=true;};
  },[principal,drafts]);
  const newToYou = useWhatsNewCount('site');
  const unfinished = unfinishedReports(drafts, held.copies, projects, held.deviceOnly);

  useEffect(() => {
    if (!ready || !projectId) return;
    let cancelled = false;
    setReports(null);setIssues(null);setNext(null);setError('');
    if(view === 'reports') {
      listReports(projectId,offset).then(page => {
        if(cancelled)return;
        setReports(page.reports.filter(r => r.state === 'submitted' || !!principal && ownsReport(principal,r)));
        setNext(page.next);
      }).catch(e => {if(!cancelled)setError(e instanceof Error?e.message:'Unable to load reports.');});
    }
    if(view === 'issues') {
      const targets = scope === 'all' ? projects : projects.filter(p => p.id === projectId);
      Promise.all(targets.map(p => projectIssues(p.id))).then(groups => {
        if(!cancelled)setIssues(groups.flat());
      }).catch(e => {if(!cancelled)setError(e instanceof Error?e.message:'Unable to load issues.');});
    }
    // What came back from the office on the things this engineer raised, in the office's words.
    if(view === 'home' && principal) {
      setBack(null);
      Promise.all([listReports(projectId,0),projectIssues(projectId),projectVariations(projectId)]).then(([page,all,variations]) => {
        if(cancelled)return;
        const rows:Back[] = [];
        const returnTo = engineerReturn();
        for (const r of page.reports) if (r.state === 'submitted' && ownsReport(principal,r)) rows.push({ at:r.serverAcknowledgedAt ?? r.lastSavedAt ?? '', key:r.id, href:withViewReturn(`/reports/${r.id}`,returnTo), title:`${reportTypeOf(r).name} ${r.reference.split("-").slice(1).join("-")}`, sub:`Sent ${fmtWhen(r.serverAcknowledgedAt)}`, tags:<ReportTags r={r}/>, late:r.review === 'returned' });
        for (const i of all) if (i.reportedById === principal.id || i.events[0]?.actorId === principal.id) rows.push({ at:i.events.at(-1)?.at ?? i.raisedAt, key:i.id, href:withViewReturn(`/issues/${i.id}`,returnTo), title:i.description, sub:`${i.reference.split('-').slice(1).join('-')} · ${i.location || 'no location'} · you raised it ${fmtDay(i.raisedAt)}`, tags:<IssueTags i={i}/>, late:i.confirmation === 'disputed' });
        for (const v of variations) if (v.raisedById === principal.id) rows.push({ at:v.events.at(-1)?.at ?? v.raisedAt, key:v.id, href:withViewReturn(`/variations/${v.id}`,returnTo), title:v.description, sub:`${v.reference.split('-').slice(1).join('-')} · ${v.location || 'no location'} · you raised it ${fmtDay(v.raisedAt)}`, tags:<VariationTags v={v}/>, late:v.workDone && v.instruction === 'pending' });
        rows.sort((a,b) => b.at.localeCompare(a.at));
        setBack({ rows:rows.slice(0,6), open:all.filter(i => i.work !== 'closed' && i.confirmation !== 'withdrawn').length, reports:page.reports.filter(r => r.state === 'submitted').length });
      }).catch(() => { if(!cancelled) setBack({ rows:[], open:0, reports:0 }); });
    }
    return () => {cancelled=true;};
  },[view,projectId,scope,offset,retry,ready,projects,principal]);

  function navigate(to:View) {setView(to);setOffset(0);setError('');if(to==='issues')setScope('current');}
  function selectProject(id:string) {
    setProjectId(id);setOffset(0);setScope('current');setView('home');
    try{localStorage.setItem(preference,id);}catch{}
  }
  async function startReport(add?: 'instruction', type: ReportTypeId = 'progress') {
    if(!project || creating)return;
    if (currentDraft && add) { router.push(withViewReturn(`/reports/${currentDraft.id}?add=${add}`,engineerReturn(view))); return; }
    setCreating(true);setError('');
    try {const report = await createReport(project.id,principal?.name ?? '',type);router.push(withViewReturn(`/reports/${report.id}${add ? `?add=${add}` : ''}`,engineerReturn(view)));}
    catch(e){setError(e instanceof Error?e.message:'Unable to start a report. Please try again.');setCreating(false);}
  }

  return <main className="eng-workspace">
    <PageTitle title={VIEW_TITLES[view]} />
    {principal?.role !== 'Engineer' && <p className="eng-preview">Engineer layout preview · Signed in as {principal?.role}. Your permissions and report authorship are unchanged.</p>}
    <nav className="eng-navigation" aria-label="Site companion navigation">
      {([['home','Site'],['issues','Issues'],['reports','Reports'],['projects','Projects']] as const).map(([key,label]) => <button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{navIcons[key]}<span className="eng-nav-label">{label}</span></button>)}
      <Link className="eng-nav-search" href={withViewReturn(`/search${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,engineerReturn(view))}>{navIcons.search}<span className="eng-nav-label">Search</span></Link>
    </nav>
    {!ready ? <p role="status">Loading your workspace…</p> : !project ? <div className="empty">No projects are currently open to you for reporting.</div> : <>
      {view!=='home' && view!=='projects' && <div className="eng-project-context"><div><small>CURRENT PROJECT</small><strong>{project.projectName}</strong></div></div>}
      {error && <div className="note note-bad" role="alert">{error} <button onClick={()=>{setError('');setRetry(n=>n+1);}}>Retry</button></div>}
      {view==='home' && <>
        <div className="eng-heading"><p className="lbl">On site</p><h1>{principal?.name}</h1><p>{principal?.trade ? `${principal.trade} Engineer` : principal?.role} · {fmtDay(new Date().toISOString())}</p></div>
        <div className="eng-home-grid"><div>
          <section className="eng-band"><span className="lbl">Current project</span><h2>{project.projectName}</h2><p><span className="ref" style={{color:'inherit'}}>{project.projectNumber}</span> · {project.projectManager}, project manager · <button type="button" onClick={()=>navigate('projects')}>Change ›</button></p></section>
          <div className="eng-tiles">
            {currentDraft
              ? <Link className="eng-tile big" href={withViewReturn(`/reports/${currentDraft.id}`,engineerReturn())}><span className="kind tone-neutral">Site update</span><div><b>{currentDraft.corrects ? 'Continue the correction' : 'Continue today’s update'}</b><small>{currentDraft.observationCount} card{currentDraft.observationCount===1?'':'s'} · saved {fmtWhen(currentDraft.lastSavedAt) || 'on server'}</small></div><span className="arrow">→</span></Link>
              : <button type="button" className="eng-tile big" onClick={()=>void startReport()} disabled={creating}><span className="kind tone-neutral">Site update</span><div><b>{creating?'Starting…':'Start a site update'}</b><small>Progress, defects, variations and access, one card at a time</small></div><span className="arrow">→</span></button>}
            <button type="button" className="eng-tile" onClick={()=>navigate('defect')}><span className="kind tone-defect">Defect</span><div><b>Flag a defect</b><small>Photo + a short note · sent on its own</small></div></button>
            <button type="button" className="eng-tile" onClick={()=>void startReport('instruction')} disabled={creating}><span className="kind tone-variation">Variation</span><div><b>Request a variation</b><small>Extra work needing instruction · goes in your site update</small></div></button>
            {inspections.map(({ type, draft }) => draft
              ? <Link key={type.id} className="eng-tile eng-tile-wide" href={withViewReturn(`/reports/${draft.id}`,engineerReturn())}><span className="kind answer-ok">{type.tag}</span><div><b>{draft.corrects ? `Continue the ${type.name.toLowerCase()} correction` : `Continue the ${type.name.toLowerCase()}`}</b><small>{draft.checks ? `${draft.checks.ok + draft.checks.action + draft.checks.na} of ${draft.observationCount} checks answered` : `${draft.observationCount} checks`} · saved {fmtWhen(draft.lastSavedAt) || 'on server'}</small></div><span className="arrow">→</span></Link>
              : <button key={type.id} type="button" className="eng-tile eng-tile-wide" onClick={()=>void startReport(undefined,type.id)} disabled={creating}><span className="kind answer-ok">{type.tag}</span><div><b>Do a {type.name.toLowerCase()}</b><small>{type.blurb} · signed and sent as its own report</small></div><span className="arrow">→</span></button>)}
          </div>
          <p className="eng-help">Defects flagged here are sent on their own. Everything else stays a draft until you sign and send.</p>
          <section aria-labelledby="eng-unfinished-title">
            <div className="eng-section-title"><h2 id="eng-unfinished-title">Unfinished reports</h2><span className="r">{unfinished.length}</span></div>
            <div className="eng-list">
              {unfinished.length ? unfinished.map(r => r.started ? <a key={r.id} href="/offline.html" className="eng-row late"><div className="main"><b>New {r.typeName.toLowerCase()} · {r.projectName}</b><span>No reference yet · visit {fmtDay(r.visitDate)} · {r.checklist ? `${r.cards} checks` : `${r.cards} card${r.cards===1?'':'s'}`}</span><div className="stat"><UnfinishedTags r={r}/></div></div><span className="chev">›</span></a> : <Link key={r.id} href={withViewReturn(`/reports/${r.id}`,engineerReturn())} className={`eng-row ${r.device ? 'late' : ''}`}><div className="main"><b>{r.correction ? 'Correction' : r.typeName} · {r.projectName}</b><span>{r.reference.split('-').slice(1).join('-')} · visit {fmtDay(r.visitDate)} · {r.checklist ? `${r.cards} checks` : `${r.cards} card${r.cards===1?'':'s'}`}</span><div className="stat"><UnfinishedTags r={r}/></div></div><span className="chev">›</span></Link>)
                : <div className="eng-empty">Nothing unfinished. A report you start stays here, on every project, until you sign and send it.</div>}
            </div>
          </section>
        </div><div>
          <SinceLastVisit key={project.id} projectId={project.id} returnTo={engineerReturn()}/>
          <div className="eng-section-title"><h2>Came back from the office</h2><span className="r">{back ? back.rows.length : '…'}</span></div>
          <div className="eng-list">
            {!back ? <div className="eng-empty">Checking with the office…</div>
              : back.rows.length ? back.rows.map(row => <Link key={row.key} href={row.href} className={`eng-row ${row.late ? 'late' : ''}`}><div className="main"><b>{row.title}</b><span>{row.sub}</span><div className="stat">{row.tags}</div></div><span className="chev">›</span></Link>)
              : <div className="eng-empty">Nothing on this project yet. Reports you send, defects you flag and variations you request show here with the office’s answer.</div>}
          </div>
          <div className="eng-section-title"><h2>This project</h2><span className="r">{back ? `${back.open} open issue${back.open===1?'':'s'}` : ''}</span></div>
          <div className="eng-list">
            <button type="button" className="eng-row" onClick={()=>navigate('issues')}><div className="main"><b>Site issues</b><span>{back ? `${back.open} open · every trade` : 'Every trade'}</span></div><span className="chev">›</span></button>
            <Link className="eng-row" href={`/issue-trend?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Issues over time</b><span>Is the list getting shorter? Raised, closed and open, week by week</span></div><span className="chev">›</span></Link>
            <button type="button" className="eng-row" onClick={()=>navigate('reports')}><div className="main"><b>Reports</b><span>{back ? `${back.reports} on file · every trade` : 'Submitted updates from every trade'}</span></div><span className="chev">›</span></button>
            <Link className="eng-row" href={`/diary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Site diary</b><span>Every visit, day by day, from the reports sent</span></div><span className="chev">›</span></Link>
            <Link className="eng-row" href={`/photos?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Photographs</b><span>Every photograph on the project, by location</span></div><span className="chev">›</span></Link>
            <Link className="eng-row" href={`/weekly-summary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Weekly summary</b><span>The week on one page, ready for the site meeting</span></div><span className="chev">›</span></Link>
            <Link className="eng-row" href={`/safety-actions?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Safety actions</b><span>What the safety inspections found, open until the next one finds it put right</span></div><span className="chev">›</span></Link>
            <Link className="eng-row" href={`/handover?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>Before handover</b><span>Everything still open on the project, on one page: snags, fixes to check, variations, safety</span></div><span className="chev">›</span></Link>
          </div>
          <section aria-labelledby="eng-my-week-title">
            <div className="eng-section-title"><h2 id="eng-my-week-title">Your week</h2></div>
            <div className="eng-list">
              <Link className="eng-row" href={`/my-week?${new URLSearchParams({ returnTo: engineerReturn() })}`}><div className="main"><b>My week</b><span>Your days on every project, from what you sent · ready to copy into a timesheet</span></div><span className="chev">›</span></Link>
            </div>
          </section>
          <section aria-labelledby="eng-help-title">
            <div className="eng-section-title"><h2 id="eng-help-title">Help</h2></div>
            <div className="eng-list">
              <Link className="eng-row" href={`/help?${new URLSearchParams({ for: 'site', returnTo: engineerReturn() })}`}><div className="main"><b>How RELAY works and what’s new</b><span>What to tap, what happens after you send, and what the words mean</span>{newToYou > 0 && <div className="stat"><span className="tag tag-draft">{newToYou} new to you</span></div>}</div><span className="chev">›</span></Link>
            </div>
          </section>
        </div></div>
      </>}
      {view==='projects' && <><div className="eng-heading"><h1>Choose your project</h1><p>All projects open to your role. Existing drafts stay with their original project.</p></div><div className="eng-project-groups">{projectStatusGroups(projects).map(group=><section key={group.status} className={`eng-project-group eng-project-group-${group.tone}`}><div className="eng-section-title"><h2>{group.label}</h2><span className="r">{group.projects.length}</span></div><div className="eng-project-list">{group.projects.map(p=><button key={p.id} className="eng-panel" onClick={()=>selectProject(p.id)} aria-pressed={p.id===projectId}><strong>{p.projectName}</strong><small>{p.projectNumber} · {p.projectManager}</small><span>{p.id===projectId?'Current project':'Select project →'}</span></button>)}</div></section>)}</div></>}
      {view==='reports' && <><div className="eng-heading"><h1>Reports</h1><p>Your drafts and the reports every trade has sent on this project.</p></div><div className="eng-actions"><button onClick={()=>void startReport()} disabled={creating}>{creating?'Starting…':'Start another site update'}</button></div><nav className="eng-more" aria-label="More from these reports"><span className="lbl">Also on this project</span><div><Link className="eng-link-button" href={`/diary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Site diary</Link><Link className="eng-link-button" href={`/photos?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Photographs</Link><Link className="eng-link-button" href={`/weekly-summary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Weekly summary</Link><Link className="eng-link-button" href={`/safety-actions?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Safety actions</Link><Link className="eng-link-button" href={`/my-week?${new URLSearchParams({ returnTo: engineerReturn('reports') })}`}>My week</Link></div></nav>{reports===null ? !error && <p role="status">Loading reports…</p> : <section className="eng-panel">{reports.length ? reports.map(r=><Link className="eng-report-link" href={withViewReturn(`/reports/${r.id}`,engineerReturn('reports'))} key={r.id}><span><strong>{r.reference}</strong><small>{r.author} · {r.authorTrade ?? 'Trade not recorded'} · visit {fmtVisit(r.visitDate)}</small></span><span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}><ReportTags r={r}/></span></Link>) : <p className="eng-empty">{offset ? 'No reports on this page.' : 'No reports yet on this project. Reports you and other trades send show here.'}</p>}</section>}<div className="btn-row">{offset>0 && <button onClick={()=>setOffset(Math.max(0,offset-50))}>Newer reports</button>}{next!==null && <button onClick={()=>setOffset(next)}>Older reports</button>}</div></>}
      {view==='issues' && <><div className="eng-heading"><h1>Issues{scope==='all'?' · All projects':''}</h1><p>{scope==='all'?'Each issue group names its project.':'Showing issues only for the selected project.'}</p><div className="eng-actions"><button onClick={()=>navigate('defect')}>Flag a defect</button><Link className="eng-link-button" href={`/issues/snag-list?${new URLSearchParams({ project: projectId, ...(principal?.trade ? { trade: principal.trade } : {}), returnTo: engineerReturn('issues') })}`}>Snag list{principal?.trade ? ` · ${principal.trade}` : ''}</Link></div></div><div className="eng-issue-controls"><label htmlFor="eng-issue-scope">Project scope<select id="eng-issue-scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="current">{project.projectName}</option><option value="all">All projects</option></select></label><div><button disabled aria-describedby="eng-assignment-unavailable">Assigned to me · Coming soon</button><p id="eng-assignment-unavailable" className="eng-help">Issue owners are currently names or companies, not linked user accounts.</p></div></div>{issues===null ? !error && <p role="status">Loading issues…</p> : (scope==='all'?projects: [project]).map(p=><section className="eng-panel" key={p.id}><h2>{p.projectName}</h2><EngineerIssueList issues={issues.filter(i=>i.projectId===p.id)} projectName={p.projectName} returnTo={engineerReturn('issues')}/></section>)}</>}
      {view==='defect' && <IndividualDefect key={project.id} project={project} onIssues={()=>navigate('issues')} returnTo={engineerReturn('issues')}/>}
    </>}
  </main>;
}
