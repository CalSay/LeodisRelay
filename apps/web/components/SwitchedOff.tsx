import Link from 'next/link';
import { SAFETY_RECORDS_NAME } from '@/lib/featureSwitch';
import { backLabel, safeViewReturn } from '@/lib/viewNavigation';

/**
 * A page behind the office's switch while it is off (lib/featureSwitch.ts):
 * an old link or bookmark lands here, says plainly why, and offers a way back.
 */
export function SwitchedOff({ page, returnTo, admin }: { page: string; returnTo?: string; admin: boolean }) {
  const back = safeViewReturn(returnTo, '/');
  return <main className="wrap eng-page problem-page">
    <p className="problem-kicker">SWITCHED OFF</p>
    <h1>{page} is not in use.</h1>
    <p>{SAFETY_RECORDS_NAME} are switched off for Leodis Developments, so RELAY keeps to site reports, issues and variations. Nothing recorded before has been deleted.</p>
    <p>{admin ? 'You can turn them on from the Admin tab, under Site records.' : 'If you need them, ask the office.'}</p>
    <div className="problem-actions">
      <Link href={back} className="problem-go">{back === '/' ? 'Go to your home page' : backLabel(back)}</Link>
      {admin && <Link href="/admin#/admin/features">Open Site records on the Admin tab</Link>}
    </div>
  </main>;
}
