'use client';
import { useEffect, useState } from 'react';
import type { Issue } from '@/lib/types';
export function IssueSyncStatus({ issue }: { issue: Issue }) {
  if (!issue.sync || issue.sync.status === 'synced') return null;
  return <p role="status" className="rowsub">{issue.sync.status === 'pending' ? 'Change saved in RELAY; waiting for SharePoint.' : 'SharePoint needs attention: ' + (issue.sync.error ?? issue.sync.status)}</p>;
}
type Status = {mode:string; jobs:{id:string;kind:string;status:string;attempts:number;error?:string}[];issues:{id:string;reference:string;sync:Issue['sync']}[]};
export function SharePointStatus() {
  const [status,setStatus] = useState<Status | null>(null);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
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
  return <div className="panel"><div className="panel-head"><h4>SharePoint connection</h4><button type="button" onClick={()=>void refresh()}>Refresh</button></div><div style={{padding:16}}>
    <p>{status ? ({off:'Not enabled',read:'Read-only connection',write:'Test project connection enabled'}[status.mode] ?? 'Unknown') : 'Loading connection status…'}</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {status?.issues.map(i=><p key={i.id}><a href={`/issues/${i.id}`}>{i.reference}</a> · {i.sync?.status}{i.sync?.error ? ` · ${i.sync.error}` : ''}</p>)}
    {status?.jobs.map(j=><div key={j.id} style={{marginTop:12}}><span>{j.kind} · {j.status} · attempt {j.attempts}</span>{j.error && <p>{j.error}</p>}{j.status==='failed' && <button type="button" disabled={busy || status.mode!=='write'} onClick={()=>void retry(j.id)}>Retry</button>}</div>)}
    {status && !status.jobs.length && <p>No outstanding SharePoint jobs.</p>}
  </div></div>;
}
