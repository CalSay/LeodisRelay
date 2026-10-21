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

/**
 * `earlier` lists the revisions before the one this report corrects, so a
 * record raised on revision 1 still matches revision 3. Checklist section ids
 * repeat across inspections, so the report chain is always checked.
 */
export function sectionOf(record: RaisedRecord, report: ReportSections, earlier: readonly string[] = []): string | undefined {
  if (!record.raisedByReport || (record.raisedByReport !== report.id && record.raisedByReport !== report.corrects && !earlier.includes(record.raisedByReport))) return undefined;
  if (record.raisedByObservation) return record.raisedByObservation;
  const matches = report.observations.filter(o => same(o.whatHappened, record.description) && same(o.location, record.location));
  return matches.length === 1 ? matches[0]!.id : undefined;
}

/** The ids of every revision a report corrects, nearest first, from a lookup of `corrects` links. */
export function revisionsBefore(report: Pick<ReportSections, 'corrects'>, correctsOf: (id: string) => string | undefined): string[] {
  const ids: string[] = [];
  for (let at = report.corrects; at && !ids.includes(at); at = correctsOf(at)) ids.push(at);
  return ids;
}
