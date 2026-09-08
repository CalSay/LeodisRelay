import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';
import Link from 'next/link';
import { EntryFrame, EntryArrow } from '@/components/EntryFrame';
export const dynamic = 'force-dynamic';
export default async function CompanyHub() {
  const p = await currentPrincipal();
  if (!p) redirect('/signin');
  return <EntryFrame signedIn><div className="entry-hub">
    <h1 className="entry-hub-title">Select your company</h1>
    <div className="entry-hub-grid">
      <div className="entry-mast"><strong>One<br /> Leodis.</strong><small>TWO COMPANIES.<br />ONE CONNECTION.</small></div>
      <div>
        <Link href="/developments" className="entry-company" aria-label="Enter Leodis Developments Ltd"><span><small>LEODIS</small><span className="entry-company-name">Developments<em>LIMITED</em></span></span><EntryArrow /></Link>
        <Link href="/compliance" className="entry-company entry-company-compliance" aria-label="Enter Leodis Compliance Management Ltd"><span><small>LEODIS</small><span className="entry-company-name">Compliance<br />Management<em>LIMITED</em></span></span><EntryArrow /></Link>
      </div>
    </div>
  </div></EntryFrame>;
}
