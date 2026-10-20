'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useProjects } from './ProjectContext';
import { usePrincipal } from './PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { safeViewReturn } from '@/lib/viewNavigation';
import { EMPTY_SITE_INFO, SITE_INFO_LABELS, SITE_INFO_LIMITS, isEmptySiteInfo, mapsHref, telHref, type SiteContact, type SiteInfo, type SiteInfoFields } from '@/lib/siteInfo';
import { keepCopy, loadSiteInfo, type SiteInfoLoad } from '@/lib/siteInfoClient';

/**
 * One project's site information: where it is, when it is open, how to get
 * in, what to know before starting and who to ring. Kept by the office, read
 * on site; the last copy stays on the device for when there is no signal.
 */

const LONDON = { timeZone: 'Europe/London' } as const;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { ...LONDON, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { ...LONDON, day: 'numeric', month: 'short', year: 'numeric' });
const blankContact = (): SiteContact => ({ name: '', role: '', phone: '' });
const fieldsOf = (info: SiteInfo | null): SiteInfoFields => info ? { address: info.address, hours: info.hours, access: info.access, safety: info.safety, contacts: info.contacts.map(c => ({ ...c })) } : { ...EMPTY_SITE_INFO, contacts: [] };
const listWords = (words: string[]) => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

function Text({ value }: { value: string }) {
  return <p className="site-text">{value}</p>;
}

function SiteDetails({ info, manager, pm }: { info: SiteInfoFields; manager: boolean; pm: string }) {
  const [copied, setCopied] = useState(false);
  const missing = (what: string) => <p className="site-missing">{manager ? `Not recorded yet. Edit to add the ${what}.` : `Not recorded yet. Ask ${pm || 'the project manager'} for the ${what}.`}</p>;
  async function copy() {
    try { await navigator.clipboard.writeText(info.address); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
  }
  return <div className="site-sections">
    <section className="site-section" aria-labelledby="site-address">
      <h2 id="site-address">{SITE_INFO_LABELS.address}</h2>
      {info.address ? <>
        <Text value={info.address} />
        <div className="site-actions">
          <a className="btn btn-primary" href={mapsHref(info.address)} target="_blank" rel="noopener noreferrer">Open in Maps</a>
          <button type="button" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy address'}</button>
        </div>
      </> : missing('address')}
    </section>
    <section className="site-section" aria-labelledby="site-contacts">
      <h2 id="site-contacts">{SITE_INFO_LABELS.contacts}</h2>
      {info.contacts.length ? <ul className="site-contacts">{info.contacts.map((c, n) => <li key={n}>
        <div><b>{c.name}</b>{c.role && <span>{c.role}</span>}</div>
        <a className="btn site-call" href={telHref(c.phone)} aria-label={`Call ${c.name} on ${c.phone}`}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>{c.phone}</a>
      </li>)}</ul> : missing('site contacts')}
    </section>
    <section className="site-section" aria-labelledby="site-hours">
      <h2 id="site-hours">{SITE_INFO_LABELS.hours}</h2>
      {info.hours ? <Text value={info.hours} /> : missing('site hours')}
    </section>
    <section className="site-section" aria-labelledby="site-access">
      <h2 id="site-access">{SITE_INFO_LABELS.access}</h2>
      {info.access ? <Text value={info.access} /> : missing('access and parking details')}
    </section>
    <section className="site-section" aria-labelledby="site-safety">
      <h2 id="site-safety">{SITE_INFO_LABELS.safety}</h2>
      {info.safety ? <Text value={info.safety} /> : missing('safety and induction notes')}
    </section>
  </div>;
}

function SiteForm({ initial, base, projectId, onSaved, onCancel }: { initial: SiteInfoFields; base: SiteInfo | null; projectId: string; onSaved: (answer: SiteInfoLoad) => void; onCancel: (newer: SiteInfo | null) => void }) {
  const [fields, setFields] = useState<SiteInfoFields>(() => ({ ...initial, contacts: initial.contacts.length ? initial.contacts : [blankContact()] }));
  const [version, setVersion] = useState(base?.version ?? 0);
  const [newer, setNewer] = useState<SiteInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof SiteInfoFields>(key: K, value: SiteInfoFields[K]) => setFields(f => ({ ...f, [key]: value }));
  const setContact = (n: number, patch: Partial<SiteContact>) => set('contacts', fields.contacts.map((c, i) => i === n ? { ...c, ...patch } : c));

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/site-info', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, version, ...fields }) });
      const body = await response.json().catch(() => ({})) as SiteInfoLoad & { reason?: string; current?: SiteInfo | null };
      if (response.status === 409) {
        // Keep what this person typed; show what the other person saved and let them decide.
        setNewer(body.current ?? null); setVersion(body.current?.version ?? 0);
        setError(`${body.reason ?? 'Someone saved a newer copy while you were editing.'} Their version is shown above the form. Your changes are still here: save again to replace theirs, or cancel to keep it.`);
        return;
      }
      if (!response.ok) { setError(body.reason ?? `The site information could not be saved (${response.status}).`); return; }
      onSaved(body);
    } catch { setError('No connection, so nothing was saved. Your changes are still here; save again when there is signal.'); }
    finally { setSaving(false); }
  }

  const area = (key: 'address' | 'hours' | 'access' | 'safety', hint: string, rows: number) => <div className="field">
    <label htmlFor={`site-edit-${key}`}>{SITE_INFO_LABELS[key]}</label>
    <textarea id={`site-edit-${key}`} rows={rows} value={fields[key]} maxLength={SITE_INFO_LIMITS[key]} onChange={e => set(key, e.target.value)} aria-describedby={`site-edit-${key}-hint`} />
    <p className="hint" id={`site-edit-${key}-hint`}>{hint}</p>
  </div>;

  return <form className="site-form" onSubmit={e => void save(e)} aria-labelledby="site-form-title">
    <h2 id="site-form-title">Edit site information</h2>
    <p className="note site-warning">Everyone on the project can read this, on site and in the office, and it is kept on their phones for when there is no signal. Do not put door codes, keysafe numbers or alarm codes here.</p>
    {newer && <div className="site-newer" aria-labelledby="site-newer-title">
      <h3 id="site-newer-title">Saved by {newer.updatedBy} at {fmtWhen(newer.updatedAt)}</h3>
      <SiteDetails info={newer} manager pm="" />
    </div>}
    {area('address', 'The address an engineer puts into their maps app, with the postcode. Add the site entrance if it differs.', 3)}
    {area('hours', 'For example: Monday to Friday 7.30am to 5pm. No Saturday working without the site manager’s say-so.', 2)}
    {area('access', 'Where to park, which gate to use, where to sign in, and anything about deliveries or lifts.', 4)}
    {area('safety', 'Induction, PPE, permits, where the first aid kit and welfare are, and anything particular to this site.', 4)}
    <fieldset className="site-contact-fields">
      <legend>{SITE_INFO_LABELS.contacts}</legend>
      <p className="hint">Who to ring on site: the site manager, the main contractor’s office, security. A name and a number for each.</p>
      {fields.contacts.map((c, n) => <div className="site-contact-row" key={n}>
        <label>Name<input type="text" value={c.name} maxLength={SITE_INFO_LIMITS.name} autoComplete="off" onChange={e => setContact(n, { name: e.target.value })} /></label>
        <label>Role<input type="text" value={c.role} maxLength={SITE_INFO_LIMITS.role} placeholder="For example, site manager" autoComplete="off" onChange={e => setContact(n, { role: e.target.value })} /></label>
        <label>Phone<input type="text" inputMode="tel" value={c.phone} maxLength={SITE_INFO_LIMITS.phone} autoComplete="off" onChange={e => setContact(n, { phone: e.target.value })} /></label>
        <button type="button" className="site-remove" onClick={() => set('contacts', fields.contacts.filter((_, i) => i !== n))} aria-label={`Remove ${c.name || `contact ${n + 1}`}`}>Remove</button>
      </div>)}
      {fields.contacts.length < SITE_INFO_LIMITS.contacts && <button type="button" onClick={() => set('contacts', [...fields.contacts, blankContact()])}>Add a contact</button>}
    </fieldset>
    {error && <p className="note note-bad" role="alert">{error}</p>}
    <div className="site-actions">
      <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save site information'}</button>
      <button type="button" onClick={() => onCancel(newer)} disabled={saving}>Cancel</button>
    </div>
  </form>;
}

export function SiteInfoPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const projects = useProjects();
  const principal = usePrincipal();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [answer, setAnswer] = useState<SiteInfoLoad | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const project = projects.find(p => p.id === projectId);
  const manager = principal ? canManage(principal) : false;
  const fallback = manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`;
  const back = safeViewReturn(returnTo, fallback);

  useEffect(() => {
    if (!projectId) { setAnswer(null); return; }
    let cancelled = false;
    setAnswer(null); setError(''); setEditing(false); setSaved(false);
    loadSiteInfo(projectId, projects.find(p => p.id === projectId)?.projectName ?? '')
      .then(a => { if (!cancelled) setAnswer(a); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Site information could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry, projects]);

  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/site-info${q.size ? `?${q}` : ''}`;
  // The browser's own history, not the router: a router change asks the server, which with no signal would reload the page.
  useEffect(() => { if (`${location.pathname}${location.search}` !== here) window.history.replaceState(window.history.state, '', here); }, [here]);

  const a = answer?.projectId === projectId ? answer : null;
  const info = a?.info ?? null;
  const fields = fieldsOf(info);

  return <main className="eng-page site-page">
    <Link href={back} className="back">&larr; Back</Link>
    {projects.length > 1 && <div className="site-controls">
      <label>Project<select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={editing}>
        <option value="">Choose a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
      </select></label>
    </div>}

    {!project ? <div className="eng-panel"><h1>Site information</h1><p className="eng-help">Choose a project to see its address, site hours, how to get in, safety notes and who to ring.</p></div>
      : <>
        <header className="site-head">
          <p className="lbl">Site information</p>
          <h1>{project.projectName}</h1>
          <p className="site-sub"><span className="ref">{project.projectNumber}</span> · {project.projectManager ? `${project.projectManager}, project manager` : 'No project manager recorded'}</p>
          {a && <p className={`site-stamp ${a.offline ? 'site-offline' : ''}`} role="status">
            {a.offline ? `No connection. Showing the copy kept on this device on ${fmtWhen(a.offline.keptAt)}.` : saved ? 'Saved. Everyone on the project now sees this version.' : info ? `Updated ${fmtDay(info.updatedAt)} by ${info.updatedBy}.` : 'Nothing recorded for this site yet.'}
            {a.offline && <> <button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button></>}
          </p>}
          {a && !a.offline && a.canEdit && !editing && <div className="site-actions"><button type="button" className="btn-primary" onClick={() => { setEditing(true); setSaved(false); }}>{info ? 'Edit site information' : 'Add site information'}</button></div>}
        </header>
        {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
          : !a ? <p role="status">Loading site information…</p>
          : editing ? <SiteForm initial={fields} base={info} projectId={projectId} onCancel={newer => {
              // After a refused save, cancelling keeps the newer copy the form showed, so the page is not left on the older one.
              if (newer) { const answer = { projectId, info: newer, canEdit: true }; keepCopy(answer, project.projectName); setAnswer(answer); }
              setEditing(false);
            }} onSaved={next => {
              const answer = { projectId, info: next.info, canEdit: true };
              keepCopy(answer, project.projectName); setAnswer(answer); setEditing(false); setSaved(true); window.scrollTo({ top: 0 });
            }} />
          : <>
            {isEmptySiteInfo(fields) && <p className="eng-help site-empty">{a.canEdit ? 'Add the address, hours, access, safety notes and contacts once, and every engineer on this project can find them on their phone.' : `The office has not added anything for this site yet. ${project.projectManager || 'The project manager'} can add the address, hours and who to ring.`}</p>}
            <SiteDetails info={fields} manager={a.canEdit} pm={project.projectManager} />
            {info && info.history.length > 0 && <section className="site-history" aria-labelledby="site-history-title">
              <h2 id="site-history-title">Recent changes</h2>
              <ul>{info.history.map((h, n) => <li key={n}><span>{fmtWhen(h.at)}</span>{h.by} changed {listWords(h.fields.map(f => SITE_INFO_LABELS[f].toLowerCase()))}.</li>)}</ul>
            </section>}
          </>}
      </>}
  </main>;
}
