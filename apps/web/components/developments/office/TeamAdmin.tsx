'use client';
import { useEffect, useMemo, useState } from 'react';
import { SharePointStatus } from '@/components/SharePointStatus';
import { adminPeople, type PersonLogEntry, type RelayPerson, type TeamMember } from '@/lib/api';
import type { FixtureProject } from '@/lib/fixtures';
import { InstallRelay } from '@/components/InstallRelay';
import { toast } from '@/components/workspace/hooks';
import type { Ctx } from './ctx';
import { Btn, BtnQ, Tag } from './bits';
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
  const unnamed = (team?.members ?? []).filter(m => m.onChecklist && !m.name).length;
  const failedJobs = (processing?.jobs ?? []).filter(j => j.status === 'failed').reduce((n, j) => n + j.count, 0);
  const nav: [Section, string, string, string][] = [
    ['roles', 'People', team ? String(team.members.filter(m => m.onChecklist).length) : '', unnamed ? `${unnamed} need${unnamed === 1 ? 's' : ''} a name` : ''],
    ['drafts', 'Older drafts', team ? String(legacy.length) : '', legacy.length ? `${legacy.length} need an owner` : ''],
    ['delivery', 'Processing and SharePoint', '', failedJobs ? `${failedJobs} job${failedJobs === 1 ? '' : 's'} failed` : ''],
    ['help', 'Install and help', '', ''],
  ];
  return <div className={`ro-ad ${section === 'roles' ? 'ro-ad-3' : ''}`}>
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

const ROLE_OPTS: [string, string][] = [['Admin', 'Admin'], ['Manager', 'Manager'], ['Engineer.Electrical', 'Engineer · Electrical'], ['Engineer.HVAC', 'Engineer · HVAC'], ['Engineer.PH', 'Engineer · P&H']];
const roleLabel = (a: string) => ROLE_LABEL[a] ?? a;
const localPart = (email: string) => email.split('@')[0] ?? email;
const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ');
const nameOk = (s: string) => { const c = cleanName(s); return c.length >= 2 && c.length <= 80; };
const WORK_EMAIL = /^[^@\s]+@leodisme\.com$/i;
const NAME_RULE = 'Enter a name between 2 and 80 characters.';
const PEOPLE_GROUPS: [string, (m: TeamMember) => boolean][] = [
  ['Admin', m => m.onChecklist && m.assignment === 'Admin'],
  ['Managers', m => m.onChecklist && m.assignment === 'Manager'],
  ['Engineers · Electrical', m => m.onChecklist && m.assignment === 'Engineer.Electrical'],
  ['Engineers · HVAC', m => m.onChecklist && m.assignment === 'Engineer.HVAC'],
  ['Engineers · P&H', m => m.onChecklist && m.assignment === 'Engineer.PH'],
  ['Engineers', m => m.onChecklist && m.assignment.startsWith('Engineer') && !ROLE_LABEL[m.assignment]],
  ['Signed in but not on the checklist', m => !m.onChecklist],
];

/** Names an Admin might mean, best first. None for a one-word address with nothing else to go on. */
function suggestionsFor(m: TeamMember, projects: FixtureProject[]): { name: string; from: string }[] {
  const out: { name: string; from: string }[] = [];
  const push = (name: string | undefined, from: string) => { const n = cleanName(name ?? ''); if (nameOk(n) && !out.some(s => s.name === n)) out.push({ name: n, from }); };
  if (m.microsoftName) push(m.microsoftName.split('|')[0], 'Microsoft name, without the company');
  push(projects.find(p => p.projectManagerEmail?.toLowerCase() === m.email.toLowerCase())?.projectManager, 'Project manager on existing projects');
  const local = localPart(m.email);
  if (/[._-]/.test(local)) push(local.split(/[._-]+/).filter(Boolean).map(w => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(' '), 'Worked out from the email address');
  return out;
}

function logLine(e: PersonLogEntry): { title: string; note?: string; cls: string } {
  switch (e.action) {
    case 'added': return { title: `Added as ${roleLabel(e.to ?? '')}`, cls: 'ok' };
    case 'restored': return { title: `Back on the checklist as ${roleLabel(e.to ?? '')}`, cls: 'ok' };
    case 'renamed': return e.from ? { title: 'Name changed', note: `From ${e.from} to ${e.to}`, cls: '' } : { title: 'Name set', note: `Now ${e.to}`, cls: '' };
    case 'assignment': return { title: 'Role on the checklist changed', note: `From ${roleLabel(e.from ?? 'not set')} to ${roleLabel(e.to ?? '')}. Update the app role in Microsoft Entra to match.`, cls: 'warn' };
    case 'removed': return { title: 'Removed from the checklist', cls: 'bad' };
  }
}

const sessionWords = (m: TeamMember) => m.session === 'active' ? 'Signed in now' : m.session === 'expired' ? `Session expired${m.lastSignedIn ? ` · signed in ${fmtWhen(m.lastSignedIn)}` : ''}` : 'No session';

/** People on the checklist: the name Relay shows and the role they are listed against. Neither grants access. */
function People({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<'person' | 'add'>('person');
  const [addSeed, setAddSeed] = useState<{ email: string; name: string; assignment: string } | null>(null);
  // Saved changes shown straight away, until the team list is read again.
  const [patches, setPatches] = useState<Record<string, TeamMember>>({});
  useEffect(() => { setPatches({}); }, [ctx.team]);

  const members = useMemo(() => {
    const base = ctx.team?.members;
    if (!base) return null;
    const merged = base.map(m => patches[m.email.toLowerCase()] ?? m);
    const extra = Object.values(patches).filter(p => !base.some(m => m.email.toLowerCase() === p.email.toLowerCase()));
    return [...merged, ...extra].filter(m => m.onChecklist || m.session !== 'never');
  }, [ctx.team, patches]);

  const q = query.trim().toLowerCase();
  const shown = (members ?? []).filter(m => !q || `${m.name ?? ''} ${m.microsoftName ?? ''} ${m.email} ${m.assignment}`.toLowerCase().includes(q));
  const ordered = PEOPLE_GROUPS.flatMap(([, pick]) => shown.filter(pick));
  const selected = (members ?? []).find(m => m.email.toLowerCase() === sel) ?? ordered[0];
  const needs = (members ?? []).filter(m => m.onChecklist && !m.name);

  const pick = (m: TeamMember) => { setSel(m.email.toLowerCase()); setMode('person'); };
  const nextOne = () => {
    const all = PEOPLE_GROUPS.flatMap(([, p]) => (members ?? []).filter(p)).filter(m => m.onChecklist && !m.name);
    if (!all.length) return;
    const at = selected ? all.findIndex(m => m.email === selected.email) : -1;
    const next = all[(at + 1) % all.length]!;
    setQuery(''); pick(next);
    requestAnimationFrame(() => {
      document.querySelector(`[data-person="${CSS.escape(next.email.toLowerCase())}"]`)?.scrollIntoView({ block: 'center' });
      (document.getElementById('ro-ad-name') as HTMLInputElement | null)?.focus();
    });
  };
  const saved = (person: RelayPerson, previous: TeamMember | undefined) => {
    const key = person.email.toLowerCase();
    const was: TeamMember = previous ?? { email: key, assignment: person.assignment ?? '', session: 'never', onChecklist: false };
    const relayName = person.relayName ?? was.relayName;
    const name = relayName ?? was.microsoftName;
    setPatches(p => ({ ...p, [key]: { ...was, assignment: person.assignment ?? was.assignment, onChecklist: !person.removed, log: person.log, ...(relayName ? { relayName } : {}), ...(name ? { name } : {}), ...(previous ? {} : { addedByRelay: true }) } }));
    ctx.loadTeam(); void ctx.refresh();
  };

  return <>
    <section className="col ro-ad-main" aria-label="People">
      <div className="col-head"><h4>People</h4><i>{members ? `${members.filter(m => m.onChecklist).length} on the checklist · ${members.filter(m => m.session === 'active').length} signed in` : 'Loading'}</i></div>
      <div className="ro-toolbar ro-ad-tools">
        <label className="ro-ad-search"><span className="ro-ad-sr">Search people</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email" /></label>
        <button type="button" className="ro-ad-toolbtn" aria-pressed={mode === 'add'} onClick={() => { setAddSeed(null); setMode('add'); }}>+ Add person</button>
      </div>
      {needs.length > 0 && <div className="ro-ad-banner" role="status"><Mark kind="action" label="Names needed" /><span><b>{needs.length} {needs.length === 1 ? 'person shows' : 'people show'} as their email name</b>Set a name so reports, issues and tasks show who they are.</span><button type="button" onClick={nextOne}>Next one</button></div>}
      <div className="ro-ad-scroll">
        {!members ? <div className="loading">Loading the roster</div> : !shown.length ? <div className="ro-empty"><Mark kind="none" /><b>{members.length ? 'No one matches' : 'Nobody on the checklist and nobody signed in'}</b>{members.length ? <span>Try part of a name or email.</span> : null}</div>
          : PEOPLE_GROUPS.map(([label, test]) => { const rows = shown.filter(test); return rows.length ? <div key={label} className="ro-ad-group">
            <div className="ro-ad-band">{label} · {rows.length}</div>
            <ul className="ro-ad-people">{rows.map(m => { const local = localPart(m.email); const on = mode === 'person' && selected?.email === m.email; return <li key={m.email}>
              <button type="button" className={`ro-ad-prow ${on ? 'on' : ''}`} aria-pressed={on} data-person={m.email.toLowerCase()} onClick={() => pick(m)}>
                <span className={`ro-ad-av ${m.name ? '' : 'blank'}`} aria-hidden="true">{initials(m.name ?? local)}</span>
                <span className="ro-ad-pbody"><b className={m.name ? '' : 'noname'}>{m.name ?? local}</b><small>{m.email}</small></span>
                <span className="ro-ad-pright">{!m.name && m.onChecklist && <span className="ro-ad-pill">Name needed</span>}<span className={`ro-ad-sess ${m.session}`} title={m.lastSignedIn ? `Last signed in ${fmtWhen(m.lastSignedIn)}` : undefined}>{m.session === 'active' ? 'Signed in' : m.session === 'expired' ? 'Session expired' : 'No session'}</span></span>
              </button></li>; })}</ul></div> : null; })}
        <p className="ro-ad-foot">{ROSTER_FOOT} Issue owners are names or companies typed on site, not these accounts.</p>
      </div>
    </section>
    {mode === 'add'
      ? <AddPerson key={addSeed?.email ?? 'new'} members={members ?? []} seed={addSeed} onCancel={() => setMode('person')} onSaved={(person, previous) => { saved(person, previous); setSel(person.email.toLowerCase()); setMode('person'); }} />
      : selected ? <PersonDetail key={selected.email} ctx={ctx} m={selected} onSaved={saved} onAddToChecklist={seed => { setAddSeed(seed); setMode('add'); }} />
      : <section className="col ro-ad-detail" aria-label="Person"><div className="col-head"><h4>Person</h4></div><div className="ro-empty"><Mark kind="none" /><b>Nothing selected</b></div></section>}
  </>;
}

function PersonDetail({ ctx, m, onSaved, onAddToChecklist }: { ctx: Ctx; m: TeamMember; onSaved: (p: RelayPerson, previous: TeamMember) => void; onAddToChecklist: (seed: { email: string; name: string; assignment: string }) => void }) {
  const [name, setName] = useState(m.relayName ?? '');
  const [assignment, setAssignment] = useState(m.assignment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const local = localPart(m.email);
  const nameChanged = cleanName(name) !== (m.relayName ?? '');
  const roleChanged = m.onChecklist && assignment !== m.assignment;
  const nameValid = !nameChanged || nameOk(name);
  const canSave = (nameChanged || roleChanged) && nameValid && !busy;
  const suggestions = suggestionsFor(m, ctx.projects).filter(s => s.name !== cleanName(name));
  const appears = cleanName(name) || m.name || local;

  async function save() {
    setBusy(true); setError('');
    try {
      let person: RelayPerson | undefined;
      if (nameChanged) person = await adminPeople({ action: 'rename', email: m.email, name: cleanName(name) });
      if (roleChanged) person = await adminPeople({ action: 'assignment', email: m.email, assignment });
      if (person) onSaved(person, m);
      const who = person?.relayName ?? m.name ?? m.email;
      toast(roleChanged ? `Saved. Update ${who}'s app role in Microsoft Entra to match.` : `Saved. ${who} now shows everywhere in Relay.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'That change was not saved.'); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try {
      const person = await adminPeople({ action: 'remove', email: m.email });
      onSaved(person, m); setConfirmRemove(false);
      toast(`${m.name ?? m.email} removed from the checklist.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'They were not removed.'); }
    finally { setBusy(false); }
  }

  return <section className="col ro-ad-detail" aria-label="Person">
    <div className="col-head"><h4>Person</h4><i>{m.onChecklist ? roleLabel(m.assignment) : 'Not on the checklist'}</i></div>
    <div className="ro-ad-scroll"><div className="ro-ad-pd">
      <div className="ro-ad-phead"><span className={`ro-ad-av big ${m.name ? '' : 'blank'}`} aria-hidden="true">{initials(m.name ?? local)}</span>
        <div><div className="ro-ad-code">{m.email}</div><h3>{m.relayName ?? m.name ?? <span className="noname">No name set</span>}</h3></div></div>
      {!m.name && <div className="ro-ad-next"><Mark kind="action" label="Name needed" /><span><b>Name needed</b>Relay shows “{local}” on reports, issues and tasks until a name is set.</span></div>}
      <div className="ro-ad-form">
        <label htmlFor="ro-ad-name">Name in Relay<input id="ro-ad-name" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" maxLength={120} autoComplete="off" /></label>
        {nameChanged && !nameValid && cleanName(name) && <div className="ro-ad-fhint bad">{NAME_RULE}</div>}
        {nameChanged && !cleanName(name) && m.relayName && <div className="ro-ad-fhint bad">A name set in Relay can be changed but not cleared.</div>}
        {suggestions.map(s => <button key={s.name} type="button" className="ro-ad-suggest" onClick={() => setName(s.name)}><span>Use <b>{s.name}</b></span><small>{s.from}</small></button>)}
        {m.onChecklist ? <label htmlFor="ro-ad-role">Role on the checklist<select id="ro-ad-role" value={assignment} onChange={e => setAssignment(e.target.value)}>
          {!ROLE_OPTS.some(([k]) => k === m.assignment) && <option value={m.assignment}>{m.assignment}</option>}
          {ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          : <div className="ro-ad-fhint">Not on the checklist. <button type="button" className="ro-ad-linkbtn plain" onClick={() => onAddToChecklist({ email: m.email, name: cleanName(name) || m.relayName || '', assignment: ROLE_OPTS.some(([k]) => k === m.assignment) ? m.assignment : 'Engineer.Electrical' })}>Add to the checklist</button></div>}
        {roleChanged && <div className="ro-ad-fhint warn">Update the app role in Microsoft Entra to match.</div>}
        <div className="ro-ad-preview"><span>Appears as</span><b>{appears}</b><small>on reports, issue timelines, the Inbox and the engineer app</small></div>
        {error && <div className="note bad" role="alert"><span>{error}</span></div>}
        <div className="ro-ad-btns"><Btn disabled={!canSave} onClick={() => void save()}>{busy ? 'Saving…' : 'Save changes'}</Btn></div>
      </div>
      <dl className="ro-ad-kv">
        <dt>Microsoft name</dt><dd>{m.microsoftName ?? <span className="quiet">Not known until they sign in</span>}</dd>
        <dt>Microsoft role</dt><dd>{m.role ? (m.trade ? `${m.role} · ${m.trade}` : m.role) : <span className="quiet">Checked at sign-in</span>}</dd>
        <dt>Session</dt><dd>{sessionWords(m)}</dd>
        <dt>Email</dt><dd>{m.email}</dd>
        {m.addedByRelay && <><dt>Checklist</dt><dd>Added in Relay</dd></>}
      </dl>
      <p className="ro-ad-hint">Issued PDFs and signatures keep the name they were issued with. Everything else in Relay shows the current name.</p>
      <div><h5 className="ro-ad-h">Change log</h5>
        {m.log?.length ? <ol className="ro-ad-tl">{m.log.map((e, n) => { const l = logLine(e); return <li key={n}><span className={`ro-ad-dot ${l.cls}`} aria-hidden="true" /><span className="ro-ad-tb"><b>{l.title}</b>{l.note && <q>{l.note}</q>}<small>{ctx.nameOf(e.actorId, e.actor)} · {fmtWhen(e.at)}</small></span></li>; })}</ol>
          : <p className="ro-ad-hint">No changes yet.</p>}
      </div>
      {m.onChecklist && <div className="ro-ad-danger">{confirmRemove
        ? <><span>Remove {m.name ?? m.email} from the checklist? Their Microsoft access isn't changed, and their past records stay.</span>
          <div className="ro-ad-btns"><Btn className="ro-ad-dangerbtn" disabled={busy} onClick={() => void remove()}>{busy ? 'Removing…' : 'Remove'}</Btn><BtnQ disabled={busy} onClick={() => setConfirmRemove(false)}>Keep</BtnQ></div></>
        : <button type="button" className="ro-ad-linkbtn" onClick={() => setConfirmRemove(true)}>Remove from checklist</button>}</div>}
    </div></div>
  </section>;
}

function AddPerson({ members, seed, onCancel, onSaved }: { members: TeamMember[]; seed: { email: string; name: string; assignment: string } | null; onCancel: () => void; onSaved: (p: RelayPerson, previous: TeamMember | undefined) => void }) {
  const [email, setEmail] = useState(seed?.email ?? '');
  const [name, setName] = useState(seed?.name ?? '');
  const [assignment, setAssignment] = useState(seed?.assignment ?? 'Engineer.Electrical');
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
      onSaved(person, members.find(m => m.email.toLowerCase() === typed));
      toast(`${person.relayName ?? typed} added. Give them the ${roleLabel(assignment)} app role in Microsoft Entra so they can sign in.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'They were not added.'); }
    finally { setBusy(false); }
  }
  return <section className="col ro-ad-detail" aria-label="Add a person">
    <div className="col-head"><h4>Add a person</h4><i>Checklist</i></div>
    <div className="ro-ad-scroll"><form className="ro-ad-pd" onSubmit={e => { e.preventDefault(); if (canSave) void add(); }}>
      <div><div className="ro-ad-code">New person</div><h3>Add to the team checklist</h3></div>
      <div className="ro-ad-form">
        <label htmlFor="ro-ad-email">Work email<input id="ro-ad-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@leodisme.com" autoComplete="off" autoFocus={!seed} /></label>
        <div className="ro-ad-fhint bad" aria-live="polite">{email.trim() && !emailOk ? (exists ? 'Already on the checklist.' : 'Use a @leodisme.com address.') : ' '}</div>
        <label htmlFor="ro-ad-newname">Name in Relay<input id="ro-ad-newname" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" maxLength={120} autoComplete="off" autoFocus={!!seed} /></label>
        {cleanName(name) && !nameOk(name) && <div className="ro-ad-fhint bad">{NAME_RULE}</div>}
        <label htmlFor="ro-ad-newrole">Role<select id="ro-ad-newrole" value={assignment} onChange={e => setAssignment(e.target.value)}>{ROLE_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      </div>
      <div className="ro-ad-next"><Mark kind="action" label="Access is separate" /><span><b>This doesn't give them access on its own</b>They also need the matching app role in Microsoft Entra.</span></div>
      {error && <div className="note bad" role="alert"><span>{error}</span></div>}
      <div className="ro-ad-btns"><button type="submit" className="btn" disabled={!canSave}>{busy ? 'Adding…' : 'Add person'}</button><BtnQ onClick={onCancel}>Cancel</BtnQ></div>
    </form></div>
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
