"use client";

import { useState } from "react";
import Link from "next/link";
import { reviewReportDecision } from "@/lib/api";
import { getProject } from "@/lib/api";
import type { Report } from "@/lib/types";

/**
 * The reviewer's decision on one submitted report.
 *
 * Two things this screen is careful about.
 *
 * Returning must say why. A report handed back with no reason makes the
 * engineer guess, and guessing produces a second version with the same problem.
 *
 * Approving is not neutral. It confirms the observations the report raised,
 * which is why the consequence is stated on the button's own panel rather than
 * left to be discovered.
 */
export function ReviewPanel({ report, onDone }: { report: Report; onDone: () => void }) {
  const [reviewer, setReviewer] = useState("Office");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = getProject(report.projectId);
  const defects = report.observations.filter(
    (o) => o.type === "defect" || o.type === "access",
  ).length;

  async function decide(decision: "approve" | "return") {
    setBusy(true);
    setError(null);
    try {
      await reviewReportDecision(report.id, decision, reviewer, note);
      setNote("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="lbl">{report.reference}</span>
        <Link href={`/reports/${report.id}/preview`} className="lbl" style={{ color: "var(--brass)" }}>
          Read it →
        </Link>
      </div>

      <div className="panel-body">
        <p className="row-title" style={{ marginBottom: 4 }}>
          {project?.projectName ?? report.projectId}
        </p>
        <p className="row-meta" style={{ marginBottom: 16 }}>
          {report.author}
          <span className="sep">/</span>visit {report.visitDate}
          <span className="sep">/</span>
          {report.observations.length} observation{report.observations.length === 1 ? "" : "s"}
          {defects > 0 ? ` / ${defects} raising an issue` : ""}
        </p>

        <div className="field">
          <label htmlFor={`rev-${report.id}`}>Reviewed by</label>
          <input
            id={`rev-${report.id}`}
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
          />
          <p className="hint">
            A report cannot be reviewed by whoever wrote it — this one is by {report.author}.
          </p>
        </div>

        <div className="field">
          <label htmlFor={`note-${report.id}`}>Comments</label>
          <textarea
            id={`note-${report.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Required if you are sending this back"
          />
        </div>

        {error && <div className="note note-bad">{error}</div>}

        <div className="btn-row">
          <button className="btn-primary" onClick={() => decide("approve")} disabled={busy}>
            Approve
          </button>
          <button onClick={() => decide("return")} disabled={busy}>
            Send back
          </button>
        </div>

        <p className="hint">
          {defects > 0
            ? `Approving confirms ${defects} observation${defects === 1 ? "" : "s"} raised as issues. Sending it back marks them for triage — any work already done on them stands.`
            : "Approving accepts this report for issue."}
        </p>
      </div>
    </section>
  );
}
