'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrincipal } from './PrincipalContext';
import { useProjects } from './ProjectContext';
import { canManage } from '@/lib/auth/access';
import { clientId } from '@/lib/clientId';
import {
  BACKDATE_DAYS, DELIVERY_CONDITIONS, ITEMS_MAX, NAME_MAX, NOTE_NUMBER_MAX, PROBLEM_MAX, REASON_MAX, RECENT_DAYS, SORTED_MAX, STORED_MAX, SUPPLIER_MAX,
  conditionLabel, conditionShort, deliveryOrder, deliveryState, deliverySummary, deliverySuppliers, ukDay,
  type Delivery, type DeliveryCondition, type ProjectDeliveries,
} from '@/lib/deliveries';
import { safeViewReturn, backLabel } from '@/lib/viewNavigation';
import { dayShort, whenShort } from '@/lib/dates';

/**
 * Deliveries to site: what arrived on a project, who took it in and where it
 * was put, and any that came short, damaged or wrong, kept "To sort" until
 * someone says how it was sorted. Not part of any report and never sent; a
 * record entered by mistake is withdrawn with a reason and stays listed.
 * Rules in `lib/deliveries.ts`.
 */

type Loaded = ProjectDeliveries & { live: boolean; suppliers: string[]; today: string };

/** How many deliveries show under "All deliveries" before "Show all". */
const FIRST = 20;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function DeliveriesPage({ initialProject, returnTo }: { initialProject: string; returnTo?: string | undefined }) {
  const principal = usePrincipal();
  const projects = useProjects();
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects.some(p => p.id === initialProject) ? initialProject : projects.length === 1 ? projects[0]!.id : '');
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const today = ukDay();
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState('');
  const [noteNumber, setNoteNumber] = useState('');
  const [day, setDay] = useState(today);
  const [receivedBy, setReceivedBy] = useState(principal?.name ?? '');
  const [storedAt, setStoredAt] = useState('');
  const [condition, setCondition] = useState<DeliveryCondition | ''>('');
  const [problem, setProblem] = useState('');
  const [requestId, setRequestId] = useState(() => clientId());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [said, setSaid] = useState('');
  const [showAll, setShowAll] = useState(false);
  // One delivery at a time is being sorted or withdrawn: `${'sort'|'withdraw'}:${id}`.
  const [acting, setActing] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const supplierInput = useRef<HTMLInputElement>(null);
  const itemsInput = useRef<HTMLTextAreaElement>(null);
  const problemInput = useRef<HTMLTextAreaElement>(null);
  const actInput = useRef<HTMLInputElement>(null);
  const manager = principal ? canManage(principal) : false;
  const back = safeViewReturn(returnTo, manager ? '/office' : `/engineer${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`);
  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    let cancelled = false;
    setData(null); setError('');
    fetch(`/api/deliveries?${new URLSearchParams({ project: projectId })}`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as Loaded & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The deliveries could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The deliveries could not be loaded.'); });
    return () => { cancelled = true; };
  }, [projectId, retry]);

  // The address carries the project, so a reload or a shared link opens the same record.
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/deliveries${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  useEffect(() => { if (formOpen) supplierInput.current?.focus(); }, [formOpen]);
  useEffect(() => { if (acting) actInput.current?.focus(); }, [acting]);

  const resetForm = () => {
    setSupplier(''); setItems(''); setNoteNumber(''); setDay(ukDay()); setReceivedBy(principal?.name ?? ''); setStoredAt(''); setCondition(''); setProblem(''); setFormError(''); setRequestId(clientId());
  };
  const closeForm = () => { setFormOpen(false); resetForm(); requestAnimationFrame(() => opener.current?.focus()); };

  // The saved record goes in place, and the figures are worked out again by the same rules as the server's.
  // A reply for a project no longer on screen (switched while saving) is left for that project's next load.
  const replace = (delivery: Delivery) => setData(d => {
    if (!d || d.projectId !== delivery.projectId) return d;
    const deliveries = [delivery, ...d.deliveries.filter(x => x.id !== delivery.id)].sort(deliveryOrder);
    return { ...d, deliveries, summary: deliverySummary(deliveries, ukDay()), suppliers: deliverySuppliers(deliveries) };
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !projectId) return;
    if (!supplier.trim()) { setFormError('Say who the supplier is.'); supplierInput.current?.focus(); return; }
    if (!items.trim()) { setFormError('Say what arrived.'); itemsInput.current?.focus(); return; }
    if (!condition) { setFormError('Say whether it was all there and in good order.'); document.querySelector<HTMLInputElement>('.dl-conditions input')?.focus(); return; }
    if (condition !== 'complete' && !problem.trim()) { setFormError('Say what was short, damaged or wrong.'); problemInput.current?.focus(); return; }
    if (!receivedBy.trim()) { setFormError('Say who took it in.'); document.getElementById('dl-received')?.focus(); return; }
    setSaving(true); setFormError(''); setSaid('');
    try {
      const response = await fetch('/api/deliveries', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: projectId, requestId, supplier, items, day, receivedBy, condition,
          ...(noteNumber.trim() ? { noteNumber } : {}), ...(storedAt.trim() ? { storedAt } : {}), ...(condition !== 'complete' && problem.trim() ? { problem } : {}) }) });
      const body = await response.json().catch(() => ({})) as Delivery & { reason?: string };
      if (response.status === 409 && body.reason?.includes('different details')) {
        // An earlier try was saved with other details and its reply was lost. Saving again keeps these as a new record.
        setRequestId(clientId());
        throw new Error('An earlier try was saved with different details. Save again to keep these as a new delivery, or reload to see it.');
      }
      if (!response.ok) throw new Error(body.reason ?? `The delivery could not be saved (${response.status}).`);
      replace(body);
      setSaid(body.condition === 'complete' ? `Delivery recorded: ${body.supplier}, all there.` : `Delivery recorded: ${body.supplier}, ${conditionShort(body.condition).toLowerCase()}. It stays under To sort until someone marks it sorted.`);
      closeForm();
    } catch (err) {
      setFormError(err instanceof TypeError ? 'No connection. What you typed is still here: try again when there is signal.' : err instanceof Error ? err.message : 'The delivery could not be saved.');
    } finally { setSaving(false); }
  };

  const stopActing = () => { setActing(''); setText(''); setActError(''); };
  const act = async (delivery: Delivery, action: 'sort' | 'withdraw') => {
    if (busy) return;
    if (!text.trim()) { setActError(action === 'sort' ? 'Say how it was sorted, for example that the rest arrived.' : 'Say why the delivery record is being withdrawn.'); actInput.current?.focus(); return; }
    setBusy(true); setActError(''); setSaid('');
    try {
      const response = await fetch(`/api/deliveries/${encodeURIComponent(delivery.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'sort' ? { action, note: text } : { action, reason: text }) });
      const body = await response.json().catch(() => ({})) as Delivery & { reason?: string };
      if (!response.ok) throw new Error(body.reason ?? `The delivery could not be ${action === 'sort' ? 'marked sorted' : 'withdrawn'} (${response.status}).`);
      replace(body);
      stopActing();
      setSaid(action === 'sort' ? `Marked sorted: ${body.supplier}, ${body.items}.` : 'Delivery record withdrawn. It stays listed, marked withdrawn, and is left out of the counts.');
      // Its buttons have gone, so focus goes to the delivery itself.
      requestAnimationFrame(() => document.getElementById(`dl-title-${delivery.id}`)?.focus());
    } catch (err) {
      setActError(err instanceof TypeError ? 'No connection. Try again when there is signal.' : err instanceof Error ? err.message : 'The delivery could not be changed.');
    } finally { setBusy(false); }
  };

  const s = data ? deliverySummary(data.deliveries, today) : undefined;
  const toSort = data?.deliveries.filter(d => deliveryState(d) === 'to-sort') ?? [];
  const rest = data?.deliveries.filter(d => deliveryState(d) !== 'to-sort') ?? [];
  const shownRest = showAll ? rest : rest.slice(0, FIRST);
  const canWithdraw = (d: Delivery) => !d.withdrawn && !!principal && (d.byId === principal.id || manager);
  const download = projectId ? `/api/deliveries?${new URLSearchParams({ project: projectId, format: 'csv' })}` : '';

  const card = (d: Delivery) => {
    const state = deliveryState(d);
    const title = `${d.supplier}: ${d.items}`;
    return <li key={d.id} className={`dl-delivery dl-${state}`}>
      <h3 className="dl-title" id={`dl-title-${d.id}`} tabIndex={-1}>
        <span className={`tag ${state === 'to-sort' ? 'tag-caution' : state === 'withdrawn' ? 'tag-alert' : 'tag-ok'}`}>{state === 'to-sort' ? `${conditionShort(d.condition)} · to sort` : state === 'sorted' ? `${conditionShort(d.condition)} · sorted` : state === 'fine' ? 'All there' : 'Withdrawn'}</span>
        <span className="dl-supplier">{d.supplier}</span>
        <span className="dl-items">{d.items}</span>
      </h3>
      <p className="dl-meta">Arrived {dayShort(d.day)} · taken in by {d.receivedBy}{d.storedAt ? ` · put in ${d.storedAt}` : ''}{d.noteNumber ? ` · delivery note ${d.noteNumber}` : ''}</p>
      {d.problem && <p className={`dl-problem${state === 'to-sort' ? ' dl-open' : ''}`}><span className="dl-problem-label">{conditionLabel(d.condition)}:</span> {d.problem}</p>}
      {d.sorted && <p className="dl-meta">Sorted by {d.sorted.by} · {whenShort(d.sorted.at)}: {d.sorted.note}</p>}
      {d.withdrawn && <p className="dl-meta">Withdrawn by {d.withdrawn.by} · {whenShort(d.withdrawn.at)}: {d.withdrawn.reason}</p>}
      <p className="dl-meta dl-quiet">Recorded by {d.by} · {whenShort(d.at)}</p>
      {acting === `sort:${d.id}` ? <div className="dl-act" role="group" aria-label={`Mark sorted: ${title}`}>
        <label htmlFor={`dl-sorted-${d.id}`}>How was it sorted?</label>
        <input id={`dl-sorted-${d.id}`} ref={actInput} value={text} onChange={e => { setText(e.target.value); setActError(''); }} maxLength={SORTED_MAX} placeholder="For example: the other 20 lengths arrived Thursday" />
        {actError && <p className="note note-bad" role="alert">{actError}</p>}
        <div className="dl-buttons">
          <button type="button" className="btn-primary" onClick={() => void act(d, 'sort')} disabled={busy}>{busy ? 'Saving…' : 'Mark sorted'}</button>
          <button type="button" className="btn-quiet" onClick={stopActing} disabled={busy}>Not yet</button>
        </div>
      </div>
        : acting === `withdraw:${d.id}` ? <div className="dl-act" role="group" aria-label={`Withdraw ${title}`}>
          <label htmlFor={`dl-reason-${d.id}`}>Why withdraw it?</label>
          <input id={`dl-reason-${d.id}`} ref={actInput} value={text} onChange={e => { setText(e.target.value); setActError(''); }} maxLength={REASON_MAX} placeholder="For example: recorded twice, or on the wrong project" />
          {actError && <p className="note note-bad" role="alert">{actError}</p>}
          <div className="dl-buttons">
            <button type="button" className="btn-danger" onClick={() => void act(d, 'withdraw')} disabled={busy}>{busy ? 'Saving…' : 'Withdraw record'}</button>
            <button type="button" className="btn-quiet" onClick={stopActing} disabled={busy}>Keep it</button>
          </div>
        </div>
        : (state === 'to-sort' || canWithdraw(d)) && <div className="dl-buttons">
          {state === 'to-sort' && <button type="button" className="btn-primary" onClick={() => { stopActing(); setActing(`sort:${d.id}`); setSaid(''); }} aria-label={`Mark sorted: ${title}`}>Mark sorted</button>}
          {canWithdraw(d) && <button type="button" className="btn-quiet" onClick={() => { stopActing(); setActing(`withdraw:${d.id}`); setSaid(''); }} aria-label={`Withdraw: ${title}`}>Withdraw</button>}
        </div>}
    </li>;
  };

  return <main className="eng-page dl-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <div className="dl-head">
      <p className="lbl">{project ? `${project.projectNumber} · ${project.projectName}` : 'Site'}</p>
      <h1>Deliveries</h1>
      <p className="dl-intro">Record what arrives on site: the supplier, what came, who took it in and where it was put. A delivery that came short, damaged or wrong stays under To sort, and in the office&rsquo;s Needs attention, until someone says how it was sorted. It is not part of any report and is not sent to anyone, so chasing the supplier is still a phone call.</p>
    </div>
    {projects.length > 1 && <div className="dl-controls">
      <label htmlFor="dl-project">Project</label>
      <select id="dl-project" value={projectId} disabled={saving || busy} onChange={e => { setProjectId(e.target.value); setFormOpen(false); resetForm(); stopActing(); setSaid(''); setShowAll(false); }}>
        {!projectId && <option value="">Choose a project</option>}
        {projects.map(p => <option key={p.id} value={p.id}>{p.projectNumber} {p.projectName}</option>)}
      </select>
    </div>}

    {!projectId ? <div className="eng-panel"><p>Choose a project to see its deliveries.</p></div>
      : error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data || !s ? <p role="status">Loading deliveries…</p>
      : <>
        <dl className="dl-stats" aria-label="This project's deliveries">
          <div><dt>To sort</dt><dd className={s.toSort ? 'dl-due' : ''}><b>{s.toSort}</b><small>{s.toSort ? `short, damaged or wrong, not sorted yet` : 'nothing waiting on a supplier'}</small></dd></div>
          <div><dt>Last {RECENT_DAYS} days</dt><dd><b>{s.recent}</b><small>{s.recent ? `${s.recent === 1 ? 'delivery' : 'deliveries'} taken in` : 'none taken in this week'}</small></dd></div>
        </dl>

        {data.live ? (formOpen ? <form className="dl-form" onSubmit={save} aria-labelledby="dl-form-title" noValidate>
          <h2 id="dl-form-title">Record a delivery</h2>
          <div className="dl-field">
            <label htmlFor="dl-supplier">Supplier</label>
            <input id="dl-supplier" ref={supplierInput} value={supplier} onChange={e => { setSupplier(e.target.value); setFormError(''); }} maxLength={SUPPLIER_MAX} autoComplete="off" placeholder="For example: City Plumbing, Leeds" />
            {data.suppliers.length > 0 && <div className="eng-chips" role="group" aria-label="Recent suppliers">{data.suppliers.map(name => <button key={name} type="button" className={`eng-chip${supplier === name ? ' on' : ''}`} aria-pressed={supplier === name} onClick={() => { setSupplier(name); setFormError(''); itemsInput.current?.focus(); }}>{name}</button>)}</div>}
          </div>
          <div className="dl-field">
            <label htmlFor="dl-items">What arrived</label>
            <textarea id="dl-items" ref={itemsInput} value={items} onChange={e => { setItems(e.target.value); setFormError(''); }} maxLength={ITEMS_MAX} rows={2} placeholder="For example: 40 lengths 22mm copper, 2 boxes press fittings" />
          </div>
          <fieldset className="dl-field dl-conditions">
            <legend className="dl-label">Was it all there and in good order?</legend>
            <div className="eng-chips">{DELIVERY_CONDITIONS.map(c => <label key={c.id} className={`eng-chip dl-condition-chip${condition === c.id ? ' on' : ''}`}><input type="radio" name="dl-condition" value={c.id} checked={condition === c.id} onChange={() => { setCondition(c.id); setFormError(''); }} />{c.label}</label>)}</div>
          </fieldset>
          {condition && condition !== 'complete' && <div className="dl-field">
            <label htmlFor="dl-problem">What was {condition === 'short' ? 'short' : condition === 'damaged' ? 'damaged' : 'wrong'}?</label>
            <textarea id="dl-problem" ref={problemInput} value={problem} onChange={e => { setProblem(e.target.value); setFormError(''); }} maxLength={PROBLEM_MAX} rows={2} placeholder={condition === 'short' ? 'For example: 20 lengths short, rest promised Thursday' : condition === 'damaged' ? 'For example: one radiator dented, noted on the delivery note' : 'For example: 15mm sent instead of 22mm'} />
          </div>}
          <div className="dl-row">
            <div className="dl-field">
              <label htmlFor="dl-day">Arrived on</label>
              <input id="dl-day" type="date" value={day} max={today} min={addDays(today, -BACKDATE_DAYS)} onChange={e => setDay(e.target.value)} aria-describedby="dl-day-help" />
              <p id="dl-day-help" className="dl-sub">Today, or up to {BACKDATE_DAYS} days ago.</p>
            </div>
            <div className="dl-field">
              <label htmlFor="dl-received">Taken in by</label>
              <input id="dl-received" value={receivedBy} onChange={e => { setReceivedBy(e.target.value); setFormError(''); }} maxLength={NAME_MAX} autoComplete="off" />
            </div>
          </div>
          <div className="dl-row">
            <div className="dl-field">
              <label htmlFor="dl-stored">Where it was put <span className="dl-optional">optional</span></label>
              <input id="dl-stored" value={storedAt} onChange={e => setStoredAt(e.target.value)} maxLength={STORED_MAX} autoComplete="off" placeholder="For example: level 2 store, cage B" />
            </div>
            <div className="dl-field">
              <label htmlFor="dl-note">Delivery note number <span className="dl-optional">optional</span></label>
              <input id="dl-note" value={noteNumber} onChange={e => setNoteNumber(e.target.value)} maxLength={NOTE_NUMBER_MAX} autoComplete="off" placeholder="For example: DN 448120" />
            </div>
          </div>
          {formError && <p className="note note-bad" role="alert">{formError}</p>}
          <div className="dl-buttons">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save delivery'}</button>
            <button type="button" className="btn-quiet" onClick={closeForm} disabled={saving}>Cancel</button>
          </div>
        </form>
          : <div className="dl-actions">
            <button type="button" ref={opener} className="btn-primary" onClick={() => { setFormOpen(true); stopActing(); setSaid(''); }}>Record a delivery</button>
            {data.deliveries.length > 0 && <a className="eng-link-button" href={download} download>Download spreadsheet</a>}
          </div>)
          : <div className="eng-panel"><p>This project is not active or in defects liability, so it takes no new deliveries.</p>
            {data.deliveries.length > 0 && <a className="eng-link-button" href={download} download>Download spreadsheet</a>}</div>}

        <section aria-labelledby="dl-sort-title" className="dl-section">
          <h2 id="dl-sort-title">To sort <span className="dl-count">{toSort.length}</span></h2>
          {toSort.length ? <ul className="dl-list">{toSort.map(card)}</ul>
            : <p className="dl-none">{data.deliveries.length ? 'Nothing to sort: every delivery with a problem has been sorted.' : 'No deliveries recorded on this project yet. When materials arrive, record them here, so a short or damaged delivery is chased while the delivery note is still to hand.'}</p>}
        </section>
        {rest.length > 0 && <section aria-labelledby="dl-all-title" className="dl-section">
          <h2 id="dl-all-title">{toSort.length ? 'Everything else' : 'All deliveries'} <span className="dl-count">{rest.filter(d => !d.withdrawn).length}</span></h2>
          <ul className="dl-list">{shownRest.map(card)}</ul>
          {!showAll && rest.length > FIRST && <button type="button" className="btn-quiet dl-more" onClick={() => setShowAll(true)}>Show all {rest.length}</button>}
        </section>}
        <p className="dl-foot">Anyone on the project can record a delivery or mark one sorted, saying how. Whoever recorded a delivery, or the office, can withdraw one entered by mistake; it stays here, marked withdrawn, with the reason. The spreadsheet has every delivery, withdrawn ones included.</p>
      </>}
    <p className="eng-sr" role="status">{said}</p>
  </main>;
}
