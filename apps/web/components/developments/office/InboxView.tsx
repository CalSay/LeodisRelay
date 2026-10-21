'use client';
import { useEffect, useState } from 'react';
import { isNewReport, previousWorkingDay, sinceWords } from '@/lib/officeActions';
import type { ReportSummary } from '@/lib/types';
import type { Ctx } from './ctx';
import { BtnQ, DeliveryTag, Found, ReviewTag, Tag } from './bits';
import { ReportReader } from './ProjectsView';
import { awaitingReview, byReceived, fmtWhen, notAcknowledged, notNotified, processingFailed, returned, shortRef } from './model';

type Filter = 'all' | 'new' | 'notAck' | 'review' | 'returned' | 'notNotified' | 'failed' | 'drafts';
const FILTERS: [Filter, string, boolean][] = [['all', 'All', false], ['new', 'New', false], ['notAck', 'Not yet read', false], ['review', 'To review', true], ['returned', 'Returned', false], ['notNotified', 'PM not notified', false], ['failed', 'Processing failed', true], ['drafts', 'Drafts on site', false]];
// What an empty list means, in words, for each filter.
/** Before anything has come in: what arrives here. */
const FIRST = 'No reports have come in yet. Each report arrives here when an engineer signs and sends it from site; drafts still being written on site show under Drafts on site.';
const EMPTY: Record<Filter, string> = { all: 'No reports received yet', new: 'No new reports', notAck: 'Every report has been read', review: 'No report is waiting for review', returned: 'No report has been returned', notNotified: 'Every project manager has been notified', failed: 'No report failed processing', drafts: 'No drafts saved to the server' };

/** Every report received, newest first, with the reader beside it. */
export function InboxView({ ctx }: { ctx: Ctx }) {
  // #/inbox/show/<filter> opens on that filter, from the office position's groups.
  const linked = ctx.route.a === 'show' ? FILTERS.find(([k]) => k === ctx.route.b)?.[0] : undefined;
  const [chosen, setFilter] = useState<Filter>(linked ?? 'all');
  // The tab itself (no record or filter in the route) starts again from all.
  const bare = !ctx.route.a;
  useEffect(() => { if (linked) setFilter(linked); else if (bare) setFilter('all'); }, [linked, bare]);
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const snap = ctx.snap;
  const selected = ctx.route.a === 'show' ? null : ctx.route.a;
  const since = previousWorkingDay(ctx.day);
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = (r: ReportSummary) => (!project || r.projectId === project) && (!trade || r.authorTrade === trade);
  const reports = snap.reports.filter(scoped).sort(byReceived);
  const drafts = snap.drafts.filter(scoped);
  const counts: Record<Filter, number> = { all: reports.length, new: reports.filter(r => isNewReport(r, since)).length, notAck: reports.filter(notAcknowledged).length, review: reports.filter(awaitingReview).length, returned: reports.filter(returned).length, notNotified: reports.filter(notNotified).length, failed: reports.filter(processingFailed).length, drafts: drafts.length };
  // The review filters only exist where review is used, for the project in view; it is off by default.
  const reviewOn = project ? !!ctx.statOf(project)?.reviewOn : ctx.reviewOn;
  const filters = reviewOn ? FILTERS : FILTERS.filter(([k]) => k !== 'review' && k !== 'returned');
  // A chosen filter that is no longer offered falls back to all, rather than an empty list with nothing selected.
  const filter = filters.some(([k]) => k === chosen) ? chosen : 'all';
  const shown = filter === 'new' ? reports.filter(r => isNewReport(r, since)) : filter === 'notNotified' ? reports.filter(notNotified) : filter === 'failed' ? reports.filter(processingFailed) : filter === 'notAck' ? reports.filter(notAcknowledged) : filter === 'review' ? reports.filter(awaitingReview) : filter === 'returned' ? reports.filter(returned) : reports;
  const week = Date.now() - 7 * 86400000;
  const narrowed = !!(project || trade);
  const clear = () => { setProject(''); setTrade(''); };
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  return <div className="view">
    <div className="pagehead"><div><h2>Inbox</h2><p>{snap.reports.length} report{snap.reports.length === 1 ? '' : 's'} received · {snap.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week).length} this week · {counts.notAck} not yet read · {snap.drafts.length} draft{snap.drafts.length === 1 ? '' : 's'} in progress on site</p></div></div>
    <div className="filters">
      {filters.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)} title={k === 'new' ? `Received ${sinceWords(since, ctx.day)}` : undefined}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{['Electrical', 'HVAC', 'P&H'].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      {narrowed && <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button>}
    </div>
    {filter === 'drafts' ? <div className="panel"><table className="reg cards"><thead><tr><th>Reference</th><th>Project</th><th>Engineer</th><th>Visit</th><th>Saved</th><th>Sections</th><th><span className="sr">Action</span></th></tr></thead><tbody>
      {drafts.length ? drafts.map(r => <tr key={r.id}><td className="c-ref"><span className="ref">{r.reference}</span>{r.revision > 1 && <div className="rowsub">rev {r.revision}</div>}</td><td data-label="Project">{name(r.projectId)}</td><td data-label="Engineer">{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due" data-label="Visit">{r.visitDate}</td><td className="due" data-label="Saved">{fmtWhen(r.lastSavedAt)}</td><td className="num" data-label="Sections">{r.observationCount}</td><td data-label="State"><Tag label={r.corrects ? 'Correction' : 'Draft'} cls="tag-caution" /></td></tr>) : <tr><td colSpan={7} className="empty">{EMPTY.drafts}{narrowed ? ' for these filters' : ''}.</td></tr>}
    </tbody></table><div className="panel-foot">Draft contents are private until submitted. Work held only on an engineer’s device is not visible here.</div></div>
    : <div className="two-wide">
      <div className="panel"><table className="reg cards"><thead><tr><th>Reference</th><th>Project</th><th>Engineer</th><th>Received</th><th>Found</th><th>Status</th></tr></thead><tbody>
        {shown.length ? shown.map(r => <tr key={r.id} className={`clickable ${selected === r.id ? 'sel' : ''}`} onClick={() => ctx.go(`#/inbox/${r.id}`)}>
          <td className="c-ref"><span className="ref">{r.reference}</span>{r.revision > 1 && <div className="rowsub">rev {r.revision}</div>}</td><td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{name(r.projectId)}</div></td><td data-label="Engineer">{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due" data-label="Received">{fmtWhen(r.serverAcknowledgedAt)}</td><td data-label="Found"><Found r={r} /></td>
          <td data-label="Status"><div className="found">{r.review === 'pending' || r.review === 'returned' ? <ReviewTag r={r} /> : <DeliveryTag r={r} />}{r.acknowledged && <Tag label="Read" cls="tag-ok" />}</div></td></tr>) : <tr><td colSpan={6} className="empty">{snap.reports.length === 0 && !narrowed ? FIRST : <>{filter === 'new' ? `No reports received ${sinceWords(since, ctx.day)}` : EMPTY[filter]}{narrowed ? ' for these filters' : ''}.</>}{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
      </tbody></table><div className="panel-foot">Newest first. “Found” says what the visit raised, not how many cards were typed. A report is on file once received; the email to the project manager is only a notification that it came in.</div></div>
      <div className="panel"><div className="panel-head"><h3>Reader</h3>{selected && <a className="more" href={`#/projects/${code(shown.find(r => r.id === selected)?.projectId ?? snap.reports.find(r => r.id === selected)?.projectId ?? '')}/report/${selected}`}>In its project →</a>}</div>
        <div style={{ padding: 12 }}>{selected ? <ReportReader ctx={ctx} id={selected} crumbsHome="#/inbox" /> : <div className="empty">{shown.length ? <>Select a report to read it here.<br /><BtnQ className="btn-sm" style={{ marginTop: 12 }} onClick={() => ctx.go(`#/inbox/${shown[0].id}`)}>Open the newest</BtnQ></> : 'Nothing to read in this list.'}</div>}</div></div>
    </div>}
  </div>;
}
