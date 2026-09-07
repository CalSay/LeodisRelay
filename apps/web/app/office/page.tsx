"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject, officeView, type OfficeDraftSummary } from "@/lib/api";
import type { Report } from "@/lib/types";

/**
 * The office view, per decision Q2.
 *
 * Submitted reports in full. Drafts as existence only — who, which project,
 * when last saved — with no content and no way to open one. The server enforces
 * that split; this screen only presents it.
 *
 * Two things are stated on the page rather than left implicit. Drafts listed
 * here are server-backed only, so anything still on a disconnected phone is
 * invisible and an empty list does not mean nobody is working. And there is no
 * "open for N days" figure, deliberately.
 */
export default function OfficePage() {
  const [data, setData] = useState<{ submitted: Report[]; drafts: OfficeDraftSummary[] } | null>(
    null,
  );

  useEffect(() => {
    officeView().then(setData);
    const poll = setInterval(() => officeView().then(setData), 5000);
    return () => clearInterval(poll);
  }, []);

  return (
    <main className="shell">
      <Link href="/" className="backlink">
        &larr; Capture
      </Link>

      <div className="topbar">
        <div>
          <h1>Office</h1>
          <div className="sub">Reports received from site</div>
        </div>
      </div>

      <p className="section-label">Received</p>

      {data === null ? (
        <div className="empty">Loading...</div>
      ) : data.submitted.length === 0 ? (
        <div className="empty">Nothing has been sent in yet.</div>
      ) : (
        <div className="stack">
          {data.submitted.map((report) => {
            const project = getProject(report.projectId);
            const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);
            return (
              <Link key={report.id} href={`/reports/${report.id}/preview`} className="card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <p className="card-title">
                      <span className="code">{report.reference}</span>
                    </p>
                    <p className="card-meta">{project?.projectName ?? report.projectId}</p>
                    <p className="card-meta" style={{ marginTop: 6 }}>
                      {report.author} · visit {report.visitDate} · {report.observations.length}{" "}
                      observation{report.observations.length === 1 ? "" : "s"} · {photos} photo
                      {photos === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="badge badge-sent">Received</span>
                </div>
                <p className="card-meta" style={{ marginTop: 10 }}>
                  {report.serverAcknowledgedAt
                    ? new Date(report.serverAcknowledgedAt).toLocaleString("en-GB")
                    : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      <p className="section-label">In progress on site</p>

      {data === null ? null : data.drafts.length === 0 ? (
        <div className="empty">No drafts saved to the server.</div>
      ) : (
        <div className="stack">
          {data.drafts.map((draft) => {
            const project = getProject(draft.projectId);
            return (
              <div key={draft.id} className="card" style={{ cursor: "default" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <p className="card-title">
                      <span className="code">{draft.reference}</span>
                    </p>
                    <p className="card-meta">{project?.projectName ?? draft.projectId}</p>
                    <p className="card-meta" style={{ marginTop: 6 }}>
                      {draft.author} · visit {draft.visitDate}
                      {draft.lastSavedAt
                        ? ` · last saved ${new Date(draft.lastSavedAt).toLocaleTimeString("en-GB")}`
                        : ""}
                    </p>
                  </div>
                  <span className="badge badge-draft">Draft</span>
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  Content is not shown until the report is sent.
                </p>
              </div>
            );
          })}
        </div>
      )}

      <p className="hint" style={{ marginTop: 20 }}>
        Drafts listed here are the ones saved to the server. Work still on an engineer&apos;s
        phone is not visible, so an empty list does not mean nobody is working.
      </p>
    </main>
  );
}
