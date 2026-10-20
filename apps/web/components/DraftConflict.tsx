"use client";
import { useMemo, useState } from 'react';
import type { Observation, Report } from '@/lib/types';
import { OBSERVATION_TYPES } from '@/lib/fixtures';
import { choicesFor, compareDrafts, defaultChoice, mergeDrafts, mergeSummary, type CardChoice, type CardDiff, type DraftBase } from '@/lib/draftConflict';

const fmtWhen = (iso?: string) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const STATUS: Record<CardDiff['status'], string> = {
  same: 'Same in both',
  changed: 'Changed in both',
  here: 'Only on this screen',
  there: 'Only on the server',
};
/** What the server copy this screen built on says happened, when it is known. */
const CHANGE: Record<NonNullable<CardDiff['change']>, string> = {
  'changed-there': 'Changed on the server',
  'changed-here': 'Changed on this screen',
  'removed-there': 'Removed on the server',
  'removed-here': 'Removed on this screen',
};
const CHOICE: Record<CardChoice, string> = {
  here: 'Keep this screen’s',
  there: 'Keep the server’s',
  both: 'Keep both as two cards',
  none: 'Leave it out',
};
/** For a card that is only in one version, "keep" reads better than whose. */
const KEEP_ONE: Partial<Record<CardChoice, string>> = { here: 'Keep it', there: 'Keep it' };

/** The fields worth comparing, in the order the card asks them. */
const FIELDS: { label: string; value: (o: Observation) => string }[] = [
  { label: 'Kind', value: o => OBSERVATION_TYPES.find(t => t.value === o.type)?.short ?? o.type },
  { label: 'Where', value: o => o.location.trim() || '—' },
  { label: 'What', value: o => o.whatHappened.trim() || '—' },
  { label: 'Action', value: o => o.actionNeeded.trim() || '—' },
  { label: 'For', value: o => o.owner.trim() || '—' },
  { label: 'Photos', value: o => o.photos.length ? o.photos.map((p, i) => p.caption.trim() || `Photo ${i + 1}`).join(' · ') : 'None' },
  { label: 'Details', value: o => [o.affectedTrade, o.variationReason, o.workDone === true ? 'already done' : o.workDone === false ? 'not yet done' : '', o.askedBy, o.roughSize, o.partsEstimate !== undefined ? `£${o.partsEstimate}` : '', o.linkedIssueId ? 'linked to an issue' : ''].filter(Boolean).join(' · ') || '—' },
];

/**
 * Shown in place of the editor when this draft was saved from another tab or
 * device first. Both versions are laid out card by card, nothing is chosen
 * for the engineer without being shown, and saving says what it keeps.
 */
export function DraftConflict({ here, there, base, saving, unheld, onSave }: {
  here: Report; there: Report; base?: DraftBase; saving: boolean; unheld?: boolean;
  onSave: (merged: Report) => void;
}) {
  const comparison = useMemo(() => compareDrafts(here, there, base), [here, there, base]);
  const [choices, setChoices] = useState<Record<string, CardChoice>>({});
  const [signature, setSignature] = useState<'here' | 'there'>(comparison.signatureChoice);
  const choiceOf = (card: CardDiff) => {
    const asked = choices[card.id];
    return asked && choicesFor(card).includes(asked) ? asked : defaultChoice(card);
  };
  const differing = comparison.cards.filter(c => c.status !== 'same');
  const same = comparison.cards.length - differing.length;

  function all(side: 'here' | 'there') {
    setChoices(Object.fromEntries(comparison.cards.map(card => [card.id,
      card.status === 'same' ? 'here' : card.status === side ? side : card.status === 'changed' ? side : 'none'])));
    setSignature(side);
  }

  function save() {
    onSave(mergeDrafts(here, there, comparison, choices, signature, () => `obs-${Math.random().toString(36).slice(2, 10)}`));
  }

  const number = (card: CardDiff) => String(comparison.cards.indexOf(card) + 1).padStart(2, '0');
  const sigText = (r: Report) => r.draftSignature ? `${r.draftSignature.name}${r.draftSignature.dataUrl ? ', drawn' : ', not drawn'}` : 'Not signed';

  return <section className="eng-conflict" aria-labelledby="conflict-title">
    <div className="note note-bad">
      <h2 id="conflict-title">This draft was also changed somewhere else</h2>
      <p>Another tab or device saved it{there.lastSavedAt ? ` at ${fmtWhen(there.lastSavedAt)}` : ''} while you were working here. Nothing has been lost: both versions are below{base ? ', with what each side changed picked out' : ''}. Choose what to keep, then save.</p>
      {unheld && <p><strong>This device would not keep a copy of this screen’s version. Do not close this page until you have saved.</strong></p>}
    </div>

    <div className="eng-conflict-all" role="group" aria-label="Keep a whole version">
      <button type="button" className="btn-sm" onClick={() => all('here')}>Keep everything on this screen</button>
      <button type="button" className="btn-sm" onClick={() => all('there')}>Keep everything on the server</button>
    </div>

    <div className="sec"><span className="lbl">{differing.length} card{differing.length === 1 ? '' : 's'} differ{differing.length === 1 ? 's' : ''}{same ? ` · ${same} the same` : ''}</span></div>
    {differing.length === 0 && <p className="hint">Every card is the same in both. Only the signature differs.</p>}
    {differing.map(card => {
      const choice = choiceOf(card);
      const sides = card.status === 'changed' ? (['here', 'there'] as const) : card.status === 'here' ? (['here'] as const) : (['there'] as const);
      const one = card.here ?? card.there!;
      return <article key={card.id} className={`eng-conflict-card ${choice === 'none' ? 'is-out' : ''}`} data-card={card.id}>
        <header>
          <span className="no">{number(card)}</span>
          <b>{one.location.trim() || 'No location yet'}</b>
          <span className={`eng-conflict-status st-${card.status}`}>{card.change ? CHANGE[card.change] : STATUS[card.status]}</span>
        </header>
        <div className={`eng-conflict-sides n${sides.length}`}>
          {sides.map(side => {
            const o = side === 'here' ? card.here! : card.there!;
            const other = side === 'here' ? card.there : card.here;
            return <div key={side} className={`eng-conflict-side ${choice === side || choice === 'both' ? 'is-kept' : ''}`}>
              <span className="lbl">{side === 'here' ? 'On this screen' : 'On the server'}</span>
              <dl>{FIELDS.map(f => {
                const value = f.value(o);
                const differs = !!other && f.value(other) !== value;
                // Empty fields are left out unless the other version filled them in.
                if (value === '—' && !differs) return null;
                return <div key={f.label} className={differs ? 'differs' : ''}><dt>{f.label}</dt><dd>{value}</dd></div>;
              })}</dl>
            </div>;
          })}
        </div>
        <div className="eng-seg" role="group" aria-label={`Card ${number(card)}`}>
          {choicesFor(card).map(c => <button key={c} type="button" aria-pressed={choice === c}
            onClick={() => setChoices(prev => ({ ...prev, [card.id]: c }))}>
            {card.status === 'changed' ? CHOICE[c] : KEEP_ONE[c] ?? CHOICE[c]}
          </button>)}
        </div>
      </article>;
    })}

    {comparison.signature && <article className="eng-conflict-card">
      <header><b>Signature</b><span className="eng-conflict-status st-changed">Different in each</span></header>
      <div className="eng-seg" role="group" aria-label="Signature">
        {(['here', 'there'] as const).map(side => <button key={side} type="button" aria-pressed={signature === side} onClick={() => setSignature(side)}>
          {side === 'here' ? 'This screen’s' : 'The server’s'}: {sigText(side === 'here' ? here : there)}
        </button>)}
      </div>
    </article>}

    <div className="eng-conflict-save">
      <p aria-live="polite">{mergeSummary(comparison, choices)}</p>
      <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save this version'}</button>
    </div>
  </section>;
}
