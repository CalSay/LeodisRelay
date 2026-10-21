"use client";

import { useEffect, useRef, useState } from 'react';
import { ApiError, renameInspected } from '@/lib/api';
import { INSPECTED_MAX, inspectedName, type ReportTypeDef } from '@/lib/reportTypes';
import type { Report } from '@/lib/types';

/**
 * What an inspection of one thing is about, under the report's title: "Tower
 * or podium · T3, level 2 east corridor". Its author can rename it while it
 * is a draft (T3 that was really T4); once sent it is fixed, like the rest
 * of the report. Renaming needs a connection: it is not part of the draft's
 * saved checks, so it is never held on the phone to go up later.
 */
export function InspectedName({ report, type, editable, onRenamed }: {
  report: Pick<Report, 'id' | 'inspected'>;
  type: ReportTypeDef;
  editable: boolean;
  onRenamed: (name: string) => void;
}) {
  const about = type.inspects;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(report.inspected ?? '');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => { if (editing) input.current?.focus(); else if (moved.current) opener.current?.focus(); moved.current = true; }, [editing]);
  if (!about) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const named = inspectedName(type, name);
    if (!named.ok) { setProblem(named.reason); input.current?.focus(); return; }
    if (named.value === report.inspected) { setEditing(false); return; }
    setBusy(true); setProblem('');
    try {
      const saved = await renameInspected(report.id, named.value!);
      onRenamed(saved.inspected ?? named.value!);
      setSaid(`Renamed to ${saved.inspected ?? named.value}.`);
      setEditing(false);
    } catch (error) {
      setProblem(error instanceof ApiError && error.offline ? 'No connection. Rename it when there is signal.' : error instanceof Error ? error.message : 'It could not be renamed. Try again.');
    } finally { setBusy(false); }
  }

  if (editing) return <form className="eng-inspected eng-inspected-form" onSubmit={save}>
    <label htmlFor="inspected-name" className="lbl">{about.label}</label>
    <input ref={input} id="inspected-name" type="text" value={name} maxLength={INSPECTED_MAX} autoComplete="off" placeholder={about.placeholder}
      aria-describedby="inspected-hint" aria-invalid={problem ? true : undefined} onChange={e => { setName(e.target.value); setProblem(''); }} />
    <p id="inspected-hint" className="hint">{problem ? <span role="alert" className="eng-inspected-problem">{problem}</span> : about.hint}</p>
    <div className="btn-row">
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save name'}</button>
      <button type="button" disabled={busy} onClick={() => { setEditing(false); setName(report.inspected ?? ''); setProblem(''); }}>Cancel</button>
    </div>
  </form>;

  return <div className="eng-inspected">
    <p><span className="lbl">{about.label}</span> <b>{report.inspected || 'Not named'}</b></p>
    {editable && <button ref={opener} type="button" className="eng-link-button" onClick={() => { setName(report.inspected ?? ''); setSaid(''); setEditing(true); }}>Rename</button>}
    <span className="eng-sr" role="status">{said}</span>
  </div>;
}
