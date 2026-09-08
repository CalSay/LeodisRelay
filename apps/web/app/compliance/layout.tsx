import './compliance.css';
import { redirect } from 'next/navigation';
import { currentPrincipal } from '@/lib/auth/session';

/** Compliance Management workspace. Signed in only; each screen applies its own role check. */
export default async function ComplianceLayout({ children }: { children: React.ReactNode }) {
  if (!await currentPrincipal()) redirect('/signin?returnTo=%2Fcompliance');
  return children;
}
