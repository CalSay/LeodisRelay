"use client";
import { IssueSyncStatus } from '@/components/SharePointStatus';
import { useProjectLookup } from "@/components/ProjectContext";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { PageTitle } from '@/components/PageTitle';
import Link from "next/link";
import { projectSuggestions, readPhoto, yourOpenIssues } from "@/lib/api";
import type { Issue, Photo } from "@/lib/types";
import { PhotoImage } from '@/components/PhotoImage';
import { PhotoRefused, uploadPhotos } from '@/lib/localMedia';
import { usePrincipal } from '@/components/PrincipalContext';
import { canManage } from '@/lib/auth/access';
import { backLabel, safeViewReturn, withViewReturn } from '@/lib/viewNavigation';
import { confirmationLabel } from '@/lib/issueConfirmation';
import { eventProvenance } from '@/lib/issueProvenance';
import { ISSUE_WORK } from '@/lib/status';
import { dateShort, daysBetween, pastTarget } from '@/lib/dates';
import { isOverdueIssue } from '@/lib/officeActions';
import { failure } from "@/lib/failure";
import { issueWord, raisedIssue } from "@/lib/cameBack";
import { OfficeWordBox } from "@/components/OfficeWordBox";
import { isYours, nextYourIssue } from "@/lib/yourIssues";

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

const WORK_LABEL = ISSUE_WORK;

/** Today in London, for the date picker's earliest day. */
const todayInLondon = (): string => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

// Provisional reads by whether review is in use (the API says); see confirmationLabel.
const CONFIRM_LABEL: Record<Exclude<Issue["confirmation"], "provisional">, string> = {
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
  confirmation: "Confirmation",
  assigned: "Assigned",
  note: "Note",
};
// The engineer's history uses the words on the engineer's buttons.
const ENGINEER_EVENT_LABEL: Record<string, string> = { ...EVENT_LABEL, closure_submitted: "Put forward as fixed", verified: "Checked and closed" };

export default function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string; update?: string }> }) {
  const getProject = useProjectLookup();
  const principal = usePrincipal();
  const manager = principal ? canManage(principal) : false;
  const { id } = use(params);
  const { returnTo, update } = use(searchParams);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [reviewOn, setReviewOn] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Assigning, for the office: the same command as the desk's Assign, without leaving the issue.
  const [assigning, setAssigning] = useState(false);
  const [owner, setOwner] = useState("");
  const [target, setTarget] = useState("");
  const [instruction, setInstruction] = useState("");
  const [owners, setOwners] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  // Just put forward as fixed by this engineer: say so and offer the next of theirs on this site
  // (empty while it is looked up, and if there is no answer; `left: 0` when none is left).
  const [putForward, setPutForward] = useState<{ next?: Issue; left?: number } | null>(null);
  const doneBox = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch(`/api/issues/${id}`, { cache: "no-store" })
      .then(async (r) => { const body = await r.json().catch(() => ({})); if (!r.ok) throw failure(r.status, body, "This issue could not be opened."); return body; })
      .then(({ reviewOn, ...found }: Issue & { reviewOn?: boolean }) => { setIssue(found); setReviewOn(!!reviewOn); })
      .catch((e) => setMissing(e instanceof TypeError || !(e instanceof Error) ? "No connection, so this issue could not be opened. Try again when there is signal." : e.message));
  }, [id]);

  // Opened from "Came back from the office" (?update=1): bring the photograph
  // and the buttons into view once, but never push what is wrong under the
  // app bar, so the engineer still sees what and where without scrolling up.
  const landed = useRef(false);
  useEffect(() => {
    if (update !== "1" || manager || !issue || landed.current) return;
    landed.current = true;
    const buttons = document.querySelector(".issue-eng-update .btn-row");
    const title = document.querySelector(".issue-eng-title");
    if (!buttons || !title) return;
    const bar = document.querySelector(".appbar")?.getBoundingClientRect().bottom ?? 0;
    const need = buttons.getBoundingClientRect().bottom + 16 - window.innerHeight;
    const room = title.getBoundingClientRect().top - bar - 8;
    if (need > 0 && room > 0) window.scrollBy(0, Math.min(need, room));
  }, [update, manager, issue]);

  // The button that was tapped has gone: move to what replaced it, once, so the result is read out.
  // Not again when the next issue arrives, which may be after the engineer has started typing a note.
  const shown = !!putForward;
  useEffect(() => { if (shown) doneBox.current?.focus(); }, [shown]);

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
        body: JSON.stringify({ expectedEtag: issue.sync?.etag, kind, note: note.trim(), photos }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(failure(response.status, body, "That was not recorded.", "Your note is still here.").message);
        return;
      }
      setIssue(body);
      setAssigning(false);
      setNote("");
      setPhotos([]);
      if (kind === "submit_closure" && !manager && principal) {
        setPutForward({});
        yourOpenIssues().then((all) => setPutForward(nextYourIssue(all, principal, body.projectId, body.id))).catch(() => undefined);
      }
    } catch (e) {
      // A photograph the server would not take says so; anything else here is the connection.
      setError(e instanceof PhotoRefused ? `A photograph was not accepted: ${e.reason ? e.reason[0]!.toLowerCase() + e.reason.slice(1) : 'RELAY would not take it.'} Remove it and add it again. Your note is still here.`
        : e instanceof Error && !(e instanceof TypeError) ? e.message : "No connection, so nothing was recorded. Your note is still here: try again when there is signal.");
    } finally {
      setBusy(false);
    }
  }

  function startAssigning() {
    if (!issue) return;
    setOwner(issue.owner.trim());
    setTarget(issue.targetDate || "");
    setInstruction("");
    setAssignError(null);
    setAssigning(true);
    // Companies already named on the project, as the report editor suggests them. A suggestion, never a list to pick from.
    projectSuggestions(issue.projectId).then((s) => setOwners(s.companies)).catch(() => setOwners([]));
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue) return;
    const named = owner.trim();
    if (!named) {
      setAssignError("Name who is responsible.");
      return;
    }
    setBusy(true);
    setAssignError(null);
    try {
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedEtag: issue.sync?.etag, kind: "assign", owner: named, targetDate: target, note: instruction.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAssignError(failure(response.status, body, "The issue was not assigned.", "What you typed is still here.").message);
        return;
      }
      setIssue(body);
      setAssigning(false);
    } catch {
      setAssignError("No connection, so the issue was not assigned. What you typed is still here: try again when there is signal.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <main className="wrap eng-page">
        <div className="empty" role="alert">{missing}</div>
      </main>
    );
  }
  if (!issue) {
    return (
      <main className="wrap eng-page">
        <div className="empty" style={{ marginTop: 32 }}>Loading</div>
      </main>
    );
  }

  const project = getProject(issue.projectId);
  const back = safeViewReturn(returnTo, `/engineer?project=${encodeURIComponent(issue.projectId)}&view=issues`);
  const canClose = issue.work === "awaiting_verification";
  const isClosed = issue.work === "closed";
  const isWithdrawn = issue.confirmation === "withdrawn";
  // The server's rule: only open, assigned or in-progress work can be given an owner. A withdrawn issue is left alone too, as on the rest of this page.
  const canAssign = manager && !isWithdrawn && (issue.work === "open" || issue.work === "assigned" || issue.work === "in_progress");
  const assignLabel = issue.owner.trim() ? "Reassign" : "Assign";
  const confirmation = issue.confirmation === "provisional" ? confirmationLabel("provisional", reviewOn) : CONFIRM_LABEL[issue.confirmation];
  const reportedBy = issue.reportedBy ?? issue.events[0]?.actor ?? 'Not recorded';

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const added: Photo[] = [];
    for (const file of Array.from(files)) added.push(await readPhoto(file));
    setPhotos((current) => [...current, ...added]);
  }

  const cameraButton = (
    <label className="camera">
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        onChange={async (e) => { await addPhotos(e.target.files); e.target.value = ""; }}
      />
      Add photograph
    </label>
  );
  const newPhotos = photos.length > 0 && (
    <div className="shots">
      {photos.map((photo, i) => (
        <figure key={photo.id} className="shot" style={{ margin: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <PhotoImage src={photo.dataUrl} alt={`New evidence ${i + 1}`} />
        </figure>
      ))}
    </div>
  );

  const disputedNote = issue.confirmation === "disputed" && (
    <div className="note note-bad" style={{ marginTop: 16 }}>
      The report that raised this was returned for correction. Any work already done stands —
      this needs a decision on whether the observation was right.
    </div>
  );

  const history = (
    <div className="reg">
      {issue.events.map((event, i) => {
        const from = eventProvenance(issue, event, i);
        return (
        <div key={i} className="row row-static" style={{ alignItems: "flex-start" }}>
          <span className="row-code">{(manager ? EVENT_LABEL : ENGINEER_EVENT_LABEL)[event.kind] ?? event.kind}</span>
          <span className="row-main">
            {event.kind === "assigned" && event.to && <p className="row-title" style={{ fontSize: 14.5 }}>To {event.to}{event.targetDate ? `, by ${dateShort(event.targetDate)}` : ""}</p>}
            {event.note && <p className="row-title" style={{ fontSize: 14.5, fontWeight: 400 }}>{event.note}</p>}
            <p className="row-meta">{event.actor}</p>
            {from && <p className="row-meta issue-event-source"><Link href={`/reports/${from.reportId}`}>{from.label}</Link></p>}
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
              {dateShort(event.at, "auto")}
            </span>
          </span>
        </div>
        );
      })}
    </div>
  );

  if (!manager) {
    // The engineer's view: what is wrong, where, what needs doing and who is on
    // it, then the photograph and the two buttons, all on the first screen of a
    // phone. The history and the office's detail are folded, not removed.
    const owner = issue.owner.trim();
    // What the office asked or said last, while it waits on them: shown, not left in History. For whoever the issue is
    // theirs to see to, as Issues "Yours": they raised it, it is their trade, or they worked on it (a fix they put
    // forward and the office sent back, 2026-10-22). Another trade still finds it in History.
    const word = principal && (raisedIssue(issue, principal.id) || isYours(issue, principal)) ? issueWord(issue.events, principal) : undefined;
    // Opened from another site's home (its "Came back from the office" lists every site): say which site this one is on.
    const elsewhere = new URL(back, 'https://relay.local').searchParams.get('project');
    const otherSite = elsewhere && elsewhere !== issue.projectId ? project?.projectName : undefined;
    return (
      <main className="wrap eng-page issue-eng">
        <PageTitle title={`${issue.reference} · Issue`} />
        <Link href={back} className="back">&larr; {backLabel(back, 'Issues')}</Link>

        <IssueSyncStatus issue={issue} />
        <div className="issue-eng-head">
          <span className="lbl">{issue.reference}</span>
          <span className={isClosed ? "tag tag-sent" : issue.confirmation === "disputed" ? "tag tag-alert" : "tag tag-draft"}>{isWithdrawn ? "Withdrawn" : WORK_LABEL[issue.work]}</span>
        </div>
        <h1 className="issue-eng-title">{issue.description}</h1>
        <dl className="issue-eng-facts">
          {otherSite && <div><dt>Site</dt><dd>{otherSite}</dd></div>}
          <div><dt>Where</dt><dd>{issue.location || "Location not recorded"}</dd></div>
          {issue.actionNeeded.trim() && <div><dt>What needs doing</dt><dd>{issue.actionNeeded.trim()}</dd></div>}
          <div><dt>Who is fixing it</dt><dd>{owner ? `${owner}${issue.targetDate ? `, by ${dateShort(issue.targetDate)}` : ""}` : "Nobody yet. The office will say who."}</dd></div>
        </dl>

        {word && <OfficeWordBox key={`${word.at}${word.note}`} word={word} />}
        {issue.confirmation === "disputed" && <p className="note note-bad" role="status">The office is checking whether this needs fixing. Open History for why.</p>}
        {canClose && !isWithdrawn && (putForward ? (
          <section className="eng-panel issue-eng-done" role="status" aria-labelledby="issue-done-title" ref={doneBox} tabIndex={-1}>
            <h2 id="issue-done-title">Put forward as fixed</h2>
            <p>It is waiting for the office to check it. If it is not finished, it comes back to you.</p>
            {putForward.next ? (
              <Link className="eng-primary issue-eng-next" href={withViewReturn(`/issues/${putForward.next.id}`, back)}>
                <span>Next: {putForward.next.description}</span>
                <small>{putForward.next.location || "Location not recorded"} · {putForward.left} to do on this site</small>
              </Link>
            ) : putForward.left === 0 && <p><strong>That was the last one for you on {project?.projectName ?? "this site"}.</strong></p>}
            <Link className="eng-secondary" href={back}>{backLabel(back, 'Issues')}</Link>
          </section>
        ) : <p className="note" role="status">Put forward as fixed. It is waiting for the office to check it.</p>)}
        {isClosed && !isWithdrawn && <p className="note" role="status">The office checked the work and closed this issue.</p>}

        {!isWithdrawn && !isClosed && (canClose ? (
          // Waiting on the office: adding more is still possible, but folded, so the page reads as done.
          <details className="eng-more-detail issue-eng-add">
            <summary>Add a note for the office<small>A photograph or a few words, if there is more to say</small></summary>
            <div className="issue-eng-update">
              {cameraButton}
              {newPhotos}
              <div className="field">
                <label htmlFor="note">What has happened</label>
                <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did or found" />
              </div>
              {error && <div className="note note-bad" role="alert">{error}</div>}
              <div className="btn-row">
                <button onClick={() => run("progress")} disabled={busy}>
                  Record an update
                </button>
              </div>
            </div>
          </details>
        ) : (
          <section className="eng-panel issue-eng-update" aria-labelledby="issue-update-title">
            <h2 id="issue-update-title">Update this issue</h2>
            {cameraButton}
            {newPhotos}
            <div className="field">
              <label htmlFor="note">What has happened · optional</label>
              <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you did or found" />
            </div>
            {error && <div className="note note-bad" role="alert">{error}</div>}
            <div className="btn-row">
              <button className="btn-primary" onClick={() => run("submit_closure")} disabled={busy}>
                Put forward as fixed
              </button>
              <button onClick={() => run("progress")} disabled={busy}>
                Record an update
              </button>
            </div>
          </section>
        ))}

        <details className="eng-more-detail issue-more">
          <summary>History · {issue.events.length}<small>Every update, and the detail the office keeps</small></summary>
          <div>
            <dl className="issue-eng-facts">
              <div><dt>Project</dt><dd>{project?.projectName ?? issue.projectId}</dd></div>
              <div><dt>Confirmation</dt><dd>{confirmation}</dd></div>
              <div><dt>Raised</dt><dd>{dateShort(issue.raisedAt)} · {issue.source==='individual'?'Defect flagged on its own':'From a site update'}</dd></div>
              <div><dt>Trade affected</dt><dd>{issue.affectedTrade ?? 'Not recorded'}</dd></div>
              <div><dt>Reported by</dt><dd>{reportedBy} · {issue.reporterTrade ?? 'Reporting trade not recorded'}</dd></div>
            </dl>
            {disputedNote}
            {history}
          </div>
        </details>
      </main>
    );
  }

  return (
    <main className="wrap eng-page">
      <PageTitle title={`${issue.reference} · Issue`} />
      <Link href={back} className="back">&larr; {backLabel(back, 'Issues')}</Link>

      <IssueSyncStatus issue={issue} />
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
        <div className="tb-cell"><dt>Confirmation</dt><dd>{confirmation}</dd></div>
        <div className="tb-cell">
          <dt>Owner</dt>
          <dd>{issue.owner.trim() || "Not yet assigned"}</dd>
        </div>
        <div className="tb-cell">
          <dt>Target date</dt>
          <dd className={issue.targetDate ? "ref" : ""}>{issue.targetDate ? dateShort(issue.targetDate) : "No target date"}{isOverdueIssue(issue, todayInLondon()) && <span className="late">, {pastTarget(daysBetween(issue.targetDate, todayInLondon()))}</span>}</dd>
        </div>
        <div className="tb-cell">
          <dt>Raised</dt>
          <dd className="ref">{dateShort(issue.raisedAt)}</dd>
        </div>
      </dl>
      <section className="eng-panel">
        <h2>{issue.source==='individual'?'Defect flagged on its own':'From a site update'}</h2>
        <p>{issue.description}</p>
        <p className="eng-help">{project?.projectName} · {issue.location || 'Location not recorded'}</p>
        <p className="eng-help">Trade affected: {issue.affectedTrade ?? 'Not recorded'}<br/>Reported by {reportedBy} · {issue.reporterTrade ?? 'Reporting trade not recorded'}</p>
      </section>

      {canAssign && (
        <section className="panel issue-assign" aria-labelledby="assign-heading">
          <div className="panel-body">
            <h2 id="assign-heading" className="issue-assign-title">Who puts it right</h2>
            {!assigning ? (
              <div className="issue-assign-row">
                <p className="eng-help" style={{ margin: 0 }}>
                  {issue.owner.trim() ? <>{issue.owner.trim()}{issue.targetDate ? `, by ${dateShort(issue.targetDate)}` : ", no target date"}</> : "Nobody is down to put this right yet."}
                </p>
                <button type="button" className={issue.owner.trim() ? "" : "btn-primary"} onClick={startAssigning} disabled={busy}>
                  {assignLabel}
                </button>
              </div>
            ) : (
              <form onSubmit={assign} noValidate>
                <div className="field">
                  <label htmlFor="assign-owner">Responsible</label>
                  <input id="assign-owner" type="text" value={owner} onChange={(e) => { setOwner(e.target.value); setAssignError(null); }} list="assign-owners" placeholder="Person or company" autoComplete="off" autoFocus />
                  <datalist id="assign-owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
                </div>
                <div className="field">
                  <label htmlFor="assign-target">Target date</label>
                  <input id="assign-target" type="date" value={target} min={issue.targetDate && issue.targetDate < todayInLondon() ? issue.targetDate : todayInLondon()} onChange={(e) => setTarget(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="assign-note">Instruction</label>
                  <textarea id="assign-note" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="What is expected, access arrangements, who to call on site" />
                </div>
                <p className="eng-help" style={{ marginTop: 0 }}>Leave the date empty for no target date. Owners are names or companies, not accounts. The engineer who reported it is not changed.</p>
                {assignError && <div className="note note-bad" role="alert">{assignError}</div>}
                <div className="btn-row">
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Recording…" : assignLabel}</button>
                  <button type="button" onClick={() => setAssigning(false)} disabled={busy}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {disputedNote}

      <div className="sec"><span className="lbl">History</span></div>

      {history}

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
                {cameraButton}
                {newPhotos}
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
                    Put forward as fixed
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
