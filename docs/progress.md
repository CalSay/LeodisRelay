# Progress log

Append one entry per thread, newest at the top. Keep each entry short:
what changed, how it was verified, what was not verified, and what comes next.
Earlier history is in `docs/optimisation-progress.md` and the dated docs.

## 2026-10-20 — EXP-5: second report type, a pre-handover inspection

- New report type on the #39 engine: a **handover inspection**
  (`Pre-Handover Inspection`, numbered `011LME-PHI-001`). An engineer walks
  one area before it is handed over and answers 12 fixed checks on Leodis's
  own M&E work: containment, pipework and ductwork, fittings, fire-stopping,
  access panels, ceiling voids ready to close, labelling, testing,
  commissioning, making good, clean and film off, and paperwork for the O&M
  manual. Answers are the same three (Satisfactory, Action needed, Not
  applicable); a drawn signature is required, as for a safety inspection.
- The one rule that differs: **each "Action needed" raises an issue** on the
  snag list when the inspection is sent, like a defect card on a site update.
  So an action also asks **Where** (required, with recent places offered),
  and the issue carries where, what is wrong, what needs doing, who, and the
  photographs. A safety inspection still raises nothing.
- Why this type and this rule: a pre-handover walk is the inspection an M&E
  site engineer does most after weekly safety, and the one the office and the
  client ask about ("is level 2 ready to close up?"). Unlike safety actions,
  what it finds is unfinished or faulty work of our own, which is exactly what
  the snag list tracks to closure; keeping those actions only on a PDF would
  make the type worse than a site update with defect cards. Raised issues go
  through the existing provisional/confirmed review and SharePoint issue sync
  unchanged. Not FE-2, EXP-2 or EXP-4: no new photo workflow, no routing,
  locations stay free text. The 12 checks are Claude's first set, kept in
  `HANDOVER_CHECKLIST` for Cal or a contracts lead to change.
- Built as framework, not a one-off: `raisesRecords` now also means "a
  checklist's actions raise issues" (`raisesIssue` in `lib/reportTypes.ts`),
  used by the issue store, corrections, the check step, the office sheet and
  the site diary. The engineer home shows one tile per checklist type
  (`CHECKLIST_TYPES`), so a third type needs no new home code.
- Corrections: a correction points each action at the issue it raised, so
  sending it adds a "Corrected in … rev 2" sighting rather than a second issue
  (as `correctReport` already does for defects). A save cannot set or drop that
  link itself (`invalidShape`). Sent revisions are untouched.
- Where it reads back: the check step ("1 issue raised · not yet reviewed",
  "raise issues"), the sent view, PDF and preview (actions and notes titled
  "question · where"), the office report sheet (each action links its issue
  instead of "On this inspection"), the site diary (card with where and its
  issue), the photo library, the notification email text (still held in the
  outbox). Weekly summary, My week, since your last visit, search and
  unfinished reports read the type's name already and needed no change.
- Verified on Node 24: `npm run typecheck`, `npm test` (6 new tests in
  `tests/handoverInspection.test.ts`), `npm run build`. New
  `scripts/verify-handover-inspection.mjs` passed (99 checks, 390px light and
  1440px dark): start from home beside the other two tiles, Where hidden until
  Action needed, all 12 answered, a missing Where stops sending and says why,
  the draft PDF's words, drawn signature, send, one issue raised with where,
  what, action, owner and photograph, no variation, sent view, site diary card
  naming its issue, the office sheet linking the issue, the issue page.
  Browser checks re-run: see the PR.
- Not verified: a physical phone, the PDF rendered by the worker after sending
  (the draft PDF uses the same renderer), SharePoint mode (no live tenant), and
  starting a handover inspection offline (the offline page starts site updates
  only; see the PR for how it reads a held one).
- Proposed next (not built): an area field on the inspection itself (one
  place for the whole walk, prefilled into each action); a third type such as
  a commissioning record with readings; let the office edit checklists; add
  `verify-handover-inspection.mjs` to the browser checks in `CLAUDE.md`.

## 2026-10-20 — Navigation and consistency pass

- Why: a dozen pages landed today, each from its own thread, and each named
  its Back link, browser tab and entry points its own way. Checked every page
  as an engineer and an office user at 390 and 1440px, then fixed what made
  people hunt. Layout, wording and navigation only: no feature removed, no
  change to what is saved.
- Back links now say where they go, in the words of that page's own
  navigation ("← Back to Reports", "← Back to Search results", "← Back to
  Office"). Before, most said "← Back", the snag list always said "Back to
  issues" even when opened from a weekly summary or the company page, and an
  issue, report or variation named its project even when it came from search.
  A detail page opened with no return path still names its project. One rule
  in `lib/viewNavigation.ts` (`viewName`, `backLabel`), with unit tests.
- Every page names its browser tab ("Site diary · RELAY", "011LME-ISS-301 ·
  Issue · RELAY", "Issues · Office · RELAY"). Before, every tab read "Relay",
  so tabs and the phone's app switcher could not be told apart. Server pages
  use Next metadata; the engineer views, office tabs and client detail pages
  use `components/PageTitle.tsx`.
- Engineer home: "This project" now also lists Photographs and Weekly
  summary, which were only reachable from the Reports view; "Latest reports"
  is "Reports" to match the bottom bar; "Your week" moved below the project
  rows, so on a phone the office's answers come first.
- Engineer Reports view: the five buttons wrapped unevenly. Now one action,
  then "Also on this project" with the four pages in an even two-column grid
  on a phone. Report dates read "visit Mon, 19 Oct", not "2026-10-19". The
  headings read "Reports" and "Issues", since the project band above already
  names the project. An empty first page says what will appear there.
- Office desk: the overview's Inbox, Variations and Issues buttons repeated the
  tabs right above them, and the project sheet repeated Inbox; removed so the
  pages the tabs do not reach (Site coverage, Issues by company, Weekly
  summary, Photographs, Site diary) stand out. "By company" is now "Issues by
  company". The top search's quick list matches references and titles only;
  it now ends with "Search the words in every report, issue and variation",
  which opens the full search on the same words and comes back to the same tab.
- Kept: the engineer Issues view's disabled "Assigned to me" button, which
  `docs/engineer-site-companion.md` records as a deliberate placeholder.
- Verified on Node 24: `npm run typecheck`, `npm test` (2 new tests),
  `npm run build`. New `scripts/verify-navigation.mjs` passed (74 checks: as an
  engineer at 390px light and 1440px dark, tab titles on every view, the home
  rows, Photographs and Back to Site, the Reports links and dates, no sideways
  scroll, Weekly summary and Back to Reports, Search from Reports, an issue
  from the results and Back to Search results with the search kept, the snag
  list and Back to Issues, an issue with no return path naming its project; as
  a manager at 1440px dark and 390px light, the desk and Issues tab titles, the
  overview without repeated tabs, Issues by company and Back to Office, the
  quick search handing over to the full search and Back to the same tab).
  Existing browser checks updated from "← Back" to "← Back to …" and re-run
  (results in the PR). Screenshots in the project's `ui-review/navigation/`.
- A fresh-context review found that a tab could keep the last screen's name
  after moving to a page with no title of its own (the report preview, for
  one), and that report dates had lost their year; both fixed (the year shows
  when it is not this year). `verify-snag-list.mjs` was failing on main since
  the phone "Order" select (#37) also matched the label "Project"; its locator
  is now anchored, and it passes.
- Not verified: a physical phone, Safari and Firefox, SharePoint mode.
- Proposed (not added to `docs/tasks.json`): add `verify-navigation.mjs` to
  the browser checks in `CLAUDE.md`; a "My week" link on the office desk for
  managers who visit site; one heading pattern for the standalone pages (some
  put the project in the heading, some above it).

## 2026-10-20 — EXP-5: report types, first type a safety inspection

- RELAY now has report types (`lib/reportTypes.ts`). The site update is
  unchanged and is still what every report without a `reportType` is. The
  first new type is a **safety inspection**: a weekly walk round Leodis's own
  work areas, with 12 fixed checks (housekeeping, access, work at height,
  temporary electrics, isolations, hot works, fire routes, PPE, COSHH, RAMS,
  storage, welfare). Each check is answered Satisfactory, Action needed or
  Not applicable. Action needed asks what is wrong and what needs doing
  (both required) and who is to do it and a photograph (suggested). It is
  started from a new "Do a safety inspection" tile on the engineer home and
  numbered in its own series (`011LME-SSI-001`).
- Shared, not copied: it uses the same draft, autosave, device copy, conflict
  choice, photographs, Undo, sending, revisions and corrections, PDF worker
  and preview as the site update. Its checks are stored as cards of kind
  `check` that keep the question they were asked, so a sent inspection reads
  the same if the wording changes later.
- Rules that differ from the progress workflow, as EXP-5 asks: every check
  must be answered; a drawn signature is required (checked on the device and
  again by the server); a save cannot add, remove, reword or retype a check
  (`invalidShape`, so a check cannot become a defect); sending raises no
  issues or variations, because safety actions are not defects in Leodis's
  work and would muddle snag lists and the company chase list. The actions are
  listed first on the PDF ("Actions arising") with who is to do each one.
- Read back everywhere sent reports are read: the PDF and on-screen document
  (title "Site Safety Inspection", "Inspection results" table, then notes and
  photographs only for checks with something to show), the office report
  sheet and register chips ("Safety inspection", "1 action"), the site diary
  (a summary line, only checks needing action or with notes or photographs as
  cards, and an "Inspections" filter), the weekly summary, since your last
  visit, search, the photo library, unfinished reports, the notification
  email text (still held in the outbox; nothing is sent).
- Why this type first: Cal did not name one, and under his instruction to
  decide without him it is the clearest structured inspection an M&E
  engineer does every week, it needs no client or legal wording, and it
  proves the engine handles a report that is not built from free cards and
  does not raise records. Not FE-2, EXP-2 or EXP-4: no new photo workflow, no
  routing, locations stay free text.
- Verified on Node 24: `npm run typecheck`, `npm test` (13 new tests in
  `tests/reportTypes.test.ts`; two existing tests now expect the extra
  `check: 0` kind count), `npm run build`. New
  `scripts/verify-report-types.mjs` passed (90 checks, 390px light and
  1440px dark): start from home, answer all 12 with one action and one N/A,
  photograph, signature required then drawn, send, server copy, no issue or
  variation raised, the draft PDF's words (via `pdftotext`), sent view, site
  diary, office sheet as a manager. Also passed unchanged:
  `verify-role-access`, `verify-engineer-layout`, `verify-signature-reload`,
  `verify-search`, `verify-report-editor`, `verify-undo-remove`,
  `verify-site-diary`, `verify-weekly-summary`, `verify-draft-conflict`,
  `verify-sent-elsewhere`, `verify-same-location`, `verify-suggestions`,
  `verify-unfinished-reports`, `verify-office-actions`, `verify-photo-library`,
  `verify-since-last-visit`, `verify-submission-stages`,
  `verify-offline-drafts`, `verify-engineer-nav`, `verify-photo-uploads`,
  `verify-review-queue`, `verify-issue-link`, `verify-office-landing`.
- Fresh-context review found three places still reading an inspection as a
  site update (the office project register's "progress only", the
  sent-elsewhere panel naming cards by location, the offline recovery page
  heading every check "Update"); all three now show the question and answer.
- Merged main after #37 and #38: "My week" (#38) now names an inspection
  and its actions instead of counting its checks; `verify-my-week` passed.
- Not verified: a physical phone, the PDF rendered by the worker after
  sending (the draft PDF uses the same renderer), SharePoint mode (no live
  tenant). Wording of the 12 checks is a first set for Cal or the H&S lead to
  change in `SAFETY_CHECKLIST`.
- Proposed next (not built): let the office edit the checklist; track
  inspection actions to closure (a light action list, or raising them as
  issues if Cal prefers); more types on the same engine, such as a
  pre-handover area inspection or a commissioning record; add
  `verify-report-types.mjs` to the browser checks list in `CLAUDE.md`.
## 2026-10-20 — My week (new feature, proposed as NEW-9)

- New `/my-week` page: the signed-in person's own week, Monday to Sunday,
  across every project open to them. Each day lists the projects they have
  records on: reports they sent (placed on the visit day they gave, with what
  the cards found and where), defects they flagged on their own, and updates
  or fixes they recorded on an issue page. Their drafts for the week are
  marked "Not sent yet" with a note above the days. Headline counts, week
  stepping, and "Copy for my timesheet", which copies one plain line per
  weekday (weekends only with records) naming each project and what was
  recorded, up to today. Reached from "Your week" on the engineer home and a "My week"
  button on the engineer Reports view. New `GET /api/my-week`.
- Why this feature: an engineer's week is spread over several projects, and
  filling in a timesheet or answering "where were you on Tuesday?" meant
  opening each project's reports in turn. The page gives them something back
  for every report they send, which makes sending them worth it. Nothing is
  typed in, stored, sent or written to SharePoint. Not FE-2 (photographs are
  only counted), EXP-2 (no requests or routing) or EXP-4 (locations stay free
  text, shown as written). Not the parked sole-trader product: there are no
  hours, jobs, rates or invoices, only what was already recorded.
- Decisions: every role may open it, and it only ever shows the person's own
  records (reports by `authorId`, issue events by `actorId`), so a manager
  who visits site gets the same page. A sent correction stands in for the
  report it corrects. Issue events that came in with a report are left out
  (the report already shows), as are office decisions (assigning,
  verifying), which are desk work, not a record from site. Issue changes are
  placed by their UK day. Drafts do not make "a day with records" and are left
  out of the copied text, since the office does not have them. RELAY knows no
  hours, and the page says so. Dates are spelt out in code (`dayLabel`), not
  by the browser, because Chromium writes "Mon, 19 Oct" where Node writes
  "Mon 19 Oct", and the mismatch broke the first paint. Rules in
  `lib/myWeek.ts` (pure); same project rule as the weekly summary.
- Verified on Node 24: `npm run typecheck`, `npm test` (6 new tests in
  `tests/myWeek.test.ts` and one in `tests/viewNavigation.test.ts`),
  `npm run build`. A fresh-context review found the copied text claimed
  "nothing recorded" for days still to come; fixed. New `scripts/verify-my-week.mjs` passed (30 checks:
  signed-out refusals; from the engineer home at 390px light, both projects on
  Monday, another engineer's report and defect left out, last week left out,
  the flagged defect and the issue update today but not the office's
  verification, a corrected report once at rev 2, the draft marked, the
  counts, no sideways scroll, the copied text, week stepping and Back to the
  same week; from the Reports view at 1440px dark and printed on white; a
  manager sees nobody else's records). `verify-engineer-layout`,
  `verify-role-access` (61), `verify-unfinished-reports`,
  `verify-weekly-summary`, `verify-engineer-nav`, `verify-site-diary` and
  `verify-photo-library` passed.
  Screenshots in the project's `ui-review/my-week/`.
- Not verified: a physical phone, Safari and Firefox, the clipboard on iOS
  (the page falls back to a text box to copy from), SharePoint mode (no live
  tenant).
- Proposed task (not added to `docs/tasks.json`): "NEW-9 My week — each
  person sees their own week across every project, day by day, from what they
  recorded, and can copy it for a timesheet; own records only; browser check
  at 390 and 1440px." Proposed: add `verify-my-week.mjs` to the browser checks
  list in `CLAUDE.md`. Possible follow-up: a link to My week from the office
  desk for managers who visit site.

## 2026-10-20 — Unsaved changes when a draft is sent from another screen (FE-3c follow-up)

- Before: if a draft was sent from another tab or device while this screen
  held changes the server never had, every later save was refused with "This
  report has already been submitted", the save state said "Not saved — check
  connection", and the changes stayed stuck in the editor and the device's
  held copy with no way forward. A held copy found after a reload was
  ignored and left on the device.
- Now the screen switches to the sent report with a "Sent from another
  screen" panel above it: when it was sent, how many changes on this screen
  were not in it, and each one by card ("Changed here", "Added here",
  "Removed here"). Two actions: "Start a correction with my changes" (with a
  suggested reason the engineer can change) and "Discard my changes" (asks
  first). Until one is chosen the changes are set aside on the device under
  this tab's key, so a reload comes back to the same panel. A screen with
  nothing unsaved just shows the sent report.
- Starting the correction makes the usual rev + 1 draft and saves the
  changes into it at once, then opens it. The sent revision and its snapshot
  are never changed. Defect and access cards keep the issue link the
  correction gives them, so sending it adds sightings, not new issues.
- Server: a draft save refused because the report was sent now answers like
  any other refused save (409 with `current`, the sent report, to the author
  only), including the retried-request path. Tabs also announce a send, and a
  check for a newer copy now looks at the state first, since sending changes
  no version.
- Decisions: what goes into the correction is the sent report with this
  screen's own changes laid on top (`lib/sentElsewhere.ts`). Where the screen
  knows the server copy it built on, a card the other screen changed or
  removed, and this one left alone, keeps the sent version, so starting a
  correction never quietly undoes what was sent. Where both changed a card,
  or the base is unknown, this screen's wording goes in and the card says to
  check it: the engineer chose to carry their changes, the sent wording stays
  on file in the sent revision, and the correction is checked before it is
  sent. The base is also known after a reload when the held copy was built on
  the version that was sent (sending does not change the version). The
  signature is not carried; a correction is signed when it is sent. If a
  correction to the report already exists and has been changed, or the save
  into it is refused, the changes are set aside against it at version 0, so
  its editor shows the existing FE-3c comparison before anything is saved;
  with no connection they are held on the device and save when it opens. If
  this device holds unsaved work for that correction, the panel says to open
  it first (with a link) rather than set it aside on top. If a correction was
  already sent, the changes are judged again against that revision with the
  same base and carried into a correction of it, so its changes are not
  undone either.
- A card one screen removed while the other edited it is kept in the
  correction and listed with a note ("Removed here, kept", or "The other
  screen removed this card before sending"), so neither side is dropped
  without being shown. With no base, a card only in the sent report may have
  been removed here, so it is kept and listed ("Not on this screen") rather
  than counted as nothing. The set-aside copy keeps the version the work was
  built on, so a reload gives the same offer. When the changes are set aside
  against an existing correction, its base is the cards a correction starts
  with, so the comparison suggests keeping edits already made to it.
- Verified on Node 24: `npm run typecheck`, `npm test` (9 new tests in
  `tests/sentElsewhere.test.ts`: what is carried with and without a base,
  both-changed cards, a card removed on one side and edited on the other, issue links, a save refused with the sent report on
  the real store including the retried-request path, and the changes saved
  into a new correction while the original stays as sent), `npm run build`.
  New `scripts/verify-sent-elsewhere.mjs` passed (33 checks: two tabs on a
  phone at 390px light, one sending through the UI while the other held an
  edit; the panel, a reload, the correction opening at rev 2 with the change
  saved and nothing left held for the sent report; a laptop at 1440px dark
  offline while another device changed and sent the draft: an edit and an
  added card listed, the other device's change not listed, a tab with
  nothing unsaved taking the sent report quietly, Discard asking first and
  leaving nothing held, no correction made). `verify-draft-conflict`,
  `verify-report-editor`, `verify-engineer-layout`,
  `verify-signature-reload`, `verify-role-access`,
  `verify-unfinished-reports`, `verify-offline-drafts`,
  `verify-submission-stages`, `verify-undo-remove` and `verify-photo-uploads`
  passed. Screenshots in the project's `ui-review/sent-elsewhere/`.
- Not verified: a physical phone, Safari and Firefox, two devices on a real
  network (a direct store write and send stands in for the other device), a
  screen reader. Proposed: add `verify-sent-elsewhere.mjs` to the browser
  checks list in `CLAUDE.md`.

## 2026-10-20 — Register spreadsheets (new feature, proposed as NEW-8)

- The office issue register and variation register each have a "Download
  spreadsheet" button that saves a CSV file which opens in Excel. The issue
  file holds the register's current search on every page, not just the 50
  shown, in the register's order and with its filters (view chip, project,
  trade, location, company, verification, sort), from a new office-only route
  `GET /api/issues/export`. The variation file holds the rows on screen in
  their order; it is built in the browser because the office desk already
  holds every variation it may see. Files are named
  `relay-issues-2026-10-20.csv`, with the project number when the search is
  one project's.
- Why this feature: progress meetings, client updates and subcontractor
  chasing all happen in spreadsheets, and the office had no way to take the
  registers out of RELAY except by copying rows from the screen. A download
  is for the person who asked for it: nothing is sent, emailed or written to
  SharePoint. Not EXP-2 (no requests or routing) and not EXP-4 (locations
  stay free text).
- Decisions: office only (Managers and Admins); engineers get a 403, as for
  open issues by company. Columns keep the registers' facts and mostly their
  words (work and confirmation as two facts; the register's "Verify" tag is
  spelt out as "Fixed, waiting for verification" because a sheet has no
  colour or hint to explain it; "As reported" where review is off, the
  verification words of the filter, "Done, not instructed"), and money,
  margin and days past target are numbers so the sheet can add them up;
  margin is blank for a declined variation, as on screen. The register's
  margin % now uses `marginPct` too, so a variation quoted at £0 shows a
  blank % on screen and in the file instead of a huge figure. Text that Excel
  would run as a formula (starting =, +, -, @) is led with an apostrophe, and
  the file starts with a byte-order mark so £ and accents read correctly.
  A report that raised an issue but is not to hand is written "Report", not
  guessed. Rules in `lib/registerExport.ts` (pure).
- Verified on Node 24: `npm run typecheck`, `npm test` (6 new tests in
  `tests/registerExport.test.ts`), `npm run build`. New
  `scripts/verify-register-export.mjs` passed (23 checks: signed-out and
  engineer refusals, the whole open register over two pages in the
  register's order, a narrowed search and its project file name, the closed
  filter, formula-safe and quoted cells, days past target, the variation file
  matching the rows on screen with its figures, no button when nothing is
  shown, 1440px dark and 390px light). `verify-issue-register` (70),
  `verify-role-access` (61), `verify-office-actions` (41),
  `verify-office-phone` (95) and `verify-company-issues` (28) passed.
  Screenshots in the project's `ui-review/register-export/`.
- Not verified: opening the files in Excel itself (checked by parsing the
  CSV), a physical phone, SharePoint mode (no live tenant).
- Seen, not changed: at 390px the office issue register's table is wider
  than the screen and the page scrolls sideways (before this change too).
  Proposed follow-up: give the register a card layout on phones.
- Proposed task (not added to `docs/tasks.json`): "NEW-8 Register
  spreadsheets — the office downloads the issue register's current search
  (all pages) and the variation register as CSV files; office only; browser
  check at 390 and 1440px." Proposed: add `verify-register-export.mjs` to the
  browser checks list in `CLAUDE.md`.

## 2026-10-20 — Office registers on a phone (UI fix, follow-up from #35)

- On a phone (700px and narrower) the office issue register, variation
  register, inbox (received and drafts), team roster and the admin roster,
  older drafts and notifications tables now show one card per row. Each card
  leads with the reference and the title, then labelled lines (Project,
  Raised, Owner, Target, Work, Confirmation; Quoted, Instructed, Margin on a
  variation), then the row's buttons at full touch size. A tappable card shows
  a "›". The desk keeps its tables unchanged.
- The problem: at 390px the issue register pushed the whole page 666px
  sideways (the hidden "Actions" heading sat outside the scrolled panel), and
  the other registers were 640–1365px tables scrolling inside their panel, so
  the buttons were off screen.
- Decisions: cards rather than a narrower table, because nine columns cannot
  be read side by side on a phone and the actions need to be reachable. One
  shared rule (`table.reg.cards` plus `data-label` on cells in
  `workspace.css`) so every office table behaves the same. Work and
  Confirmation stay as two labelled lines, as on the desk. The column headings
  carry the sort on the desk; on a phone they are hidden, so the issue
  register gets an "Order" list (priority, target date, raised newest or
  oldest, owner, project, reference) in place of the "Sort: priority" chip.
  Filter boxes stack as aligned rows at least 40px tall. FE-5a filters, the
  #26 office position and the #35 downloads are unchanged.
- Verified on Node 24: `npm run typecheck`, `npm test` (145 package + 213 web),
  `npm run build`, new `scripts/verify-office-registers.mjs` (247 checks: no
  sideways scroll and every card inside its panel for all eight views, each
  with rows (issues, variations, inbox, drafts, team, admin roster,
  notifications with a long failure message, older drafts) at 320px and 390px
  light and dark; labels, wrapping, 44px buttons, card and button
  taps, filters and the order list on a phone; headings, one-line actions and
  column sorting at 1440px). Also passed: `verify-issue-register`,
  `verify-office-phone`, `verify-office-actions`, `verify-register-export`,
  `verify-role-access`, `verify-office-landing`, `verify-review-queue`.
  Screenshots in the project's shared files (`ui-review/office-registers/`).
- Not verified: a physical phone. Proposed next: add
  `verify-office-registers.mjs` to the browser checks in `CLAUDE.md`.

## 2026-10-20 — EXP-1: living site diary

- New `/diary` page: a project's visits, newest day first, made only from
  reports already sent. No diary entry is ever typed. Each day names who was
  on site; each entry is one report at its latest sent revision, with every
  card (kind, location, words, action needed, who, up to four photograph
  thumbnails and a "+n" link to the rest) and the issue or variation the card
  raised or was a further sighting of, with that record's state now.
- Provenance: the reference links the exact revision shown; a corrected report
  shows "Corrects rev N" with the reason and links every earlier sent revision.
  A correction still in draft changes nothing. Cards are matched to issues and
  variations by `raisedByObservation` across the whole revision chain, so a
  record raised by rev 1 still shows on rev 2; a record read back from
  SharePoint without that ID is matched by location and words, as
  `correctReport` does.
- Find box (words, names, references, photo captions) and kind filter
  (Progress, Defects, Access, Variations); a filtered entry says "Showing 1 of
  3 cards". Ten site days a page with "Show earlier days". The address keeps
  project, words and filter, so a report opened from the diary comes back.
  Opened from the engineer home ("This project"), the engineer Reports view
  and the office project actions.
- Decisions: entries come from reports only (acceptance: "built only from
  existing report data"); office-side issue changes (assign, close) stay on the
  issue page and in the weekly summary rather than mixing a second source into
  the diary. Every role on the project reads it, with the same report rule as
  elsewhere (sent reports only). Paged on the server by site day, so a long
  project does not send every report at once. Rules in `lib/siteDiary.ts`
  (pure), API `GET /api/site-diary`.
- Verified on Node 24: `npm run typecheck`, `npm test` (8 new tests in
  `tests/siteDiary.test.ts`), `npm run build`, new
  `scripts/verify-site-diary.mjs` (35 checks, 390px light and 1440px dark).
  `verify-role-access`, `verify-engineer-layout`, `verify-weekly-summary`,
  `verify-photo-library`, `verify-engineer-nav` and `verify-office-landing`
  passed. Screenshots are in the project's shared files
  (`ui-review/site-diary/`), not the repo.
- Not verified: a physical phone, a live SharePoint tenant. Proposed next:
  print or save a date range of the diary as a PDF; jump to a date; add
  `verify-site-diary.mjs` to the browser checks list in `CLAUDE.md`.

## 2026-10-20 — Open issues by company (new feature, proposed as NEW-7)

- New office page `/companies`, opened from "By company" on the office
  overview and on the Issues register: one card per company or person named
  as an issue owner, across every project open to the manager. Each card
  gives what is still to put right, how much is past target, what has been
  marked fixed and waits for the office to check, and what was verified and
  closed in the last 4 weeks; the item waiting longest (linked, with its
  age); the trades involved; and one line per project with a "Snag list"
  button for that company and project. Headline counts across the top, a
  note when open issues have nobody named (linking to the register), and a
  "Find a company or person" box kept in the address.
- Why this feature: chasing subcontractors is a weekly office job, and the
  snag list (NEW-2) works one project at a time, so answering "what does
  Acme still owe us, and how late is it?" meant opening every project. This
  was the snag list thread's suggested next step. It reads the issue
  register only: no new store, no SharePoint write, no email, nothing sent
  to the company.
- Decisions: office only (Managers and Admins), like site coverage;
  engineers get a 403 from `/api/company-issues` and are sent to the hub
  from the page. Owners are free text, so a company is matched ignoring case
  and spacing (as the snag list does) and labelled as its earliest issue
  spelled it; "Acme" and "Acme Ltd" stay two, as said on the page, rather
  than guessing. Withdrawn issues are left out; a target of today is not late; work
  marked fixed but not yet checked still counts as past target once its
  target has gone, the issue register's and snag list's rule, so the
  counts agree with the snag list each line opens (the review caught a
  first version that differed). "Closed lately" counts issues
  closed now whose last office verification fell in the last 28 days, so a
  company with only finished work still shows ("All clear"), and good work
  is seen as well as late work. Cards are ordered most past target first,
  then most to put right. Issues count on every reportable project (active or defects
  liability) the person may open, the issue register's rule. Each project
  line opens its snag list with the company as written on that project. Not EXP-2
  (no requests or routing, nobody is contacted), not EXP-4 (no locations).
  Rules in `lib/companyIssues.ts` (pure).
- Verified on Node 24: `npm run typecheck`, `npm test` (8 new tests in
  `tests/companyIssues.test.ts`, 1 in `viewNavigation.test.ts`), `npm run
  build`. New `scripts/verify-company-issues.mjs` passed (28 checks:
  signed-out and engineer refusals, links from the overview and the
  register, order, per-company and headline counts, two spellings as one,
  withdrawn left out, oldest item and its age, recent closures, nobody
  named, finding a company, a snag list opened for that company and project
  and Back keeping the search, 1440px dark and 390px light with no sideways
  scroll and 44px snag list links). `verify-role-access` (61), `verify-office-landing` (19),
  `verify-office-actions` (41), `verify-office-phone` (95),
  `verify-snag-list` (24), `verify-site-coverage` (30) and
  `verify-issue-register` (70) passed. Screenshots in the
  project's `ui-review/company-issues/`.
- Not verified: a physical phone, SharePoint mode (no live tenant), a
  register with thousands of issues (it reads the whole authorised register
  per request, as the register's own counts do).
- Proposed task (not added to `docs/tasks.json`): "NEW-7 Open issues by
  company — the office sees each company's open, past-target, to-check and
  recently closed issues across every project, with each project's snag
  list; browser check at 390 and 1440px, light and dark." Proposed: add
  `verify-company-issues.mjs` to the browser checks list in `CLAUDE.md`.

## 2026-10-20 — FE-6b: traceable corrections and revisions

- Issue history events now record the report revision behind them: an
  optional `source` with the report ID, reference, revision, the update
  (observation) ID and, for a correction, the report it corrects. Set on the
  "raised" event, on a sighting added from a later report or a correction,
  and on the confirm or dispute recorded when a report is reviewed. Changes
  made on the issue itself (assign, close, verify, notes) carry none.
- The issue page shows each one under the actor as a link to that report,
  e.g. "From 011LME-SPR-001 rev 2, which corrects rev 1" or "Review of …".
  Issues recorded before this keep no source; their first "raised" event
  still links the report that raised it ("From the report that raised it")
  from `raisedByReport`, which never changes. Older sightings are not
  guessed from their note text.
- Already in place and now tested: `correctReport` makes a new draft with its
  own ID at revision + 1, and neither opening nor sending it touches the
  original report or its sent snapshot.
- Decisions: provenance is a structured field on the event rather than more
  note text, so the site diary (EXP-1) can build on it without parsing. The
  corrected revision is shown as rev − 1, since a correction is only made
  from a sent report and takes its revision + 1. Events stay in RELAY's store
  only (SharePoint issue sync keeps the local history), so nothing changes in
  SharePoint. The report link has a 32px tap height.
- Verified on Node 24: `npm run typecheck`, `npm test` (8 new tests in
  `tests/issueProvenance.test.ts`), `npm run build`, new
  `scripts/verify-issue-provenance.mjs` (18 checks, 390px light and 1440px
  dark). `verify-role-access`, `verify-issue-register`,
  `verify-engineer-layout`, `verify-search`, `verify-weekly-summary`,
  `verify-since-last-visit` and `verify-photo-library` passed. Screenshots in
  the project's `ui-review/issue-provenance/`.
- Not verified: a physical phone, a live SharePoint tenant. Proposed: add
  `verify-issue-provenance.mjs` to the browser checks list in `CLAUDE.md`.
  Next on this lane: EXP-1 (living site diary), which can now link each
  entry to its report and revision.

## 2026-10-20 — FE-1c: suggest responsible companies and locations

- "Who needs to respond" on a defect or access card now shows Recent
  companies under the box: what was typed there on this project's sent
  reports, plus the owner the office gave an issue, newest first (three shown,
  "Show N more" for up to twelve). A tap fills the box; the hint says "Choose
  one or type any name". Where keeps its Recent places chips, now drawn by the
  same rule. Both chip sets share one small component in the editor.
- Rules in `lib/suggestions.ts` (pure, tested): only the same project; only
  sent reports, issues and variations, so words typed only in someone's draft
  are never shown to anyone else; wording that differs only in case or
  spacing is one chip, shown as last typed; blank and placeholder answers
  ("unknown", "TBC", "n/a" and similar) are left out. An issue owner counts
  from the issue's latest event, so a fresh assignment by the office ranks
  near the top. Nothing is set up or maintained and nothing has to match
  (EXP-4).
- Decisions: progress and variation cards are not a source, because their
  owner field is not "who must respond". "Who asked for it" on a variation is
  a person on site, not a responsible company, so it is not suggested either.
  The existing `/api/locations` route returns both lists (one request per
  report) rather than adding a second route.
- Verified on Node 24: `npm run typecheck`, `npm test` (5 new tests in
  `tests/suggestions.test.ts`), `npm run build`. New
  `scripts/verify-suggestions.mjs` passed (20 checks, 390px light and 1440px
  dark: companies from sent reports newest first, a name only in another
  engineer's draft not offered, places still shown without draft-only
  places, a tap fills and saves, new wording is accepted and saved, no
  sideways scroll). `verify-report-editor`, `verify-engineer-layout`,
  `verify-same-location`, `verify-issue-link`, `verify-draft-conflict` and
  `verify-undo-remove` passed after merging #30. Screenshots in the
  project's `ui-review/suggestions/`.
- Not verified: a physical phone. Proposed: add `verify-suggestions.mjs` to
  the browser checks list in `CLAUDE.md`. Next in the editor lane: offer a
  correction when a draft was sent from another tab while this tab has
  unsaved changes (follow-up from #23).

## 2026-10-20 — FE-1d: undo removing a card or photograph

- Removing a card or a photograph in the report editor still happens at
  once, but a bar now appears above the action bar saying what went ("Card 02
  removed · Defect · Level 2 riser · 2 photos", or "Photo 01 removed" with its
  caption) with Undo and a close button. Undo puts back the same card or
  photograph, with its id, words, photos and caption, in the place it came
  from, and opens the card.
- Decisions: Undo stays for 12 seconds, and holds while it has focus or a
  pointer over it, so it is there when reached for but does not linger over
  the action bar. One at a time: a second removal replaces the first, which
  stands. The removal saves as normal (the device copy and the server stay
  current); putting back is one more save of the same record, not a copy, and
  photographs already on the server are not uploaded again. A quick remove and
  undo lands as a single save, as the autosave pause folds the two together.
  Undo is withdrawn when two versions of the draft need choosing between,
  and cannot be pressed while the report is sending. The Remove buttons now
  say which card or photo they remove to a screen reader; removing moves
  focus to Undo (the pressed button has gone), Undo returns focus to the
  restored card's or photo's Remove button, closing the bar returns it to the
  Cards step, and every removal is announced, even two worded the same. Rules in `lib/undoRemove.ts` (pure).
- Verified on Node 24: `npm run typecheck`, `npm test` (8 new tests in
  `tests/undoRemove.test.ts`), `npm run build`. New
  `scripts/verify-undo-remove.mjs` passed (82 checks, 390px light and 1440px
  dark: bar wording, 44px Undo on screen, card and photo back in place with
  the same ids on the server, one save and no upload on undo, a quick undo is
  one save, focus on Undo and back on the restored item, one bar at a time,
  Dismiss keeps the removal, the bar stays while focused and goes by itself
  once left, no sideways scroll). `verify-report-editor` (58),
  `verify-engineer-layout`, `verify-same-location` (54),
  `verify-draft-conflict` (23), `verify-photo-uploads` (22),
  `verify-issue-link` (39) and `verify-signature-reload` passed. Screenshots
  in the project's `ui-review/undo-remove/`.
- A photograph stored inline in a draft from before the upload service could
  not be put back once its removal had saved (the server keeps only inline
  photographs it already holds), so removing one, or a card holding one,
  offers no Undo rather than an Undo that would fail.
- Not verified: a physical phone, a screen reader. The
  single defect form (`IndividualDefect.tsx`) has no undo for removing a
  photo; proposed as a follow-up. Proposed: add `verify-undo-remove.mjs` to
  the browser checks list in `CLAUDE.md`. Next in the editor lane: FE-1c.

## 2026-10-20 — Release readiness check on main

- Ran everything on main at 1343f3c (#2 to #27) under Node 24: `npm ci`,
  `npm run typecheck`, `npm test` (145 package + 168 web tests),
  `npm run build` and all 23 `scripts/verify-*.mjs` browser checks. All
  passed, including `verify-pdf-navigation` (CLAUDE.md still says it fails
  on main; #7 fixed that). Proposed: drop that note from `CLAUDE.md`.
- One fault between changes found and fixed: the draft conflict work (#23)
  keeps a set-aside copy of a draft under its own key while the engineer
  chooses between two versions. The offline page (`public/offline.js`) lists
  every held copy, so it showed the same report twice with the same name,
  and opening a report there could have picked either. The set-aside copy
  is now named "(copy kept while choosing between two versions)" and the
  ordinary copy opens first. Both stay listed, so nothing held on the phone
  is hidden. The service worker cache is now `relay-public-v4`, because it
  serves `offline.js` from its cache and phones would otherwise keep the old
  file.
- Verified: new `scripts/verify-offline-drafts.mjs` (5 checks; the old page
  showed two identical buttons), typecheck, tests, build.
- Deploy findings (nothing deployed, server not touched): no new environment
  variables, no database migration (two new optional fields on reports only),
  no new storage. `deploy/upgrade-pilot.sh` backs up the data volume, builds
  and swaps the image, and `deploy/rollback-roles.sh` returns the previous
  image. Release notes and steps are in the Claude
  project's shared files (`releases/2026-10-20-release-notes.md`), not in
  this repository.
- Not verified: a Docker image build (no Docker daemon in the cloud
  session), the server itself, a live SharePoint tenant, real phones.

## 2026-10-20 — FE-1b: another card at the same location

- An open card with a location now offers "+ Another card here", with the
  place named under it, above "Done with this card" / "Add another card". It
  starts a new card with only Where filled in, opens it on the kind picker,
  and places it straight after the source card (after any cards already
  added there, so a run for one room stays together in the order added).
  Cards with no location do not offer it.
- Nothing else carries over: what happened, action, who needs to respond,
  photographs, a linked issue, trade and the variation answers all stay with
  the earlier card, and the new card has its own id. Rules in
  `lib/sameLocation.ts` (pure).
- Decisions: the engineer still picks the kind (one tap) rather than copying
  it, because the next thing in the same room is as often a defect as more
  progress. The new card goes next to its source rather than at the end, so
  the report reads room by room. Locations stay free text; matching is exact
  wording ignoring case and outer spaces, used only for placing the card.
- Verified on Node 24: `npm run typecheck`, `npm test` (3 new tests in
  `tests/sameLocation.test.ts`), `npm run build`. New
  `scripts/verify-same-location.mjs` passed (54 checks, 390px light and
  1440px dark: no action without a location, the action names the place,
  the new card opens next to its source with Where filled in and no words or
  photos, a second one goes after the first, and the server's copy has only
  the location while the source keeps its photo and answers). Screenshots in
  the project's `ui-review/same-location/`. `verify-report-editor` (58),
  `verify-engineer-layout`, `verify-draft-conflict` (23), `verify-issue-link`
  (39) and `verify-photo-uploads` (22) passed.
- Not verified: a physical phone. Proposed: add `verify-same-location.mjs`
  to the browser checks list in `CLAUDE.md`. Next in the editor lane: FE-1d
  (undo removing a card or photo), then FE-1c.

## 2026-10-20 — Office actions on a phone (proposed UI-3, follows FE-4b)

- On a phone the office desk now opens on the office position, with the
  project list after it. Before, a phone showed only the project list, so a
  manager away from a desk never saw New reports, Not yet read, Unassigned
  issues or Ready to verify (FE-4b, #15) without a laptop.
- Under the office position's title, a phone shows the four counts as a 2×2
  set of tiles; a tap scrolls to that group (the route does not change). The
  groups stack one to a row; rows are touch height, long issue descriptions
  wrap instead of being cut off, and Acknowledge, Assign and Verify keep their
  full-size buttons. "Open the list" is a 44px target.
- Decisions: the wide Latest reports table is hidden on a phone (it scrolled
  sideways in a 640px box, New reports already lists the latest and the Inbox
  is in the bottom bar). The project list stays on the same page below the
  office position rather than behind a new route, so nothing moves for the
  desk and a project is still one tap away. With no project chosen the
  office position comes first in the page itself (not only on screen), so
  keyboard and screen-reader order match; the desk still places it on the
  right of the project list. Opening a project on a phone starts at the top
  of its register. A tile moves focus to its group. The desk at 700px and
  wider looks the same as before (the tiles are hidden there). The closing line now says "Choose a
  project to drill in" instead of "on the left", which was wrong on a phone.
- Verified on Node 24: `npm run typecheck`, `npm test`, `npm run build`, new
  `scripts/verify-office-phone.mjs` (95 checks: 320px and 390px phones and
  1440px desk, light and dark; both columns and their order on screen and in
  the page, counts, tiles on the first screen, scrolling to and focusing their
  group, button and link heights, no
  sideways scroll, a project opens its register, acknowledging on a phone
  updates the tile). `verify-office-landing` now expects the office position
  alongside the project list on a phone; it, `verify-office-actions`,
  `verify-role-access`, `verify-site-coverage` and `verify-search` passed.
  Before/after screenshots in the project's `ui-review/office-phone/`.
- Not verified: a physical phone, Safari and Firefox, a screen reader, and
  the scroll reset with a register longer than the page (the seeded one is
  short, so the browser would land at the top anyway). Proposed task (not
  added to `docs/tasks.json`): "UI-3 Office actions on a phone — the office
  position and its four action groups are the first thing a manager sees on a
  phone; browser check at 320, 390 and 1440px, light and dark."

## 2026-10-20 — FE-5b: descriptions and thumbnails when linking an issue

- Variation cards asked "Is this on an issue already?" with a plain drop-down
  of references and descriptions, no pictures. They now use the same picture
  list as defect and access cards: each open issue with its description (cut
  at two lines), a 56px thumbnail from its history, and its short reference,
  location and owner. An issue with no photograph says "No photo" instead of
  a blank grey square. Thumbnails were 40px; 56px is easier to recognise on
  site.
- The list still shows six, nearest location first, but "Show all 8 open
  issues" now reaches the rest (before, issues past the sixth could not be
  linked at all), and the issue a card is already linked to is always listed.
  On variation cards that fixes a drop-down that showed blank when the linked
  issue fell past the sixth.
- Decisions: the thumbnail is the first photograph on the issue's history,
  usually the one taken when it was raised, since that is what identifies
  it. "Show all" rather than a search box: a project rarely has more than a
  few dozen open issues and the office register already searches. Rules in
  `lib/issueLink.ts` (pure); the picker is `IssueLinkPicker` in
  `ObservationEditor.tsx`.
- Verified on Node 24: `npm run typecheck`, `npm test` (5 new tests in
  `tests/issueLink.test.ts`), `npm run build`. New
  `scripts/verify-issue-link.mjs` passed (39 checks, 390px light and 1440px
  dark: descriptions, thumbnail and "No photo", closed issues left out, order,
  "Show all", linking and unlinking a variation saved across a reload, a
  link past the sixth kept on "Show fewer", no sideways scroll); screenshots
  in the project's `ui-review/issue-link/`. `verify-report-editor` (58),
  `verify-engineer-layout`, `verify-draft-conflict` (23),
  `verify-photo-uploads` (22) and `verify-role-access` (61) passed.
- Not verified: a physical phone, a live SharePoint tenant (issue photos
  from SharePoint use the same `PhotoImage` as before). Proposed: add
  `verify-issue-link.mjs` to the browser checks list in `CLAUDE.md`.

## 2026-10-20 — Site coverage (new feature, proposed as NEW-6)

- New office page `/coverage`, opened from "Site coverage" on the office
  overview: every active and defects liability project down the side, a
  fortnight across the top (last week and this week by default), and a mark
  in each day a report was sent from site, by trade (Elec, HVAC, P&H, Other).
  Each mark opens the report and Back returns to the grid; a project name
  opens its weekly summary. A "Last report" column gives the latest visit
  from any time, who sent it and how many working days have passed. Active
  sites with no report for 3 or more full working days, or none ever, are
  marked "Quiet" and listed at the top under "Gone quiet" with their PM.
  Previous and next fortnight; the address keeps the fortnight.
- Why this feature: a project manager running several sites has no single
  place to see whether each one is being reported on. Today that means
  opening each project in turn, and a site nobody has visited for a week is
  noticed late. It reads only sent reports: no new store, no rota, no data
  entry, no SharePoint write and no email. Office only (Managers and Admins),
  like the office desk; engineers get a 403 from the API and are sent to the
  hub from the page.
- Decisions: reports sit on the engineer's visit day; a sent correction
  stands in for the report it corrects; drafts never count. "Working days"
  are Monday to Friday, both ends left out, so a report yesterday is 0 and
  today still going does not count; bank holidays are not known, so they
  count (said on the page). Defects liability sites are never marked quiet,
  as visits there are occasional. 3 days is a prompt to look, not a rule,
  and there is no expectation that a site reports daily. A visit dated
  after today shows on its day but is not the last report. On a phone the
  grid scrolls inside its own box with the project column held, and opens
  scrolled to today. Rules in `lib/siteCoverage.ts`; `/api/site-coverage`
  uses the office project list's rule (reportable projects the person may
  open). `.gitignore` ignored every `coverage/` folder (meant for test
  coverage output), so it now lets `apps/web/app/coverage/` through.
- Not EXP-1 (site diary, a per-project timeline), not EXP-2 (no requests or
  routing; nobody is chased), not EXP-4 (no locations at all).
- Verified: `npm run typecheck`, `npm test` (6 new tests in
  `tests/siteCoverage.test.ts`, 1 in `viewNavigation.test.ts`), `npm run
  build`. New `scripts/verify-site-coverage.mjs` passed (30 checks:
  signed-out and engineer refusals, the three reportable projects grouped,
  tender and drafts left out, today's and yesterday's reports by trade, a
  quiet site with its working days, a defects liability site not flagged,
  headline counts, back from a report, weekly summary link, fortnight
  stepping, 1440px dark and 390px light with no page sideways scroll and the
  grid opened on today). `verify-office-landing` (19), `verify-role-access`
  (61), `verify-office-actions` (41) and `verify-weekly-summary` (29) still
  pass. Screenshots (not in the repo) are in the RELAY project's shared
  files under `ui-review/site-coverage/`.
- Not verified: a physical phone, SharePoint mode (no live tenant), many
  projects with thousands of reports (it reads every reportable project's
  reports per request, as the weekly summary does for one).
- Next: CLAUDE.md's list of browser checks should gain
  `verify-site-coverage.mjs`. If PMs use it, a per-trade view (which trades a
  project expects) would need that data from the project list first.

## 2026-10-20 — FE-3c: conflicting versions of a draft

- When a draft was saved from another tab or device while this screen held
  different work, the editor now shows both versions card by card in place of
  the cards: "Changed in both", "Only on this screen", "Only on the server",
  or, where the screen knows the server copy it built on, "Changed on the
  server", "Removed on this screen" and so on, with the fields that differ
  in bold. Each card can keep this screen's
  wording, the server's, or both as two cards; a card only in one version can
  be kept or left out; a differing signature is chosen the same way. "Keep
  everything on this screen" and "Keep everything on the server" set every
  choice at once. A line above "Save this version" says what saving keeps and
  what it leaves out. Before, the save was refused with a message, every
  later save was refused too (a reload replayed the same refused request),
  and nothing showed what differed.
- The server now answers a refused draft save with its own copy (409 with
  `current`, to the author only, as the route already checks). The chosen
  version is saved on that version, so a third change in the meantime is
  caught again rather than overwritten.
- Fixed a silent two-tab overwrite: both tabs shared one save journal, so the
  second tab replayed the first tab's request and then saved its own edits on
  top of the version that produced. The journal is now per tab (an id in
  sessionStorage, renewed if a duplicated tab copied it), and a save from one
  tab no longer moves the base version of a copy another tab holds on the
  device. A refused request is dropped instead of being replayed for ever.
- While the choice is open, this tab's version is also set aside on the
  device under its own key (`localDraft.ts` `setAside`), with the server copy
  it was built on. The ordinary held copy is one per person and draft, so the
  other tab's next edit would replace it and its next save would release it;
  the set-aside copy is touched by neither and is dropped once the chosen
  version is held in its place. On opening a draft the device restores this
  tab's own set-aside work first, then the ordinary held copy, then another
  tab's set-aside work, so set-aside work never displaces unsaved edits and
  comes back once they are saved (`pickHeld`). If the device
  will not keep it, the comparison says not to close the page.
- Tabs tell each other when they save (BroadcastChannel), and a tab checks
  the server when it comes back into view. With nothing unsaved it takes the
  newer copy quietly; with unsaved work it shows the comparison at once.
- Decisions: nothing is merged without being shown. Where the server copy
  this screen built on is known, the suggested choice follows what each side
  changed (only the server changed a card: its wording; one side removed a
  card the other left alone: leave it out). Where it is not known (a draft
  opened with no connection, or a held copy restored after another device
  saved), a card in one version only may have been added here or removed
  there, so the suggestion keeps every card from both and this screen's
  wording. A card removed on one side and edited on the other is always kept.
  The line above the save button says how many cards are left out and how
  many lose a wording. When the two versions say the same thing (a save that landed
  but whose answer was lost) the server's copy is taken without asking. The
  comparison takes over the editor until a choice is saved.
- Verified on Node 24: `npm run typecheck`, `npm test` (14 new tests in
  `tests/draftConflict.test.ts`: comparing and merging with and without a
  base, which held copy a reopened draft restores, a stale save refused
  with the server copy, a retried save after another device saved, two tabs
  through the save journal against the real store, a leftover request from
  before a reload). `npm run build`, then new
  `scripts/verify-draft-conflict.mjs` passed (23 checks): two tabs on a
  phone at 390px light (one takes the other's save by itself; with a held
  edit the comparison appears; the other tab carries on editing and saving,
  and after a reload the first tab's work and choice are still there; both
  wordings are kept as two cards, the other tab's untouched change wins by
  default, the set-aside copy is dropped, and the other tab follows); a laptop at 1440px dark offline while another device removed a
  card and added one (both shown, the choice survives a reload, keeping the
  server's version says a card is left out). `verify-report-editor`,
  `verify-signature-reload`, `verify-photo-uploads`,
  `verify-unfinished-reports`, `verify-engineer-layout` and
  `verify-role-access` passed. Screenshots in the project's
  `ui-review/draft-conflict/`.
- Not verified: Safari and Firefox (BroadcastChannel is supported in both, not
  tried), a physical phone, two devices on a real network (a direct store
  write stands in for the other device). Known gap: before a conflict is
  found, the device's held copy is one per person and draft, so with two tabs
  editing at once, a tab that crashes before its save is answered (or while
  there is no connection) can lose its latest edits; the other tab's are
  kept. Once a conflict is found each tab's work is set aside on its own.
- Next: a report sent from another tab while this one has unsaved edits still
  shows "already submitted"; offering a correction with those edits would be
  the follow-up. CLAUDE.md's list of browser checks should gain
  `verify-draft-conflict.mjs`.

## 2026-10-20 — Issue confirmation wording follows the review setting

- A provisional issue said "Not reviewed" in the office register, the office
  issue sheet and the report reader, and "Not yet reviewed" on the issue page,
  on every project. Review is off by default, so on most projects nobody will
  ever review it and the words read as a missed step. Where the project uses
  review it still says "Not reviewed"; where it does not, it says "As
  reported", with "stands as the engineer reported it; this project does not
  use review" on the issue sheet. Confirmed, Disputed and Withdrawn read the
  same either way. The issue page's "Review" heading and the "Review" history
  label for a confirmation event are now "Confirmation", since an office
  confirm on a project without review is not a review.
- Decisions: only the wording changes. The stored state stays `provisional`,
  SharePoint still gets "Provisional", and the Confirm and Withdraw buttons
  are unchanged. The office uses the same per-project rule as the "Not
  reviewed" chip and count (required, or a report still waiting from when it
  was), so a row and the count agree; `GET /api/issues/[id]` now returns that
  `reviewOn` so the issue page words it the same way. The issue page's empty
  owner now says "Not yet assigned" rather than "Awaiting confirmation",
  which read as a confirmation step. Rules in `lib/issueConfirmation.ts`
  (pure).
- Verified on Node 24: `npm run typecheck`, `npm test` (2 new tests in
  `tests/issueConfirmation.test.ts`), `npm run build`. `verify-review-queue`
  now also checks the register row, the issue sheet and the issue page with
  review in use and off (19 checks, was 12). "In use" there is a report still
  waiting for review; the check does not switch a project's review setting
  on, so that path is covered by the unit tests only; screenshots in the project's
  `ui-review/issue-confirmation/`. `verify-issue-register` (70),
  `verify-office-actions` (41), `verify-office-landing` (19),
  `verify-role-access` (61) and `verify-search` (31) passed.
- Not verified: a live SharePoint tenant, a physical device. Not in
  `docs/tasks.json`; proposed in the PR.
## 2026-10-20 — FE-5a: search and filter the issue register

- The office issue register now filters by location text ("riser 2" finds
  "Level 3, Riser 2"; any order, any case), responsible company (free text,
  with the companies already named offered as suggestions, nothing to
  maintain) and verification status: not put forward as fixed, waiting for
  verification, or verified and closed. A new "All" chip lets the filters
  reach closed issues too. "Clear filters" puts everything back.
- Filtering, the chip counts, the order and the paging now run on the
  server over the whole register the person may see, 50 to a page with
  Previous and Next and "Showing 51–100 of 113". Before, the register
  fetched every issue and filtered in the browser. The list refetches when
  the office records reload, so a verify or assign shows at once.
- Decisions: company and location match words as typed rather than against
  a list (FE-1c and EXP-4 keep catalogues out). Company replaces the old
  exact Owner drop-down; the snag list link carries the company when the
  text names one, and the snag list now treats owners that differ only in
  case or spacing as one company. "Not reviewed" counts only projects that
  use review, as the office position does, and "Verify the oldest" picks
  from the current search. A withdrawn issue has no verification status,
  so it only shows with no verification filter. The rest of the office desk
  (position, counts in the tabs) still uses its loaded snapshot; only the
  register pages. The engineer Issues view is unchanged.
- Rules in `lib/issueQuery.ts` (pure); `issueRegister` in
  `lib/issueStore.ts` applies access first; `GET /api/issues?register=1`
  returns one page. Other callers of `/api/issues` are unchanged. The
  office model now reuses the register's overdue, disputed and not-reviewed
  rules.
- Verified on Node 24: `npm run typecheck`, `npm test` (10 new tests in
  `tests/issueQuery.test.ts` and one in `snagList.test.ts`, one in SharePoint read mode with the issue
  list split over two Graph pages, checking every item on both is reachable
  through the register's pages and out-of-scope projects are left out),
  `npm run build`. New `scripts/verify-issue-register.mjs` passed (70 checks:
  130 seeded issues, paging through all 113 open, each filter, the snag
  list link, a verify taken from a row, 1440px and 1200px, light and dark).
  `verify-snag-list` (24, updated for the Company field),
  `verify-office-actions` (41), `verify-office-landing` (19),
  `verify-role-access` (61), `verify-review-queue` (12) and `verify-search`
  (31) passed.
- Not verified: a live SharePoint tenant (Graph paging is checked with a
  stubbed client), a register of thousands of issues (the server still
  reads the whole cache per request, as search does), a physical device.
- Next: the same filters for the engineer Issues view if engineers ask;
  CLAUDE.md's list of browser checks should gain
  `verify-issue-register.mjs`.
## 2026-10-20 — Since your last visit (new feature, proposed as NEW-5)

- The engineer home now opens its right-hand column with "Since your last
  visit": what other people recorded on the current project since the
  engineer's own last report there. Three groups, newest first: reports from
  others (who, trade, visit day, cards and defects, corrections marked),
  issues (new, put forward as fixed, checked and closed, reopened, assigned,
  with "Your trade" on issues for the engineer's trade) and variations (new,
  instructed, declined, no prices). Each row opens the record and Back
  returns to the home. Four rows per group, then "Show n more".
- Why this feature: the first minute back on a site is "what has happened
  since I was last here?". Today that means opening the reports list, the
  issue register and asking the office. Engineers move between sites, so
  this is the screen they see every time they arrive. It reads only what is
  already recorded: no new store, no "mark as read", no setup, no SharePoint
  write and no email.
- Decisions: the last visit is the engineer's latest original report on the
  project from an earlier day (today's report does not count, so the list
  still makes sense after sending today's update; a correction sent later is
  not a visit). Everything received by the server after that report was
  received counts as new. With no earlier report it shows the last 7 days and
  says so. The engineer's own reports and acts, and issues and variations
  they raised, are left out, because "Came back from the office" already
  shows the office's answers to those; nothing appears twice. Each issue and
  variation shows once, by its latest change, and only if that change still
  stands (a closed issue that was reopened shows as reopened); one whose
  latest change was the engineer's own is left out. Withdrawn
  issues and drafts are left out; a sent correction stands in for the report
  it corrects. Rules in `lib/sinceLastVisit.ts`, served by
  `/api/since-last-visit` with the weekly summary's project rule.
- Not EXP-1: the site diary is a chronological project timeline. This is a
  short, personal catch-up on the home screen and leaves the diary to its
  own task. Not EXP-2 or EXP-4: no requests or routing, locations are free
  text as written.
- Verified: `npm run typecheck`, `npm test` (6 new tests in
  `tests/sinceLastVisit.test.ts`), `npm run build`. New
  `scripts/verify-since-last-visit.mjs` passed (33 checks: 390px light and
  1440px dark, starting report named, others' report listed, earlier
  reports, drafts, other projects and own work left out, your-trade marking,
  show more, back navigation, a second engineer's view, a first-time engineer
  sees 7 days, an empty project says so, signed-out and unknown-project
  refusals, no sideways scroll). A fresh-context review found no access
  gaps; its fix (an issue the engineer moved last is not shown with an
  older change, such as "Reopened" after they put it forward as fixed) is in. `verify-engineer-layout`,
  `verify-role-access` (61), `verify-unfinished-reports` (18) and
  `verify-engineer-nav` (60) still pass. Screenshots (not in the repo) are in
  the RELAY project's shared files under `ui-review/since-last-visit/`.
- Not verified: a physical phone, SharePoint mode (no live tenant), a
  project with thousands of records (it reads the project's records per
  request, like the weekly summary).
- Next: CLAUDE.md's list of browser checks should gain
  `verify-since-last-visit.mjs`. If engineers use it, the same catch-up for a
  project manager on the office project page.

## 2026-10-20 — Photo library per project (new feature, proposed as NEW-4)

- New page `/photos`: every photograph on one project, newest first, grouped
  by day. Photographs come from cards on sent reports (never drafts) and from
  evidence added to issues and variations afterwards (put forward as fixed,
  checked, notes). Each tile shows the kind (Progress, Defect, Access problem,
  Variation required, Put forward as fixed, …) and where it was taken. A find
  box matches every typed word against the location, what was found, caption,
  who, trade and reference; buttons narrow it to Progress, Defects and
  access, Variations, or Fixes and checks. Tapping a tile opens a viewer with
  the larger copy, its details, Newer and Older (arrow keys on a desk), and
  "Open report/issue/variation" to the record it came from.
- Opened from a "Photographs" button in the engineer Reports view and in the
  office project's actions. The project, words and filter are kept in the
  address, so a record opened from the viewer comes back to the same list.
- Why this feature: "what did it look like before it was boarded?" is a
  daily question on site and in the office (disputes, client questions,
  handover), and today the answer means opening reports one at a time. It
  reads only what is already recorded: no new store, upload, data entry,
  SharePoint write or email.
- Not FE-2: the backlog leaves out "the photo-workflow expansion (separate
  camera/library controls, zoom, reordering, annotations and per-photo
  progress)". Those are capture-time controls in the report editor. This page
  changes nothing about taking or attaching photographs; it has no zoom,
  reordering or annotation, only a larger view of a sent photograph.
- Decisions: a photograph copied from a defect card onto its issue shows once,
  from the report. A sent correction takes over the photographs it still
  carries; any it dropped stay with the original. Issues withdrawn as raised
  in error are left out (their report cards still show). Report photographs
  sit on the visit day, issue and variation evidence on the day it was
  added, in UK time. Locations are free text as written (no catalogue,
  EXP-4). The viewer uses the existing PDF-sized copy, not the original, so
  a phone on site does not pull 20 MB images. 60 tiles at a time, then "Show
  more".
- Verified: `npm run typecheck` and `npm test` pass (8 new tests in
  `tests/photoLibrary.test.ts`, 1 in `viewNavigation.test.ts`). `npm run
  build`, then new `scripts/verify-photo-library.mjs` passed (34 checks:
  engineer at 390px light, office at 1440px dark, drafts and other projects
  left out, thumbnails load, find, filters, viewer stepping and links, back
  navigation, empty project, signed-out and unknown-project refusals). A
  fresh-context review found no access gaps; its fixes (trade shown only for
  report photographs, latest revision in a correction chain, sign-in keeps
  the address) are in.
  `verify-engineer-layout`, `verify-role-access` (61), `verify-weekly-summary`
  (29) and `verify-office-actions` (41) still pass. Screenshots (not in the
  repo) are in the RELAY project's shared files under `ui-review/photo-library/`.
- Not verified: a physical phone, SharePoint mode (no live tenant),
  performance on a project with thousands of photographs (it loads the
  project's records per request, like search and the weekly summary; tiles
  are lazy-loaded thumbnails).
- Next: a "Photographs" link from an issue or the snag list filtered to that
  location, if site teams use the page.
## 2026-10-20 — FE-3b: which cards and photos are on the server

- In the report editor every card row now ends with where the card is: "On
  the server", "Uploading", "Not yet on the server" or "Only on this phone",
  with what is still to go up ("changes and 1 photo"). Each photograph says
  the same under its number. The Check & send step opens with one line: "The
  card and 2 photos are on the server." or "1 card and 1 photo are only on
  this phone. They go up by themselves when the server can be reached."
  A removed card or a changed signature waiting for a save is named there
  too, so the line never goes green before the save lands. The wording
  matches the unfinished reports list (PR #9). Green dot only when the
  server has it.
- Decision: a photograph counts as on the server only once the server's copy
  of the card lists it, not when its bytes arrive, because until then the
  office cannot see it. The server only accepts a card whose photos it holds
  (`validatePhotos.ts`), so a listed photo is known to be there. A new photo
  is counted on its own, so adding one does not mark the card's words as
  unsaved. Rules in `lib/uploadStatus.ts`; `lib/localMedia.ts` now reports
  which photos are being sent.
- Decision: while the server cannot be reached the editor retries every 15
  seconds (only while the page is visible). Before, a server outage with the
  phone still online never retried, because no "online" event comes; the
  work sat on the phone until the engineer typed. Retries reuse the held copy
  and do not move its "changed" time.
- Verified on Node 24: `npm run typecheck`, `npm test` (web suite 92 tests,
  ten new in `tests/uploadStatus.test.ts`), `npm run build`. New
  `scripts/verify-photo-uploads.mjs` passed (22 checks at 390px light and
  1440px dark): a photo goes up with the card; the server is stopped, a
  second photo and a caption change show "Only on this phone"; the server is
  restarted and, with nobody touching the page, everything shows "On the
  server" and the server's copy has both photos and the caption.
  `verify-report-editor` (58), `verify-engineer-layout`,
  `verify-signature-reload`, `verify-unfinished-reports` (18) and
  `verify-role-access` (61) passed. Screenshots in the project's
  `ui-review/photo-upload-status/`.
- Not verified: a physical phone or a real dropped signal (Chromium only, the
  server process was stopped instead). Issue pages and the separate defect
  form upload photos too and do not show this yet.
- Next: proposed follow-ups in the PR: show the same status on issue photo
  uploads; a caption typed while a photo is still being added can be lost
  (the editor adds the photo to the card as it was when the camera opened).
  CLAUDE.md's list of browser checks should gain `verify-photo-uploads.mjs`.

## 2026-10-20 — FE-6a: distinct submission stages

- A sent report now shows its steps one by one, each with its own state:
  Received, Review (only where the project asks for review), PDF, Delivery
  and Read. The office report reader shows them in one row in place of the
  four-cell block that put "PDF and notification" in one cell; the
  engineer's sent report page shows the same steps, one per row on the
  phone. Each step can carry a time and one plain sentence (why a PDF failed,
  that nothing was emailed).
- Delivery is stated from what happened, not from the job's status word. A
  notification written to the pilot's local outbox is "Not emailed · Nothing
  has been sent"; "Emailed to <name>" needs the mail transport to have sent
  it; projects from SharePoint show "Waiting to file in SharePoint" or
  "Filed in SharePoint", with a note that Relay does not email the project
  manager for them yet. Failed emails, a missing address and SharePoint
  failures are alerts on the Delivery step.
- The worker now records which step a failure belongs to
  (`deliveryErrorStage`: `pdf` or `delivery`), so a failed notification no
  longer reads as a failed PDF. An older failure without it shows as
  "Processing needs attention" on the PDF step, since its step is unknown.
  A retried email is judged by its latest attempt, so a retry that worked is
  not left showing "Email failed". The office note on a failed report names
  the step.
- Decisions: review is left out of the steps when the project does not use
  it, matching PR #8, so the usual row is four steps. Lists keep their single
  compact delivery tag; the steps belong on the report itself.
- Rules in `lib/status.ts` (`submissionStages`), shown by
  `components/SubmissionStages.tsx` with `app/stages.css`.
- Verified on Node 24: `npm run typecheck`, `npm test` (7 new tests in
  `tests/submissionStages.test.ts`, including the worker recording a PDF
  failure and a blocked delivery), `npm run build`. New
  `scripts/verify-submission-stages.mjs` passed (65 checks: six report
  states in the office reader at 1440px and on the engineer page at 390px,
  light and dark; outbox never shown as email; no sideways scroll).
  `verify-office-actions` (41), `verify-role-access` (61),
  `verify-engineer-layout`, `verify-review-queue` (12),
  `verify-signature-reload` and `verify-office-landing` (19) passed.
  Screenshots in the project's `ui-review/submission-stages/`.
- Not verified: live Graph mail (blocked by design, so "Emailed to" is only
  seen with seeded data), live SharePoint filing (no tenant), a physical
  phone.
- Next: FE-3c (conflicting versions) once FE-3b has merged. CLAUDE.md's list
  of browser checks should gain `verify-submission-stages.mjs`.

## 2026-10-20 — Weekly project summary (new feature, proposed as NEW-3)

- New page `/weekly-summary`: one project's week (Monday to Sunday, UK time)
  on one page. Headline counts (site reports and days on site, engineers,
  issues raised and closed, variations raised and instructed), then the sent
  reports by visit day with who, trade, what they found by kind, photographs
  and locations; issues raised, put forward as fixed, and checked and closed;
  how many are open now and past target, with a link to the snag list; and
  variations raised and instructed, with "Done before instruction" flagged.
  Previous / This week / Next week, and "Print or save as PDF" (A4, black on
  white, no app bar; the prototype banner still prints).
- Opened from a "Weekly summary" button in the engineer Reports view and in
  the office project's actions. The project and week are kept in the address,
  and a report, issue or variation opened from it comes back to the same week.
- Why this feature: every site has a weekly progress meeting, and today the
  office counts rows across the report list and both registers to say how the
  week went. It reads only what is already recorded, so there is no new store,
  data entry, SharePoint write or email.
- Decisions: sent reports only, never drafts (`canReadReport`), placed by
  visit day; a sent correction replaces the report it corrects, so a visit
  counts once. A report awaiting review or returned for
  changes is tagged so, keeping receipt apart from review. Issue and variation changes are placed by their own events and
  kept apart (raised, put forward as fixed, verified; instructed); one that
  was verified or instructed and then reopened is not shown as closed or
  instructed. "Open now" is as of the day the page is opened, not
  reconstructed for past weeks, and the page says so. No prices, so it can be
  shown to a client. Locations are listed as written, repeats dropped ignoring
  case and spacing (no catalogue, EXP-4). It counts and lists; the narrative
  timeline stays with EXP-1 (living site diary), which can reuse
  `lib/weeklySummary.ts`. Not added to `docs/tasks.json` (CLAUDE.md); the PR
  proposes NEW-3.
- Verified: `npm run typecheck` and `npm test` pass (9 new tests in
  `tests/weeklySummary.test.ts`, 1 in `viewNavigation.test.ts`). `npm run
  build`, then new `scripts/verify-weekly-summary.mjs` passed (29 checks:
  engineer at 390 px light, office at 1440 px dark, week stepping, drafts and
  other projects left out, back from a record, print media and an A4 PDF,
  signed-out and unknown-project refusals). Screenshots in the project's
  `ui-review/weekly-summary/`.
- Not verified: a physical printer or phone, Safari's print dialog,
  SharePoint mode (no live tenant), performance with years of records (it
  loads the project's records per request, like search).
- Next: a weekly summary across every project for the office, if asked for.

## 2026-10-20 — FE-4b: action-focused office position

- The office position now opens with the four groups a project manager acts
  on, each with its count and its oldest or newest rows: New reports, Not yet
  read, Unassigned issues and Ready to verify. Rows carry the action
  (Acknowledge, Assign, Verify) and open the record; "Open the list" or "Show
  all" opens the Inbox or Issues on the matching filter. The Inbox has a new
  "New" filter.
- Decision, "new": received on the previous working day or since, in London
  time, so Monday morning still shows Friday's and the weekend's reports. A
  read report stays new; "Not yet read" is the separate group for
  acknowledgement, so the two facts are not merged. Bank holidays are not
  known (no calendar in RELAY).
- Decision, layout: a two-by-two grid above the existing tiles, because four
  columns at 1440px cut off titles. The "Ready to verify" tile is gone (it is
  a group now) and the "Needs attention" list below, renamed "Also needs
  attention", leaves out verification and unassigned issues so nothing shows
  twice. Project sheets are unchanged: the group links open portfolio-wide
  lists, so a per-project copy would show counts the links do not match.
- Rules in `lib/officeActions.ts`; the office model reuses its predicates.
  Filter links use `#/inbox/show/<filter>` and `#/issues/show/<filter>`;
  opening a report from a filtered Inbox keeps the filter.
- Verified on Node 24: `npm run typecheck`, `npm test` (web suite 76 tests,
  four new in `tests/officeActions.test.ts`), `npm run build`. New
  `scripts/verify-office-actions.mjs` passed (41 checks: four groups in order
  with counts 2, 2, 1, 1 at 1440px and 1200px, light and dark, no sideways
  scroll; each group opens its filter; acknowledging takes a report out of
  Not yet read and leaves it new). `verify-office-landing` (19),
  `verify-role-access` (61) and `verify-review-queue` (12) passed.
- Not verified: a physical device; the phone layout opens on the project
  list as before, so the groups are a desk feature.
- Next: FE-3b (pending uploads) once the report editor PR has merged.

## 2026-10-20 — UI-2 and FE-1a: shorter report editor on the phone

- The draft report is now two steps, shown as tabs under the heading:
  "Cards" and "Check & send". The cards step holds only the cards; the
  findings, counts, "What sending does", the signature and "Send to office"
  are on the check step. The sticky action is "Check & send →" on the cards
  step and "Send to office" on the check step. The check step has its own
  history entry (`#check`), so the phone's Back returns to the cards.
- Below 900px every card folds to one summary row: kind, location, a
  one-line description, photo count, and why it would stop sending ("a
  defect needs at least one photograph"). Tapping a row opens that card
  directly under it; tapping it again or "Done with this card" folds it.
  Wide screens keep the cards rail beside the open card. This is FE-1a.
- On the phone the action bar steps aside while a text field or box has
  the keyboard, so it never covers what is being typed. Drop-down lists do
  not hide it. Tapping a finding on the check step opens the card it is
  about.
- Dropped the repeated "Selected: VARIATION" line under the kind buttons.
- Decision: fold every card when a draft opens on the phone rather than
  opening the last one, so an engineer coming back to a draft sees the whole
  report first. A three-card draft is 960px tall at 390px, was 3,860px.
- Not in `docs/tasks.json` as a UI task; the PR proposes UI-2 for Cal to add.
  New `scripts/verify-report-editor.mjs` (58 checks at 390px and 1440px,
  light and dark). `verify-engineer-layout` now opens the check step before
  sending and uses the folded rows below 900px; `verify-signature-reload`
  opens the draft on `#check`.
- Verified on Node 24: `npm run typecheck`, `npm test`, `npm run build`,
  `verify-report-editor`, `verify-engineer-layout`, `verify-signature-reload`,
  `verify-role-access`, `verify-unfinished-reports` and `verify-search`
  passed. Before/after screenshots at 390px in light and dark.
- Not verified: a physical phone and its on-screen keyboard (the action bar
  hides on focus, checked in Chromium only); iOS Safari.
- Next: item 4 in `docs/ui-direction-2026-10-20.md` (empty states).
  CLAUDE.md's list of browser checks should gain `verify-report-editor.mjs`.

## 2026-10-20 — UI-3: icons on the engineer navigation

- Each engineer navigation entry (Site, Issues, Reports, Projects, Search) now
  has a line icon beside its label. On the phone bar (600px and below) the
  icon sits over the label in five equal columns, 56px tall, sans 12px. The
  current view is gold, bold, on a tinted tile with a gold mark at the top.
  On a wide screen the icons sit inline and the tab underline is unchanged.
- Fixed: at 320px Search wrapped onto a second row of the bar (it was added
  in NEW-1 after the bar was designed). All five now fit on one row.
- The workspace keeps 96px plus the safe area clear at the bottom so the bar
  never covers the last item. Hover colour only applies on devices with a
  pointer, so a tapped entry does not stay gold on a phone.
- Decision: icons are drawn inline (no icon library) to keep the bundle the
  same and match the camera and search icons already in the app. Snag list
  stays a link in the Issues view rather than a sixth bar entry: six would
  not fit legibly at 320px and it belongs with the issues it lists.
- Not in `docs/tasks.json`; the PR proposes UI-3. New
  `scripts/verify-engineer-nav.mjs` (60 checks at 320, 390 and 1440px, light
  and dark). It fails on main (no icons; Search on a second row at 320px)
  and passes with this change.
- Verified on Node 24: `npm run typecheck`, `npm test`, `npm run build`,
  `verify-engineer-nav`, `verify-engineer-layout`, `verify-search` (31),
  `verify-role-access` (61), `verify-unfinished-reports` (18). Before/after
  screenshots at 320, 390 and 1440px in light and dark.
- Not verified: a physical phone, iOS Safari's safe-area inset.
- Next: item 4 in `docs/ui-direction-2026-10-20.md` (empty states).

## 2026-10-20 — NEW-2: printable snag lists

- New page `/issues/snag-list`: one project's open issues for a company or
  person and/or a trade, grouped by location, each with reference,
  description, what to do, owner, target date, a "Past target" or "Fixed, to
  check" tag and the photograph taken when it was raised. It has tick boxes, a
  "Checked by / Signature / Date" foot, and a "Print or save as PDF" button.
  Printed, it is black on white with no app bar or controls. The prototype
  banner still prints.
- Opened from a "Snag list" link on the office Issues register, which carries
  the project, owner and trade chosen there, and from the engineer Issues view
  ("Snag list · Electrical"), which defaults to the engineer's trade.
- Why this feature: handing a company its snags is a weekly job on every
  site, and today the office copies rows out of the register by hand. It reads
  the existing register only, so there is no new store or SharePoint write.
- Decisions: read-only. Ticking on paper records nothing; the foot says to
  use "Submit as complete" on the issue. Locations are grouped as written,
  ignoring case and spacing, and labelled as the earliest issue spelled it, so
  there is no location catalogue (EXP-4). Fixed work is listed last in each
  location, not hidden, so the company can see what is waiting to be checked.
  Trade follows the office register: the affected trade, else the reporter's.
  Choices are kept in the address, so a list can be bookmarked, and an issue
  opened from the list returns to the same list. Unreviewed issues are not
  tagged: with review off (the default) every issue stays unreviewed, so the
  tag would be on every row.
- Added NEW-2 and a `snag` lane to `docs/tasks.json`.
- Verified: `npm run typecheck` and `npm test` pass (7 new tests in
  `tests/snagList.test.ts`, 1 in `viewNavigation.test.ts`). New
  `scripts/verify-snag-list.mjs` passed (24 checks: engineer at 390 px light,
  office at 1440 px dark, print media and an A4 PDF, project picker, back
  from an issue). `verify-role-access`, `verify-engineer-layout`,
  `verify-search` and `verify-office-landing` passed after main was merged in;
  `verify-review-queue` and `verify-unfinished-reports` passed before.
- Not verified: a physical printer or phone, Safari's print dialog,
  SharePoint mode (no live tenant).
- Next: a snag list per company across every project, if the office asks for it.

## 2026-10-20 — UI-1: office desk opens on the office position

- The office desk no longer opens on an empty "Select a project…" register
  column. With no project chosen it shows two columns: the project list and
  the office position, which now takes the rest of the width (about 1,190px
  at 1440px, was 790px). Choosing a project brings the register back as
  before. The details column heading reads "Overview" until a project is
  chosen.
- Decision: show the office position full width rather than opening on the
  first project with work waiting. The office position is the summary a
  manager reads first, and jumping into one project would hide the others'
  counts and change what the Projects tab means.
- Fixed "1 reports received" and "1 open issues" on the office position.
- Phone layout unchanged: it opens on the project list, as before.
- Not in `docs/tasks.json` (CLAUDE.md lets threads change only existing
  tasks); the PR proposes UI-1 for Cal to add. New
  `scripts/verify-office-landing.mjs` (19 checks at 1440px and 390px, light
  and dark). It fails on main (three
  columns at landing) and passes with this change.
- Verified on Node 24: `npm run typecheck`, `npm test`, `npm run build`,
  `verify-office-landing`, `verify-role-access` (61 checks),
  `verify-review-queue` (12 checks) and `verify-engineer-layout` passed.
  Before/after screenshots at 1440px in light and dark.
- Not verified: a physical device; Compliance's office is unchanged.
- Next: item 2 in `docs/ui-direction-2026-10-20.md` (report editor flow).

## 2026-10-20 — NEW-1: search reports, issues and variations (new feature)

- Why this feature: Cal gave Claude freedom to add features that make RELAY
  more useful on site and in the office. Engineers had no way to find past
  work: "has anyone already flagged the fire stopping in the level 3 riser?"
  meant opening each list on each project. The office desk search only looks
  at records already loaded, by reference and title. Search answers the
  question people actually ask, by the words they remember.
- What it does: a Search link in the engineer navigation opens `/search` on
  the current project (any role can use the page). Every typed word must
  appear somewhere in the record (reference, project, location, notes,
  action, responsible company, who raised it, issue and variation history), in
  any order and case; dashes read as spaces, accents are ignored. Results are
  grouped as issues, reports and variations, with status in RELAY's words and
  the matched words marked. A typed reference ranks first, then newest first;
  25 per group. Back from a result returns to the same search.
- Decisions: access is applied before matching (`canReadReport`), so another
  person's draft is never searched; the project rule is the same as the lists
  (reportable projects when SharePoint is connected). Free-text locations are
  matched as typed, with no location list (EXP-4). The office desk is
  unchanged to stay out of the office lane. A SharePoint refresh failure
  returns "please retry" rather than possibly stale results, like the lists.
  Search loads every record per request, which suits the pilot's volume;
  SQLite full-text search is the next step if it grows.
- Verified: `npm run typecheck` and `npm test` pass (web suite 67 tests, six
  new in `tests/search.test.ts`, one in `viewNavigation.test.ts`).
  `npm run build`, then new `scripts/verify-search.mjs` passed (31 checks:
  engineer at 390px and 1440px in light and dark, no sideways scroll, focus,
  no other engineer's draft, Back keeps the search, nothing-found message,
  reference search; office manager sees the same results and no draft text
  through the API). `verify-role-access.mjs` and `verify-engineer-layout.mjs`
  passed.
- Not verified: a physical phone; SharePoint mode (no live tenant here);
  performance with thousands of records.
- Next: a Search entry on the office desk once the office lane is free.

## 2026-10-20 — FE-3d: unfinished reports on the engineer home

- The engineer home now has an "Unfinished reports" list under the start
  tiles: every draft the engineer started, on every project open to them, newest
  change first. Each row names the project, the report, the visit day, the
  card count and when the server last saved it, and opens the draft. It
  replaces "Other drafts", which only showed the selected project.
- Copies held on this device (`lib/localDraft.ts`) are checked too. Edits the
  server has not acknowledged show "Not yet on the server" with when they were
  made and the last server save. A device copy the server did not list is
  asked about: if the server cannot be reached it shows "Only on this phone";
  if the server answers, the report was sent or removed elsewhere, so the stale
  copy is left out rather than offered as unfinished.
- Decisions: the current project's draft stays on the big "Continue" tile and
  is listed as well, so the list is the one complete place to see everything
  unsent. Rows use the same row style and tags as "Came back from the office".
  Rows with work only on the device get the alert edge, because that work is
  not safe until the server has it.
- Verified: `npm run typecheck` and `npm test` pass (web suite 65 tests, five
  new in `tests/unfinishedReports.test.ts`). New
  `scripts/verify-unfinished-reports.mjs` passed (18 checks, 390 px light and
  1440 px dark): two drafts on two projects with project and save time, another
  engineer's draft and a sent report left out, a device copy flagged as not on
  the server, a phone-only copy shown while its server request fails, a stale
  copy of a sent report left out, and a row opens its draft.
  `verify-engineer-layout`, `verify-role-access` and `verify-signature-reload`
  passed.
- Not verified: a physical phone, or a real loss of signal (the check blocks one
  request in the browser instead).
- Next: FE-3b (show pending uploads and server acknowledgement).

## 2026-10-20 — FIX-1: in-app PDF on older browsers

- The PDF viewer now loads pdf.js's legacy build (page and worker) instead of
  the modern one. The modern pdfjs-dist 6.3 build calls
  `Map.prototype.getOrInsertComputed`, which Chromium 141 and likely older
  iPhones lack, so the viewer showed that error instead of the report.
- Decision: the legacy build rather than pinning an older pdfjs-dist. It is
  pdf.js's own supported route for older browsers, keeps current fixes, and
  is larger (worker +4%, page script +13%, loaded only on the PDF page).
  No hand-written polyfill to maintain.
- `scripts/verify-pdf-navigation.mjs` now fails if the viewer shows an error
  and prints it (before, it failed with only "PDF must render visible ink"), and matches
  the report page by pathname because links now carry a return path.
- Added FIX-1 to `docs/tasks.json` (found by the TOOL-1 thread).
- Verified on Node 24: `npm run typecheck`, `npm test` (145 package, 57 web
  tests), `npm run build`. `verify-pdf-navigation` fails on main with
  "getOrInsertComputed is not a function" and passes with this change;
  `verify-role-access` and `verify-engineer-layout` passed, using the
  Playwright that TOOL-1 (PR #5) added.
- Not verified: WebKit or a physical iPhone; no WebKit browser is installed
  in the cloud session.
- Next: the next task in `docs/tasks.json` order.

## 2026-10-20 — FE-4a: hide the review queue when review is off

- The office shows review filters and counts only where review is in use.
  `lib/reviewQueue.ts` decides per project: the project requires review, or a
  submitted report is still waiting for a decision. With review off (the
  default for every project) the Inbox has no "To review" or "Returned"
  filter, the Issues page has no "Not reviewed" filter or count, and the
  project register no longer mentions review when nothing needs attention.
- Decisions: a report left waiting from when review was required keeps the
  queue on until someone decides it, so it is never hidden from the office.
  "Not reviewed" is hidden too, because issues stay provisional when nobody
  reviews reports, so that count grew on every project with review off. A
  report that is itself pending or returned still shows its tag, and the
  report reader keeps its "Review" row; both are facts about one report, not
  a queue. The project sheet still states whether review is required.
- The filters follow the project picked in the Inbox and Issues project
  select, and a filter that disappears (the last waiting report was decided)
  falls back to "All" or "Open" instead of leaving an empty list.
- Verified: `npm run typecheck` and `npm test` pass (web suite 60 tests, three
  new in `tests/reviewQueue.test.ts`). New `scripts/verify-review-queue.mjs`
  passed (12 checks): with a report waiting the filters and count show; after
  a manager approves it they are gone. It fails on main. `verify-role-access.mjs`
  passed.
- Not verified: a project with review switched on from SharePoint (every
  project has it off; the "on" case is a waiting report); a physical phone.
- Next: FE-3d (show all unfinished reports on engineer home).

## 2026-10-20 — TOOL-1: make browser checks runnable

- Added `playwright` 1.56.1 as a root dev dependency, pinned exactly because
  its Chromium (revision 1194) is the one preinstalled in cloud sessions.
  Playwright has no install script, so `npm ci` downloads no browsers.
- Updated `scripts/verify-engineer-layout.mjs` for UI changes since September:
  the home heading is now the engineer's name, report sections are now cards
  with a kind picker, links carry a return path, and the removed "Team &
  contacts" and "Trade affected · Coming soon" checks are replaced by the
  disabled "Assigned to me" button and the defect card's default trade.
- CLAUDE.md now gives the exact commands.
- Verified in a cloud thread on Node 24 after `npm ci`, `npm run typecheck`,
  `npm test` (48 web tests) and `npm run build`: `verify-role-access` passed
  (61 checks) and `verify-engineer-layout` passed. `npm ci` without
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` left no `~/.cache/ms-playwright`.
- Not passing: `verify-pdf-navigation`. The in-app PDF viewer shows
  "this[#ne].getOrInsertComputed is not a function": pdfjs-dist 6.3 uses
  `Map.prototype.getOrInsertComputed`, which Chromium 141 lacks. This is a
  real fault for anyone on an older browser (likely older iPhones too), not a
  check problem. Not verified on a real phone.
- Not done: browser checks are not in CI (CI changes were left alone).
- Next: fix the PDF viewer on older browsers (pin pdfjs-dist to a version
  without the new Map method, or polyfill it in page and worker), then FE-4a.

## 2026-10-20 — FE-3a: signatures survive a reload

- The name and drawn signature on a draft now save with it, like any other
  edit: to the server as `draftSignature` and to the device copy used for
  recovery. Reopening the draft shows them again. Sending turns them into the
  report's `signature` as before and drops the draft copy.
- Decisions: a separate `draftSignature` field rather than reusing `signature`,
  so "signed at sending" keeps its meaning. The server accepts only a name and
  a PNG under 400 KB. A save that omits the signature (an older client or a
  journalled request) leaves the saved one alone; `null` clears it. Signature
  images are kept out of list summaries. A restored signature is redrawn in
  the theme's ink, so it shows in dark mode.
- Verified: `npm run typecheck` and `npm test` pass (web suite 57 tests).
  New `scripts/verify-signature-reload.mjs` passed: sign, wait for "Saved on
  server", reload, signature and name still shown in light and dark, and the
  server record holds both. `verify-role-access.mjs` passed.
- Not verified: a physical phone. `verify-engineer-layout.mjs` times out
  waiting for "On site today" here, on main as well as on this branch, so the
  failure predates this change (the Browser checks thread is on it).
- Next: FE-4a (hide the review queue when review is off).

## 2026-10-20 — FE-4c: PM acknowledgement test

- Closed the test gap on PM acknowledgement in `apps/web/tests/corrections.test.ts`.
  The tests now check that acknowledgement stores who, when and an optional
  trimmed note (a blank note is not stored), that it leaves receipt time,
  review, PDF delivery and the report's issue untouched, that approval and
  issue closure do not count as acknowledgement, that the first one stands,
  and that the status words for each fact stay separate.
- No application code changed: the behaviour was already built. A mutation
  check (making acknowledgement also approve) made the new test fail.
- Verified: `npm run typecheck` and `npm test` pass (web suite 49 tests).
- Not verified: no browser check (the task has none, and Playwright is TOOL-1);
  the office "Read" row was read in code, not seen in a browser.
- Next: FE-3a (signatures across reloads) once the editor lane is free.

## 2026-10-20 — Set up the autonomous development loop

- Added `CLAUDE.md`, `docs/tasks.json` (19 tasks from the approved backlog),
  this log, a `reviewer` subagent, a Stop hook that runs typecheck and tests
  when code changed, a SessionStart hook that installs dependencies, and CI.
- Verified: `npm run typecheck` and `npm test` pass locally (Node 22 in the
  cloud sandbox); the hook scripts were exercised with and without code changes.
- Not verified: CI on GitHub until this PR runs; Node 24 in cloud threads
  (the project's cloud environment still needs it).
- AUDIT-1 done (read-only): each task's notes now say what exists, with file
  paths. Nothing meets its acceptance in full; FE-4c needs only a test, and
  FE-1a, FE-5b and FE-6b are mostly built.
- Added the master plan to `docs/tasks.json`: order, lanes (file areas that
  must not be worked on by two threads at once), dependencies, and a limit of
  two active threads. Added TOOL-1 because no browser check can run until
  Playwright is installed.
- Next: TOOL-1, then FE-4c, FE-3a, FE-4a.
