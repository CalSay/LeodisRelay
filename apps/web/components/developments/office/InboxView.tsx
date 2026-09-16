'use client';
import './inbox.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { listCorrections } from '@/lib/api';
import type { ReportSummary } from '@/lib/types';
import type { Ctx } from './ctx';
import { Btn, BtnQ } from './bits';
import { Band, Mark, type MarkKind } from './marks';
import { ReportReader } from './ProjectsView';
import { canCorrect } from './corrections';
import { awaitingReview, byReceived, fmtDay, fmtWhen, found, notAcknowledged, processingFailed, returned, shortRef } from './model';

type Queue = 'problems' | 'review' | 'unread' | 'returned' | 'onsite' | 'read';
const QUEUES: Record<Queue, { label: string; hint: string }> = {
  problems: { label: 'Problems', hint: 'Filing or processing failed' },
  review: { label: 'To review', hint: 'Approve or return to the engineer' },
  unread: { label: 'Unread', hint: 'New reports nobody has read' },
  returned: { label: 'Correction requested', hint: 'Engineer sending a new revision' },
  onsite: { label: 'On site now', hint: 'Drafts being written' },
  read: { label: 'Read recently', hint: 'Read in the last 14 days' },
};
const TRADES = ['Electrical', 'HVAC', 'P&H'] as const;
/** Rows whose correction count is fetched: one small request each, first rows of the open queue only. */
const ROW_COUNT_LIMIT = 30;
const FORTNIGHT = 14 * 86400000;
const LONDON = 'Europe/London';

const TESTS: Record<Exclude<Queue, 'onsite'>, (r: ReportSummary) => boolean> = {
  problems: processingFailed,
  review: awaitingReview,
  unread: r => notAcknowledged(r) && !processingFailed(r) && !awaitingReview(r),
  returned,
  read: r => r.state === 'submitted' && !!r.acknowledged && Date.now() - Date.parse(r.acknowledged.at) <= FORTNIGHT,
};

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: LONDON });
const hhmm = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit' }) : '--:--';
function dayLabel(iso: string | undefined, today: string): string {
  if (!iso) return 'Date not recorded';
  const k = dayKey(iso);
  if (k === today) return 'Today';
  if (k === dayKey(new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString())) return 'Yesterday';
  const d = new Date(iso), part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-GB', { timeZone: LONDON, ...o });
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} ${part({ month: 'short' }).slice(0, 3)}`;
}
/** Today as a time, otherwise as a date. */
const savedAt = (iso: string | undefined, today: string) => !iso ? 'not recorded' : dayKey(iso) === today ? hhmm(iso) : fmtDay(iso);

function rowState(r: ReportSummary): { mark?: MarkKind; label: string } {
  if (processingFailed(r)) return { mark: 'urgent', label: 'Filing failed' };
  if (awaitingReview(r)) return { mark: 'action', label: 'To review' };
  if (returned(r)) return { label: 'Correction requested' };
  if (r.acknowledged) return { mark: 'done', label: 'Read' };
  return { label: 'Unread' };
}

/** The inbox as a to-do list: queues by who has to act, the reports in one, and the reader. */
export function InboxView({ ctx }: { ctx: Ctx }) {
  const [picked, setPicked] = useState<Queue | null>(null);
  const [project, setProject] = useState('');
  const [trade, setTrade] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryNote, setRetryNote] = useState('');
  /** Wide reader: queues hidden, list reduced to stubs. Kept for this visit only. */
  const [wide, setWide] = useState(false);
  const [reportFix, setReportFix] = useState(false);
  /** Corrections per report, fetched lazily for the rows on show. */
  const [fixCounts, setFixCounts] = useState<Record<string, number>>({});
  const asked = useRef(new Set<string>());
  const correcting = canCorrect(ctx.me.role);
  const snap = ctx.snap;
  const selected = ctx.route.a;

  const scoped = (r: ReportSummary) => (!project || r.projectId === project) && (!trade || r.authorTrade === trade);
  const reports = (snap?.reports ?? []).filter(scoped).sort(byReceived);
  const drafts = (snap?.drafts ?? []).filter(scoped).sort((a, b) => (b.lastSavedAt ?? '').localeCompare(a.lastSavedAt ?? ''));
  const lists = Object.fromEntries((Object.keys(TESTS) as (keyof typeof TESTS)[]).map(q => [q, reports.filter(TESTS[q])])) as Record<keyof typeof TESTS, ReportSummary[]>;
  const count = (q: Queue) => q === 'onsite' ? drafts.length : lists[q].length;
  const showReview = count('review') > 0 || ctx.projects.some(p => p.reviewRequired);
  let queue: Queue = picked ?? (count('problems') ? 'problems' : 'unread');
  if (queue === 'review' && !showReview) queue = 'unread';
  const shown = queue === 'onsite' ? [] : lists[queue];
  const firstId = shown[0]?.id;

  /** Move the selection without adding a history entry for it. */
  const replaceWith = (id: string) => { try { window.history.replaceState(null, '', `#/inbox/${id}`); } catch { /* state still moves */ } ctx.go(`#/inbox/${id}`); };
  useEffect(() => { if (snap && !selected && firstId) replaceWith(firstId); }, [snap, selected, firstId]);
  useEffect(() => { setRetryNote(''); setReportFix(false); }, [selected]);
  const shownKey = queue === 'onsite' ? '' : shown.slice(0, ROW_COUNT_LIMIT).map(r => r.id).join(',');
  useEffect(() => {
    if (!correcting || !shownKey) return;
    const todo = shownKey.split(',').filter(id => !asked.current.has(id));
    todo.forEach(id => asked.current.add(id));
    for (const id of todo) {
      listCorrections(id).then(list => setFixCounts(c => c[id] === list.length ? c : { ...c, [id]: list.length })).catch(() => { /* no chip; the reader shows the error */ });
    }
  }, [correcting, shownKey]);
  const onCorrections = useCallback((id: string, list: { id: string }[]) => {
    asked.current.add(id);
    setFixCounts(c => c[id] === list.length ? c : { ...c, [id]: list.length });
  }, []);
  const onWiden = useCallback((open: boolean) => { if (open) setWide(true); }, []);

  if (!snap) return <div className="ro-inbox-loading"><div className="loading">Loading office records</div></div>;

  const projectOf = (id: string) => ctx.projects.find(p => p.id === id);
  const summary = selected ? snap.reports.find(r => r.id === selected) : undefined;
  const needYou = count('problems') + (showReview ? count('review') : 0) + count('unread');
  const pickQueue = (q: Queue) => {
    setPicked(q);
    if (q === 'onsite') return;
    const list = lists[q];
    if (list[0] && !list.some(r => r.id === selected)) replaceWith(list[0].id);
  };

  async function retry(r: ReportSummary) {
    setRetrying(true); setRetryNote('');
    try {
      const response = await fetch('/api/admin/sharepoint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId: r.id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.reason ?? 'The SharePoint retry could not be queued.');
      setRetryNote('Retry queued. This report will refresh when processing finishes.');
      await ctx.refresh();
    } catch (e) {
      setRetryNote(e instanceof Error ? e.message : 'The SharePoint retry could not be queued.');
    } finally { setRetrying(false); }
  }

  const qbtn = (q: Queue, icon: React.ReactNode, pill: string) => {
    const n = count(q);
    return <button type="button" className="ro-qbtn" aria-pressed={queue === q} onClick={() => pickQueue(q)}>
      <span className="ro-qi">{icon}</span><span className="ro-ql">{QUEUES[q].label}<small>{QUEUES[q].hint}</small></span><span className={`ro-qn ${n ? pill : ''}`}>{n}</span>
    </button>;
  };

  const tools: Record<Queue, React.ReactNode> = {
    problems: 'Fix these first. Nothing has been lost.',
    review: 'Approving sends the report on. Returning asks the engineer for a correction.',
    unread: <>{shown.length ? `${shown.length} new report${shown.length === 1 ? '' : 's'}. ` : ''}Opening a report doesn&rsquo;t mark it read.</>,
    returned: 'Sent back to the engineer. The corrected revision arrives as a new report.',
    onsite: 'Drafts saved to the server. Contents stay private until the engineer sends them.',
    read: <>Marked read in the last 14 days. Older reports are in the <a href="#/reports">Reports tab</a>.</>,
  };

  const groups: { label: string; items: ReportSummary[] }[] = [];
  for (const r of shown) {
    const label = dayLabel(r.serverAcknowledgedAt ?? r.lastSavedAt, ctx.day);
    const g = groups.at(-1);
    if (g && g.label === label) g.items.push(r); else groups.push({ label, items: [r] });
  }

  const row = (r: ReportSummary) => {
    const st = rowState(r), unread = !r.acknowledged, problem = processingFailed(r), f = found(r);
    const flagged = f.filter(x => x.kind !== 'update'), fixed = fixCounts[r.id] ?? 0;
    return <button key={r.id} type="button" className={`ro-irow ${unread ? '' : 'read'} ${problem ? 'problem' : ''} ${selected === r.id ? 'on' : ''}`} aria-current={selected === r.id ? 'true' : undefined} onClick={() => ctx.go(`#/inbox/${r.id}`)}>
      <span className="ro-gut">{unread && <span className="ro-udot" role="img" aria-label="Unread" />}</span>
      <span className="ro-stub"><small>{projectOf(r.projectId)?.projectNumber ?? ''}</small><b>{shortRef(r.reference)}</b></span>
      <span className="ro-ibody">
        <span className="ro-ititle">{projectOf(r.projectId)?.projectName ?? r.projectId}</span>
        <span className="ro-isub">{ctx.nameOf(r.authorId, r.author)} · {r.authorTrade ?? 'Trade not recorded'}{r.revision > 1 ? ` · rev ${r.revision}` : ''}</span>
        <span className="ro-found">{flagged.map(x => <span key={x.kind} className={`ro-kchip ${x.kind}`}>{x.n} {x.kind === 'defect' ? (x.n === 1 ? 'defect' : 'defects') : x.kind === 'instruction' ? (x.n === 1 ? 'variation' : 'variations') : 'access'}</span>)}
          {!flagged.length && <span className="ro-kchip">{f.length ? 'Progress only' : 'Nothing recorded'}</span>}
          {fixed > 0 && <span className="ro-kchip ro-qa-fixed">{fixed} corrected</span>}</span>
      </span>
      <span className="ro-iright"><span className="ro-itime">{hhmm(r.serverAcknowledgedAt)}</span><span className="ro-istate">{st.label}{st.mark && <Mark kind={st.mark} label={st.label} size="sm" />}</span></span>
    </button>;
  };

  const draftRow = (d: ReportSummary) => <div key={d.id} className="ro-irow read draft">
    <span className="ro-gut"><span className="ro-live" role="img" aria-label="Being written" /></span>
    <span className="ro-stub"><small>{projectOf(d.projectId)?.projectNumber ?? 'Draft'}</small><b>{d.corrects ? 'CORR' : 'NEW'}</b></span>
    <span className="ro-ibody"><span className="ro-ititle">{projectOf(d.projectId)?.projectName ?? d.projectId}</span><span className="ro-isub">{d.author} · {d.authorTrade ?? 'Trade not recorded'} · {d.observationCount} section{d.observationCount === 1 ? '' : 's'}{d.corrects ? ' · correction' : ''}</span></span>
    <span className="ro-iright"><span className="ro-itime">Saved {savedAt(d.lastSavedAt, ctx.day)}</span></span>
  </div>;

  const actionBar = (r: ReportSummary) => {
    if (processingFailed(r)) return <div className="ro-actionbar">
      <div className="ro-why"><Mark kind="urgent" label="Processing failed" /><span><b>Processing failed</b>{r.deliveryError ?? r.sharepoint?.error ?? 'The worker gave up on this report.'} The report is safe in Relay.</span></div>
      {ctx.me.admin && r.sharepoint?.status === 'failed' ? <div className="ro-btns"><Btn className="btn-sm" disabled={retrying} onClick={() => void retry(r)}>{retrying ? 'Queuing…' : 'Retry SharePoint'}</Btn></div>
        : !ctx.me.admin && <span className="ro-hint">An administrator can retry filing.</span>}
      {retryNote && <span className="ro-hint" role="status">{retryNote}</span>}
    </div>;
    if (awaitingReview(r)) {
      const mine = !!r.authorId && r.authorId === ctx.me.id;
      return <div className="ro-actionbar">
        <div className="ro-why"><Mark kind="action" label="Waiting for review" /><span><b>Waiting for review</b>{mine ? 'You wrote this report, so someone else has to review it.' : 'Approve it to send it on, or return it to the engineer.'}</span></div>
        {!mine && <div className="ro-btns"><Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'review', report: r })}>Review</Btn></div>}
      </div>;
    }
    if (returned(r)) return <div className="ro-actionbar">
      <div className="ro-why"><Mark kind="none" label="Correction requested" /><span><b>Correction requested</b>{r.reviewedBy ? `Sent back by ${r.reviewedBy}${r.reviewedAt ? ` on ${fmtDay(r.reviewedAt)}` : ''}: ` : ''}{r.reviewNote ?? 'No reason recorded.'}</span></div>
    </div>;
    if (!r.acknowledged) return <div className="ro-actionbar">
      <div className="ro-why"><span className="ro-qi"><span className="ro-udot" aria-hidden="true" /></span><span><b>Not read yet</b>Nobody in the office has marked this report read.</span></div>
      <div className="ro-btns"><Btn className="btn-sm" onClick={() => ctx.setDialog({ kind: 'acknowledge', report: r })}>Mark as read</Btn><span className="ro-hint">Records your name and the time.</span></div>
    </div>;
    return <div className="ro-actionbar">
      <div className="ro-why"><Mark kind="done" label="Read" /><span><b>Read by {r.acknowledged.by}</b>{r.acknowledged.at ? fmtWhen(r.acknowledged.at) : 'Time not recorded'}{r.acknowledged.note ? ` · ${r.acknowledged.note}` : ''}</span></div>
    </div>;
  };

  const reportFixLink = (r: ReportSummary) => <div className="ro-qa-corrlink">
    Something wrong with the report itself?{' '}
    <button type="button" className="ro-qa-inline" onClick={() => awaitingReview(r) ? ctx.setDialog({ kind: 'review', report: r }) : setReportFix(x => !x)}>Request a correction</button>
    {reportFix && !awaitingReview(r) && <p role="status">Report corrections are sent back through review; turn review on for this project to use it.</p>}
  </div>;

  return <div className={`ro-inbox ${wide ? 'ro-qa-wide' : ''}`}>
    <section className="col" aria-label="Inbox queues">
      <div className="col-head"><h4>Inbox</h4><i>{needYou} need you</i></div>
      <div className="ro-scroll">
        <div className="ro-qsec">Needs you</div>
        <div className="ro-queues">
          {qbtn('problems', <Mark kind="urgent" label="Problems" size="sm" />, 'hot')}
          {showReview && qbtn('review', <Mark kind="action" label="To review" size="sm" />, 'amber')}
          {qbtn('unread', <span className="ro-udot" aria-hidden="true" />, 'gold')}
        </div>
        <div className="ro-qsec">Waiting on others</div>
        <div className="ro-queues">
          {qbtn('returned', <Mark kind="none" label="Correction requested" size="sm" />, '')}
          {qbtn('onsite', <span className="ro-live" aria-hidden="true" />, '')}
        </div>
        <div className="ro-qsec">Done</div>
        <div className="ro-queues">{qbtn('read', <Mark kind="done" label="Read recently" size="sm" />, '')}</div>
        <div className="ro-scope">
          <div className="ro-qsec">Narrow down</div>
          <label>Project<select value={project} onChange={e => setProject(e.target.value)}><option value="">All projects</option>{ctx.projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}</select></label>
          <div className="ro-trades" role="group" aria-label="Trade">Trade<div className="ro-tchips">
            {['', ...TRADES].map(t => <button key={t || 'all'} type="button" aria-pressed={trade === t} onClick={() => setTrade(t)}>{t || 'All'}</button>)}
          </div></div>
        </div>
      </div>
    </section>

    <section className={`col ${selected ? '' : 'focus'}`} aria-label={QUEUES[queue].label}>
      <div className="col-head"><h4>{QUEUES[queue].label}</h4><i>{count(queue)} report{count(queue) === 1 ? '' : 's'}</i></div>
      <div className="ro-scroll ro-ilist">
        <div className="ro-itools"><p>{tools[queue]}</p></div>
        {queue !== 'problems' && count('problems') > 0 && <div className="ro-alert"><Mark kind="urgent" label="Problems" /><span><b>{count('problems')} report{count('problems') === 1 ? '' : 's'} need{count('problems') === 1 ? 's' : ''} fixing</b>Filing or processing failed. The reports are safe in Relay.</span><BtnQ className="btn-sm" onClick={() => pickQueue('problems')}>View problems</BtnQ></div>}
        {queue === 'unread' && drafts.length > 0 && <div className="ro-onsite">
          <div className="ro-onsite-h"><span className="ro-live" aria-hidden="true" />On site now · {drafts.length} report{drafts.length === 1 ? '' : 's'} being written</div>
          <div className="ro-onsite-row">{drafts.map(d => <span key={d.id} className="ro-dchip"><b>{ctx.nameOf(d.authorId, d.author)}</b>{projectOf(d.projectId)?.projectName ?? d.projectId}<small>saved {savedAt(d.lastSavedAt, ctx.day)}</small></span>)}</div>
        </div>}
        {queue === 'onsite'
          ? drafts.length ? <div className="ro-irows">{drafts.map(draftRow)}</div> : <Empty label={QUEUES.onsite.label} filtered={!!(project || trade)} />
          : shown.length ? groups.map((g, i) => <div key={`${i}-${g.label}`}><Band kind="none" label={g.label} count={g.items.length} /><div className="ro-irows">{g.items.map(row)}</div></div>)
            : <Empty label={QUEUES[queue].label} filtered={!!(project || trade)} />}
      </div>
    </section>

    <section className={`col ro-inbox-reader ${selected ? 'focus' : ''}`} aria-label="Reader">
      <div className="col-head"><h4>Reader</h4><span className="ro-qa-headtools">{selected && <button type="button" className="ro-qa-widen" aria-pressed={wide} onClick={() => setWide(w => !w)}>{wide ? '⤡ Narrow reader' : '⤢ Widen reader'}</button>}<i>{summary?.reference ?? ''}</i></span></div>
      {summary && actionBar(summary)}
      <div className="ro-scroll ro-reader-body">
        {selected ? <><ReportReader ctx={ctx} id={selected} crumbsHome="#/inbox" corrections={correcting} onWiden={onWiden} onCorrections={onCorrections} />{summary && reportFixLink(summary)}</>
          : <div className="ro-empty"><b>Nothing selected</b><span>Choose a report from the list to read it here.</span></div>}
      </div>
    </section>
  </div>;
}

function Empty({ label, filtered }: { label: string; filtered: boolean }) {
  return <div className="ro-empty"><Mark kind="done" label="All clear" /><b>All clear</b><span>Nothing in {label.toLowerCase()}{filtered ? ' for this filter' : ''}.</span></div>;
}
