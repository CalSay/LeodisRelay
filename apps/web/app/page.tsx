import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COMPANY_COOKIE, rememberedCompany } from '@/lib/company';
import { currentPrincipal } from '@/lib/auth/session';
import Link from 'next/link';
import { EntryFrame, EntryArrow } from '@/components/EntryFrame';
export const dynamic = 'force-dynamic';
export default async function CompanyHub({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const fromApp = (await searchParams).open === 'app';
  const p = await currentPrincipal();
  if (!p) redirect(fromApp ? '/signin?returnTo=%2F%3Fopen%3Dapp' : '/signin');
  // Opened from the home screen icon: straight to the company picked last time.
  // Compliance is not open yet (Release 1), so a phone that picked it before is asked again.
  if (fromApp) {
    const company = rememberedCompany((await cookies()).get(COMPANY_COOKIE)?.value);
    if (company === 'developments') redirect(`/${company}`);
  }
  return <EntryFrame signedIn><div className="entry-hub">
    <h1 className="entry-hub-title">Select your company</h1>
    <div className="entry-hub-grid">
      <div className="entry-mast"><strong>One<br /> Leodis.</strong><small>TWO COMPANIES.<br />ONE CONNECTION.</small></div>
      <div>
        <Link href="/developments" prefetch={false} className="entry-company" aria-label="Enter Leodis Developments Ltd"><span><small>LEODIS</small><span className="entry-company-name">Developments<em>LIMITED</em></span></span><EntryArrow /></Link>
        {/* Not in Release 1: its screens run on invented records, so it is shown but not opened. Put the link back to open it. */}
        <div className="entry-company entry-company-compliance entry-company-later"><span><small>LEODIS</small><span className="entry-company-name">Compliance<br />Management<em>LIMITED</em></span></span><span className="entry-later">Coming later</span></div>
      </div>
    </div>
  </div></EntryFrame>;
}
