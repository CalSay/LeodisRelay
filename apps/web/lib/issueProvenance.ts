import type { Issue, IssueEvent } from './types';

/**
 * Where an issue change came from, for the issue's history (FE-6b).
 *
 * Report-driven events carry the report revision that made them. Events
 * recorded before that keep no source, except that the first "raised" event
 * of a report-raised issue still points at `raisedByReport`, which never
 * changes. Changes made on the issue itself (assign, close, verify) have none.
 */
export interface EventProvenance {
  reportId: string;
  label: string;
}

export function eventProvenance(issue: Pick<Issue, 'source' | 'raisedByReport'>, event: IssueEvent, index: number): EventProvenance | null {
  const source = event.source;
  if (source) {
    const name = `${source.reference} rev ${source.revision}`;
    if (event.kind === 'confirmation') return { reportId: source.reportId, label: `Review of ${name}` };
    return { reportId: source.reportId, label: source.corrects ? `From ${name}, which corrects rev ${source.revision - 1}` : `From ${name}` };
  }
  if (index === 0 && event.kind === 'raised' && issue.source !== 'individual' && issue.raisedByReport) {
    return { reportId: issue.raisedByReport, label: 'From the report that raised it' };
  }
  return null;
}
