/**
 * Help and what's new: a plain guide to RELAY for the two people who use it,
 * the engineer on site and the office, and a list of what has been added, so
 * a feature built this week is found by the people it was built for.
 *
 * Content lives here, not in the page, so a test can check every link goes
 * to a real page and every entry has a stable id. Each new feature adds one
 * entry to the top of `WHATS_NEW`; its `id` is what marks it "New" for each
 * person until they have opened Help, so never reuse or change an id.
 */

/** Who an entry or section is for. `all` shows on both tabs. */
export type HelpAudience = 'site' | 'office' | 'all';
export type HelpTab = Exclude<HelpAudience, 'all'>;

export interface WhatsNew {
  /** Stable: stored on each person's device as "seen". */
  id: string;
  /** The day it reached RELAY, `YYYY-MM-DD`. */
  added: string;
  audience: HelpAudience;
  title: string;
  text: string;
  /** Where to try it, if it has a page of its own. */
  link?: { label: string; href: string };
}

/** Newest first. Only what has been merged; nothing promised. */
export const WHATS_NEW: readonly WhatsNew[] = [
  { id: 'home-sheet-tidy', added: '2026-10-20', audience: 'all', title: 'A tidier home screen and project sheet',
    text: 'The pages about a project are now in two groups, Issues and safety, and Reports and records, with the ones used most first. On your home screen My week and Help sit together at the foot. In the office the project sheet keeps them in one box under its figures, and on a phone they now show above the project\'s register, where before they could not be reached.' },
  { id: 'issue-trend', added: '2026-10-20', audience: 'all', title: 'Issues over time',
    text: 'See whether a project\'s issue list is getting shorter: for the last 12 weeks, how many issues were raised and closed each week and how many were still open, and past target, at the end of it. Opens from "This project" on your home screen and from the office project sheet.',
    link: { label: 'Open Issues over time', href: '/issue-trend' } },
  { id: 'office-desk-tidy', added: '2026-10-20', audience: 'office', title: 'A tidier office desk',
    text: 'Clicking a variation in the Variations register now opens it, the register fits a laptop screen without scrolling sideways, and the report stages in the Inbox reader no longer run into each other. Inbox, Issues and Variations each have Clear filters, and an empty list says what it means, such as "Every report has been read".' },
  { id: 'offline-sign', added: '2026-10-20', audience: 'site', title: 'Sign an inspection with no signal',
    text: 'With no signal, once every check is answered you can sign a safety or handover inspection on the phone. It is marked "Signed · not sent yet" and goes to the office by itself the next time RELAY opens with signal, and RELAY tells you when it has gone. If anything changed after you signed, it is not sent: you check it and sign again.' },
  { id: 'before-handover', added: '2026-10-20', audience: 'all', title: 'Before handover',
    text: 'One page per project with everything RELAY still has open: snags on our work by trade, fixes waiting to be checked, handover inspections and their open actions, other trades\' issues, variations not yet instructed and open safety actions. Ready to print for the handover meeting.',
    link: { label: 'Open Before handover', href: '/handover' } },
  { id: 'easier-to-read', added: '2026-10-20', audience: 'all', title: 'Easier to read and to tap',
    text: 'Grey text is darker in the light theme and lighter in the dark theme, so it is easier to read outdoors or on a dim screen. On a phone, buttons, filters, tabs and Back links are at least a fingertip tall, and screen readers can now find the heading and main part of every office page.' },
  { id: 'editor-tidy', added: '2026-10-20', audience: 'site', title: 'A quicker, calmer report screen',
    text: 'On a phone the card you have open no longer repeats itself above and below, "Check & send" is no longer repeated inside each card (it stays at the foot of the screen), and an inspection just started lists its unanswered checks as one line rather than twelve. Optional suggestions are marked "Optional", so only a "Stop" stops you sending.' },
  { id: 'offline-inspection', added: '2026-10-20', audience: 'site', title: 'Start an inspection with no signal',
    text: 'With no signal, you can now start a safety or handover inspection as well as a site update, answer its checks and take photographs. It goes up by itself once RELAY opens with signal; you sign it and send it then.' },
  { id: 'help', added: '2026-10-20', audience: 'all', title: 'This Help page',
    text: 'How RELAY works in plain words, what each status means, and this list of what is new. New things are marked until you have looked.' },
  { id: 'handover-inspection', added: '2026-10-20', audience: 'site', title: 'Handover inspection',
    text: 'Walk an area before it is handed over and answer 12 checks on our own M&E work. Each "Action needed" goes on the snag list as an issue when you send it. Start it from "Do a handover inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'offline-start', added: '2026-10-20', audience: 'site', title: 'Start a site update with no signal',
    text: 'With no signal, RELAY opens a page where you can start a site update, add cards and take photos. They stay on the phone, marked "Only on this phone", and go up by themselves once you open RELAY with signal again. Nothing is sent to the office until you sign and send.' },
  { id: 'safety-actions', added: '2026-10-20', audience: 'all', title: 'Safety actions',
    text: 'Every "Action needed" from the weekly safety inspections, kept open until a later inspection finds it put right, with when each project is due another inspection.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'safety-inspection', added: '2026-10-20', audience: 'site', title: 'Weekly safety inspection',
    text: 'A report of its own with 12 checks, each answered Satisfactory, Action needed or Not applicable, signed and sent like a site update. Start it from "Do a safety inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'my-week', added: '2026-10-20', audience: 'all', title: 'My week',
    text: 'Your own week, day by day, across every project: the reports you sent, defects you flagged and issues you updated. Ready to copy into a timesheet.',
    link: { label: 'Open My week', href: '/my-week' } },
  { id: 'register-downloads', added: '2026-10-20', audience: 'office', title: 'Registers as spreadsheets',
    text: 'The Issues and Variations tabs each have "Download spreadsheet", which saves what the filters show as a CSV file that opens in Excel.',
    link: { label: 'Open the Issues tab', href: '/office#/issues' } },
  { id: 'site-diary', added: '2026-10-20', audience: 'all', title: 'Site diary',
    text: 'Every visit on a project, day by day, built from the reports already sent. Nothing extra to type. Find a word, or show only defects, variations or inspections.',
    link: { label: 'Open the Site diary', href: '/diary' } },
  { id: 'companies', added: '2026-10-20', audience: 'office', title: 'Issues by company',
    text: 'Each company with open issues on any project: how many, how many are past their target, and the oldest. A chase list for the phone call.',
    link: { label: 'Open Issues by company', href: '/companies' } },
  { id: 'corrections-traced', added: '2026-10-20', audience: 'all', title: 'Corrections you can trace',
    text: 'An issue now says which revision of a report changed it. A correction is a new revision and the first stays on file, so nothing is overwritten.' },
  { id: 'suggestions', added: '2026-10-20', audience: 'site', title: 'Companies and locations suggested as you type',
    text: 'The location and "Who needs to respond" boxes suggest what has been written before on the project. You can always type something new.' },
  { id: 'undo', added: '2026-10-20', audience: 'site', title: 'Undo a removed card or photo',
    text: 'Removing a card or photograph from a report shows "Undo" for twelve seconds, so a slip of the thumb costs nothing.' },
  { id: 'another-card', added: '2026-10-20', audience: 'site', title: 'Another card at the same place',
    text: '"Another card here" starts a new card at the location you just wrote, so a walk round one room is quicker.' },
  { id: 'coverage', added: '2026-10-20', audience: 'office', title: 'Site coverage',
    text: 'Which live projects have had a visit and a report lately, and which have gone quiet.',
    link: { label: 'Open Site coverage', href: '/coverage' } },
  { id: 'since-last-visit', added: '2026-10-20', audience: 'site', title: 'Since your last visit',
    text: 'Your home screen lists what changed on the project since you last sent a report there: new issues, fixes and reports from other trades.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'photos', added: '2026-10-20', audience: 'all', title: 'Photographs',
    text: 'Every photograph on a project in one place, grouped by location, with the report or issue it came from.',
    link: { label: 'Open Photographs', href: '/photos' } },
  { id: 'weekly-summary', added: '2026-10-20', audience: 'all', title: 'Weekly summary',
    text: 'One project\'s week on one page, ready to print for the site meeting: visits, what was found, issues opened and closed, variations.',
    link: { label: 'Open the Weekly summary', href: '/weekly-summary' } },
  { id: 'snag-list', added: '2026-10-20', audience: 'all', title: 'Snag lists to print',
    text: 'The open issues for one company or trade on a project, with photographs, ready to print or hand over on a phone.',
    link: { label: 'Open a snag list', href: '/issues/snag-list' } },
  { id: 'stages', added: '2026-10-20', audience: 'all', title: 'Where a sent report has got to',
    text: 'A sent report shows each step on its own line: received, review (only where the project asks for it), PDF, delivery and read. A ready PDF never reads as delivered.' },
  { id: 'unfinished', added: '2026-10-20', audience: 'site', title: 'Unfinished reports on your home screen',
    text: 'Every report you have started and not sent, on any project, stays on your home screen until you sign and send it.' },
  { id: 'search', added: '2026-10-20', audience: 'all', title: 'Search',
    text: 'Search the words in every report, issue and variation open to you, on one project or all of them.',
    link: { label: 'Open Search', href: '/search' } },
];

export interface GuideLink { label: string; href: string; audience: HelpAudience; text: string }

/** "Where to find things": every page someone might be looking for, by tab. */
export const GUIDE_LINKS: readonly GuideLink[] = [
  { label: 'Your home screen', href: '/engineer', audience: 'site', text: 'Start a site update, flag a defect, do a safety inspection, and see what came back from the office.' },
  { label: 'Office', href: '/office', audience: 'office', text: 'The office position first, then Inbox, Issues, Variations and Team.' },
  { label: 'Search', href: '/search', audience: 'all', text: 'The words in every report, issue and variation.' },
  { label: 'Site diary', href: '/diary', audience: 'all', text: 'Each project day by day, from the reports sent.' },
  { label: 'Photographs', href: '/photos', audience: 'all', text: 'Every photograph on a project, by location.' },
  { label: 'Weekly summary', href: '/weekly-summary', audience: 'all', text: 'A project\'s week on one page, for the site meeting.' },
  { label: 'Snag list', href: '/issues/snag-list', audience: 'all', text: 'Open issues for one company or trade, to print.' },
  { label: 'Safety actions', href: '/safety-actions', audience: 'all', text: 'What the safety inspections found, until it is put right.' },
  { label: 'Before handover', href: '/handover', audience: 'all', text: 'Everything still open on one project, as it nears completion.' },
  { label: 'Issues over time', href: '/issue-trend', audience: 'all', text: 'Whether a project\'s issue list is getting shorter, week by week.' },
  { label: 'My week', href: '/my-week', audience: 'all', text: 'Your own week across every project.' },
  { label: 'Site coverage', href: '/coverage', audience: 'office', text: 'Which live projects have gone quiet.' },
  { label: 'Issues by company', href: '/companies', audience: 'office', text: 'Who to chase, and for what.' },
];

export interface GuideTerm { term: string; meaning: string }
export interface GuideGroup { heading: string; terms: readonly GuideTerm[] }

/**
 * What the status words mean, in the words the screens use. Kept beside the
 * labels in `status.ts`, `reportTypes.ts` and the office model; a test holds
 * the issue and check words to those sources.
 */
export const GLOSSARY: readonly GuideGroup[] = [
  { heading: 'A sent report', terms: [
    { term: 'Received', meaning: 'On file in RELAY. It cannot be changed now, only corrected.' },
    { term: 'To review', meaning: 'Only on projects set up to need a review; review is off by default. Someone in the office approves it or sends it back with a reason.' },
    { term: 'PDF', meaning: 'RELAY makes the PDF of the report. "Ready" means it is made, not that anyone has it yet.' },
    { term: 'Delivery', meaning: 'Filed in SharePoint for SharePoint projects. In this pilot nothing is emailed: notifications are held in an outbox and the step says "Not emailed".' },
    { term: 'Read', meaning: 'Someone in the office has acknowledged it. Until then it says "Not yet read".' },
  ] },
  { heading: 'An issue', terms: [
    { term: 'Open', meaning: 'Raised and not yet given to anyone.' },
    { term: 'Assigned', meaning: 'A company or person is down to put it right, usually with a target date.' },
    { term: 'In progress', meaning: 'Work has been recorded on an open issue, or a fix was put forward and sent back.' },
    { term: 'Ready for verification', meaning: 'Put forward as fixed; the office desk tags it "Verify". Someone other than the person who put it forward checks it.' },
    { term: 'Closed', meaning: 'Checked and found put right.' },
    { term: 'As reported', meaning: 'Stands as the engineer reported it. On a project that uses review it reads "Not reviewed" until the report is reviewed.' },
    { term: 'Confirmed', meaning: 'The office confirmed the observation was right.' },
    { term: 'Disputed', meaning: 'The report it came from was sent back, so the office decides whether it stands.' },
    { term: 'Withdrawn', meaning: 'Raised in error. It stays on the register, marked withdrawn.' },
  ] },
  { heading: 'A variation', terms: [
    { term: 'Awaiting instruction', meaning: 'Raised, and the client has not yet said to do it.' },
    { term: 'Instructed', meaning: 'The client has said to do it; the office records their reference and who gave it.' },
    { term: 'Declined', meaning: 'Not going ahead. It stays on the register.' },
    { term: 'Done, not instructed', meaning: 'Work already carried out on a say-so. The office needs the client\'s written sign-off before it can be charged.' },
  ] },
  { heading: 'An inspection check', terms: [
    { term: 'Satisfactory', meaning: 'Checked and fine.' },
    { term: 'Action needed', meaning: 'Say what is wrong and what needs doing. On a safety inspection it stays on Safety actions until a later inspection finds it Satisfactory or Not applicable. On a handover inspection it becomes an issue on the snag list.' },
    { term: 'Not applicable', meaning: 'Nothing of this kind to check.' },
  ] },
];

/** Which tab someone lands on: engineers on site, everyone else in the office. */
export function defaultTab(role: string | undefined): HelpTab {
  return role === 'Engineer' ? 'site' : 'office';
}

export function readTab(raw: string | undefined, role: string | undefined): HelpTab {
  return raw === 'site' || raw === 'office' ? raw : defaultTab(role);
}

const forTab = (audience: HelpAudience, tab: HelpTab) => audience === 'all' || audience === tab;

export function whatsNewFor(tab: HelpTab, entries: readonly WhatsNew[] = WHATS_NEW): WhatsNew[] {
  return entries.filter(e => forTab(e.audience, tab));
}

export function linksFor(tab: HelpTab, links: readonly GuideLink[] = GUIDE_LINKS): GuideLink[] {
  return links.filter(l => forTab(l.audience, tab));
}

/** Pages only Managers and Admins can open; an engineer reading the office tab is not sent to them. */
const OFFICE_ONLY = ['/office', '/coverage', '/companies'];
export function canOpen(href: string, manager: boolean): boolean {
  if (manager) return true;
  const path = new URL(href, 'https://relay.invalid').pathname;
  return !OFFICE_ONLY.some(p => path === p || path.startsWith(`${p}/`));
}

/** Where each person's "seen" ids are kept on their device. */
export const seenKey = (principalId: string) => `relay-help-seen:${principalId}`;

/** The stored ids, or none if the value is missing or not a list of strings. */
export function readSeen(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * The entries for a tab this person has not seen. Someone who has never
 * opened Help has seen none, so everything for their tab counts as new.
 */
export function unseen(tab: HelpTab, seen: ReadonlySet<string>, entries: readonly WhatsNew[] = WHATS_NEW): WhatsNew[] {
  return whatsNewFor(tab, entries).filter(e => !seen.has(e.id));
}

/**
 * What to store after a visit: everything seen before plus everything shown
 * now, limited to ids that still exist so the list never grows without end.
 */
export function markSeen(seen: ReadonlySet<string>, shown: readonly WhatsNew[], entries: readonly WhatsNew[] = WHATS_NEW): string[] {
  const known = new Set(entries.map(e => e.id));
  return [...new Set([...seen, ...shown.map(e => e.id)])].filter(id => known.has(id));
}

/** "20 Oct", or "20 Oct 2025" when it is not this year. */
export function addedLabel(added: string, today: string): string {
  const d = new Date(`${added}T12:00:00Z`);
  const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return added.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${added.slice(0, 4)}`;
}

export interface GuideSection { id: string; heading: string; intro?: string; steps: readonly string[]; ordered: boolean }

/** How the day's work goes, in the order people do it. Button names match the screens. */
export const GUIDE: Record<HelpTab, readonly GuideSection[]> = {
  site: [
    { id: 'first-update', heading: 'Your first site update', ordered: true, steps: [
      'On your home screen, check the current project. "Change" picks another.',
      'Tap "Start a site update". Add a card for each thing you want to say: Progress, Defect, Variation or Access. Say where, what happened, and add photographs.',
      'It saves as you go, on the server and on your phone. Leave it whenever you like; it waits under "Unfinished reports".',
      'When you are done, sign and tap "Send to office". It is then on file and cannot be changed, only corrected.',
    ] },
    { id: 'after-send', heading: 'After you send', ordered: false, steps: [
      'Defect and Access cards become issues on the project\'s register. Variation cards become variations for the office to price. Each "Action needed" on a handover inspection becomes an issue too.',
      'Your home screen lists what came back from the office on the things you raised, in the office\'s words.',
      'The report itself shows each step it has reached: received, PDF, delivery and read. See "What the words mean" below.',
    ] },
    { id: 'defect', heading: 'A defect on its own', ordered: false, steps: [
      '"Flag a defect" sends a photograph and a short note straight away, without a site update. Use it when something needs fixing before you finish the day.',
    ] },
    { id: 'no-signal', heading: 'No signal', ordered: false, steps: [
      'RELAY still opens. You can start a site update or an inspection, add cards or answer checks, and take photographs; they are marked "Only on this phone".',
      'An inspection can be signed on the phone once every check is answered. Signing locks it and marks it "Signed · not sent yet". To change anything before RELAY starts sending it, take your signature back and sign again.',
      'When you have signal again, open RELAY and the work goes up by itself. A signed inspection goes to the office, and RELAY says when it has gone; if it changed after you signed, it stays a draft for you to sign again. Everything else stays a draft until you sign and send.',
      'If you share a phone, sign out at the end of the day. Work held on the phone belongs to whoever was last signed in.',
    ] },
    { id: 'wrong', heading: 'Got something wrong', ordered: false, steps: [
      'Before sending: change it. Removing a card or photograph offers "Undo".',
      'After sending: open the report and tap "Make a correction". It goes as a new revision with your reason, and the first stays on file.',
      'If the office sends a report back, it says why. Tap "Make the correction" on the report.',
    ] },
  ],
  office: [
    { id: 'office-day', heading: 'Your day in the office', ordered: true, steps: [
      'Office opens on the office position: new reports, reports not yet read, unassigned issues and issues ready to verify, across every project.',
      'Open a report and "Acknowledge" it once you have read it. That is the only thing that marks it read; receipt and delivery do not.',
      'Give each new issue an owner and a target date. Overdue issues and work done without an instruction are listed under "Also needs attention".',
      'Price variations, then record the client\'s instruction with their reference, or decline. Nothing is deleted.',
    ] },
    { id: 'verify', heading: 'Closing an issue', ordered: false, steps: [
      'Whoever does the work puts it forward as fixed. The issue then reads "Ready for verification".',
      'Someone else checks it and verifies it, which closes it, or reopens it with a reason. RELAY does not let the person who put it forward verify their own work.',
    ] },
    { id: 'review', heading: 'Review', ordered: false, steps: [
      'Review is off unless a project is set up to need it. When it is on, reports wait under "To review" until someone approves them or sends them back with a reason.',
      'Where review is off, issues read "As reported" and stand until someone confirms or withdraws them.',
    ] },
    { id: 'meetings', heading: 'For the site meeting', ordered: false, steps: [
      'Weekly summary puts a project\'s week on one page. Snag lists print the open issues for one company or trade. Site diary reads back every visit.',
      'Issues by company is the chase list; Site coverage shows which live projects have gone quiet.',
      'A project\'s own pages (Safety actions, Issues over time, Before handover, Site diary, Weekly summary, Photographs) are on its project sheet, under its figures. On a phone they are at the top of the project\'s register.',
    ] },
  ],
};
