import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {submitIndividualDefect} from '../lib/defectStore';
import {listIssues,applyCommand} from '../lib/issueStore';
import {createReport,getReport} from '../lib/serverStore';
import {database} from '../lib/storage';
import type {Principal} from '@relay/platform';
import type {DefectInput} from '../lib/defects';

test('individual defects preserve attribution, media ownership and report independence; retries are idempotent',async()=>{
  const root=mkdtempSync(join(tmpdir(),'relay-defect-test-'));
  process.env.RELAY_DATA_ROOT=root;process.env.RELAY_MEDIA_ROOT=join(root,'media');
  const actor:Principal={id:'entra:engineer' as Principal['id'],oid:'engineer',name:'Engineer',email:'engineer@example.test',role:'Engineer',trade:'Electrical'};
  try{
    const report=createReport('proj-011lme',actor.name,actor);
    const photoId=randomUUID(),bytes=await sharp({create:{width:10,height:10,channels:3,background:'#886633'}}).png().toBuffer();
    const files=[{id:photoId,mime:'image/png',bytes}];
    const input:DefectInput={requestId:randomUUID(),projectId:report.projectId,description:'Missing duct support',location:'Corridor',affectedTrade:'HVAC',photos:[{id:photoId,dataUrl:`/api/media/${photoId}`,caption:'',capturedAt:new Date().toISOString()}]};
    const first=await submitIndividualDefect(actor,input,files);
    assert.equal(first.source,'individual');assert.equal(first.raisedByReport,'');assert.equal(first.reportedById,actor.id);assert.equal(first.reporterTrade,'Electrical');assert.equal(first.affectedTrade,'HVAC');assert.equal(first.work,'open');assert.equal(first.confirmation,'provisional');
    assert.deepEqual(getReport(report.id),report,'Creating a defect must not alter or submit a report');
    const retries=await Promise.all([submitIndividualDefect(actor,input,files),submitIndividualDefect(actor,input,files)]);
    assert.ok(retries.every(i=>i.id===first.id));assert.equal(listIssues().length,1);assert.equal(retries[0].events.length,1);
    await assert.rejects(submitIndividualDefect(actor,{...input,description:'Changed payload'},files),/different content/);
    await assert.rejects(submitIndividualDefect(actor,{...input,requestId:randomUUID(),photos:[]},[]),/photographs/);
    await assert.rejects(submitIndividualDefect(actor,{...input,requestId:randomUUID(),affectedTrade:'invalid' as never},files),/trade/);
    await assert.rejects(submitIndividualDefect(actor,{...input,requestId:randomUUID(),projectId:'unknown'},files),/not open/);
    await assert.rejects(submitIndividualDefect({...actor,id:'entra:other' as Principal['id']},{...input,requestId:randomUUID()},files),/another upload/);
    const badPhoto=randomUUID();
    await assert.rejects(submitIndividualDefect(actor,{...input,requestId:randomUUID(),photos:[{...input.photos[0]!,id:badPhoto,dataUrl:`/api/media/${badPhoto}`}]},[{id:badPhoto,mime:'image/png',bytes:Buffer.from('not a photo')}]),/supported photograph/);
    assert.equal(listIssues().length,1,'Invalid or failed uploads must not publish issues');
    assert.ok(applyCommand(first.id,{kind:'progress',actor:actor.name,actorId:actor.id,note:'Repair underway'}).ok);
    assert.ok(applyCommand(first.id,{kind:'submit_closure',actor:actor.name,actorId:actor.id,note:'Repair complete'}).ok);
    assert.equal(applyCommand(first.id,{kind:'verify',actor:actor.name,actorId:actor.id,note:'Self verification'}).ok,false);
    assert.ok(applyCommand(first.id,{kind:'verify',actor:'Manager',actorId:'entra:manager',note:'Checked on site'}).ok);
    const afterWork=await submitIndividualDefect(actor,input,files);
    assert.equal(afterWork.work,'closed','Retry cannot reset subsequent issue work');
  }finally{database().close();rmSync(root,{recursive:true,force:true});}
});
