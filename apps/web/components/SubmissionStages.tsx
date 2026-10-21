import { submissionStages, type Stage, type StageKey, type Tone } from '@/lib/status';
import type { ReportSummary } from '@/lib/types';

type StageReport = Omit<ReportSummary, 'observationCount' | 'photoCount' | 'defectCount'>;

/** "Ready" reads "ready" after the step's name; "SharePoint …" keeps its capital. */
const lowerFirst = (label: string) => /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label;

/** The steps that matter to the office more than to the engineer who sent it. */
const OFFICE_STEPS: StageKey[] = ['pdf', 'delivery'];

/**
 * Where a sent report has got to, one step per row: received, review where
 * the project asks for it, PDF, delivery and read. Each step carries its own
 * state, so a ready PDF never reads as a delivered report. The office and the
 * engineer see the same steps in the same words; each passes its own tag style.
 * With `fold`, the engineer's view shows received, review and seen, and puts
 * the PDF and delivery under "PDF and delivery" unless one of them went wrong.
 */
export function SubmissionStages({ report, tagClass, when, fold = false }: { report: StageReport; tagClass: (tone: Tone) => string; when: (iso?: string) => string; fold?: boolean }) {
  const stages = submissionStages(report);
  if (!stages.length) return null;
  const folded = fold ? stages.filter(s => OFFICE_STEPS.includes(s.key) && s.tone !== 'alert') : [];
  const shown = stages.filter(s => !folded.includes(s));
  const foldName = folded.length === 2 ? 'PDF and delivery' : folded[0]?.title;
  const row = (s: Stage) => <li key={s.key} data-stage={s.key} data-tone={s.tone}>
    <span className="stage-t">{s.title}</span>
    <span className={tagClass(s.tone)}>{s.label}</span>
    {(s.at || s.detail) && <small>{s.at && <time dateTime={s.at}>{when(s.at)}</time>}{s.at && s.detail ? ' · ' : ''}{s.detail}</small>}
  </li>;
  return <>
    <ol className="stages" aria-label="Where this report has got to">{shown.map(row)}</ol>
    {folded.length > 0 && <details className="eng-more-detail stages-more">
      <summary>{foldName} <small>{folded.map(s => `${s.title} ${lowerFirst(s.label)}`).join(' · ')}</small></summary>
      <div><ol className="stages" aria-label={foldName}>{folded.map(row)}</ol></div>
    </details>}
  </>;
}
