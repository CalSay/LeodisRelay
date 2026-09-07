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
 * "open for N days" figure, deliberately: that turns work visibility into a
 * productivity measure, which is a different thing needing a different
 * conversation.
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
    <main className="wrap">
      <div className="pagehead">
        <div>
          <h1>Office</h1>
          <p className="sub">Reports received from site</p>
        </div>
        {data && (
          <span className="lbl">
            {data.submitted.length} received &nbsp;·&nbsp; {data.drafts.length} in progress
          </span>
        )}
      </div>

      <div className="sec">
        <span className="lbl">Received</span>
      </div>

      {data === null ? (
        <div className="empty">Loading</div>
      ) : data.submitted.length === 0 ? (
        <div className="empty">Nothing has been sent in yet.</div>
      ) : (
        <div className="reg">
          {data.submitted.map((report) => {
            const project = getProject(report.projectId);
            const photos = report.observations.reduce((n, o) => n + o.photos.length, 0);
            return (
              <Link key={report.id} href={`/reports/${report.id}/preview`} className="row">
                <span className="row-code">{report.reference}</span>
                <span className="row-main">
                  <p className="row-title">{project?.projectName ?? report.projectId}</p>
                  <p className="row-meta">
                    {report.author}
                    <span className="sep">/</span>visit {report.visitDate}
                    <span className="sep">/</span>
                    {report.observations.length} obs
                    <span className="sep">/</span>
                    {photos} photo{photos === 1 ? "" : "s"}
                  </p>
                </span>
                <span className="row-end">
                  <span className="tag tag-sent">Received</span>
                  <span className="row-time">
                    {report.serverAcknowledgedAt
                      ? new Date(report.serverAcknowledgedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="sec">
        <span className="lbl">In progress on site</span>
      </div>

      {data === null ? null : data.drafts.length === 0 ? (
        <div className="empty">No drafts saved to the server.</div>
      ) : (
        <div className="reg">
          {data.drafts.map((draft) => {
            const project = getProject(draft.projectId);
            return (
              <div key={draft.id} className="row row-static">
                <span className="row-code">{draft.reference}</span>
                <span className="row-main">
                  <p className="row-title">{project?.projectName ?? draft.projectId}</p>
                  <p className="row-meta">
                    {draft.author}
                    <span className="sep">/</span>visit {draft.visitDate}
                    <span className="sep">/</span>
                    {draft.observationCount} obs
                  </p>
                </span>
                <span className="row-end">
                  <span className="tag tag-draft">Draft</span>
                  <span className="row-time">
                    {draft.lastSavedAt
                      ? `saved ${new Date(draft.lastSavedAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="footnote">
        Draft content is not shown until a report is sent. Drafts listed are those saved to the
        server — work still on an engineer&apos;s phone is not visible here, so an empty list does
        not mean nobody is working.
      </p>
    </main>
  );
}
