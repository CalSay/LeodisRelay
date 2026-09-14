"use client";

import { useRef, useState } from "react";
import { PhotoImage } from './PhotoImage';
import { readPhoto, type Observation, type Photo } from "@/lib/api";
import type { Issue, RoughSize } from "@/lib/types";
import { OBSERVATION_TYPES, type ObservationType } from "@/lib/fixtures";
import { VARIATION_REASONS } from "@/lib/variations";
import { usePrincipal } from './PrincipalContext';

/**
 * One card.
 *
 * Kind first, then only that kind's questions (proposal section 5: progressive
 * detail, in field wording). A progress card is where, what and photos. A
 * defect asks what needs doing, who, and which trade. A variation asks the
 * register's questions in site words: why it is extra, whether it has already
 * been done on a say-so, who asked, and a rough size. Nothing beyond the words
 * is required; the checks before sending say what is worth adding.
 */
const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'] as const;
const SIZES: [RoughSize, string][] = [['half-day', '½ day'], ['day', '1 day'], ['two-days', '2 days'], ['more', 'More']];

export function KindPicker({ onPick }: { onPick: (type: ObservationType) => void }) {
  return <div className="eng-pick">
    <div className="field"><label>What kind of update is this?</label></div>
    <div className="eng-tiles">
      {OBSERVATION_TYPES.map(t => <button key={t.value} type="button" className={`eng-tile ${t.value}`} onClick={() => onPick(t.value)}><span className={`kind tone-${t.tone}`}>{t.short}</span><div><b>{t.pick}</b><small>{t.asks}</small></div></button>)}
    </div>
  </div>;
}

export function ObservationEditor({
  observation,
  index,
  openIssues,
  locations,
  onChange,
  onRemove,
}: {
  observation: Observation;
  index: number;
  openIssues: Issue[];
  locations: string[];
  onChange: (next: Observation) => void;
  onRemove: () => void;
}) {
  const principal = usePrincipal();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Observation>(key: K, value: Observation[K]) => onChange({ ...observation, [key]: value });
  const unset = (key: keyof Observation) => { const copy = { ...observation }; delete copy[key]; onChange(copy); };

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files)) added.push(await readPhoto(file));
      onChange({ ...observation, photos: [...observation.photos, ...added] });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photograph could not be added.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
  const tone = `tone-${type?.tone ?? "neutral"}`;
  const kind = observation.type;
  const raisesIssue = kind === "defect" || kind === "access";
  const id = observation.id;

  function changeKind(next: ObservationType) {
    const copy: Observation = { ...observation, type: next };
    // A defect names the trade whose work it is; the engineer's own is the usual answer.
    if (next === 'defect' && !copy.affectedTrade && principal?.trade) copy.affectedTrade = principal.trade;
    onChange(copy);
  }

  /** Issues already open here, nearest location first, as pictures and words rather than refs. */
  const candidates = openIssues.slice().sort((a, b) => Number(match(b, observation.location)) - Number(match(a, observation.location))).slice(0, 6);
  const linked = observation.linkedIssueId ? openIssues.find(i => i.id === observation.linkedIssueId) : undefined;
  const thumb = (i: Issue) => i.events.find(e => e.photos.length)?.photos[0];

  const where = <div className="field">
    <label htmlFor={`loc-${id}`}>Where</label>
    <input id={`loc-${id}`} type="text" value={observation.location} onChange={(e) => set("location", e.target.value)} placeholder="Level 2 — Riser" autoComplete="off" />
    {locations.length > 0 && <div className="eng-chips">{locations.slice(0, 8).map(l => <button key={l} type="button" className="eng-chip" aria-pressed={observation.location.trim().toLowerCase() === l.toLowerCase()} onClick={() => set("location", l)}>{l}</button>)}</div>}
    <p className="hint">Places already used on this project. Type anything; nothing has to match.</p>
  </div>;

  const alreadyRaised = raisesIssue && openIssues.length > 0 && <div className="field">
    <label>Is this something already raised?</label>
    <div className="eng-linklist">
      <button type="button" className="eng-linkrow" aria-pressed={!observation.linkedIssueId} onClick={() => unset('linkedIssueId')}><div><b>No — this is new</b><small>Sending raises a new issue for the office to assign.</small></div></button>
      {(linked && !candidates.some(i => i.id === linked.id) ? [linked, ...candidates] : candidates).map(i => { const p = thumb(i); return <button key={i.id} type="button" className="eng-linkrow" aria-pressed={observation.linkedIssueId === i.id} onClick={() => set('linkedIssueId', i.id)}>
        <div className="thumb">{p && <PhotoImage src={p.dataUrl} alt="" />}</div>
        <div><b>{i.description}</b><small>{i.reference.split('-').slice(1).join('-')} · {i.location || 'no location'} · {i.owner || 'unassigned'}</small></div>
      </button>; })}
    </div>
    <p className="hint">{observation.linkedIssueId ? "This will be added to that issue's history rather than raising a new one." : "Linking avoids raising a second issue for the same defect."}</p>
  </div>;

  const photos = <div className="field">
    <label>Photographs{observation.photos.length > 0 ? ` · ${observation.photos.length}` : ""}{kind === 'defect' ? ' · at least one' : ''}</label>
    <label className="camera">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e) => addPhotos(e.target.files)} />
      Take photograph
    </label>
    {photoError && <div className="note note-bad" style={{ marginTop: 12 }}>{photoError}</div>}
    {observation.photos.length > 0 && <div className="shots">
      {observation.photos.map((photo, i) => <figure key={photo.id} className="shot" style={{ margin: 0 }}>
        <PhotoImage src={photo.dataUrl} alt={photo.caption || `Photograph ${i + 1}`} />
        <div className="shot-body">
          <span className="shot-no">Photo {String(i + 1).padStart(2, "0")}</span>
          <input type="text" value={photo.caption} onChange={(e) => onChange({ ...observation, photos: observation.photos.map((p) => p.id === photo.id ? { ...p, caption: e.target.value } : p) })} placeholder="What does this show?" aria-label={`Caption for photograph ${i + 1}`} />
          <button className="btn-quiet btn-sm" onClick={() => onChange({ ...observation, photos: observation.photos.filter((p) => p.id !== photo.id) })}>Remove</button>
        </div>
      </figure>)}
    </div>}
  </div>;

  return (
    <section className={`eng-card ${tone}`}>
      <div className="head">
        <span className="lbl">Card {String(index + 1).padStart(2, "0")}</span>
        <div>
          {type && <span className={`kind ${tone}`}>{type.short}</span>}
          <button className="btn-quiet btn-sm" onClick={onRemove}>Remove</button>
        </div>
      </div>

      <div className="field">
        <label>Kind</label>
        <div className="kindrow">{OBSERVATION_TYPES.map(t => <button key={t.value} type="button" aria-pressed={kind === t.value} onClick={() => changeKind(t.value)}>{t.short}</button>)}</div>
      </div>

      {where}

      {kind === 'update' && <div className="field">
        <label htmlFor={`what-${id}`}>What happened</label>
        <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} placeholder="Work done or progressed" />
      </div>}

      {kind === 'defect' && <>
        {alreadyRaised}
        <div className="field">
          <label htmlFor={`what-${id}`}>What’s wrong</label>
          <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} placeholder="Say what you saw" />
        </div>
        <div className="field">
          <label>Trade affected</label>
          <div className="eng-seg">{TRADES.map(t => <button key={t} type="button" aria-pressed={observation.affectedTrade === t} onClick={() => set('affectedTrade', t)}>{t === 'Other / non-Leodis' ? 'Other' : t}</button>)}</div>
          <p className="hint">Whose work it is, not who you are. “Other” covers the main contractor and other trades.</p>
        </div>
      </>}

      {kind === 'access' && <>
        <div className="field">
          <label htmlFor={`what-${id}`}>What was blocked, and by whom</label>
          <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} placeholder="What you could not get to, and why" />
        </div>
        {alreadyRaised}
      </>}

      {raisesIssue && <div className="two">
        <div className="field">
          <label htmlFor={`action-${id}`}>What needs doing</label>
          <textarea id={`action-${id}`} value={observation.actionNeeded} onChange={(e) => set("actionNeeded", e.target.value)} placeholder="What has to happen to put this right" />
        </div>
        <div className="field">
          <label htmlFor={`owner-${id}`}>Who needs to respond</label>
          <input id={`owner-${id}`} type="text" value={observation.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Name or company" />
          <p className="hint">Leave blank if you do not know; the office assigns it rather than guessing.</p>
        </div>
      </div>}

      {kind === 'instruction' && <>
        <div className="field">
          <label htmlFor={`what-${id}`}>What extra work, and why</label>
          <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} placeholder="What is needed beyond the drawings, and what made it necessary" />
        </div>
        <div className="field">
          <label>Reason</label>
          <div className="eng-chips" style={{ marginTop: 0 }}>{VARIATION_REASONS.map(r => <button key={r} type="button" className="eng-chip" aria-pressed={observation.variationReason === r} onClick={() => observation.variationReason === r ? unset('variationReason') : set('variationReason', r)}>{r}</button>)}</div>
        </div>
        <div className="two">
          <div className="field">
            <label>Has the work already been done?</label>
            <div className="eng-seg ynq"><button type="button" className="yes" aria-pressed={observation.workDone === true} onClick={() => set('workDone', true)}>Yes, on a say-so</button><button type="button" className="no" aria-pressed={observation.workDone === false} onClick={() => set('workDone', false)}>Not yet</button></div>
            {observation.workDone && <p className="hint eng-hint-late">The office gets the client to sign for it as chargeable before it is invoiced. Name who asked.</p>}
          </div>
          <div className="field">
            <label htmlFor={`asked-${id}`}>Who asked for it on site · optional</label>
            <input id={`asked-${id}`} type="text" value={observation.askedBy ?? ''} onChange={(e) => e.target.value ? set('askedBy', e.target.value) : unset('askedBy')} placeholder="Name and company" maxLength={200} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label>Rough size · optional</label>
            <div className="eng-chips" style={{ marginTop: 0 }}>{SIZES.map(([value, label]) => <button key={value} type="button" className="eng-chip" aria-pressed={observation.roughSize === value} onClick={() => observation.roughSize === value ? unset('roughSize') : set('roughSize', value)}>{label}</button>)}</div>
          </div>
          <div className="field">
            <label htmlFor={`parts-${id}`}>Cost of parts, if you know them · optional</label>
            <div className="eng-money"><input id={`parts-${id}`} type="number" inputMode="decimal" min="0" step="1" value={observation.partsEstimate ?? ''} onChange={(e) => { const n = Number(e.target.value); e.target.value === '' || !Number.isFinite(n) || n < 0 ? unset('partsEstimate') : set('partsEstimate', Math.round(n * 100) / 100); }} placeholder="0" /></div>
            <p className="hint">A guess is fine; the office prices it.</p>
          </div>
        </div>
        {openIssues.length > 0 && <div className="field">
          <label htmlFor={`link-${id}`}>Is this on an issue already? · optional</label>
          <select id={`link-${id}`} value={observation.linkedIssueId ?? ''} onChange={(e) => e.target.value ? set('linkedIssueId', e.target.value) : unset('linkedIssueId')}>
            <option value="">No</option>
            {candidates.map(i => <option key={i.id} value={i.id}>{i.reference.split('-').slice(1).join('-')} · {i.description}</option>)}
          </select>
          <p className="hint">A defect that turns out to be someone else’s damage becomes a chargeable variation on that issue.</p>
        </div>}
      </>}

      {photos}
    </section>
  );
}

function match(issue: Issue, location: string): boolean {
  const a = issue.location.trim().toLowerCase(), b = location.trim().toLowerCase();
  return !!a && !!b && (a.includes(b) || b.includes(a));
}
