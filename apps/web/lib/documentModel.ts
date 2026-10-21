import type { DocReport } from '@relay/documents';
import { OBSERVATION_TYPES } from './fixtures';
import { cachedProject } from './projects';
import type { Report } from './types';
import { documentPhotoUrl } from './mediaStore';
import { answerLabel, reportTypeOf } from './reportTypes';

/** Both PDF download and delivery use the same snapshot mapping. */
export async function documentModel(report: Report): Promise<DocReport> {
  const project = report.projectSnapshot ?? cachedProject(report.projectId);
  const observations: DocReport['observations'] = [];
  for (const o of report.observations) {
    const kind = OBSERVATION_TYPES.find(t => t.value === o.type);
    const photos = [];
    for (const photo of o.photos) photos.push({ ...photo, dataUrl: await documentPhotoUrl(photo.dataUrl) });
    const { check, ...card } = o;
    observations.push({ ...card, typeLabel: kind?.label ?? o.type, tone: kind?.tone ?? 'neutral', photos,
      ...(check ? { check: { question: check.question, answer: answerLabel(check.answer), tone: check.answer ?? 'open' } } : {}) });
  }
  const type = reportTypeOf(report);
  return {
    ...(type.id === 'progress' ? {} : { documentTitle: type.document }),
    ...(type.checklist ? { inspection: true } : {}),
    reference: report.reference, projectName: project?.projectName ?? report.projectId,
    projectNumber: project?.projectNumber ?? '', clientName: project?.clientName ?? '',
    clientAccountNumber: project?.clientAccountNumber ?? '', visitDate: report.visitDate,
    author: report.author, revision: report.revision,
    ...(report.corrects && report.correctionReason?.trim() ? { correction: { replacesRevision: report.revision - 1, reason: report.correctionReason.trim() } } : {}), approved: report.review === 'approved',
    submittedWithoutReview: report.state === 'submitted' && report.review === 'not_required',
    observations, ...(report.signature ? { signature: report.signature } : {}),
  };
}
