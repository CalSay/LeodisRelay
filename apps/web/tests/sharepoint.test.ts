import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphClient, GraphError, graph, retryAfter } from '../lib/sharepoint/graph';
import { assertProjectWrite, OPERATIONS } from '../lib/sharepoint/config';
import { projectIdentity, reportableProject } from '../lib/projects';
import { atomic, getRecord, putRecord, database } from '../lib/storage';
import { fieldsEqual, saveIssue, sendIssueOperation } from '../lib/sharepoint/issues';
import type { Issue } from '../lib/types';

process.env.RELAY_DATA_ROOT = mkdtempSync(join(tmpdir(), 'relay-sharepoint-'));
process.env.ENTRA_TENANT_ID = '1431dac1-21c1-4c06-959a-9a437f51401c';
process.env.ENTRA_CLIENT_ID = 'test-client';
process.env.ENTRA_CLIENT_SECRET = 'test-only-secret';
const originalRequest = graph.request;
const originalItems = graph.items;
const originalByKey = graph.byKey;
const originalTransfer = graph.transfer;
afterEach(() => {
  process.env.RELAY_SHAREPOINT_MODE = 'off';
  delete process.env.RELAY_SHAREPOINT_PROJECT_IDS;
  delete process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS;
  delete process.env.RELAY_SHAREPOINT_WRITE_PROJECT_IDS;
  graph.request = originalRequest; graph.items = originalItems; graph.byKey = originalByKey;
  graph.transfer = originalTransfer;
});
const json = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(data), { status, ...(headers ? {headers} : {}) });
test('Graph follows every page and caches an app-only token', async () => {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  const client = new GraphClient((async (input, init) => {
    const url = String(input); calls.push({url, init});
    if (url.includes('/oauth2/')) return json({access_token:'test-token', expires_in:3600});
    if (url.endsWith('second')) return json({value:[{id:'2'}]});
    return json({value:[{id:'1'}], '@odata.nextLink':'https://graph.microsoft.com/v1.0/second'});
  }) as typeof fetch);
  assert.deepEqual(await client.all('/first'), [{id:'1'},{id:'2'}]);
  assert.equal(calls.filter(c => c.url.includes('/oauth2/')).length, 1);
  assert.equal(new Headers(calls[1]!.init?.headers).get('Authorization'), 'Bearer test-token');
  assert.ok(calls.every(c => c.init?.redirect === 'error'));
});
test('an untrusted nextLink cannot receive a token', async () => {
  let calls = 0;
  const client = new GraphClient((async (input) => { calls++; return String(input).includes('/oauth2/') ? json({access_token:'test-token',expires_in:3600}) : json({value:[], '@odata.nextLink':'https://attacker.invalid/steal'}); }) as typeof fetch);
  await assert.rejects(client.all('/first'), /untrusted Graph URL/);
  assert.equal(calls,2);
});
test('read mode rejects writes before acquiring credentials', async () => {
  process.env.RELAY_SHAREPOINT_MODE='read';
  const client = new GraphClient((async () => {throw Error('Must not call network');}) as typeof fetch);
  await assert.rejects(client.request('/sites/test', {method:'POST', body:'{}'}), /read-only/);
  assert.throws(() => assertProjectWrite('1'));
});
test('writes require explicit SharePoint item IDs and fail closed without scope', () => {
  process.env.RELAY_SHAREPOINT_MODE='write';
  assert.throws(() => assertProjectWrite('1'));
  process.env.RELAY_SHAREPOINT_PROJECT_IDS='7';
  assert.throws(() => assertProjectWrite('1'));
  assert.doesNotThrow(() => assertProjectWrite('7'));
  process.env.RELAY_SHAREPOINT_PROJECT_IDS='011LME';
  assert.throws(() => assertProjectWrite('011LME'), /item IDs/);
});
test('Retry-After supports seconds and HTTP dates without discarding service delays', async () => {
  assert.equal(retryAfter('300'),300000);
  assert.equal(retryAfter('Sun, 13 Sep 2026 20:05:00 GMT', Date.parse('2026-09-13T20:00:00Z')),300000);
  const client = new GraphClient((async input => String(input).includes('/oauth2/') ? json({access_token:'test-token',expires_in:3600}) : json({},429,{'Retry-After':'300'})) as typeof fetch);
  await assert.rejects(client.request('/sites/test'), e => e instanceof GraphError && e.status === 429 && e.retryAfterMs === 300000);
});
test('project identity uses item IDs rather than duplicated project numbers', () => {
  assert.notEqual(projectIdentity('7'),projectIdentity('8'));
  assert.equal(projectIdentity('7'),projectIdentity('7'));
  process.env.RELAY_SHAREPOINT_PROJECT_IDS='7';
  const project = {id:projectIdentity('7'),projectNumber:'011LME',projectName:'Test',clientName:'Client',clientAccountNumber:'',division:'M&E',status:'4. Active',projectManager:'',projectManagerEmail:'',reviewRequired:false,source:{siteId:OPERATIONS.site,listId:OPERATIONS.projects,itemId:'7'}};
  assert.equal(reportableProject(project),true);
  assert.equal(reportableProject({...project,status:'1. Tender'}),false);
  assert.equal(reportableProject({...project,projectNumber:''}),false);
  assert.equal(reportableProject({...project,tombstoned:true}),false);
  process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS='8';
  assert.equal(reportableProject(project),false);
  process.env.RELAY_SHAREPOINT_READ_PROJECT_IDS='7';
  assert.equal(reportableProject(project),true);
});
test('readback comparison normalizes SharePoint lookups, dates, empty fields and hyperlink objects', () => {
  assert.equal(fieldsEqual({ProjectLookupId:7,VisitDate:'2026-09-13T23:00:00Z',PdfLink:{Url:'https://example.com/a'}},{ProjectLookupId:'7',VisitDate:'2026-09-14',Location:'',PdfLink:'https://example.com/a'}),true);
  assert.equal(fieldsEqual({Target_x0020_Date:'2026-12-14T00:00:00Z'},{Target_x0020_Date:'2026-12-14'}),true);
  assert.equal(fieldsEqual({ReceivedAt:'2026-09-14T10:32:19Z'},{ReceivedAt:'2026-09-14T10:32:19.987Z'}),true);
  assert.equal(fieldsEqual({Raised_x0020_At:'2026-09-14T10:32:19Z'},{Raised_x0020_At:'2026-09-14T10:32:20.001Z'}),false);
  assert.equal(fieldsEqual({Work_x0020_Status:'Closed'},{Work_x0020_Status:'Open'}),false);
});
function prepareIssue(): Issue {
  process.env.RELAY_SHAREPOINT_MODE='write'; process.env.RELAY_SHAREPOINT_PROJECT_IDS='7';
  const projectId=projectIdentity('7');
  putRecord('projects',{id:projectId,projectNumber:'011LME',source:{siteId:OPERATIONS.site,listId:OPERATIONS.projects,itemId:'7'}});
  putRecord('identities',{id:'actor',email:'actor@example.invalid'});
  return {id:'iss-test',projectId,reference:'DEMO-ISS-001',reportedById:'actor',location:'Test',description:'Test issue',actionNeeded:'Inspect',confirmation:'provisional',work:'open',owner:'',targetDate:'',raisedByReport:'',raisedAt:'2026-09-13T20:00:00Z',events:[]};
}
test('pending operations commit atomically and block conflicting local edits', () => {
  const issue=prepareIssue();
  atomic(() => saveIssue(issue));
  const saved=getRecord<Issue>('issues',issue.id)!;
  assert.equal(saved.sync?.status,'pending');
  assert.ok(database().prepare('SELECT id FROM jobs WHERE id=?').get(saved.sync!.operationId!));
  assert.throws(() => atomic(() => saveIssue({...saved,description:'Another edit'})), /outstanding/);
  assert.equal(getRecord<Issue>('issues',issue.id)!.description,'Test issue');
  const second={...issue,id:'iss-rollback',sync:undefined};
  assert.throws(() => atomic(() => {saveIssue(second);throw Error('rollback');}));
  assert.equal(getRecord('issues',second.id),undefined);
});
test('lost create response is recovered by stable identity without a second write; external edits conflict', async () => {
  const issue=prepareIssue();
  let writes=0;
  graph.request = (async (path: string) => {
    if(path.includes('/lists?'))return {value:[{id:'users',displayName:'User Information List'}]};
    writes++; throw Error('Unexpected write');
  }) as typeof graph.request;
  graph.items = async () => [{id:'11',eTag:'u1',fields:{Title:'Actor',EMail:'actor@example.invalid'}}];
  const { issueFields } = await import('../lib/sharepoint/issues');
  const desired=await issueFields(issue);
  graph.byKey = async () => ({id:'42',eTag:'"v2"',fields:desired});
  putRecord('issues',{...issue,sync:{status:'pending',operationId:'op'}});
  await sendIssueOperation({issue},'op');
  assert.equal(writes,0);
  assert.equal(getRecord<Issue>('issues',issue.id)!.sync?.status,'synced');
  graph.byKey = async () => ({id:'42',eTag:'"v3"',fields:{...desired,Description:'Changed in SharePoint'}});
  await assert.rejects(sendIssueOperation({issue,itemId:'42',baseEtag:'"v2"'},'op'),e=>e instanceof GraphError && e.status===412);
  assert.equal(writes,0);
});
test('a retained false conflict reconciles only when SharePoint already matches the original operation', async () => {
  const issue=prepareIssue();
  const { issueFields } = await import('../lib/sharepoint/issues');
  const desired=await issueFields(issue);
  putRecord('issues',{...issue,sync:{status:'conflict',operationId:'op',error:'SharePoint changed this record.'}});
  graph.byKey = async () => ({id:'42',eTag:'"v2"',fields:desired});
  graph.request = (async () => { throw Error('A matching remote row must not be overwritten'); }) as typeof graph.request;
  await sendIssueOperation({issue},'op');
  assert.equal(getRecord<Issue>('issues',issue.id)!.sync?.status,'synced');

  putRecord('issues',{...issue,sync:{status:'conflict',operationId:'op2',error:'SharePoint changed this record.'}});
  graph.byKey = async () => ({id:'42',eTag:'"v3"',fields:{...desired,Description:'A genuine external edit'}});
  await assert.rejects(sendIssueOperation({issue},'op2'),e=>e instanceof GraphError && e.status===412);
  assert.equal(getRecord<Issue>('issues',issue.id)!.sync?.status,'conflict');
});
test('filing retries reuse and verify exact stored PDF bytes without replacing existing files', async () => {
  prepareIssue();
  process.env.RELAY_SHAREPOINT_ARCHIVE_FOLDERS = JSON.stringify({'7':{driveId:'drive',itemId:'folder'}});
  const { fileReport } = await import('../lib/sharepoint/reports');
  const { ensurePdf } = await import('../lib/pdfArtifacts');
  const report = {id:'rep-file-test',projectId:projectIdentity('7'),reference:'DEMO-011-SPR-001',revision:1,state:'submitted',version:1} as import('../lib/types').Report;
  await ensurePdf(report,async()=>Buffer.from('exact frozen PDF'));
  let writes=0;
  graph.request = (async (path:string,init?:RequestInit) => {
    if(init?.method){writes++;throw Error('Must not overwrite existing file');}
    if(path.endsWith('/folder'))return {id:'folder',folder:{}};
    return {id:'file',size:16,webUrl:'https://leodisdevelopments.sharepoint.com/file.pdf','@microsoft.graph.downloadUrl':'https://leodisdevelopments.sharepoint.com/download'};
  }) as typeof graph.request;
  graph.transfer = async()=>new Response(Buffer.from('exact frozen PDF'));
  const receipt = await fileReport(report);
  assert.equal(receipt.itemId,'file'); assert.equal(writes,0);
  assert.equal((await fileReport(report)).digest,receipt.digest);assert.equal(writes,0);
  graph.transfer = async()=>new Response(Buffer.from('modified PDF!!!!'));
  await assert.rejects(fileReport(report),/different PDF/);assert.equal(writes,0);
});
test('new PDF upload sessions use SharePoint conflict defaults without rejected optional metadata', async () => {
  prepareIssue();
  process.env.RELAY_SHAREPOINT_MODE = 'write';
  process.env.RELAY_SHAREPOINT_WRITE_PROJECT_IDS = '7';
  process.env.RELAY_SHAREPOINT_ARCHIVE_FOLDERS = JSON.stringify({'7':{driveId:'drive',itemId:'folder'}});
  const { fileReport } = await import('../lib/sharepoint/reports');
  const { ensurePdf } = await import('../lib/pdfArtifacts');
  const report = {id:'rep-new-file-test',projectId:projectIdentity('7'),reference:'DEMO-011-SPR-002',revision:1,state:'submitted',version:1} as import('../lib/types').Report;
  const bytes = Buffer.from('new frozen PDF');
  await ensurePdf(report,async()=>bytes);
  let lookupCount = 0;
  graph.request = (async (path:string,init?:RequestInit) => {
    if(path.endsWith('/folder'))return {id:'folder',folder:{}};
    if(path.endsWith('/createUploadSession')) {
      assert.equal(init?.method,'POST');
      assert.equal(init?.body,undefined);
      return {uploadUrl:'https://leodisdevelopments.sharepoint.com/upload'};
    }
    if(++lookupCount === 1)throw new GraphError(404);
    return {id:'new-file',size:bytes.length,webUrl:'https://leodisdevelopments.sharepoint.com/new.pdf','@microsoft.graph.downloadUrl':'https://leodisdevelopments.sharepoint.com/download'};
  }) as typeof graph.request;
  graph.transfer = async (url,init) => url.endsWith('/upload')
    ? (assert.equal(init?.method,'PUT'),new Response(null,{status:201}))
    : new Response(bytes);
  const receipt = await fileReport(report);
  assert.equal(receipt.itemId,'new-file');
});
test('unknown transfer hosts are refused before any preauthenticated upload', async()=>{
  process.env.RELAY_SHAREPOINT_MODE='write';
  const client = new GraphClient((async()=>{throw Error('No network');}) as typeof fetch);
  await assert.rejects(client.transfer('https://attacker.invalid/upload',{method:'PUT'}),/Unexpected SharePoint transfer host/);
});
