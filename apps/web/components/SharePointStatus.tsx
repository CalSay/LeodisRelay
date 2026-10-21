'use client';
import { useEffect, useState } from 'react';
import type { Issue, Variation } from '@/lib/types';
export function IssueSyncStatus({ issue }: { issue: Issue }) {
  if (!issue.sync || issue.sync.status === 'synced') return null;
  return <p role="status" className="rowsub">{issue.sync.status === 'pending' ? 'Change saved in RELAY; waiting for SharePoint.' : 'SharePoint needs attention: ' + (issue.sync.error ?? issue.sync.status)}</p>;
}
type Check = { mode: string; checkedAt: string; checks: { label: string; ok: boolean; detail?: string }[] };
type Status = {mode:string; jobs:{id:string;kind:string;status:string;attempts:number;error?:string}[];issues:{id:string;reference:string;sync:Issue['sync']}[];variations:{id:string;reference:string;sync:Variation['sync']}[]};
export function SharePointStatus() {
  const [status,setStatus] = useState<Status | null>(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [check,setCheck] = useState<Check | null>(null);
  const [checking,setChecking] = useState(false);
  const [checkError,setCheckError] = useState('');
  async function refresh() {
    try {const r=await fetch('/api/admin/sharepoint',{cache:'no-store'});if(!r.ok)throw Error('Connection status could not be loaded.');setStatus(await r.json());}
    catch(e){setError(e instanceof Error?e.message:'Unable to load connection status.');}
  }
  useEffect(()=>{void refresh();},[]);
  async function retry(jobId:string) {
    setBusy(true);setError('');setNotice('');
    try {const r=await fetch('/api/admin/sharepoint',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jobId})});const body=await r.json();if(!r.ok)throw Error(body.reason);setNotice('Retry queued. Refresh after a few seconds to see the result.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Retry failed.');}finally{setBusy(false);}
  }
  // A separate, read-only call made on request: it reads each SharePoint list RELAY uses and changes nothing.
  async function runCheck() {
    setChecking(true);setCheckError('');
    try {const r=await fetch('/api/admin/sharepoint/check',{method:'POST',cache:'no-store'});const body=await r.json();if(!r.ok)throw Error(body.reason ?? 'The connection check could not run.');setCheck(body);}
    catch(e){setCheckError(e instanceof Error?e.message:'The connection check could not run.');}finally{setChecking(false);}
  }
  const passed = check ? check.checks.filter(c=>c.ok).length : 0;
  return <div className="panel"><div className="panel-head"><h4>SharePoint connection</h4><button type="button" className="btn btn-q btn-sm" style={{marginLeft:'auto'}} onClick={()=>void refresh()}>Refresh</button></div><div style={{padding:16}}>
    <p>{status ? ({off:'Not enabled',read:'Read-only connection',write:'Test project connection enabled'}[status.mode] ?? 'Unknown') : 'Loading connection status…'}</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status?.issues.map(i=><p key={i.id}><a href={`/issues/${i.id}`}>{i.reference}</a> · {i.sync?.status}{i.sync?.error ? ` · ${i.sync.error}` : ''}</p>)}
    {status?.variations?.map(v=><p key={v.id}><a href={`/variations/${v.id}`}>{v.reference}</a> · {v.sync?.status}{v.sync?.error ? ` · ${v.sync.error}` : ''}</p>)}
    {status?.jobs.map(j=><div key={j.id} style={{marginTop:12}}><span>{j.kind} · {j.status} · attempt {j.attempts}</span>{j.error && <p>{j.error}</p>}{j.status==='failed' && <button type="button" className="btn btn-q btn-sm" disabled={busy || status.mode!=='write'} onClick={()=>void retry(j.id)}>Retry</button>}</div>)}
    {status && !status.jobs.length && <p>No outstanding SharePoint jobs.</p>}
    <div style={{marginTop:12}}><button type="button" className="btn btn-q btn-sm" disabled={checking} onClick={()=>void runCheck()}>{checking ? 'Checking the connection…' : 'Check the connection'}</button></div>
    {checkError && <p role="alert">{checkError}</p>}
    {check && <div aria-live="polite" style={{marginTop:12}}>
      <p><b>{passed === check.checks.length ? `All ${check.checks.length} checks passed` : `${passed} of ${check.checks.length} checks passed`}</b> at {new Date(check.checkedAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'})}.</p>
      <ul className="rowsub" style={{margin:'4px 0 0',paddingLeft:18}}>{check.checks.map(c=><li key={c.label}>{c.ok ? 'Passed' : 'Failed'}: {c.label}{!c.ok && c.detail ? ` (${c.detail})` : ''}</li>)}</ul>
    </div>}
    <p className="rowsub" style={{marginTop:8}}>The check only reads. Nothing in SharePoint is changed.</p>
  </div></div>;
}
