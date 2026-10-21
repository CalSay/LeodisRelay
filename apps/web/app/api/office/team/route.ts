import { sharePointMode } from '@/lib/sharepoint/config';
import { NextResponse } from 'next/server';
import type { Session } from '@relay/platform';
import { requireSession } from '@/lib/auth/guard';
import { canManage, isAdmin } from '@/lib/auth/access';
import { peopleChecklist, type PersonLogEntry } from '@/lib/people';
import { database, getRecord, records } from '@/lib/storage';
import { listReports } from '@/lib/serverStore';

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
  session: 'active' | 'expired' | 'never';
  /** Stable principal ID, present once the account has signed in. */
  id?: string;
  onChecklist: boolean;
}

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
  const describe = (email: string, assignment: string, onChecklist: boolean, person?: { relayName?: string; log?: PersonLogEntry[] }, addedByRelay?: boolean): TeamMember => {
    const own = (byEmail.get(email.toLowerCase()) ?? []).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const latest = own[0];
    const identity = identities.find(i => latest && i.id === latest.principal.id) ?? identities.find(i => i.email?.toLowerCase() === email.toLowerCase());
    const microsoftName = identity?.microsoftName ?? identity?.name ?? latest?.principal.name;
    const relayName = person?.relayName;
    const name = relayName ?? microsoftName;
    return {
      email, assignment, onChecklist,
      ...(name ? { name } : {}),
      ...(relayName ? { relayName } : {}),
      ...(microsoftName ? { microsoftName } : {}),
      ...(admin && person?.log?.length ? { log: person.log } : {}),
      ...(addedByRelay ? { addedByRelay: true } : {}),
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
  ];

  if (!admin) return NextResponse.json({ members });

  const legacyDrafts = listReports().filter(r => r.state === 'draft' && !r.authorId).map(r => ({ id: r.id, reference: r.reference, author: r.author, lastSavedAt: r.lastSavedAt }));
  const jobs = database().prepare('SELECT kind, status, count(*) AS n FROM jobs GROUP BY kind, status').all() as { kind: string; status: string; n: number }[];
  const outbox = listReports().filter(r => r.state === 'submitted' && (r.delivery === 'outbox' || r.delivery === 'failed' || r.issued?.transport === 'outbox'));
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
