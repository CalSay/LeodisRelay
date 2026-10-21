'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePrincipal} from './PrincipalContext';
import {PhotoImage} from './PhotoImage';
import {CameraIcon} from './CameraIcon';
import {capturePhoto,localBlob} from '@/lib/localMedia';
import {clientId} from '@/lib/clientId';
import {DEFECT_TRADES,validateDefect,type DefectInput} from '@/lib/defects';
import type {FixtureProject} from '@/lib/fixtures';
import type {Issue} from '@/lib/types';
import {withViewReturn} from '@/lib/viewNavigation';
import {projectSuggestions} from '@/lib/api';
import {Suggestions} from './ObservationEditor';
type Draft=DefectInput & {pending:boolean};
export function IndividualDefect({project,onIssues,returnTo}:{project:FixtureProject;onIssues:()=>void;returnTo:string}){
  const principal=usePrincipal(),key=`relay-defect:${principal?.id}:${project.id}`;
  const [draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false);
  // The same recent places a site update card offers (2026-10-21): free text, never a list to pick from.
  const [places,setPlaces]=useState<string[]>([]);
  const [error,setError]=useState(''),[retention,setRetention]=useState(''),[receipt,setReceipt]=useState<Issue|null>(null);
  const sending=useRef(false),alertRef=useRef<HTMLParagraphElement>(null);
  // The send button is at the bottom of a phone screen and the reason at the top: bring it into view.
  const [tries,setTries]=useState(0);
  useEffect(()=>{if(error)alertRef.current?.scrollIntoView({block:'center'});},[error,tries]);
  useEffect(()=>{
    let next:Draft={requestId:clientId(),projectId:project.id,description:'',location:'',affectedTrade:principal?.trade??'' as DefectInput['affectedTrade'],photos:[],pending:false};
    try{const old=JSON.parse(localStorage.getItem(key)??'null');if(old && old.projectId===project.id && typeof old.requestId==='string' && typeof old.description==='string' && typeof old.location==='string' && typeof old.affectedTrade==='string' && Array.isArray(old.photos) && old.photos.every((p: {id?:string;dataUrl?:string})=>p?.id && p.dataUrl===`/api/media/${p.id}`)){next=old;setRetention('Draft restored on this device.');}}catch{setRetention('Device draft storage is unavailable. Keep this page open.');}setDraft(next);
  },[key,project.id,principal?.trade]);
  useEffect(()=>{let live=true;projectSuggestions(project.id).then(s=>{if(live)setPlaces(s.locations);}).catch(()=>{});return()=>{live=false;};},[project.id]);
  function retain(next:Draft){setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));setRetention('Draft held on this device · Not submitted');}catch{setRetention('Draft not saved on this device. Keep this page open.');}}
  async function addPhotos(files:FileList|null){if(!draft||!files||busy||draft.pending)return;if(draft.photos.length+files.length>8){setError('Use up to 8 photographs.');return;}setBusy(true);setError('');try{const added=[];for(const f of Array.from(files))added.push(await capturePhoto(f));retain({...draft,photos:[...draft.photos,...added]});}catch(e){setError(e instanceof Error?e.message:'Unable to retain photograph.');}finally{setBusy(false);}}
  async function send(){
    if(!draft||sending.current)return;setTries(n=>n+1);const invalid=validateDefect(draft);if(invalid){setError(invalid);return;}
    sending.current=true;setBusy(true);setError('');
    // Freeze before sending: lost receipts retry the same ID and bytes.
    const submission={...draft,pending:true};retain(submission);
    try{const form=new FormData();form.set('defect',JSON.stringify(submission));let size=0;
      for(const p of submission.photos){const blob=await localBlob(p.id);if(!blob)throw Error('A photograph is missing from this device. Keep this draft and contact the office.');size+=blob.size;form.set(p.id,blob,p.id);}
      if(size>40*1024*1024){retain({...submission,pending:false});throw Error('Use photographs totalling no more than 40 MB.');}
      const response=await fetch('/api/issues',{method:'POST',body:form}),data=await response.json();
      if(!response.ok){if(response.status===422||response.status===413)retain({...submission,pending:false});throw Error(data.reason??'Submission failed. Retry to check whether it was received.');}
      setReceipt(data);try{const held=JSON.parse(localStorage.getItem(key)??'null');if(held?.requestId===submission.requestId)localStorage.removeItem(key);}catch{}
    }catch(e){setError(e instanceof TypeError?'No signal, or no answer from RELAY. Your defect is kept on this phone.':e instanceof Error?e.message:'No receipt received. Retry the same submission when connected.');}finally{sending.current=false;setBusy(false);}
  }
  if(!draft)return <p role="status">Opening defect draft…</p>;
  if(receipt)return <section className="eng-panel eng-defect-receipt" role="status"><span className="tag tag-sent">Received by RELAY</span><h1>Defect sent to the office</h1><p>{receipt.reference} · {project.projectName}</p><p>It is on the project’s issue list now. It went on its own: your site update has not been sent.</p><div className="btn-row"><Link className="eng-primary" href={withViewReturn(`/issues/${receipt.id}`,returnTo)}>Open issue →</Link><button onClick={onIssues}>View project issues</button></div></section>;
  // Sent from the form (2026-10-21): the check screen only repeated what was on it. A send
  // without a receipt stays here, frozen, until "Try again" gets one for the same request.
  const retry=draft.pending&&!busy;
  return <section className="eng-defect"><div className="eng-heading"><p className="lbl">Defect · {project.projectName}</p><h1>{retry?'Defect not sent yet':'Flag a defect'}</h1><p>Sent on its own, straight away. Your site update is not affected.</p></div>{error && <p ref={alertRef} className="note note-bad" role="alert">{error}</p>}
    {retry ? <section className="eng-panel"><h2>{project.projectName}</h2><p className="eng-help">RELAY has not confirmed it got this defect. Try again when you have signal: it will only go once.</p><dl className="eng-defect-summary"><dt>What needs attention</dt><dd>{draft.description}</dd><dt>Location</dt><dd>{draft.location}</dd><dt>Trade affected</dt><dd>{draft.affectedTrade}</dd><dt>Recorded by</dt><dd>{principal?.name} · {principal?.trade??'Trade not recorded'}</dd></dl><div className="eng-defect-photos">{draft.photos.map((p,i)=><PhotoImage key={p.id} src={p.dataUrl} alt={`Defect photograph ${i+1}`}/>)}</div><div className="btn-row"><button className="eng-primary" onClick={send}>Try again</button></div></section> : <>
      <fieldset disabled={busy||draft.pending} className="eng-defect-grid"><section className="eng-panel"><h2>Capture the problem</h2><label className="eng-photo-picker"><CameraIcon /><span><b>{draft.photos.length?'Add another photo':'Take a photo'}</b><small>At least one · up to 8</small></span><input aria-label="Defect photographs" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label><div className="eng-defect-photos">{draft.photos.map((p,i)=><figure key={p.id}><PhotoImage src={p.dataUrl} alt={`Defect photograph ${i+1}`}/><button onClick={()=>retain({...draft,photos:draft.photos.filter(x=>x.id!==p.id)})}>Remove photo {i+1}</button></figure>)}</div><p className="eng-help">Recorded by {principal?.name} · {principal?.trade??'Trade not recorded'}.</p></section>
      <section className="eng-panel"><div className="field"><label htmlFor="defect-description">What needs attention?</label><textarea id="defect-description" maxLength={4000} value={draft.description} onChange={e=>retain({...draft,description:e.target.value})} placeholder="A short description of the defect"/></div><div className="field"><label htmlFor="defect-location">Where on site?</label><input type="text" id="defect-location" maxLength={300} value={draft.location} onChange={e=>retain({...draft,location:e.target.value})} placeholder="Room, floor or area"/><Suggestions compact title="Recent places" fewer="Show fewer places" values={places} current={draft.location} onPick={l=>retain({...draft,location:l})}/></div><div className="field"><label htmlFor="defect-trade">Trade affected</label><select id="defect-trade" value={draft.affectedTrade} onChange={e=>retain({...draft,affectedTrade:e.target.value as DefectInput['affectedTrade']})}><option value="" disabled>Choose a trade</option>{DEFECT_TRADES.map(t=><option key={t}>{t}</option>)}</select><p className="hint">Defaults to your trade; change only when needed.</p></div><button className="eng-primary" onClick={()=>void send()}>{busy&&draft.pending?'Sending…':`Send defect to ${project.projectName}`}</button><p className="hint">Everyone on this project can see it once sent.</p></section></fieldset><p className="eng-help" role="status">{busy?(draft.pending?'Sending…':'Preparing photographs…'):retention||'Not sent yet. Add a photo and a short description.'}</p>
    </>}
  </section>;
}
