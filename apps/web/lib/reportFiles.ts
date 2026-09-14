import { archiveFileName } from '@relay/contracts';
import type { Report } from './types';
import { cachedProject } from './projects';

/** One human-readable name everywhere: SharePoint, downloads and email. */
export function reportFileName(report: Report): string {
  const project = report.projectSnapshot ?? cachedProject(report.projectId);
  const projectNumber = project?.projectNumber || 'UNKNOWN';
  const demo = report.reference.startsWith('DEMO-') ? 'DEMO-' : '';
  const prefix = `${demo}${projectNumber}-`;
  const reportNumber = report.reference.startsWith(prefix)
    ? report.reference.slice(prefix.length)
    : report.reference;
  return archiveFileName({
    projectNumber: `${demo}${projectNumber}`,
    reportNumber,
    revision: report.revision,
    visitDate: report.visitDate,
  });
}

export function reportYear(report: Report): string {
  const year = report.visitDate.slice(0, 4);
  if (!/^\d{4}$/.test(year)) throw new Error('The report visit year is invalid.');
  return year;
}
