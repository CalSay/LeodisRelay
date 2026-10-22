'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePrincipal} from './PrincipalContext';
import {PhotoImage} from './PhotoImage';
import {CameraIcon} from './CameraIcon';
import {capturePhoto,PhotoRefused,uploadPhotos} from '@/lib/localMedia';
import {clientId} from '@/lib/clientId';
import {validateDefect,type DefectInput} from '@/lib/defects';
import {DEFECT_RESULT_EVENT,defectKey,readHeldDefect,readReceipt,receiptKey,sendHeldDefect,type DefectResult,type DefectSendResult,type HeldDefect} from '@/lib/heldDefect';
import type {FixtureProject} from '@/lib/fixtures';
import type {Issue,Photo} from '@/lib/types';
import {failure} from '@/lib/failure';
import {withViewReturn} from '@/lib/viewNavigation';
import {projectSuggestions} from '@/lib/api';
import {Suggestions,TradeChoice} from './ObservationEditor';
type Draft=HeldDefect;
/** The receipt leads back to Site (2026-10-22): an engineer who has flagged a defect carries on with the visit. */
export function IndividualDefect({project,onIssues,onSite,returnTo}:{project:FixtureProject;onIssues:()=>void;onSite:()=>void;returnTo:string}){
  const principal=usePrincipal(),key=defectKey(String(principal?.id),project.id);
  const [draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false);
  // The same recent places a site update card offers (2026-10-21): free text, never a list to pick from.
  const [places,setPlaces]=useState<string[]>([]);
  const [error,setError]=useState(''),[retention,setRetention]=useState(''),[receipt,setReceipt]=useState<Pick<Issue,'id'|'reference'>|null>(null);
  /** Sent with no signal and gone by itself once RELAY got through (lib/heldDefect.ts, DefectsOnSignal). */
  const [byItself,setByItself]=useState(false);
  /** Refused as it is (not a lost signal): it does not go by itself, so the words do not say it will. */
  const [refused,setRefused]=useState(false);
  const sending=useRef(false),alertRef=useRef<HTMLParagraphElement>(null),current=useRef<Draft|null>(null);
  useEffect(()=>{current.current=draft;},[draft]);
  // The send button is at the bottom of a phone screen and the reason at the top: bring it into view.
  const [tries,setTries]=useState(0);
  useEffect(()=>{if(error)alertRef.current?.scrollIntoView({block:'center'});},[error,tries]);
  useEffect(()=>{
    let next:Draft={requestId:clientId(),projectId:project.id,description:'',location:'',affectedTrade:principal?.trade??'' as DefectInput['affectedTrade'],photos:[],pending:false};
    try{const old=readHeldDefect(localStorage.getItem(key),project.id);if(old){next=old;setRetention('Your unsent defect is back, as you left it.');}}catch{setRetention('This phone cannot keep a copy. Keep this page open until it is sent.');}setDraft(next);
  },[key,project.id,principal?.trade]);
  useEffect(()=>{let live=true;projectSuggestions(project.id).then(s=>{if(live)setPlaces(s.locations);}).catch(()=>{});return()=>{live=false;};},[project.id]);
  function retain(next:Draft){setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));setRetention('Kept on this phone · not sent yet');}catch{setRetention('This phone did not keep a copy. Keep this page open until it is sent.');}}
  async function addPhotos(files:FileList|null){if(!draft||!files||busy||draft.pending)return;if(draft.photos.length+files.length>8){setError('Use up to 8 photographs.');return;}setBusy(true);setError('');try{const added=[];for(const f of Array.from(files))added.push(await capturePhoto(f));retain({...draft,photos:[...draft.photos,...added]});}catch(e){setError(e instanceof Error?e.message:'The photograph could not be added.');}finally{setBusy(false);}}
  async function send(){
    if(!draft||sending.current)return;setTries(n=>n+1);const invalid=validateDefect(draft);if(invalid){setError(invalid);return;}
    // Freeze before sending: lost receipts retry the same ID and bytes, by a tap or by themselves.
    const submission={...draft,pending:true};retain(submission);await go(submission);
  }
  /** One send of the frozen defect (lib/heldDefect.ts): shared with a send by itself already running. */
  async function go(submission:Draft){
    sending.current=true;setBusy(true);setError('');
    try{settle(await sendHeldDefect(key,submission,false),false);}
    catch{setError('No signal, or no answer from RELAY. Your defect is kept on this phone.');}
    finally{sending.current=false;setBusy(false);}
  }
  function settle(result:DefectSendResult,itself:boolean){
    if(result.kind==='sent'){setByItself(itself);setReceipt(result.issue);return;}
    if(result.kind==='skipped')return;
    setError(result.reason);setRefused(result.kind==='refused');
    if(result.kind==='refused'&&result.editable)setDraft(d=>d&&{...d,pending:false});
  }
  // Sent by itself from this page (DefectsOnSignal) while it is on screen: shown here, not as a note at the top.
  // Sent from another tab: that tab leaves its receipt on the phone, so this one says so without sending again.
  useEffect(()=>{
    const onResult=(e:Event)=>{const {detail}=e as CustomEvent<DefectResult>;if(detail.key!==key||detail.requestId!==current.current?.requestId)return;e.preventDefault();settle(detail.result,true);};
    const onStorage=(e:StorageEvent)=>{const mine=current.current,issue=e.key===receiptKey(key)&&mine?.pending?readReceipt(e.newValue,mine.requestId):null;if(issue){setByItself(true);setReceipt(issue);}};
    window.addEventListener(DEFECT_RESULT_EVENT,onResult);window.addEventListener('storage',onStorage);
    return()=>{window.removeEventListener(DEFECT_RESULT_EVENT,onResult);window.removeEventListener('storage',onStorage);};
  },[key,project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!draft)return <p role="status">Opening defect draft…</p>;
  if(receipt)return <section className="eng-panel eng-defect-receipt"><div role="status"><span className="tag tag-sent">Received by RELAY</span><h1>Defect sent to the office</h1>{byItself && <p><strong>Sent by itself once there was signal.</strong></p>}<p>{receipt.reference} · {project.projectName}</p><p>It is on the project’s issue list now. It went on its own: your site update has not been sent.</p></div><div className="eng-defect-receipt-actions"><button type="button" className="eng-primary" onClick={onSite}>Back to Site</button><FixedAlready issue={receipt}/><Link className="eng-secondary" href={withViewReturn(`/issues/${receipt.id}`,returnTo)}>Open issue</Link><button type="button" className="eng-secondary" onClick={onIssues}>View project issues</button></div></section>;
  // Sent from the form (2026-10-21): the check screen only repeated what was on it. A send
  // without a receipt stays here, frozen, and goes by itself once there is signal;
  // "Try again" sends the same request now.
  const retry=draft.pending&&!busy;
  return <section className="eng-defect"><div className="eng-heading"><p className="lbl">Defect · {project.projectName}</p><h1>{retry?'Defect not sent yet':'Flag a defect'}</h1><p>Sent on its own, straight away. Your site update is not affected.</p></div>{error && <p ref={alertRef} className="note note-bad" role="alert">{error}</p>}
    {retry ? <section className="eng-panel"><h2>{project.projectName}</h2><p className="eng-help" role="status">{refused?<><b>RELAY did not take it.</b> It is kept on this phone. Tap “Try again”, or ask the office.</>:<><b>{navigator.onLine===false?'Waiting for signal.':'Waiting for RELAY to answer.'}</b> It is kept on this phone and goes to the office by itself as soon as {navigator.onLine===false?'there is signal':'it answers'}, while RELAY is open. Or tap “Try again”: it will only go once.</>}</p><dl className="eng-defect-summary"><dt>What needs attention</dt><dd>{draft.description}</dd><dt>Where</dt><dd>{draft.location}</dd><dt>Trade affected</dt><dd>{draft.affectedTrade}</dd><dt>Recorded by</dt><dd>{principal?.name} · {principal?.trade??'Trade not recorded'}</dd></dl><div className="eng-defect-photos">{draft.photos.map((p,i)=><PhotoImage key={p.id} src={p.dataUrl} alt={`Defect photograph ${i+1}`}/>)}</div><div className="btn-row"><button className="eng-primary" onClick={send}>Try again</button></div></section> : <>
      <fieldset disabled={busy||draft.pending} className="eng-defect-grid"><section className="eng-panel"><h2>Photo of the problem</h2><label className="eng-photo-picker"><CameraIcon /><span><b>{draft.photos.length?'Add another photo':'Take a photo'}</b><small>At least one · up to 8</small></span><input aria-label="Defect photographs" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label><div className="eng-defect-photos">{draft.photos.map((p,i)=><figure key={p.id}><PhotoImage src={p.dataUrl} alt={`Defect photograph ${i+1}`}/><button onClick={()=>retain({...draft,photos:draft.photos.filter(x=>x.id!==p.id)})}>Remove photo {i+1}</button></figure>)}</div><p className="eng-help">Recorded by {principal?.name} · {principal?.trade??'Trade not recorded'}.</p></section>
      <section className="eng-panel"><div className="field"><label htmlFor="defect-description">What needs attention?</label><textarea id="defect-description" maxLength={4000} value={draft.description} onChange={e=>retain({...draft,description:e.target.value})} placeholder="A short description of the defect"/></div><div className="field"><label htmlFor="defect-location">Where on site?</label><input type="text" id="defect-location" maxLength={300} value={draft.location} onChange={e=>retain({...draft,location:e.target.value})} placeholder="Room, floor or area"/><Suggestions compact title="Recent places" fewer="Show fewer places" values={places} current={draft.location} onPick={l=>retain({...draft,location:l})}/></div><div className="field"><TradeChoice value={draft.affectedTrade} onPick={t=>retain({...draft,affectedTrade:t})} hint={`${principal?.trade?'Set to your trade. Tap another trade if the work is theirs.':'Tap the trade whose work it is.'} “Other” covers the main contractor and other trades.`}/></div><button className="eng-primary" onClick={()=>void send()}>{busy&&draft.pending?'Sending…':`Send defect to ${project.projectName}`}</button><p className="hint">Everyone on this project can see it once sent.</p></section></fieldset><p className="eng-help" role="status">{busy?(draft.pending?'Sending…':'Preparing photographs…'):retention||'Not sent yet. Add a photo and a short description.'}</p>
    </>}
  </section>;
}
/**
 * Fixed on the spot (2026-10-22): an engineer who finds a small fault and fixes it there and then says so from the
 * receipt, with a photograph of the fix, rather than finding "Open issue" and the update on the issue page. The
 * first tap opens the camera. It is the issue page's "Put forward as fixed" (submit_closure, open to awaiting
 * verification): the office still checks it and someone other than the engineer closes it. Only on a receipt,
 * so only once the defect has reached RELAY.
 */
function FixedAlready({issue}:{issue:Pick<Issue,'id'|'reference'>}){
  const [photos,setPhotos]=useState<Photo[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
  const doneRef=useRef<HTMLParagraphElement>(null),boxRef=useRef<HTMLDivElement>(null),had=useRef(0);
  useEffect(()=>{if(done)doneRef.current?.focus();},[done]);
  // The camera input goes once there is a photo, a removed photo takes its button with it, and the camera comes back
  // when the last is removed: keep focus on the next step.
  useEffect(()=>{const before=had.current;had.current=photos.length;if(photos.length&&(!before||photos.length<before))boxRef.current?.querySelector<HTMLButtonElement>('.eng-primary')?.focus();else if(before&&!photos.length)boxRef.current?.querySelector<HTMLInputElement>('input')?.focus();},[photos.length]);
  async function addPhotos(files:FileList|null){if(!files?.length||busy)return;if(photos.length+files.length>8){setError('Use up to 8 photographs.');return;}setBusy(true);setError('');try{const added:Photo[]=[];for(const f of Array.from(files))added.push(await capturePhoto(f));setPhotos(p=>[...p,...added]);}catch(e){setError(e instanceof Error?e.message:'The photograph could not be added.');}finally{setBusy(false);}}
  async function putForward(){
    if(busy)return;setBusy(true);setError('');
    try{
      // The issue's current version, so a change made since it was raised is not written over.
      const r=await fetch(`/api/issues/${issue.id}`,{cache:'no-store'}),found=await r.json().catch(()=>({}));
      if(!r.ok)throw failure(r.status,found,'That was not recorded.');
      if(found.work==='awaiting_verification'){setDone(true);return;}
      await uploadPhotos(photos,{issueId:issue.id});
      const response=await fetch(`/api/issues/${issue.id}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedEtag:found.sync?.etag,kind:'submit_closure',note:'',photos})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw failure(response.status,body,'That was not recorded.');
      setDone(true);
    }catch(e){
      setError(e instanceof PhotoRefused?`A photograph was not accepted: ${e.reason?e.reason[0]!.toLowerCase()+e.reason.slice(1):'RELAY would not take it.'} Remove it and take it again.`
        :e instanceof Error&&!(e instanceof TypeError)?e.message:`No signal, so RELAY could not say it was put forward. ${photos.length?'Your photo is still here: try':'Try'} again when there is signal: it will only go once.${photos.length?' If you leave this page, the photo is not kept.':''}`);
    }finally{setBusy(false);}
  }
  if(done)return <p ref={doneRef} tabIndex={-1} className="eng-fixed-done"><b>Put forward as fixed.</b> The office will check it and close it. If it is not finished, it comes back to you.</p>;
  const camera=(first:boolean)=><label className={first?'eng-fixed-camera':'eng-fixed-camera eng-fixed-more'}>{first&&<CameraIcon/>}<span><b>{first?'Fixed it already?':'Add another photo'}</b>{first&&<small>Take a photo of the fix</small>}</span><input aria-label={first?'Fixed it already? Take a photo of the fix':'Add another photo of the fix'} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple disabled={busy} onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label>;
  return <div ref={boxRef} className={photos.length?'eng-fixed eng-fixed-open':'eng-fixed'}>
    {photos.length?<>
      <p className="eng-fixed-title"><b>Fixed it already?</b> Your photo of the fix:</p>
      <div className="eng-defect-photos">{photos.map((p,i)=><figure key={p.id}><PhotoImage src={p.dataUrl} alt={`Photograph of the fix ${i+1}`}/><button type="button" disabled={busy} onClick={()=>setPhotos(ps=>ps.filter(x=>x.id!==p.id))}>Remove photo {i+1}</button></figure>)}</div>
      <button type="button" className="eng-primary" disabled={busy} onClick={()=>void putForward()}>{busy?'Sending…':'Put forward as fixed'}</button>
      {photos.length<8&&camera(false)}
    </>:<>{camera(true)}<button type="button" className="eng-fixed-nophoto" disabled={busy} onClick={()=>void putForward()}>{busy?'Sending…':'No photo? Put forward as fixed'}</button></>}
    {error&&<p className="note note-bad" role="alert">{error}</p>}
  </div>;
}
