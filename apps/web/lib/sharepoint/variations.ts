import { randomUUID } from 'node:crypto';
import type { Issue, Variation } from '../types';
import { atomic, enqueue, getRecord, putRecord, records } from '../storage';
import { cachedProject, projectIdentity, refreshProjects, reportableProject } from '../projects';
import { assertProjectWrite, OPERATIONS, sharePointMode, writableProjectItemIds } from './config';
import { fieldsEqual } from './issues';
import { graph, GraphError, type ListItem } from './graph';
import { personLookup, principalForPerson, sitePeople } from './people';

const INSTRUCTION = { pending: 'Pending', instructed: 'Instructed', declined: 'Declined' } as const;
export interface VariationSync { status: 'pending' | 'synced' | 'conflict' | 'failed'; itemId?: string; etag?: string; operationId?: string; error?: string; evidenceUrl?: string }
export interface VariationOperation { variation: Variation; baseEtag?: string; itemId?: string }
export class VariationSyncError extends Error {}

/** Existing RELAY variations gain the same durable jobs as newly submitted ones. */
export function queueVariationBackfill(): void {
  if (sharePointMode() !== 'write') return;
  const allowed = new Set(writableProjectItemIds());
  atomic(() => {
    for (const variation of records<Variation>('variations')) {
      const project = cachedProject(variation.projectId);
      if (!project?.source || !allowed.has(project.source.itemId)) continue;
      const receipt = variation.raisedByReport ? getRecord<{webUrl:string}>('sharepoint-files', variation.raisedByReport) : undefined;
      if (!variation.sync || (variation.sync.status === 'synced' && receipt?.webUrl && variation.sync.evidenceUrl !== receipt.webUrl)) saveVariation(variation);
    }
  });
}

function relayOrigin(): string {
  try { return new URL(process.env.ENTRA_REDIRECT_URI ?? 'https://app.relaybyleodis.com').origin; }
  catch { return 'https://app.relaybyleodis.com'; }
}

/** Local edits remain pending until the SharePoint Variation Register acknowledges them. */
export function saveVariation(variation: Variation): void {
  if (sharePointMode() === 'off') { putRecord('variations', variation); return; }
  if (sharePointMode() === 'read') throw new VariationSyncError('Variation updates are disabled while SharePoint is read-only.');
  const project = cachedProject(variation.projectId);
  if (!project?.source) throw new VariationSyncError('This example variation cannot be sent to SharePoint.');
  assertProjectWrite(project.source.itemId);
  const old = getRecord<Variation>('variations', variation.id);
  if (old?.sync?.status === 'synced' && old.sync.etag && variation.sync?.etag !== old.sync.etag) throw new VariationSyncError('This variation changed while the action was being prepared.');
  if (old?.sync && old.sync.status !== 'synced') throw new VariationSyncError('This variation has an outstanding SharePoint operation. Resolve it before making another change.');
  const operationId = `sharepoint-variation:${randomUUID()}`;
  const sync: VariationSync = { status: 'pending', operationId,
    ...(old?.sync?.itemId ? { itemId: old.sync.itemId } : {}), ...(old?.sync?.etag ? { etag: old.sync.etag } : {}) };
  const next = { ...variation, sync };
  putRecord('variations', next);
  enqueue(operationId, 'sharepoint-variation', { variation: next,
    ...(old?.sync?.etag ? { baseEtag: old.sync.etag } : {}), ...(old?.sync?.itemId ? { itemId: old.sync.itemId } : {}) } satisfies VariationOperation);
}

export async function variationFields(variation: Variation): Promise<Record<string, unknown>> {
  const project = cachedProject(variation.projectId);
  if (!project?.source) throw new Error('The variation has no SharePoint project identity.');
  assertProjectWrite(project.source.itemId);
  const receipt = variation.raisedByReport ? getRecord<{webUrl:string}>('sharepoint-files', variation.raisedByReport) : undefined;
  const linkedIssue = variation.linkedIssueId ? getRecord<Issue>('issues', variation.linkedIssueId) : undefined;
  return {
    Title: `${variation.reference} | ${variation.description.split(/\r?\n/, 1)[0]}`.slice(0, 255),
    RelayVariationId: variation.id,
    ProjectLookupId: project.source.itemId,
    LinkedIssueLookupId: linkedIssue?.sync?.itemId ?? null,
    SourceReportId: variation.raisedByReport ?? '',
    RelayLink: `${relayOrigin()}/variations/${encodeURIComponent(variation.id)}`,
    EvidenceLink: receipt?.webUrl ?? null,
    RaisedByLookupId: await personLookup(variation.raisedById),
    RaisedAt: variation.raisedAt,
    Description: variation.description,
    Trade: variation.trade ?? null,
    Reason: variation.reason ?? null,
    Location: variation.location,
    Instruction: INSTRUCTION[variation.instruction],
    InstructionReference: variation.instructionReference ?? '',
    InstructedBy: variation.instructedBy ?? '',
    InstructedOn: variation.instructedOn ?? null,
    SignedInstruction: variation.signedInstruction ?? null,
    ExpectedLabour: variation.labourHours ?? null,
    LabourRate: variation.labourRate ?? null,
    ExpectedPartsCost: variation.partsCost ?? null,
    PlantSubcontract: variation.plantSubcontract ?? null,
    Uplift: variation.upliftPct ?? null,
    QuotedValue: variation.quotedValue ?? null,
    InstructedValue: variation.instructedValue ?? null,
    WorkUndertakenBeforeInstruction: variation.workDone,
  };
}

export async function sendVariationOperation(operation: VariationOperation, operationId: string): Promise<void> {
  const fields = await variationFields(operation.variation);
  let remote = await graph.byKey(OPERATIONS.variations, 'RelayVariationId', operation.variation.id);
  if (remote && String(remote.fields.ProjectLookupId) !== String(fields.ProjectLookupId)) throw new GraphError(412);
  if (!remote && operation.itemId) throw new GraphError(412);
  if (!remote) {
    try {
      await graph.request<ListItem>(`${graph.listPath(OPERATIONS.variations)}/items`, { method: 'POST', body: JSON.stringify({ fields }) });
    } catch (error) {
      if (!(error instanceof GraphError) || ![400, 409].includes(error.status)) throw error;
      remote = await graph.byKey(OPERATIONS.variations, 'RelayVariationId', operation.variation.id);
      if (!remote || !fieldsEqual(remote.fields, fields)) throw error;
    }
  } else if (!fieldsEqual(remote.fields, fields)) {
    if (!operation.baseEtag || remote.eTag !== operation.baseEtag) throw new GraphError(412);
    await graph.request(`${graph.listPath(OPERATIONS.variations)}/items/${encodeURIComponent(remote.id)}/fields`, {
      method: 'PATCH', headers: { 'If-Match': operation.baseEtag }, body: JSON.stringify(fields),
    });
  }
  const saved = await graph.byKey(OPERATIONS.variations, 'RelayVariationId', operation.variation.id);
  if (!saved || !fieldsEqual(saved.fields, fields)) throw new GraphError(412);
  atomic(() => {
    const current = getRecord<Variation>('variations', operation.variation.id);
    const evidenceUrl = typeof fields.EvidenceLink === 'string' ? fields.EvidenceLink : undefined;
    if (current?.sync?.operationId === operationId) putRecord('variations', { ...current, sync: { status: 'synced', itemId: saved.id, etag: saved.eTag, ...(evidenceUrl ? {evidenceUrl}: {}) } });
  });
}

let refreshing: Promise<void> | undefined;
export async function refreshVariations(): Promise<void> {
  if (sharePointMode() === 'off') return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await refreshProjects();
    const [rows, people] = await Promise.all([graph.items(OPERATIONS.variations), sitePeople()]);
    const seen = new Set<string>();
    const next: Variation[] = [];
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const number = (value: unknown) => value === null || value === undefined || value === '' ? undefined : Number(value);
    for (const row of rows) {
      const f = row.fields;
      const id = text(f.RelayVariationId);
      if (!id) continue; // Manually maintained/demo rows remain visible in SharePoint but are not claimed by RELAY.
      if (seen.has(id)) throw new Error('Duplicate variation identity in SharePoint.');
      seen.add(id);
      const projectId = projectIdentity(String(f.ProjectLookupId));
      const project = cachedProject(projectId);
      if (!project || !reportableProject(project)) continue;
      const local = getRecord<Variation>('variations', id);
      if (local?.sync && local.sync.status !== 'synced') continue;
      const by = people.find(person => person.id === String(f.RaisedByLookupId));
      const linked = records<Issue>('issues', projectId).find(issue => issue.sync?.itemId === String(f.LinkedIssueLookupId));
      const instruction = Object.entries(INSTRUCTION).find(([, display]) => display === f.Instruction)?.[0] as Variation['instruction'] | undefined;
      if (!instruction) throw new Error('SharePoint contains an unsupported variation status.');
      const trade = ['Electrical','HVAC','P&H','Multi'].includes(text(f.Trade)) ? text(f.Trade) as Variation['trade'] : undefined;
      const reason = ['Client instruction','Design change','Site condition','Damage by others','Omission','Spec change'].includes(text(f.Reason)) ? text(f.Reason) as Variation['reason'] : undefined;
      const signedInstruction = typeof f.SignedInstruction === 'object' && f.SignedInstruction ? text((f.SignedInstruction as {Url?:string}).Url) : text(f.SignedInstruction);
      const raisedById = by ? principalForPerson(by) : local?.raisedById;
      const raisedByReport = text(f.SourceReportId);
      const labourHours = number(f.ExpectedLabour), labourRate = number(f.LabourRate), partsCost = number(f.ExpectedPartsCost);
      const plantSubcontract = number(f.PlantSubcontract), upliftPct = number(f.Uplift), quotedValue = number(f.QuotedValue), instructedValue = number(f.InstructedValue);
      next.push({
        id, projectId, reference: text(f.Title).split(' | ', 1)[0] || local?.reference || 'UNKNOWN-VO-000',
        description: text(f.Description), location: text(f.Location), workDone: f.WorkUndertakenBeforeInstruction === true, instruction,
        source: local?.source ?? 'office', raisedBy: by?.name ?? local?.raisedBy ?? 'SharePoint', raisedAt: text(f.RaisedAt), events: local?.events ?? [],
        ...(trade ? { trade } : {}), ...(reason ? { reason } : {}),
        ...(text(f.InstructionReference) ? { instructionReference: text(f.InstructionReference) } : {}),
        ...(text(f.InstructedBy) ? { instructedBy: text(f.InstructedBy) } : {}),
        ...(text(f.InstructedOn) ? { instructedOn: text(f.InstructedOn).slice(0,10) } : {}),
        ...(signedInstruction ? { signedInstruction } : {}),
        ...(labourHours !== undefined ? { labourHours } : {}), ...(labourRate !== undefined ? { labourRate } : {}),
        ...(partsCost !== undefined ? { partsCost } : {}), ...(plantSubcontract !== undefined ? { plantSubcontract } : {}),
        ...(upliftPct !== undefined ? { upliftPct } : {}), ...(quotedValue !== undefined ? { quotedValue } : {}),
        ...(instructedValue !== undefined ? { instructedValue } : {}),
        ...(raisedById ? { raisedById } : {}), ...(local?.raiserTrade ? { raiserTrade: local.raiserTrade } : {}),
        ...(raisedByReport ? { raisedByReport } : {}), ...(local?.raisedByObservation ? { raisedByObservation: local.raisedByObservation } : {}),
        ...(linked?.id ? { linkedIssueId: linked.id } : {}), ...(local?.askedBy ? { askedBy: local.askedBy } : {}),
        sync: { status: 'synced', itemId: row.id, etag: row.eTag,
          ...(typeof f.EvidenceLink === 'object' && f.EvidenceLink
            ? {evidenceUrl:String((f.EvidenceLink as {Url?:string}).Url ?? '')}
            : text(f.EvidenceLink) ? {evidenceUrl:text(f.EvidenceLink)} : {}) },
      });
    }
    atomic(() => {
      for (const variation of next) {
        const current = getRecord<Variation>('variations', variation.id);
        if (!current?.sync || current.sync.status === 'synced') putRecord('variations', { ...variation, events: current?.events ?? variation.events });
      }
      for (const old of records<Variation>('variations')) if (old.sync?.status === 'synced' && !seen.has(old.id)) {
        putRecord('variations', { ...old, sync: { ...old.sync, status: 'conflict', error: 'The SharePoint variation was deleted or moved outside the connected project scope.' } });
      }
    });
  })();
  try { await refreshing; } finally { refreshing = undefined; }
}

export function failVariationOperation(operation: VariationOperation, error: unknown, operationId: string): void {
  const variation = getRecord<Variation>('variations', operation.variation.id);
  if (variation?.sync?.operationId === operationId) putRecord('variations', { ...variation, sync: { ...variation.sync,
    status: error instanceof GraphError && error.status === 412 ? 'conflict' : 'failed',
    error: error instanceof Error ? error.message : 'SharePoint synchronization failed.',
  } });
}
