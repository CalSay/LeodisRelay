import type { DraftSignature, Observation, Report } from './types';
import { clientId } from './clientId';

export interface SaveRequest {
  requestId:string; expectedVersion:number; observations:Observation[];
  /** Null clears it. Requests journalled before signatures were saved have none, and leave it alone. */
  signature?:DraftSignature | null;
}
export interface SaveJournal {
  /** Atomically retain an existing request, or persist the supplied request. */
  claim(request:SaveRequest):Promise<SaveRequest>;
  acknowledge(requestId:string,version:number):Promise<void>;
  /** Drop a request the server has definitely refused, so it is not replayed. */
  discard?(requestId:string):Promise<void>;
}

/**
 * The server refused a save because the draft was saved elsewhere first.
 * `current` is the draft as the server now holds it, for comparing.
 */
export class SaveConflict extends Error {
  readonly current:Report;
  constructor(message:string,current:Report) { super(message); this.current = current; }
}
/** Replay an uncertain request before sending later edits. Never change its payload. */
export async function saveWithJournal(
  report:Report,expectedVersion:number,journal:SaveJournal,
  send:(request:SaveRequest)=>Promise<Report>,
):Promise<Report> {
  const desired = report.observations;
  const signature = report.draftSignature ?? null;
  let version = expectedVersion;
  for (;;) {
    const offered:SaveRequest = {requestId:clientId(),expectedVersion:version,observations:desired,signature};
    const request = await journal.claim(offered);
    let saved:Report;
    try { saved = await send(request); }
    catch (error) {
      // A conflict is a definite answer, not a lost receipt: replaying the same
      // request would only be refused again. The edits themselves stay on screen
      // and in the device's held copy until the person chooses what to keep.
      if (error instanceof SaveConflict && journal.discard) {
        await journal.discard(request.requestId);
        // An older request left from before a reload was refused: the work on
        // screen supersedes it, so ask about that instead.
        if (request.requestId !== offered.requestId) continue;
      }
      throw error;
    }
    await journal.acknowledge(request.requestId,saved.version);
    if (JSON.stringify(request.observations) === JSON.stringify(desired)
      && JSON.stringify(request.signature ?? null) === JSON.stringify(signature)) return saved;
    version = saved.version;
  }
}
