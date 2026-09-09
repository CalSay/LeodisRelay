'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { usePrincipal } from '@/components/PrincipalContext';
import { Toasts, parseHash, useHashRoute } from '@/components/workspace/hooks';
import { allIssues, officeAll, officeTeam, type OfficeTeam } from '@/lib/api';
import { canAccessProject, isAdmin } from '@/lib/auth/access';
import { FIXTURE_PROJECTS } from '@/lib/fixtures';
import type { Issue } from '@/lib/types';
import type { Ctx, Route } from './ctx';
import { Dialogs, type Dialog } from './Dialogs';
import { attention, isActive, isOverdue, projectStats, shortRef, today, type Snapshot } from './model';
import { ProjectsView } from './ProjectsView';
import { InboxView } from './InboxView';
import { IssuesView } from './IssuesView';
import { AdminView, TeamView } from './TeamAdmin';
import { Btn, BtnQ } from './bits';

const REPORTABLE = ['4. Active', '5. Defects Liability'];

/**
 * The Developments office: one workspace for Managers and Admins.
 *
 * Projects › Register › Details is the spine; Inbox and Issues are the flat
 * registers across projects; Team is the roster as the office can know it;
 * Admin is a tab, Admin role only. Every record shown here comes from the
 * report and issue endpoints the engineer side writes to, and every action
 * here is a command the server already enforces.
 */
export function OfficeDesk({ fallback }: { fallback: string }) {
  const principal = usePrincipal();
  const { hash, go } = useHashRoute(fallback);
  const parts = parseHash(hash);
  const route: Route = { tab: parts[0] ?? 'projects', a: parts[1] ?? null, b: parts[2] ?? null, c: parts[3] ?? null };

  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [team, setTeam] = useState<OfficeTeam | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [q, setQ] = useState('');
  const [attnOpen, setAttnOpen] = useState(false);
  const generation = useRef(0);

  // Every page before any total: a page is never presented as the portfolio.
  const refresh = useCallback(async () => {
    const g = ++generation.current;
    try {
      const [{ reports, drafts }, issues] = await Promise.all([officeAll(), allIssues()]);
      if (g !== generation.current) return;
      setSnap({ reports, drafts, issues, loadedAt: new Date().toISOString() });
      setError('');
    } catch (e) {
      if (g === generation.current) setError(e instanceof Error ? e.message : 'Unable to refresh office records.');
    }
  }, []);
  // The first load always happens, even in a background tab; only the repeats
  // wait for the tab to be looked at.
  useEffect(() => {
    let stopped = false; let first = true; let timer: ReturnType<typeof setTimeout>;
    async function poll() { if (first || document.visibilityState === 'visible') { first = false; await refresh(); } if (!stopped) timer = setTimeout(poll, 15000); }
    void poll();
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); generation.current++; };
  }, [refresh]);
  const loadTeam = useCallback(() => { officeTeam().then(setTeam).catch(() => setTeam(null)); }, []);
  useEffect(() => { if ((route.tab === 'team' || route.tab === 'admin') && !team) loadTeam(); }, [route.tab, team, loadTeam]);
  useEffect(() => { setAttnOpen(false); setQ(''); }, [hash]);

  const day = today();
  const projects = useMemo(() => FIXTURE_PROJECTS.filter(p => principal && canAccessProject(principal, p.id) && REPORTABLE.includes(p.status)), [principal]);
  const stats = useMemo(() => snap ? projects.map(p => projectStats(p, snap, day)) : [], [snap, projects, day]);
  const statOf = useCallback((code: string) => stats.find(s => s.code === code), [stats]);
  const attn = useMemo(() => attention(stats, day), [stats, day]);
  const me = { id: principal?.id ?? '', name: principal?.name ?? '', role: principal?.role ?? '', admin: principal ? isAdmin(principal) : false };
  const ctx: Ctx = { snap, day, projects, stats, statOf, route, go, setDialog, refresh, me, team, loadTeam };

  const onRootClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement; const a = el.closest('a[href^="#/"]');
    if (a && !e.ctrlKey && !e.metaKey) { e.preventDefault(); go(a.getAttribute('href')!); return; }
    if (attnOpen && !el.closest('.attn-pop') && !el.closest('.bell')) setAttnOpen(false);
  };

  const openIssues = snap ? snap.issues.filter(isActive) : [];
  const overdue = openIssues.filter(i => isOverdue(i, day)).length;
  const tabs: [string, string, number | null, boolean][] = [
    ['projects', 'Projects', projects.length, false],
    ['inbox', 'Inbox', snap ? snap.reports.length : null, stats.some(s => s.failed.length > 0 || s.pendingReview.length > 0)],
    ['issues', 'Issues', snap ? openIssues.length : null, overdue > 0],
    ['team', 'Team', team ? team.members.length : null, false],
  ];
  const results = q.trim().length >= 2 ? search(q, ctx) : [];

  return <div className="ws" onClick={onRootClick}>
    <header className="topbar">
      <a className="logo" href="#/projects" aria-label="Projects"><b>RELAY</b><span>LEODIS DEVELOPMENTS</span></a>
      <div className="search">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects, reports, issues, engineers" autoComplete="off" aria-label="Search" />
        <kbd>/</kbd>
        {q.trim() !== '' && <div className="results">{results.length ? results.map(r => <a key={r.key} href={r.go}><span className="ref">{r.ref}</span><span>{r.t}</span><span className="k">{r.k}</span></a>) : <div className="none">Nothing matches “{q}”.</div>}</div>}
      </div>
      <div className="topbar-right">
        <button type="button" className={`bell ${attn.length ? '' : 'quiet'}`} onClick={() => setAttnOpen(o => !o)} aria-expanded={attnOpen}>Attention <b>{attn.length}</b></button>
        <form action="/api/auth/signout" method="POST" style={{ display: 'inline' }}><button type="submit" className="whoami" title="Sign out">{me.name} · <em>{me.role}</em></button></form>
        <ThemeToggle />
        <button type="button" className="tbtn" onClick={() => setDialog({ kind: 'help' })}>Help</button>
        <Link className="tbtn" href="/engineer">Engineer view</Link>
        <Link className="tbtn" href="/">Companies</Link>
      </div>
      {attnOpen && <div className="attn-pop">
        <div className="panel-head"><h4 style={{ color: attn.length ? 'var(--alert)' : 'var(--ok)' }}>Needs attention</h4><a className="more" href="#/issues">Issues →</a></div>
        {attn.length ? attn.map(i => <div key={i.key} className="mini">
          <div className="mini-b"><a href={i.go}><b>{i.title}</b></a><div className="rowsub">{i.sub}</div><div style={{ marginTop: 6 }}><span className={`tag ${i.tag.cls}`}>{i.tag.label}</span></div></div>
          {i.action && (i.action.kind === 'review' && i.action.report ? <BtnQ className="btn-sm" onClick={() => setDialog({ kind: 'review', report: i.action!.report! })}>Review</BtnQ>
            : i.action.issue ? (i.action.primary ? <Btn className="btn-sm" onClick={() => setDialog(dialogFor(i.action!.kind, i.action!.issue!, ctx))}>{i.action.label}</Btn> : <BtnQ className="btn-sm" onClick={() => setDialog(dialogFor(i.action!.kind, i.action!.issue!, ctx))}>{i.action.label}</BtnQ>) : null)}
        </div>) : <div className="empty">Nothing needs attention.</div>}
      </div>}
    </header>
    <nav className="hnav">
      {tabs.map(([k, l, n, warn]) => <a key={k} href={`#/${k}`} className={route.tab === k ? 'on' : ''}>{l}{n !== null && <i className={warn ? 'warn' : ''}>{n}</i>}</a>)}
      {me.admin && <a href="#/admin" className={`adm ${route.tab === 'admin' ? 'on' : ''}`}>Admin</a>}
    </nav>
    {error && <div className="note bad" style={{ margin: '12px 24px 0' }} role="alert"><span>{error} {snap ? 'Showing previously loaded records.' : ''}</span><BtnQ className="btn-sm" onClick={() => void refresh()}>Retry</BtnQ></div>}
    {route.tab === 'inbox' ? <InboxView ctx={ctx} /> : route.tab === 'issues' ? <IssuesView ctx={ctx} /> : route.tab === 'team' ? <TeamView ctx={ctx} /> : route.tab === 'admin' ? <AdminView ctx={ctx} /> : <ProjectsView ctx={ctx} />}
    {dialog && <Dialogs d={dialog} close={() => setDialog(null)} done={() => { void refresh(); if (route.tab === 'team' || route.tab === 'admin') loadTeam(); }} />}
    <Toasts />
  </div>;
}

export function dialogFor(kind: string, issue: Issue, ctx: Ctx): Dialog {
  const owners = [...new Set(ctx.snap?.issues.filter(i => i.projectId === issue.projectId).map(i => i.owner.trim()).filter(Boolean) ?? [])].sort();
  if (kind === 'assign') return { kind: 'assign', issue, owners };
  if (kind === 'verify') return { kind: 'verify', issue };
  if (kind === 'confirm') return { kind: 'confirm', issue };
  return { kind: 'triage', issue };
}

interface Hit { key: string; ref: string; t: string; k: string; go: string }
function search(raw: string, ctx: Ctx): Hit[] {
  const q = raw.trim().toLowerCase(); const out: Hit[] = [];
  for (const s of ctx.stats) {
    const p = s.project;
    if (`${p.projectName} ${p.projectNumber} ${p.projectManager} ${p.clientName}`.toLowerCase().includes(q)) out.push({ key: p.id, ref: p.projectNumber, t: p.projectName, k: 'project', go: `#/projects/${s.code}` });
  }
  for (const s of ctx.stats) for (const r of s.reports) {
    if (`${r.reference} ${r.author} ${r.authorTrade ?? ''} ${r.visitDate}`.toLowerCase().includes(q)) out.push({ key: r.id, ref: r.reference, t: `${r.author} · ${s.project.projectName}`, k: 'report', go: `#/projects/${s.code}/report/${r.id}` });
  }
  for (const s of ctx.stats) for (const i of s.issues) {
    if (`${i.reference} ${i.description} ${i.location} ${i.owner} ${i.affectedTrade ?? ''}`.toLowerCase().includes(q)) out.push({ key: i.id, ref: shortRef(i.reference), t: `${i.description} · ${s.project.projectName}`, k: 'issue', go: `#/projects/${s.code}/issue/${i.id}` });
  }
  return out.slice(0, 12);
}
