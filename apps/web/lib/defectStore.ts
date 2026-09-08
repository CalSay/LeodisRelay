import {createHash} from 'node:crypto';
import type {Principal} from '@relay/platform';
import {canAccessProject} from './auth/access';
import {FIXTURE_PROJECTS} from './fixtures';
import {validateDefect,type DefectInput} from './defects';
import {atomic,database,getRecord,putRecord} from './storage';
import {putMedia} from './mediaStore';
import {MEDIA_LIMIT} from './media';
import type {Issue} from './types';

export class DefectError extends Error { constructor(message:string,readonly status=422){super(message);} }
export async function submitIndividualDefect(principal:Principal,input:DefectInput,files:{id:string;mime:string;bytes:Buffer}[]):Promise<Issue> {
  const invalid=validateDefect(input);if(invalid)throw new DefectError(invalid);
  const project=FIXTURE_PROJECTS.find(p=>p.id===input.projectId);
  if(!project||!['4. Active','5. Defects Liability'].includes(project.status))throw new DefectError('This project is not open for reporting.');
  if(!canAccessProject(principal,project.id))throw new DefectError('You cannot report on this project.',403);
  if(files.length!==input.photos.length || new Set(files.map(f=>f.id)).size!==files.length || input.photos.some(p=>!files.some(f=>f.id===p.id)))throw new DefectError('Attach the original photograph for each photo.');
  if(files.some(f=>!f.bytes.length||f.bytes.length>MEDIA_LIMIT)||files.reduce((n,f)=>n+f.bytes.length,0)>40*1024*1024)throw new DefectError('Use photos up to 20 MB each and 40 MB in total.',413);
  const id='iss-'+createHash('sha256').update(`${principal.id}:${input.requestId}`).digest('hex').slice(0,32);
  // Canonical fields only. A caller cannot supply authorship, state, owner or reference.
  const content={projectId:project.id,description:input.description.trim(),location:input.location.trim(),affectedTrade:input.affectedTrade,
    photos:input.photos.map(p=>({id:p.id,dataUrl:p.dataUrl,caption:p.caption,capturedAt:p.capturedAt}))};
  const digest=createHash('sha256').update(JSON.stringify({content,files:content.photos.map(p=>{const f=files.find(f=>f.id===p.id)!;return {id:f.id,mime:f.mime,digest:createHash('sha256').update(f.bytes).digest('hex')};})})).digest('hex');
  function receipt(){const saved=getRecord<{id:string;digest:string}>('defect-receipts',id);if(!saved)return;
    if(saved.digest!==digest)throw new DefectError('This submission was already received with different content.',409);
    const issue=getRecord<Issue>('issues',id);if(!issue)throw new DefectError('Submission receipt needs investigation.',409);return issue;}
  const existing=receipt();if(existing)return existing;
  // Media is private/unreadable until the issue is published. Never create a
  // visible placeholder issue that a failed upload could leave behind.
  for(const f of files){try{await putMedia(f.id,{ownerId:principal.id,issueId:id,mime:f.mime},f.bytes);}catch(e){throw new DefectError(e instanceof Error?e.message:'Photograph could not be stored.');}}
  return atomic(()=>{
    const repeated=receipt();if(repeated)return repeated;
    const sequence=Number(database().prepare("SELECT count(*) AS n FROM records WHERE kind='issues' AND project=?").get(project.id)!.n)+1;
    const at=new Date().toISOString();
    const issue:Issue={id,reference:`${project.projectNumber}-ISS-${String(sequence).padStart(3,'0')}`,projectId:project.id,
      description:content.description,location:content.location,affectedTrade:content.affectedTrade,source:'individual',
      reportedBy:principal.name,reportedById:principal.id,...(principal.trade?{reporterTrade:principal.trade}:{}),
      confirmation:'provisional',work:'open',owner:'',targetDate:'',actionNeeded:'',raisedByReport:'',raisedAt:at,
      events:[{at,actor:principal.name,actorId:principal.id,kind:'raised',note:content.description,photos:content.photos}]};
    putRecord('issues',issue);putRecord('defect-receipts',{id,digest});return issue;
  });
}
