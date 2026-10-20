'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { safeViewReturn, backLabel, withViewReturn } from '@/lib/viewNavigation';
import { RECENT_DAYS, companyKey, matchCompanies, type CompanyIssues, type CompanyLine } from '@/lib/companyIssues';
import { NOTE_MAX, standingPromise, type Chase, type CompanyChases } from '@/lib/companyChases';
import { clientId } from '@/lib/clientId';

/**
 * Open issues by company, for the office: who still has work to put right
 * across every project, how much is past target, what is waiting for the
 * office to check, and what was closed lately, with each project's snag list
 * one tap away. It reads the issue register and changes nothing there. The
 * office can keep a chase note on each company (what was said, and the day
 * they promised), which is RELAY's own note and touches no issue. Rules in
 * `lib/companyIssues.ts` and `lib/companyChases.ts`.
 */

const LONDON = { timeZone: 'Europe/London' } as const;
const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-GB', { ...LONDON, day: 'numeric', month: 'short', year: 'numeric' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const ageWords = (days: number) => days === 0 ? 'raised today' : days === 1 ? 'raised yesterday' : `${days} days`;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { ...LONDON, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const PROMISE_WORDS = { due: 'Promised', met: 'Promise met', missed: 'Promise missed' } as const;
const PROMISE_TAG = { due: 'tag-draft', met: 'tag-sent', missed: 'tag-alert' } as const;
type WithChases = CompanyIssues & { chases: Record<string, CompanyChases> };

/**
 * One company's chase notes: the latest on show, earlier ones folded away,
 * and a short form to keep another. Saving sends the form's own id, so a
 * retry after a lost reply is not logged twice.
 */
function ChaseLog({ line, chases, today, onSaved }: { line: CompanyLine; chases: CompanyChases | undefined; today: string; onSaved: (chase: Chase) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [promisedBy, setPromisedBy] = useState('');
  const [requestId, setRequestId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const recent = chases?.recent ?? [];
  const [latest, ...earlier] = recent;
  const promise = standingPromise(recent, line.toDo, today);
  const hasWork = line.toDo + line.fixed > 0;
  const formId = `chase-${companyKey(line.owner).replace(/[^a-z0-9]+/g, '-')}`;
  if (!latest && !hasWork) return null;

  const start = () => { setOpen(true); setError(''); setRequestId(clientId()); };
  const cancel = () => { setOpen(false); setNote(''); setPromisedBy(''); setError(''); };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!note.trim()) { setError('Say what was said, even in a few words.'); return; }
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/company-chases', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner: line.owner, note, promisedBy, requestId }) });
      const body = await response.json().catch(() => ({})) as Chase & { reason?: string };
      if (!response.ok) throw new Error(body.reason ?? `The chase could not be saved (${response.status}).`);
      onSaved(body);
      setOpen(false); setNote(''); setPromisedBy('');
    } catch (err) {
      setError(err instanceof TypeError ? 'No connection. Your note is still here: try again when there is signal.' : err instanceof Error ? err.message : 'The chase could not be saved.');
    } finally { setSaving(false); }
  };

  return <section className="co-chase" aria-label={`Chases for ${line.owner}`}>
    <div className="co-chase-head">
      <h3>Chased</h3>
      {promise && <span className={`tag ${PROMISE_TAG[promise.state]}`}>{PROMISE_WORDS[promise.state]}{promise.state === 'met' ? '' : ` · ${fmtDay(promise.promisedBy)}`}</span>}
    </div>
    {latest ? <p className="co-chase-last"><span className="co-chase-when">{fmtWhen(latest.at)} · {latest.by}</span>{latest.note}{latest.promisedBy && <span className="co-sub">Promised by {fmtDay(latest.promisedBy)}</span>}</p>
      : <p className="co-sub co-chase-none">Not chased in RELAY yet.</p>}
    {promise?.state === 'missed' && <p className="co-chase-missed">The promised day has gone and {plural(line.toDo, 'issue is', 'issues are')} still to put right.</p>}
    {earlier.length > 0 && <details className="co-chase-earlier">
      <summary>Earlier chases ({(chases?.total ?? recent.length) - 1})</summary>
      <ol>{earlier.map(c => <li key={c.id}><span className="co-chase-when">{fmtWhen(c.at)} · {c.by}{c.promisedBy ? ` · promised ${fmtDay(c.promisedBy)}` : ''}</span>{c.note}</li>)}</ol>
      {(chases?.total ?? 0) > recent.length && <p className="co-sub">The {recent.length} most recent are shown.</p>}
    </details>}
    {open ? <form className="co-chase-form" onSubmit={save} aria-label={`Log a chase for ${line.owner}`}>
      <label htmlFor={`${formId}-note`}>What was said</label>
      <textarea id={`${formId}-note`} value={note} onChange={e => setNote(e.target.value)} maxLength={NOTE_MAX} rows={3} placeholder="For example: Rang Dave, coming back Thursday to finish level 2" autoFocus />
      <label htmlFor={`${formId}-date`}>Promised by (optional)</label>
      <input id={`${formId}-date`} type="date" value={promisedBy} min={today} onChange={e => setPromisedBy(e.target.value)} />
      {error && <p className="note note-bad" role="alert">{error}</p>}
      <div className="co-chase-actions">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save chase'}</button>
        <button type="button" className="btn-quiet" onClick={cancel} disabled={saving}>Cancel</button>
      </div>
      <p className="co-sub">Kept in RELAY for the office. It does not change the issues or send anything.</p>
    </form>
      : hasWork && <button type="button" className="co-snag co-chase-add" onClick={start}>Log a chase</button>}
  </section>;
}

function projectWords(p: CompanyLine['projects'][number]): string {
  return [p.toDo && `${p.toDo} to put right`, p.overdue && `${p.overdue} past target`, p.fixed && `${p.fixed} to check`].filter(Boolean).join(' · ');
}

export function CompanyIssuesPage({ initialQuery, returnTo }: { initialQuery: string; returnTo?: string | undefined }) {
  const router = useRouter();
  const [data, setData] = useState<WithChases | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(initialQuery);
  const back = safeViewReturn(returnTo, '/office');

  useEffect(() => {
    let cancelled = false;
    setData(null); setError('');
    fetch('/api/company-issues', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({})) as WithChases & { reason?: string };
        if (!response.ok) throw new Error(body.reason ?? `The issues could not be loaded (${response.status}).`);
        if (!cancelled) setData(body);
      })
      .catch(e => { if (!cancelled) setError(e instanceof TypeError ? 'No connection. Try again when there is signal.' : e instanceof Error ? e.message : 'The issues could not be loaded.'); });
    return () => { cancelled = true; };
  }, [retry]);

  // The address carries the search, so a snag list or issue opened from here comes back to the same view.
  const q = new URLSearchParams();
  if (query.trim()) q.set('q', query.trim());
  if (returnTo) q.set('returnTo', returnTo);
  const here = `/companies${q.size ? `?${q}` : ''}`;
  useEffect(() => { router.replace(here, { scroll: false }); }, [here, router]);

  const open = data?.companies.filter(c => c.toDo || c.fixed) ?? [];
  const shown = data ? matchCompanies(data.companies, query) : [];
  const toDo = open.reduce((n, c) => n + c.toDo, 0);
  const overdue = open.reduce((n, c) => n + c.overdue, 0);
  const fixed = open.reduce((n, c) => n + c.fixed, 0);
  const closed = data?.companies.reduce((n, c) => n + c.closedRecently, 0) ?? 0;
  const saved = (chase: Chase) => setData(d => {
    if (!d) return d;
    const had = d.chases[chase.companyKey];
    if (had?.recent.some(c => c.id === chase.id)) return d;
    return { ...d, chases: { ...d.chases, [chase.companyKey]: { total: (had?.total ?? 0) + 1, recent: [chase, ...(had?.recent ?? [])] } } };
  });
  const snagHref = (projectId: string, owner: string) => `/issues/snag-list?${new URLSearchParams({ project: projectId, owner, returnTo: here })}`;

  const card = (c: CompanyLine) => { const chases = data?.chases[companyKey(c.owner)]; const missed = data && standingPromise(chases?.recent ?? [], c.toDo, data.today)?.state === 'missed';
    return <li key={c.owner} className={`co-card${c.overdue || missed ? ' co-late' : ''}`}>
    <div className="co-top">
      <h2>{c.owner}</h2>
      <div className="co-tags">
        {c.overdue > 0 ? <span className="tag tag-alert">{c.overdue} past target</span>
          : c.toDo + c.fixed === 0 ? <span className="tag tag-sent">All clear</span> : null}
        {missed && <span className="tag tag-alert">Promise missed</span>}
      </div>
    </div>
    {c.trades.length > 0 && <p className="co-trades">{c.trades.join(' · ')}</p>}
    <dl className="co-nums">
      <div><dt>To put right</dt><dd>{c.toDo}</dd></div>
      <div><dt>Past target</dt><dd className={c.overdue ? 'late' : ''}>{c.overdue}</dd></div>
      <div><dt>Fixed, to check</dt><dd>{c.fixed}</dd></div>
      <div><dt>Closed, {RECENT_DAYS / 7} weeks</dt><dd className={c.closedRecently ? 'good' : ''}>{c.closedRecently}</dd></div>
    </dl>
    {c.oldest && <p className="co-oldest">Waiting longest to be put right: <Link className="ref" href={withViewReturn(`/issues/${c.oldest.issueId}`, here)}>{c.oldest.reference}</Link>, {c.oldest.days > 1 ? `${ageWords(c.oldest.days)} since it was raised on ${fmtDay(c.oldest.raisedOn)}` : ageWords(c.oldest.days)}</p>}
    {c.projects.length > 0 ? <ul className="co-projects" aria-label={`Projects with open work for ${c.owner}`}>{c.projects.map(p => <li key={p.projectId}>
      <div><b>{p.projectName}</b> {p.projectNumber && <span className="ref">{p.projectNumber}</span>}
        <span className="co-sub">{projectWords(p)}</span></div>
      <Link className="co-snag" href={snagHref(p.projectId, p.owner)} aria-label={`Snag list for ${c.owner} on ${p.projectName}`}>Snag list</Link>
    </li>)}</ul>
      : <p className="co-sub co-none">Nothing open. Everything named against them was closed in the last {RECENT_DAYS / 7} weeks.</p>}
    {data && <ChaseLog line={c} chases={chases} today={data.today} onSaved={saved} />}
  </li>; };

  return <main className="eng-page co-page">
    <Link href={back} className="back">&larr; {backLabel(back)}</Link>
    <header className="co-head">
      <p className="lbl">Leodis Developments · Office</p>
      <h1>Open issues by company</h1>
      <p className="eng-help">What each company or person still has to put right across every project, with the oldest first to chase. Open a snag list to hand it over or walk the site with them, and log each chase so the office knows who rang whom and what was promised.</p>
    </header>

    {error ? <div className="note note-bad" role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div>
      : !data ? <p role="status">Loading issues…</p>
      : <>
        <dl className="co-stats">
          <div><dt>Companies with work</dt><dd>{open.length}<small>{plural(toDo, 'issue')} to put right</small></dd></div>
          <div><dt>Past target</dt><dd className={overdue ? 'late' : ''}>{overdue}<small>{overdue ? 'open past its target date' : 'nothing is late'}</small></dd></div>
          <div><dt>Fixed, to check</dt><dd>{fixed}<small>{fixed ? 'waiting for the office' : 'nothing waiting'}</small></dd></div>
          <div><dt>Closed lately</dt><dd className={closed ? 'good' : ''}>{closed}<small>since {fmtDay(data.since)}</small></dd></div>
        </dl>

        {data.unassigned.toDo + data.unassigned.fixed > 0 && <div className="co-unassigned">
          <p><b>{plural(data.unassigned.toDo + data.unassigned.fixed, 'open issue')} with nobody named</b>{data.unassigned.overdue ? `, ${data.unassigned.overdue} past target` : ''}. Name a company or person on each so it can be chased.</p>
          <a className="co-snag" href="/office#/issues">Open the issue register</a>
        </div>}

        {data.companies.length > 0 && <label className="co-find">Find a company or person
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Type part of a name" enterKeyHint="search" autoComplete="off" />
        </label>}

        {data.companies.length === 0 ? <div className="eng-panel"><p>No company or person has open issues, and none were closed in the last {RECENT_DAYS / 7} weeks.</p></div>
          : shown.length === 0 ? <div className="eng-panel" role="status"><p>No company or person matches “{query.trim()}”.</p></div>
          : <>
            <p className="co-count" role="status">{shown.length === data.companies.length ? `${plural(shown.length, 'company or person', 'companies and people')}, most past target first` : `${shown.length} of ${data.companies.length} match “${query.trim()}”`}</p>
            <ul className="co-list">{shown.map(card)}</ul>
          </>}

        <footer className="co-foot">
          <p>Made from the issue register for the projects open to you. Owners are typed by hand, so names are matched ignoring capitals and spacing; two spellings of one company (&ldquo;Acme&rdquo; and &ldquo;Acme Ltd&rdquo;) show as two. Withdrawn issues are left out. &ldquo;Fixed, to check&rdquo; means the work was put forward as complete and the office has not yet verified it; until then it still counts as past target once its target date has gone, as on the issue register and snag list. &ldquo;Closed lately&rdquo; counts issues verified and closed in the last {RECENT_DAYS / 7} weeks, up to today ({fmtDay(data.today)}).</p>
          <p>Chase notes are kept in RELAY for the office and do not change an issue or send anything. A promise is the date on the latest chase: it is &ldquo;missed&rdquo; once that day has gone with work still to put right, and &ldquo;met&rdquo; once nothing is left to put right (work marked fixed counts, though the office still has to check it). A later chase with no date sets the promise aside.</p>
        </footer>
      </>}
  </main>;
}
