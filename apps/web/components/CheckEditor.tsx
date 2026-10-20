"use client";

import type { Where } from '@/lib/uploadStatus';
import type { CheckAnswer, Observation } from '@/lib/types';
import { CHECK_ANSWERS } from '@/lib/reportTypes';
import { PhotoField, Suggestions } from './ObservationEditor';

/**
 * One check on an inspection (EXP-5).
 *
 * The question first, then three answers. Satisfactory and not applicable
 * need nothing more; a note or photograph is there if it helps. Action needed
 * asks what is wrong, what has to happen and who is to do it, which is what
 * goes in the inspection's action list. On a safety inspection nothing is
 * raised from it: the inspection itself is the record. On a handover
 * inspection (`raises`) the action is a snag in our own work, so it also asks
 * where, and sending raises it as an issue.
 */
export function CheckEditor({ observation, index, total, hint, raises, locations, companies, photoWhere, onChange, onRemovePhoto }: {
  observation: Observation;
  /** Actions raise issues on the snag list, so each one says where. */
  raises?: boolean;
  locations?: string[];
  index: number;
  total: number;
  hint: string;
  companies: string[];
  photoWhere?: (photoId: string) => Where | undefined;
  onChange: (next: Observation) => void;
  onRemovePhoto: (photoId: string) => void;
}) {
  const check = observation.check;
  if (!check) return null;
  const id = observation.id;
  const answer = check.answer;
  const set = <K extends keyof Observation>(key: K, value: Observation[K]) => onChange({ ...observation, [key]: value });

  /**
   * Choosing an answer. Moving off "Action needed" clears what needs doing and
   * who (and where), since the inspection would otherwise carry an action
   * nobody asked for; the note and photographs stay, as they describe what
   * was seen.
   */
  function choose(next: CheckAnswer) {
    const copy: Observation = { ...observation, check: { ...check!, answer: next } };
    if (next !== 'action') { copy.actionNeeded = ''; copy.owner = ''; copy.location = ''; }
    onChange(copy);
  }

  const tone = answer === 'action' ? 'tone-defect' : 'tone-neutral';
  return <section className={`eng-card eng-check-card ${tone}`} aria-labelledby={`q-${id}`}>
    <div className="head">
      <span className="lbl">Check {String(index + 1).padStart(2, '0')} of {total}</span>
      {answer && <span className={`kind ${tone}`}>{CHECK_ANSWERS.find(a => a.value === answer)?.label}</span>}
    </div>
    <h3 id={`q-${id}`} className="eng-check-question">{check.question}</h3>
    {hint && <p className="hint eng-check-hint">{hint}</p>}

    <div className="field">
      <div className="eng-seg eng-answers" role="group" aria-labelledby={`q-${id}`}>
        {CHECK_ANSWERS.map(a => <button key={a.value} type="button" className={`answer-${a.tone}`} aria-pressed={answer === a.value} onClick={() => choose(a.value)}>
          {answer === a.value && <span aria-hidden="true">✓ </span>}{a.label}
        </button>)}
      </div>
    </div>

    {answer === 'action' ? <>
      {raises && <div className="field">
        <label htmlFor={`where-${id}`}>Where</label>
        <input id={`where-${id}`} type="text" value={observation.location} onChange={(e) => set('location', e.target.value)} placeholder="Room, riser or grid, e.g. L2 office 2.04" autoComplete="off" />
        <Suggestions title="Recent places" fewer="Show fewer places" values={locations ?? []} current={observation.location} onPick={l => set('location', l)} />
      </div>}
      <div className="field">
        <label htmlFor={`what-${id}`}>What’s wrong</label>
        <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set('whatHappened', e.target.value)} placeholder={raises ? 'Say what is unfinished or wrong' : 'Say what you found, and where'} />
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor={`action-${id}`}>What needs doing</label>
          <textarea id={`action-${id}`} value={observation.actionNeeded} onChange={(e) => set('actionNeeded', e.target.value)} placeholder={raises ? 'What has to happen before handover' : 'What has to happen to make it safe'} />
        </div>
        <div className="field">
          <label htmlFor={`owner-${id}`}>Who is to do it</label>
          <input id={`owner-${id}`} type="text" value={observation.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Name or company" autoComplete="off" />
          <Suggestions title="Recent companies" fewer="Show fewer companies" values={companies} current={observation.owner} onPick={c => set('owner', c)} />
          <p className="hint">{raises ? 'Raised as an issue on the snag list when you send.' : 'Printed on the inspection’s action list.'}</p>
        </div>
      </div>
      <PhotoField observation={observation} note=" · recommended" {...(photoWhere ? { photoWhere } : {})} onChange={onChange} onRemovePhoto={onRemovePhoto} />
    </> : answer ? <>
      <div className="field">
        <label htmlFor={`what-${id}`}>Notes · optional</label>
        <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set('whatHappened', e.target.value)} placeholder={answer === 'na' ? 'Why it does not apply, if worth saying' : 'Anything worth recording'} />
      </div>
      <PhotoField observation={observation} note=" · optional" {...(photoWhere ? { photoWhere } : {})} onChange={onChange} onRemovePhoto={onRemovePhoto} />
    </> : null}

  </section>;
}
