"use client";

import { useState } from "react";
import Link from "next/link";
import type { Issue } from "@/lib/types";

/**
 * Issues on a project.
 *
 * Always rendered, including when there is nothing to show. An empty register
 * saying "no issues raised" is information; a section that vanishes reads as
 * something failing to load, and on a project with nothing outstanding that is
 * exactly the wrong impression.
 *
 * The filter vocabulary is the proposal's own (section 4: open, assigned, in
 * progress, ready for verification, closed, reopened) rather than a third set
 * of words invented here. Open and Closed are two of those states; the finer
 * ones stay visible as a tag on each row, so filtering never hides the
 * distinction between assigned and awaiting verification.
 */

type Filter = "open" | "closed" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

function isOpen(issue: Issue): boolean {
  return issue.confirmation !== "withdrawn" && issue.work !== "closed";
}

function statusLabel(issue: Issue): string {
  if (issue.confirmation === "withdrawn") return "Withdrawn";
  switch (issue.work) {
    case "awaiting_verification":
      return "Verify";
    case "in_progress":
      return "In progress";
    case "assigned":
      return "Assigned";
    case "closed":
      return "Closed";
    default:
      return "Open";
  }
}

function statusTone(issue: Issue): string {
  if (issue.work === "closed") return "tag tag-sent";
  if (issue.confirmation === "disputed") return "tag tag-alert";
  return "tag tag-draft";
}

const EMPTY: Record<Filter, string> = {
  open: "Nothing outstanding on this project.",
  closed: "Nothing has been closed yet.",
  all: "No issues have been raised on this project.",
};

export function IssueRegister({ issues }: { issues: Issue[] | null }) {
  const [filter, setFilter] = useState<Filter>("open");

  const counts = {
    open: issues?.filter(isOpen).length ?? 0,
    closed: issues?.filter((i) => i.work === "closed").length ?? 0,
    all: issues?.length ?? 0,
  };

  const shown =
    issues === null
      ? []
      : filter === "all"
        ? issues
        : filter === "open"
          ? issues.filter(isOpen)
          : issues.filter((i) => i.work === "closed");

  // Awaiting verification is somebody's next action rather than a status, so it
  // is surfaced on the header instead of being left for the reader to count.
  const toVerify = issues?.filter((i) => i.work === "awaiting_verification").length ?? 0;

  return (
    <>
      <div className="sec-controls">
        <span className="lbl">
          Issues
          {toVerify > 0 ? ` · ${toVerify} awaiting verification` : ""}
        </span>
        <div className="segs" role="group" aria-label="Filter issues">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="seg"
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
              <span className="seg-n">{counts[option.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {issues === null ? (
        <div className="empty">Loading</div>
      ) : shown.length === 0 ? (
        <div className="empty">{EMPTY[filter]}</div>
      ) : (
        <div className="reg">
          {shown.map((issue) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className="row">
              <span className="row-code">
                {issue.reference.split("-").slice(1).join("-")}
              </span>
              <span className="row-main">
                <p className="row-title">{issue.location || "Location not recorded"}</p>
                <p className="row-meta">
                  {issue.description.length > 70
                    ? `${issue.description.slice(0, 70)}…`
                    : issue.description}
                </p>
              </span>
              <span className="row-end">
                <span className={statusTone(issue)}>{statusLabel(issue)}</span>
                <span className="row-time">{issue.owner.trim() || "no owner"}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
