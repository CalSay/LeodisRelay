"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getProject,
  getReport,
  newObservation,
  openIssues as fetchOpenIssues,
  reviewReport,
  saveReport,
  submitReport,
  type Observation,
  type Report,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { clientId } from '@/lib/clientId';
import { hasUnsent, keep, recover, releaseIfCurrent } from "@/lib/localDraft";
import { ObservationEditor } from "@/components/ObservationEditor";
import { SignaturePad } from "@/components/SignaturePad";
import type { Issue as IssueSummary } from "@/lib/types";
import { usePrincipal } from '@/components/PrincipalContext';

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

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const principal = usePrincipal();
  const [selectedSection,setSelectedSection] = useState<string | null>(null);

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
  // engineer can attach a repeat sighting instead of raising a duplicate.
  useEffect(() => {
    if (!report) return;
    fetchOpenIssues(report.projectId)
      .then(setProjectIssues)
      .catch(() => setProjectIssues([]));
  }, [report?.projectId]);

  function update(next: Report) {
    if (sending.current) return;
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

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
        <Link href="/" className="back">&larr; Projects</Link>
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

  const project = getProject(report.projectId);
  const findings = reviewReport(report);
  const stop = findings.filter((f) => f.blocking);
  const note = findings.filter((f) => !f.blocking);
  const sent = report.state === "submitted";
  const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);

  return (
    <main className={sent ? "wrap" : "wrap wrap-pad eng-report-editor"}>
      <Link href={`/engineer?project=${encodeURIComponent(report.projectId)}`} className="back">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1>{sent ? report.reference : 'Site update'}</h1>
          <p className="sub">{project?.projectName} · {report.reference}</p>
        </div>
        <span className={sent ? "tag tag-sent" : "tag tag-draft"}>{sent ? "Submitted" : "Draft"}</span>
      </div>

      <dl className="titleblock" style={{ marginTop: 24 }}>
        <div className="tb-cell"><dt>Visit date</dt><dd className="ref">{report.visitDate}</dd></div>
        <div className="tb-cell"><dt>Engineer</dt><dd>{report.author}</dd></div>
        <div className="tb-cell"><dt>Updates</dt><dd className="ref">{String(report.observations.length).padStart(2, "0")}</dd></div>
        <div className="tb-cell"><dt>Photographs</dt><dd className="ref">{String(photos).padStart(2, "0")}</dd></div>
      </dl>

      {report.review === "returned" && !sent && (
        <div className="note note-bad" style={{ marginTop: 16 }}>
          <strong>Sent back by {report.reviewedBy ?? "the office"}.</strong> {report.reviewNote}
          <br />
          Make the changes and send it again.
        </div>
      )}

      {sent && (
        <div className="note note-ok" style={{ marginTop: 16 }}>
          Received by Relay{" "}
          {report.serverAcknowledgedAt
            ? new Date(report.serverAcknowledgedAt).toLocaleString("en-GB")
            : ""}
          . It can no longer be edited — a correction is issued as a new revision.{" "}
          <Link href={`/reports/${report.id}/preview`} style={{ color: "var(--brass)" }}>
            View the document &rarr;
          </Link>
        </div>
      )}

      {!sent && <div className="eng-editor-intro"><p>Build your visit report section by section. Each section uses the existing observation fields.</p><a href="#report-check">Check report ↓</a></div>}
      <div className={sent ? '' : 'eng-editor-grid'}>
      {!sent && <aside className="eng-sections" aria-label="Report sections"><h2>Report sections · {report.observations.length}</h2>
        {report.observations.map((o,i)=><button type="button" key={o.id} aria-pressed={(report.observations.some(x=>x.id===selectedSection)?selectedSection:report.observations[0]?.id)===o.id} onClick={()=>setSelectedSection(o.id)}><span>{String(i+1).padStart(2,'0')}</span><span><strong>{o.location || `Section ${i+1}`}</strong><small>{o.type} · {o.photos.length} photo{o.photos.length===1?'':'s'}</small></span></button>)}
        <button type="button" className="eng-add-section" disabled={submitting} onClick={()=>{const o=newObservation();update({...report,observations:[...report.observations,o]});setSelectedSection(o.id);}}>+ Add section</button>
      </aside>}
      <div>
      <div className="sec"><span className="lbl">{sent?'Updates':'Selected section'}</span></div>

      {report.observations.length === 0 ? (
        <div className="empty">No updates recorded yet.</div>
      ) : (
        report.observations.map((observation, index) =>
          sent ? (
            <section key={observation.id} className="panel">
              <div className="panel-head">
                <span className="lbl">Update {String(index + 1).padStart(2, "0")}</span>
                <span className="lbl">{observation.location || "No location"}</span>
              </div>
              <div className="panel-body">
                <p style={{ margin: 0 }}>{observation.whatHappened}</p>
                {observation.photos.length > 0 && (
                  <p className="hint">{observation.photos.length} photograph{observation.photos.length === 1 ? "" : "s"}</p>
                )}
              </div>
            </section>
          ) : (
            <div key={observation.id} hidden={(report.observations.some(o=>o.id===selectedSection)?selectedSection:report.observations[0]?.id)!==observation.id}>
            <ObservationEditor
              observation={observation}
              index={index}
              openIssues={projectIssues}
              onChange={(next) =>
                update({
                  ...report,
                  observations: report.observations.map((o) => (o.id === next.id ? next : o)),
                })
              }
              onRemove={() =>
                update({
                  ...report,
                  observations: report.observations.filter((o) => o.id !== observation.id),
                })
              }
            />
            </div>
          ),
        )
      )}
      </div></div>

      {!sent && (
        <>
          <div id="report-check" className="sec"><span className="lbl">Before you send · All sections</span></div>

          {findings.length === 0 ? (
            <div className="note note-ok">Everything needed is here.</div>
          ) : (
            <div>
              {/* Blocking omissions and things worth a look are separated: an
                  engineer should be stopped by a defect with no photograph, and
                  not stopped by a missing caption. */}
              {stop.map((f, i) => (
                <div key={`s${i}`} className="find find-stop">
                  <span className="find-kind">Needed</span>
                  <span>{f.message}</span>
                </div>
              ))}
              {note.map((f, i) => (
                <div key={`n${i}`} className="find find-note">
                  <span className="find-kind">Check</span>
                  <span>{f.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="sec"><span className="lbl">Sign off</span></div>

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
        </>
      )}
    </main>
  );
}
