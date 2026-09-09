import { NextResponse } from 'next/server';
import type { Session } from '@relay/platform';
import { requireSession } from '@/lib/auth/guard';
import { canManage, isAdmin } from '@/lib/auth/access';
import { INITIAL_ROSTER } from '@/lib/auth/roster';
import { database, records } from '@/lib/storage';
import { listReports } from '@/lib/serverStore';

export const dynamic = 'force-dynamic';

export interface TeamMember {
  email: string;
  /** The Microsoft app role on the assignment checklist, or what the session carried for an account not on it. */
  assignment: string;
  name?: string;
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
  const describe = (email: string, assignment: string, onChecklist: boolean): TeamMember => {
    const own = (byEmail.get(email.toLowerCase()) ?? []).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const latest = own[0];
    return {
      email, assignment, onChecklist,
      ...(latest ? {
        name: latest.principal.name, id: latest.principal.id,
        ...(latest.principal.role ? { role: latest.principal.role } : {}),
        ...(latest.principal.trade ? { trade: latest.principal.trade } : {}),
        lastSignedIn: latest.issuedAt,
        session: new Date(latest.expiresAt).getTime() > now ? 'active' as const : 'expired' as const,
      } : { session: 'never' as const }),
    };
  };
  const listed = new Set(INITIAL_ROSTER.map(u => u.email.toLowerCase()));
  const members: TeamMember[] = [
    ...INITIAL_ROSTER.map(u => describe(u.email, u.assignment, true)),
    // Accounts that signed in without being on the checklist (local development
    // identities, or someone assigned in Microsoft after the list was written).
    ...[...byEmail.keys()].filter(e => !listed.has(e)).map(e => {
      const p = byEmail.get(e)![0]!.principal;
      return describe(p.email, p.role ? (p.trade ? `${p.role}.${p.trade.replace('&', '')}` : p.role) : 'Unknown', false);
    }),
  ];

  if (!isAdmin(guard.principal)) return NextResponse.json({ members });

  const legacyDrafts = listReports().filter(r => r.state === 'draft' && !r.authorId).map(r => ({ id: r.id, reference: r.reference, author: r.author, lastSavedAt: r.lastSavedAt }));
  const jobs = database().prepare('SELECT kind, status, count(*) AS n FROM jobs GROUP BY kind, status').all() as { kind: string; status: string; n: number }[];
  const outbox = listReports().filter(r => r.state === 'submitted' && (r.delivery === 'outbox' || r.delivery === 'failed' || r.issued?.transport === 'outbox'));
  return NextResponse.json({
    members, legacyDrafts,
    processing: {
      mail: process.env.RELAY_MAIL_ENABLED === 'yes' ? 'live' : 'outbox',
      jobs: jobs.map(j => ({ kind: j.kind, status: j.status, count: Number(j.n) })),
      outbox: outbox.map(r => ({ id: r.id, reference: r.reference, projectId: r.projectId, delivery: r.delivery, error: r.deliveryError, since: r.serverAcknowledgedAt })),
    },
  });
}
