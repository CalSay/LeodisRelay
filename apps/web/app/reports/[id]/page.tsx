"use client";
import { useProjectLookup } from "@/components/ProjectContext";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getReport,
  newObservation,
  openIssues as fetchOpenIssues,
  projectLocations,
  reviewReport,
  saveReport,
  submitReport,
  type Observation,
  type Report,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { clientId } from '@/lib/clientId';
import { hasUnsent, keep, recover, releaseIfCurrent } from "@/lib/localDraft";
import { KindPicker, ObservationEditor } from "@/components/ObservationEditor";
import { SignaturePad } from "@/components/SignaturePad";
import type { Issue as IssueSummary } from "@/lib/types";
import { usePrincipal } from '@/components/PrincipalContext';
import { useRouter } from 'next/navigation';
import { correctReport as requestCorrection } from '@/lib/api';
import { ownsReport } from '@/lib/auth/access';
import { acknowledgementStatus, deliveryStatus, reviewStatus, toneClass } from '@/lib/status';
import { OBSERVATION_TYPES, type ObservationType } from '@/lib/fixtures';

type SaveState = "clean" | "saving" | "saved" | "phone" | "unheld" | "error";

/**
 * Where the work is, said plainly.
 *
 * "On this phone only" is deliberately not a success state and does not get the
 * green dot. Proposal section 5 is explicit that a tick for a local save must
 * not suggest the work is safely with Leodis, and the whole point of separating
 * these states is that an engineer can tell at a glance which one they are in.
 */
const SAVE: Record<SaveState, { dot: string; text: string }> = {
  clean: { dot: "dot", text: "" },
  saving: { dot: "dot dot-busy", text: "Saving to server" },
  saved: { dot: "dot dot-ok", text: "Saved on server" },
  phone: { dot: "dot dot-busy", text: "On this device only — will retry saving when connected" },
  // The dangerous state, and the only one that warrants alarm: the work is
  // neither on the server nor held on the device, so closing the page loses it.
  unheld: { dot: "dot dot-bad", text: "NOT SAVED ANYWHERE — keep this page open" },
  error: { dot: "dot dot-bad", text: "Not saved — check connection" },
};

const KINDS: ObservationType[] = ['update', 'defect', 'instruction', 'access'];
const fmtWhen = (iso?: string) => iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const getProject = useProjectLookup();
  const { id } = use(params);
  const principal = usePrincipal();
  const router = useRouter();
  const [selectedSection,setSelectedSection] = useState<string | null>(null);
  /** Cards added this session whose kind has not been chosen yet: they show the picker, not the form. */
  const [picking,setPicking] = useState<string[]>([]);
  const [correcting,setCorrecting] = useState(false);
  const [correctionReason,setCorrectionReason] = useState('');
  const [correctionError,setCorrectionError] = useState('');
  const [locations,setLocations] = useState<string[]>([]);

  const [report, setReport] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [projectIssues, setProjectIssues] = useState<IssueSummary[]>([]);
  const [signerName, setSignerName] = useState("");
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Report | null>(null);
  /** Who is signed in, for scoping work held on this device. */
  const [principalId, setPrincipalId] = useState<string | null>(null);
  /**
   * Every edit gets a number. It identifies which copy is held on the device,
   * so a save that lands late releases only the edit it actually saved.
   */
  const seq = useRef<number | string>(0);
  /**
   * Saves run one at a time along this chain. Debouncing alone left two
   * requests in flight whenever somebody kept typing, and the earlier one could
   * land last and win.
   */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /**
   * The report as it currently stands, for retries that did not originate from
   * an edit. Recovered work is the case that matters: after a reload there is
   * nothing pending, so without this a report restored from the device would
   * sit there until somebody happened to type — which is precisely the moment
   * an engineer assumes it has gone.
   */
  const latest = useRef<Report | null>(null);
  const serverVersion = useRef<number | undefined>(undefined);
  const sending = useRef(false);
  const [recovered,setRecovered] = useState(false);
  /** `?add=instruction` from the home tile opens the draft with a new card of that kind. Honoured once. */
  const addedFromLink = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const principal = d?.principal?.id ?? null;
        setPrincipalId(principal);
        try { if (principal) sessionStorage.setItem('relay-offline-principal',principal); else sessionStorage.removeItem('relay-offline-principal'); } catch {}
      })
      .catch(() => {setPrincipalId(null);setMissing(true);});
  }, []);

  useEffect(() => {
    if (principalId === null) return;
    let cancelled = false;
    (async () => {
      let found;
      try {
        found = await getReport(id);
      } catch {
        const held = await recover(id,principalId);
        if (!cancelled && held?.report) {
          seq.current=held.seq;serverVersion.current=held.baseVersion ?? 0;
          setReport({...held.report,observations:held.observations,version:held.baseVersion ?? 0});
          setSaveState('phone');
        } else if (!cancelled) setMissing(true);
        return;
      }
      if (cancelled) return;
      if (!found) {
        setMissing(true);
        return;
      }
      serverVersion.current = found.version;
      // Retain the original base version. Local work is not necessarily newer
      // than changes made on another device while this phone was disconnected.
      const held = await recover(id, principalId);
      if (cancelled) return;
      if (held && found.state === "draft") {
        seq.current = held.seq;
        serverVersion.current = held.baseVersion ?? 0;
        setReport({ ...found, version:held.baseVersion ?? 0, observations: held.observations });
        setSaveState("phone");
        setRecovered(true);
      } else {
        setReport(found);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, principalId]);

  /**
   * Autosave after a pause, not on every keystroke: on a poor connection that
   * produces a queue of requests that all land at once and finish out of order.
   */
  const scheduleSave = useCallback(
    (next: Report) => {
      if (!principalId) return;

      pending.current = next;
      setSaveState("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);

      const mySeq = (seq.current = clientId());

      // Mirror to the device first, and know whether it worked. Whatever the
      // network then does the work survives a reload, a crash or a flat
      // battery — but only if this actually succeeded, so the result is kept.
      const held = keep({
        reportId: next.id,
        principalId,
        seq: mySeq,
        observations: next.observations,
        baseVersion:serverVersion.current ?? next.version,
        report:next,
      }).then(
        () => true,
        () => false,
      );

      saveTimer.current = setTimeout(() => {
        // Queued behind whatever is already running, so there is never more
        // than one save in flight for this report.
        chain.current = chain.current.then(async () => {
          const toSave = next;
          if (!toSave) return;
          try {
            const saved = await saveReport(toSave, serverVersion.current ?? toSave.version,principalId);
            serverVersion.current = saved.version;
            // Release only the edit that was acknowledged. Anything typed
            // since keeps its copy on the device.
            await releaseIfCurrent(toSave.id, principalId, mySeq);
            setReport((current) => (current ? { ...current, version: saved.version } : saved));
            if (seq.current === mySeq) {
              pending.current = null;
              setSaveState('saved');
            }
          } catch (error) {
            if (!(error instanceof ApiError && error.offline)) setSubmitError(error instanceof Error ? error.message : 'Unable to save.');
            const offline = error instanceof ApiError && error.offline;
            // Not on the server. Whether that is merely inconvenient or
            // actually dangerous depends on whether the device took a copy.
            if (seq.current === mySeq) setSaveState((await held) ? (offline ? "phone" : "error") : "unheld");
          }
        });
      }, 700);
    },
    [principalId],
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);
  useEffect(() => {
    if (recovered && report && principalId) { setRecovered(false); scheduleSave(report); }
  },[recovered,report,principalId,scheduleSave]);

  // Coming back into signal retries by itself. An engineer walking out of a
  // basement should not have to know to press anything.
  useEffect(() => {
    async function onOnline() {
      const current = pending.current ?? latest.current;
      if (!current || current.state !== "draft" || !principalId || sending.current) return;
      if (await hasUnsent(current.id, principalId)) scheduleSave(current);
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [scheduleSave, principalId]);

  useEffect(() => {
    latest.current = report;
    if (report && signerName === "") setSignerName(report.author);
  }, [report]);

  // Context from previous visits. Fetched once the report is known so the
  // engineer can attach a repeat sighting instead of raising a duplicate, and
  // pick a place already used here rather than typing it again.
  useEffect(() => {
    if (!report) return;
    fetchOpenIssues(report.projectId)
      .then(setProjectIssues)
      .catch(() => setProjectIssues([]));
    projectLocations(report.projectId).then(setLocations).catch(() => setLocations([]));
  }, [report?.projectId]);

  function update(next: Report) {
    if (sending.current) return;
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

  const addCard = useCallback((kind?: ObservationType) => {
    const current = latest.current;
    if (!current || current.state !== 'draft' || sending.current) return;
    const o = newObservation();
    if (kind) {
      o.type = kind;
      if (kind === 'defect' && principal?.trade) o.affectedTrade = principal.trade;
    } else {
      setPicking(p => [...p, o.id]);
    }
    update({ ...current, observations: [...current.observations, o] });
    setSelectedSection(o.id);
  }, [principal?.trade]); // eslint-disable-line react-hooks/exhaustive-deps

  // The home screen's "Request a variation" lands here with the card already started.
  useEffect(() => {
    if (!report || report.state !== 'draft' || addedFromLink.current) return;
    let add = '';
    try { add = new URLSearchParams(window.location.search).get('add') ?? ''; } catch {}
    if (!KINDS.includes(add as ObservationType)) return;
    addedFromLink.current = true;
    addCard(add as ObservationType);
    try { window.history.replaceState(null, '', window.location.pathname); } catch {}
  }, [report?.id, report?.state, addCard]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    if (!report || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Wait for any save already running, so what is submitted is the version
      // the engineer just reviewed rather than whatever lands last.
      await chain.current;
      const saved = await saveReport(report, serverVersion.current ?? report.version,principalId ?? undefined);
      serverVersion.current = saved.version;
      setReport(saved);
      const sent = await submitReport(saved, {
        ...(signatureImage ? { dataUrl: signatureImage } : {}),
        name: signerName.trim() || report.author,
      });
      if (principalId) await releaseIfCurrent(report.id, principalId, seq.current);
      setReport(sent);
      pending.current = null;
      setSaveState("clean");
    } catch (error) {
      if (error instanceof ApiError && error.offline) {
        // Sending failed, so make certain the device is holding the work before
        // telling anyone it is safe.
        const held = principalId
          ? await keep({
              reportId: report.id,
              principalId,
              seq: seq.current,
              observations: report.observations,
              baseVersion:serverVersion.current ?? report.version,
              report,
            }).then(
              () => true,
              () => false,
            )
          : false;
        setSaveState(held ? "phone" : "unheld");
        setSubmitError(
          held
            ? "No connection, so this has not reached the office yet. Your work is held on this phone — try again when you have signal."
            : "No connection, and this device would not store a copy. Do not close this page: your work only exists on this screen. Move somewhere with signal and send again.",
        );
      } else {
        setSubmitError(error instanceof Error ? error.message : "That could not be sent.");
      }
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <main className="wrap">
        <Link href="/projects" className="back">&larr; Projects</Link>
        <div className="empty">This report could not be loaded. Check your connection or sign in again.</div>
        <a href="/offline.html">Recover drafts retained on this phone</a>
      </main>
    );
  }
  if (!report) {
    return (
      <main className="wrap">
        <div className="empty" style={{ marginTop: 32 }}>Loading</div>
      </main>
    );
  }

  const project = report.projectSnapshot ?? getProject(report.projectId);
  const findings = reviewReport(report);
  const stop = findings.filter((f) => f.blocking);
  const note = findings.filter((f) => !f.blocking);
  const sent = report.state === "submitted";
  const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);
  const mine = principal ? ownsReport(principal, report) : false;
  const facts = [reviewStatus(report), deliveryStatus(report), acknowledgementStatus(report)].filter((f): f is NonNullable<typeof f> => f !== null);
  const counts = Object.fromEntries(KINDS.map(k => [k, report.observations.filter(o => o.type === k).length])) as Record<ObservationType, number>;
  const selected = report.observations.some(o => o.id === selectedSection) ? selectedSection : report.observations.at(-1)?.id ?? null;
  const shortRef = report.reference.split('-').slice(1).join('-');
  const kindOf = (o: Observation) => OBSERVATION_TYPES.find(t => t.value === o.type);
  const extras = (o: Observation) => [o.affectedTrade && `Trade: ${o.affectedTrade}`, o.variationReason, o.workDone && 'already carried out', o.askedBy && `asked for by ${o.askedBy}`, o.roughSize && ({ 'half-day': 'about half a day', day: 'about a day', 'two-days': 'about two days', more: 'more than two days' })[o.roughSize], o.partsEstimate !== undefined && `parts about £${o.partsEstimate}`].filter(Boolean).join(' · ');

  async function startCorrection() {
    if (!correctionReason.trim()) { setCorrectionError('Say why this correction is needed.'); return; }
    setCorrectionError('');
    try {
      const draft = await requestCorrection(report!.id, correctionReason.trim());
      router.push(`/reports/${draft.id}`);
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : 'The correction could not be started.');
    }
  }

  const findingRows = (items: typeof findings, kind: 'stop' | 'note') => items.map((f, i) => <button key={`${kind}${i}`} type="button" className={`find ${kind === 'stop' ? 'find-stop' : 'find-note'}`} style={{ width: '100%', textAlign: 'left', minHeight: 0, background: 'none', font: 'inherit', cursor: f.observationId ? 'pointer' : 'default' }} onClick={() => { if (f.observationId) { setSelectedSection(f.observationId); document.getElementById('card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }}>
    <span className="find-kind">{kind === 'stop' ? 'Stop' : 'Check'}</span>
    <span>{f.message}</span>
  </button>);

  return (
    <main className={sent ? "wrap eng-page" : "wrap wrap-pad eng-report-editor"}>
      <Link href={`/engineer?project=${encodeURIComponent(report.projectId)}`} className="back">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1>{sent ? report.reference : 'Site update'}</h1>
          <p className="sub">{project?.projectName} · <span className="ref">{report.reference}</span>{sent ? '' : ' · draft'}{report.corrects && !sent ? ` · correction, rev ${report.revision}` : ''}</p>
        </div>
        <span className={sent ? "tag tag-sent" : "tag tag-draft"}>{sent ? "Sent" : "Draft"}</span>
      </div>

      {/* A correction draft says what it corrects and why, so the sent report is
          never mistaken for something that can be edited. */}
      {!sent && report.corrects && (
        <div className="note" style={{ marginTop: 16, borderLeftColor: "var(--brass)" }}>
          <strong>Correction · rev {report.revision}.</strong> {report.correctionReason}
          <br />
          Sending issues rev {report.revision} and supersedes rev {report.revision - 1}, which stays on file.
        </div>
      )}

      {sent && (
        <div className={`note ${report.review === "returned" ? "note-bad" : "note-ok"}`} style={{ marginTop: 16 }}>
          {report.review === "returned" && (
            <p style={{ margin: "0 0 8px" }}>
              <strong>Sent back by {report.reviewedBy ?? "the office"}.</strong> {report.reviewNote}
            </p>
          )}
          <p style={{ margin: 0 }}>
            Received by Relay {fmtWhen(report.serverAcknowledgedAt)}. It can no longer be edited — a correction is issued as a new revision.{" "}
            <Link href={`/reports/${report.id}/preview`} style={{ color: "var(--brass)" }}>
              View the document &rarr;
            </Link>
          </p>
          {/* Review, delivery and whether anyone read it: the same three
              facts the office sees, in the same words. */}
          <p style={{ margin: "10px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {facts.map((f) => <span key={f.label} className={toneClass(f.tone)}>{f.label}</span>)}
          </p>
          {mine && !correcting && (
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn-sm" onClick={() => setCorrecting(true)}>
                {report.review === "returned" ? "Make the correction" : "Make a correction"}
              </button>
            </div>
          )}
          {mine && correcting && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="correction-reason">Why is a correction needed?</label>
              <textarea
                id="correction-reason"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Printed on the corrected revision"
              />
              {correctionError && <p className="hint" style={{ color: "var(--alert)" }}>{correctionError}</p>}
              <div className="btn-row">
                <button className="btn-primary btn-sm" onClick={startCorrection}>Start correction</button>
                <button className="btn-sm" onClick={() => setCorrecting(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {sent ? <>
        <div className="sec"><span className="lbl">{report.observations.length} card{report.observations.length === 1 ? '' : 's'} · {photos} photograph{photos === 1 ? '' : 's'}</span></div>
        {report.observations.length === 0 ? <div className="empty">No updates were recorded on this visit.</div> : report.observations.map((o, i) => { const k = kindOf(o); return <section key={o.id} className={`eng-sent-card tone-${k?.tone ?? 'neutral'}`}>
          <div className="head"><span className="lbl">Card {String(i + 1).padStart(2, '0')} · {o.location || 'No location'}</span><span className={`kind tone-${k?.tone ?? 'neutral'}`}>{k?.short ?? o.type}</span></div>
          <p>{o.whatHappened}</p>
          {(o.actionNeeded.trim() || o.owner.trim()) && <small>{o.actionNeeded.trim() && `Action: ${o.actionNeeded}`}{o.actionNeeded.trim() && o.owner.trim() && ' · '}{o.owner.trim() && `For: ${o.owner}`}</small>}
          {extras(o) && <small>{extras(o)}</small>}
          {o.photos.length > 0 && <small>{o.photos.length} photograph{o.photos.length === 1 ? '' : 's'}</small>}
        </section>; })}
      </> : <>
        <div className="eng-editor-grid">
          <aside className="eng-rail" aria-label="Cards in this update">
            <div className="eng-section-title" style={{ margin: 0 }}><h2>Cards</h2><span className="r">{report.observations.length}</span></div>
            <div className="eng-list">
              {report.observations.length === 0 && <div className="eng-empty">No cards yet. Add one for each thing you did, found or need.</div>}
              {report.observations.map((o, i) => { const k = kindOf(o); const stopped = stop.some(f => f.observationId === o.id); return <button type="button" key={o.id} className={`eng-row ${selected === o.id ? 'on' : ''} ${stopped ? 'late' : ''}`} onClick={() => { setSelectedSection(o.id); document.getElementById('card-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <span className="no">{String(i + 1).padStart(2, '0')}</span>
                <div className="main"><b>{o.location || (picking.includes(o.id) ? 'New card' : `Card ${i + 1}`)}</b><span>{picking.includes(o.id) ? 'choose a kind' : `${k?.short ?? o.type} · ${o.whatHappened.trim() ? o.whatHappened.trim().slice(0, 48) + (o.whatHappened.trim().length > 48 ? '…' : '') : 'nothing written yet'} · ${o.photos.length} photo${o.photos.length === 1 ? '' : 's'}`}{stopped ? ' · needs something' : ''}</span></div>
              </button>; })}
            </div>
            <button type="button" className="eng-add" disabled={submitting} onClick={() => addCard()}>+ Add a card</button>
            {findings.length > 0 && <div className="eng-finds"><span className="lbl">Before you send</span>{findingRows(stop, 'stop')}{findingRows(note.slice(0, 3), 'note')}</div>}
          </aside>
          <div id="card-editor" style={{ scrollMarginTop: 24 }}>
            {report.observations.length === 0 ? <KindPicker onPick={k => addCard(k)} /> : report.observations.map((observation, index) => (
              <div key={observation.id} hidden={selected !== observation.id}>
                {picking.includes(observation.id)
                  ? <KindPicker onPick={k => { setPicking(p => p.filter(x => x !== observation.id)); const copy: Observation = { ...observation, type: k }; if (k === 'defect' && principal?.trade) copy.affectedTrade = principal.trade; update({ ...report, observations: report.observations.map(o => o.id === observation.id ? copy : o) }); }} />
                  : <ObservationEditor
                      observation={observation}
                      index={index}
                      openIssues={projectIssues}
                      locations={locations}
                      onChange={(next) => update({ ...report, observations: report.observations.map((o) => (o.id === next.id ? next : o)) })}
                      onRemove={() => { setPicking(p => p.filter(x => x !== observation.id)); update({ ...report, observations: report.observations.filter((o) => o.id !== observation.id) }); }}
                    />}
                {!picking.includes(observation.id) && <div className="btn-row" style={{ marginTop: 12 }}><button type="button" onClick={() => addCard()} disabled={submitting}>Done · add another card</button><a href="#report-check" className="btn-quiet" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 20px', border: '1px solid var(--line-2)', borderRadius: 'var(--r)' }}>Check &amp; send ↓</a></div>}
              </div>
            ))}
          </div>
        </div>

        <div id="report-check" className="sec"><span className="lbl">Check &amp; send</span></div>
        <dl className="eng-sum">
          <div><dt>Progress</dt><dd>{counts.update}</dd></div>
          <div><dt>Defects</dt><dd className={counts.defect ? 'late' : ''}>{counts.defect}<small>{counts.defect ? 'raise issues' : ''}</small></dd></div>
          <div><dt>Variations</dt><dd className={counts.instruction ? 'soon' : ''}>{counts.instruction}<small>{counts.instruction ? 'raise VOs' : ''}</small></dd></div>
          <div><dt>Access</dt><dd>{counts.access}<small>{counts.access ? 'raise issues' : ''}</small></dd></div>
        </dl>

        {findings.length === 0 ? (
          <div className="note note-ok">Everything needed is here.</div>
        ) : (
          <div className="eng-finds">
            {/* Blocking omissions and things worth a look are separated: an
                engineer should be stopped by a defect with no photograph, and
                not stopped by a missing caption. */}
            {findingRows(stop, 'stop')}
            {findingRows(note, 'note')}
          </div>
        )}

        {report.observations.length > 0 && <div className="eng-does">
          <span className="lbl">What sending does</span>
          <div className="eng-list" style={{ marginTop: 8 }}>
            {counts.defect + counts.access > 0 && <div className="eng-row"><div className="main"><b>{counts.defect + counts.access} issue{counts.defect + counts.access === 1 ? '' : 's'} raised · not yet reviewed</b><span>{report.observations.filter(o => (o.type === 'defect' || o.type === 'access') && o.linkedIssueId).length ? 'Linked ones add a sighting to the existing issue. ' : ''}The office assigns them; you’ll see who and when on your home screen.</span></div></div>}
            {counts.instruction > 0 && <div className="eng-row"><div className="main"><b>{counts.instruction} variation{counts.instruction === 1 ? '' : 's'} raised · need a quote</b><span>{report.observations.some(o => o.type === 'instruction' && o.workDone) ? 'Marked as already done: the office gets the client’s sign-off before it is invoiced. ' : ''}The office prices it and puts it to the client.</span></div></div>}
            <div className="eng-row"><div className="main"><b>Received the moment it lands</b><span>{project?.projectManager ?? 'The project manager'} is emailed when the mailbox is live; the office can read it straight away.</span></div></div>
          </div>
        </div>}

        <div className="sec"><span className="lbl">Sign</span></div>

        <section className="panel">
          <div className="panel-body">
            <SignaturePad
              name={signerName}
              onNameChange={setSignerName}
              onChange={setSignatureImage}
            />
          </div>
        </section>

        {submitError && (
          <div className="note note-bad" style={{ marginTop: 16 }}>{submitError}</div>
        )}

        {/* One primary action, always reachable, with the save state beside
            it so the two are never read separately. */}
        <div className="actionbar">
          <div className="actionbar-inner">
            <span className="savestate">
              <span className={SAVE[saveState].dot} />
              <b>{SAVE[saveState].text}</b>
              {stop.length > 0 && (
                <span style={{ color: "var(--alert)" }}>
                  · {stop.length} outstanding
                </span>
              )}
            </span>
            <button className="btn-primary" onClick={send} disabled={submitting || stop.length > 0}>
              {submitting ? "Sending…" : "Send to office"}
            </button>
          </div>
        </div>
      </>}
    </main>
  );
}
