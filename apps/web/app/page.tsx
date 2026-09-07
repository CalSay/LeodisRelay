"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listProjects } from "@/lib/api";
import type { FixtureProject } from "@/lib/fixtures";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<FixtureProject[] | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>Your projects</h1>
          <div className="sub">Projects you can report against</div>
        </div>
        <div>
          <Link href="/office" className="backlink">Office view &rarr;</Link>
        </div>
      </div>

      {projects === null ? (
        <div className="empty">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty">No projects are currently open to you.</div>
      ) : (
        <div className="stack">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="card">
              <p className="card-title">{project.projectName}</p>
              <p className="card-meta">
                <span className="code">{project.projectNumber}</span> &nbsp;·&nbsp;{" "}
                {project.clientName}
              </p>
              <p className="card-meta" style={{ marginTop: 6 }}>
                {project.division} &nbsp;·&nbsp; {project.status}
              </p>
            </Link>
          ))}
        </div>
      )}

      {/*
        Tenders and completed jobs are filtered out by the backend rather than
        hidden here. An engineer must not be able to file against a bid.
      */}
      <p className="hint" style={{ marginTop: 24 }}>
        Tenders and completed projects are not listed. If a project is missing, check its
        status with the office.
      </p>
    </main>
  );
}
