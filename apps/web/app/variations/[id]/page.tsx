"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getVariation, variationCommand } from "@/lib/api";
import { useProjectLookup } from '@/components/ProjectContext';
import type { Variation } from "@/lib/types";
import { PhotoImage } from '@/components/PhotoImage';
import { VariationTags } from '@/components/EngineerWorkspace';
import { fmtMoney, variationValue } from '@/lib/variations';

/**
 * A variation the engineer raised, after sending: the office's answer at the
 * top, the words and pictures as sent, the history, and a note back.
 *
 * The office prices and instructs; an engineer can only add to the history.
 * That is deliberate: the question this page answers is "what came of it?",
 * in the office's own words, so the engineer does not have to ring and ask.
 */
const EVENT: Record<string, string> = { raised: 'Raised', details: 'Details', priced: 'Priced', instructed: 'Instructed', declined: 'Declined', reopened: 'Reopened', note: 'Note' };
const LONDON = { timeZone: 'Europe/London' } as const;
const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { ...LONDON, weekday: 'short', day: 'numeric', month: 'short' }) : '';

export default function VariationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const getProject = useProjectLookup();
  const [v, setV] = useState<Variation | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getVariation(id).then(setV).catch(() => setMissing(true)); }, [id]);

  async function sendNote() {
    if (!v || !note.trim()) { setError('Write the note first.'); return; }
    setBusy(true); setError(null);
    try { setV(await variationCommand(v.id, { kind: 'note', note: note.trim() })); setNote(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'No connection. Nothing was recorded.'); }
    finally { setBusy(false); }
  }

  if (missing) return <main className="wrap"><div className="empty">That variation could not be found.</div></main>;
  if (!v) return <main className="wrap"><div className="empty" style={{ marginTop: 32 }}>Loading</div></main>;
  const project = getProject(v.projectId);
  const evidence = v.events.find(e => e.kind === 'raised')?.photos ?? [];
  const value = variationValue(v);
  const declinedWhy = v.instruction === 'declined' ? v.events.slice().reverse().find(e => e.kind === 'declined')?.note : undefined;
  const headline = v.instruction === 'instructed' ? `Instructed · ${v.instructionReference}`
    : v.instruction === 'declined' ? 'Declined'
    : v.workDone ? 'Done without a written instruction'
    : v.quotedValue !== undefined ? `Quoted ${fmtMoney(v.quotedValue)}`
    : 'With the office';
  const detail = v.instruction === 'instructed' ? `${v.instructedBy ?? ''} · ${v.instructedOn ?? ''} · ${fmtMoney(value)}${v.signedInstruction ? ' · signed copy on file' : ''}`
    : v.instruction === 'declined' ? (declinedWhy ?? 'The client will not instruct it.')
    : v.workDone ? 'The office is getting the client’s sign-off for it as a chargeable variation before it is invoiced.'
    : v.quotedValue !== undefined ? 'Put to the client; waiting on their instruction.'
    : 'Not yet priced. The office prices it from what you recorded, then puts it to the client.';
  const meta = [v.reason, v.workDone && 'already carried out when raised', v.askedBy && `asked for by ${v.askedBy}`, v.labourHours !== undefined && `about ${v.labourHours} hours`, v.partsCost !== undefined && `parts about ${fmtMoney(v.partsCost)}`].filter(Boolean).join(' · ');

  return <main className="wrap eng-page">
    <Link href={`/engineer?project=${encodeURIComponent(v.projectId)}`} className="back">&larr; {project?.projectName ?? 'Project'}</Link>
    <div className="pagehead">
      <div><h1 className="ref" style={{ fontSize: 22 }}>{v.reference}</h1><p className="sub">{v.location || 'Location not recorded'} · raised {fmtDay(v.raisedAt)} by {v.raisedBy}</p></div>
      <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', fontSize: 12, color: 'var(--text-3)' }}><VariationTags v={v} /></span>
    </div>

    <section className={`eng-band ${v.workDone && v.instruction === 'pending' ? 'alert' : ''}`} style={{ marginTop: 20 }}>
      <span className="lbl">The office</span>
      <h2 style={{ fontSize: 20 }}>{headline}</h2>
      <p>{detail}</p>
      {v.instruction === 'instructed' && v.signedInstruction && <div className="row"><a href={v.signedInstruction} target="_blank" rel="noreferrer">Open the signed copy ↗</a></div>}
    </section>

    <section className="eng-panel">
      <div className="eng-section-title" style={{ margin: '0 0 8px' }}><h2>{v.location || 'No location'}</h2><span className="kind tone-variation">Variation</span></div>
      <p style={{ margin: 0 }}>{v.description}</p>
      {meta && <p className="eng-help">{meta}</p>}
      {evidence.length > 0 && <div className="shots">{evidence.map((p, i) => <figure key={p.id} className="shot" style={{ margin: 0 }}><PhotoImage src={p.dataUrl} alt={p.caption || `Photograph ${i + 1}`} />{p.caption && <div className="shot-body"><span className="shot-no">{p.caption}</span></div>}</figure>)}</div>}
    </section>

    <div className="eng-section-title"><h2>History</h2><span className="r">{v.events.length}</span></div>
    <div className="eng-hist">
      {v.events.slice().reverse().map((e, i) => <div key={i}><span className="t">{fmtDay(e.at)}<br />{EVENT[e.kind] ?? e.kind}</span><div className="b"><p>{e.note || 'No note'}</p><small>{e.actor}</small></div></div>)}
    </div>

    <div className="eng-section-title"><h2>Add a note</h2></div>
    <section className="panel"><div className="panel-body">
      <div className="field"><label htmlFor="note">Anything the office should know</label><textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="The site manager confirmed it verbally on Tuesday; the panel is now fitted" /></div>
      {error && <div className="note note-bad">{error}</div>}
      <div className="btn-row"><button type="button" onClick={() => void sendNote()} disabled={busy}>{busy ? 'Sending…' : 'Send note'}</button></div>
      <p className="eng-help">Pricing and instructions are recorded by the office. Your note goes on the variation’s history for them to see.</p>
    </div></section>
  </main>;
}
