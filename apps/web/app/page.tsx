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
    <main className="wrap">
      <div className="pagehead">
        <div>
          <h1>Projects</h1>
          <p className="sub">Open to you for reporting</p>
        </div>
        {projects && (
          <span className="lbl">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {projects === null ? (
        <div className="empty" style={{ marginTop: 24 }}>
          Loading
        </div>
      ) : projects.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          No projects are open to you.
        </div>
      ) : (
        <div className="reg" style={{ marginTop: 24 }}>
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="row">
              <span className="row-code">{project.projectNumber}</span>
              <span className="row-main">
                <p className="row-title">{project.projectName}</p>
                <p className="row-meta">
                  {project.clientName}
                  <span className="sep">/</span>
                  {project.division}
                </p>
              </span>
              <span className="row-end">
                <span className="row-time">{project.status}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="footnote">
        Tenders and completed projects are not listed. If a project is missing, check its status
        with the office.
      </p>
    </main>
  );
}
