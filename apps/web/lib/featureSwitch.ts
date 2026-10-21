import type { ReportTypeId } from './reportTypes';

/**
 * The office's switch for the health and safety and supplier records:
 * toolbox talks, permits to work, deliveries, the weekly safety and tower and
 * podium inspections, and Safety actions (2026-10-21).
 *
 * RELAY is for site progress: an engineer writes a report with photographs,
 * issues and variations and sends it to the office. These records were added
 * as extras and are off unless the Admin turns them on, so engineers see only
 * the core job. Off hides them everywhere and refuses their pages and API;
 * nothing recorded is deleted, and turning the switch back on shows it all
 * again. Pre-handover and first fix inspections are quality checks on our own
 * work that feed the snag list, so they are not behind the switch.
 *
 * This file holds no storage, so client components may import it; the stored
 * value is read in `features.ts`.
 */

/** The switch's name on the Admin tab and in messages. */
export const SAFETY_RECORDS_NAME = 'Safety, permits and deliveries';
/** What it covers, in the Admin tab's words. */
export const SAFETY_RECORDS_COVERS = 'Toolbox talks, permits to work, deliveries, the weekly safety and tower inspections, and Safety actions.';

/** The report types behind the switch. */
export const SAFETY_RECORD_TYPES: readonly ReportTypeId[] = ['safety-inspection', 'tower-inspection'];
export const isSafetyRecordType = (id: ReportTypeId | undefined): boolean => !!id && SAFETY_RECORD_TYPES.includes(id);

/** The pages behind the switch, with the name each one has. */
export const SAFETY_RECORD_PAGES: Readonly<Record<string, string>> = {
  '/safety-actions': 'Safety actions', '/toolbox-talks': 'Toolbox talks', '/permits': 'Permits to work', '/deliveries': 'Deliveries',
};

/** Whether a link goes to a page behind the switch. */
export function isSafetyRecordPage(href: string): boolean {
  const path = new URL(href, 'https://relay.invalid').pathname;
  return Object.keys(SAFETY_RECORD_PAGES).some(p => path === p || path.startsWith(`${p}/`));
}

/** What a page or API behind the switch says while it is off. */
export const SWITCHED_OFF_REASON = `${SAFETY_RECORDS_NAME} are switched off. The office can turn them on from the Admin tab; nothing recorded has been deleted.`;
