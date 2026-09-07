"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  getProject,
  getReport,
  newObservation,
  reviewReport,
  saveReport,
  submitReport,
  type Observation,
  type Report,
} from "@/lib/api";
import { ApiError } from "@/lib/api";
import { hasUnsent, keep, recover, release } from "@/lib/localDraft";
import { ObservationEditor } from "@/components/ObservationEditor";

type SaveState = "clean" | "saving" | "saved" | "phone" | "error";

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
  phone: { dot: "dot dot-busy", text: "On this phone only — will send when there is signal" },
  error: { dot: "dot dot-bad", text: "Not saved — check connection" },
};

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [report, setReport] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("clean");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Report | null>(null);
  /**
   * The report as it currently stands, for retries that did not originate from
   * an edit. Recovered work is the case that matters: after a reload there is
   * nothing pending, so without this a report restored from the device would
   * sit there until somebody happened to type — which is precisely the moment
   * an engineer assumes it has gone.
   */
  const latest = useRef<Report | null>(null);

  useEffect(() => {
    getReport(id)
      .then((found) => {
        if (!found) {
          setMissing(true);
          return;
        }
        // Unsent work from a previous session wins over the server copy: it is
        // by definition newer, because it only exists because a save failed.
        const recovered = recover(found);
        if (recovered) {
          setReport(recovered);
          setSaveState("phone");
        } else {
          setReport(found);
        }
      })
      .catch(() => setMissing(true));
  }, [id]);

  /**
   * Autosave after a pause, not on every keystroke: on a poor connection that
   * produces a queue of requests that all land at once and finish out of order.
   */
  const scheduleSave = useCallback((next: Report) => {
    // Mirror to the device first. Whatever the network then does, the work
    // survives a refresh, a crash or a phone going flat.
    keep(next);
    pending.current = next;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSave = pending.current;
      if (!toSave) return;
      try {
        const saved = await saveReport(toSave);
        release(toSave.id);
        setReport((current) => (current ? { ...current, revision: saved.revision } : saved));
        setSaveState("saved");
      } catch (error) {
        // Losing signal is not a failure to report as one; the work is held.
        setSaveState(error instanceof ApiError && error.offline ? "phone" : "error");
      }
    }, 700);
  }, []);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Coming back into signal retries by itself. An engineer walking out of a
  // basement should not have to know to press anything.
  useEffect(() => {
    function onOnline() {
      const held = pending.current ?? latest.current;
      if (held && held.state === "draft" && hasUnsent(held.id)) scheduleSave(held);
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [scheduleSave]);

  useEffect(() => {
    latest.current = report;
  }, [report]);

  function update(next: Report) {
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

  async function send() {
    if (!report) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saved = await saveReport(report);
      const sent = await submitReport(saved);
      release(report.id);
      setReport(sent);
      setSaveState("clean");
    } catch (error) {
      if (error instanceof ApiError && error.offline) {
        setSaveState("phone");
        setSubmitError(
          "No connection, so this has not reached the office yet. Your work is held on this phone — try again when you have signal.",
        );
      } else {
        setSubmitError(error instanceof Error ? error.message : "That could not be sent.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <main className="wrap">
        <Link href="/" className="back">&larr; Projects</Link>
        <div className="empty">That report could not be found.</div>
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
    <main className={sent ? "wrap" : "wrap wrap-pad"}>
      <Link href={`/projects/${report.projectId}`} className="back">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1 className="ref" style={{ fontSize: 22 }}>{report.reference}</h1>
          <p className="sub">{project?.projectName}</p>
        </div>
        <span className={sent ? "tag tag-sent" : "tag tag-draft"}>{sent ? "Sent" : "Draft"}</span>
      </div>

      <dl className="titleblock" style={{ marginTop: 24 }}>
        <div className="tb-cell"><dt>Visit date</dt><dd className="ref">{report.visitDate}</dd></div>
        <div className="tb-cell"><dt>Engineer</dt><dd>{report.author}</dd></div>
        <div className="tb-cell"><dt>Observations</dt><dd className="ref">{String(report.observations.length).padStart(2, "0")}</dd></div>
        <div className="tb-cell"><dt>Photographs</dt><dd className="ref">{String(photos).padStart(2, "0")}</dd></div>
      </dl>

      {sent && (
        <div className="note note-ok" style={{ marginTop: 16 }}>
          Sent to the office{" "}
          {report.serverAcknowledgedAt
            ? new Date(report.serverAcknowledgedAt).toLocaleString("en-GB")
            : ""}
          . It can no longer be edited — a correction is issued as a new revision.{" "}
          <Link href={`/reports/${report.id}/preview`} style={{ color: "var(--brass)" }}>
            View the document &rarr;
          </Link>
        </div>
      )}

      <div className="sec"><span className="lbl">What you found</span></div>

      {report.observations.length === 0 ? (
        <div className="empty">Nothing recorded yet.</div>
      ) : (
        report.observations.map((observation, index) =>
          sent ? (
            <section key={observation.id} className="panel">
              <div className="panel-head">
                <span className="lbl">Observation {String(index + 1).padStart(2, "0")}</span>
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
            <ObservationEditor
              key={observation.id}
              observation={observation}
              index={index}
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
          ),
        )
      )}

      {!sent && (
        <>
          <button
            className="btn-wide"
            style={{ marginTop: 4 }}
            onClick={() =>
              update({ ...report, observations: [...report.observations, newObservation()] })
            }
          >
            Add an observation
          </button>

          <div className="sec"><span className="lbl">Before you send</span></div>

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
