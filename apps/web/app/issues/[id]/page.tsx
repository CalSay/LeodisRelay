"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getProject, readPhoto } from "@/lib/api";
import type { Issue, Photo } from "@/lib/types";
import { PhotoImage } from '@/components/PhotoImage';
import { uploadPhotos } from '@/lib/localMedia';
import { usePrincipal } from '@/components/PrincipalContext';
import { canManage } from '@/lib/auth/access';

/**
 * One issue, across every visit that touched it.
 *
 * The history is the point. A report says what someone saw once; this says what
 * has happened since, who owes what, and on whose word it was closed.
 *
 * Confirmation and work status are shown as two separate facts because they
 * are two separate facts. An issue can be repaired and still disputed, or
 * confirmed and still untouched, and collapsing them into one status is how a
 * tracker starts lying.
 */

const WORK_LABEL: Record<Issue["work"], string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_verification: "Awaiting verification",
  closed: "Closed",
};

const CONFIRM_LABEL: Record<Issue["confirmation"], string> = {
  provisional: "Not yet reviewed",
  confirmed: "Confirmed",
  disputed: "Disputed — needs triage",
  withdrawn: "Withdrawn",
};

const EVENT_LABEL: Record<string, string> = {
  raised: "Raised",
  progress: "Update",
  closure_submitted: "Closure submitted",
  verified: "Verified closed",
  reopened: "Reopened",
  confirmation: "Review",
  assigned: "Assigned",
};

export default function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const principal = usePrincipal();
  const manager = principal ? canManage(principal) : false;
  const { id } = use(params);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/issues/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setIssue)
      .catch(() => setMissing(true));
  }, [id]);

  async function run(kind: string) {
    if (!issue) return;
    // The domain refuses a confirmation change without a reason. Substituting
    // "(no note)" here defeated that rule from the outside, which is the same
    // failure as a route trusting a cookie: a correct rule, undone by its
    // adapter.
    if ((kind === "confirm" || kind === "withdraw") && note.trim().length === 0) {
      setError("Say why this is being confirmed or withdrawn.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadPhotos(photos, { issueId: issue.id });
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, note: note.trim(), photos }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.reason ?? "That could not be recorded.");
        return;
      }
      setIssue(body);
      setNote("");
      setPhotos([]);
    } catch {
      setError("No connection. Nothing was recorded.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="wrap">
        <div className="empty">That issue could not be found.</div>
      </main>
    );
  }
  if (!issue) {
    return (
      <main className="wrap">
        <div className="empty" style={{ marginTop: 32 }}>Loading</div>
      </main>
    );
  }

  const project = getProject(issue.projectId);
  const canClose = issue.work === "awaiting_verification";
  const isClosed = issue.work === "closed";
  const isWithdrawn = issue.confirmation === "withdrawn";

  return (
    <main className="wrap">
      <Link href={`/projects/${issue.projectId}`} className="back">
        &larr; {project?.projectName ?? "Project"}
      </Link>

      <div className="pagehead">
        <div>
          <h1 className="ref" style={{ fontSize: 22 }}>{issue.reference}</h1>
          <p className="sub">{issue.location || "Location not recorded"}</p>
        </div>
        <span
          className={
            isClosed ? "tag tag-sent" : issue.confirmation === "disputed" ? "tag tag-alert" : "tag tag-draft"
          }
        >
          {WORK_LABEL[issue.work]}
        </span>
      </div>

      {/* Two axes, stated separately and never merged into one status. */}
      <dl className="titleblock" style={{ marginTop: 24 }}>
        <div className="tb-cell"><dt>Work status</dt><dd>{WORK_LABEL[issue.work]}</dd></div>
        <div className="tb-cell"><dt>Review</dt><dd>{CONFIRM_LABEL[issue.confirmation]}</dd></div>
        <div className="tb-cell">
          <dt>Owner</dt>
          <dd>{issue.owner.trim() || "Awaiting confirmation"}</dd>
        </div>
        <div className="tb-cell">
          <dt>Raised</dt>
          <dd className="ref">{new Date(issue.raisedAt).toLocaleDateString("en-GB")}</dd>
        </div>
      </dl>

      {issue.confirmation === "disputed" && (
        <div className="note note-bad" style={{ marginTop: 16 }}>
          The report that raised this was returned for correction. Any work already done stands —
          this needs a decision on whether the observation was right.
        </div>
      )}

      <div className="sec"><span className="lbl">History</span></div>

      <div className="reg">
        {issue.events.map((event, i) => (
          <div key={i} className="row row-static" style={{ alignItems: "flex-start" }}>
            <span className="row-code">{EVENT_LABEL[event.kind] ?? event.kind}</span>
            <span className="row-main">
              <p className="row-title" style={{ fontSize: 14.5, fontWeight: 400 }}>{event.note}</p>
              <p className="row-meta">{event.actor}</p>
              {event.photos.length > 0 && (
                <div className="shots" style={{ marginTop: 10 }}>
                  {event.photos.map((photo, pi) => (
                    <figure key={photo.id} className="shot" style={{ margin: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <PhotoImage src={photo.dataUrl} alt={photo.caption || `Photograph ${pi + 1}`} />
                      {photo.caption && (
                        <div className="shot-body">
                          <span className="shot-no">{photo.caption}</span>
                        </div>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </span>
            <span className="row-end">
              <span className="row-time">
                {new Date(event.at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </span>
            </span>
          </div>
        ))}
      </div>

      {!isWithdrawn && (
        <>
          <div className="sec"><span className="lbl">Add to this issue</span></div>

          <section className="panel">
            <div className="panel-body">
              <div className="field">
                <label htmlFor="note">What has happened</label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Progress, findings, or why this is being closed"
                />
              </div>

              <div className="field">
                <label>Evidence{photos.length > 0 ? ` · ${photos.length}` : ""}</label>
                <label className="camera">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const added: Photo[] = [];
                      for (const file of Array.from(files)) added.push(await readPhoto(file));
                      setPhotos((current) => [...current, ...added]);
                      e.target.value = "";
                    }}
                  />
                  Add photograph
                </label>
                {photos.length > 0 && (
                  <div className="shots">
                    {photos.map((photo, i) => (
                      <figure key={photo.id} className="shot" style={{ margin: 0 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <PhotoImage src={photo.dataUrl} alt={`New evidence ${i + 1}`} />
                      </figure>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="note note-bad">{error}</div>}

              <div className="btn-row">
                {!isClosed && (
                  <button onClick={() => run("progress")} disabled={busy}>
                    Record an update
                  </button>
                )}
                {!isClosed && !canClose && (
                  <button onClick={() => run("submit_closure")} disabled={busy}>
                    Submit as complete
                  </button>
                )}
                {manager && canClose && (
                  <button className="btn-primary" onClick={() => run("verify")} disabled={busy}>
                    Verify and close
                  </button>
                )}
                {manager && isClosed && (
                  <button onClick={() => run("reopen")} disabled={busy}>
                    Reopen
                  </button>
                )}
                {manager && issue.confirmation !== "confirmed" && !isClosed && (
                  <button onClick={() => run("confirm")} disabled={busy}>
                    Confirm observation
                  </button>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
