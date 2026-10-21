import type { Issue } from './types';
import { isOpenIssue, issueReopened, issueWord, raisedIssue, type OfficeWord } from './cameBack';

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
 * the list and is counted instead. Anything the office sent back or wrote on
 * comes first, then the newest change.
 */
export interface YourIssue { issue: Issue; word?: OfficeWord | undefined; sentBack: boolean }
export interface YourSite { toDo: YourIssue[]; waiting: number }
type Person = { id: string; name: string; trade?: string | undefined };

export function isYours(i: Issue, person: Person): boolean {
  if (!isOpenIssue(i)) return false;
  return raisedIssue(i, person.id) || (!!person.trade && i.affectedTrade === person.trade)
    || i.events.some(e => e.actorId ? e.actorId === person.id : e.actor === person.name);
}

export function yourIssues(issues: readonly Issue[], person: Person): YourSite {
  const mine = issues.filter(i => isYours(i, person));
  const toDo = mine.filter(i => i.work !== 'awaiting_verification')
    .map(issue => ({ issue, word: issueWord(issue.events, person), sentBack: issueReopened(issue.events, person) || issue.confirmation === 'disputed', at: issue.events.at(-1)?.at ?? issue.raisedAt }))
    .sort((a, b) => Number(!!b.word || b.sentBack) - Number(!!a.word || a.sentBack) || b.at.localeCompare(a.at))
    .map(({ issue, word, sentBack }) => ({ issue, word, sentBack }));
  return { toDo, waiting: mine.length - toDo.length };
}
