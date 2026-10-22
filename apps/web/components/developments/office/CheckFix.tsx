'use client';
import { useEffect, useRef, useState } from 'react';
import type { Issue, Photo } from '@/lib/types';
import { SEND_BACK_REASON, fixEvidence, sentBackBefore } from '@/lib/checkFix';
import { getIssue, issueCommand } from '@/lib/api';
import { mediaId } from '@/lib/media';
import { PhotoImage } from '@/components/PhotoImage';
import { Modal, toast } from '@/components/workspace/hooks';
import { Btn, BtnQ } from './bits';
import { WORK_LABEL, daysLate, fmtDay, fmtWhen, today } from './model';

/** A larger copy than the thumbnail, opened on its own: sharp on a phone and far lighter than the original. */
const large = (src: string) => `${src}?variant=pdf`;

function Shots({ title, photos, none, what }: { title: string; photos: Photo[]; none: string; what: string }) {
  const label = (n: number) => `${what} photo ${n + 1} of ${photos.length}`;
  return <section className="cf-side">
    <h3>{title}</h3>
    {/* An older photo kept inline cannot open in a tab of its own, so it is shown and not linked. */}
    {photos.length ? <div className="cf-shots">{photos.map((p, n) => mediaId(p.dataUrl)
      ? <a key={p.id} href={large(p.dataUrl)} target="_blank" rel="noopener noreferrer" aria-label={`${label(n)}${p.caption ? `: ${p.caption}` : ''}, full size (opens in a new tab)`}><PhotoImage src={p.dataUrl} alt="" />{p.caption && <span className="cf-cap">{p.caption}</span>}</a>
      : <figure key={p.id}><PhotoImage src={p.dataUrl} alt={p.caption || label(n)} />{p.caption && <figcaption className="cf-cap">{p.caption}</figcaption>}</figure>)}</div>
      : <p className="cf-none">{none}</p>}
  </section>;
}

/**
 * Checking fixes one after another (walk of 21 Oct 2026). The office sees the
 * defect as raised beside the photo and note sent with the fix, decides, and the
 * next fix from the list it started on opens straight away. Skip changes nothing;
 * Stop, Esc or the end of the list closes it. Each decision refreshes the office
 * records, so the lists and figures behind are current when it closes.
 *
 * No <form>: Enter never verifies by accident. Sending back needs a reason, as
 * the server also insists, because the engineer has to know what is left.
 */
export function CheckFix({ start, list, me, startWith, close, done }: {
  start: Issue; list?: (() => Promise<Issue[]>) | undefined; me: { id: string; name: string }; startWith: 'verify' | 'reopen';
  close: () => void; done: () => void;
}) {
  const [queue, setQueue] = useState<Issue[]>([start]);
  const [at, setAt] = useState(0);
  // Deciding waits for the list, so a decision never closes a dialog that was about to go on to the next fix.
  const [listReady, setListReady] = useState(!list);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tally = useRef({ verified: 0, back: 0 });
  const heading = useRef<HTMLHeadingElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  // What is on screen now, for code that runs after an await.
  const pos = useRef({ queue, at, busy });
  pos.current = { queue, at, busy };

  useEffect(() => {
    let stopped = false;
    // The whole list it was opened from, in that list's order; the issue pressed stays where it is in it.
    list?.().then(all => {
      if (stopped) return;
      const seen = new Set<string>();
      const waiting = all.filter(i => i.work === 'awaiting_verification' && i.confirmation !== 'withdrawn' && !seen.has(i.id) && !!seen.add(i.id));
      const n = waiting.findIndex(i => i.id === start.id);
      if (n >= 0) { setQueue(waiting); setAt(n); } else setQueue([start, ...waiting]);
    }).catch(() => undefined).finally(() => { if (!stopped) setListReady(true); });
    return () => { stopped = true; };
  }, [list, start]);

  // The office desk's copy of an issue has no photographs or notes, so each fix is read whole, and the next one ahead of time.
  const [full, setFull] = useState<Record<string, Issue | 'failed'>>({});
  const loading = useRef(new Set<string>());
  const listed = queue[at] ?? start;
  const ahead = queue[at + 1]?.id;
  useEffect(() => {
    for (const id of [listed.id, ahead]) {
      if (!id || full[id] || loading.current.has(id)) continue;
      loading.current.add(id);
      getIssue(id).then(i => setFull(f => ({ ...f, [id]: i })), () => setFull(f => ({ ...f, [id]: 'failed' })))
        .finally(() => loading.current.delete(id));
    }
  }, [listed.id, ahead, full]);
  /** Read this fix again: after a failed load, or when a decision was refused because the issue changed. */
  const reload = (id: string) => setFull(f => { const { [id]: _, ...rest } = f; return rest; });
  const loaded = full[listed.id];
  const issue = loaded && loaded !== 'failed' ? loaded : listed;
  // Someone else may have checked it since the list was drawn.
  const gone = loaded && loaded !== 'failed' && (loaded.work !== 'awaiting_verification' || loaded.confirmation === 'withdrawn');
  useEffect(() => {
    // Opened to send back: straight to the reason. Otherwise the fix's heading, so a screen reader starts at the new fix.
    if (first.current && startWith === 'reopen') noteBox.current?.focus(); else heading.current?.focus();
    first.current = false;
  }, [issue.id, startWith]);

  const finish = () => {
    // Not while a decision is being recorded: it would close before saying what was done.
    if (pos.current.busy) return;
    const t = tally.current;
    const said = [t.verified && `${t.verified} verified`, t.back && `${t.back} sent back`].filter(Boolean).join(', ');
    if (said) toast(`${said[0]!.toUpperCase()}${said.slice(1)}.`);
    close();
  };
  const next = () => {
    setNote(''); setError('');
    const { queue: q, at: n } = pos.current;
    if (n + 1 >= q.length) finish(); else setAt(n + 1);
  };
  const decide = async (kind: 'verify' | 'reopen') => {
    const why = note.trim();
    if (kind === 'reopen' && !why) { setError(SEND_BACK_REASON); noteBox.current?.focus(); return; }
    setBusy(true); pos.current.busy = true; setError('');
    try {
      await issueCommand(issue.id, { expectedEtag: issue.sync?.etag, kind, note: why });
      if (kind === 'verify') tally.current.verified += 1; else tally.current.back += 1;
      done();
      pos.current.busy = false;
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be recorded.');
      // It may have changed under us: read it again, so a second try uses what is there now.
      reload(issue.id);
    }
    finally { setBusy(false); pos.current.busy = false; }
  };

  const ev = fixEvidence(issue);
  const back = sentBackBefore(issue);
  const mine = issue.closureSubmittedById ? issue.closureSubmittedById === me.id : issue.closureSubmittedBy === me.name;
  const day = today();
  const late = issue.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(issue.targetDate) && issue.targetDate < day ? daysLate(issue.targetDate, day) : 0;
  const more = queue.length > 1;
  // Esc while a decision is being recorded is held until it is done.
  return <Modal className="ws-dialog cf-dialog" onClose={finish} onCancel={e => { if (pos.current.busy) e.preventDefault(); }}>
    <div className="dlg-head"><div>
      <div className="crumbs">{issue.reference} · {issue.location || 'no location'}</div>
      <h2 ref={heading} tabIndex={-1}>{more ? `Check this fix · ${at + 1} of ${queue.length}` : 'Check this fix'}</h2>
      {!listReady && <p className="rowsub" role="status">Loading the rest of the list</p>}
    </div><button type="button" className="x" onClick={finish} aria-label="Close">×</button></div>
    <div className="dlg-body">
      <div className="cf-what">
        <b>{issue.description}</b>
        <p className="rowsub">Put forward by {ev.by}{ev.at ? ` on ${fmtWhen(ev.at)}` : ''} · {issue.owner.trim() || 'nobody named'}{issue.targetDate ? ` · target ${fmtDay(issue.targetDate)}${late > 0 ? `, ${late} ${late === 1 ? 'day' : 'days'} past` : ''}` : ''}</p>
        {/* Sent back before: what was asked, above the answer, so the new photo is checked against it. */}
        {back && loaded && loaded !== 'failed' && <p className="cf-note cf-back">{back.times > 1 ? `Sent back ${back.times} times. Last by` : 'Sent back by'} {back.by} on {fmtWhen(back.at)}{back.note ? <>: <q>{back.note}</q></> : ', with no reason given.'}</p>}
        {loaded && loaded !== 'failed' && <p className="cf-note">{ev.note ? <>Their note: <q>{ev.note}</q></> : 'No note was sent with the fix.'}</p>}
      </div>
      {loaded === 'failed' && <div className="note bad" style={{ margin: 0 }} role="alert"><span>The photos for this fix could not be loaded. Check your connection and try again.</span><BtnQ className="btn-sm" onClick={() => reload(listed.id)}>Try again</BtnQ></div>}
      {gone && <div className="note info" style={{ margin: 0 }} role="status"><span>This one is no longer waiting to be checked: it is {WORK_LABEL[issue.work].toLowerCase()}{issue.confirmation === 'withdrawn' ? ' and withdrawn' : ''}.</span></div>}
      {loaded ? <div className="cf-pair">
        <Shots title="The defect" what="Defect" photos={ev.defect} none={loaded === 'failed' ? 'Not loaded.' : 'No photo was taken of the defect.'} />
        <Shots title="The fix" what="Fix" photos={ev.fix} none={loaded === 'failed' ? 'Not loaded.' : 'No photo was sent with the fix.'} />
      </div> : <div className="loading" style={{ minHeight: 160 }}>Loading the photos</div>}
      {mine && <div className="note warn" style={{ margin: 0 }}><span>You put this forward, so someone else has to verify it. You can still send it back.</span></div>}
      <div className="f"><label htmlFor="cf-note">Note · needed to send it back</label>
        <textarea id="cf-note" ref={noteBox} value={note} onChange={e => { setNote(e.target.value); if (error) setError(''); }} placeholder="What you checked, or what is left to do" aria-describedby={error ? 'cf-error' : undefined} /></div>
      {error && <div className="note bad" style={{ margin: 0 }} id="cf-error" role="alert"><span>{error}</span></div>}
    </div>
    <div className="dlg-foot cf-foot">
      <BtnQ onClick={finish} disabled={busy}>Stop</BtnQ>
      {more && <BtnQ onClick={next} disabled={busy}>Skip</BtnQ>}
      <span className="spacer" />
      {!gone && <BtnQ onClick={() => void decide('reopen')} disabled={busy || !listReady}>Not finished</BtnQ>}
      {!gone && !mine && <Btn onClick={() => void decide('verify')} disabled={busy || !listReady}>{busy ? 'Recording…' : 'Verify and close'}</Btn>}
      {gone && !more && <Btn onClick={finish}>Close</Btn>}
    </div>
  </Modal>;
}
