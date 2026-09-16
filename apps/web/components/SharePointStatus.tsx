'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Issue, Variation } from '@/lib/types';
import type { OfficeTeam } from '@/lib/api';
import { Mark } from '@/components/developments/office/marks';
export function IssueSyncStatus({ issue }: { issue: Issue }) {
  if (!issue.sync || issue.sync.status === 'synced') return null;
  return <p role="status" className="rowsub">{issue.sync.status === 'pending' ? 'Change saved in RELAY; waiting for SharePoint.' : 'SharePoint needs attention: ' + (issue.sync.error ?? issue.sync.status)}</p>;
}
type Status = { mode: string; writableProjectItemIds?: string[]; jobs: { id: string; kind: string; status: string; attempts: number; error?: string }[]; issues: { id: string; reference: string; sync: Issue['sync'] }[]; variations: { id: string; reference: string; sync: Variation['sync'] }[] };
type Check = { mode: string; checkedAt: string; checks: { label: string; ok: boolean; detail?: string }[] };

const MODE_WORDS: Record<string, string> = { off: 'Not enabled', read: 'Read only', write: 'Test connection' };
const clock = (at: string | Date) => new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const jobMark = (s: string) => s === 'failed' ? 'urgent' : s === 'working' ? 'sync' : 'none';
const JOB_WORDS: Record<string, string> = { failed: 'Failed', working: 'Working', pending: 'Waiting' };

/**
 * Admin > Processing and SharePoint. Status comes from the admin SharePoint
 * route; the connection check is a separate, read-only call made on request.
 */
export function SharePointStatus({ processing, onRefresh, children }: { processing?: OfficeTeam['processing']; onRefresh?: () => void; children?: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [checked, setChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { const r = await fetch('/api/admin/sharepoint', { cache: 'no-store' }); if (!r.ok) throw Error('Connection status could not be loaded.'); setStatus(await r.json()); setChecked(new Date()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load connection status.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function retry(jobId: string) {
    setBusy(true); setError(''); setNotice('');
    try { const r = await fetch('/api/admin/sharepoint', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobId }) }); const body = await r.json(); if (!r.ok) throw Error(body.reason); setNotice('Retry queued. Refresh after a few seconds to see the result.'); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); } finally { setBusy(false); }
  }
  async function runCheck() {
    setChecking(true); setCheckError('');
    try { const r = await fetch('/api/admin/sharepoint/check', { method: 'POST', cache: 'no-store' }); const body = await r.json(); if (!r.ok) throw Error(body.reason ?? 'The connection check could not run.'); setCheck(body); }
    catch (e) { setCheckError(e instanceof Error ? e.message : 'The connection check could not run.'); } finally { setChecking(false); }
  }

  const mode = status?.mode ?? processing?.sharepoint;
  const passed = check ? check.checks.filter(c => c.ok).length : 0;
  const allOk = !!check && passed === check.checks.length;
  const writable = status?.writableProjectItemIds?.length ?? 0;
  const jobs = processing?.jobs.filter(j => j.status !== 'complete') ?? [];
  const failedJobs = jobs.filter(j => j.status === 'failed').reduce((n, j) => n + j.count, 0);
  const outstanding = jobs.reduce((n, j) => n + j.count, 0);
  const records = [...(status?.issues ?? []).map(i => ({ ...i, href: `#/issues/${i.id}`, what: 'Issue' })), ...(status?.variations ?? []).map(v => ({ ...v, href: `#/variations/${v.id}`, what: 'Variation' }))];

  return <section className="col ro-ad-main" aria-label="Processing and SharePoint">
    <div className="col-head"><h4>Processing and SharePoint</h4><i>{loading ? 'Checking…' : checked ? `Last checked ${clock(checked)}` : ''}</i>
      <button type="button" className="ro-ad-headbtn" disabled={loading} onClick={() => { void refresh(); onRefresh?.(); }}>{loading ? 'Refreshing' : '↻ Refresh'}</button></div>
    <div className="ro-ad-scroll"><div className="ro-ad-page">
      {error && <div className="note bad" role="alert"><span>{error}</span></div>}
      {notice && <div className="note good" role="status"><span>{notice}</span></div>}
      <div className="ro-ad-cards">
        <div><span>SharePoint</span>
          {check ? <b className={allOk ? 'ok' : 'bad'}>{allOk ? 'Connected' : 'Checks failed'}</b> : <b>{mode ? MODE_WORDS[mode] ?? 'Unknown' : '—'}</b>}
          <small>{mode === 'write' ? `${MODE_WORDS.write}: writing for ${writable} project${writable === 1 ? '' : 's'} only` : mode === 'read' ? 'Relay reads SharePoint and writes nothing' : mode === 'off' ? 'Relay is not connected to SharePoint' : 'Loading connection status…'}</small>
          <button type="button" className="btn btn-q btn-sm ro-ad-connbtn" disabled={checking} onClick={() => void runCheck()}>{checking ? 'Checking connection…' : 'Refresh connection'}</button></div>
        <div><span>Notification email</span>{processing ? <b className={processing.mail === 'live' ? 'ok' : ''}>{processing.mail === 'live' ? 'Live' : 'Held locally'}</b> : <b>—</b>}
          <small>{processing?.mail === 'live' ? 'The project manager is emailed when a report comes in' : 'The pilot does not send the notification email yet'}</small></div>
        <div><span>Worker and PDF jobs</span>{processing ? <b className={failedJobs ? 'bad' : outstanding ? '' : 'ok'}>{failedJobs ? `${failedJobs} failed` : outstanding ? `${outstanding} outstanding` : 'Nothing waiting'}</b> : <b>—</b>}
          <small>{jobs.length ? jobs.map(j => `${j.kind} · ${j.status} · ${j.count}`).join('; ') : 'Run by the separate worker process. A failed job is retried with a delay.'}</small></div>
      </div>

      {(check || checking || checkError) && <div className="ro-ad-box" aria-live="polite">
        <h5 className="ro-ad-h">Connection check{checking ? ' · running' : ''}</h5>
        {checkError && <div className="note bad" role="alert"><span>{checkError}</span></div>}
        {check && <ol className="ro-ad-checks">{check.checks.map(c => <li key={c.label} className={c.ok ? 'pass' : 'fail'}>
          <span className="ro-ad-ci" aria-hidden="true">{c.ok ? '✓' : '✕'}</span><span>{c.label}</span><small>{c.ok ? 'Passed' : c.detail ?? 'Failed'}</small></li>)}</ol>}
        {check && (allOk
          ? <div className="note good"><span>All {check.checks.length} checks passed at {clock(check.checkedAt)}. Relay can read SharePoint.</span></div>
          : <div className="ro-alert" style={{ margin: 0 }}><Mark kind="urgent" /><span><b>{passed} of {check.checks.length} checks passed at {clock(check.checkedAt)}</b>{check.checks.filter(c => !c.ok).map(c => `${c.label}${c.detail ? ` (${c.detail})` : ''}`).join('; ')}</span><span /></div>)}
        <p className="ro-ad-hint">These checks only read. Nothing in SharePoint is changed.</p>
      </div>}

      <div><h5 className="ro-ad-h">Outstanding jobs · {status?.jobs.length ?? '…'}</h5>
        {status && (status.jobs.length ? <div className="ro-ad-rows">{status.jobs.map(j => <div key={j.id} className={`ro-ad-job ${j.status === 'failed' ? 'failed' : ''}`}>
          <Mark kind={jobMark(j.status)} label={JOB_WORDS[j.status] ?? j.status} />
          <span className="ro-ad-jb"><b>{j.kind} · {(JOB_WORDS[j.status] ?? j.status).toLowerCase()} · attempt {j.attempts}</b>{j.error && <span className="ro-ad-err">{j.error}</span>}</span>
          {j.status === 'failed' ? <button type="button" className="btn btn-q btn-sm" disabled={busy || status.mode !== 'write'} title={status.mode !== 'write' ? 'Retries need the test connection enabled' : undefined} onClick={() => void retry(j.id)}>Retry</button> : <span />}
        </div>)}</div> : <p className="ro-ad-hint">No outstanding SharePoint jobs.</p>)}</div>

      <div><h5 className="ro-ad-h">Records needing attention · {status ? records.length : '…'}</h5>
        {status && (records.length ? <>
          <p className="ro-ad-hint">Changed in SharePoint as well as in Relay, or not yet sent. Open each one and decide which version to keep. Nothing is overwritten automatically.</p>
          <div className="ro-ad-rows">{records.map(r => <div key={r.href} className="ro-ad-job">
            <Mark kind="sync" /><span className="ro-ad-jb"><b className="ro-ad-mono">{r.reference}</b><small>{r.what} · {r.sync?.status}{r.sync?.error ? ` · ${r.sync.error}` : ''}</small></span>
            <a className="ro-ad-link" href={r.href}>Open ›</a></div>)}</div></> : <p className="ro-ad-hint">Every issue and variation matches SharePoint.</p>)}</div>

      {children}
    </div></div>
  </section>;
}
