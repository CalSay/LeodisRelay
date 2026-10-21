import { refreshIssues, IssueSyncError } from '@/lib/sharepoint/issues';
import { jsonResponse } from '@/lib/jsonResponse';
import { NextResponse } from "next/server";
import { issueRegister, listIssues, openIssues } from "@/lib/issueStore";
import { parseIssueQuery } from '@/lib/issueQuery';
import { requireSession } from "@/lib/auth/guard";
import { canAccessProject } from '@/lib/auth/access';
import { deskIssue } from '@/lib/officeActions';
import {DEFECT_BODY_LIMIT,type DefectInput} from '@/lib/defects';
import {DefectError,submitIndividualDefect} from '@/lib/defectStore';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  try { await refreshIssues(); } catch { return NextResponse.json({reason:'SharePoint issues could not be refreshed. Please retry.'},{status:503}); }
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const only = url.searchParams.get("only");
  // The register asks for one page at a time; older callers still get every issue.
  if (url.searchParams.get("register") === "1") {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    return jsonResponse(request, issueRegister(guard.principal, parseIssueQuery(url.searchParams), day));
  }
  // The office desk's snapshot: every issue this person may see, each with its latest event only.
  if (url.searchParams.get("view") === "desk") {
    return jsonResponse(request, { issues: listIssues(projectId).filter(i=>canAccessProject(guard.principal,i.projectId)).map(deskIssue) });
  }
  if (projectId && only === "open") {
    return jsonResponse(request, { issues: openIssues(projectId).filter(i=>canAccessProject(guard.principal,i.projectId)) });
  }
  return jsonResponse(request, { issues: listIssues(projectId).filter(i=>canAccessProject(guard.principal,i.projectId)) });
}

export async function POST(request:Request){
  const guard=await requireSession();if(!guard.ok)return guard.response;
  try {
    // Bound the stream before parsing multipart, including chunked requests.
    const reader=request.body?.getReader();if(!reader)throw new DefectError('Defect details are required.');
    let length=0;const chunks:Uint8Array[]=[];
    for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>DEFECT_BODY_LIMIT){await reader.cancel();throw new DefectError('Upload exceeds 42 MB.',413);}chunks.push(value);}
    const form=await new Response(Buffer.concat(chunks),{headers:{'content-type':request.headers.get('content-type')??''}}).formData();
    const input=JSON.parse(String(form.get('defect'))) as DefectInput;
    const files=[];
    for(const [id,value] of form.entries()){if(id==='defect')continue;if(typeof value==='string')throw new DefectError('Invalid attachment.');files.push({id,mime:value.type,bytes:Buffer.from(await value.arrayBuffer())});}
    return NextResponse.json(await submitIndividualDefect(guard.principal,input,files),{status:201});
  }catch(e){return NextResponse.json({reason:e instanceof DefectError?e.message:'The defect could not be received. Retry the same submission.'},{status:e instanceof DefectError?e.status:400});}
}
