/**
 * Which section of a report raised an issue or variation.
 *
 * Records raised since 9 September 2026 store the section id. Earlier ones
 * only store the report, so they are matched on the text the section gave
 * them (description and location), and only when exactly one section of that
 * report matches. An ambiguous or missing match returns undefined rather than
 * guessing.
 */
export interface RaisedRecord { raisedByReport?: string; raisedByObservation?: string; description: string; location: string }
export interface ReportSections { id: string; corrects?: string; observations: { id: string; whatHappened: string; location: string }[] }

const same = (a: string | undefined, b: string | undefined) => (a ?? '').trim().replace(/\s+/g, ' ') === (b ?? '').trim().replace(/\s+/g, ' ');

export function sectionOf(record: RaisedRecord, report: ReportSections): string | undefined {
  // Section ids are unique and a correction keeps them, so a stored id still on this report decides it, however many revisions on.
  if (record.raisedByObservation && report.observations.some(o => o.id === record.raisedByObservation)) return record.raisedByObservation;
  if (!record.raisedByReport || (record.raisedByReport !== report.id && record.raisedByReport !== report.corrects)) return undefined;
  if (record.raisedByObservation) return record.raisedByObservation;
  const matches = report.observations.filter(o => same(o.whatHappened, record.description) && same(o.location, record.location));
  return matches.length === 1 ? matches[0]!.id : undefined;
}
