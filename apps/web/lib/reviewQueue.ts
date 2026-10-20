import type { ReportSummary } from './types';

/**
 * Whether the office shows a review queue for a project.
 *
 * Review is a per-project setting and off by default, so a "to review" queue,
 * a "returned" filter or a "not reviewed" count is noise on every project that
 * does not use it. The queue still shows while a report is waiting for a
 * decision from when the project did require review, so nothing is left
 * waiting where nobody can see it.
 */
export function reviewInUse(project: { reviewRequired: boolean }, reports: Pick<ReportSummary, 'state' | 'review'>[]): boolean {
  return project.reviewRequired || reports.some(r => r.state === 'submitted' && r.review === 'pending');
}
