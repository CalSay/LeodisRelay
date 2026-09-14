'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createReport, listReports, projectIssues, projectVariations } from '@/lib/api';
import type { FixtureProject } from '@/lib/fixtures';
import type { Issue, ReportSummary, Variation } from '@/lib/types';
import { usePrincipal } from './PrincipalContext';
import { ownsReport } from '@/lib/auth/access';
import { EngineerIssueList } from './EngineerIssueList';
import { IndividualDefect } from './IndividualDefect';
import { acknowledgementStatus, deliveryStatus, reviewStatus, toneClass } from '@/lib/status';
import { fmtMoney, variationValue } from '@/lib/variations';
import { projectStatusGroups } from '@/lib/projectGroups';

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
const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short' }) : '';

type View = 'home' | 'projects' | 'issues' | 'reports' | 'defect';
const viewOf = (value?:string):View => ['projects','issues','reports','defect'].includes(value ?? '') ? value as View : 'home';
interface Back { at: string; key: string; href: string; title: string; sub: string; tags: ReactNode; late?: boolean }

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
  const project = projects.find(p => p.id === projectId);
  const ownDrafts = drafts.filter(r => r.projectId === projectId);
  const currentDraft = ownDrafts[0];
  const preference = `relay-project:${principal?.id}`;

  useEffect(() => {
    if (!initialProject) {
      try { const saved = localStorage.getItem(preference); if(projects.some(p => p.id === saved))setProjectId(saved!); } catch {}
    }
    setReady(true);
  },[initialProject,preference,projects]);

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
        for (const r of page.reports) if (r.state === 'submitted' && ownsReport(principal,r)) rows.push({ at:r.serverAcknowledgedAt ?? r.lastSavedAt ?? '', key:r.id, href:`/reports/${r.id}`, title:`Site update ${r.reference.split('-').slice(1).join('-')}`, sub:`Sent ${fmtWhen(r.serverAcknowledgedAt)}`, tags:<ReportTags r={r}/>, late:r.review === 'returned' });
        for (const i of all) if (i.reportedById === principal.id || i.events[0]?.actorId === principal.id) rows.push({ at:i.events.at(-1)?.at ?? i.raisedAt, key:i.id, href:`/issues/${i.id}`, title:i.description, sub:`${i.reference.split('-').slice(1).join('-')} · ${i.location || 'no location'} · you raised it ${fmtDay(i.raisedAt)}`, tags:<IssueTags i={i}/>, late:i.confirmation === 'disputed' });
        for (const v of variations) if (v.raisedById === principal.id) rows.push({ at:v.events.at(-1)?.at ?? v.raisedAt, key:v.id, href:`/variations/${v.id}`, title:v.description, sub:`${v.reference.split('-').slice(1).join('-')} · ${v.location || 'no location'} · you raised it ${fmtDay(v.raisedAt)}`, tags:<VariationTags v={v}/>, late:v.workDone && v.instruction === 'pending' });
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
  async function startReport(add?: 'instruction') {
    if(!project || creating)return;
    if (currentDraft && add) { router.push(`/reports/${currentDraft.id}?add=${add}`); return; }
    setCreating(true);setError('');
    try {const report = await createReport(project.id,principal?.name ?? '');router.push(`/reports/${report.id}${add ? `?add=${add}` : ''}`);}
    catch(e){setError(e instanceof Error?e.message:'Unable to start a report. Please try again.');setCreating(false);}
  }
  const draftLink = (r:ReportSummary) => <Link key={r.id} href={`/reports/${r.id}`} className="eng-report-link"><span><strong>{r.reference}</strong><small>Visit {r.visitDate} · {r.observationCount} card{r.observationCount===1?'':'s'} · {r.photoCount} photographs</small></span><span>Continue →</span></Link>;

  return <main className="eng-workspace">
    {principal?.role !== 'Engineer' && <p className="eng-preview">Engineer layout preview · Signed in as {principal?.role}. Your permissions and report authorship are unchanged.</p>}
    <nav className="eng-navigation" aria-label="Site companion navigation">
      {([['home','Site'],['issues','Issues'],['reports','Reports'],['projects','Projects']] as const).map(([key,label]) => <button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}
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
              ? <Link className="eng-tile big" href={`/reports/${currentDraft.id}`}><span className="kind tone-neutral">Site update</span><div><b>{currentDraft.corrects ? 'Continue the correction' : 'Continue today’s update'}</b><small>{currentDraft.observationCount} card{currentDraft.observationCount===1?'':'s'} · saved {fmtWhen(currentDraft.lastSavedAt) || 'on server'}</small></div><span className="arrow">→</span></Link>
              : <button type="button" className="eng-tile big" onClick={()=>void startReport()} disabled={creating}><span className="kind tone-neutral">Site update</span><div><b>{creating?'Starting…':'Start a site update'}</b><small>Progress, defects, variations and access, one card at a time</small></div><span className="arrow">→</span></button>}
            <button type="button" className="eng-tile" onClick={()=>navigate('defect')}><span className="kind tone-defect">Defect</span><div><b>Flag a defect</b><small>Photo + a short note · sent on its own</small></div></button>
            <button type="button" className="eng-tile" onClick={()=>void startReport('instruction')} disabled={creating}><span className="kind tone-variation">Variation</span><div><b>Request a variation</b><small>Extra work needing instruction · goes in your site update</small></div></button>
          </div>
          <p className="eng-help">Defects flagged here are sent on their own. Everything else stays a draft until you sign and send.</p>
          {ownDrafts.length > 1 && <section className="eng-panel"><h2>Other drafts</h2>{ownDrafts.slice(1).map(draftLink)}</section>}
        </div><div>
          <div className="eng-section-title"><h2>Came back from the office</h2><span className="r">{back ? back.rows.length : '…'}</span></div>
          <div className="eng-list">
            {!back ? <div className="eng-empty">Checking with the office…</div>
              : back.rows.length ? back.rows.map(row => <Link key={row.key} href={row.href} className={`eng-row ${row.late ? 'late' : ''}`}><div className="main"><b>{row.title}</b><span>{row.sub}</span><div className="stat">{row.tags}</div></div><span className="chev">›</span></Link>)
              : <div className="eng-empty">Nothing on this project yet. Reports you send, defects you flag and variations you request show here with the office’s answer.</div>}
          </div>
          <div className="eng-section-title"><h2>This project</h2><span className="r">{back ? `${back.open} open issue${back.open===1?'':'s'}` : ''}</span></div>
          <div className="eng-list">
            <button type="button" className="eng-row" onClick={()=>navigate('issues')}><div className="main"><b>Site issues</b><span>{back ? `${back.open} open · every trade` : 'Every trade'}</span></div><span className="chev">›</span></button>
            <button type="button" className="eng-row" onClick={()=>navigate('reports')}><div className="main"><b>Latest reports</b><span>{back ? `${back.reports} on file · every trade` : 'Submitted updates from every trade'}</span></div><span className="chev">›</span></button>
          </div>
        </div></div>
      </>}
      {view==='projects' && <><div className="eng-heading"><h1>Choose your project</h1><p>All projects open to your role. Existing drafts stay with their original project.</p></div><div className="eng-project-groups">{projectStatusGroups(projects).map(group=><section key={group.status} className={`eng-project-group eng-project-group-${group.tone}`}><div className="eng-section-title"><h2>{group.label}</h2><span className="r">{group.projects.length}</span></div><div className="eng-project-list">{group.projects.map(p=><button key={p.id} className="eng-panel" onClick={()=>selectProject(p.id)} aria-pressed={p.id===projectId}><strong>{p.projectName}</strong><small>{p.projectNumber} · {p.projectManager}</small><span>{p.id===projectId?'Current project':'Select project →'}</span></button>)}</div></section>)}</div></>}
      {view==='reports' && <><div className="eng-heading"><h1>Reports · {project.projectName}</h1><p>Your drafts and submitted project reports from all trades.</p></div><button onClick={()=>void startReport()} disabled={creating}>{creating?'Starting…':'Start another site update'}</button>{reports===null ? !error && <p role="status">Loading reports…</p> : <section className="eng-panel">{reports.length ? reports.map(r=><Link className="eng-report-link" href={`/reports/${r.id}`} key={r.id}><span><strong>{r.reference}</strong><small>{r.author} · {r.authorTrade ?? 'Trade not recorded'} · {r.visitDate}</small></span><span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}><ReportTags r={r}/></span></Link>) : <p>No reports on this page.</p>}</section>}<div className="btn-row">{offset>0 && <button onClick={()=>setOffset(Math.max(0,offset-50))}>Newer reports</button>}{next!==null && <button onClick={()=>setOffset(next)}>Older reports</button>}</div></>}
      {view==='issues' && <><div className="eng-heading"><h1>Issues · {scope==='all'?'All projects':project.projectName}</h1><p>{scope==='all'?'Each issue group names its project.':'Showing issues only for the selected project.'}</p><button onClick={()=>navigate('defect')}>Flag a defect</button></div><div className="eng-issue-controls"><label htmlFor="eng-issue-scope">Project scope<select id="eng-issue-scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="current">{project.projectName}</option><option value="all">All projects</option></select></label><div><button disabled aria-describedby="eng-assignment-unavailable">Assigned to me · Coming soon</button><p id="eng-assignment-unavailable" className="eng-help">Issue owners are currently names or companies, not linked user accounts.</p></div></div>{issues===null ? !error && <p role="status">Loading issues…</p> : (scope==='all'?projects: [project]).map(p=><section className="eng-panel" key={p.id}><h2>{p.projectName}</h2><EngineerIssueList issues={issues.filter(i=>i.projectId===p.id)} projectName={p.projectName}/></section>)}</>}
      {view==='defect' && <IndividualDefect key={project.id} project={project} onIssues={()=>navigate('issues')}/>}
    </>}
  </main>;
}
