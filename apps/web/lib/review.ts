import type { Report, ReviewFinding } from "./types";

/**
 * What is missing before a report can be sent.
 *
 * Shared by the capture screen and the server, so the device and the office
 * never disagree about whether a report is complete. Blocking omissions are
 * separated from things worth noticing: an engineer should be stopped by a
 * defect with no photograph and not by a missing caption.
 */
export function reviewReport(report: Report): ReviewFinding[] {
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
      message: "Nothing has been recorded on this visit yet",
      blocking: true,
    });
  }

  return findings;
}
