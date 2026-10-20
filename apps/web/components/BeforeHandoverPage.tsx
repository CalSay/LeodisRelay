'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { dayLabel } from '@/lib/myWeek';
import { londonDay } from '@/lib/weeklySummary';
import type { BeforeHandover, HandoverIssue } from '@/lib/beforeHandover';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';

/**
 * Before handover: everything RELAY still has open on one project, on one
 * page, to work through or print as a job nears completion. It reads what is
 * already recorded and changes nothing.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Section({ id, title, count, children }: { id: string; title: string; count: string; children: ReactNode }) {
  return <section className="ho-section" id={id} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>{title}<span>{count}</span></h2>
    {children}
  </section>;
}

function IssueRows({ rows, here, fixed = false, trade = false }: { rows: HandoverIssue[]; here: string; fixed?: boolean; trade?: boolean }) {
  return <ul className="ho-rows">{rows.map(i => <li key={i.id} className={i.overdue ? 'ho-late' : ''}>
    <p className="ho-tags"><Link className="ref" href={withViewReturn(`/issues/${i.id}`, here)}>{i.reference}</Link>
      {i.overdue && <span className="tag tag-alert">Past target {dayLabel(i.targetDate)}</span>}
      {!i.overdue && i.targetDate && !fixed && <span className="tag tag-draft">Target {dayLabel(i.targetDate)}</span>}
      {i.disputed && <span className="tag tag-alert">Disputed</span>}</p>
    <p className="ho-desc">{i.description || 'No description'}</p>
    <p className="ho-meta">{[i.location || 'No location recorded', fixed ? (i.fixedBy ? `put forward as fixed by ${i.fixedBy}` : 'put forward as fixed') : (i.owner || 'Not yet assigned'), trade ? (i.trade ?? 'Trade not recorded') : ''].filter(Boolean).join(' · ')}
      {i.inspection && <> · from <Link className="ref" href={withViewReturn(`/reports/${i.inspection.id}`, here)}>{i.inspection.reference}</Link></>}</p>
  </li>)}</ul>;
}

export function BeforeHandoverPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const router = useRouter();
  const today = londonDay(new Date());
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<BeforeHandover | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/before-handover?${new URLSearchParams({ projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as BeforeHandover & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The list could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The list could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the project, so a record opened from here comes back to it.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/handover${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const d = data?.projectId === projectId ? data : null;
  const snagHref = (trade: string) => `/issues/snag-list?${new URLSearchParams({ project: projectId, trade, returnTo: here })}`;
  const stat = (href: string, label: string, n: number, note: string, tone = '') =>
    <a href={href} className={`ho-stat ${n ? tone : 'ho-stat-clear'}`}><span className="ho-stat-label">{label}</span><span className="ho-stat-n">{n}</span><small>{note}</small></a>;

  return <main className="eng-page ho-page">
    <Link href={back} className="back ho-noprint">&larr; {backLabel(back)}</Link>
    <div className="ho-controls ho-noprint">
      <label htmlFor="ho-project">Project</label>
      <select id="ho-project" value={projectId} onChange={e => setProjectId(e.target.value)}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
      <button type="button" className="btn-primary" onClick={() => window.print()} disabled={!d}>Print or save as PDF</button>
    </div>

    {!project ? <div className="eng-panel ho-noprint"><h1>Before handover</h1><p className="eng-help">Choose a project to see everything RELAY still has open on it, in one place: snags on our work, fixes waiting to be checked, handover inspections, other trades&rsquo; issues, variations not yet settled and safety actions.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !d ? <p role="status">Loading what is still open…</p>
      : <article className="ho-sheet" aria-labelledby="ho-title">
        <header className="ho-head">
          <p className="lbl">Before handover · {project.projectNumber}</p>
          <h1 id="ho-title">{project.projectName}</h1>
          <p className={`ho-verdict ${d.totals.outstanding ? 'ho-verdict-open' : 'ho-verdict-clear'}`} role="status">
            {d.totals.outstanding
              ? <>{plural(d.totals.outstanding, 'thing')} still open in RELAY{d.totals.overdue ? <>, <b>{d.totals.overdue} past target</b></> : ''}.</>
              : <>Nothing is open in RELAY on this project.</>}
            {d.inspections.length === 0 && <> No handover inspection has been sent yet.</>}
          </p>
          <p className="ho-sub">As of {dayLabel(today, true)}{project.projectManager ? ` · ${project.projectManager}, project manager` : ''}</p>
        </header>

        <nav className="ho-stats" aria-label="Jump to a list">
          {stat('#ho-ours', 'Our snags', d.totals.ours, 'to put right', 'ho-stat-alert')}
          {stat('#ho-check', 'Waiting to be checked', d.totals.toCheck, 'fixed, not yet closed', 'ho-stat-due')}
          {stat('#ho-others', 'Other trades', d.totals.others, 'open on the list', 'ho-stat-due')}
          {stat('#ho-variations', 'Variations', d.totals.variations, d.totals.workDone ? `${d.totals.workDone} done, not instructed` : 'not yet instructed', d.totals.workDone ? 'ho-stat-alert' : 'ho-stat-due')}
          {stat('#ho-safety', 'Safety actions', d.totals.safety, d.safetyInspected ? 'still open' : 'no inspection yet', 'ho-stat-alert')}
        </nav>

        <Section id="ho-ours" title="Snags on our work" count={d.totals.ours ? `${d.totals.ours} open` : 'none open'}>
          {d.ours.length ? d.ours.map(g => <div key={g.trade} className="ho-group">
            <h3>{g.trade}<span>{g.issues.length}</span><Link className="ho-noprint" href={snagHref(g.trade)}>Snag list to print</Link></h3>
            <IssueRows rows={g.issues} here={here} />
          </div>) : <p className="ho-none">No open snags on Electrical, HVAC or P&amp;H work.</p>}
        </Section>

        <Section id="ho-check" title="Fixed, waiting to be checked" count={d.toCheck.length ? String(d.toCheck.length) : 'none'}>
          {d.toCheck.length ? <><p className="ho-note">Put forward as fixed. Each needs someone other than the person who fixed it to check it and close it.</p><IssueRows rows={d.toCheck} here={here} fixed trade /></>
            : <p className="ho-none">Nothing is waiting to be checked.</p>}
        </Section>

        <Section id="ho-inspections" title="Handover inspections" count={d.inspections.length ? plural(d.inspections.length, 'sent', 'sent') : 'none sent'}>
          {d.inspections.length ? <ul className="ho-rows">{d.inspections.map(r => <li key={r.id} className={r.stillOpen ? 'ho-late' : ''}>
            <p className="ho-tags"><Link className="ref" href={withViewReturn(`/reports/${r.id}`, here)}>{r.reference}</Link>{r.revision > 1 && <span className="tag tag-draft">Rev {r.revision}</span>}
              {r.stillOpen ? <span className="tag tag-alert">{plural(r.stillOpen, 'action')} still open</span> : <span className="tag tag-sent">{r.raised ? 'Every action closed' : 'No actions'}</span>}</p>
            <p className="ho-desc">{dayLabel(r.visitDate)} · {r.author}</p>
            <p className="ho-meta">{r.checks.ok} satisfactory, {plural(r.checks.action, 'action')}, {r.checks.na} not applicable{r.raised ? ` · ${r.raised - r.stillOpen} of ${r.raised} closed` : ''}{r.waiting ? `, ${r.waiting} fixed and waiting to be checked` : ''}</p>
            {r.locations.length > 0 && <p className="ho-meta">Actions at {r.locations.join(' · ')}</p>}
          </li>)}</ul>
            : <p className="ho-none">No handover inspection has been sent from this project yet. An engineer starts one from <b>Do a handover inspection</b> on the Site page; each &ldquo;Action needed&rdquo; goes on the snag list.</p>}
        </Section>

        <Section id="ho-others" title="Other trades and not recorded" count={d.others.length ? String(d.others.length) : 'none'}>
          {d.others.length ? <><p className="ho-note">Open issues on another firm&rsquo;s work, or where nobody recorded whose work it is. Not ours to fix, but still on the list.</p><IssueRows rows={d.others} here={here} trade /></>
            : <p className="ho-none">No open issues on other trades&rsquo; work.</p>}
        </Section>

        <Section id="ho-variations" title="Variations not yet settled" count={d.variations.length ? String(d.variations.length) : 'none'}>
          {d.variations.length ? <ul className="ho-rows">{d.variations.map(v => <li key={v.id} className={v.workDone ? 'ho-late' : ''}>
            <p className="ho-tags"><Link className="ref" href={withViewReturn(`/variations/${v.id}`, here)}>{v.reference}</Link>
              {v.workDone ? <span className="tag tag-alert">Done, not instructed</span> : <span className="tag tag-draft">Awaiting instruction</span>}
              {!v.quoted && <span className="tag tag-draft">Not yet priced</span>}</p>
            <p className="ho-desc">{v.description || 'No description'}</p>
            {v.location && <p className="ho-meta">{v.location}</p>}
          </li>)}</ul> : <p className="ho-none">Every variation has been instructed or declined.</p>}
        </Section>

        <Section id="ho-safety" title="Safety actions still open" count={d.safety.length ? String(d.safety.length) : 'none'}>
          {d.safety.length ? <ul className="ho-rows">{d.safety.map(a => <li key={a.key} className="ho-late">
            <p className="ho-tags"><Link className="ref" href={withViewReturn(`/reports/${a.latest.id}`, here)}>{a.latest.reference}</Link><span className="tag tag-alert">Open {a.days > 0 ? plural(a.days, 'day') : 'since today'}</span></p>
            <p className="ho-desc">{a.question}</p>
            <p className="ho-meta">{[a.actionNeeded || a.found, a.location, a.who].filter(Boolean).join(' · ')}</p>
          </li>)}</ul> : <p className="ho-none">{d.safetyInspected ? 'The last safety inspection left nothing open.' : 'No safety inspection has been sent from this project yet.'}</p>}
        </Section>

        <footer className="ho-foot">
          <p>Made from the issue and variation registers and the inspections sent in RELAY, as of {dayLabel(today, true)}. Nothing here is typed in or changed. It covers only what is in RELAY: drawings, test certificates, O&amp;M manuals and the client&rsquo;s own snag list are not.</p>
        </footer>
      </article>}
  </main>;
}
