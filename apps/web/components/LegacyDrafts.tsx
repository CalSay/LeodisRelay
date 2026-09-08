'use client';
import { useState } from 'react';
export default function LegacyDrafts({drafts,users}: {drafts:{id:string;reference:string;author:string}[];users:{id:string;name:string;email:string}[]}) {
  const [selected,setSelected] = useState<Record<string,string>>({});
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  if (!drafts.length) return null;
  async function assign(id:string) {
    setBusy(true); setMessage('');
    try {
      const res = await fetch('/api/admin/legacy-drafts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reportId:id,authorId:selected[id]})});
      const body = await res.json();
      if (!res.ok) throw new Error(body.reason ?? 'Assignment failed.');
      window.location.reload();
    } catch (e) {setMessage(e instanceof Error ? e.message : 'Assignment failed.');}
    finally {setBusy(false);}
  }
  return <section><h2>Assign older drafts</h2><p>These drafts predate account IDs. Confirm the original author before assigning. Only a signed-in account can be selected; draft contents stay private.</p>
    {drafts.map(r => <div className="panel" key={r.id}><div className="panel-body"><p>{r.reference} · recorded author: {r.author}</p><label htmlFor={`owner-${r.id}`}>Verified original author</label><select id={`owner-${r.id}`} value={selected[r.id] ?? ''} onChange={e => setSelected({...selected,[r.id]:e.target.value})}><option value="">Choose an account</option>{users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select><button disabled={busy || !selected[r.id]} onClick={() => assign(r.id)}>Assign draft ownership</button></div></div>)}
    <p role="status">{message}</p></section>;
}
