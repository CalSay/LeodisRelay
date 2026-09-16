'use client';
import { useState } from 'react';
import { SharePointStatus } from '@/components/SharePointStatus';
import type { TeamMember } from '@/lib/api';
import { InstallRelay } from '@/components/InstallRelay';
import { toast } from '@/components/workspace/hooks';
import type { Ctx } from './ctx';
import { BtnQ, Tag } from './bits';
import { fmtWhen } from './model';
import { Mark } from './marks';
import './admin.css';

const ROLE_WORDS: Record<string, string> = { Admin: 'Everything, plus the Admin tab', Manager: 'Office, all projects', Engineer: 'Own drafts, submitted reports, issues' };
const sees = (m: TeamMember) => ROLE_WORDS[m.assignment.split('.')[0] ?? ''] ?? 'Not known until they sign in';
const ROLE_LABEL: Record<string, string> = { 'Engineer.Electrical': 'Engineer · Electrical', 'Engineer.HVAC': 'Engineer · HVAC', 'Engineer.PH': 'Engineer · P&H' };
const ROSTER_FOOT = 'This is the assignment checklist against current sessions; it is not the Microsoft directory and it does not keep sign-in history, so "no session" means nobody is signed in on that account now. A role change takes effect at the next sign-in, within 12 hours. Nothing on this screen grants access.';

/** The roster reconciled with sessions. Read-only: roles are set in Microsoft. */
function RosterTable({ members, note }: { members: TeamMember[] | null; note?: string }) {
  const groups: [string, (m: TeamMember) => boolean][] = [['Admin', m => m.assignment === 'Admin'], ['Managers', m => m.assignment === 'Manager'], ['Engineers', m => m.assignment.startsWith('Engineer')], ['Signed in, not on the checklist', m => !m.onChecklist]];
  return <div className="panel"><div className="panel-head"><h4>Team assignment checklist</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>{note ?? 'Set in Microsoft; the app only reads the role at sign-in'}</span></div>
    <table className="reg"><thead><tr><th>Account</th><th>Microsoft app role</th><th>Sees</th><th>Signed in since</th><th>Session</th></tr></thead><tbody>
      {!members && <tr><td colSpan={5} className="loading" style={{ minHeight: 0, padding: 24 }}>Loading the roster</td></tr>}
      {(members ?? []).length === 0 && members && <tr><td colSpan={5} className="empty">Nobody on the checklist and nobody signed in.</td></tr>}
      {groups.map(([label, pick]) => { const rows = (members ?? []).filter(m => pick(m) && (label !== 'Engineers' || m.onChecklist) && (label === 'Signed in, not on the checklist' || m.onChecklist)); if (!rows.length) return null; return [
        <tr key={`g-${label}`}><td colSpan={5} style={{ background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 16px' }}>{label} · {rows.length}</td></tr>,
        ...rows.map(m => <tr key={m.email}><td><div className="rowtitle" style={{ fontSize: 13 }}>{m.name ?? m.email.split('@')[0]}</div><div className="rowsub num">{m.email}</div></td><td>{m.assignment}{m.role && m.assignment.split('.')[0] !== m.role && <div className="rowsub">signed in as {m.role}</div>}</td><td style={{ fontSize: 12 }}>{sees(m)}</td><td className="due">{m.lastSignedIn ? fmtWhen(m.lastSignedIn) : <span className="fine">—</span>}</td><td>{m.session === 'active' ? <Tag label="Signed in" cls="tag-ok" /> : m.session === 'expired' ? <Tag label="Expired" cls="tag-quiet" /> : <Tag label="No session" cls="tag-quiet" />}</td></tr>),
      ]; })}
    </tbody></table>
    <div className="panel-foot">{ROSTER_FOOT}</div></div>;
}

export function TeamView({ ctx }: { ctx: Ctx }) {
  const team = ctx.team;
  return <div className="view">
    <div className="pagehead"><div><h3>Team</h3><p>{team ? `${team.members.length} accounts · ${team.members.filter(m => m.session === 'active').length} signed in now · ${team.members.filter(m => m.session !== 'active').length} without a current session` : 'Loading the roster'}</p></div></div>
    <RosterTable members={team?.members ?? null} />
    <p className="rowsub">Issue owners are names or companies typed on site, not these accounts, so this list is who can sign in rather than who owns work.</p>
  </div>;
}

type Section = 'roles' | 'drafts' | 'delivery' | 'help';
export function AdminView({ ctx }: { ctx: Ctx }) {
  const section: Section = (['roles', 'drafts', 'delivery', 'help'] as Section[]).includes(ctx.route.a as Section) ? ctx.route.a as Section : 'roles';
  const team = ctx.team;
  if (!ctx.me.admin) return <div className="view"><div className="pagehead"><div><h3>Administration</h3><p>Admin role only</p></div></div><div className="empty">Administration is for the Admin role. Managers see the Team tab.</div></div>;
  const legacy = team?.legacyDrafts ?? [];
  const processing = team?.processing;
  const failedJobs = (processing?.jobs ?? []).filter(j => j.status === 'failed').reduce((n, j) => n + j.count, 0);
  const nav: [Section, string, string, string][] = [
    ['roles', 'People', team ? String(team.members.length) : '', ''],
    ['drafts', 'Older drafts', team ? String(legacy.length) : '', legacy.length ? `${legacy.length} need an owner` : ''],
    ['delivery', 'Processing and SharePoint', '', failedJobs ? `${failedJobs} job${failedJobs === 1 ? '' : 's'} failed` : ''],
    ['help', 'Install and help', '', ''],
  ];
  return <div className="ro-ad">
    <nav className="col" aria-label="Administration">
      <div className="col-head"><h4>Administration</h4><i>Admin only</i></div>
      <div className="ro-ad-scroll">
        <div className="ro-ad-nav">{nav.map(([key, label, count, warn]) => <a key={key} href={`#/admin/${key}`} className="ro-ad-navbtn" aria-current={section === key ? 'page' : undefined}>
          <span>{label}{warn && <small>{warn}</small>}</span>{count && <span className={`ro-ad-count ${key === 'drafts' && legacy.length ? 'amber' : ''}`}>{count}</span>}</a>)}</div>
        <div className="ro-ad-access"><div className="ro-ad-sec">Access</div>
          <p>Relay never grants access. Roles are checked against Microsoft Entra at sign-in.</p>
          <a href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Open Microsoft Entra ↗</a></div>
      </div>
    </nav>
    {section === 'roles' && <People ctx={ctx} />}
    {section === 'drafts' && <LegacyDrafts ctx={ctx} />}
    {section === 'delivery' && <SharePointStatus processing={processing} onRefresh={ctx.loadTeam}>
      <div><h5 className="ro-ad-h">Notifications waiting · {processing ? processing.outbox.length : '…'}</h5>
        <p className="ro-ad-hint">Emails telling the project manager a report came in.</p>
        {processing ? processing.outbox.length ? <div className="ro-ad-rows">{processing.outbox.map(o => { const project = ctx.projects.find(p => p.id === o.projectId); const failed = o.delivery === 'failed'; return <a key={o.id} className={`ro-ad-job ${failed ? 'failed' : ''}`} href={`#/projects/${project?.id ?? ''}/report/${o.id}`}>
          <Mark kind={failed ? 'urgent' : 'none'} label={failed ? 'Processing failed' : 'PM not notified'} />
          <span className="ro-ad-jb"><b className="ro-ad-mono">{o.reference}</b><small>{project?.projectName ?? o.projectId}{o.since ? ` · received ${fmtWhen(o.since)}` : ''} · {failed ? 'Processing failed' : 'PM not notified'}</small>{failed && o.error && <span className="ro-ad-err">{o.error}</span>}</span>
          <span className="ro-ad-link">Open ›</span></a>; })}</div> : <p className="ro-ad-hint">Nothing is waiting.</p> : <div className="loading" style={{ minHeight: 80 }}>Loading</div>}
        <p className="ro-ad-hint">{processing?.mail === 'live' ? 'Live email is configured.' : 'No mail server is configured for the pilot, so notification emails are held here until the mailbox is connected. The reports themselves are on file and readable in the Inbox.'}</p>
      </div>
    </SharePointStatus>}
    {section === 'help' && <section className="col ro-ad-main" aria-label="Install and help">
      <div className="col-head"><h4>Install and help</h4></div>
      <div className="ro-ad-scroll"><div className="ro-ad-page">
        <div><h5 className="ro-ad-h">Install Relay</h5><div className="ro-ad-box"><InstallRelay alwaysShow /></div></div>
        <div><h5 className="ro-ad-h">Where things are</h5><div className="ro-ad-box ro-ad-prose">
          <p><b>Engineer view</b> is for site updates and individual defects. Managers and Admins can open it to test; authorship stays with the signed-in account.</p>
          <p><b>Inbox</b> holds every submitted report; drafts appear as summaries only. <b>Issues</b> is the register across projects; assignment, verification, confirmation and withdrawal are recorded against the signed-in person.</p>
          <p>Roles are set in Microsoft Entra. Company selection on the hub is navigation, not access control.</p></div></div>
      </div></div>
    </section>}
  </div>;
}

const initials = (s: string) => s.split(/[\s._-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

/** Read-only in this release: roles and names come from Microsoft. */
function People({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState('');
  const members = ctx.team?.members ?? null;
  const q = query.trim().toLowerCase();
  const shown = (members ?? []).filter(m => !q || `${m.name ?? ''} ${m.email} ${m.assignment}`.toLowerCase().includes(q));
  const groups: [string, (m: TeamMember) => boolean][] = [
    ['Admin', m => m.onChecklist && m.assignment === 'Admin'],
    ['Managers', m => m.onChecklist && m.assignment === 'Manager'],
    ['Engineers · Electrical', m => m.onChecklist && m.assignment === 'Engineer.Electrical'],
    ['Engineers · HVAC', m => m.onChecklist && m.assignment === 'Engineer.HVAC'],
    ['Engineers · P&H', m => m.onChecklist && m.assignment === 'Engineer.PH'],
    ['Engineers', m => m.onChecklist && m.assignment.startsWith('Engineer') && !ROLE_LABEL[m.assignment]],
    ['Signed in but not on the checklist', m => !m.onChecklist],
  ];
  return <section className="col ro-ad-main" aria-label="People">
    <div className="col-head"><h4>People</h4><i>{members ? `${members.filter(m => m.onChecklist).length} on the checklist · ${members.filter(m => m.session === 'active').length} signed in` : 'Loading'}</i></div>
    <div className="ro-toolbar"><label className="ro-ad-search"><span className="ro-ad-sr">Search people</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" /></label></div>
    <div className="ro-ad-scroll">
      {!members ? <div className="loading">Loading the roster</div> : !shown.length ? <div className="ro-empty"><Mark kind="none" /><b>{members.length ? 'No one matches' : 'Nobody on the checklist and nobody signed in'}</b>{members.length ? <span>Try part of a name or email.</span> : null}</div>
        : groups.map(([label, pick]) => { const rows = shown.filter(pick); return rows.length ? <div key={label} className="ro-ad-group">
          <div className="ro-ad-band">{label} · {rows.length}</div>
          <ul className="ro-ad-people">{rows.map(m => { const local = m.email.split('@')[0] ?? m.email; return <li key={m.email} className="ro-ad-person">
            <span className={`ro-ad-av ${m.name ? '' : 'blank'}`} aria-hidden="true">{initials(m.name ?? local)}</span>
            <span className="ro-ad-pbody"><b className={m.name ? '' : 'noname'}>{m.name ?? local}</b><small>{m.email}</small></span>
            <span className="ro-ad-role"><span>{ROLE_LABEL[m.assignment] ?? m.assignment}</span><small>{m.role && m.assignment.split('.')[0] !== m.role ? `Signed in as ${m.role}` : sees(m)}</small></span>
            <span className={`ro-ad-sess ${m.session}`} title={m.lastSignedIn ? `Last signed in ${fmtWhen(m.lastSignedIn)}` : undefined}>{m.session === 'active' ? 'Signed in' : m.session === 'expired' ? 'Session expired' : 'No session'}</span>
          </li>; })}</ul></div> : null; })}
      <p className="ro-ad-foot">{ROSTER_FOOT} Issue owners are names or companies typed on site, not these accounts.</p>
    </div>
  </section>;
}

function LegacyDrafts({ ctx }: { ctx: Ctx }) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const team = ctx.team;
  const drafts = team?.legacyDrafts ?? [];
  const accounts = (team?.members ?? []).filter(m => m.id);
  async function assign(id: string) {
    setBusy(id); setError('');
    try {
      const res = await fetch('/api/admin/legacy-drafts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reportId: id, authorId: selected[id] }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.reason ?? 'Assignment failed.');
      toast('Draft ownership assigned and audited.');
      ctx.loadTeam(); void ctx.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Assignment failed.'); }
    finally { setBusy(''); }
  }
  return <section className="col ro-ad-main" aria-label="Older drafts">
    <div className="col-head"><h4>Older drafts</h4><i>{team ? `${drafts.length} need${drafts.length === 1 ? 's' : ''} an owner` : 'Loading'}</i></div>
    <div className="ro-ad-scroll">
      {!team ? <div className="loading">Loading</div> : drafts.length ? <div className="ro-ad-page">
        <p className="ro-ad-hint">These drafts predate account IDs. Confirm the author before assigning. Only an account that has signed in can be chosen; draft contents stay private, and the assignment writes an audit event.</p>
        {error && <div className="note bad" role="alert"><span>{error}</span></div>}
        <div className="ro-ad-rows">{drafts.map(d => <div key={d.id} className="ro-ad-job ro-ad-draft">
          <Mark kind="action" label="Needs an owner" />
          <span className="ro-ad-jb"><b className="ro-ad-mono">{d.reference}</b><small>Recorded author “{d.author}”{d.lastSavedAt ? ` · saved ${fmtWhen(d.lastSavedAt)}` : ''}</small></span>
          <span className="ro-ad-assign"><select value={selected[d.id] ?? ''} onChange={e => setSelected({ ...selected, [d.id]: e.target.value })} aria-label={`Verified original author of ${d.reference}`}><option value="">Choose a signed-in account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email} ({a.email})</option>)}</select>
            <BtnQ className="btn-sm" disabled={!selected[d.id] || busy === d.id} onClick={() => void assign(d.id)}>{busy === d.id ? 'Assigning…' : 'Assign draft ownership'}</BtnQ></span>
        </div>)}</div>
      </div> : <div className="ro-empty"><Mark kind="done" /><b>Every draft has an author account</b><span>Drafts saved before account IDs would appear here to be matched to their author.</span></div>}
    </div>
  </section>;
}
