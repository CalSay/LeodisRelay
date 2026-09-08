import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentPrincipal } from '@/lib/auth/session';
import { canManage, isAdmin } from '@/lib/auth/access';
import { database } from '@/lib/storage';
import type { ReportSummary } from '@/lib/types';
import ProjectsPage from '@/components/ProjectsPage';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin');
  if (isAdmin(p)) redirect('/admin');
  if (canManage(p)) redirect('/office');
  const drafts = database().prepare("SELECT summary FROM records WHERE kind='reports' AND state='draft' AND json_extract(data,'$.authorId')=? ORDER BY updated DESC LIMIT 5").all(p.id).map(r => JSON.parse(r.summary as string) as ReportSummary);
  return <><section className="wrap" aria-label="Your reports"><div className="pagehead"><div><h1>Site reporting</h1><p className="sub">{p.trade ? `${p.trade} Engineer` : 'Engineer'}</p></div></div>
    {drafts.length ? <><h2>Continue my report</h2><div className="reg">{drafts.map(r => <Link className="row" key={r.id} href={`/reports/${r.id}`}><span className="row-main">{r.reference} · {r.visitDate}</span><span>Continue →</span></Link>)}</div></> : <p>Choose a project below to start a report.</p>}
    </section><ProjectsPage /></>;
}
