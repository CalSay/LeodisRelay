import type { Observation, Report, ReviewFinding } from "./types";
import { reportTypeOf } from "./reportTypes";

/**
 * What is missing before a report can be sent.
 *
 * Shared by the capture screen and the server, so the device and the office
 * never disagree about whether a report is complete. Blocking omissions are
 * separated from things worth noticing: an engineer should be stopped by a
 * defect with no photograph and not by a missing caption.
 */
export function reviewReport(report: Report): ReviewFinding[] {
  if (reportTypeOf(report).checklist) return reviewInspection(report);
  const findings: ReviewFinding[] = [];

  for (const observation of report.observations) {
    const label = observation.location || "Unspecified location";

    if (observation.whatHappened.trim().length === 0) {
      findings.push({
        observationId: observation.id,
        field: "whatHappened",
        message: `${label}: no description of what happened`,
        blocking: true,
      });
    }
    if (observation.type === "defect" && observation.photos.length === 0) {
      findings.push({
        observationId: observation.id,
        field: "photos",
        message: `${label}: a defect needs at least one photograph`,
        blocking: true,
      });
    }
    if (observation.type === "instruction" && observation.photos.length === 0) {
      findings.push({ observationId: observation.id, field: "photos", message: `${label}: a variation with no photograph is harder to price`, blocking: false });
    }
    if (observation.type === "instruction" && observation.workDone && !observation.askedBy?.trim()) {
      findings.push({ observationId: observation.id, field: "askedBy", message: `${label}: work already done, but nobody named who asked for it`, blocking: false });
    }
    if (observation.actionNeeded.trim().length > 0 && observation.owner.trim().length === 0) {
      findings.push({
        observationId: observation.id,
        field: "owner",
        message: `${label}: action recorded but nobody is named to do it`,
        blocking: false,
      });
    }
    for (const photo of observation.photos) {
      if (photo.caption.trim().length === 0) {
        findings.push({
          observationId: observation.id,
          field: "caption",
          message: `${label}: a photograph has no caption`,
          blocking: false,
        });
      }
    }
  }

  if (report.observations.length === 0) {
    findings.push({
      observationId: "",
      field: "observations",
      message: "No updates have been recorded on this visit yet",
      blocking: true,
    });
  }

  return findings;
}

/**
 * An inspection is complete when every check has an answer. "Action needed"
 * says what is wrong and what has to happen; who is to do it, and a
 * photograph, are worth adding but do not stop it. A satisfactory or not
 * applicable check needs nothing more. The person who inspected signs for
 * it, with a drawn signature.
 */
function reviewInspection(report: Report): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const short = (o: Observation) => o.check?.question ?? 'A check';
  for (const o of report.observations) {
    const answer = o.check?.answer;
    if (!answer) {
      findings.push({ observationId: o.id, field: 'answer', message: `${short(o)}: not answered yet`, blocking: true });
      continue;
    }
    if (answer !== 'action') continue;
    if (!o.whatHappened.trim()) findings.push({ observationId: o.id, field: 'whatHappened', message: `${short(o)}: say what is wrong`, blocking: true });
    if (!o.actionNeeded.trim()) findings.push({ observationId: o.id, field: 'actionNeeded', message: `${short(o)}: say what needs doing`, blocking: true });
    if (!o.owner.trim()) findings.push({ observationId: o.id, field: 'owner', message: `${short(o)}: nobody is named to do it`, blocking: false });
    if (o.photos.length === 0) findings.push({ observationId: o.id, field: 'photos', message: `${short(o)}: a photograph shows what was found`, blocking: false });
  }
  for (const o of report.observations) for (const photo of o.photos) {
    if (!photo.caption.trim()) findings.push({ observationId: o.id, field: 'caption', message: `${short(o)}: a photograph has no caption`, blocking: false });
  }
  if (report.state === 'draft' && !report.draftSignature?.dataUrl) {
    findings.push({ observationId: '', field: 'signature', message: 'Sign below: an inspection needs the inspector’s signature', blocking: true });
  }
  return findings;
}
