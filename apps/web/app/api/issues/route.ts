import { NextResponse } from "next/server";
import { listIssues, openIssues } from "@/lib/issueStore";
import { requireSession } from "@/lib/auth/guard";
import { canAccessProject } from '@/lib/auth/access';
import {DEFECT_BODY_LIMIT,type DefectInput} from '@/lib/defects';
import {DefectError,submitIndividualDefect} from '@/lib/defectStore';

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const only = url.searchParams.get("only");
  if (projectId && only === "open") {
    return NextResponse.json({ issues: openIssues(projectId).filter(i=>canAccessProject(guard.principal,i.projectId)) });
  }
  return NextResponse.json({ issues: listIssues(projectId).filter(i=>canAccessProject(guard.principal,i.projectId)) });
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
