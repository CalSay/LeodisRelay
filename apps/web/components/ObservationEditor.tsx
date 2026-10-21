"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PhotoImage } from './PhotoImage';
import { WHERE, type Where } from '@/lib/uploadStatus';
import { CameraIcon } from './CameraIcon';
import { readPhoto, type Observation, type Photo } from "@/lib/api";
import { notAdded, PhotoNotAdded } from '@/lib/localMedia';
import { overLimit, TEXT_MAX } from '@/lib/textLimits';
import type { Issue, RoughSize } from "@/lib/types";
import { CARD_TYPES, OBSERVATION_TYPES, type ObservationType } from "@/lib/fixtures";
import { VARIATION_REASONS } from "@/lib/variations";
import { issueThumbnail, linkCandidates, shortReference } from '@/lib/issueLink';
import { usePrincipal } from './PrincipalContext';

/**
 * One card.
 *
 * Kind first, then only that kind's questions (proposal section 5: progressive
 * detail, in field wording). A progress card is where, what and photos. A
 * defect asks what needs doing, who, and which trade. A variation asks the
 * register's questions in site words: why it is extra, whether it has already
 * been done on a say-so, who asked, and a rough size. Nothing beyond the words
 * is required; the checks before sending say what is worth adding. The
 * optional questions are folded under "More for the office" (2026-10-21), so a
 * card on a phone is what the office must have, and the rest is one tap away.
 */
const TRADES = ['Electrical', 'HVAC', 'P&H', 'Other / non-Leodis'] as const;
const SIZES: [RoughSize, string][] = [['half-day', '½ day'], ['day', '1 day'], ['two-days', '2 days'], ['more', 'More']];

export function KindPicker({ onPick }: { onPick: (type: ObservationType) => void }) {
  const id = useId();
  return <div className="eng-pick">
    <div className="field"><label id={`pick-${id}`}>What kind of update is this?</label></div>
    <div className="eng-tiles" role="group" aria-labelledby={`pick-${id}`}>
      {CARD_TYPES.map(t => <button key={t.value} type="button" className={`eng-tile ${t.value}`} onClick={() => onPick(t.value)}><span className={`kind tone-${t.tone}`}>{t.short}</span><div><b>{t.pick}</b><small>{t.asks}</small></div></button>)}
    </div>
  </div>;
}

/** Chips for words typed on this job before. Picking one fills the box; typing anything else is always fine. */
export function Suggestions({ title, fewer, values, current, onPick }: { title: string; fewer: string; values: string[]; current: string; onPick: (value: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  if (values.length === 0) return null;
  const visible = showAll ? values : values.slice(0, 3);
  const hidden = values.length - visible.length;
  const chosen = current.trim().replace(/\s+/g, ' ').toLowerCase();
  return <div className="eng-suggestions">
    <div className="eng-suggestions-head"><span>{title}</span><span>{values.length}</span></div>
    <div className="eng-chips">{visible.map(v => <button key={v} type="button" className="eng-chip" aria-pressed={chosen === v.toLowerCase()} onClick={() => onPick(v)}>{v}</button>)}</div>
    {(hidden > 0 || showAll) && <button type="button" className="eng-suggestions-toggle" onClick={() => setShowAll(value => !value)}>{showAll ? fewer : `Show ${hidden} more`}</button>}
  </div>;
}

export function ObservationEditor({
  observation,
  index,
  folded = false,
  openIssues,
  locations,
  companies,
  photoWhere,
  onChange,
  onRemove,
  onRemovePhoto,
}: {
  observation: Observation;
  index: number;
  /**
   * Opened under its own row on the phone: the row is the card's heading, so
   * Remove goes to the foot of the card rather than on a line of its own.
   */
  folded?: boolean;
  openIssues: Issue[];
  locations: string[];
  /** Who has been asked to respond on this project before, newest first. */
  companies: string[];
  /** Whether a photograph has reached the server, when the page knows. */
  photoWhere?: (photoId: string) => Where | undefined;
  onChange: (next: Observation) => void;
  onRemove: () => void;
  /** Takes one photograph off the card; the page keeps it so the removal can be undone. */
  onRemovePhoto: (photoId: string) => void;
}) {
  const principal = usePrincipal();

  const set = <K extends keyof Observation>(key: K, value: Observation[K]) => onChange({ ...observation, [key]: value });
  const unset = (key: keyof Observation) => { const copy = { ...observation }; delete copy[key]; onChange(copy); };

  const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
  const tone = `tone-${type?.tone ?? "neutral"}`;
  const kind = observation.type;
  const raisesIssue = kind === "defect" || kind === "access";
  const id = observation.id;

  /**
   * The kind was chosen when the card was added ("+ Defect", or the big button
   * for a progress card), so the four kind buttons stay folded behind "Change
   * kind" (2026-10-21) and fold away again once one is picked.
   */
  const [choosingKind, setChoosingKind] = useState(false);
  const changeRef = useRef<HTMLButtonElement>(null);
  const focusAfterPick = useRef(false);
  useEffect(() => {
    if (choosingKind) document.getElementById(`kinds-${id}`)?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    else if (focusAfterPick.current) { focusAfterPick.current = false; changeRef.current?.focus(); }
  }, [choosingKind, id]);
  // A kind set from outside (a blank card turned into a defect by "+ Defect") folds the buttons too.
  useEffect(() => { setChoosingKind(false); }, [kind]);

  function pickKind(next: ObservationType) {
    if (next !== kind) {
      const copy: Observation = { ...observation, type: next };
      // A defect names the trade whose work it is; the engineer's own is the usual answer.
      if (next === 'defect' && !copy.affectedTrade && principal?.trade) copy.affectedTrade = principal.trade;
      onChange(copy);
    }
    focusAfterPick.current = true;
    setChoosingKind(false);
  }

  /** Linking a defect to an issue already raised takes that issue's trade, which is whose work it is. */
  function linkIssue(issueId: string | undefined) {
    if (!issueId) { unset('linkedIssueId'); return; }
    const trade = openIssues.find(i => i.id === issueId)?.affectedTrade;
    onChange({ ...observation, linkedIssueId: issueId, ...(kind === 'defect' && trade ? { affectedTrade: trade } : {}) });
  }

  const where = <div className="field">
    <label htmlFor={`loc-${id}`}>Where</label>
    <input id={`loc-${id}`} type="text" value={observation.location} onChange={(e) => set("location", e.target.value)} placeholder="Level 2 — Riser" autoComplete="off" />
    <Suggestions title="Recent places" fewer="Show fewer places" values={locations} current={observation.location} onPick={l => set("location", l)} />
    {locations.length > 0 && <p className="hint">Choose a recent place or type anything; it does not have to match.</p>}
  </div>;

  const alreadyRaised = raisesIssue && openIssues.length > 0 && <div className="field">
    <label id={`link-${id}`}>Is this something already raised?</label>
    <IssueLinkPicker labelledBy={`link-${id}`} issues={openIssues} location={observation.location} linkedId={observation.linkedIssueId} onPick={linkIssue}
      none={['No — this is new', 'Sending raises a new issue for the office to assign.']} />
    <p className="hint">{observation.linkedIssueId ? "This will be added to that issue's history rather than raising a new one." : "Linking avoids raising a second issue for the same defect."}</p>
  </div>;

  const changeButton = <button ref={changeRef} type="button" className="btn-quiet btn-sm eng-change-kind" aria-expanded={choosingKind} aria-controls={choosingKind ? `kinds-${id}` : undefined} onClick={() => setChoosingKind(v => !v)}>Change kind</button>;
  const kindPicker = choosingKind && <div className="field eng-kind-pick">
    <label id={`kind-${id}`}>Kind</label>
    <div id={`kinds-${id}`} className="kindrow" role="group" aria-labelledby={`kind-${id}`}>{CARD_TYPES.map(t => <button key={t.value} type="button" className={`tone-${t.tone}`} aria-pressed={kind === t.value} onClick={() => pickKind(t.value)}>{kind === t.value && <span aria-hidden="true">✓</span>}{t.short}</button>)}</div>
  </div>;

  const photos = <PhotoField observation={observation} note={kind === 'defect' ? ' · at least one' : ''} {...(photoWhere ? { photoWhere } : {})} onChange={onChange} onRemovePhoto={onRemovePhoto} />;

  return (
    <section className={`eng-card ${tone}`}>
      {/* The card's heading (its row on the phone, the list on a wide screen) says
          its kind, so the four kind buttons only come out after "Change kind". */}
      {!folded && <div className="head">
        <span className="lbl">Card {String(index + 1).padStart(2, "0")}</span>
        <div>
          {changeButton}
          <button type="button" className="btn-quiet btn-sm" onClick={onRemove} aria-label={`Remove card ${index + 1}`}>Remove</button>
        </div>
      </div>}
      {!folded && kindPicker}

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
          <label id={`trade-${id}`}>Trade affected</label>
          <div className="eng-seg" role="group" aria-labelledby={`trade-${id}`}>{TRADES.map(t => <button key={t} type="button" aria-pressed={observation.affectedTrade === t} onClick={() => set('affectedTrade', t)}>{t === 'Other / non-Leodis' ? 'Other' : t}</button>)}</div>
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

      {raisesIssue && <MoreDetail filled={!!(observation.actionNeeded.trim() || observation.owner.trim())} hint="What needs doing, and who should respond. Leave them and the office assigns it.">
        <div className="two">
        <div className="field">
          <label htmlFor={`action-${id}`}>What needs doing</label>
          <textarea id={`action-${id}`} value={observation.actionNeeded} onChange={(e) => set("actionNeeded", e.target.value)} placeholder="What has to happen to put this right" />
        </div>
        <div className="field">
          <label htmlFor={`owner-${id}`}>Who needs to respond</label>
          <input id={`owner-${id}`} type="text" value={observation.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Name or company" autoComplete="off" />
          <Suggestions title="Recent companies" fewer="Show fewer companies" values={companies} current={observation.owner} onPick={c => set("owner", c)} />
          <p className="hint">{companies.length ? 'Choose one or type any name. ' : ''}Leave blank if you do not know; the office assigns it rather than guessing.</p>
        </div>
        </div>
      </MoreDetail>}

      {kind === 'instruction' && <>
        <div className="field">
          <label htmlFor={`what-${id}`}>What extra work, and why</label>
          <textarea id={`what-${id}`} value={observation.whatHappened} onChange={(e) => set("whatHappened", e.target.value)} placeholder="What is needed beyond the drawings, and what made it necessary" />
        </div>
        {/* Already done on a say-so is what the office must chase for sign-off, so it is always asked. */}
        <div className="field">
          <label id={`done-${id}`}>Has the work already been done?</label>
          <div className="eng-seg ynq" role="group" aria-labelledby={`done-${id}`}><button type="button" className="yes" aria-pressed={observation.workDone === true} onClick={() => set('workDone', true)}>Yes, on a say-so</button><button type="button" className="no" aria-pressed={observation.workDone === false} onClick={() => set('workDone', false)}>Not yet</button></div>
          {observation.workDone && <p className="hint eng-hint-late">The office gets the client to sign for it as chargeable before it is invoiced. Name who asked.</p>}
        </div>
        {observation.workDone && <div className="field">
          <label htmlFor={`asked-${id}`}>Who asked for it on site · optional</label>
          <input id={`asked-${id}`} type="text" value={observation.askedBy ?? ''} onChange={(e) => e.target.value ? set('askedBy', e.target.value) : unset('askedBy')} placeholder="Name and company" maxLength={200} />
        </div>}
        <MoreDetail filled={observation.variationReason !== undefined || (!observation.workDone && !!observation.askedBy?.trim()) || observation.roughSize !== undefined || observation.partsEstimate !== undefined || !!observation.linkedIssueId} hint="Why it is extra, who asked, rough size, parts, an issue it is on">
        <div className="field">
          <label id={`reason-${id}`}>Reason</label>
          <div className="eng-chips" style={{ marginTop: 0 }} role="group" aria-labelledby={`reason-${id}`}>{VARIATION_REASONS.map(r => <button key={r} type="button" className="eng-chip" aria-pressed={observation.variationReason === r} onClick={() => observation.variationReason === r ? unset('variationReason') : set('variationReason', r)}>{r}</button>)}</div>
        </div>
        {!observation.workDone && <div className="field">
          <label htmlFor={`asked-${id}`}>Who asked for it on site</label>
          <input id={`asked-${id}`} type="text" value={observation.askedBy ?? ''} onChange={(e) => e.target.value ? set('askedBy', e.target.value) : unset('askedBy')} placeholder="Name and company" maxLength={200} />
        </div>}
        <div className="two">
          <div className="field">
            <label id={`size-${id}`}>Rough size</label>
            <div className="eng-chips" style={{ marginTop: 0 }} role="group" aria-labelledby={`size-${id}`}>{SIZES.map(([value, label]) => <button key={value} type="button" className="eng-chip" aria-pressed={observation.roughSize === value} onClick={() => observation.roughSize === value ? unset('roughSize') : set('roughSize', value)}>{label}</button>)}</div>
          </div>
          <div className="field">
            <label htmlFor={`parts-${id}`}>Cost of parts, if you know them</label>
            <div className="eng-money"><input id={`parts-${id}`} type="number" inputMode="decimal" min="0" step="1" value={observation.partsEstimate ?? ''} onChange={(e) => { const n = Number(e.target.value); e.target.value === '' || !Number.isFinite(n) || n < 0 ? unset('partsEstimate') : set('partsEstimate', Math.round(n * 100) / 100); }} placeholder="0" /></div>
            <p className="hint">A guess is fine; the office prices it.</p>
          </div>
        </div>
        {openIssues.length > 0 && <div className="field">
          <label id={`link-${id}`}>Is this on an issue already?</label>
          <IssueLinkPicker labelledBy={`link-${id}`} issues={openIssues} location={observation.location} linkedId={observation.linkedIssueId} onPick={(issueId) => issueId ? set('linkedIssueId', issueId) : unset('linkedIssueId')}
            none={['No', 'Not tied to an issue already raised here.']} />
          <p className="hint">A defect that turns out to be someone else’s damage becomes a chargeable variation on that issue.</p>
        </div>}
        </MoreDetail>
      </>}

      <TooLong observation={observation} />
      {photos}
      {folded && kindPicker}
      {folded && <div className="eng-card-foot">
        {changeButton}
        <button type="button" className="btn-quiet btn-sm eng-remove-card" onClick={onRemove} aria-label={`Remove card ${index + 1}`}>Remove card {index + 1}</button>
      </div>}
    </section>
  );
}

/**
 * A card's optional questions, folded under one line so the card on a phone is
 * what the office must have. Opens by itself when any of them has an answer,
 * so nothing written is ever hidden.
 */
function MoreDetail({ filled, hint, children }: { filled: boolean; hint: string; children: ReactNode }) {
  const [open, setOpen] = useState(filled);
  useEffect(() => { if (filled) setOpen(true); }, [filled]);
  return <details className="eng-more-detail" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>More for the office · optional<small>{hint}</small></summary>
    <div>{children}</div>
  </details>;
}

/**
 * Open issues on the project as pictures and words rather than refs, nearest
 * location first, so the engineer can tell which one they are looking at.
 */
function IssueLinkPicker({ labelledBy, issues, location, linkedId, onPick, none }: {
  labelledBy: string;
  issues: Issue[];
  location: string;
  linkedId: string | undefined;
  onPick: (issueId: string | undefined) => void;
  none: [title: string, detail: string];
}) {
  const [showAll, setShowAll] = useState(false);
  const { shown, hidden } = linkCandidates(issues, location, linkedId, showAll);
  return <>
    <div className="eng-linklist" role="group" aria-labelledby={labelledBy}>
      <button type="button" className="eng-linkrow" aria-pressed={!linkedId} onClick={() => onPick(undefined)}><div><b>{none[0]}</b><small>{none[1]}</small></div></button>
      {shown.map(i => { const p = issueThumbnail(i); return <button key={i.id} type="button" className="eng-linkrow" aria-pressed={linkedId === i.id} onClick={() => onPick(i.id)}>
        <div className={p ? 'thumb' : 'thumb empty'}>{p ? <PhotoImage src={p.dataUrl} alt="" /> : <span aria-hidden="true">No photo</span>}</div>
        <div><b>{i.description || 'No description'}</b><small>{shortReference(i.reference)} · {i.location || 'no location'} · {i.owner || 'unassigned'}</small></div>
      </button>; })}
    </div>
    {(hidden > 0 || showAll) && <button type="button" className="eng-suggestions-toggle" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer issues' : `Show all ${shown.length + hidden} open issues`}</button>}
  </>;
}

/**
 * A card's photographs: the camera button, then each photograph with where it
 * is and its caption. Shared by every kind of card, including an inspection's
 * checks, so a photograph behaves the same whatever it is evidence of.
 */
/** Said on the card before the server refuses it: nothing is cut off, the engineer shortens it. */
export function TooLong({ observation }: { observation: Observation }) {
  const longest = overLimit(observation);
  if (longest === null) return null;
  return <p className="note note-bad eng-too-long" role="alert">
    One box on this card is over {TEXT_MAX.toLocaleString('en-GB')} characters (it has {longest.toLocaleString('en-GB')}), so the card cannot be saved to the server. Shorten it; nothing has been cut off.
  </p>;
}

export function PhotoField({ observation, note, photoWhere, onChange, onRemovePhoto }: {
  observation: Observation;
  /** Added to the label, such as " · at least one". */
  note?: string;
  photoWhere?: (photoId: string) => Where | undefined;
  onChange: (next: Observation) => void;
  onRemovePhoto: (photoId: string) => void;
}) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The card as it is now: reading a photograph takes a moment, and the card may change kind meanwhile ("+ Defect" on a blank card). */
  const latest = useRef(observation);
  latest.current = observation;

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    // Each file on its own: one of the wrong type never costs the others chosen with it.
    const added: Photo[] = [];
    const refused: { name: string; why: string; advice: string }[] = [];
    for (const file of Array.from(files)) {
      try { added.push(await readPhoto(file)); }
      catch (error) {
        refused.push(error instanceof PhotoNotAdded ? { name: error.fileName, why: error.why, advice: error.advice }
          : { name: file.name || 'A photograph', why: 'could not be added', advice: 'Try adding it again.' });
      }
    }
    if (added.length) onChange({ ...latest.current, photos: [...latest.current.photos, ...added] });
    if (refused.length) setPhotoError(notAdded(added.length, refused));
    if (fileInput.current) fileInput.current.value = "";
  }

  return <div className="field">
    <label id={`photos-${observation.id}`}>Photographs{observation.photos.length > 0 ? ` · ${observation.photos.length}` : ""}{note ?? ''}</label>
    <label className="camera">
      <input ref={fileInput} aria-describedby={`photos-${observation.id}`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={(e) => addPhotos(e.target.files)} />
      <CameraIcon />{observation.photos.length ? "Add another photo" : "Take a photo"}
    </label>
    {photoError && <div className="note note-bad" style={{ marginTop: 12 }}>{photoError}</div>}
    {observation.photos.length > 0 && <div className="shots">
      {observation.photos.map((photo, i) => <figure key={photo.id} className="shot" style={{ margin: 0 }}>
        <PhotoImage src={photo.dataUrl} alt={photo.caption || `Photograph ${i + 1}`} />
        <div className="shot-body">
          <span className="shot-no">Photo {String(i + 1).padStart(2, "0")}</span>
          {(() => { const w = photoWhere?.(photo.id); return w ? <span className={`eng-where eng-where-${w}`}><span className={w === 'server' ? 'dot dot-ok' : 'dot dot-busy'} />{WHERE[w]}</span> : null; })()}
          <input type="text" value={photo.caption} onChange={(e) => onChange({ ...observation, photos: observation.photos.map((p) => p.id === photo.id ? { ...p, caption: e.target.value } : p) })} placeholder="Add a caption" aria-label={`Caption for photograph ${i + 1}`} />
          <button type="button" className="btn-quiet btn-sm" onClick={() => onRemovePhoto(photo.id)} aria-label={`Remove photo ${i + 1}`}>Remove</button>
        </div>
      </figure>)}
    </div>}
  </div>;
}
