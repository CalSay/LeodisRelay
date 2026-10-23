'use client';
import { useEffect, useRef, useState } from 'react';
import { isNewReport, previousWorkingDay, sinceWords } from '@/lib/officeActions';
import type { ReportSummary } from '@/lib/types';
import type { Ctx } from './ctx';
import { DeliveryTag, Found, ReviewTag, Tag } from './bits';
import { ReportReader } from './ProjectsView';
import { awaitingReview, byReceived, fmtReceived, fmtWhen, notSeen, processingFailed, returned, shortRef } from './model';

type Filter = 'all' | 'new' | 'notAck' | 'review' | 'returned' | 'failed' | 'drafts';
const FILTERS: [Filter, string, boolean][] = [['all', 'All', false], ['new', 'New', false], ['notAck', 'Not seen yet', false], ['review', 'To review', true], ['returned', 'Returned', false], ['failed', 'Processing failed', true], ['drafts', 'Drafts on site', false]];
// What an empty list means, in words, for each filter.
/** Before anything has come in: what arrives here. */
const FIRST = 'No reports have come in yet. Each report arrives here when an engineer signs and sends it from site; drafts still being written on site show under Drafts on site.';
const EMPTY: Record<Filter, string> = { all: 'No reports received yet', new: 'No new reports', notAck: 'Every report from the last two weeks has been seen', review: 'No report is waiting for review', returned: 'No report has been returned', failed: 'No report failed processing', drafts: 'No drafts saved to the server' };

/** Under "Not seen yet": the reports over two weeks old nobody opened, which the figure leaves out. */
const olderWords = (n: number, listed: boolean): string => {
  const one = n === 1;
  return `${n} ${one ? 'report' : 'reports'} received more than two weeks ago ${one ? 'was' : 'were'} never opened${listed ? `; ${one ? 'it is' : 'they are'} listed after the newer ones` : ` and ${one ? 'is' : 'are'} not counted`}.`;
};

/** Every report received, newest first, with the reader beside it. */
export function InboxView({ ctx }: { ctx: Ctx }) {
  // #/inbox/show/<filter> opens on that filter, from the office position's groups.
  const linked = ctx.route.a === 'show' ? FILTERS.find(([k]) => k === ctx.route.b)?.[0] : undefined;
  const [chosen, setFilter] = useState<Filter>(linked ?? 'all');
  // The tab itself (no record or filter in the route) starts again from all.
  const bare = !ctx.route.a;
  const selected = ctx.route.a === 'show' ? null : ctx.route.a;
  // On a phone the open report has the screen to itself. Picking a report
  // notes the filter and where the list was scrolled to on the list's own
  // history entry, so going back to it (by "‹ Inbox" or the phone's Back)
  // lands in the same place with the same filter. The Inbox tab makes a new
  // entry without that note, so it still starts again from all.
  const fromList = useRef(false);
  const phone = () => window.matchMedia('(max-width:700px)').matches;
  useEffect(() => {
    if (selected) { if (phone()) window.scrollTo(0, 0); return; }
    fromList.current = false;
    const left = window.history.state?.inboxList as { filter: Filter; at: number | null } | undefined;
    if (left) { setFilter(left.filter); if (left.at !== null && phone()) window.scrollTo(0, left.at); }
    else if (linked) setFilter(linked);
    else if (bare) setFilter('all');
  }, [selected, linked, bare]);
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  // Reports over two weeks old that nobody opened are left out of "Not seen yet" until asked for.
  const [olderToo, setOlderToo] = useState(false);
  const snap = ctx.snap;
  const since = previousWorkingDay(ctx.day);
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = (r: ReportSummary) => (!project || r.projectId === project) && (!trade || r.authorTrade === trade);
  const reports = snap.reports.filter(scoped).sort(byReceived);
  const drafts = snap.drafts.filter(scoped);
  // From every report, so a correction replaces its original whatever the filters.
  const unseen = notSeen(snap.reports, ctx.day);
  const unseenRecent = unseen.recent.filter(scoped), unseenOlder = unseen.older.filter(scoped);
  const counts: Record<Filter, number> = { all: reports.length, new: reports.filter(r => isNewReport(r, since)).length, notAck: unseenRecent.length, review: reports.filter(awaitingReview).length, returned: reports.filter(returned).length, failed: reports.filter(processingFailed).length, drafts: drafts.length };
  // The review filters only exist where review is used, for the project in view; it is off by default.
  const reviewOn = project ? !!ctx.statOf(project)?.reviewOn : ctx.reviewOn;
  const filters = reviewOn ? FILTERS : FILTERS.filter(([k]) => k !== 'review' && k !== 'returned');
  // A chosen filter that is no longer offered falls back to all, rather than an empty list with nothing selected.
  const filter = filters.some(([k]) => k === chosen) ? chosen : 'all';
  const shown = filter === 'new' ? reports.filter(r => isNewReport(r, since)) : filter === 'failed' ? reports.filter(processingFailed) : filter === 'notAck' ? [...unseenRecent, ...(olderToo ? unseenOlder : [])].sort(byReceived) : filter === 'review' ? reports.filter(awaitingReview) : filter === 'returned' ? reports.filter(returned) : reports;
  const open = (id: string) => {
    if (!selected) {
      try { window.history.replaceState({ ...window.history.state, inboxList: { filter, at: phone() ? window.scrollY : null } }, ''); } catch { /* the list just opens on all */ }
      fromList.current = true;
    }
    ctx.go(`#/inbox/${id}`);
  };
  const backToList = () => { if (fromList.current) window.history.back(); else ctx.go('#/inbox'); };
  const week = Date.now() - 7 * 86400000;
  const narrowed = !!(project || trade);
  const clear = () => { setProject(''); setTrade(''); };
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.id ?? '';
  return <div className={`view ${selected && filter !== 'drafts' ? 'inbox-reading' : ''}`}>
    <div className="pagehead"><div><h2>Inbox</h2><p>{snap.reports.length} report{snap.reports.length === 1 ? '' : 's'} received · {snap.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week).length} this week · {counts.notAck} not seen yet · {snap.drafts.length} draft{snap.drafts.length === 1 ? '' : 's'} in progress on site</p></div></div>
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
    // With no report open the list has the page to itself; the reader comes in beside it once one is picked.
    : <div className={selected ? 'two-wide' : undefined}>
      <div className="panel inbox-list-panel"><table className={`reg cards inbox-list ${selected ? '' : 'wide'}`}><thead><tr><th>Reference</th><th>Project</th><th>Engineer</th><th>Received</th><th className="c-found">Found</th><th>Status</th></tr></thead><tbody>
        {shown.length ? shown.map(r => <tr key={r.id} className={`clickable ${selected === r.id ? 'sel' : ''}`} onClick={() => open(r.id)}>
          <td className="c-ref"><span className="ref">{r.reference}</span>{r.revision > 1 && <div className="rowsub">rev {r.revision}</div>}</td><td className="c-title"><div className="rowtitle" style={{ fontSize: 13 }}>{name(r.projectId)}</div></td><td data-label="Engineer"><span className="who">{r.author}</span><div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due" data-label="Received">{fmtReceived(r.serverAcknowledgedAt, ctx.day)}</td><td className="c-found" data-label="Found"><Found r={r} /></td>
          <td data-label="Status"><div className="found">{r.review === 'pending' || r.review === 'returned' ? <ReviewTag r={r} /> : <DeliveryTag r={r} />}{r.acknowledged && <Tag label="Seen" cls="tag-ok" />}</div></td></tr>) : <tr><td colSpan={6} className="empty">{snap.reports.length === 0 && !narrowed ? FIRST : <>{filter === 'new' ? `No reports received ${sinceWords(since, ctx.day)}` : EMPTY[filter]}{narrowed ? ' for these filters' : ''}.</>}{narrowed && <> <button type="button" className="btn btn-q btn-sm" onClick={clear}>Clear filters</button></>}</td></tr>}
      </tbody></table>{filter === 'notAck' && unseenOlder.length > 0 && <div className="panel-foot not-seen-older">{olderWords(unseenOlder.length, olderToo)} <button type="button" className="btn btn-q btn-sm" aria-pressed={olderToo} onClick={() => setOlderToo(!olderToo)}>{olderToo ? 'Hide them' : 'List them too'}</button></div>}<div className="panel-foot">Newest first. Pick a report to read it; opening it marks it seen.{selected ? '' : ' “Found” says what the visit raised.'}</div></div>
      {selected && <div className="panel"><div className="panel-head"><button type="button" className="inbox-back" aria-label="Back to Inbox" onClick={backToList}><span aria-hidden="true">‹</span>&nbsp;Inbox</button><h3>Reader</h3><a className="more" href={`#/projects/${code(shown.find(r => r.id === selected)?.projectId ?? snap.reports.find(r => r.id === selected)?.projectId ?? '')}/report/${selected}`}>In its project →</a></div>
        <div className="inbox-reader"><ReportReader ctx={ctx} id={selected} crumbsHome="#/inbox" /></div></div>}
    </div>}
  </div>;
}
