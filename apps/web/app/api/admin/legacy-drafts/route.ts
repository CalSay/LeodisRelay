import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { assignLegacyDraft } from '@/lib/auth/legacyDrafts';
export async function POST(request:Request) {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  const body = await request.json().catch(() => null);
  if (!body || typeof body.reportId !== 'string' || typeof body.authorId !== 'string') return NextResponse.json({reason:'Choose a report and account.'},{status:422});
  const result = assignLegacyDraft(guard.principal,body.reportId,body.authorId);
  return NextResponse.json(result,{status:result.status});
}
