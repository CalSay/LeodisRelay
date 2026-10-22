import { dayShort } from './dates';
import { recentDay } from './projectStanding';

/**
 * The day a report is for, as the engineer reads it: "today, Thu 22 Oct",
 * "yesterday, Wed 21 Oct", or "Mon 19 Oct". The office files a report under
 * this day, so an update opened next morning has to say it.
 */
export function visitDayWords(visitDate: string, today: string): string {
  const day = dayShort(visitDate) || visitDate;
  const recent = recentDay(visitDate, today);
  return recent ? `${recent}, ${day}` : day;
}

/**
 * A site update still being written on a day after the one it is for. Today's
 * work added to it would reach the office under the earlier day, so the
 * editor says so. Not a correction: that keeps the day of the report it corrects.
 */
export function leftFromEarlierDay(report: { visitDate: string; state: string; corrects?: string | undefined; reportType?: string | undefined }, today: string): boolean {
  return report.state === 'draft' && !report.corrects && (report.reportType ?? 'progress') === 'progress' && report.visitDate < today;
}
