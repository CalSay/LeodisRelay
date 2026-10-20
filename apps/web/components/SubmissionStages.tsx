import { submissionStages, type Tone } from '@/lib/status';
import type { ReportSummary } from '@/lib/types';

type StageReport = Omit<ReportSummary, 'observationCount' | 'photoCount' | 'defectCount'>;

/**
 * Where a sent report has got to, one step per row: received, review where
 * the project asks for it, PDF, delivery and read. Each step carries its own
 * state, so a ready PDF never reads as a delivered report. The office and the
 * engineer see the same steps in the same words; each passes its own tag style.
 */
export function SubmissionStages({ report, tagClass, when }: { report: StageReport; tagClass: (tone: Tone) => string; when: (iso?: string) => string }) {
  const stages = submissionStages(report);
  if (!stages.length) return null;
  return <ol className="stages" aria-label="Where this report has got to">
    {stages.map(s => <li key={s.key} data-stage={s.key} data-tone={s.tone}>
      <span className="stage-t">{s.title}</span>
      <span className={tagClass(s.tone)}>{s.label}</span>
      {(s.at || s.detail) && <small>{s.at && <time dateTime={s.at}>{when(s.at)}</time>}{s.at && s.detail ? ' · ' : ''}{s.detail}</small>}
    </li>)}
  </ol>;
}
