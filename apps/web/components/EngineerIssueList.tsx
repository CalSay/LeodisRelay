'use client';
import Link from 'next/link';
import type {Issue} from '@/lib/types';
import type {OfficeWord} from '@/lib/cameBack';
import {PhotoImage} from './PhotoImage';
import {withViewReturn} from '@/lib/viewNavigation';
import {ISSUE_WORK} from '@/lib/status';
import {dateShort, dayShort} from '@/lib/dates';

/** What someone wrote back, who and when, in a line or two; the record's own page has the rest. */
export function WordLine({word}:{word:OfficeWord}) {
  return <p className="eng-word"><span>{word.by}{word.at ? ` wrote on ${dayShort(word.at)}` : ' wrote'}:</span> {word.note}</p>;
}

export interface IssueRow { issue: Issue; word?: OfficeWord | undefined; sentBack?: boolean }
export const isOpen=(i:Issue)=>i.work!=='closed'&&i.confirmation!=='withdrawn';

/** One project's issues as short cards: what, where, status and who is fixing it by when. */
export function EngineerIssueList({rows,empty,returnTo}:{rows:IssueRow[];empty:string;returnTo:string}){
  return <div className="eng-issue-list">{rows.length?rows.map(({issue:i,word,sentBack})=>{
    const photo=i.events.find(e=>e.photos.length)?.photos[0];
    const owner=i.owner.trim();
    return <Link href={withViewReturn(`/issues/${i.id}`,returnTo)} className={`eng-issue-card${word||sentBack?' late':''}`} key={i.id}>
      {photo && <div className="eng-issue-thumb"><PhotoImage src={photo.dataUrl} alt=""/></div>}
      <div className="eng-issue-copy"><div className="eng-issue-meta"><span className="lbl">{i.reference}</span><span className={`tag ${isOpen(i)?'tag-draft':'tag-sent'}`}>{i.confirmation==='withdrawn'?'Withdrawn':ISSUE_WORK[i.work]}</span>{sentBack && <span className="tag tag-alert">Sent back</span>}</div><h3>{i.description}</h3><p>{i.location||'Location not recorded'}</p>{word && <WordLine word={word}/>}{isOpen(i) && <p>Who is fixing it: {owner?`${owner}${i.targetDate?`, by ${dateShort(i.targetDate)}`:''}`:'Nobody yet'}</p>}</div>
    </Link>;
  }):empty && <p className="eng-help">{empty}</p>}</div>;
}
