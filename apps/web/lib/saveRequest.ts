import type { Observation, Report } from './types';
import { clientId } from './clientId';

export interface SaveRequest { requestId:string; expectedVersion:number; observations:Observation[] }
export interface SaveJournal {
  /** Atomically retain an existing request, or persist the supplied request. */
  claim(request:SaveRequest):Promise<SaveRequest>;
  acknowledge(requestId:string,version:number):Promise<void>;
}
/** Replay an uncertain request before sending later edits. Never change its payload. */
export async function saveWithJournal(
  report:Report,expectedVersion:number,journal:SaveJournal,
  send:(request:SaveRequest)=>Promise<Report>,
):Promise<Report> {
  const desired = report.observations;
  let version = expectedVersion;
  for (;;) {
    const request = await journal.claim({requestId:clientId(),expectedVersion:version,observations:desired});
    const saved = await send(request);
    await journal.acknowledge(request.requestId,saved.version);
    if (JSON.stringify(request.observations) === JSON.stringify(desired)) return saved;
    version = saved.version;
  }
}
