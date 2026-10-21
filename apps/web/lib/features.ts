import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Principal } from '@relay/platform';
import { atomic, getRecord, putRecord } from './storage';
import { SWITCHED_OFF_REASON } from './featureSwitch';

/**
 * The office's feature switches, kept in the local store (kind `settings`,
 * one record `features`). Rules and names are in `featureSwitch.ts`.
 */
export interface FeatureSettings { id: 'features'; safetyRecords: boolean; changedAt?: string; changedBy?: string; changedById?: string }

const KIND = 'settings', ID = 'features';

/** Whether the safety, permits and deliveries records are on. Off unless the Admin turned them on. */
export function safetyRecordsOn(): boolean {
  return getRecord<FeatureSettings>(KIND, ID)?.safetyRecords === true;
}

export function featureSettings(): FeatureSettings {
  return getRecord<FeatureSettings>(KIND, ID) ?? { id: ID, safetyRecords: false };
}

/** Turn the records on or off, saying who did it and when. Admin only, checked by the route. */
export function setSafetyRecords(principal: Principal, on: boolean, now = new Date()): FeatureSettings {
  return atomic(() => {
    const row: FeatureSettings = { id: ID, safetyRecords: on, changedAt: now.toISOString(), changedBy: principal.name, changedById: principal.id };
    putRecord(KIND, row);
    putRecord('settings-audit', { id: randomUUID(), actorId: principal.id, setting: 'safetyRecords', value: on, at: row.changedAt });
    return row;
  });
}

/** The refusal for a route behind the switch while it is off, or null when it is on. */
export function safetyRecordsRefusal(): NextResponse | null {
  return safetyRecordsOn() ? null : NextResponse.json({ reason: SWITCHED_OFF_REASON, switchedOff: true }, { status: 404 });
}
