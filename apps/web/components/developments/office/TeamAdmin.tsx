'use client';
import { useState } from 'react';
import { SharePointStatus } from '@/components/SharePointStatus';
import type { TeamMember } from '@/lib/api';
import { InstallRelay } from '@/components/InstallRelay';
import { toast } from '@/components/workspace/hooks';
import type { Ctx } from './ctx';
import { BtnQ, Tag } from './bits';
import { fmtWhen } from './model';
import { useFeatures } from '@/components/FeaturesContext';
import { SAFETY_RECORDS_COVERS, SAFETY_RECORDS_NAME } from '@/lib/featureSwitch';

const ROLE_WORDS: Record<string, string> = { Admin: 'Everything, plus the Admin tab', Manager: 'Office, all projects', Engineer: 'Own drafts, submitted reports, issues' };
const sees = (m: TeamMember) => ROLE_WORDS[m.assignment.split('.')[0] ?? ''] ?? 'Not known until they sign in';

/** "Engineer.Electrical" → "Engineer · Electrical"; "Engineer.PH" → "Engineer · P&H". */
const roleWords = (assignment: string) => assignment.split('.').map(w => w === 'PH' ? 'P&H' : w).join(' · ');

/**
 * The roster reconciled with sessions. Read-only: roles are set in Microsoft.
 * The Team tab shows it in plain words; Admin's Roles & access keeps the
 * Microsoft app role names, which are what an Admin types into Entra.
 */
function RosterTable({ members, note, plain }: { members: TeamMember[] | null; note?: string; plain?: boolean }) {
  const groups: [string, (m: TeamMember) => boolean][] = [['Admin', m => m.assignment === 'Admin'], ['Managers', m => m.assignment === 'Manager'], ['Engineers', m => m.assignment.startsWith('Engineer')], ['Signed in, not on the checklist', m => !m.onChecklist]];
  return <div className="panel"><div className="panel-head"><h3>{plain ? 'Who can sign in' : 'Team assignment checklist'}</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>{note ?? (plain ? 'Roles are set by the Admin' : 'Set in Microsoft; the app only reads the role at sign-in')}</span></div>
    <table className="reg cards"><thead><tr><th>{plain ? 'Person' : 'Account'}</th><th>{plain ? 'Role' : 'Microsoft app role'}</th><th>{plain ? 'Can see' : 'Sees'}</th><th>{plain ? 'Signed in at' : 'Signed in since'}</th><th>{plain ? 'Now' : 'Session'}</th></tr></thead><tbody>
      {!members && <tr><td colSpan={5} className="loading" style={{ minHeight: 0, padding: 24 }}>Loading the roster</td></tr>}
      {(members ?? []).length === 0 && members && <tr><td colSpan={5} className="empty">Nobody on the checklist and nobody signed in.</td></tr>}
      {groups.map(([label, pick]) => { const rows = (members ?? []).filter(m => pick(m) && (label !== 'Engineers' || m.onChecklist) && (label === 'Signed in, not on the checklist' || m.onChecklist)); if (!rows.length) return null; return [
        <tr key={`g-${label}`} className="c-group"><td colSpan={5} style={{ background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 16px' }}>{plain && label === 'Signed in, not on the checklist' ? 'Signed in, not on the list' : label} · {rows.length}</td></tr>,
        ...rows.map(m => <tr key={m.email}><td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{m.name ?? m.email.split('@')[0]}</div><div className="rowsub num">{m.email}</div></td><td data-label={plain ? 'Role' : 'App role'}>{plain ? roleWords(m.assignment) : m.assignment}{m.role && m.assignment.split('.')[0] !== m.role && <div className="rowsub">signed in as {m.role}</div>}</td><td style={{ fontSize: 12 }} data-label={plain ? 'Can see' : 'Sees'}>{sees(m)}</td><td className="due" data-label={plain ? 'Signed in at' : 'Signed in'}>{m.lastSignedIn ? fmtWhen(m.lastSignedIn) : <span className="fine">—</span>}</td><td data-label={plain ? 'Now' : 'Session'}>{m.session === 'active' ? <Tag label="Signed in" cls="tag-ok" /> : m.session === 'expired' ? <Tag label={plain ? 'Signed out' : 'Expired'} cls="tag-quiet" /> : <Tag label={plain ? 'Not signed in' : 'No session'} cls="tag-quiet" />}</td></tr>),
      ]; })}
    </tbody></table>
    <div className="panel-foot">{plain ? 'Everyone who can sign in to RELAY at Leodis Developments, and who is signed in now. RELAY does not keep a history of sign-ins. Ask the Admin to add someone or change a role; it takes effect the next time they sign in.' : <>This is the assignment checklist against current sessions; it is not the Microsoft directory and it does not keep sign-in history, so "no session" means nobody is signed in on that account now. A role change takes effect at the next sign-in, within 12 hours. Nothing on this screen grants access.</>}</div></div>;
}

export function TeamView({ ctx }: { ctx: Ctx }) {
  const team = ctx.team;
  return <div className="view">
    <div className="pagehead"><div><h2>Team</h2><p>{team ? `${team.members.length} ${team.members.length === 1 ? 'person' : 'people'} · ${team.members.filter(m => m.session === 'active').length} signed in now` : 'Loading the team'}</p></div></div>
    <RosterTable members={team?.members ?? null} plain />
    <p className="rowsub">Issue owners are names or companies typed on site, not these accounts, so this list is who can sign in rather than who owns work.</p>
  </div>;
}

type Section = 'roles' | 'drafts' | 'delivery' | 'features' | 'help';
export function AdminView({ ctx }: { ctx: Ctx }) {
  const section: Section = (['roles', 'drafts', 'delivery', 'features', 'help'] as Section[]).includes(ctx.route.a as Section) ? ctx.route.a as Section : 'roles';
  const team = ctx.team;
  if (!ctx.me.admin) return <div className="view"><div className="pagehead"><div><h2>Administration</h2><p>Admin role only</p></div></div><div className="empty">Administration is for the Admin role. Managers see the Team tab.</div></div>;
  const legacy = team?.legacyDrafts ?? [];
  const processing = team?.processing;
  return <div className="view">
    <div className="pagehead"><div><h2>Administration</h2><p>Access, older drafts and processing for Leodis Developments · signed in through Microsoft{team ? ` · ${team.members.length} accounts on the checklist` : ''}</p></div>
      <div className="actions"><a className="btn btn-q" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Open Microsoft Entra ↗</a></div></div>
    <div className="filters">
      <a className={`chip ${section === 'roles' ? 'on' : ''}`} href="#/admin/roles">Roles &amp; access{team ? ` · ${team.members.length}` : ''}</a>
      <a className={`chip ${legacy.length ? 'warn' : ''} ${section === 'drafts' ? 'on' : ''}`} href="#/admin/drafts">Older drafts · {legacy.length}</a>
      <a className={`chip ${processing?.outbox.some(o => o.delivery === 'failed') ? 'warn' : ''} ${section === 'delivery' ? 'on' : ''}`} href="#/admin/delivery">Notifications &amp; processing</a>
      <a className={`chip ${section === 'features' ? 'on' : ''}`} href="#/admin/features">Site records</a>
      <a className={`chip ${section === 'help' ? 'on' : ''}`} href="#/admin/help">Install &amp; help</a>
    </div>
    {section === 'roles' && <RosterTable members={team?.members ?? null} />}
    {section === 'drafts' && <LegacyDrafts ctx={ctx} />}
    {section === 'features' && <SiteRecords />}
    {section === 'delivery' && <div className="adm-grid">
      <div className="panel"><div className="panel-head"><h3>Notifications waiting</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>Emails telling the project manager a report came in</span></div>
        {processing ? <table className="reg cards"><thead><tr><th>Reference</th><th>Project</th><th>Received</th><th>State</th></tr></thead><tbody>
          {processing.outbox.length ? processing.outbox.map(o => { const code = ctx.projects.find(p => p.id === o.projectId)?.id ?? ''; return <tr key={o.id} className="clickable" onClick={() => ctx.go(`#/projects/${code}/report/${o.id}`)}><td className="c-ref"><span className="ref">{o.reference}</span></td><td className="c-title">{ctx.projects.find(p => p.id === o.projectId)?.projectName ?? o.projectId}</td><td className="due" data-label="Received">{fmtWhen(o.since)}</td><td data-label="State">{o.delivery === 'failed' ? <><Tag label="Processing failed" cls="tag-alert" /><div className="rowsub">{o.error}</div></> : <Tag label="PM not notified" cls="tag-quiet" />}</td></tr>; }) : <tr><td colSpan={4} className="empty">Nothing is waiting.</td></tr>}
        </tbody></table> : <div className="loading">Loading</div>}
        <div className="panel-foot">{processing?.mail === 'live' ? 'Live email is configured.' : 'No mail server is configured for the pilot, so notification emails are held here until the mailbox is connected. The reports themselves are on file and readable in the Inbox.'}</div></div>
      <div className="stack"><SharePointStatus />
        <div className="panel"><div className="panel-head"><h3>Processing</h3></div>
          <dl className="tb" style={{ gridTemplateColumns: '1fr', margin: 0, border: 0 }}>
            <div style={{ borderRight: 0, borderBottom: '1px solid var(--line)' }}><dt>Notification email</dt><dd>{processing ? <Tag label={processing.mail === 'live' ? 'Live' : 'Held locally'} cls={processing.mail === 'live' ? 'tag-ok' : 'tag-quiet'} /> : '—'}<small>{processing?.mail === 'live' ? 'The project manager is emailed when a report comes in.' : 'The pilot does not send the notification email yet.'}</small></dd></div>
            <div style={{ borderRight: 0, borderBottom: '1px solid var(--line)' }}><dt>PDF and delivery jobs</dt><dd>{processing ? (processing.jobs.length ? processing.jobs.map(j => <div key={`${j.kind}-${j.status}`} className="num" style={{ fontSize: 12 }}>{j.kind} · {j.status} · {j.count}</div>) : <span className="fine">No jobs recorded</span>) : '—'}<small>Run by the separate worker process. A job that fails is retried with a delay.</small></dd></div>
            <div style={{ borderRight: 0 }}><dt>SharePoint filing</dt><dd><Tag label={processing?.sharepoint === 'write' ? 'Test connection' : processing?.sharepoint === 'read' ? 'Read only' : 'Not enabled'} cls="tag-quiet" /><small>File receipt and retry status appear under SharePoint connection.</small></dd></div>
          </dl></div>
      </div>
    </div>}
    {section === 'help' && <div className="two"><div className="panel"><div className="panel-head"><h3>Install Relay</h3></div><InstallRelay alwaysShow /></div>
      <div className="panel"><div className="panel-head"><h3>Where things are</h3></div><div style={{ padding: 16, fontSize: 13 }}><p style={{ margin: '0 0 8px' }}><b>Engineer view</b> is for site updates and individual defects. Managers and Admins can open it to test; authorship stays with the signed-in account.</p><p style={{ margin: '0 0 8px' }}><b>Inbox</b> holds every submitted report; drafts appear as summaries only. <b>Issues</b> is the register across projects; assignment, verification, confirmation and withdrawal are recorded against the signed-in person.</p><p style={{ margin: 0 }}>Roles are set in Microsoft Entra. Company selection on the hub is navigation, not access control.</p></div></div></div>}
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
  return <div className="panel"><div className="panel-head"><h3 style={{ color: drafts.length ? 'var(--alert)' : undefined }}>Older drafts</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>{drafts.length} predate account IDs</span></div>
    {!team ? <div className="loading">Loading</div> : drafts.length ? <table className="reg cards"><thead><tr><th>Reference</th><th>Recorded author</th><th>Saved</th><th>Verified original author</th><th><span className="sr">Action</span></th></tr></thead><tbody>
      {drafts.map(d => <tr key={d.id}><td className="c-ref"><span className="ref">{d.reference}</span></td><td data-label="Recorded author">“{d.author}”</td><td className="due" data-label="Saved">{fmtWhen(d.lastSavedAt)}</td><td data-label="Verified author"><select value={selected[d.id] ?? ''} onChange={e => setSelected({ ...selected, [d.id]: e.target.value })} aria-label={`Verified original author of ${d.reference}`}><option value="">Choose a signed-in account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name ?? a.email} ({a.email})</option>)}</select></td><td className="c-actions"><BtnQ className="btn-sm" disabled={!selected[d.id] || busy === d.id} onClick={() => void assign(d.id)}>{busy === d.id ? 'Assigning…' : 'Assign draft ownership'}</BtnQ></td></tr>)}
    </tbody></table> : <div className="empty">Every draft has an author account.</div>}
    {error && <div className="note bad" style={{ margin: 12 }}><span>{error}</span></div>}
    <div className="panel-foot">Confirm the author before assigning. Only an account that has signed in can be chosen; draft contents stay private, and the assignment writes an audit event.</div></div>;
}

/**
 * The switch for the safety, permits and deliveries records (lib/featureSwitch.ts).
 * Off by default so engineers see only the site report, issues and variations.
 * The page reloads after a change so every screen, the office desk included,
 * shows or hides them from the same answer.
 */
function SiteRecords() {
  const { safetyRecords } = useFeatures();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change(on: boolean) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/features', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ safetyRecords: on }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.reason ?? 'RELAY could not change the setting. Nothing has changed.');
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'RELAY could not change the setting. Nothing has changed.'); setBusy(false); }
  }
  return <div className="panel adm-switch"><div className="panel-head"><h3>{SAFETY_RECORDS_NAME}</h3><span style={{ marginLeft: 'auto' }}><Tag label={safetyRecords ? 'On' : 'Off'} cls={safetyRecords ? 'tag-ok' : 'tag-quiet'} /></span></div>
    <div style={{ padding: 16, fontSize: 13 }}>
      <p style={{ margin: '0 0 8px' }}>{SAFETY_RECORDS_COVERS}</p>
      <p style={{ margin: '0 0 12px' }}>{safetyRecords
        ? 'On: engineers and the office see them on the home screen, project pages, My week, the weekly summary, Before handover, the office desk and Help.'
        : 'Off: RELAY keeps to site reports, issues and variations. These records are hidden from everyone and their pages say they are switched off. Nothing recorded before is deleted, and turning them on shows it all again.'}</p>
      <BtnQ disabled={busy} onClick={() => void change(!safetyRecords)}>{busy ? 'Saving…' : safetyRecords ? 'Turn them off' : 'Turn them on'}</BtnQ>
      {error && <div className="note bad" role="alert" style={{ marginTop: 12 }}><span>{error}</span></div>}
    </div>
    <div className="panel-foot">Applies to everyone at Leodis Developments the next time a page opens. Pre-handover and first fix inspections are not affected: they are quality checks that feed the snag list.</div></div>;
}
