'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {usePrincipal} from './PrincipalContext';
import {PhotoImage} from './PhotoImage';
import {CameraIcon} from './CameraIcon';
import {capturePhoto} from '@/lib/localMedia';
import {clientId} from '@/lib/clientId';
import {DEFECT_TRADES,validateDefect,type DefectInput} from '@/lib/defects';
import {DEFECT_RESULT_EVENT,defectKey,readHeldDefect,readReceipt,receiptKey,sendHeldDefect,type DefectResult,type DefectSendResult,type HeldDefect} from '@/lib/heldDefect';
import type {FixtureProject} from '@/lib/fixtures';
import type {Issue} from '@/lib/types';
import {withViewReturn} from '@/lib/viewNavigation';
import {projectSuggestions} from '@/lib/api';
import {Suggestions} from './ObservationEditor';
type Draft=HeldDefect;
export function IndividualDefect({project,onIssues,returnTo}:{project:FixtureProject;onIssues:()=>void;returnTo:string}){
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
    try{const old=readHeldDefect(localStorage.getItem(key),project.id);if(old){next=old;setRetention('Draft restored on this device.');}}catch{setRetention('Device draft storage is unavailable. Keep this page open.');}setDraft(next);
  },[key,project.id,principal?.trade]);
  useEffect(()=>{let live=true;projectSuggestions(project.id).then(s=>{if(live)setPlaces(s.locations);}).catch(()=>{});return()=>{live=false;};},[project.id]);
  function retain(next:Draft){setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));setRetention('Draft held on this device · Not submitted');}catch{setRetention('Draft not saved on this device. Keep this page open.');}}
  async function addPhotos(files:FileList|null){if(!draft||!files||busy||draft.pending)return;if(draft.photos.length+files.length>8){setError('Use up to 8 photographs.');return;}setBusy(true);setError('');try{const added=[];for(const f of Array.from(files))added.push(await capturePhoto(f));retain({...draft,photos:[...draft.photos,...added]});}catch(e){setError(e instanceof Error?e.message:'Unable to retain photograph.');}finally{setBusy(false);}}
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
  if(receipt)return <section className="eng-panel eng-defect-receipt" role="status"><span className="tag tag-sent">Received by RELAY</span><h1>Defect sent to the office</h1>{byItself && <p><strong>Sent by itself once there was signal.</strong></p>}<p>{receipt.reference} · {project.projectName}</p><p>It is on the project’s issue list now. It went on its own: your site update has not been sent.</p><div className="btn-row"><Link className="eng-primary" href={withViewReturn(`/issues/${receipt.id}`,returnTo)}>Open issue →</Link><button onClick={onIssues}>View project issues</button></div></section>;
  // Sent from the form (2026-10-21): the check screen only repeated what was on it. A send
  // without a receipt stays here, frozen, and goes by itself once there is signal;
  // "Try again" sends the same request now.
  const retry=draft.pending&&!busy;
  return <section className="eng-defect"><div className="eng-heading"><p className="lbl">Defect · {project.projectName}</p><h1>{retry?'Defect not sent yet':'Flag a defect'}</h1><p>Sent on its own, straight away. Your site update is not affected.</p></div>{error && <p ref={alertRef} className="note note-bad" role="alert">{error}</p>}
    {retry ? <section className="eng-panel"><h2>{project.projectName}</h2><p className="eng-help" role="status">{refused?<><b>RELAY did not take it.</b> It is kept on this phone. Tap “Try again”, or ask the office.</>:<><b>{navigator.onLine===false?'Waiting for signal.':'Waiting for RELAY’s server.'}</b> It is kept on this phone and goes to the office by itself as soon as {navigator.onLine===false?'there is signal':'it answers'}, while RELAY is open. Or tap “Try again”: it will only go once.</>}</p><dl className="eng-defect-summary"><dt>What needs attention</dt><dd>{draft.description}</dd><dt>Location</dt><dd>{draft.location}</dd><dt>Trade affected</dt><dd>{draft.affectedTrade}</dd><dt>Recorded by</dt><dd>{principal?.name} · {principal?.trade??'Trade not recorded'}</dd></dl><div className="eng-defect-photos">{draft.photos.map((p,i)=><PhotoImage key={p.id} src={p.dataUrl} alt={`Defect photograph ${i+1}`}/>)}</div><div className="btn-row"><button className="eng-primary" onClick={send}>Try again</button></div></section> : <>
      <fieldset disabled={busy||draft.pending} className="eng-defect-grid"><section className="eng-panel"><h2>Capture the problem</h2><label className="eng-photo-picker"><CameraIcon /><span><b>{draft.photos.length?'Add another photo':'Take a photo'}</b><small>At least one · up to 8</small></span><input aria-label="Defect photographs" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={e=>{void addPhotos(e.target.files);e.target.value='';}}/></label><div className="eng-defect-photos">{draft.photos.map((p,i)=><figure key={p.id}><PhotoImage src={p.dataUrl} alt={`Defect photograph ${i+1}`}/><button onClick={()=>retain({...draft,photos:draft.photos.filter(x=>x.id!==p.id)})}>Remove photo {i+1}</button></figure>)}</div><p className="eng-help">Recorded by {principal?.name} · {principal?.trade??'Trade not recorded'}.</p></section>
      <section className="eng-panel"><div className="field"><label htmlFor="defect-description">What needs attention?</label><textarea id="defect-description" maxLength={4000} value={draft.description} onChange={e=>retain({...draft,description:e.target.value})} placeholder="A short description of the defect"/></div><div className="field"><label htmlFor="defect-location">Where on site?</label><input type="text" id="defect-location" maxLength={300} value={draft.location} onChange={e=>retain({...draft,location:e.target.value})} placeholder="Room, floor or area"/><Suggestions compact title="Recent places" fewer="Show fewer places" values={places} current={draft.location} onPick={l=>retain({...draft,location:l})}/></div><div className="field"><label htmlFor="defect-trade">Trade affected</label><select id="defect-trade" value={draft.affectedTrade} onChange={e=>retain({...draft,affectedTrade:e.target.value as DefectInput['affectedTrade']})}><option value="" disabled>Choose a trade</option>{DEFECT_TRADES.map(t=><option key={t}>{t}</option>)}</select><p className="hint">Defaults to your trade; change only when needed.</p></div><button className="eng-primary" onClick={()=>void send()}>{busy&&draft.pending?'Sending…':`Send defect to ${project.projectName}`}</button><p className="hint">Everyone on this project can see it once sent.</p></section></fieldset><p className="eng-help" role="status">{busy?(draft.pending?'Sending…':'Preparing photographs…'):retention||'Not sent yet. Add a photo and a short description.'}</p>
    </>}
  </section>;
}
