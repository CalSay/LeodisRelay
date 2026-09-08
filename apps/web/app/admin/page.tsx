import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import { isAdmin } from '@/lib/auth/access';
import { INITIAL_ROSTER } from '@/lib/auth/roster';
import { records } from '@/lib/storage';
import type { Session } from '@relay/platform';
import LegacyDrafts from '@/components/LegacyDrafts';
import { listReports } from '@/lib/serverStore';
export const dynamic = 'force-dynamic';
export default async function Admin() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin');
  if (!isAdmin(p)) redirect('/');
  const users = [...new Map(records<Session>('sessions').filter(s => new Date(s.expiresAt).getTime() > Date.now() && s.principal.role).map(s => [s.principal.id,s.principal])).values()];
  const legacy = listReports().filter(r => r.state === 'draft' && !r.authorId).map(r => ({id:r.id,reference:r.reference,author:r.author}));
  return <main className="wrap">
    <div className="pagehead"><div><h1>Administration</h1><p className="sub">Team access and pilot oversight</p></div></div>
    <div className="btn-row"><Link className="btn-primary" href="/office">Open Office</Link><Link href="/projects">All projects</Link><a href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Manage Microsoft assignments</a></div>
    <h2>Team assignment checklist</h2><p>Set these app roles in Microsoft. This checklist does not grant access; sign-in uses the role Microsoft supplies.</p>
    <div style={{overflowX:'auto'}}><table className="team-table"><thead><tr><th scope="col">Account</th><th scope="col">Microsoft app role</th></tr></thead><tbody>{INITIAL_ROSTER.map(u => <tr key={u.email}><td>{u.email}</td><td>{u.assignment}</td></tr>)}</tbody></table></div>
    <h2>Signed-in team members</h2><p>Accounts with current RELAY sessions; this is not a live Microsoft directory listing. Assignment changes take effect on the next sign-in or session expiry (up to 12 hours).</p>
    <div className="reg">{users.map(u => <div className="row" key={u.id}><span className="row-main">{u.name}<br/>{u.email}</span><span>{u.role}{u.trade ? ` · ${u.trade}` : ''}</span></div>)}</div>
    <LegacyDrafts drafts={legacy} users={users.map(u => ({id:u.id,name:u.name,email:u.email}))} />
  </main>;
}
