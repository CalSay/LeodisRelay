import { createHash, randomUUID } from 'node:crypto';
import type { Principal } from '@relay/platform';
import { canManage, ownsReport } from './auth/access';
import type { Issue, Report, ReportSummary, Observation } from './types';
import { reviewReport } from './review';
import { FIXTURE_PROJECTS } from './fixtures';
import { confirmIssuesFromReport, disputeIssuesFromReport, raiseFromReport } from './issueStore';
import { atomic, getRecord, putRecord, records, pageRecords, enqueue, database } from './storage';

export type StoreOutcome<T> = { ok: true; value: T } | { ok: false; status: number; reason: string };
const reject = (reason: string, status = 409): StoreOutcome<never> => ({ ok: false, status, reason });
export function listReports(projectId?: string): Report[] { return records('reports', projectId); }
export function getReport(id: string): Report | undefined { return getRecord('reports', id); }
export function reportPage(projectId?: string, offset = 0) { return pageRecords<ReportSummary>('reports', projectId, offset); }

/** Filter before pagination: another engineer's draft never reaches the response. */
export function reportsFor(principal: Principal, projectId?: string, offset = 0) {
  const where = ["kind='reports'"];
  const args: string[] = [];
  if (projectId) { where.push('project=?'); args.push(projectId); }
  if (!canManage(principal)) {
    where.push("(state='submitted' OR json_extract(data,'$.authorId')=?)"); args.push(principal.id);
  }
  const rows = database().prepare(`SELECT summary FROM records WHERE ${where.join(' AND ')} ORDER BY updated DESC,id DESC LIMIT 51 OFFSET ?`).all(...args,offset);
  return { items: rows.slice(0,50).map(row => {
    const r = JSON.parse(row.summary as string) as ReportSummary;
    if (r.state === 'submitted' || ownsReport(principal,r)) return r;
    // Explicit allowlist: no notes, signature, delivery details or correction
    // text. A section count and the author's trade are not contents; they let
    // the office say "3 sections, Electrical" without reading a word.
    const allowed: ReportSummary = { id:r.id,projectId:r.projectId,reference:r.reference,visitDate:r.visitDate,
      author:r.author,...(r.authorId ? {authorId:r.authorId}:{}),...(r.authorTrade ? {authorTrade:r.authorTrade}:{}),
      state:r.state,version:r.version,revision:r.revision,review:r.review,
      ...(r.lastSavedAt ? {lastSavedAt:r.lastSavedAt}:{}),...(r.corrects ? {corrects:r.corrects}:{}),
      observationCount:r.observationCount,photoCount:0,defectCount:0 };
    return allowed;
  }), next: rows.length > 50 ? offset + 50 : null };
}

export function createReport(projectId: string, author: string, principal?: Principal): Report {
  return atomic(() => {
    const project = FIXTURE_PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found.');
    const count = database().prepare("SELECT COUNT(*) AS n FROM records WHERE kind='reports' AND project=?").get(projectId)!;
    const report: Report = {
      id: 'rep-' + randomUUID(), projectId, author,
      ...(principal ? { authorId:principal.id, ...(principal.trade ? {authorTrade:principal.trade}: {}) } : {}),
      reference: `${project.projectNumber}-SPR-${String(Number(count.n) + 1).padStart(3,'0')}`,
      visitDate: new Date().toISOString().slice(0,10), state: 'draft', version: 1,
      revision: 1, review: 'not_required', observations: [], lastSavedAt: new Date().toISOString(),
    };
    putRecord('reports',report);
    return report;
  });
}

export function saveDraft(id: string, incoming: Report, expectedVersion?: number, requestId?: string): StoreOutcome<Report> {
  return atomic(() => {
    const digest = createHash('sha256').update(JSON.stringify({observations:incoming.observations,expectedVersion})).digest('hex');
    const key = requestId ? `save:${requestId}` : undefined;
    if (key) {
      const previous = getRecord<{id:string;reportId:string;digest:string;version?:number;receipt?:Report}>('save-receipts',key);
      if (previous) {
        if (previous.reportId !== id || previous.digest !== digest) return reject('A save request ID was reused with different content.');
        const current = getReport(id);
        if (!current || current.version !== (previous.version ?? previous.receipt?.version) || current.state !== 'draft') return reject('That save was received, but the report has since changed. Your local work is retained; reopen the report to compare.');
        return {ok:true,value:current};
      }
    }
    const existing = getReport(id);
    if (!existing) return reject('No such report.',404);
    if (existing.state !== 'draft') return reject('This report has already been submitted.');
    if (expectedVersion !== existing.version) return reject('This report changed elsewhere. Your local copy has been retained.');
    const saved = { ...existing, observations: incoming.observations, version: existing.version + 1, lastSavedAt: new Date().toISOString() };
    putRecord('reports',saved);
    if (key) putRecord('save-receipts',{id:key,reportId:id,digest,version:saved.version});
    return { ok: true, value: saved };
  });
}

export interface DraftMutation { id: string; expectedVersion: number; upsert: Observation[]; remove: string[] }
export function mutateDraft(id: string, mutation: DraftMutation): StoreOutcome<Report> {
  return atomic(() => {
    const acknowledged = database().prepare('SELECT receipt FROM mutations WHERE id=? AND report=?').get(mutation.id,id);
    if (acknowledged) return { ok: true, value: JSON.parse(acknowledged.receipt as string) };
    const current = getReport(id);
    if (!current) return reject('No such report.',404);
    const changes = new Map(mutation.upsert.map(o => [o.id,o]));
    const observations = current.observations.filter(o => !mutation.remove.includes(o.id)).map(o => {
      const next = changes.get(o.id); changes.delete(o.id); return next ?? o;
    });
    observations.push(...changes.values());
    const result = saveDraft(id,{ ...current, observations },mutation.expectedVersion);
    if (result.ok) database().prepare('INSERT INTO mutations VALUES (?,?,?)').run(mutation.id,id,JSON.stringify(result.value));
    return result;
  });
}

export async function submitReport(id: string, signature?: { dataUrl?: string; name: string }, expectedVersion?: number): Promise<StoreOutcome<Report>> {
  return atomic(() => {
    const existing = getReport(id);
    if (!existing) return reject('No such report.',404);
    if (existing.state === 'submitted') return { ok: true, value: existing }; // Lost receipt, safe retry.
    if (expectedVersion !== existing.version) return reject('Save the latest changes before submitting.');
    const blocking = reviewReport(existing).filter(f => f.blocking);
    if (blocking.length) return reject(`${blocking.length} item(s) need completing before sending.`,422);
    const submitted: Report = {
      ...existing, state: 'submitted', serverAcknowledgedAt: new Date().toISOString(),
      review: FIXTURE_PROJECTS.find(p => p.id === existing.projectId)?.reviewRequired ? 'pending' : 'not_required',
      delivery: 'pending',
      ...(signature ? { signature: { ...signature, signedAt: new Date().toISOString() } } : {}),
    };
    putRecord('reports',submitted);
    putRecord('snapshots',submitted);
    raiseFromReport(submitted);
    enqueue('pdf:' + id,'pdf',{ reportId: id });
    return { ok: true, value: submitted };
  });
}

export function reviewSubmission(id: string, decision: string, reviewer: string, note: string, reviewerId?: string): StoreOutcome<Report> {
  return atomic(() => {
    const report = getReport(id);
    if (!report) return reject('No such report.',404);
    if (!['approve','return'].includes(decision)) return reject('Choose approve or return.',422);
    if (report.state !== 'submitted' || report.review !== 'pending') return reject('This report is not awaiting review.');
    if (report.authorId ? report.authorId === reviewerId : report.author === reviewer) return reject('The author cannot review their own report.',422);
    if (decision === 'return' && !note.trim()) return reject('Say what needs changing.',422);
    // The submitted snapshot stays immutable even when changes are requested.
    const reviewed: Report = { ...report, review: decision === 'approve' ? 'approved' : 'returned', reviewedBy: reviewer, ...(reviewerId ? {reviewedById:reviewerId}:{}), reviewedAt: new Date().toISOString(), reviewNote: note.trim() };
    putRecord('reports',reviewed);
    if (decision === 'approve') confirmIssuesFromReport(id,reviewer,reviewerId);
    else disputeIssuesFromReport(id,reviewer,reviewerId);
    return { ok: true, value: reviewed };
  });
}

export function correctReport(id: string, reason: string): StoreOutcome<Report> {
  return atomic(() => {
    const original = getReport(id);
    if (!original || original.state !== 'submitted') return reject('Only a submitted report can be corrected.');
    if (!reason.trim()) return reject('Say why this correction is needed.',422);
    const previous = records<Report>('reports',original.projectId).find(r => r.corrects === id);
    if (previous) return { ok: true, value: previous };
    const { signature, issued, delivery, serverAcknowledgedAt, reviewedAt, reviewedBy, reviewedById, reviewNote, acknowledged, ...base } = original;
    // The original's defects already raised issues. Point the copied updates at
    // them, so sending the correction adds a sighting to each issue rather than
    // raising the same defect again under a new reference.
    const raised = records<Issue>('issues',original.projectId).filter(i => i.raisedByReport === id);
    const observations = base.observations.map(o => {
      if (o.linkedIssueId || (o.type !== 'defect' && o.type !== 'access')) return o;
      const match = raised.find(i => i.raisedByObservation === o.id)
        ?? raised.find(i => !i.raisedByObservation && i.location === o.location && i.description === o.whatHappened);
      return match ? { ...o, linkedIssueId: match.id } : o;
    });
    const correction: Report = { ...base, observations, id: 'rep-' + randomUUID(), state: 'draft', review: 'not_required', revision: original.revision + 1, version: 1, corrects: id, correctionReason: reason.trim(), lastSavedAt: new Date().toISOString() };
    putRecord('reports',correction);
    return { ok: true, value: correction };
  });
}

/** The office has read it. Recorded once; a second acknowledgement returns the first. */
export function acknowledgeReport(id: string, principal: Principal, note: string): StoreOutcome<Report> {
  return atomic(() => {
    const report = getReport(id);
    if (!report) return reject('No such report.',404);
    if (report.state !== 'submitted') return reject('Only a submitted report can be acknowledged.');
    if (report.acknowledged) return { ok: true, value: report };
    const acknowledged: Report = { ...report, acknowledged: { by: principal.name, byId: principal.id, at: new Date().toISOString(), ...(note.trim() ? { note: note.trim() } : {}) } };
    putRecord('reports',acknowledged);
    return { ok: true, value: acknowledged };
  });
}

export function officeView(offset = 0) {
  const page = reportPage(undefined,offset);
  const all = page.items;
  return {
    awaitingReview: all.filter(r => r.state === 'submitted' && r.review === 'pending'),
    submitted: all.filter(r => r.state === 'submitted' && r.review !== 'pending'),
    drafts: all.filter(r => r.state === 'draft'),
    next: page.next,
  };
}
