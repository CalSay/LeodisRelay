'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createReport, listReports, projectIssues } from '@/lib/api';
import type { FixtureProject } from '@/lib/fixtures';
import type { Issue, ReportSummary } from '@/lib/types';
import { usePrincipal } from './PrincipalContext';
import { ownsReport } from '@/lib/auth/access';
import {EngineerIssueList} from './EngineerIssueList';
import {IndividualDefect} from './IndividualDefect';
import {deliveryStatus,reviewStatus,toneClass} from '@/lib/status';

/**
 * The same words the office uses. A report is received when the server has
 * it, reviewed when a person decided, and delivered when the email went; an
 * engineer who can only see "Received" assumes the project manager has it.
 */
function ReportTags({r}:{r:ReportSummary}) {
  if (r.state === 'draft') return <span className="tag tag-draft">{r.corrects ? 'Correction draft' : 'Your draft'}</span>;
  const review = reviewStatus(r), delivery = deliveryStatus(r);
  return <span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
    <span className="tag tag-sent">Received</span>
    {review && review.label !== 'No review required' && <span className={toneClass(review.tone)}>{review.label}</span>}
    {delivery && <span className={toneClass(delivery.tone)}>{delivery.label}</span>}
  </span>;
}

type View = 'home' | 'projects' | 'issues' | 'reports' | 'defect';
const viewOf = (value?:string):View => ['projects','issues','reports','defect'].includes(value ?? '') ? value as View : 'home';

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
    return () => {cancelled=true;};
  },[view,projectId,scope,offset,retry,ready,projects,principal]);

  function navigate(to:View) {setView(to);setOffset(0);setError('');if(to==='issues')setScope('current');}
  function selectProject(id:string) {
    setProjectId(id);setOffset(0);setScope('current');setView('home');
    try{localStorage.setItem(preference,id);}catch{}
  }
  async function startReport() {
    if(!project || creating)return;
    setCreating(true);setError('');
    try {const report = await createReport(project.id,principal?.name ?? '');router.push(`/reports/${report.id}`);}
    catch(e){setError(e instanceof Error?e.message:'Unable to start a report. Please try again.');setCreating(false);}
  }
  const draftLink = (r:ReportSummary) => <Link key={r.id} href={`/reports/${r.id}`} className="eng-report-link"><span><strong>{r.reference}</strong><small>Visit {r.visitDate} · {r.observationCount} section{r.observationCount===1?'':'s'} · {r.photoCount} photographs</small></span><span>Continue →</span></Link>;

  return <main className="eng-workspace">
    {principal?.role !== 'Engineer' && <p className="eng-preview">Engineer layout preview · Signed in as {principal?.role}. Your permissions and report authorship are unchanged.</p>}
    <nav className="eng-navigation" aria-label="Site companion navigation">
      {([['home','Site home'],['projects','Projects'],['issues','Issues'],['reports','Reports']] as const).map(([key,label]) => <button key={key} type="button" aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{label}</button>)}
    </nav>
    {!ready ? <p role="status">Loading your workspace…</p> : !project ? <div className="empty">No projects are currently open to you for reporting.</div> : <>
      {view!=='home' && view!=='projects' && <div className="eng-project-context"><div><small>CURRENT PROJECT</small><strong>{project.projectName}</strong></div></div>}
      {error && <div className="note note-bad" role="alert">{error} <button onClick={()=>{setError('');setRetry(n=>n+1);}}>Retry</button></div>}
      {view==='home' && <>
        <div className="eng-heading"><p className="lbl">Your site companion</p><h1>On site today</h1><p>{principal?.name} · {principal?.trade ? `${principal.trade} Engineer` : principal?.role}</p></div>
        <div className="eng-home-grid"><div>
          <section className="eng-hero"><p className="lbl">Current project</p><h2>{project.projectName}</h2><p>{project.projectNumber} · {project.projectManager}, project manager</p></section>
          {currentDraft ? <Link className="eng-primary" href={`/reports/${currentDraft.id}`}>Continue site update</Link> : <button className="eng-primary" onClick={startReport} disabled={creating}>{creating?'Starting…':'Start a site update'}</button>}
          <div className="eng-action-pair"><button className="eng-action-tile" onClick={()=>navigate('defect')}><strong>Flag a defect</strong><small>Photo + a short note · Send individually</small></button><button className="eng-action-tile" onClick={()=>navigate('issues')}><strong>Site issues</strong><small>{project.projectName}<br/>All project issues</small></button></div>
          <p className="eng-help">Defects are sent individually. Your site update stays a draft until you send it.</p>
        </div><div>
          <div className="eng-section-title"><h2>Continue your visit</h2><span className="tag tag-draft">Your drafts</span></div>
          <section className="eng-panel">{ownDrafts.length ? ownDrafts.map(draftLink) : <p className="eng-help">No saved drafts for this project. Start a site update to begin.</p>}<p className="eng-help">Add sections inside your report. Draft contents stay private until submitted.</p></section>
          <h2>Project information</h2><section className="eng-panel"><button className="eng-info-link" onClick={()=>navigate('reports')}><span><strong>Latest site reports</strong><small>Submitted updates from every trade</small></span><span>Open →</span></button><div className="eng-unavailable"><button disabled><strong>Team & contacts</strong><small>Coming soon</small></button></div><div className="eng-unavailable"><button disabled><strong>Project documents</strong><small>Coming soon</small></button></div></section>
        </div></div>
      </>}
      {view==='projects' && <><div className="eng-heading"><h1>Choose your project</h1><p>All projects open to your role. Existing drafts stay with their original project.</p></div><div className="eng-project-list">{projects.map(p=><button key={p.id} className="eng-panel" onClick={()=>selectProject(p.id)} aria-pressed={p.id===projectId}><strong>{p.projectName}</strong><small>{p.projectNumber} · {p.projectManager}</small><span>{p.id===projectId?'Current project':'Select project →'}</span></button>)}</div></>}
      {view==='reports' && <><div className="eng-heading"><h1>Reports · {project.projectName}</h1><p>Your drafts and submitted project reports from all trades.</p></div><button onClick={startReport} disabled={creating}>{creating?'Starting…':'Start another site update'}</button>{reports===null ? !error && <p role="status">Loading reports…</p> : <section className="eng-panel">{reports.length ? reports.map(r=><Link className="eng-report-link" href={`/reports/${r.id}`} key={r.id}><span><strong>{r.reference}</strong><small>{r.author} · {r.authorTrade ?? 'Trade not recorded'} · {r.visitDate}</small></span><ReportTags r={r}/></Link>) : <p>No reports on this page.</p>}</section>}<div className="btn-row">{offset>0 && <button onClick={()=>setOffset(Math.max(0,offset-50))}>Newer reports</button>}{next!==null && <button onClick={()=>setOffset(next)}>Older reports</button>}</div></>}
      {view==='issues' && <><div className="eng-heading"><h1>Issues · {scope==='all'?'All projects':project.projectName}</h1><p>{scope==='all'?'Each issue group names its project.':'Showing issues only for the selected project.'}</p><button onClick={()=>navigate('defect')}>Flag a defect</button></div><div className="eng-issue-controls"><label htmlFor="eng-issue-scope">Project scope<select id="eng-issue-scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="current">{project.projectName}</option><option value="all">All projects</option></select></label><div><button disabled aria-describedby="eng-assignment-unavailable">Assigned to me · Coming soon</button><p id="eng-assignment-unavailable" className="eng-help">Issue owners are currently names or companies, not linked user accounts.</p></div></div>{issues===null ? !error && <p role="status">Loading issues…</p> : (scope==='all'?projects: [project]).map(p=><section className="eng-panel" key={p.id}><h2>{p.projectName}</h2><EngineerIssueList issues={issues.filter(i=>i.projectId===p.id)} projectName={p.projectName}/></section>)}</>}
      {view==='defect' && <IndividualDefect key={project.id} project={project} onIssues={()=>navigate('issues')}/>}
    </>}
  </main>;
}
