import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/auth/access';
import { runReadChecks } from '@/lib/sharepoint/check';
export const dynamic = 'force-dynamic';
/** Read-only connection check. Every Graph call is a GET; nothing in SharePoint changes. */
export async function POST() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!isAdmin(guard.principal)) return NextResponse.json({reason:'Admin access required.'},{status:403});
  try { return NextResponse.json(await runReadChecks(), {headers:{'cache-control':'no-store'}}); }
  catch { return NextResponse.json({reason:'The connection check could not run. Check the SharePoint configuration.'},{status:500}); }
}
