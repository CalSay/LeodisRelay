"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReport, getProject, listReports, type Report } from "@/lib/api";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const project = getProject(id);

  const [reports, setReports] = useState<Report[] | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(() => {
    listReports(id).then(setReports);
  }, [id]);

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
      <main className="shell">
        <Link href="/" className="backlink">
          &larr; All projects
        </Link>
        <div className="empty">That project could not be found.</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <Link href="/" className="backlink">
        &larr; All projects
      </Link>

      <div className="topbar">
        <div>
          <h1>{project.projectName}</h1>
          <div className="sub">
            <span className="code">{project.projectNumber}</span> · {project.clientName}
          </div>
        </div>
      </div>

      <button className="btn-primary btn-block" onClick={startReport} disabled={creating}>
        {creating ? "Starting..." : "Start a site report"}
      </button>

      <p className="section-label">This project</p>

      {reports === null ? (
        <div className="empty">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="empty">No reports yet on this project.</div>
      ) : (
        <div className="stack">
          {reports
            .slice()
            .reverse()
            .map((report) => (
              <Link key={report.id} href={`/reports/${report.id}`} className="card">
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
                    <p className="card-meta">
                      {report.visitDate} · {report.observations.length} observation
                      {report.observations.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {/*
                    Two distinct states, each spelled out. "Sent to office" is
                    deliberately not called "saved" — saving and sending are
                    different things and conflating them is the confusion the
                    real design exists to prevent.
                  */}
                  <span className={report.state === "submitted" ? "badge badge-sent" : "badge badge-draft"}>
                    {report.state === "submitted" ? "Sent to office" : "Draft"}
                  </span>
                </div>
              </Link>
            ))}
        </div>
      )}
    </main>
  );
}
