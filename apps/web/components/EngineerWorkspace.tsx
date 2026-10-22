'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, cameBack, cameBackElsewhere, createReport, getReport, listReports, projectIssues, yourOpenIssues } from '@/lib/api';
import { cameBackRows, issueWord, raisedIssue, reportWord, variationWord, waitingOnYouFirst, issueReopened, officeActed, officeOpened, type OfficeWord } from '@/lib/cameBack';
import { listHeld, type HeldDraft } from '@/lib/localDraft';
import { offlineProjectsKey } from '@/lib/offlineStart';
import { keepNotesOnDevice } from '@/lib/offlineNotes';
import { unfinishedReports, type UnfinishedReport } from '@/lib/unfinishedReports';
import type { FixtureProject } from '@/lib/fixtures';
import type { Issue, ReportSummary, Variation } from '@/lib/types';
import { usePrincipal } from './PrincipalContext';
import { waitingToSend } from '@/lib/sendOnSignal';
import { SafetyActionsRow } from './SafetyActionsRow';
import { ownsReport } from '@/lib/auth/access';
import { EngineerIssueList, WordLine, isOpen } from './EngineerIssueList';
import { yourIssues } from '@/lib/yourIssues';
import { IndividualDefect } from './IndividualDefect';
import { SinceLastVisit } from './SinceLastVisit';
import { SiteNotesRow } from './SiteNotesRow';
import { DeliveriesRow } from './DeliveriesRow';
import { ToolboxTalksRow } from './ToolboxTalksRow';
import { PermitsRow } from './PermitsRow';
import { PageTitle } from './PageTitle';
import { ISSUE_WORK, acknowledgementStatus, deliveryStatus, reviewStatus, toneClass } from '@/lib/status';
import { fmtMoney, variationValue } from '@/lib/variations';
import { projectStatusGroups } from '@/lib/projectGroups';
import { withViewReturn } from '@/lib/viewNavigation';
import { CHECKLIST_TYPES, INSPECTED_MAX, inspectedName, reportTypeOf, type ReportTypeDef, type ReportTypeId } from '@/lib/reportTypes';
import { useWhatsNew } from './useWhatsNew';
import { useFeatures } from './FeaturesContext';
import { isSafetyRecordType } from '@/lib/featureSwitch';
import { dateShort, dayShort, whenShort } from '@/lib/dates';
import { londonDay } from '@/lib/weeklySummary';

/**
 * The same words the office uses. A report is received when the server has
 * it, reviewed when a person decided, and seen when the office opened it.
 * Delivery shows here only when it went wrong or the project manager was
 * emailed: in the pilot every report said "PM not notified", which told the
 * engineer nothing new. The report's own page still shows every step, with
 * what to do when nobody has been emailed.
 */
function ReportTags({r}:{r:ReportSummary}) {
  if (r.state === 'draft') return <span className="tag tag-draft">{r.corrects ? 'Correction draft' : 'Your draft'}</span>;
  const review = reviewStatus(r), delivery = deliveryStatus(r), ack = acknowledgementStatus(r);
  return <>
    <span className="tag tag-sent">Received</span>
    {review && review.label !== 'No review required' && <span className={toneClass(review.tone)}>{review.label}</span>}
    {ack && r.acknowledged && <span className={toneClass(ack.tone)}>{ack.label}</span>}
    {delivery && (delivery.tone !== 'draft') && <span className={toneClass(delivery.tone)}>{delivery.label}</span>}
  </>;
}
function IssueTags({i}:{i:Issue}) {
  if (i.confirmation === 'withdrawn') return <span className="tag tag-draft">Withdrawn</span>;
  if (i.work === 'closed') return <span className="tag tag-sent">Closed</span>;
  return <><span className={`tag ${i.confirmation === 'disputed' ? 'tag-alert' : 'tag-draft'}`}>{ISSUE_WORK[i.work]}</span>{i.owner.trim() ? <span>{i.owner}{i.targetDate ? ` · target ${dateShort(i.targetDate, 'auto') || i.targetDate}` : ''}</span> : <span>not yet assigned</span>}</>;
}
/** The office's answer on a variation the engineer raised. */
export function VariationTags({v}:{v:Variation}) {
  if (v.instruction === 'instructed') return <><span className="tag tag-sent">Instructed</span><span>{v.instructionReference} · {fmtMoney(variationValue(v))}</span></>;
  if (v.instruction === 'declined') return <span className="tag tag-draft">Declined</span>;
  if (v.instruction === 'within_contract') return <><span className="tag tag-draft">Within contract</span><span>not charged</span></>;
  if (v.workDone) return <><span className="tag tag-alert">Done, not instructed</span><span>the office is getting the client’s sign-off</span></>;
  if (v.quotedValue !== undefined) return <><span className="tag tag-draft">Quoted {fmtMoney(v.quotedValue)}</span><span>awaiting the client</span></>;
  return <><span className="tag tag-draft">With the office</span><span>not yet priced</span></>;
}

const fmtWhen = (iso?: string) => whenShort(iso);
/** A visit day, with its year when it is not this year, since the list pages back through older reports. */
const fmtVisit = (day: string) => dayShort(day) || day;
const fmtDay = (iso?: string) => dayShort(iso);

type View = 'home' | 'projects' | 'issues' | 'reports' | 'defect';
/**
 * Which issues the Issues tab shows: "Yours" (every site, what is the engineer's
 * to see to, lib/yourIssues.ts), or a project's open or all issues. Kept in the
 * address with the project choice, so Back from an issue comes back to the same list.
 */
type IssueShow = 'yours' | 'open' | 'all';
const ISSUE_SHOWS: [IssueShow, string][] = [['yours','Yours'],['open','Open'],['all','All issues']];
const showOf = (value?:string):IssueShow => value === 'open' || value === 'all' ? value : 'yours';
const viewOf = (value?:string):View => ['projects','issues','reports','defect'].includes(value ?? '') ? value as View : 'home';
const VIEW_TITLES: Record<View, string> = { home: 'Site', projects: 'Projects', issues: 'Issues', reports: 'Reports', defect: 'Flag a defect' };
/** `office`: the office has done something on it, so it counts in the section's number; the engineer's own new records are listed, not counted. */
interface Back { at: string; key: string; href: string; title: string; sub: string; tags: ReactNode; late?: boolean; word?: OfficeWord; sentBack?: boolean; office?: boolean }

/** Where an unfinished report stands, in words an engineer can act on. */
function UnfinishedTags({r,waiting=false}:{r:UnfinishedReport;waiting?:boolean}) {
  if (waiting && !r.signed && !r.started) return <><span className="tag tag-caution">Not sent yet</span><span>no signal when you tapped Send · open it with signal and it goes to the office</span></>;
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

export function EngineerWorkspace({projects,drafts,initialProject,initialView,initialShow,initialScope}: {
  projects:FixtureProject[]; drafts:ReportSummary[]; initialProject?:string; initialView?:string; initialShow?:string; initialScope?:string;
}) {
  const principal = usePrincipal();
  const router = useRouter();
  const [projectId,setProjectId] = useState(projects.find(p => p.id === initialProject)?.id ?? drafts[0]?.projectId ?? projects[0]?.id ?? '');
  const [view,setView] = useState<View>(viewOf(initialView));
  const [ready,setReady] = useState(false);
  const [scope,setScope] = useState(initialScope === 'all' ? 'all' : 'current');
  const [show,setShow] = useState<IssueShow>(showOf(initialShow));
  // Where the list comes from: the engineer's own on every site, every project, or this one.
  const sourceOf = (s: IssueShow, sc: string) => s === 'yours' ? 'yours' : sc === 'all' ? 'all' : 'one';
  const issueSource = sourceOf(show, scope);
  const [reports,setReports] = useState<ReportSummary[] | null>(null);
  const [issues,setIssues] = useState<Issue[] | null>(null);
  // `failed`: the office could not be asked (no signal), so there are no counts to show, not zero.
  /** Reports sent with no signal on this phone, still to go (lib/sendOnSignal.ts). Read after the first render, as the server cannot know. */
  const [waiting,setWaiting] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => { if (principal) setWaiting(new Set(waitingToSend(principal.id))); }, [principal]);
  const [back,setBack] = useState<{ rows: Back[]; open: number; reports: number; failed?: boolean; offline?: boolean } | null>(null);
  const [error,setError] = useState('');
  const [creating,setCreating] = useState(false);
  const [offset,setOffset] = useState(0);
  const [next,setNext] = useState<number | null>(null);
  const [retry,setRetry] = useState(0);
  const [held,setHeld] = useState<{ copies: HeldDraft[]; deviceOnly: Set<string> }>({ copies: [], deviceOnly: new Set() });
  const project = projects.find(p => p.id === projectId);
  const ownDrafts = drafts.filter(r => r.projectId === projectId);
  // Today's site update (or a correction) in progress, and any inspection in
  // progress, kept apart so "Request a variation" never lands on an
  // inspection's checklist. An update left from an earlier day is not
  // "today's": it waits under Unfinished reports, and the big button starts
  // today's, so today's cards never go on yesterday's visit.
  const today = londonDay(new Date());
  const currentDraft = ownDrafts.find(r => reportTypeOf(r).id === 'progress' && (!!r.corrects || r.visitDate === today));
  // The safety, permits and deliveries records only while the office has them on (lib/featureSwitch.ts).
  const { safetyRecords } = useFeatures();
  // One tile per checklist type: carry on with its draft, or start one. The safety and
  // tower inspections are behind the office's switch; a draft of one already started
  // still shows, so work is never stranded.
  const inspections = CHECKLIST_TYPES.map(type => ({ type, draft: ownDrafts.find(r => reportTypeOf(r).id === type.id) }))
    .filter(({ type, draft }) => safetyRecords || draft || !isSafetyRecordType(type.id));
  const preference = `relay-project:${principal?.id}`;
  const engineerReturn = (target: View = 'home') => `/engineer?project=${encodeURIComponent(projectId)}${target === 'home' ? '' : `&view=${target}`}${target === 'issues' ? `${show === 'yours' ? '' : `&show=${show}`}${show !== 'yours' && scope === 'all' ? '&scope=all' : ''}` : ''}`;

  // `firstChoice`: a first day on this phone, with more than one site and nothing
  // started, so the engineer picks their site rather than being put on the first
  // in the list, where their first update could go to the wrong site.
  // Asked once, on arrival: a refresh after held work is sent must not bring it back.
  // RELAY used on this phone before (it keeps the sites for no signal) or
  // work waiting to send means it is not a first day.
  const [firstChoice,setFirstChoice] = useState(false);
  const arrived = useRef(false);
  useEffect(() => {
    if (!initialProject) {
      let saved: string | null = null, usedBefore = false;
      try { saved = localStorage.getItem(preference); usedBefore = !!principal && localStorage.getItem(offlineProjectsKey(principal.id)) !== null; } catch { usedBefore = true; }
      if (projects.some(p => p.id === saved)) setProjectId(saved!);
      else if (!arrived.current && !initialView && !drafts.length && projects.length > 1 && !usedBefore && !(principal && waitingToSend(principal.id).length)) { setFirstChoice(true); setView('projects'); }
    }
    arrived.current = true;
    setReady(true);
  },[initialProject,preference,projects]);
  // The offline page offers these when a report is started with no signal (offlineStart.ts).
  useEffect(() => {
    if (!principal) return;
    try { localStorage.setItem(offlineProjectsKey(principal.id),JSON.stringify(projects.map(p => ({ id:p.id, projectNumber:p.projectNumber, projectName:p.projectName })))); } catch {}
    // And the open notes for the next visit on those projects, to read with no signal (offlineNotes.ts).
    void keepNotesOnDevice(principal.id);
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
  const { count: newToYou, newcomer } = useWhatsNew('site');
  // A draft the big buttons above already open is not listed again, unless
  // the list has something to say about it (held on the phone, refused, signed).
  // Today's update waiting to send says so on its big button, so is not listed again.
  const onTiles = new Set([currentDraft?.id, ...inspections.map(i => i.draft?.id)].filter(Boolean));
  const unfinished = unfinishedReports(drafts, held.copies, projects, held.deviceOnly)
    .filter(r => !onTiles.has(r.id) || r.problem || r.signed || (r.device && !(waiting.has(r.id) && r.id === currentDraft?.id)));

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
      // "Yours" asks the server for this engineer's issues only, so a busy site's other trades are not downloaded.
      const targets = scope === 'all' ? projects : projects.filter(p => p.id === projectId);
      (show === 'yours' ? yourOpenIssues() : Promise.all(targets.map(p => projectIssues(p.id))).then(groups => groups.flat())).then(all => {
        if(!cancelled)setIssues(all);
      }).catch(e => {if(!cancelled)setError(e instanceof Error?e.message:'Unable to load issues.');});
    }
    // What came back from the office on the things this engineer raised, in the office's words.
    if(view === 'home' && principal) {
      setBack(null);
      // Only the few records the rows need, not every issue and variation on the project.
      // Other sites' answers are extra: the current site's rows show as soon as they come, and stay if the other sites cannot be asked.
      const away = cameBackElsewhere(projectId).catch(() => null);
      Promise.all([listReports(projectId,0),cameBack(projectId)]).then(([page,{ issues:all, variations, open }]) => {
        if(cancelled)return;
        const returnTo = engineerReturn();
        // `site`: the project name, on rows from a site other than the one the engineer is at.
        const reportRow = (r:ReportSummary, corrected:boolean, site?:string):Back => ({ at:r.serverAcknowledgedAt ?? r.lastSavedAt ?? '', key:r.id, href:withViewReturn(`/reports/${r.id}`,returnTo), title:`${reportTypeOf(r).name} ${r.reference.split("-").slice(1).join("-")}`, sub:`${site ? `${site} · ` : ''}Sent ${fmtWhen(r.serverAcknowledgedAt)}`, tags:<ReportTags r={r}/>, late:r.review === 'returned', sentBack:r.review === 'returned' && !corrected, word:reportWord(r,corrected), office:officeOpened(r) });
        const issueRow = (i:Issue, site?:string):Back => ({ at:i.events.at(-1)?.at ?? i.raisedAt, key:i.id, href:withViewReturn(`/issues/${i.id}?update=1`,returnTo), title:i.description, sub:`${site ? `${site} · ` : ''}${i.reference.split('-').slice(1).join('-')} · ${i.location || 'no location'}${site ? '' : ` · you raised it ${fmtDay(i.raisedAt)}`}`, tags:<IssueTags i={i}/>, late:i.confirmation === 'disputed', sentBack:i.confirmation === 'disputed' || issueReopened(i.events,principal), word:issueWord(i.events,principal), office:officeActed(i.events,principal) });
        const variationRow = (v:Variation, site?:string):Back => ({ at:v.events.at(-1)?.at ?? v.raisedAt, key:v.id, href:withViewReturn(`/variations/${v.id}`,returnTo), title:v.description, sub:`${site ? `${site} · ` : ''}${v.reference.split('-').slice(1).join('-')} · ${v.location || 'no location'}${site ? '' : ` · you raised it ${fmtDay(v.raisedAt)}`}`, tags:<VariationTags v={v}/>, late:v.workDone && v.instruction === 'pending', word:variationWord(v.events,principal), office:officeActed(v.events,principal) });
        const here:Back[] = [];
        for (const r of page.reports) if (r.state === 'submitted' && ownsReport(principal,r)) here.push(reportRow(r,page.reports.some(c => c.corrects === r.id)));
        for (const i of all) if (raisedIssue(i,principal.id)) here.push(issueRow(i));
        for (const v of variations) if (v.raisedById === principal.id) here.push(variationRow(v));
        here.sort(waitingOnYouFirst);
        const reports = page.reports.filter(r => r.state === 'submitted').length;
        setBack({ rows:cameBackRows(here,[]), open, reports });
        const siteName = (id:string) => projects.find(p => p.id === id)?.projectName;
        void away.then(elsewhere => {
          if (cancelled || !elsewhere) return;
          const there:Back[] = [];
          for (const r of elsewhere.reports) { const site = siteName(r.projectId); if (site) there.push(reportRow(r,false,site)); }
          for (const i of elsewhere.issues) { const site = siteName(i.projectId); if (site) there.push(issueRow(i,site)); }
          for (const v of elsewhere.variations) { const site = siteName(v.projectId); if (site) there.push(variationRow(v,site)); }
          there.sort(waitingOnYouFirst);
          if (there.length) setBack({ rows:cameBackRows(here,there), open, reports });
        });
      }).catch(e => { if(!cancelled) setBack({ rows:[], open:0, reports:0, failed:true, offline:e instanceof ApiError && e.offline }); });
    }
    return () => {cancelled=true;};
  },[view,projectId,issueSource,offset,retry,ready,projects,principal]);

  // A change between one project and every site clears the list at once, so it never shows the old one while the new one loads.
  function pickIssues(nextShow:IssueShow, nextScope = scope) {
    if (sourceOf(nextShow, nextScope) !== issueSource) setIssues(null);
    setShow(nextShow);setScope(nextScope);
  }
  // The Issues tab opens on Yours; the home's "Site issues" row, which counts every trade on this project, opens Open.
  function navigate(to:View, issueShow:IssueShow = 'yours') {
    if (to==='issues' && sourceOf(issueShow, 'current') !== issueSource) setIssues(null);
    setView(to);setOffset(0);setError('');if(to==='issues'){setScope('current');setShow(issueShow);}
  }
  function selectProject(id:string) {
    setFirstChoice(false);setProjectId(id);setOffset(0);setScope('current');setView('home');
    try{localStorage.setItem(preference,id);}catch{}
  }
  // A new site update opens on its first card, a progress card, rather than a picker: the kind can be changed on the card.
  async function startReport(add?: 'instruction' | 'update', type: ReportTypeId = 'progress', inspected?: string) {
    if(!project || creating)return;
    if (currentDraft && add === 'instruction') { router.push(withViewReturn(`/reports/${currentDraft.id}?add=${add}`,engineerReturn(view))); return; }
    setCreating(true);setError('');
    try {const report = await createReport(project.id,principal?.name ?? '',type,inspected);router.push(withViewReturn(`/reports/${report.id}${add ? `?add=${add}` : ''}`,engineerReturn(view)));}
    catch(e){setError(e instanceof Error?e.message:'Unable to start a report. Please try again.');setCreating(false);}
  }

  // Counted in the heading: rows the office has done something on, not the engineer's own records just sent.
  const fromOffice = back && !back.failed ? back.rows.filter(r => r.office).length : 0;
  // One row on the home screen for a page about the current project.
  const projectPage = (path: string, title: string, note: string) => <Link className="eng-row" href={`${path}?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}><div className="main"><b>{title}</b><span>{note}</span></div><span className="chev">›</span></Link>;

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
        <div className="eng-heading eng-heading-home"><p className="lbl">On site</p><h1>{principal?.name}</h1><p>{principal?.trade ? `${principal.trade} engineer` : principal?.role} · {fmtDay(new Date().toISOString())}</p></div>
        <div className="eng-home-grid"><div>
          <section className="eng-band"><span className="lbl">Current project</span><h2>{project.projectName}</h2><p><span className="ref" style={{color:'inherit'}}>{project.projectNumber}</span> · {project.projectManager}, project manager · <button type="button" onClick={()=>navigate('projects')}>Change ›</button></p></section>
          {/* The job: a site update with photographs, issues and variations, sent to the office. One big button, then the two quick ones. */}
          <div className="eng-tiles eng-tiles-main">
            {currentDraft
              ? <Link className="eng-tile big eng-tile-main" href={withViewReturn(`/reports/${currentDraft.id}`,engineerReturn())}><div>{waiting.has(currentDraft.id)
                ? <><b>{currentDraft.corrects ? 'Send the correction' : 'Send today’s update'}</b><small>Not sent yet: there was no signal when you tapped Send. Open it with signal and it goes to the office.</small></>
                : <><b>{currentDraft.corrects ? 'Carry on with the correction' : 'Carry on with today’s update'}</b><small>{currentDraft.observationCount} card{currentDraft.observationCount===1?'':'s'} · saved {fmtWhen(currentDraft.lastSavedAt) || 'on server'}</small></>}</div><span className="arrow" aria-hidden="true">→</span></Link>
              : <button type="button" className="eng-tile big eng-tile-main" onClick={()=>void startReport('update')} disabled={creating}><div><b>{creating?'Starting…':'Start today’s site update'}</b><small>Progress, photographs, defects and variations, then sign and send to the office</small></div><span className="arrow" aria-hidden="true">→</span></button>}
            <button type="button" className="eng-tile" onClick={()=>navigate('defect')}><span className="kind tone-defect">Defect</span><div><b>Flag a defect</b><small>Photo and a short note, sent straight away</small></div></button>
            <button type="button" className="eng-tile" onClick={()=>void startReport('instruction')} disabled={creating}><span className="kind tone-variation">Variation</span><div><b>Request a variation</b><small>Extra work that needs an instruction</small></div></button>
          </div>
          {unfinished.length > 0 && <section aria-labelledby="eng-unfinished-title">
            <div className="eng-section-title"><h2 id="eng-unfinished-title">Unfinished reports</h2><span className="r">{unfinished.length}</span></div>
            <div className="eng-list">
              {unfinished.map(r => r.started ? <a key={r.id} href="/offline.html" className="eng-row late"><div className="main"><b>New {r.typeName.toLowerCase()} · {r.projectName}</b><span>No reference yet · visit {fmtDay(r.visitDate)} · {r.checklist ? `${r.cards} checks` : `${r.cards} card${r.cards===1?'':'s'}`}</span><div className="stat"><UnfinishedTags r={r} waiting={waiting.has(r.id)}/></div></div><span className="chev">›</span></a> : <Link key={r.id} href={withViewReturn(`/reports/${r.id}`,engineerReturn())} className={`eng-row ${r.device ? 'late' : ''}`}><div className="main"><b>{r.correction ? 'Correction' : r.typeName} · {r.projectName}</b><span>{r.reference.split('-').slice(1).join('-')} · visit {fmtDay(r.visitDate)} · {r.checklist ? `${r.cards} checks` : `${r.cards} card${r.cards===1?'':'s'}`}</span><div className="stat"><UnfinishedTags r={r} waiting={waiting.has(r.id)}/></div></div><span className="chev">›</span></Link>)}
            </div>
          </section>}
          {/* Straight under the main buttons, above Inspections, so on a phone the office's answer is on the first screen. */}
          <section className="eng-came-back" aria-labelledby="eng-came-back-title">
            <div className="eng-section-title"><h2 id="eng-came-back-title">Came back from the office</h2><span className="r">{back && !back.failed ? (fromOffice ? `${fromOffice} from the office` : '') : back ? '' : '…'}</span></div>
            <div className="eng-list">
              {!back ? <div className="eng-empty">Checking with the office…</div>
                : back.failed ? <div className="eng-empty">{back.offline ? 'No signal, so RELAY cannot check with the office just now.' : 'RELAY could not check with the office just now.'} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>
                : back.rows.length ? back.rows.map(row => <Link key={row.key} href={row.href} className={`eng-row ${row.late ? 'late' : ''}`}><div className="main"><b>{row.title}</b><span>{row.sub}</span>{row.word && <WordLine word={row.word}/>}<div className="stat">{row.tags}</div></div><span className="chev">›</span></Link>)
                : <div className="eng-empty">Nothing on this project yet. Reports you send, defects you flag and variations you request show here with the office’s answer.</div>}
            </div>
          </section>
          <section aria-labelledby="eng-inspections-title" className="eng-inspections">
            <div className="eng-section-title"><h2 id="eng-inspections-title">Inspections</h2></div>
            <p className="eng-section-note">A walk round one area with a checklist, signed and sent as its own report.</p>
            <div className="eng-tiles">
              {inspections.map(({ type, draft }) => draft
                ? <Link key={type.id} className="eng-tile eng-tile-wide" href={withViewReturn(`/reports/${draft.id}`,engineerReturn())}><span className="kind answer-ok">{type.tag}</span><div><b>{draft.corrects ? `Carry on with the ${type.name.toLowerCase()} correction` : `Carry on with the ${type.name.toLowerCase()}`}{draft.inspected ? ` of ${draft.inspected}` : ''}</b><small>{draft.checks ? `${draft.checks.ok + draft.checks.action + draft.checks.na} of ${draft.observationCount} checks answered` : `${draft.observationCount} checks`} · saved {fmtWhen(draft.lastSavedAt) || 'on server'}</small></div><span className="arrow" aria-hidden="true">→</span></Link>
                : type.inspects ? <NameThenStart key={type.id} type={type} creating={creating} onStart={name=>void startReport(undefined,type.id,name)} />
                : <button key={type.id} type="button" className="eng-tile eng-tile-wide" onClick={()=>void startReport(undefined,type.id)} disabled={creating}><span className="kind answer-ok">{type.tag}</span><div><b>Do a {type.name.toLowerCase()}</b><small>{type.blurb}</small></div><span className="arrow" aria-hidden="true">→</span></button>)}
            </div>
          </section>
        </div><div>
          <SinceLastVisit key={project.id} projectId={project.id} returnTo={engineerReturn()}/>
          <section aria-labelledby="eng-project-title">
            <div className="eng-section-title"><h2 id="eng-project-title">This project</h2><span className="r">{back && !back.failed ? `${back.open} open issue${back.open===1?'':'s'}` : ''}</span></div>
            <div className="eng-list">
              <button type="button" className="eng-row" onClick={()=>navigate('issues','open')}><div className="main"><b>Site issues</b><span>{back && !back.failed ? `${back.open} open · every trade` : 'Every trade'}</span></div><span className="chev">›</span></button>
              <button type="button" className="eng-row" onClick={()=>navigate('reports')}><div className="main"><b>Reports</b><span>{back && !back.failed ? `${back.reports} on file · every trade` : 'Sent by every trade'}</span></div><span className="chev">›</span></button>
              <SiteNotesRow key={projectId} projectId={projectId} href={`/site-notes?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}/>
              {projectPage('/photos','Photographs','Every photograph, by location')}
            </div>
            <details className="eng-more-pages">
              <summary>More on this project<span>Weekly summary, site diary, before handover, issues over time</span></summary>
              <div className="eng-list">
                {projectPage('/weekly-summary','Weekly summary','The week on one page, for the site meeting')}
                {projectPage('/diary','Site diary','Every visit, day by day')}
                {projectPage('/handover','Before handover','Everything still open, on one page')}
                {projectPage('/issue-trend','Issues over time','Raised, closed and still open, week by week')}
              </div>
            </details>
            {safetyRecords && <div role="group" aria-labelledby="eng-project-safety">
              <h3 id="eng-project-safety" className="eng-group-title">Safety, permits and deliveries</h3>
              <div className="eng-list">
                <SafetyActionsRow key={projectId} projectId={projectId} href={`/safety-actions?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}/>
                <ToolboxTalksRow key={`tt-${projectId}`} projectId={projectId} href={`/toolbox-talks?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}/>
                <PermitsRow key={`pt-${projectId}`} projectId={projectId} href={`/permits?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}/>
                <DeliveriesRow key={`dl-${projectId}`} projectId={projectId} href={`/deliveries?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('home') })}`}/>
              </div>
            </div>}
          </section>
          <section aria-labelledby="eng-you-title">
            <div className="eng-section-title"><h2 id="eng-you-title">Your week and help</h2></div>
            <div className="eng-list">
              <Link className="eng-row" href={`/my-week?${new URLSearchParams({ returnTo: engineerReturn() })}`}><div className="main"><b>My week</b><span>Your days on every project, ready for a timesheet</span></div><span className="chev">›</span></Link>
              <Link className="eng-row" href={`/help?${new URLSearchParams({ for: 'site', returnTo: engineerReturn() })}`}><div className="main"><b>How RELAY works and what’s new</b><span>What to tap, and what happens after you send</span>{newcomer ? <div className="stat"><span className="tag tag-draft">Start here</span></div> : newToYou > 0 && <div className="stat"><span className="tag tag-draft">{newToYou} new to you</span></div>}</div><span className="chev">›</span></Link>
            </div>
          </section>
        </div></div>
      </>}
      {view==='projects' && <>{firstChoice ? <div className="eng-heading"><p className="lbl">Welcome to RELAY</p><h1>Which site are you on?</h1><p>Tap your site. RELAY remembers it on this phone, and you can change it any time under Projects.</p></div> : <div className="eng-heading"><h1>Choose your project</h1><p>Pick the site you are on. Anything you have started stays with its own project.</p></div>}<div className="eng-project-groups">{projectStatusGroups(projects).map(group=><section key={group.status} className={`eng-project-group eng-project-group-${group.tone}`}><div className="eng-section-title"><h2>{group.label}</h2><span className="r">{group.projects.length}</span></div><div className="eng-project-list">{group.projects.map(p=><button key={p.id} className="eng-panel" onClick={()=>selectProject(p.id)} aria-pressed={p.id===projectId && !firstChoice}><strong>{p.projectName}</strong><small>{p.projectNumber} · {p.projectManager}</small><span>{p.id===projectId && !firstChoice?'Current project':'Select project →'}</span></button>)}</div></section>)}</div></>}
      {view==='reports' && <><div className="eng-heading"><h1>Reports</h1><p>Your drafts and the reports every trade has sent on this project.</p></div><div className="eng-actions"><button onClick={()=>void startReport('update')} disabled={creating}>{creating?'Starting…':'Start another site update'}</button></div><nav className="eng-more" aria-label="More from these reports"><span className="lbl">Also on this project</span><div><Link className="eng-link-button" href={`/diary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Site diary</Link><Link className="eng-link-button" href={`/weekly-summary?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Weekly summary</Link><Link className="eng-link-button" href={`/photos?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Photographs</Link>{safetyRecords && <Link className="eng-link-button" href={`/safety-actions?${new URLSearchParams({ project: projectId, returnTo: engineerReturn('reports') })}`}>Safety actions</Link>}<Link className="eng-link-button" href={`/my-week?${new URLSearchParams({ returnTo: engineerReturn('reports') })}`}>My week</Link></div></nav>{reports===null ? !error && <p role="status">Loading reports…</p> : <section className="eng-panel">{reports.length ? reports.map(r=><Link className="eng-report-link" href={withViewReturn(`/reports/${r.id}`,engineerReturn('reports'))} key={r.id}><span><strong>{r.reference}</strong><small>{r.author} · {r.authorTrade ?? 'Trade not recorded'} · visit {fmtVisit(r.visitDate)}</small></span><span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}><ReportTags r={r}/></span></Link>) : <p className="eng-empty">{offset ? 'No reports on this page.' : 'No reports yet on this project. Reports you and other trades send show here.'}</p>}</section>}<div className="btn-row">{offset>0 && <button onClick={()=>setOffset(Math.max(0,offset-50))}>Newer reports</button>}{next!==null && <button onClick={()=>setOffset(next)}>Older reports</button>}</div></>}
      {view==='issues' && <><div className="eng-heading"><h1>Issues{show!=='yours'&&scope==='all'?' · All projects':''}</h1><p>{show==='yours'?`On every site you work on: issues you raised or added to${principal?.trade ? `, or for your trade (${principal.trade})` : ''}, still to do.`:scope==='all'?'Each issue group names its project.':'Issues on this project, from every trade.'}</p><div className="eng-actions"><button onClick={()=>navigate('defect')}>Flag a defect</button><Link className="eng-link-button" href={`/issues/snag-list?${new URLSearchParams({ project: projectId, ...(principal?.trade ? { trade: principal.trade } : {}), returnTo: engineerReturn('issues') })}`}>Snag list{principal?.trade ? ` · ${principal.trade}` : ''}</Link></div></div>
        <div className="eng-issue-tabs" role="group" aria-label="Which issues to show">{ISSUE_SHOWS.map(([id,label])=><button key={id} type="button" aria-pressed={show===id} onClick={()=>pickIssues(id)}>{label}</button>)}</div>
        {show!=='yours' && <div className="eng-issue-controls"><label htmlFor="eng-issue-scope">Show<select id="eng-issue-scope" value={scope} onChange={e=>pickIssues(show,e.target.value)}><option value="current">This project: {project.projectName}</option><option value="all">All projects</option></select></label></div>}
        {issues===null ? !error && <p role="status">Loading issues…</p>
          : show==='yours' ? <YourIssues projects={projects} issues={issues} projectId={projectId} returnTo={engineerReturn('issues')} onAll={()=>pickIssues('all','all')}/>
          : (scope==='all'?projects:[project]).map(p=>{const here=issues.filter(i=>i.projectId===p.id);const rows=(show==='open'?here.filter(isOpen):here).map(issue=>({issue}));return <section className="eng-panel" key={p.id}><h2>{p.projectName}</h2><EngineerIssueList rows={rows} empty={show==='open'?'No open issues on this project.':'No issues have been raised on this project.'} returnTo={engineerReturn('issues')}/></section>;})}</>}
      {view==='defect' && <IndividualDefect key={project.id} project={project} onIssues={()=>navigate('issues','open')} onSite={()=>navigate('home')} returnTo={engineerReturn('issues')}/>}
    </>}
  </main>;
}

/**
 * "Yours" on the Issues tab: a section per site with something still to do for
 * this engineer, the site they are on first. Put forward as fixed is counted, not
 * listed, as it waits on the office. Never quietly empty: it says so, with one
 * tap to every issue.
 */
function YourIssues({projects,issues,projectId,returnTo,onAll}:{projects:FixtureProject[];issues:Issue[];projectId:string;returnTo:string;onAll:()=>void}) {
  const principal = usePrincipal();
  if (!principal) return null;
  const sites = [...projects].sort((a,b) => Number(b.id === projectId) - Number(a.id === projectId))
    .map(p => ({ p, ...yourIssues(issues.filter(i => i.projectId === p.id), principal) }))
    .filter(s => s.toDo.length || s.waiting);
  const waitingLine = (n:number) => `${n} put forward as fixed, waiting for the office to check`;
  if (!sites.length) return <section className="eng-panel eng-yours-empty"><p className="eng-help">Nothing open for you on {projects.length === 1 ? 'this site' : `any of your ${projects.length} sites`}. Issues you raise{principal.trade ? ', or that are for your trade,' : ''} show here until they are fixed.</p><button type="button" onClick={onAll}>See all issues</button></section>;
  return <>{sites.map(({p,toDo,waiting}) => <section className="eng-panel" key={p.id} aria-labelledby={`yours-${p.id}`}>
    <h2 id={`yours-${p.id}`}>{p.projectName}{' '}<span className="eng-yours-count">{toDo.length} to do</span></h2>
    {waiting > 0 && <p className="eng-help eng-yours-waiting">{waitingLine(waiting)}</p>}
    <EngineerIssueList rows={toDo} empty={waiting ? '' : 'Nothing left to do here.'} returnTo={returnTo}/>
  </section>)}</>;
}

/**
 * The home screen tile for an inspection of one thing (a tower inspection):
 * it asks which tower before starting, so the inspection is about that one
 * from its first save. Free text, as the engineer reads it off the tag.
 */
function NameThenStart({ type, creating, onStart }: { type: ReportTypeDef; creating: boolean; onStart: (name: string) => void }) {
  const [open,setOpen] = useState(false);
  const [name,setName] = useState('');
  const [problem,setProblem] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  // Focus moves into the form when it opens, and back to the tile on Cancel.
  const moved = useRef(false);
  const about = type.inspects!;
  useEffect(() => { if (open) input.current?.focus(); else if (moved.current) opener.current?.focus(); moved.current = true; }, [open]);
  if (!open) return <button ref={opener} type="button" className="eng-tile eng-tile-wide" onClick={()=>setOpen(true)} disabled={creating} aria-expanded={false}><span className="kind answer-ok">{type.tag}</span><div><b>Do a {type.name.toLowerCase()}</b><small>{type.blurb}</small></div><span className="arrow" aria-hidden="true">→</span></button>;
  function start(e: React.FormEvent) {
    e.preventDefault();
    const named = inspectedName(type, name);
    if (!named.ok) { setProblem(named.reason); input.current?.focus(); return; }
    setProblem(''); onStart(named.value!);
  }
  return <form className="eng-tile eng-tile-wide eng-tile-form" onSubmit={start} aria-label={`Start a ${type.name.toLowerCase()}`}>
    <span className="kind answer-ok">{type.tag}</span>
    <div>
      <label htmlFor={`inspects-${type.id}`}><b>Which {about.label.toLowerCase()}?</b></label>
      <input ref={input} id={`inspects-${type.id}`} type="text" value={name} maxLength={INSPECTED_MAX} autoComplete="off" placeholder={about.placeholder}
        aria-describedby={`inspects-${type.id}-hint`} aria-invalid={problem ? true : undefined} onChange={e=>{setName(e.target.value);setProblem('');}} />
      <small id={`inspects-${type.id}-hint`}>{problem ? <span role="alert" className="eng-tile-problem">{problem}</span> : about.hint}</small>
      <div className="btn-row">
        <button type="submit" className="btn-primary" disabled={creating}>{creating ? 'Starting…' : `Start the ${type.name.toLowerCase()}`}</button>
        <button type="button" onClick={()=>{setOpen(false);setName('');setProblem('');}} disabled={creating}>Cancel</button>
      </div>
    </div>
  </form>;
}
