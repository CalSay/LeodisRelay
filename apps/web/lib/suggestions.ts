import type { Issue, Report, Variation } from './types';

/**
 * What an engineer has typed on this project before, offered back as chips.
 *
 * Suggestions, not a catalogue (EXP-4, FE-1c): nothing here is set up or
 * maintained, free text is always accepted, and nothing has to match. Places
 * come from submitted reports, issues and variations; companies come from
 * "Who needs to respond" on submitted defect and access cards and from the
 * owner the office gave an issue. Drafts are left out, so words only ever
 * typed in someone's private draft are never shown to anyone else. Wording
 * that differs only in case or outer spaces counts as one entry, shown as it
 * was last typed. Newest first.
 */
export interface SuggestionSources { reports: Report[]; issues: Issue[]; variations: Variation[] }
export interface ProjectSuggestions { locations: string[]; companies: string[] }

export const SUGGESTION_LIMIT = 12;

/** Placeholders that mean "nobody yet", which would be no help as a chip. */
const NOT_A_COMPANY = new Set(['unknown', 'unassigned', 'tbc', 'tba', 'n/a', 'na', 'none', '?', '-']);

function newestFirst() {
  const latest = new Map<string, { at: string; text: string }>();
  return {
    note(value: string | undefined, at: string, skip?: Set<string>) {
      const text = (value ?? '').trim().replace(/\s+/g, ' '); const key = text.toLowerCase();
      if (!key || skip?.has(key)) return;
      const prev = latest.get(key);
      if (!prev || prev.at < at) latest.set(key, { at, text });
    },
    list: (limit: number) => [...latest.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit).map(x => x.text),
  };
}

const lastActivity = (i: Issue) => i.events.reduce((at, e) => e.at > at ? e.at : at, i.raisedAt);

export function projectSuggestions({ reports, issues, variations }: SuggestionSources, limit = SUGGESTION_LIMIT): ProjectSuggestions {
  const places = newestFirst(); const companies = newestFirst();
  for (const r of reports) {
    if (r.state !== 'submitted') continue;
    const at = r.serverAcknowledgedAt ?? '';
    for (const o of r.observations) {
      places.note(o.location, at);
      if (o.type === 'defect' || o.type === 'access') companies.note(o.owner, at, NOT_A_COMPANY);
    }
  }
  for (const i of issues) { places.note(i.location, i.raisedAt); companies.note(i.owner, lastActivity(i), NOT_A_COMPANY); }
  for (const v of variations) places.note(v.location, v.raisedAt);
  return { locations: places.list(limit), companies: companies.list(limit) };
}
