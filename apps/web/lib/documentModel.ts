import type { DocReport } from '@relay/documents';
import { FIXTURE_PROJECTS, OBSERVATION_TYPES } from './fixtures';
import type { Report } from './types';
import { documentPhotoUrl } from './mediaStore';

/** Both PDF download and delivery use the same snapshot mapping. */
export async function documentModel(report: Report): Promise<DocReport> {
  const project = FIXTURE_PROJECTS.find(p => p.id === report.projectId);
  const observations: DocReport['observations'] = [];
  for (const o of report.observations) {
    const kind = OBSERVATION_TYPES.find(t => t.value === o.type);
    const photos = [];
    for (const photo of o.photos) photos.push({ ...photo, dataUrl: await documentPhotoUrl(photo.dataUrl) });
    observations.push({ ...o, typeLabel: kind?.label ?? o.type, tone: kind?.tone ?? 'neutral', photos });
  }
  return {
    reference: report.reference, projectName: project?.projectName ?? report.projectId,
    projectNumber: project?.projectNumber ?? '', clientName: project?.clientName ?? '',
    clientAccountNumber: project?.clientAccountNumber ?? '', visitDate: report.visitDate,
    author: report.author, revision: report.revision, approved: report.review === 'approved',
    submittedWithoutReview: report.state === 'submitted' && report.review === 'not_required',
    observations, ...(report.signature ? { signature: report.signature } : {}),
  };
}
