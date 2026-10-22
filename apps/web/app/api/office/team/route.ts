import { sharePointMode } from '@/lib/sharepoint/config';
import { NextResponse } from 'next/server';
import type { Session } from '@relay/platform';
import { requireSession } from '@/lib/auth/guard';
import { canManage, isAdmin } from '@/lib/auth/access';
import { peopleChecklist, type PersonLogEntry } from '@/lib/people';
import { database, getRecord, records } from '@/lib/storage';
import { listReports } from '@/lib/serverStore';
import { latestOf, latestSentByAuthor, sentThisWeekByAuthor, weekOf, type LastSent, type SentThisWeek } from '@/lib/teamActivity';
import { londonDay } from '@/lib/weeklySummary';

export const dynamic = 'force-dynamic';

export interface TeamMember {
  email: string;
  /** The Microsoft app role on the assignment checklist, or what the session carried for an account not on it. */
  assignment: string;
  /** The name shown in Relay: the Relay name, else the Microsoft name. */
  name?: string;
  /** Set by an Admin in Relay. */
  relayName?: string;
  /** The display name Microsoft gave at the latest sign-in. */
  microsoftName?: string;
  /** Changes made to this person in Relay. Admin only. */
  log?: PersonLogEntry[];
  /** Put on the checklist in Relay rather than the initial roster. */
  addedByRelay?: boolean;
  role?: string;
  trade?: string;
  /** Latest session issued for this account, if any. */
  lastSignedIn?: string;
  /** Signed in at least once, even if every session has since gone (identities are kept). */
  everSignedIn: boolean;
  session: 'active' | 'expired' | 'never';
  /** Stable principal ID, present once the account has signed in. */
  id?: string;
  onChecklist: boolean;
  /** Their latest sent report: the site and day the Team tab shows. */
  lastSent?: LastSent;
  /** The days from Monday to today they sent a report for, and the sites. */
  thisWeek?: SentThisWeek;
}

/** How far back someone off the checklist, with no session left, still shows because they sent a report. */
const OFF_LIST_SENT_DAYS = 14;

/**
 * The team as the office can know it: the assignment checklist reconciled with
 * the session store. Not a directory, and not an authority — roles are read
 * from Microsoft at sign-in and nothing here can change one.
 *
 * Admins additionally get the older drafts that predate account IDs and the
 * processing facts (mail transport, PDF and delivery jobs, outbox) so the Admin
 * tab can say what the pilot is actually doing.
 */
export async function GET() {
  const guard = await requireSession();
  if (!guard.ok) return guard.response;
  if (!canManage(guard.principal)) return NextResponse.json({ reason: 'Manager access required.' }, { status: 403 });

  const now = Date.now();
  const sessions = records<Session>('sessions').filter(s => s.principal.role);
  const byEmail = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.principal.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), s]);
  }
  const admin = isAdmin(guard.principal);
  // Stored sessions and identities keep the Microsoft name; the Relay name is layered on here.
  const identities = records<{ id: string; email?: string; name?: string; microsoftName?: string }>('identities');
  const reports = listReports();
  const sentBy = latestSentByAuthor(reports);
  const today = londonDay(new Date());
  const week = sentThisWeekByAuthor(reports, today);
  const describe = (email: string, assignment: string, onChecklist: boolean, person?: { relayName?: string; log?: PersonLogEntry[] }, addedByRelay?: boolean): TeamMember => {
    const own = (byEmail.get(email.toLowerCase()) ?? []).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const latest = own[0];
    const identity = identities.find(i => latest && i.id === latest.principal.id) ?? identities.find(i => i.email?.toLowerCase() === email.toLowerCase());
    const microsoftName = identity?.microsoftName ?? identity?.name ?? latest?.principal.name;
    const relayName = person?.relayName;
    const name = relayName ?? microsoftName;
    // Every account id this email has signed in with, so a report sent under an older id still counts.
    const ids = new Set([...own.map(s => s.principal.id as string), ...identities.filter(i => i.email?.toLowerCase() === email.toLowerCase()).map(i => i.id)]);
    const lastSent = latestOf(sentBy, ids);
    const thisWeek = weekOf(week, ids);
    return {
      email, assignment, onChecklist,
      ...(name ? { name } : {}),
      ...(relayName ? { relayName } : {}),
      ...(microsoftName ? { microsoftName } : {}),
      ...(admin && person?.log?.length ? { log: person.log } : {}),
      ...(addedByRelay ? { addedByRelay: true } : {}),
      // Sessions are deleted when they expire or on signing out; identities are kept, so this stays true.
      everSignedIn: !!latest || !!identity,
      ...(lastSent ? { lastSent } : {}),
      ...(thisWeek ? { thisWeek } : {}),
      ...(latest ? {
        id: latest.principal.id,
        ...(latest.principal.role ? { role: latest.principal.role } : {}),
        ...(latest.principal.trade ? { trade: latest.principal.trade } : {}),
        lastSignedIn: latest.issuedAt,
        session: new Date(latest.expiresAt).getTime() > now ? 'active' as const : 'expired' as const,
      } : { session: 'never' as const }),
    };
  };
  const checklist = peopleChecklist();
  const listed = new Set(checklist.map(u => u.email.toLowerCase()));
  const members: TeamMember[] = [
    ...checklist.map(u => describe(u.email, u.assignment, true, u.person ?? (u.relayName ? { relayName: u.relayName } : undefined), u.addedByRelay)),
    // Accounts that signed in without being on the checklist (local development
    // identities, someone assigned in Microsoft after the list was written, or
    // someone an Admin removed from it).
    ...[...byEmail.keys()].filter(e => !listed.has(e)).map(e => {
      const p = byEmail.get(e)![0]!.principal;
      const person = getRecord<{ relayName?: string; log?: PersonLogEntry[] }>('people', e);
      return describe(p.email, p.role ? (p.trade ? `${p.role}.${p.trade.replace('&', '')}` : p.role) : 'Unknown', false, person);
    }),
    // Off the checklist with every session gone (signed out, or expired and
    // cleared at someone's next sign-in), but sent a report in the last
    // fortnight: kept, so their updates do not drop off the Team tab. The role
    // is not kept after the session, so it is read from the report they sent.
    ...offListSenders(identities, reports, sentBy, new Set([...listed, ...byEmail.keys()]), today).map(({ email, trade }) =>
      describe(email, trade ? `Engineer.${trade.replace('&', '')}` : 'Unknown', false, getRecord<{ relayName?: string; log?: PersonLogEntry[] }>('people', email))),
  ];

  if (!admin) return NextResponse.json({ members });

  const legacyDrafts = reports.filter(r => r.state === 'draft' && !r.authorId).map(r => ({ id: r.id, reference: r.reference, author: r.author, lastSavedAt: r.lastSavedAt }));
  const jobs = database().prepare('SELECT kind, status, count(*) AS n FROM jobs GROUP BY kind, status').all() as { kind: string; status: string; n: number }[];
  const outbox = reports.filter(r => r.state === 'submitted' && (r.delivery === 'outbox' || r.delivery === 'failed' || r.issued?.transport === 'outbox'));
  return NextResponse.json({
    members, legacyDrafts,
    processing: {
      sharepoint: sharePointMode(),
      mail: process.env.RELAY_MAIL_ENABLED === 'yes' ? 'live' : 'outbox',
      jobs: jobs.map(j => ({ kind: j.kind, status: j.status, count: Number(j.n) })),
      outbox: outbox.map(r => ({ id: r.id, reference: r.reference, projectId: r.projectId, delivery: r.delivery, error: r.deliveryError, since: r.serverAcknowledgedAt })),
    },
  });
}

/**
 * Accounts that signed in at some time (identities are kept), are not in
 * `shown`, and whose latest sent report is for a visit in the last
 * OFF_LIST_SENT_DAYS days. One entry per email, with the trade from that report.
 */
function offListSenders(
  identities: { id: string; email?: string }[],
  reports: { id: string; authorTrade?: string }[],
  sentBy: Map<string, LastSent>,
  shown: Set<string>,
  today: string,
): { email: string; trade?: string }[] {
  const from = new Date(`${today}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - (OFF_LIST_SENT_DAYS - 1));
  const since = from.toISOString().slice(0, 10);
  const byEmail = new Map<string, string[]>();
  for (const i of identities) {
    const email = i.email?.toLowerCase();
    if (!email || shown.has(email)) continue;
    byEmail.set(email, [...(byEmail.get(email) ?? []), i.id]);
  }
  const out: { email: string; trade?: string }[] = [];
  for (const [email, ids] of byEmail) {
    const last = latestOf(sentBy, ids);
    if (!last || last.visitDate < since || last.visitDate > today) continue;
    const trade = reports.find(r => r.id === last.reportId)?.authorTrade;
    out.push({ email, ...(trade ? { trade } : {}) });
  }
  return out.sort((a, b) => a.email.localeCompare(b.email));
}
