/**
 * What the office means by a visit: one person on site on one day. An
 * engineer who sends a site update and an inspection on the same day made one
 * visit, not two, so "visits this week" on the office overview and a
 * project's Last visit agree with the Weekly summary. A person is known by
 * their sign-in where the report has it, else by the name on the report.
 */
export function countVisits(reports: readonly { visitDate: string; author: string; authorId?: string | undefined }[]): number {
  return new Set(reports.map(r => `${r.authorId ?? r.author.trim()}|${r.visitDate}`)).size;
}
