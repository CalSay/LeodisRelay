"use client";
import { useProjectLookup } from "@/components/ProjectContext";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getReport } from "@/lib/api";
import { OBSERVATION_TYPES } from "@/lib/fixtures";
import { answerLabel, reportTypeOf } from "@/lib/reportTypes";
import type { Report } from "@/lib/types";
import { safeViewReturn, withViewReturn } from '@/lib/viewNavigation';

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
/** A card is titled by where it is; a check by its question, and where, if the action says (a handover inspection's do). */
const itemTitle = (o: { location: string; check?: { question: string } | undefined }): string =>
  o.check ? `${o.check.question}${o.location.trim() ? ` · ${o.location.trim()}` : ""}` : o.location || "Location not recorded";

export default function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const getProject = useProjectLookup();
  const { id } = use(params);
  const returnTo = safeViewReturn(use(searchParams).returnTo, '/projects');
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

  const project = report.projectSnapshot ?? getProject(report.projectId);
  const type = reportTypeOf(report);
  const inspection = Boolean(type.checklist);
  const actions = report.observations.filter(
    (o) => o.check ? o.check.answer === "action" : o.actionNeeded.trim().length > 0 || o.type === "defect",
  );
  // An inspection shows every answer in the results table, then only the checks with something to show.
  const detailed = report.observations.map((observation, index) => ({ observation, number: index + 1 }))
    .filter(({ observation: o }) => !inspection || o.check?.answer === "action" || o.whatHappened.trim() || o.photos.length > 0);
  let photoNumber = 0;

  return (
    <main className="wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link href={withViewReturn(`/reports/${id}`, returnTo)} className="back">
          &larr; Report
        </Link>
        <Link href={withViewReturn(`/reports/${id}/pdf`, returnTo)} className="back" style={{ color: "var(--brass)" }}>
          Open the PDF &rarr;
        </Link>
      </div>

      <div className="doc">
        <header className="doc-head">
          <div className="doc-brand">LEODIS</div>
          <h1 className="doc-title">{type.document}</h1>
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
              <dt>{inspection ? "Inspection date" : "Visit date"}</dt>
              <dd>{report.visitDate}</dd>
            </div>
            <div>
              <dt>{inspection ? "Inspected by" : "Prepared by"}</dt>
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
          <h2 className="doc-h2">{inspection ? "Actions arising" : "Action and decision summary"}</h2>
          {actions.length === 0 ? (
            <p className="doc-body">{inspection ? "No actions arise from this inspection." : "No actions or decisions arise from this visit."}</p>
          ) : (
            <div className="doc-tw">
              <table className="doc-table">
                <thead>
                  <tr>
                    <th>{inspection ? "Check" : "Item"}</th>
                    <th>{inspection ? "Action required" : "Action or decision required"}</th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((observation, index) => (
                    <tr key={observation.id}>
                      <td>
                        {index + 1}. {itemTitle(observation)}
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

        {inspection && <section>
          <h2 className="doc-h2">Inspection results</h2>
          <div className="doc-tw">
            <table className="doc-table">
              <thead><tr><th>Check</th><th>Result</th></tr></thead>
              <tbody>
                {report.observations.map((o, index) => <tr key={o.id}>
                  <td>{index + 1}. {o.check?.question ?? o.location}</td>
                  <td className={o.check?.answer ? "" : "doc-unknown"}>{answerLabel(o.check?.answer)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>}

        {detailed.length > 0 && <section>
          <h2 className="doc-h2">{inspection ? "Notes and photographs" : "Observations"}</h2>
          {detailed.map(({ observation, number }) => {
            const kind = OBSERVATION_TYPES.find((t) => t.value === observation.type);
            return (
              <article key={observation.id} className="doc-obs">
                <h3 className="doc-h3">
                  {number}. {itemTitle(observation)}
                  <span className="doc-type">{observation.check ? answerLabel(observation.check.answer) : kind?.label ?? observation.type}</span>
                </h3>
                <p className="doc-body">{observation.whatHappened || (observation.check ? "No notes recorded." : "No description recorded.")}</p>
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
        </section>}

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
        This page is the layout on screen; the PDF above is rendered on the server from what the
        server holds, not from anything this page sends. In the real system it is generated from a
        frozen submitted revision, then signed and filed.
      </p>
    </main>
  );
}
