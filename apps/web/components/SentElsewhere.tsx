"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Report } from '@/lib/types';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import type { UnsentChange, UnsentCheck, UnsentWork } from '@/lib/sentElsewhere';

const fmtWhen = (iso?: string) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const KIND: Record<UnsentChange['kind'], string> = { changed: 'Changed here', added: 'Added here', removed: 'Removed here' };
/** Why a change is worth a look before the correction is sent. */
const CHECK: Record<UnsentCheck, string> = {
  both: 'The other screen changed this card too. The correction uses your wording; what was sent stays on file.',
  'removed-there': 'The other screen removed this card before sending. Your edited card is put back in the correction; leave it out there if it should go.',
  'maybe-removed': 'This card may have been removed on the other screen. It is in the correction; leave it out there if it should go.',
  'edited-there': 'The other screen changed this card before sending, so it stays in the correction. Remove it there if it should go.',
};

/**
 * Shown above a sent report when it was sent from another tab or device while
 * this screen still held changes that never reached the server. The sent
 * revision is left as it is; the changes can start a correction, or be let go.
 */
export function SentElsewhere({ sent, work, unheld, busy, error, errorLink, reason, onReason, onCorrect, onDiscard }: {
  sent: Report; work: UnsentWork; unheld: boolean; busy: boolean; error: string;
  errorLink?: { href: string; label: string } | null;
  reason: string; onReason: (reason: string) => void;
  onCorrect: () => void; onDiscard: () => void;
}) {
  const [discarding, setDiscarding] = useState(false);
  const n = work.changes.length;
  const changes = `${n} change${n === 1 ? '' : 's'}`;
  const sentNumber = (id: string) => sent.observations.findIndex(o => o.id === id) + 1;
  const number = (c: UnsentChange) => c.kind === 'removed' && !c.check
    ? `Was card ${String(sentNumber(c.id)).padStart(2, '0')}`
    : `Card ${String(work.observations.findIndex(o => o.id === c.id) + 1).padStart(2, '0')}`;

  return <section className="eng-conflict eng-sent-away" aria-labelledby="sent-away-title">
    <div className="note note-bad">
      <h2 id="sent-away-title">Sent from another screen</h2>
      <p>This report was sent{sent.serverAcknowledgedAt ? ` at ${fmtWhen(sent.serverAcknowledgedAt)}` : ''} from another tab or device. {changes} on this screen {n === 1 ? 'was' : 'were'} not in it. The sent report stays as it is.</p>
      <p>{unheld
        ? <strong>This device would not keep a copy of your changes. Do not close this page until you choose.</strong>
        : 'Your changes are kept on this device until you choose.'}</p>
    </div>

    <div className="sec"><span className="lbl">Not in the sent report · {changes}</span></div>
    {work.changes.map(c => {
      const kind = OBSERVATION_TYPES.find(t => t.value === c.card.type)?.short ?? c.card.type;
      return <article key={`${c.kind}-${c.id}`} className={`eng-conflict-card ${c.kind === 'removed' && !c.check ? 'is-out' : ''}`} data-change={c.kind}>
        <header>
          <span className="no">{number(c)}</span>
          <b>{c.card.location.trim() || 'No location yet'}</b>
          <span className="eng-conflict-status">{c.check === 'edited-there' ? 'Removed here, kept' : KIND[c.kind]}</span>
        </header>
        <p className="eng-sent-away-what"><span className="kind">{kind}</span> {c.card.whatHappened.trim() || 'Nothing written yet'}</p>
        {c.check && <p className="hint eng-sent-away-check">{CHECK[c.check]}</p>}
      </article>;
    })}

    <div className="field eng-sent-away-reason">
      <label htmlFor="sent-away-reason">Why is a correction needed?</label>
      <textarea id="sent-away-reason" value={reason} onChange={e => onReason(e.target.value)} placeholder="Printed on the corrected revision" />
      <p className="hint">Starting a correction opens rev {sent.revision + 1} as a new draft with these changes already in it. Check it and send it as normal.</p>
    </div>
    {error && <p className="note note-bad" role="alert">{error}{errorLink && <> <Link href={errorLink.href}>{errorLink.label} &rarr;</Link></>}</p>}

    <div className="eng-conflict-save eng-sent-away-actions">
      {discarding
        ? <>
            <p>Discard {changes}? They are not in the sent report and cannot be got back.</p>
            <button type="button" className="btn-sm" onClick={() => setDiscarding(false)} disabled={busy}>Keep them</button>
            <button type="button" className="btn-sm btn-danger" onClick={onDiscard} disabled={busy}>Discard</button>
          </>
        : <>
            <button type="button" className="btn-sm" onClick={() => setDiscarding(true)} disabled={busy}>Discard my changes</button>
            <button type="button" className="btn-primary" onClick={onCorrect} disabled={busy}>{busy ? 'Starting…' : 'Start a correction with my changes'}</button>
          </>}
    </div>
  </section>;
}
