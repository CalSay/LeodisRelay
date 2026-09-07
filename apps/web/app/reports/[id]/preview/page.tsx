"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getProject, getReport } from "@/lib/api";
import { OBSERVATION_TYPES } from "@/lib/fixtures";
import type { Report } from "@/lib/types";

/**
 * What the issued document would say.
 *
 * Not a PDF — the real one is rendered server-side from a frozen snapshot. This
 * is the layout question put in front of a person early, because Appendix C
 * makes the report content an acceptance reference and the only way to judge it
 * is to look at it.
 *
 * The structure follows proposal section 6: identity, then an action and
 * decision summary, then numbered observations with their evidence. The summary
 * comes first because that is what the recipient needs to act on; the narrative
 * is the supporting detail.
 *
 * Unknown owners and dates are labelled, never invented.
 */
export default function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getReport(id).then((found) => (found ? setReport(found) : setMissing(true)));
  }, [id]);

  if (missing) {
    return (
      <main className="wrap">
        <div className="empty">That report could not be found.</div>
      </main>
    );
  }
  if (!report) {
    return (
      <main className="wrap">
        <div className="empty">Loading...</div>
      </main>
    );
  }

  const project = getProject(report.projectId);
  const actions = report.observations.filter(
    (o) => o.actionNeeded.trim().length > 0 || o.type === "defect",
  );
  let photoNumber = 0;

  return (
    <main className="wrap">
      <Link href="/office" className="back">
        &larr; Office
      </Link>

      <div className="doc">
        <header className="doc-head">
          <div className="doc-brand">LEODIS</div>
          <h1 className="doc-title">Site Progress Report</h1>
          <dl className="doc-tb">
            <div>
              <dt>Report</dt>
              <dd>{report.reference}</dd>
            </div>
            <div>
              <dt>Project</dt>
              <dd>{project?.projectName ?? report.projectId}</dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>{project?.clientName ?? "Not recorded"}</dd>
            </div>
            <div>
              <dt>Visit date</dt>
              <dd>{report.visitDate}</dd>
            </div>
            <div>
              <dt>Prepared by</dt>
              <dd>{report.author}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>
                {report.revision}
                {report.state === "submitted" ? "" : " (draft, not issued)"}
              </dd>
            </div>
          </dl>
        </header>

        <section>
          <h2 className="doc-h2">Action and decision summary</h2>
          {actions.length === 0 ? (
            <p className="doc-body">No actions or decisions arise from this visit.</p>
          ) : (
            <div className="doc-tw">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Action or decision required</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((observation, index) => (
                    <tr key={observation.id}>
                      <td>
                        {index + 1}. {observation.location || "Location not recorded"}
                      </td>
                      <td>{observation.actionNeeded.trim() || "To be determined"}</td>
                      {/*
                        An unassigned action says so. Inventing an owner to fill
                        the column is exactly what Appendix C corrects.
                      */}
                      <td className={observation.owner.trim() ? "" : "doc-unknown"}>
                        {observation.owner.trim() || "Awaiting confirmation"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="doc-h2">Observations</h2>
          {report.observations.map((observation, index) => {
            const type = OBSERVATION_TYPES.find((t) => t.value === observation.type);
            return (
              <article key={observation.id} className="doc-obs">
                <h3 className="doc-h3">
                  {index + 1}. {observation.location || "Location not recorded"}
                  <span className="doc-type">{type?.label ?? observation.type}</span>
                </h3>
                <p className="doc-body">{observation.whatHappened || "No description recorded."}</p>
                {observation.actionNeeded.trim() && (
                  <p className="doc-body">
                    <strong>Action required:</strong> {observation.actionNeeded}
                  </p>
                )}
                {observation.photos.length > 0 && (
                  <div className="doc-figs">
                    {observation.photos.map((photo) => {
                      photoNumber += 1;
                      return (
                        <figure key={photo.id} className="doc-fig">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.dataUrl} alt={photo.caption || `Photograph ${photoNumber}`} />
                          <figcaption>
                            Photograph {photoNumber}
                            {photo.caption.trim() ? ` — ${photo.caption}` : " — no caption recorded"}
                            <br />
                            <span className="doc-fig-date">
                              Taken {new Date(photo.capturedAt).toLocaleDateString("en-GB")}
                            </span>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="doc-foot">
          {report.reference} · Revision {report.revision} ·{" "}
          {report.state === "submitted"
            ? `Issued ${report.serverAcknowledgedAt ? new Date(report.serverAcknowledgedAt).toLocaleDateString("en-GB") : ""}`
            : "Draft — not issued"}
          <br />
          Generated by Leodis Relay
        </footer>
      </div>

      <p className="footnote">
        Layout preview only. The issued document is rendered on the server from the submitted
        revision, then signed and filed.
      </p>
    </main>
  );
}
