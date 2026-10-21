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
  { id: 'registers-one-set', added: '2026-10-21', audience: 'all', title: 'Spreadsheets that match',
    text: 'The issue, variation, permit and toolbox talk spreadsheets now read as one set: each starts with its reference (where it has one), project number and project; days are written as dates and times in UK time so Excel can sort them; each event gives its date before who did it; and a withdrawn permit or talk keeps its row, saying when, by whom and why. The issue file calls the company that has to respond "Owner", as the register does. Files are named relay, the register, the project number when the file is for one project, and the day. In the office, Variations can now be ordered by any column, as Issues can (on a phone, from the Order list), and the download keeps that order; Issues lists its Project and Trade filters first, as Variations does. Opened in LibreOffice and a spreadsheet library in testing, not yet in Excel itself.' },
  { id: 'permits-to-work', added: '2026-10-21', audience: 'all', title: 'Permits to work',
    text: 'Record each hot works, isolation, roof or confined space permit when it is issued: the work and where, who issued it, who holds it and when it runs until. It stays under "Open now" until someone on the project closes it, ticking the closing check for its kind (for hot works, that the fire watch was kept for at least 60 minutes). A permit still open past its end time is marked red on your home screen and appears in the office\'s Needs attention. "Start from a recent one" fills in yesterday\'s permit again. The closing checks are a first draft, not yet read over by a site manager. RELAY does not issue permits and sends nothing to anyone; the spreadsheet download has every permit for an audit.',
    link: { label: 'Open Permits to work', href: '/permits' } },
  { id: 'first-day-pages', added: '2026-10-21', audience: 'all', title: 'Clearer on your first day',
    text: 'Pages with nothing on them yet now say so plainly and say what fills them. Issues over time no longer draws an empty chart and twelve weeks of noughts, Site coverage no longer calls every site "gone quiet" before any has sent a report, and the office overview says "Nothing has come in from site yet" and "No reports received yet" rather than "Every report has been read"; the Inbox, Issues and Variations say where their records will come from. If you have never opened Help, it now opens with How it works, nothing is marked new, and on site the link to it says "Start here". A draft with nothing on it says so in its preview and PDF.' },
  { id: 'toolbox-talks', added: '2026-10-21', audience: 'all', title: 'Toolbox talks',
    text: 'Record each safety briefing you give on site: the topic, the day, who gave it and the name of everyone who attended. Tap a topic to start from, or "Same people as the last talk" when the same gang is there. The page shows when the last talk was and how many there have been in four weeks, and downloads the whole record as a spreadsheet for an audit. A talk entered by mistake is withdrawn with a reason and stays listed. Toolbox talks are not part of any report and are not sent to anyone. Open it from "This project" on your home screen or from the office project sheet.',
    link: { label: 'Open Toolbox talks', href: '/toolbox-talks' } },
  { id: 'safety-in-needs-attention', added: '2026-10-21', audience: 'all', title: 'Safety in Needs attention',
    text: 'In the office, Attention and the Needs attention lists now include safety: a tower or podium due its inspection, the safety actions still open on a project (one line per project, with how many and the oldest), and a weekly safety inspection that is due. They come straight after a report that could not be processed, ahead of overdue issues, and each opens that project\'s Safety actions. On site, the Safety actions row on the home screen has a red edge while anything is open or due.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'inspection-pdf-found', added: '2026-10-21', audience: 'all', title: 'Inspection PDFs say what was wrong',
    text: 'In an inspection PDF, each row under "Actions arising" now says what was found ("Found: open edge with only a strap across it") above the action, so a client or contractor reading the first page knows what to put right without turning to the notes. Long notes are shortened there and point to the full notes further on. PDFs already made stay as they were.' },
  { id: 'editor-wide-screens', added: '2026-10-21', audience: 'all', title: 'Reports and inspections on a tablet or computer',
    text: 'On a tablet or a computer, the last buttons on a report or inspection are no longer hidden behind the bar at the bottom. The bar lines up with the page, and the check step puts signing beside what is being sent, with a larger box to sign in. A long list of checks scrolls in its own column and keeps the open check in sight. On every screen, a defect linked to an issue already raised takes that issue\'s trade, the check step says how many issues are new and how many add to ones already raised, and while changes are still being saved it says "being saved" rather than "not yet on the server".' },
  { id: 'assign-on-issue', added: '2026-10-21', audience: 'office', title: 'Assign from the issue itself',
    text: 'An issue opened from a search, a report or Issues by company now has "Who puts it right", with Assign or Reassign, a target date and an instruction, so you no longer go back to the desk to give it an owner. The companies already named on the project are suggested as you type. The issue now shows its target date, and its history says who each assignment went to and by when.' },
  { id: 'start-from-safety-actions', added: '2026-10-21', audience: 'site', title: 'Start the inspection that is due from Safety actions',
    text: 'On Safety actions, each project now has "Do a safety inspection", and each tower or podium has "Inspect", gold when it is due. It starts the inspection on that project, with the tower already named as it was last time, so its actions follow it. If you already have a safety inspection in draft on the project, the page carries on with it instead; with a tower inspection in draft, it offers to carry on with that one, and Inspect comes back once it is sent. When you are done, Back brings you to Safety actions. With no signal, start it from the Site page as before.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'day-walkthrough', added: '2026-10-21', audience: 'all', title: 'Smoother from one page to the next',
    text: 'The site home and the office overview now say how many safety actions are open, and on site whether a tower or the weekly safety inspection is due. With no signal the site home no longer shows "0 open issues": it says it cannot check with the office, and Notes for the next visit shows the copy kept on your phone. The office\'s "Received this week" keeps this week\'s notifications still to go apart from older ones, and the unfinished "Assigned to me" button has gone from Issues.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'same-words-reports', added: '2026-10-21', audience: 'all', title: 'The same words in reports and inspections',
    text: 'The report screen and the no-signal page now write dates the way the rest of RELAY does ("Wed 21 Oct, 14:05", no stray commas), count photographs as "photographs", and say "Back to …" naming where Back goes. On the no-signal page an inspection check asks the same questions as in RELAY: "What’s wrong", "What needs doing" and "Who is to do it" for an action, otherwise "Notes". In the PDF, photographs are dated "21 Oct 2026", signatures "21 Oct 2026, 14:05", and the visit date names the day.' },
  { id: 'busy-projects-faster', added: '2026-10-21', audience: 'all', title: 'Quicker on busy projects',
    text: 'On a project with a year or more of reports, the site home, Issues, the snag list and Photographs opened about twice as fast in tests on a slowed-down browser set up like a phone on 4G, and the site home now downloads a few kilobytes instead of every issue on the project. In the office the desk refreshes with a tenth of the data, and downloading the issue register as a spreadsheet takes a moment rather than half a minute. Nothing on the pages has changed.' },
  { id: 'site-notes-offline', added: '2026-10-21', audience: 'site', title: 'Read notes for the next visit with no signal',
    text: 'Notes for the next visit on your projects are now kept on your phone each time you open RELAY with signal, so you can read them in a basement or riser with none. The no-signal page shows them under each project, with when they were last updated. With no signal you can read them but not leave one or mark one done with; do that once you have signal again. Signing out takes them off the phone.' },
  { id: 'same-words', added: '2026-10-21', audience: 'all', title: 'The same words on every page',
    text: 'Pages built at different times now use the same words. An issue put forward as fixed reads "Fixed, to check" everywhere, where it was also "Ready for verification", "Awaiting verification" or "Verify". Dates read one way, such as "Wed 21 Oct", with a time where it matters. Project lists name each project by its number and name, issue and project pages have the same header as the rest of RELAY, and every Back link says where it goes.' },
  { id: 'tidier-pdfs', added: '2026-10-21', audience: 'all', title: 'Tidier report and inspection PDFs',
    text: 'Every page of a PDF now names the report, the project and, on a tower inspection, the tower. An inspection opens its results with a count of each result (say 12 checks: 10 satisfactory, 2 action needed), and its table headings carry on to the next page. Each action says who is to do it, the summary uses the same numbers as the updates, a correction says which revision it replaces and why, and a signature says whether it was drawn or typed and when. A card\'s words and its action, and the sign-off, now stay together on one page. PDFs already made stay as they were.' },
  { id: 'tower-inspection', added: '2026-10-20', audience: 'all', title: 'Tower inspection',
    text: 'Inspect a mobile tower or podium after it is put up or moved, and at least every seven days while it stays up. Tap "Do a tower inspection", say which tower (its tag number and where it stands) and answer 12 checks, from its tag to its guardrails and safe working load. Each "Action needed" goes on Safety actions under that tower until a later inspection of the same tower finds it put right, and Safety actions shows when each tower is due its next inspection. It works with no signal like the other inspections. The checks are a first draft and may change.',
    link: { label: 'Open Safety actions', href: '/safety-actions' } },
  { id: 'site-notes', added: '2026-10-20', audience: 'all', title: 'Notes for the next visit',
    text: 'Leave word on a project for whoever is on site next: where a key is, an area that is locked, what is coming up. Anyone on the project can leave a note or mark one done with, and each shows who left it and when. Notes are not part of any report and are not sent to anyone. Open it from "This project" on your home screen or from the office project sheet.',
    link: { label: 'Open Notes for the next visit', href: '/site-notes' } },
  { id: 'typed-signature', added: '2026-10-20', audience: 'all', title: 'Sign an inspection without drawing',
    text: 'If you can\'t draw a signature, with a keyboard or screen reader say, choose "Type my name instead" when you sign an inspection: type your full name and tick the statement. It works with no signal too. The office and the PDF show it as a typed signature, with the statement, the time it was sent and who was signed in, so it is never mistaken for a drawing. Drawing works as before.' },
  { id: 'company-chases', added: '2026-10-20', audience: 'office', title: 'Chase notes on Issues by company',
    text: 'Each company on Issues by company now has "Log a chase": a line on what was said and, if they gave one, the day they promised to be done by. The card shows who chased last, when and what was promised, and marks "Promise missed" once that day has gone with work still to put right. The notes stay in RELAY for the office and do not change an issue.',
    link: { label: 'Log a chase', href: '/companies' } },
  { id: 'first-fix-inspection', added: '2026-10-20', audience: 'site', title: 'First fix inspection',
    text: 'Walk an area before its ceilings and walls are closed and answer 12 checks on our first fix: run, supported, tested, labelled and clear of the boards. Each "Action needed" goes on the snag list as an issue when you send it, so nothing gets closed in unfinished. It works with no signal like the other inspections. The checks are a first draft and may change. Start it from "Do a first fix inspection" on your home screen.',
    link: { label: 'Go to your home screen', href: '/engineer' } },
  { id: 'home-sheet-tidy', added: '2026-10-20', audience: 'all', title: 'A tidier home screen and project sheet',
    text: 'The pages about a project are now in two groups, Issues and safety, and Reports and records, with the ones used most first. On your home screen My week and Help sit together at the foot. In the office the project sheet keeps them in one box under its figures, and on a phone they now show above the project\'s register, where before they could not be reached.' },
  { id: 'editor-easier-to-read', added: '2026-10-20', audience: 'site', title: 'Report screen easier to read and to tap',
    text: 'On the report screen and the no-signal page, buttons and suggestions are at least a fingertip tall, the gold "Send to office" button stays readable under a mouse, and Access tags are darker. With a keyboard or screen reader, "Next check" and "Check & send" now take you to what opens, each group of choices says what it is for, and the signature box says whether it is signed.' },
  { id: 'issue-trend', added: '2026-10-20', audience: 'all', title: 'Issues over time',
    text: 'See whether a project\'s issue list is getting shorter: for the last 12 weeks, how many issues were raised and closed each week and how many were still open, and past target, at the end of it. Opens from "This project" on your home screen and from the office project sheet.',
    link: { label: 'Open Issues over time', href: '/issue-trend' } },
  { id: 'office-desk-tidy', added: '2026-10-20', audience: 'office', title: 'A tidier office desk',
    text: 'Clicking a variation in the Variations register now opens it, the register fits a laptop screen without scrolling sideways, and the report stages in the Inbox reader no longer run into each other. Inbox, Issues and Variations each have Clear filters, and an empty list says what it means, such as "Every report has been read".' },
  { id: 'offline-sign', added: '2026-10-20', audience: 'site', title: 'Sign an inspection with no signal',
    text: 'With no signal, once every check is answered you can sign an inspection on the phone. It is marked "Signed · not sent yet" and goes to the office by itself the next time RELAY opens with signal, and RELAY tells you when it has gone. If anything changed after you signed, it is not sent: you check it and sign again.' },
  { id: 'before-handover', added: '2026-10-20', audience: 'all', title: 'Before handover',
    text: 'One page per project with everything RELAY still has open: snags on our work by trade, fixes waiting to be checked, handover inspections and their open actions, other trades\' issues, variations not yet instructed and open safety actions. Ready to print for the handover meeting.',
    link: { label: 'Open Before handover', href: '/handover' } },
  { id: 'easier-to-read', added: '2026-10-20', audience: 'all', title: 'Easier to read and to tap',
    text: 'Grey text is darker in the light theme and lighter in the dark theme, so it is easier to read outdoors or on a dim screen. On a phone, buttons, filters, tabs and Back links are at least a fingertip tall, and screen readers can now find the heading and main part of every office page.' },
  { id: 'editor-tidy', added: '2026-10-20', audience: 'site', title: 'A quicker, calmer report screen',
    text: 'On a phone the card you have open no longer repeats itself above and below, "Check & send" is no longer repeated inside each card (it stays at the foot of the screen), and an inspection just started lists its unanswered checks as one line rather than twelve. Optional suggestions are marked "Optional", so only a "Stop" stops you sending.' },
  { id: 'offline-inspection', added: '2026-10-20', audience: 'site', title: 'Start an inspection with no signal',
    text: 'With no signal, you can now start any inspection as well as a site update, answer its checks and take photographs. It goes up by itself once RELAY opens with signal; you sign it and send it then.' },
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
  { label: 'Safety actions', href: '/safety-actions', audience: 'all', text: 'What the safety and tower inspections found, until it is put right, and which towers are due.' },
  { label: 'Before handover', href: '/handover', audience: 'all', text: 'Everything still open on one project, as it nears completion.' },
  { label: 'Issues over time', href: '/issue-trend', audience: 'all', text: 'Whether a project\'s issue list is getting shorter, week by week.' },
  { label: 'Notes for the next visit', href: '/site-notes', audience: 'all', text: 'Word left on a project for whoever is on site next.' },
  { label: 'Toolbox talks', href: '/toolbox-talks', audience: 'all', text: 'Safety briefings given on a project and who attended, ready for an audit.' },
  { label: 'Permits to work', href: '/permits', audience: 'all', text: 'Hot works and isolation permits open on a project, until they are closed.' },
  { label: 'My week', href: '/my-week', audience: 'all', text: 'Your own week across every project.' },
  { label: 'Site coverage', href: '/coverage', audience: 'office', text: 'Which live projects have gone quiet.' },
  { label: 'Issues by company', href: '/companies', audience: 'office', text: 'Who to chase, for what, and what they promised last time.' },
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
    { term: 'Fixed, to check', meaning: 'Put forward as fixed and waiting to be checked. Someone other than the person who put it forward checks it and verifies it, which closes it.' },
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
    { term: 'Action needed', meaning: 'Say what is wrong and what needs doing. On a safety inspection it stays on Safety actions until a later inspection finds it Satisfactory or Not applicable; on a tower inspection, until a later inspection of the same tower does. On a handover or first fix inspection it becomes an issue on the snag list.' },
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
      'Defect and Access cards become issues on the project\'s register. Variation cards become variations for the office to price. Each "Action needed" on a handover or first fix inspection becomes an issue too.',
      'Your home screen lists what came back from the office on the things you raised, in the office\'s words.',
      'The report itself shows each step it has reached: received, PDF, delivery and read. See "What the words mean" below.',
    ] },
    { id: 'signing', heading: 'Signing an inspection', ordered: false, steps: [
      'An inspection is signed by the person who carried it out. Draw your signature in the box with a finger, pen or mouse.',
      'If you can\'t draw one, choose "Type my name instead", type your full name and tick the statement. It counts as your signature, and the office and the PDF show it as typed, with the time it was sent and who was signed in.',
      'A site update needs no drawing: your name is printed on it either way.',
    ] },
    { id: 'tower', heading: 'A tower or podium', ordered: false, steps: [
      'Inspect each mobile tower or podium after it is put up or moved, and at least every seven days while it stays up. Tap "Do a tower inspection" and say which one: its tag number and where it stands, such as "T3, level 2 east corridor". Use the same name each time, so its actions follow it.',
      'If the name is wrong, tap "Rename" under the title before you send. One tower inspection is open at a time: send it before you start the next.',
      'Safety actions lists each tower inspected in the last four weeks and when it is due again, with "Inspect" to start its next inspection under the same name. If a tower fails, take the insert out of its tag so nobody uses it, and say what needs doing on the check.',
    ] },
    { id: 'defect', heading: 'A defect on its own', ordered: false, steps: [
      '"Flag a defect" sends a photograph and a short note straight away, without a site update. Use it when something needs fixing before you finish the day.',
    ] },
    { id: 'no-signal', heading: 'No signal', ordered: false, steps: [
      'RELAY still opens. You can start a site update or an inspection, add cards or answer checks, and take photographs; they are marked "Only on this phone".',
      'An inspection can be signed on the phone, drawn or by typing your name, once every check is answered. Signing locks it and marks it "Signed · not sent yet". To change anything before RELAY starts sending it, take your signature back and sign again.',
      'When you have signal again, open RELAY and the work goes up by itself. A signed inspection goes to the office, and RELAY says when it has gone; if it changed after you signed, it stays a draft for you to sign again. Everything else stays a draft until you sign and send.',
      'Notes for the next visit on your projects show on the no-signal page too, as they were the last time RELAY opened with signal, and say when that was. You can read them there but not leave or mark one until you have signal.',
      'If you share a phone, sign out at the end of the day. Work held on the phone belongs to whoever was last signed in, and signing out takes your notes off it.',
    ] },
    { id: 'next-visit', heading: 'Passing word on', ordered: false, steps: [
      'Under "This project" on your home screen, "Notes for the next visit" shows what the last person left for you: a key, a locked area, what is coming up. Read it before you start.',
      'Leave a note there for whoever comes next. When a note no longer applies, tap "Done with"; it is kept for two weeks in case it is needed back.',
      'Your phone keeps a copy of the open notes each time RELAY opens with signal, so you can still read them in a basement or riser with none. Leaving a note or marking one done with needs signal.',
      'A note is not part of a report and goes to nobody. Anything the client or project manager needs to know still goes in a site update.',
    ] },
    { id: 'wrong', heading: 'Got something wrong', ordered: false, steps: [
      'Before sending: change it. Removing a card or photograph offers "Undo".',
      'After sending: open the report and tap "Make a correction". It goes as a new revision with your reason, and the first stays on file.',
      'If the office sends a report back, it says why. Tap "Make the correction" on the report.',
    ] },
  ],
  office: [
    { id: 'office-day', heading: 'Your day in the office', ordered: true, steps: [
      'Office opens on the office position: new reports, reports not yet read, unassigned issues and issues fixed and waiting to be checked, across every project.',
      'Open a report and "Acknowledge" it once you have read it. That is the only thing that marks it read; receipt and delivery do not.',
      'A report\'s signature line says whether it was drawn or typed. A typed signature shows the statement the person ticked and who was signed in when it was sent.',
      'Give each new issue an owner and a target date, from the desk or with "Assign" on the issue itself. Overdue issues and work done without an instruction are listed under "Also needs attention".',
      'Chase companies with late work from Issues by company, and log each chase there with what they promised, so the next person to ring them knows.',
      'Leave word for the engineers on a project under "Notes for the next visit" on its project sheet, and read what they left each other.',
      'Price variations, then record the client\'s instruction with their reference, or decline. Nothing is deleted.',
    ] },
    { id: 'verify', heading: 'Closing an issue', ordered: false, steps: [
      'Whoever does the work puts it forward as fixed. The issue then reads "Fixed, to check" on every page.',
      'Someone else checks it and verifies it, which closes it, or reopens it with a reason. RELAY does not let the person who put it forward verify their own work.',
    ] },
    { id: 'review', heading: 'Review', ordered: false, steps: [
      'Review is off unless a project is set up to need it. When it is on, reports wait under "To review" until someone approves them or sends them back with a reason.',
      'Where review is off, issues read "As reported" and stand until someone confirms or withdraws them.',
    ] },
    { id: 'meetings', heading: 'For the site meeting', ordered: false, steps: [
      'Weekly summary puts a project\'s week on one page. Snag lists print the open issues for one company or trade. Site diary reads back every visit.',
      'Issues by company is the chase list; Site coverage shows which live projects have gone quiet.',
      'A project\'s own pages (Safety actions, Issues over time, Before handover, Site diary, Weekly summary, Photographs, Notes for the next visit) are on its project sheet, under its figures. On a phone they are at the top of the project\'s register.',
    ] },
  ],
};
