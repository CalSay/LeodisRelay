'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Issue} from '@/lib/types';
import {usePrincipal} from './PrincipalContext';
import {PhotoImage} from './PhotoImage';

export function EngineerIssueList({issues,projectName}:{issues:Issue[];projectName:string}){
  const principal=usePrincipal();
  const [filter,setFilter]=useState('open');
  const open=(i:Issue)=>i.work!=='closed'&&i.confirmation!=='withdrawn';
  const shown=issues.filter(i=>filter==='all' || (filter==='mine' ? i.reportedById===principal?.id||i.events[0]?.actorId===principal?.id : open(i)));
  const labels={open:'Open',assigned:'Assigned',in_progress:'In progress',awaiting_verification:'Ready for verification',closed:'Closed'};
  return <><div className="eng-issue-tabs" role="group" aria-label={`Filter issues on ${projectName}`}>
    {([['open','Open'],['mine','Reported by me'],['all','All issues']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}
  </div><div className="eng-issue-list">{shown.length?shown.map(i=>{
    const photo=i.events.find(e=>e.photos.length)?.photos[0];
    return <Link href={`/issues/${i.id}`} className="eng-issue-card" key={i.id}>
      {photo && <div className="eng-issue-thumb"><PhotoImage src={photo.dataUrl} alt=""/></div>}
      <div className="eng-issue-copy"><span className="lbl">{i.reference}</span><h3>{i.description}</h3><p>{projectName} · {i.location||'Location not recorded'}</p><div className="eng-issue-meta"><span className={`tag ${open(i)?'tag-draft':'tag-sent'}`}>{i.confirmation==='withdrawn'?'Withdrawn':labels[i.work]}</span><span>{i.affectedTrade??'Trade not recorded'}</span></div><p>Reported by {i.reportedBy??i.events[0]?.actor??'Not recorded'}{i.reporterTrade?` · ${i.reporterTrade}`:''}</p><small>{i.source==='individual'?'Individual defect':'From a site update'} · Open issue →</small></div>
    </Link>;
  }):<p className="eng-help">{filter==='mine'?'You have not reported any issues on this project.':filter==='open'?'No open issues on this project.':'No issues have been raised on this project.'}</p>}</div></>;
}
