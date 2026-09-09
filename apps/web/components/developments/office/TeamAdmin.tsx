'use client';
import { useState } from 'react';
import type { TeamMember } from '@/lib/api';
import { InstallRelay } from '@/components/InstallRelay';
import { toast } from '@/components/workspace/hooks';
import type { Ctx } from './ctx';
import { BtnQ, Tag } from './bits';
import { fmtWhen } from './model';

const ROLE_WORDS: Record<string, string> = { Admin: 'Everything, plus the Admin tab', Manager: 'Office, all projects', Engineer: 'Own drafts, submitted reports, issues' };
const sees = (m: TeamMember) => ROLE_WORDS[m.assignment.split('.')[0] ?? ''] ?? 'Not known until they sign in';

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
    <div className="panel-foot">This is the assignment checklist against current sessions; it is not the Microsoft directory and it does not keep sign-in history, so "no session" means nobody is signed in on that account now. A role change takes effect at the next sign-in, within 12 hours. Nothing on this screen grants access.</div></div>;
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
  return <div className="view">
    <div className="pagehead"><div><h3>Administration</h3><p>Access, older drafts and processing for Leodis Developments · signed in through Microsoft{team ? ` · ${team.members.length} accounts on the checklist` : ''}</p></div>
      <div className="actions"><a className="btn btn-q" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Open Microsoft Entra ↗</a></div></div>
    <div className="filters">
      <a className={`chip ${section === 'roles' ? 'on' : ''}`} href="#/admin/roles">Roles &amp; access{team ? ` · ${team.members.length}` : ''}</a>
      <a className={`chip ${legacy.length ? 'warn' : ''} ${section === 'drafts' ? 'on' : ''}`} href="#/admin/drafts">Older drafts · {legacy.length}</a>
      <a className={`chip ${processing?.outbox.some(o => o.delivery === 'failed') ? 'warn' : ''} ${section === 'delivery' ? 'on' : ''}`} href="#/admin/delivery">Notifications &amp; processing</a>
      <a className={`chip ${section === 'help' ? 'on' : ''}`} href="#/admin/help">Install &amp; help</a>
      <span className="chip" style={{ cursor: 'default' }}>Projects &amp; review <Tag label="Planned" cls="tag-quiet" /></span>
    </div>
    {section === 'roles' && <RosterTable members={team?.members ?? null} />}
    {section === 'drafts' && <LegacyDrafts ctx={ctx} />}
    {section === 'delivery' && <div className="adm-grid">
      <div className="panel"><div className="panel-head"><h4>Notifications waiting</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>Emails telling the project manager a report came in</span></div>
        {processing ? <table className="reg"><thead><tr><th>Reference</th><th>Project</th><th>Received</th><th>State</th></tr></thead><tbody>
          {processing.outbox.length ? processing.outbox.map(o => { const code = ctx.projects.find(p => p.id === o.projectId)?.projectNumber ?? ''; return <tr key={o.id} className="clickable" onClick={() => ctx.go(`#/projects/${code}/report/${o.id}`)}><td><span className="ref">{o.reference}</span></td><td>{ctx.projects.find(p => p.id === o.projectId)?.projectName ?? o.projectId}</td><td className="due">{fmtWhen(o.since)}</td><td>{o.delivery === 'failed' ? <><Tag label="Processing failed" cls="tag-alert" /><div className="rowsub">{o.error}</div></> : <Tag label="PM not notified" cls="tag-quiet" />}</td></tr>; }) : <tr><td colSpan={4} className="empty">Nothing is waiting.</td></tr>}
        </tbody></table> : <div className="loading">Loading</div>}
        <div className="panel-foot">{processing?.mail === 'live' ? 'Live email is configured.' : 'No mail server is configured for the pilot, so notification emails are held here until the mailbox is connected. The reports themselves are on file and readable in the Inbox.'}</div></div>
      <div className="stack">
        <div className="panel"><div className="panel-head"><h4>Processing</h4></div>
          <dl className="tb" style={{ gridTemplateColumns: '1fr', margin: 0, border: 0 }}>
            <div style={{ borderRight: 0, borderBottom: '1px solid var(--line)' }}><dt>Notification email</dt><dd>{processing ? <Tag label={processing.mail === 'live' ? 'Live' : 'Held locally'} cls={processing.mail === 'live' ? 'tag-ok' : 'tag-quiet'} /> : '—'}<small>{processing?.mail === 'live' ? 'The project manager is emailed when a report comes in.' : 'The pilot does not send the notification email yet.'}</small></dd></div>
            <div style={{ borderRight: 0, borderBottom: '1px solid var(--line)' }}><dt>PDF and delivery jobs</dt><dd>{processing ? (processing.jobs.length ? processing.jobs.map(j => <div key={`${j.kind}-${j.status}`} className="num" style={{ fontSize: 12 }}>{j.kind} · {j.status} · {j.count}</div>) : <span className="fine">No jobs recorded</span>) : '—'}<small>Run by the separate worker process. A job that fails is retried with a delay.</small></dd></div>
            <div style={{ borderRight: 0 }}><dt>SharePoint filing</dt><dd><Tag label="Planned" cls="tag-quiet" /><small>Issued PDFs will file to the project library.</small></dd></div>
          </dl></div>
      </div>
    </div>}
    {section === 'help' && <div className="two"><div className="panel"><div className="panel-head"><h4>Install Relay</h4></div><InstallRelay alwaysShow /></div>
      <div className="panel"><div className="panel-head"><h4>Where things are</h4></div><div style={{ padding: 16, fontSize: 13 }}><p style={{ margin: '0 0 8px' }}><b>Engineer view</b> is for site updates and individual defects. Managers and Admins can open it to test; authorship stays with the signed-in account.</p><p style={{ margin: '0 0 8px' }}><b>Inbox</b> holds every submitted report; drafts appear as summaries only. <b>Issues</b> is the register across projects; assignment, verification, confirmation and withdrawal are recorded against the signed-in person.</p><p style={{ margin: 0 }}>Roles are set in Microsoft Entra. Company selection on the hub is navigation, not access control.</p></div></div></div>}
  </div>;
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
  return <div className="panel"><div className="panel-head"><h4 style={{ color: drafts.length ? 'var(--alert)' : undefined }}>Older drafts</h4><span className="rowsub" style={{ marginLeft: 'auto' }}>{drafts.length} predate account IDs</span></div>
    {!team ? <div className="loading">Loading</div> : drafts.length ? <table className="reg"><thead><tr><th>Reference</th><th>Recorded author</th><th>Saved</th><th>Verified original author</th><th></th></tr></thead><tbody>
      {drafts.map(d => <tr key={d.id}><td><span className="ref">{d.reference}</span></td><td>“{d.author}”</td><td className="due">{fmtWhen(d.lastSavedAt)}</td><td><select value={selected[d.id] ?? ''} onChange={e => setSelected({ ...selected, [d.id]: e.target.value })} aria-label={`Verified original author of ${d.reference}`}><option value="">Choose a signed-in account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email} ({a.email})</option>)}</select></td><td><BtnQ className="btn-sm" disabled={!selected[d.id] || busy === d.id} onClick={() => void assign(d.id)}>{busy === d.id ? 'Assigning…' : 'Assign draft ownership'}</BtnQ></td></tr>)}
    </tbody></table> : <div className="empty">Every draft has an author account.</div>}
    {error && <div className="note bad" style={{ margin: 12 }}><span>{error}</span></div>}
    <div className="panel-foot">Confirm the author before assigning. Only an account that has signed in can be chosen; draft contents stay private, and the assignment writes an audit event.</div></div>;
}
