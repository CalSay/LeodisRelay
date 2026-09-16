'use client';
import './reports.css';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PhotoImage } from '@/components/PhotoImage';
import { getReport } from '@/lib/api';
import { acknowledgementStatus, deliveryStatus, reviewStatus } from '@/lib/status';
import { withViewReturn } from '@/lib/viewNavigation';
import type { Issue, Photo, Report, ReportSummary, Variation } from '@/lib/types';
import type { Ctx } from './ctx';
import { Mark, StubCard, type MarkKind } from './marks';
import { awaitingReview, byReceived, daysLate, fmtWhen, isClosed, isDisputed, isExposed, isNotReviewed, isOverdue, isUnassigned, isVerify, processingFailed, returned, shortRef } from './model';

/**
 * The Reports tab: every submitted report as a site diary, newest first,
 * grouped under the day it arrived. Filter, diary and preview scroll apart so
 * the preview stays on screen while the diary is read.
 */

const PAGE = 14;
const RETURN = '/office#/reports';
const LONDON = { timeZone: 'Europe/London' } as const;

const dayKey = (iso?: string): string => iso ? new Date(iso).toLocaleDateString('en-CA', LONDON) : '';
const timeOf = (iso?: string): string => iso ? new Date(iso).toLocaleTimeString('en-GB', { ...LONDON, hour: '2-digit', minute: '2-digit' }) : 'time not recorded';
const received = (r: ReportSummary): string | undefined => r.serverAcknowledgedAt ?? r.lastSavedAt;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function reportMark(r: ReportSummary): { kind: MarkKind; label: string } {
  if (r.sharepoint?.status === 'failed') return { kind: 'sync', label: 'SharePoint needs attention' };
  if (processingFailed(r)) return { kind: 'urgent', label: 'Processing needs attention' };
  if (awaitingReview(r)) return { kind: 'action', label: 'Awaiting review' };
  if (returned(r)) return { kind: 'action', label: 'Returned for changes' };
  return { kind: 'done', label: 'Received and on file' };
}
function issueMark(i: Issue, day: string): MarkKind {
  if (isOverdue(i, day)) return 'urgent';
  if (isVerify(i) || isUnassigned(i) || isDisputed(i) || isNotReviewed(i)) return 'action';
  return isClosed(i) ? 'done' : 'none';
}
function variationMark(v: Variation): MarkKind {
  if (isExposed(v)) return 'urgent';
  return v.instruction === 'pending' ? 'action' : v.instruction === 'instructed' ? 'done' : 'none';
}
const photosOf = (r?: Report | null): Photo[] => r ? r.observations.flatMap(o => o.photos) : [];
const summaryOf = (r?: Report | null): string => {
  const text = r?.observations.map(o => o.whatHappened.trim()).find(Boolean) ?? '';
  return text.replace(/\s+/g, ' ');
};
function relative(key: string, day: string): string {
  const ago = daysLate(key, day);
  if (ago <= 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago < 7) return `${ago} days ago`;
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** Full reports, fetched a few at a time as entries appear, kept for the life of the tab. */
function useFullReports(wanted: ReportSummary[]) {
  const cache = useRef(new Map<string, Report | null>());
  const inflight = useRef(new Set<string>());
  const [, setTick] = useState(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const keyOf = (r: ReportSummary) => `${r.id}:${r.revision}`;
  const wantedKey = wanted.map(keyOf).join('|');
  useEffect(() => {
    const queue = wanted.filter(r => !cache.current.has(keyOf(r)) && !inflight.current.has(keyOf(r)));
    queue.forEach(r => inflight.current.add(keyOf(r)));
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const k = keyOf(r);
        const full = await getReport(r.id).catch(() => undefined);
        cache.current.set(k, full ?? null);
        inflight.current.delete(k);
        if (alive.current) setTick(t => t + 1);
      }
    };
    for (let n = 0; n < 4; n++) void worker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey]);
  return (r: ReportSummary): Report | null | undefined => cache.current.get(keyOf(r));
}

export function ReportsView({ ctx }: { ctx: Ctx }) {
  const [project, setProject] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState<string | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement>(null);
  const keepScroll = useRef<number | null>(null);

  const all = useMemo(() => (ctx.snap?.reports ?? []).filter(r => r.state === 'submitted').sort(byReceived), [ctx.snap]);
  const pool = useMemo(() => project === 'all' ? all : all.filter(r => r.projectId === project), [all, project]);
  const shown = pool.slice(0, limit);
  const selected = pool.find(r => r.id === picked) ?? pool[0];
  const full = useFullReports(selected && !shown.includes(selected) ? [...shown, selected] : shown);

  useEffect(() => { if (side.current) side.current.scrollTop = 0; }, [selected?.id]);
  useLayoutEffect(() => {
    if (keepScroll.current !== null && feed.current) { feed.current.scrollTop = keepScroll.current; keepScroll.current = null; }
  }, [limit]);

  const pickProject = (id: string) => { setProject(id); setLimit(PAGE); if (feed.current) feed.current.scrollTop = 0; };
  const more = () => { keepScroll.current = feed.current?.scrollTop ?? null; setLimit(n => n + PAGE); };
  const projectOf = (id: string) => ctx.projects.find(p => p.id === id);
  const current = project === 'all' ? undefined : projectOf(project);

  const days: { key: string; list: ReportSummary[] }[] = [];
  for (const r of shown) {
    const key = dayKey(received(r));
    const last = days.at(-1);
    if (last && last.key === key) last.list.push(r); else days.push({ key, list: [r] });
  }

  return <div className="rv-cols">
    <div className="col rv-filter">
      <div className="col-head"><h4>Filter</h4><i>{ctx.snap ? plural(pool.length, 'report') : ''}</i></div>
      <div className="rv-rail-h" id="rv-projects-label">Projects</div>
      <div className="rv-rail" role="group" aria-labelledby="rv-projects-label">
        <button type="button" aria-pressed={project === 'all'} onClick={() => pickProject('all')}><span>All projects</span><i>{all.length}</i></button>
        {ctx.projects.map(p => <button key={p.id} type="button" aria-pressed={project === p.id} onClick={() => pickProject(p.id)}>
          <span><small>{p.projectNumber}</small>{p.projectName}</span><i>{all.filter(r => r.projectId === p.id).length}</i>
        </button>)}
      </div>
    </div>

    <div className="col focus rv-diary" ref={feed}>
      <div className="col-head"><h4>Site diary</h4><i>{current ? current.projectName : 'All projects'}</i></div>
      {!ctx.snap ? <div className="loading">Loading office records</div>
        : pool.length === 0 ? <div className="ro-empty"><b>No reports yet</b><span>{current ? `Nothing has been submitted for ${current.projectName}. Reports appear here once an engineer sends one.` : 'Reports appear here once an engineer sends one.'}</span></div>
        : <div className="rv-feed">
          {days.map(d => {
            const date = d.key ? new Date(`${d.key}T12:00:00Z`) : undefined;
            return <section key={d.key || 'undated'} className="rv-day" aria-label={date ? date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Date not recorded'}>
              <div className="rv-date" aria-hidden="true">
                {date ? <><span>{date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}</span><b>{date.getUTCDate()}</b><small>{relative(d.key, ctx.day)}</small></> : <><span>Undated</span><b>–</b></>}
              </div>
              <div className="rv-entries">
                {d.list.map(r => <Entry key={r.id} r={r} full={full(r)} code={projectOf(r.projectId)?.projectNumber ?? r.reference.split('-')[0]} name={projectOf(r.projectId)?.projectName ?? r.projectId} author={ctx.nameOf(r.authorId, r.author)} on={r.id === selected?.id} onPick={() => setPicked(r.id)} />)}
              </div>
            </section>;
          })}
          {pool.length > limit && <button type="button" className="rv-more" onClick={more}>Show earlier reports · {pool.length - limit} more</button>}
        </div>}
    </div>

    <div className="col rv-preview" ref={side}>
      <div className="col-head"><h4>Report preview</h4><i>{selected ? selected.reference : ''}</i></div>
      {!ctx.snap ? <div className="loading">Loading office records</div>
        : !selected ? <div className="ro-empty"><b>Nothing to preview</b><span>Select a report in the diary.</span></div>
        : <Preview ctx={ctx} r={selected} full={full(selected)} name={projectOf(selected.projectId)?.projectName ?? selected.projectId} />}
    </div>
  </div>;
}

function Tile({ photo, big }: { photo?: Photo; big?: boolean }) {
  return <span className={`rv-ph ${big ? 'big' : ''} ${photo ? '' : 'wait'}`}>{photo && <PhotoImage src={photo.dataUrl} alt={photo.caption || 'Site photo'} />}</span>;
}

function Entry({ r, full, code, name, author, on, onPick }: { r: ReportSummary; full: Report | null | undefined; code: string; name: string; author: string; on: boolean; onPick: () => void }) {
  const m = reportMark(r);
  const photos = photosOf(full);
  const tiles = Math.min(r.photoCount, 5);
  const extra = r.photoCount - 5;
  const summary = summaryOf(full);
  const variations = r.kindCounts?.instruction ?? 0;
  const defects = r.kindCounts ? r.kindCounts.defect ?? 0 : r.defectCount;
  const filing = awaitingReview(r) ? reviewStatus(r) : returned(r) ? reviewStatus(r) : deliveryStatus(r);
  return <button type="button" className={`rv-entry ${on ? 'on' : ''}`} aria-pressed={on} onClick={onPick}>
    <span className="rv-e-head">
      <span className="rv-code">{code} · {shortRef(r.reference)}</span>
      <span className="rv-e-title"><b>{name}</b><small>{author} · {timeOf(received(r))}</small></span>
      <Mark kind={m.kind} label={m.label} />
    </span>
    {tiles > 0 && <span className="rv-e-photos">
      {Array.from({ length: tiles }, (_, i) => i === 4 && extra > 0
        ? <span key={i} className="rv-ph-more" aria-label={`${extra} more photos`}>+{extra}</span>
        : <Tile key={i} photo={photos[i]} />)}
    </span>}
    {full === undefined ? <span className="rv-e-sum wait" aria-hidden="true" />
      : summary ? <span className="rv-e-sum">{summary}</span>
      : <span className="rv-e-sum quiet">{full === null ? 'Summary unavailable' : 'No written summary'}</span>}
    <span className="rv-e-chips">
      <span className="rv-chip"><Mark kind={m.kind} label={m.label} size="sm" />{filing?.label ?? m.label}</span>
      <span className="rv-chip plain">{r.acknowledged ? 'Read' : 'Not read'}</span>
      {defects > 0 && <span className="rv-chip plain">{plural(defects, 'defect')}</span>}
      {variations > 0 && <span className="rv-chip plain">{plural(variations, 'variation')}</span>}
      <span className="rv-chip plain">{plural(r.observationCount, 'section')}</span>
    </span>
  </button>;
}

function Preview({ ctx, r, full, name }: { ctx: Ctx; r: ReportSummary; full: Report | null | undefined; name: string }) {
  const issues = (ctx.snap?.issues ?? []).filter(i => i.raisedByReport === r.id);
  const variations = (ctx.snap?.variations ?? []).filter(v => v.raisedByReport === r.id);
  const photos = photosOf(full);
  const summary = summaryOf(full);
  const code = r.reference.split('-')[0];
  const visit = /^\d{4}-\d{2}-\d{2}/.test(r.visitDate) ? new Date(`${r.visitDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : r.visitDate;
  const notice = processingFailed(r) ? { cls: '', kind: (r.sharepoint?.status === 'failed' ? 'sync' : 'urgent') as MarkKind, title: r.sharepoint?.status === 'failed' ? 'SharePoint needs attention' : 'Processing needs attention', text: r.sharepoint?.error ?? r.deliveryError ?? 'The worker could not process this report.' }
    : awaitingReview(r) ? { cls: 'caution', kind: 'action' as MarkKind, title: 'Awaiting review', text: 'This project needs a review before the report is approved.' }
    : returned(r) ? { cls: 'caution', kind: 'action' as MarkKind, title: 'Returned for changes', text: r.reviewNote ?? 'Returned to the engineer for a correction.' }
    : null;
  const filing = deliveryStatus(r);
  const read = acknowledgementStatus(r);
  const pics = Math.min(r.photoCount, 3);
  return <div className="rv-doc">
    <div className="rv-doc-band">
      <div><div className="rv-eyebrow">Site progress report</div><h3>{name}</h3></div>
      <div className="rv-doc-ref">{shortRef(r.reference)} · Rev {r.revision}<br />{visit}</div>
    </div>
    <div className="rv-doc-body">
      {notice && <div className={`ro-alert rv-notice ${notice.cls}`}><Mark kind={notice.kind} label={notice.title} /><div><b>{notice.title}</b><span>{notice.text}</span></div></div>}
      {pics > 0 && <div className={`rv-doc-photos n${pics}`}>{Array.from({ length: pics }, (_, i) => <Tile key={i} photo={photos[i]} big={i === 0} />)}</div>}
      {full === undefined ? <p className="rv-doc-sum wait" aria-label="Loading summary" />
        : <p className={`rv-doc-sum ${summary ? '' : 'quiet'}`}>{summary || (full === null ? 'The full report could not be loaded.' : 'No written summary.')}</p>}
      <div className="rv-tally">
        <div><b>{r.observationCount}</b><span>Sections</span></div>
        <div><b>{r.photoCount}</b><span>Photos</span></div>
        <div><b>{issues.length}</b><span>Issues</span></div>
        <div><b>{variations.length}</b><span>Variations</span></div>
      </div>
      {issues.length > 0 && <div className="rv-raised"><h5>Issues raised</h5>
        {issues.map(i => <StubCard key={i.id} slim href={`#/projects/${i.projectId}/issue/${i.id}`} project={code} code={shortRef(i.reference)} title={i.description} mark={issueMark(i, ctx.day)} />)}
      </div>}
      {variations.length > 0 && <div className="rv-raised"><h5>Variations raised</h5>
        {variations.map(v => <StubCard key={v.id} slim href={`#/projects/${v.projectId}/variation/${v.id}`} project={code} code={shortRef(v.reference)} title={v.description} mark={variationMark(v)} />)}
      </div>}
      <dl className="rv-kv">
        <dt>Engineer</dt><dd>{ctx.nameOf(r.authorId, r.author)}{r.authorTrade ? ` · ${r.authorTrade}` : ''}</dd>
        <dt>Received</dt><dd>{fmtWhen(r.serverAcknowledgedAt)}</dd>
        {filing && <><dt>Filing</dt><dd>{filing.label}</dd></>}
        {read && <><dt>Read</dt><dd>{read.label}</dd></>}
      </dl>
      <div className="rv-actions">
        <Link className="btn" href={withViewReturn(`/reports/${r.id}/pdf`, RETURN)}>Open PDF</Link>
        <Link className="btn btn-q" href={withViewReturn(`/reports/${r.id}/preview`, RETURN)}>Full report</Link>
        <a className="btn btn-q" href={`#/projects/${r.projectId}/report/${r.id}`}>Open in register</a>
      </div>
    </div>
  </div>;
}
