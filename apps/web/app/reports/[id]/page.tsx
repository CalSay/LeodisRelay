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
} from "@/lib/testBackend";
import { ObservationEditor } from "@/components/ObservationEditor";

/**
 * Save state, in the engineer's words.
 *
 * The prototype has no offline storage, so it may only ever claim the work is
 * on the server. "Saved" without a destination is exactly the ambiguity the
 * real design forbids, so every label here names where the work actually is.
 */
type SaveState = "clean" | "saving" | "saved" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  clean: "",
  saving: "Saving to server...",
  saved: "Saved on server",
  error: "Not saved - check connection",
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

  useEffect(() => {
    getReport(id).then((found) => {
      if (found) setReport(found);
      else setMissing(true);
    });
  }, [id]);

  /**
   * Autosave after a pause in typing. Deliberately not on every keystroke:
   * on a poor site connection that produces a queue of requests that all
   * arrive at once and finish out of order.
   */
  const scheduleSave = useCallback((next: Report) => {
    pending.current = next;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const toSave = pending.current;
      if (!toSave) return;
      try {
        const saved = await saveReport(toSave);
        setReport((current) => (current ? { ...current, revision: saved.revision } : saved));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 700);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function update(next: Report) {
    setReport(next);
    if (next.state === "draft") scheduleSave(next);
  }

  function addObservation() {
    if (!report) return;
    update({ ...report, observations: [...report.observations, newObservation()] });
  }

  function changeObservation(next: Observation) {
    if (!report) return;
    update({
      ...report,
      observations: report.observations.map((o) => (o.id === next.id ? next : o)),
    });
  }

  function removeObservation(observationId: string) {
    if (!report) return;
    update({
      ...report,
      observations: report.observations.filter((o) => o.id !== observationId),
    });
  }

  async function send() {
    if (!report) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const saved = await saveReport(report);
      const sent = await submitReport(saved);
      setReport(sent);
      setSaveState("clean");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "That could not be sent.");
    } finally {
      setSubmitting(false);
    }
  }

  if (missing) {
    return (
      <main className="shell">
        <Link href="/" className="backlink">
          &larr; All projects
        </Link>
        <div className="empty">That report could not be found.</div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="shell">
        <div className="empty">Loading report...</div>
      </main>
    );
  }

  const project = getProject(report.projectId);
  const findings = reviewReport(report);
  const blocking = findings.filter((f) => f.blocking);
  const advisory = findings.filter((f) => !f.blocking);
  const sent = report.state === "submitted";

  return (
    <main className="shell">
      <Link href={`/projects/${report.projectId}`} className="backlink">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="topbar">
        <div>
          <h1>
            <span className="code" style={{ fontSize: 18 }}>
              {report.reference}
            </span>
          </h1>
          <div className="sub">
            Visit {report.visitDate} · {report.author}
          </div>
        </div>
        <span className={sent ? "badge badge-sent" : "badge badge-draft"}>
          {sent ? "Sent to office" : "Draft"}
        </span>
      </div>

      {sent ? (
        <div className="notice" style={{ marginTop: 20 }}>
          This report was sent to the office at{" "}
          {report.serverAcknowledgedAt
            ? new Date(report.serverAcknowledgedAt).toLocaleString("en-GB")
            : "an unknown time"}
          . It can no longer be edited. A correction would be issued as a new revision.
        </div>
      ) : (
        <div
          className="hint"
          style={{ minHeight: 20, marginTop: 12 }}
          role="status"
          aria-live="polite"
        >
          {SAVE_LABEL[saveState]}
        </div>
      )}

      <p className="section-label">What you found</p>

      {report.observations.length === 0 ? (
        <div className="empty">Nothing recorded yet. Add your first observation below.</div>
      ) : (
        <div className="stack">
          {report.observations.map((observation, index) =>
            sent ? (
              <div key={observation.id} className="card" style={{ cursor: "default" }}>
                <span className="photo-num">Observation {index + 1}</span>
                <p className="card-title" style={{ marginTop: 8 }}>
                  {observation.location || "Unspecified location"}
                </p>
                <p className="card-meta">{observation.whatHappened}</p>
                {observation.photos.length > 0 && (
                  <p className="card-meta" style={{ marginTop: 8 }}>
                    {observation.photos.length} photograph
                    {observation.photos.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ) : (
              <ObservationEditor
                key={observation.id}
                observation={observation}
                index={index}
                onChange={changeObservation}
                onRemove={() => removeObservation(observation.id)}
              />
            ),
          )}
        </div>
      )}

      {!sent && (
        <>
          <div className="btn-row">
            <button className="btn-block" onClick={addObservation}>
              Add an observation
            </button>
          </div>

          <p className="section-label">Before you send</p>

          {findings.length === 0 ? (
            <div className="notice">Everything needed is here. Ready to send.</div>
          ) : (
            <div className="stack">
              {/*
                Blocking omissions and things merely worth noticing are
                separated. An engineer should be stopped by a defect with no
                photograph, and not stopped by a missing caption.
              */}
              {blocking.map((finding, i) => (
                <div key={`b${i}`} className="finding finding-blocking">
                  <span className="finding-tag">Needed</span>
                  <span>{finding.message}</span>
                </div>
              ))}
              {advisory.map((finding, i) => (
                <div key={`a${i}`} className="finding finding-advisory">
                  <span className="finding-tag">Check</span>
                  <span>{finding.message}</span>
                </div>
              ))}
            </div>
          )}

          {submitError && (
            <div className="notice notice-error" style={{ marginTop: 16 }}>
              {submitError}
            </div>
          )}

          <div className="btn-row">
            <button
              className="btn-primary btn-block"
              onClick={send}
              disabled={submitting || blocking.length > 0}
            >
              {submitting ? "Sending..." : "Send to office"}
            </button>
          </div>

          {blocking.length > 0 && (
            <p className="hint">
              {blocking.length} item{blocking.length === 1 ? "" : "s"} above must be completed
              first.
            </p>
          )}
        </>
      )}
    </main>
  );
}
