'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { projectIssues } from '@/lib/api';
import type { Issue } from '@/lib/types';
import { useProjects } from '@/components/ProjectContext';
import { usePrincipal } from '@/components/PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { mediaId } from '@/lib/media';
import { raisedPhoto, snagList, snagOwners } from '@/lib/snagList';
import { safeViewReturn, withViewReturn } from '@/lib/viewNavigation';
import './snag.css';

/**
 * A snag list for one project: the open issues a company or trade has to put
 * right, grouped by location, to hand over on paper or walk the site with on a
 * phone. It only reads the register. Ticking a box on paper records nothing;
 * work is marked done on each issue in RELAY, where the office verifies it.
 */

const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'] as const;
const LONDON = { timeZone: 'Europe/London' } as const;
const today = () => new Date().toLocaleDateString('en-CA', LONDON);
const fmtDate = (ymd: string) => /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { ...LONDON, day: 'numeric', month: 'short', year: 'numeric' }) : ymd;

/** Loaded eagerly, unlike the list thumbnails, so every photograph is there when the page prints. */
function Thumb({ src, alt }: { src: string; alt: string }) {
  return <img className="snag-photo" src={mediaId(src) ? `${src}?variant=thumb` : src} alt={alt} decoding="async" />;
}

export default function SnagListPage({ searchParams }: { searchParams: Promise<{ project?: string; owner?: string; trade?: string; photos?: string; returnTo?: string }> }) {
  const params = use(searchParams);
  const router = useRouter();
  const principal = usePrincipal();
  const projects = useProjects();
  const manager = principal ? canManage(principal) : false;
  const [projectId, setProjectId] = useState(projects.some(p => p.id === params.project) ? params.project! : '');
  const [owner, setOwner] = useState(params.owner ?? '');
  const [trade, setTrade] = useState(TRADES.some(t => t === params.trade) ? params.trade! : '');
  const [photos, setPhotos] = useState(params.photos !== 'off');
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const project = projects.find(p => p.id === projectId);
  const fallback = manager ? '/office#/issues' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}&view=issues` : '?view=issues'}`;
  const back = safeViewReturn(params.returnTo, fallback);

  useEffect(() => {
    if (!projectId) { setIssues(null); return; }
    let cancelled = false;
    setIssues(null); setError('');
    projectIssues(projectId).then(all => { if (!cancelled) setIssues(all); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'The issues could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the choices, so a list can be bookmarked or opened again on another device,
  // and an issue opened from the list comes back to the same list.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (owner) q.set('owner', owner);
  if (trade) q.set('trade', trade);
  if (!photos) q.set('photos', 'off');
  if (params.returnTo) q.set('returnTo', params.returnTo);
  const here = `/issues/snag-list${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const day = today();
  const owners = issues ? snagOwners(issues, projectId) : [];
  // An owner from a link who no longer holds open work stays selectable, so the list explains itself as empty.
  const ownerChoices = owner && !owners.includes(owner) ? [owner, ...owners] : owners;
  const list = issues ? snagList(issues, { projectId, owner, trade }, day) : null;
  const forWhom = [owner, trade && `${trade} work`].filter(Boolean).join(' · ') || 'Every company and trade';

  return <main className="eng-page snag-page">
    <Link href={back} className="back snag-noprint">&larr; Back to issues</Link>
    <div className="snag-controls snag-noprint" role="group" aria-label="Choose what the snag list shows">
      <label>Project<select value={projectId} onChange={e => { setProjectId(e.target.value); setOwner(''); }}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
      </select></label>
      <label>Company or person<select value={owner} onChange={e => setOwner(e.target.value)} disabled={!issues}>
        <option value="">Everyone</option>
        {ownerChoices.map(o => <option key={o} value={o}>{o}</option>)}
      </select></label>
      <label>Trade<select value={trade} onChange={e => setTrade(e.target.value)}>
        <option value="">All trades</option>
        {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
      </select></label>
      <label className="snag-check"><input type="checkbox" checked={photos} onChange={e => setPhotos(e.target.checked)} />Show photographs</label>
      <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!list?.total}>Print or save as PDF</button>
    </div>

    {!project ? <div className="eng-panel snag-noprint"><h1>Snag list</h1><p className="eng-help">Choose a project to list its open issues by location, ready to hand to a company or walk the site with.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !list ? <p role="status">Loading issues…</p>
      : <article className="snag-sheet" aria-labelledby="snag-title">
        <header className="snag-head">
          <p className="lbl">Leodis Developments · Snag list</p>
          <h1 id="snag-title">{project.projectName}</h1>
          <p className="snag-for">{forWhom}</p>
          <dl className="snag-facts">
            <div><dt>Project</dt><dd className="ref">{project.projectNumber}</dd></div>
            <div><dt>Client</dt><dd>{project.clientName || 'Not recorded'}</dd></div>
            <div><dt>Project manager</dt><dd>{project.projectManager || 'Not recorded'}</dd></div>
            <div><dt>Listed</dt><dd>{fmtDate(day)}</dd></div>
          </dl>
          <p className="snag-summary" role="status">
            <b>{list.total - list.fixed} to put right</b>
            {list.overdue > 0 && <> · <span className="late">{list.overdue} past target</span></>}
            {list.fixed > 0 && <> · {list.fixed} marked fixed, waiting for the office to check</>}
          </p>
        </header>
        {list.total === 0 ? <div className="eng-empty">Nothing open{owner || trade ? ' for this company or trade' : ''} on this project.</div>
          : list.groups.map(group => <section key={group.location} className="snag-group">
            <h2>{group.location}<span>{group.rows.length}</span></h2>
            <ol>
              {group.rows.map(({ issue, overdue, fixed }) => { const photo = photos ? raisedPhoto(issue) : undefined; return <li key={issue.id} className={`snag-item${fixed ? ' fixed' : ''}`}>
                <span className="snag-box" aria-hidden="true" />
                <div className="snag-body">
                  <p className="snag-ref"><Link href={withViewReturn(`/issues/${issue.id}`, here)} className="ref">{issue.reference}</Link>
                    {fixed && <span className="tag tag-sent">Fixed, to check</span>}
                    {overdue && <span className="tag tag-alert">Past target</span>}</p>
                  <p className="snag-desc">{issue.description}</p>
                  {issue.actionNeeded.trim() && <p className="snag-action"><b>To do:</b> {issue.actionNeeded}</p>}
                  <p className="snag-meta">{issue.owner.trim() || 'Not yet assigned'} · {issue.targetDate ? `target ${fmtDate(issue.targetDate)}` : 'no target date'}{issue.affectedTrade ? ` · ${issue.affectedTrade}` : ''}</p>
                </div>
                {photo && <Thumb src={photo.dataUrl} alt={photo.caption || `Photograph of ${issue.reference}`} />}
              </li>; })}
            </ol>
          </section>)}
        <footer className="snag-foot">
          <p>Tick each item as it is put right, then open the issue in RELAY and choose “Submit as complete” so the office can check it. This sheet is a working copy; RELAY keeps the record.</p>
          <div className="snag-sign"><span>Checked by</span><span>Signature</span><span>Date</span></div>
        </footer>
      </article>}
  </main>;
}
