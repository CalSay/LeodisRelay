"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReport, getProject, listReports, projectIssues, type Report } from "@/lib/api";
import { IssueRegister } from "@/components/IssueRegister";
import type { Issue, ReportSummary } from "@/lib/types";
import { usePrincipal } from '@/components/PrincipalContext';
import { ownsReport } from '@/lib/auth/access';

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const principal = usePrincipal();
  const project = getProject(id);

  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [offset,setOffset] = useState(0);
  const [next,setNext] = useState<number | null>(null);
  const [error,setError] = useState('');
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    listReports(id,offset).then(page => { setReports(page.reports); setNext(page.next); setError(''); }).catch(e => setError(e.message));
    projectIssues(id).then(setIssues).catch(() => setIssues([]));
  }, [id,offset]);

  useEffect(refresh, [refresh]);

  async function startReport() {
    setCreating(true);
    try {
      const report = await createReport(id, "You");
      router.push(`/reports/${report.id}`);
    } finally {
      setCreating(false);
    }
  }

  if (!project) {
    return (
      <main className="wrap">
        <Link href="/" className="back">
          &larr; Projects
        </Link>
        <div className="empty">That project could not be found.</div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <Link href="/" className="back">
        &larr; Projects
      </Link>

      <div className="pagehead">
        <div>
          <h1>{project.projectName}</h1>
          <p className="sub">
            <span className="ref">{project.projectNumber}</span> · {project.clientName}
          </p>
        </div>
      </div>

      {/* Title block: the identity of the job, stated once, the way a drawing does. */}
      <dl className="titleblock" style={{ marginTop: 24 }}>
        <div className="tb-cell">
          <dt>Client account</dt>
          <dd className="ref">{project.clientAccountNumber}</dd>
        </div>
        <div className="tb-cell">
          <dt>Division</dt>
          <dd>{project.division}</dd>
        </div>
        <div className="tb-cell">
          <dt>Status</dt>
          <dd>{project.status}</dd>
        </div>
        <div className="tb-cell">
          <dt>Project manager</dt>
          <dd>{project.projectManager}</dd>
        </div>
      </dl>

      <div style={{ marginTop: 24 }}>
        <button className="btn-primary btn-wide" onClick={startReport} disabled={creating}>
          {creating ? "Starting…" : "Start a site report"}
        </button>
      </div>

      {/* Outstanding work comes before the report history: what is still owed
          matters more than what has already been written up. Rendered whether
          or not there is anything in it. */}
      <IssueRegister issues={issues} />

      <div className="sec">
        <span className="lbl">Reports</span>
      </div>

      {reports === null ? (
        <div className="empty">Loading</div>
      ) : reports.length === 0 ? (
        <div className="empty">No reports yet on this project.</div>
      ) : (
        <div className="reg">
          {reports.map((report) => (
              <Link key={report.id} href={report.state === 'draft' && (!principal || !ownsReport(principal,report)) ? '/office' : `/reports/${report.id}`} className="row">
                <span className="row-code">{report.reference.split("-").slice(1).join("-")}</span>
                <span className="row-main">
                  <p className="row-title">Visit {report.visitDate}</p>
                  <p className="row-meta">
                    {report.author}
                    <span className="sep">/</span>
                    {report.observationCount} observation
                    {report.observationCount === 1 ? "" : "s"}
                  </p>
                </span>
                <span className="row-end">
                  <span className={report.state === "submitted" ? "tag tag-sent" : "tag tag-draft"}>
                    {report.state === "submitted" ? "Submitted" : "Draft"}
                  </span>
                </span>
              </Link>
            ))}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="btn-row">
        {offset > 0 && <button onClick={() => setOffset(Math.max(0,offset-50))}>Newer reports</button>}
        {next !== null && <button onClick={() => setOffset(next)}>Older reports</button>}
      </div>
    </main>
  );
}
