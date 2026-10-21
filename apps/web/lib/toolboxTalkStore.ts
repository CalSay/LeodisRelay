import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord, records } from './storage';
import { canManage } from './auth/access';
import { cleanTalk, projectTalks, talkProblem, withdrawProblem, type ProjectTalks, type ToolboxTalk, type ToolboxTalkInput } from './toolboxTalks';
import { londonDay } from './weeklySummary';

/**
 * Toolbox talks in the local store, kind `toolbox-talks`. RELAY's own record:
 * nothing here is written to SharePoint or sent anywhere. Rules in
 * `toolboxTalks.ts`.
 */

const KIND = 'toolbox-talks';
const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TalkOutcome = { ok: true; value: ToolboxTalk } | { ok: false; status: number; reason: string };

const sameTalk = (a: ToolboxTalkInput, b: ToolboxTalk) => a.day === b.day && a.topic === b.topic && a.givenBy === b.givenBy
  && (a.notes ?? '') === (b.notes ?? '') && a.attendees.join('\n') === b.attendees.join('\n');

/**
 * Keep one talk on a project, recorded by whoever is signed in.
 * `requestId` is the form's own id, so a retry after a lost reply returns the
 * first save rather than keeping the talk twice; the same id with different
 * details is refused.
 */
export function recordTalk(input: ToolboxTalkInput & { projectId: string; requestId: string }, principal: Principal, now = new Date()): TalkOutcome {
  if (!REQUEST.test(input.requestId)) return { ok: false, status: 422, reason: 'Invalid request.' };
  return atomic(() => {
    const id = `talk-${input.requestId.toLowerCase()}`;
    const talk = cleanTalk(input);
    const previous = getRecord<ToolboxTalk>(KIND, id);
    if (previous) {
      const same = previous.byId === principal.id && previous.projectId === input.projectId && sameTalk(talk, previous);
      return same ? { ok: true, value: previous } : { ok: false, status: 409, reason: 'This talk was already saved with different details. Reload the page.' };
    }
    const problem = talkProblem(talk, londonDay(now));
    if (problem) return { ok: false, status: 422, reason: problem };
    const kept: ToolboxTalk = { id, projectId: input.projectId, ...talk, by: principal.name, byId: principal.id, at: now.toISOString() };
    putRecord(KIND, kept);
    return { ok: true, value: kept };
  });
}

/** Whoever recorded the talk, or the office, may withdraw it. */
export function canWithdraw(talk: ToolboxTalk, principal: Principal): boolean {
  return talk.byId === principal.id || canManage(principal);
}

/**
 * Withdraw a talk recorded by mistake, with the reason. It stays on the page
 * and in the spreadsheet, marked withdrawn, and is left out of the counts.
 * Withdrawing one already withdrawn returns it unchanged.
 */
export function withdrawTalk(id: string, reason: string, principal: Principal, now = new Date()): TalkOutcome {
  return atomic(() => {
    const talk = getRecord<ToolboxTalk>(KIND, id);
    if (!talk) return { ok: false, status: 404, reason: 'No such toolbox talk.' };
    if (talk.withdrawn) return { ok: true, value: talk };
    if (!canWithdraw(talk, principal)) return { ok: false, status: 403, reason: 'Only whoever recorded this talk, or the office, can withdraw it.' };
    const problem = withdrawProblem(reason);
    if (problem) return { ok: false, status: 422, reason: problem };
    const next: ToolboxTalk = { ...talk, withdrawn: { by: principal.name, byId: principal.id, at: now.toISOString(), reason: reason.replace(/\s+/g, ' ').trim() } };
    putRecord(KIND, next);
    return { ok: true, value: next };
  });
}

export function getTalk(id: string): ToolboxTalk | undefined { return getRecord<ToolboxTalk>(KIND, id); }

export function talksFor(projectId: string, now = new Date()): ProjectTalks {
  return projectTalks(records<ToolboxTalk>(KIND, projectId), projectId, londonDay(now));
}
