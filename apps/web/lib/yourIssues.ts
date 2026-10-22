import type { Issue } from './types';
import { isOpenIssue, issueReopened, issueWord, raisedIssue, sentBackEvent, sentBackWord, type OfficeWord } from './cameBack';
import { byPutForward } from './checkFix';

/**
 * The engineer's Issues tab opens on "Yours": on every site they work on, the
 * open issues that are theirs to see to, so at the end of the week they need not
 * pick through every trade's issues site by site.
 *
 * An issue is theirs when they raised it, when it is for their trade, or when
 * they have added to it. RELAY records the company fixing an issue, not a
 * person, so trade is the nearest it has to "assigned to me"; an engineer with
 * no trade set still gets what they raised or worked on.
 *
 * One put forward as fixed is waiting on the office, not on them, so it leaves
 * the list and is counted instead, with the list folded under the count
 * (newest put forward first) for when the engineer wants to see which. Anything the office sent back or wrote on
 * comes first, then the newest change.
 */
export interface YourIssue { issue: Issue; word?: OfficeWord | undefined; sentBack: boolean }
export interface YourSite { toDo: YourIssue[]; waiting: number; waitingIssues: Issue[] }
type Person = { id: string; name: string; trade?: string | undefined };

export function isYours(i: Issue, person: Person): boolean {
  if (!isOpenIssue(i)) return false;
  return raisedIssue(i, person.id) || (!!person.trade && i.affectedTrade === person.trade)
    || i.events.some(e => e.actorId ? e.actorId === person.id : e.actor === person.name);
}

export function yourIssues(issues: readonly Issue[], person: Person): YourSite {
  const mine = issues.filter(i => isYours(i, person));
  const toDo = mine.filter(i => i.work !== 'awaiting_verification')
    .map(issue => raisedIssue(issue, person.id)
      ? { issue, word: issueWord(issue.events, person), sentBack: issueReopened(issue.events, person) || issue.confirmation === 'disputed', at: issue.events.at(-1)?.at ?? issue.raisedAt }
      // Someone else's issue: only the office's reason on a fix sent back, while it stands (cameBack.ts `sentBackEvent`).
      : { issue, word: sentBackWord(issue.events, person), sentBack: !!sentBackEvent(issue.events, person) || issue.confirmation === 'disputed', at: issue.events.at(-1)?.at ?? issue.raisedAt })
    .sort((a, b) => Number(!!b.word || b.sentBack) - Number(!!a.word || a.sentBack) || b.at.localeCompare(a.at))
    .map(({ issue, word, sentBack }) => ({ issue, word, sentBack }));
  const waitingIssues = mine.filter(i => i.work === 'awaiting_verification').sort(byPutForward).reverse();
  return { toDo, waiting: waitingIssues.length, waitingIssues };
}

/**
 * Just after putting one forward as fixed: the issue now at the top of the same
 * site's "Yours" list, which is what the engineer would see going back to it,
 * and how many are left to do there.
 */
export function nextYourIssue(issues: readonly Issue[], person: Person, projectId: string, after: string): { next?: Issue; left: number } {
  const { toDo } = yourIssues(issues.filter(i => i.projectId === projectId && i.id !== after), person);
  return toDo[0] ? { next: toDo[0].issue, left: toDo.length } : { left: 0 };
}
