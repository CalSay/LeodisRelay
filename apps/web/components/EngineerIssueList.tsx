'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Issue} from '@/lib/types';
import {usePrincipal} from './PrincipalContext';
import {PhotoImage} from './PhotoImage';
import {withViewReturn} from '@/lib/viewNavigation';
import {ISSUE_WORK} from '@/lib/status';
import {dateShort} from '@/lib/dates';

export function EngineerIssueList({issues,projectName,returnTo}:{issues:Issue[];projectName:string;returnTo:string}){
  const principal=usePrincipal();
  const [filter,setFilter]=useState('open');
  const open=(i:Issue)=>i.work!=='closed'&&i.confirmation!=='withdrawn';
  const shown=issues.filter(i=>filter==='all' || (filter==='mine' ? i.reportedById===principal?.id||i.events[0]?.actorId===principal?.id : open(i)));
  return <><div className="eng-issue-tabs" role="group" aria-label={`Filter issues on ${projectName}`}>
    {([['open','Open'],['mine','Reported by me'],['all','All issues']] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}
  </div><div className="eng-issue-list">{shown.length?shown.map(i=>{
    const photo=i.events.find(e=>e.photos.length)?.photos[0];
    const owner=i.owner.trim();
    return <Link href={withViewReturn(`/issues/${i.id}`,returnTo)} className="eng-issue-card" key={i.id}>
      {photo && <div className="eng-issue-thumb"><PhotoImage src={photo.dataUrl} alt=""/></div>}
      <div className="eng-issue-copy"><div className="eng-issue-meta"><span className="lbl">{i.reference}</span><span className={`tag ${open(i)?'tag-draft':'tag-sent'}`}>{i.confirmation==='withdrawn'?'Withdrawn':ISSUE_WORK[i.work]}</span></div><h3>{i.description}</h3><p>{i.location||'Location not recorded'}</p>{open(i) && <p>Who is fixing it: {owner?`${owner}${i.targetDate?`, by ${dateShort(i.targetDate)}`:''}`:'Nobody yet'}</p>}</div>
    </Link>;
  }):<p className="eng-help">{filter==='mine'?'You have not reported any issues on this project.':filter==='open'?'No open issues on this project.':'No issues have been raised on this project.'}</p>}</div></>;
}
