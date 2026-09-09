import { OfficeDesk } from '@/components/developments/office/OfficeDesk';

export const dynamic = 'force-dynamic';

/**
 * The Developments office. The layout has already required a Manager or
 * Admin; the desk routes by hash from here (Projects › Register › Details,
 * Inbox, Issues, Team, and Admin for the Admin role).
 */
export default function OfficePage() {
  return <OfficeDesk fallback="#/projects" />;
}
