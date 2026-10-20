import type { Issue } from './types';

/**
 * How an issue's confirmation reads, given whether its project uses review.
 *
 * Issues are raised `provisional` at submission. Where the project reviews
 * reports, that means the observation has not been reviewed yet. Where it does
 * not (the default), nobody is going to review it, so "Not reviewed" would read
 * as a missed step: the issue stands as the engineer reported it until someone
 * confirms or withdraws it. Only the wording changes; the state is the same and
 * review is never implied where it did not happen.
 */
export function confirmationLabel(confirmation: Issue['confirmation'], reviewOn: boolean): string {
  if (confirmation === 'provisional') return reviewOn ? 'Not reviewed' : 'As reported';
  return CONFIRMATION_LABEL[confirmation];
}

/** One line on what the confirmation means, for a detail view. */
export function confirmationNote(confirmation: Issue['confirmation'], reviewOn: boolean): string {
  if (confirmation === 'provisional') return reviewOn ? 'not yet confirmed at report review or by the office' : 'stands as the engineer reported it; this project does not use review';
  return CONFIRMATION_NOTE[confirmation];
}

const CONFIRMATION_LABEL = { confirmed: 'Confirmed', disputed: 'Disputed', withdrawn: 'Withdrawn' } as const;
const CONFIRMATION_NOTE = {
  confirmed: 'the observation was confirmed as right',
  disputed: 'the report it came from was sent back; needs triage',
  withdrawn: 'the observation was withdrawn as wrong',
} as const;
