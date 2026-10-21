'use client';
import { useEffect, useState } from 'react';
import { SharePointStatus } from '@/components/SharePointStatus';
import { adminPeople, type PersonLogEntry, type RelayPerson, type TeamMember } from '@/lib/api';
import { InstallRelay } from '@/components/InstallRelay';
import { toast } from '@/components/workspace/hooks';
import type { Ctx } from './ctx';
import { Btn, BtnQ, Tag } from './bits';
import { fmtWhen } from './model';
import { welcomeText } from '@/lib/welcomeMessage';
import { useFeatures } from '@/components/FeaturesContext';
import { SAFETY_RECORDS_COVERS, SAFETY_RECORDS_NAME } from '@/lib/featureSwitch';

const ROLE_WORDS: Record<string, string> = { Admin: 'Everything, plus the Admin tab', Manager: 'Office, all projects', Engineer: 'Own drafts, submitted reports, issues' };
const sees = (m: TeamMember) => ROLE_WORDS[m.assignment.split('.')[0] ?? ''] ?? 'Not known until they sign in';

/** "Engineer.Electrical" → "Engineer · Electrical"; "Engineer.PH" → "Engineer · P&H". */
const roleWords = (assignment: string) => assignment.split('.').map(w => w === 'PH' ? 'P&H' : w).join(' · ');

/**
 * The roster reconciled with sessions, in plain words, as a Manager sees it on
 * the Team tab. Read-only: the Admin changes the checklist on the same tab
 * (People), and access still comes from Microsoft.
 */
function RosterTable({ members }: { members: TeamMember[] | null }) {
  const groups: [string, (m: TeamMember) => boolean][] = [['Admin', m => m.assignment === 'Admin'], ['Managers', m => m.assignment === 'Manager'], ['Engineers', m => m.assignment.startsWith('Engineer')], ['Signed in, not on the checklist', m => !m.onChecklist]];
  return <div className="panel"><div className="panel-head"><h3>Who can sign in</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>Roles are set by the Admin</span></div>
    <table className="reg cards"><thead><tr><th>Person</th><th>Role</th><th>Can see</th><th>Signed in at</th><th>Now</th></tr></thead><tbody>
      {!members && <tr><td colSpan={5} className="loading" style={{ minHeight: 0, padding: 24 }}>Loading the roster</td></tr>}
      {(members ?? []).length === 0 && members && <tr><td colSpan={5} className="empty">Nobody on the checklist and nobody signed in.</td></tr>}
      {groups.map(([label, pick]) => { const rows = (members ?? []).filter(m => pick(m) && (label !== 'Engineers' || m.onChecklist) && (label === 'Signed in, not on the checklist' || m.onChecklist)); if (!rows.length) return null; return [
        <tr key={`g-${label}`} className="c-group"><td colSpan={5} style={{ background: 'var(--panel-2)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '6px 16px' }}>{label === 'Signed in, not on the checklist' ? 'Signed in, not on the list' : label} · {rows.length}</td></tr>,
        ...rows.map(m => <tr key={m.email}><td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{m.name ?? m.email.split('@')[0]}</div><div className="rowsub num">{m.email}</div></td><td data-label="Role">{roleWords(m.assignment)}{m.role && m.assignment.split('.')[0] !== m.role && <div className="rowsub">signed in as {m.role}</div>}</td><td style={{ fontSize: 12 }} data-label="Can see">{sees(m)}</td><td className="due" data-label="Signed in at">{m.lastSignedIn ? fmtWhen(m.lastSignedIn) : <span className="fine">—</span>}</td><td data-label="Now">{m.session === 'active' ? <Tag label="Signed in" cls="tag-ok" /> : m.session === 'expired' ? <Tag label="Signed out" cls="tag-quiet" /> : <Tag label="Not signed in" cls="tag-quiet" />}</td></tr>),
      ]; })}
    </tbody></table>
    <div className="panel-foot">Everyone who can sign in to RELAY at Leodis Developments, and who is signed in now. RELAY does not keep a history of sign-ins. Ask the Admin to add someone or change a role; it takes effect the next time they sign in.</div></div>;
}

export function TeamView({ ctx }: { ctx: Ctx }) {
  const team = ctx.team;
  return <div className="view">
    <div className="pagehead"><div><h2>Team</h2><p>{team ? `${team.members.length} ${team.members.length === 1 ? 'person' : 'people'} · ${team.members.filter(m => m.session === 'active').length} signed in now` : 'Loading the team'}</p></div></div>
    {/* One list of people: the Admin's has the changes on it, everyone else's is read-only. The server refuses changes from anyone but the Admin. */}
    {ctx.me.admin ? <People ctx={ctx} /> : <RosterTable members={team?.members ?? null} />}
    <p className="rowsub">Issue owners are names or companies typed on site, not these accounts, so this list is who can sign in rather than who owns work.</p>
  </div>;
}

type Section = 'drafts' | 'delivery' | 'features' | 'help';
export function AdminView({ ctx }: { ctx: Ctx }) {
  const section: Section = (['drafts', 'delivery', 'features', 'help'] as Section[]).includes(ctx.route.a as Section) ? ctx.route.a as Section : 'delivery';
  const team = ctx.team;
  if (!ctx.me.admin) return <div className="view"><div className="pagehead"><div><h2>Administration</h2><p>Admin role only</p></div></div><div className="empty">Administration is for the Admin role. Managers see the Team tab.</div></div>;
  const legacy = team?.legacyDrafts ?? [];
  const processing = team?.processing;
  return <div className="view">
    <div className="pagehead"><div><h2>Administration</h2><p>Processing, older drafts and settings for Leodis Developments · signed in through Microsoft · people are on the Team tab</p></div>
      <div className="actions"><a className="btn btn-q" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Open Microsoft Entra ↗</a></div></div>
    <div className="filters">
      <a className={`chip ${processing?.outbox.some(o => o.delivery === 'failed') ? 'warn' : ''} ${section === 'delivery' ? 'on' : ''}`} href="#/admin/delivery">Notifications &amp; processing</a>
      <a className={`chip ${legacy.length ? 'warn' : ''} ${section === 'drafts' ? 'on' : ''}`} href="#/admin/drafts">Older drafts · {legacy.length}</a>
      <a className={`chip ${section === 'features' ? 'on' : ''}`} href="#/admin/features">Site records</a>
      <a className={`chip ${section === 'help' ? 'on' : ''}`} href="#/admin/help">Install &amp; help</a>
    </div>
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

const ROLE_OPTS: [string, string][] = [['Admin', 'Admin'], ['Manager', 'Manager'], ['Engineer.Electrical', 'Engineer · Electrical'], ['Engineer.HVAC', 'Engineer · HVAC'], ['Engineer.PH', 'Engineer · P&H']];
const localPart = (email: string) => email.split('@')[0] ?? email;
const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ');
const nameOk = (s: string) => { const c = cleanName(s); return c.length >= 2 && c.length <= 80; };
const WORK_EMAIL = /^[^@\s]+@leodisme\.com$/i;
const NAME_RULE = 'Enter a name between 2 and 80 characters.';

function logWords(e: PersonLogEntry): string {
  switch (e.action) {
    case 'added': return `Added as ${roleWords(e.to ?? '')}`;
    case 'restored': return `Back on the checklist as ${roleWords(e.to ?? '')}`;
    case 'renamed': return e.from ? `Name changed from ${e.from} to ${e.to}` : `Name set to ${e.to}`;
    case 'assignment': return `Role on the checklist changed from ${roleWords(e.from ?? 'not set')} to ${roleWords(e.to ?? '')}`;
    case 'removed': return 'Removed from the checklist';
  }
}

/**
 * People on the Team tab, for the Admin: the name RELAY shows for each person and the role they are
 * listed against. Neither grants access; the app role in Microsoft Entra does.
 * Every change is logged on the person.
 */
function People({ ctx }: { ctx: Ctx }) {
  const members = ctx.team?.members ?? null;
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const listed = (members ?? []).filter(m => m.onChecklist || m.session !== 'never');
  const selected = listed.find(m => m.email.toLowerCase() === sel);
  const unnamed = listed.filter(m => m.onChecklist && !m.name);
  const saved = () => { ctx.loadTeam(); void ctx.refresh(); };
  return <div className="two-wide">
    <div className="panel"><div className="panel-head"><h3>Who can sign in</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>{unnamed.length ? `${unnamed.length} need${unnamed.length === 1 ? 's' : ''} a name` : 'Names shown across RELAY'}</span><BtnQ className="btn-sm" onClick={() => { setAdding(true); setSel(null); }}>Add person</BtnQ></div>
      <table className="reg cards"><thead><tr><th>Person</th><th>Role on the checklist</th><th>Now</th></tr></thead><tbody>
        {!members && <tr><td colSpan={3} className="loading" style={{ minHeight: 0, padding: 24 }}>Loading the roster</td></tr>}
        {members && !listed.length && <tr><td colSpan={3} className="empty">Nobody on the checklist and nobody signed in.</td></tr>}
        {listed.map(m => <tr key={m.email} className={`clickable ${selected?.email === m.email ? 'sel' : ''}`} onClick={() => { setSel(m.email.toLowerCase()); setAdding(false); }}>
          <td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{m.name ?? localPart(m.email)}{!m.name && m.onChecklist && <> <Tag label="Name needed" cls="tag-caution" /></>}</div><div className="rowsub num">{m.email}</div></td>
          <td data-label="Role">{m.onChecklist ? roleWords(m.assignment) : <span className="rowsub">Not on the checklist</span>}</td>
          <td data-label="Now">{m.session === 'active' ? <Tag label="Signed in" cls="tag-ok" /> : m.session === 'expired' ? <Tag label="Session expired" cls="tag-quiet" /> : <span className="fine">No session</span>}</td>
        </tr>)}
      </tbody></table>
      <div className="panel-foot">Choose someone to set the name RELAY shows for them on reports, issues and the Inbox. Nothing here grants access: roles come from Microsoft Entra at sign-in, and a change takes effect the next time they sign in.</div></div>
    {adding ? <AddPerson members={listed} onCancel={() => setAdding(false)} onSaved={p => { setAdding(false); setSel(p.email.toLowerCase()); saved(); }} />
      : selected ? <PersonPanel key={selected.email} ctx={ctx} m={selected} onSaved={saved} />
      : <div className="panel"><div className="empty">Choose a person to change their name or role, or add someone to the checklist.</div></div>}
  </div>;
}

function PersonPanel({ ctx, m, onSaved }: { ctx: Ctx; m: TeamMember; onSaved: (p: RelayPerson) => void }) {
  const [name, setName] = useState(m.relayName ?? '');
  const [assignment, setAssignment] = useState(m.assignment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => { setName(m.relayName ?? ''); setAssignment(m.assignment); }, [m.relayName, m.assignment]);
  const nameChanged = cleanName(name) !== (m.relayName ?? '');
  const roleChanged = m.onChecklist && assignment !== m.assignment;
  const nameValid = !nameChanged || nameOk(name);
  const canSave = (nameChanged || roleChanged) && nameValid && !busy;
  const suggestion = m.microsoftName ? cleanName(m.microsoftName.split('|')[0] ?? '') : '';
  async function save() {
    setBusy(true); setError('');
    try {
      let person: RelayPerson | undefined;
      if (nameChanged) person = await adminPeople({ action: 'rename', email: m.email, name: cleanName(name) });
      if (roleChanged) person = await adminPeople({ action: 'assignment', email: m.email, assignment });
      if (person) onSaved(person);
      const who = person?.relayName ?? m.name ?? m.email;
      toast(roleChanged ? `Saved. Change ${who}'s app role in Microsoft Entra to match.` : `Saved. RELAY now shows ${who}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'That change was not saved.'); }
    finally { setBusy(false); }
  }
  async function change(action: 'remove' | 'restore') {
    setBusy(true); setError('');
    try {
      const person = await adminPeople({ action, email: m.email });
      onSaved(person); setConfirmRemove(false);
      toast(action === 'remove' ? `${m.name ?? m.email} taken off the checklist.` : `${m.name ?? m.email} is back on the checklist.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'That change was not saved.'); }
    finally { setBusy(false); }
  }
  return <div className="panel"><div className="panel-head"><h3>{m.name ?? localPart(m.email)}</h3><span className="rowsub" style={{ marginLeft: 'auto' }}>{m.email}</span></div>
    <form style={{ padding: 16, display: 'grid', gap: 12 }} onSubmit={e => { e.preventDefault(); if (canSave) void save(); }}>
      <div className="f"><label htmlFor="person-name">Name in RELAY</label><input id="person-name" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" maxLength={120} autoComplete="off" />
        {nameChanged && !nameValid && cleanName(name) && <p className="rowsub late">{NAME_RULE}</p>}
        {nameChanged && !cleanName(name) && m.relayName && <p className="rowsub late">A name set in RELAY can be changed but not cleared.</p>}
        {suggestion && nameOk(suggestion) && suggestion !== cleanName(name) && <button type="button" className="btn btn-q btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setName(suggestion)}>Use {suggestion} (their Microsoft name)</button>}</div>
      {m.onChecklist && <div className="f"><label htmlFor="person-role">Role on the checklist</label><select id="person-role" value={assignment} onChange={e => setAssignment(e.target.value)}>
        {!ROLE_OPTS.some(([k]) => k === m.assignment) && <option value={m.assignment}>{m.assignment}</option>}
        {ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {roleChanged && <p className="rowsub">Change their app role in Microsoft Entra to match.</p>}</div>}
      {error && <div className="note bad" role="alert"><span>{error}</span></div>}
      <div className="actions"><Btn type="submit" disabled={!canSave}>{busy ? 'Saving…' : 'Save changes'}</Btn></div>
    </form>
    <dl className="tb two" style={{ margin: '0 16px 12px' }}>
      <div><dt>Microsoft name</dt><dd>{m.microsoftName ?? <span className="fine">Known after they sign in</span>}</dd></div>
      <div><dt>Signed in</dt><dd>{m.lastSignedIn ? fmtWhen(m.lastSignedIn) : <span className="fine">Not yet</span>}</dd></div>
    </dl>
    {m.onChecklist && !m.everSignedIn && !m.lastSignedIn && <WelcomeMessage m={m} />}
    <div style={{ padding: '0 16px 16px' }}>
      <p className="rowsub">PDFs already made keep the name they were made with. Everything else in RELAY shows the current name.</p>
      <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>Changes</h4>
      {m.log?.length ? <ul className="rowsub" style={{ margin: 0, paddingLeft: 18 }}>{m.log.map((e, n) => <li key={n}>{logWords(e)} · {ctx.nameOf(e.actorId, e.actor)} · {fmtWhen(e.at)}</li>)}</ul> : <p className="rowsub">No changes yet.</p>}
      {m.onChecklist ? <div style={{ marginTop: 12 }}>{confirmRemove
        ? <div className="note warn"><span>Take {m.name ?? m.email} off the checklist? Their Microsoft access is not changed, and their past records stay.</span><span className="actions"><Btn className="btn-sm" disabled={busy} onClick={() => void change('remove')}>{busy ? 'Saving…' : 'Take off'}</Btn><BtnQ className="btn-sm" disabled={busy} onClick={() => setConfirmRemove(false)}>Keep</BtnQ></span></div>
        : <BtnQ className="btn-sm" onClick={() => setConfirmRemove(true)}>Take off the checklist</BtnQ>}</div>
        : m.log?.some(e => e.action === 'removed') && <div style={{ marginTop: 12 }}><BtnQ className="btn-sm" disabled={busy} onClick={() => void change('restore')}>Put back on the checklist</BtnQ></div>}
    </div></div>;
}

function WelcomeMessage({ m }: { m: TeamMember }) {
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const text = welcomeText(m, origin);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied('Copied. Paste it into a text, Teams or an email.'); }
    catch { setCopied('Could not copy. Select the words above and copy them.'); }
  }
  return <div style={{ padding: '0 16px 16px' }}>
    <h4 style={{ margin: '0 0 4px', fontSize: 13 }}>Welcome message</h4>
    <p className="rowsub" style={{ margin: '0 0 8px' }}>{m.name ?? localPart(m.email)} has not signed in yet. Send them this by text, Teams or email: RELAY does not send it. They need their app role in Microsoft Entra first.</p>
    <textarea readOnly aria-label={`Welcome message for ${m.name ?? m.email}`} value={text} rows={14} style={{ width: '100%', fontSize: 13 }} onFocus={e => e.currentTarget.select()} />
    <div className="actions" style={{ marginTop: 8 }}><BtnQ className="btn-sm" onClick={() => void copy()}>Copy welcome message</BtnQ><span className="rowsub" role="status" aria-live="polite">{copied}</span></div>
  </div>;
}

function AddPerson({ members, onCancel, onSaved }: { members: TeamMember[]; onCancel: () => void; onSaved: (p: RelayPerson) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [assignment, setAssignment] = useState('Engineer.Electrical');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const typed = email.trim().toLowerCase();
  const exists = members.some(m => m.onChecklist && m.email.toLowerCase() === typed);
  const emailOk = WORK_EMAIL.test(email.trim()) && !exists;
  const canSave = emailOk && nameOk(name) && !busy;
  async function add() {
    setBusy(true); setError('');
    try {
      const person = await adminPeople({ action: 'add', email: typed, name: cleanName(name), assignment });
      onSaved(person);
      toast(`${person.relayName ?? typed} added. Give them the ${roleWords(assignment)} app role in Microsoft Entra, then send them the welcome message.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'They were not added.'); }
    finally { setBusy(false); }
  }
  return <div className="panel"><div className="panel-head"><h3>Add a person</h3></div>
    <form style={{ padding: 16, display: 'grid', gap: 12 }} onSubmit={e => { e.preventDefault(); if (canSave) void add(); }}>
      <div className="f"><label htmlFor="add-email">Work email</label><input id="add-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@leodisme.com" autoComplete="off" autoFocus />
        <p className="rowsub late" aria-live="polite">{email.trim() && !emailOk ? (exists ? 'Already on the checklist.' : 'Use a @leodisme.com address.') : ''}</p></div>
      <div className="f"><label htmlFor="add-name">Name in RELAY</label><input id="add-name" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" maxLength={120} autoComplete="off" />
        {cleanName(name) && !nameOk(name) && <p className="rowsub late">{NAME_RULE}</p>}</div>
      <div className="f"><label htmlFor="add-role">Role</label><select id="add-role" value={assignment} onChange={e => setAssignment(e.target.value)}>{ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="note info"><span><b>This does not give them access on its own.</b> They also need the matching app role in Microsoft Entra.</span></div>
      {error && <div className="note bad" role="alert"><span>{error}</span></div>}
      <div className="actions"><Btn type="submit" disabled={!canSave}>{busy ? 'Adding…' : 'Add person'}</Btn><BtnQ onClick={onCancel}>Cancel</BtnQ></div>
    </form></div>;
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
