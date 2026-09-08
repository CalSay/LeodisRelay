import type { Principal, Session } from '@relay/platform';
import { isAdmin } from './access';
import { atomic, putRecord, records } from '../storage';
import { getReport } from '../serverStore';
import { randomUUID } from 'node:crypto';
export function assignLegacyDraft(actor:Principal,reportId:string,authorId:string) {
  if (!isAdmin(actor)) return {ok:false,status:403,reason:'Admin access required.'};
  return atomic(() => {
    const report = getReport(reportId);
    const owner = records<Session>('sessions').find(s => s.principal.id === authorId && s.principal.role && new Date(s.expiresAt).getTime() > Date.now())?.principal;
    if (!report || report.authorId || report.state !== 'draft' || !owner) return {ok:false,status:409,reason:'Only an unassigned legacy draft and a current account can be selected.'};
    putRecord('reports',{...report,authorId:owner.id,version:report.version+1});
    putRecord('audit',{id:randomUUID(),action:'legacy-draft-owner-assigned',actorId:actor.id,reportId:report.id,authorId:owner.id,previousAuthorLabel:report.author,at:new Date().toISOString()});
    return {ok:true,status:200};
  });
}
