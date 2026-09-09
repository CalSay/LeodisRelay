'use client';
import { useState } from 'react';
import type { ReportSummary } from '@/lib/types';
import type { Ctx } from './ctx';
import { BtnQ, DeliveryTag, Found, ReviewTag, Tag } from './bits';
import { ReportReader } from './ProjectsView';
import { awaitingReview, byReceived, fmtWhen, notAcknowledged, notNotified, processingFailed, returned, shortRef } from './model';

type Filter = 'all' | 'notAck' | 'review' | 'returned' | 'notNotified' | 'failed' | 'drafts';
const FILTERS: [Filter, string, boolean][] = [['all', 'All', false], ['notAck', 'Not yet read', false], ['review', 'To review', true], ['returned', 'Returned', false], ['notNotified', 'PM not notified', false], ['failed', 'Processing failed', true], ['drafts', 'Drafts on site', false]];

/** Every report received, newest first, with the reader beside it. */
export function InboxView({ ctx }: { ctx: Ctx }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const snap = ctx.snap;
  const selected = ctx.route.a;
  if (!snap) return <div className="view"><div className="loading">Loading office records</div></div>;
  const scoped = (r: ReportSummary) => (!project || r.projectId === project) && (!trade || r.authorTrade === trade);
  const reports = snap.reports.filter(scoped).sort(byReceived);
  const drafts = snap.drafts.filter(scoped);
  const counts: Record<Filter, number> = { all: reports.length, notAck: reports.filter(notAcknowledged).length, review: reports.filter(awaitingReview).length, returned: reports.filter(returned).length, notNotified: reports.filter(notNotified).length, failed: reports.filter(processingFailed).length, drafts: drafts.length };
  const shown = filter === 'notNotified' ? reports.filter(notNotified) : filter === 'failed' ? reports.filter(processingFailed) : filter === 'notAck' ? reports.filter(notAcknowledged) : filter === 'review' ? reports.filter(awaitingReview) : filter === 'returned' ? reports.filter(returned) : reports;
  const week = Date.now() - 7 * 86400000;
  const name = (id: string) => ctx.projects.find(p => p.id === id)?.projectName ?? id;
  const code = (id: string) => ctx.projects.find(p => p.id === id)?.projectNumber ?? '';
  return <div className="view">
    <div className="pagehead"><div><h3>Inbox</h3><p>{snap.reports.length} reports received · {snap.reports.filter(r => r.serverAcknowledgedAt && Date.parse(r.serverAcknowledgedAt) > week).length} this week · {counts.notAck} not yet read · {snap.drafts.length} draft{snap.drafts.length === 1 ? '' : 's'} in progress on site</p></div></div>
    <div className="filters">
      {FILTERS.map(([k, l, warn]) => <button type="button" key={k} className={`chip ${warn && counts[k] ? 'warn' : ''} ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>)}
      <span className="spacer" />
      <label>Project <select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
      <label>Trade <select value={trade} onChange={e => setTrade(e.target.value)}><option value="">All trades</option>{['Electrical', 'HVAC', 'P&H'].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
    </div>
    {filter === 'drafts' ? <div className="panel"><table className="reg"><thead><tr><th>Reference</th><th>Project</th><th>Engineer</th><th>Visit</th><th>Saved</th><th>Sections</th><th></th></tr></thead><tbody>
      {drafts.length ? drafts.map(r => <tr key={r.id}><td><span className="ref">{r.reference}</span>{r.revision > 1 && <div className="rowsub">rev {r.revision}</div>}</td><td>{name(r.projectId)}</td><td>{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due">{r.visitDate}</td><td className="due">{fmtWhen(r.lastSavedAt)}</td><td className="num">{r.observationCount}</td><td><Tag label={r.corrects ? 'Correction' : 'Draft'} cls="tag-caution" /></td></tr>) : <tr><td colSpan={7} className="empty">No drafts saved to the server.</td></tr>}
    </tbody></table><div className="panel-foot">Draft contents are private until submitted. Work held only on an engineer’s device is not visible here.</div></div>
    : <div className="two-wide">
      <div className="panel"><table className="reg"><thead><tr><th>Reference</th><th>Project</th><th>Engineer</th><th>Received</th><th>Found</th><th>Status</th></tr></thead><tbody>
        {shown.length ? shown.map(r => <tr key={r.id} className={`clickable ${selected === r.id ? 'sel' : ''}`} onClick={() => ctx.go(`#/inbox/${r.id}`)}>
          <td><span className="ref">{r.reference}</span>{r.revision > 1 && <div className="rowsub">rev {r.revision}</div>}</td><td><div className="rowtitle" style={{ fontSize: 13 }}>{name(r.projectId)}</div></td><td>{r.author}<div className="rowsub">{r.authorTrade ?? 'Trade not recorded'}</div></td><td className="due">{fmtWhen(r.serverAcknowledgedAt)}</td><td><Found r={r} /></td>
          <td><div className="found">{r.review === 'pending' || r.review === 'returned' ? <ReviewTag r={r} /> : <DeliveryTag r={r} />}{r.acknowledged && <Tag label="Read" cls="tag-ok" />}</div></td></tr>) : <tr><td colSpan={6} className="empty">Nothing here.</td></tr>}
      </tbody></table><div className="panel-foot">Newest first. “Found” says what the visit raised, not how many sections were typed. A report is on file once received; the email to the project manager is only a notification that it came in.</div></div>
      <div className="panel"><div className="panel-head"><h4>Reader</h4>{selected && <a className="more" href={`#/projects/${code(shown.find(r => r.id === selected)?.projectId ?? snap.reports.find(r => r.id === selected)?.projectId ?? '')}/report/${selected}`}>In its project →</a>}</div>
        <div style={{ padding: 12 }}>{selected ? <ReportReader ctx={ctx} id={selected} crumbsHome="#/inbox" /> : <div className="empty">Select a report to read it here.<br /><BtnQ className="btn-sm" style={{ marginTop: 12 }} onClick={() => shown[0] && ctx.go(`#/inbox/${shown[0].id}`)}>Open the newest</BtnQ></div>}</div></div>
    </div>}
  </div>;
}
