# Progress log

Append one entry per thread, newest at the top. Keep each entry short:
what changed, how it was verified, what was not verified, and what comes next.
Earlier history is in `docs/optimisation-progress.md` and the dated docs.

## 2026-10-21 — Sixth release check (main at e2e84ff, #74 to #78)

- Why: the coordinator's release check before a first deploy. Not a
  `docs/tasks.json` task, so no status changed there.
- Fresh checkout of e2e84ff: `npm ci`, `npm run typecheck`, `npm test`
  (146 + 415), `npm run build` and all 63 browser checks, one after another.
  62 passed. `verify-site-notes` failed every time (4 of 4): since #75 a first
  visit to Help shows only the latest six What's new entries with "Show all"
  under them, and Notes for the next visit is far below. RELAY is right, the
  check was out of date. It now opens the full list first (clicking again if
  the page was not ready), and so do the permits and toolbox talks checks,
  which would have broken the same way once newer entries push theirs down
  (the toolbox one also read the page without waiting), and the deliveries
  check from #80, merged during this check. Each passed three runs in a row.
- Found and fixed separately in #79: SharePoint date-only fields read a day
  early in summer, and a report started online just after midnight BST.
- Deploy needs nothing new since #73: permits are a new kind of record in the
  same table (no database change), no new settings, no SharePoint columns,
  and the no-signal page is unchanged (`relay-public-v14`). Release notes in
  the project files cover everything merged up to this PR except #28.
- Not verified: building the Docker image (no Docker here), a real phone,
  the live server and tenant.

## 2026-10-21 — Deliveries

- Why: a new feature chosen by Claude for site and office (Cal's go-ahead to
  add features). Materials arrive on an M&E job most days; a short or damaged
  delivery today is a photo of the delivery note in someone's phone, and the
  office hears about it too late to chase the supplier or claim a credit.
  Not a `docs/tasks.json` task, so no status changed there. Checked against
  the backlog: not FE-2 (no photographs), not EXP-2 (nothing is routed,
  approved or sent; chasing the supplier stays a phone call), not EXP-4
  ("Where it was put" is optional free text, no location list). No report
  editor change. "Delivered" on a report still means filed; this is
  materials, and the code says so.
- What: `/deliveries?project=…` for every role on a project. Record the
  supplier (the last four different suppliers are one tap), what arrived,
  the day (today or up to 7 days back), who took it in (starts as the
  signed-in person), where it was put and the delivery note number
  (optional), and whether it was all there: all there, short, damaged or
  wrong items. Anything but all there needs "what was wrong" and stays under
  "To sort" until someone on the project marks it sorted, saying how. Withdraw
  with a reason (whoever recorded it, or the office), as permits. Spreadsheet
  `relay-deliveries-<project>-<day>.csv` in the house column order. Local
  store kind `deliveries`; nothing is sent or written to SharePoint. Closed
  projects take no new ones.
- Where: a "Deliveries" row under Reports and records on the engineer home
  ("2 in the last 7 days · 1 to sort"), a link in the office project sheet's
  Reports and records group, and one line per project in the office's
  Attention list and Needs attention ("Short delivery from Edmundson
  Electrical, not sorted yet"), after work done with no instruction. The desk
  reads `GET /api/deliveries` (no project) with its other records; if that
  fails it keeps the last answer and claims nothing new.
- Decisions (Claude's): anyone on the project may mark a delivery sorted,
  because site sees the rest arrive and the office agrees the credit; a note
  saying how is required so "sorted" is a statement, not a tap. The home row
  has no red edge: a short delivery is late material, not a safety risk.
  Deliveries stay out of the site diary, which is built only from reports
  (EXP-1). Fields scroll clear of the sticky top bar when a refusal moves
  focus to them.
- Help: What's new "Deliveries", and a Where to find things entry.
- Checks: `npm run typecheck`, `npm test` (146 + 422; new
  `tests/deliveries.test.ts`, and deliveries added to the shared register
  column-order and formula-protection tests). New
  `scripts/verify-deliveries.mjs` (87 checks): refused saves (signed out, no
  supplier, nothing listed, unknown condition, short with no detail, future,
  too old, too long, malformed, missing and complete projects, sorting one
  that was all there), the home row, a recent supplier, a short delivery kept
  to sort, reload, a retry kept once, withdrawing and who may, marking sorted
  from the office, the spreadsheet, the office Attention list and Needs
  attention and the line leaving once sorted, the project sheet link, no
  connection keeps the form, an empty project, axe at 390px light and 1440px
  dark, 44px controls, no sideways scroll. `verify-home-and-sheet.mjs` and
  `verify-first-time-use.mjs` expect the new row, link and empty page.
  Existing checks run against this branch's build after merging #78, all
  passing: deliveries (87), home-and-sheet (142), first-time-use (358), help
  (36), accessibility (584), office-desk (73), role-access (95), permits
  (85), toolbox-talks (68), office-actions (41), day-walkthrough (87),
  error-messages (68), register-downloads (100), engineer-layout,
  navigation (76), office-landing (19), safety-actions (30), busy-projects
  (38 timings), office-phone (95). The deliveries check's title wait was
  raised to 10 s after one run read an empty tab title (the known race).
- Not verified: a physical phone, screen readers, a live tenant (none
  needed: nothing leaves RELAY). With no signal a delivery cannot be
  recorded; what was typed stays in the form.
- Proposed, not built: record deliveries with no signal; a photo of the
  delivery note (would need judging against FE-2 first); deliveries still to
  sort on the weekly summary.

## 2026-10-21 — SharePoint dates and visit dates in British Summer Time

- Why: found by the sixth release check on main (e2e84ff), following the open
  risk #77 recorded. Not a `docs/tasks.json` task, so no status changed there.
- How SharePoint dates go (decision Claude's, from the code and Microsoft's
  documented behaviour): SharePoint keeps every date and time column in UTC
  and turns a date-only value into midnight in the site's own time zone, so a
  day typed into the live list in summer on a UK site comes back from Graph
  as 23:00Z the day before. A day RELAY writes as `YYYY-MM-DD` may come back
  as 00:00Z instead. RELAY's readback check after a write already compared
  UK days, but the list reads cut the first 10 characters, so an issue's
  target date and a variation's instructed date entered in SharePoint would
  have shown a day early from April to October.
- Fix: one helper, `sharePointDay` in `lib/sharepoint/issues.ts`, reads either
  storage as the UK day, and both list reads and the readback check use it.
  It is right for a site time zone anywhere from UTC-12 to UK time; a site set
  to a zone east of the UK would still be a day out all year.
- Also: a report started online between midnight and 01:00 BST was dated the
  day before (the server used the UTC day). It now uses the UK day, as reports
  started offline already did.
- Checks: `npm run typecheck`, `npm test` (146 + 418). New tests
  `tests/sharepointDates.test.ts` (both storages, either side of both clock
  changes, a list read through mocked Graph for issues and variations; the
  read test failed before the fix) and `tests/visitDate.test.ts` (00:30 BST
  and 23:30 GMT). No browser check: nothing on screen changed.
- Not verified: the live lists (no live tenant). After deploy, compare one
  summer target date in SharePoint with RELAY, and confirm the Operations
  site's regional time zone is London.

## 2026-10-21 — What people see when something goes wrong

- Why: a cross-app quality pass asked for by the coordinator. Each feature
  was built mostly on the happy path; this goes through the failures a site
  engineer or the office will meet. Not a `docs/tasks.json` task, so no
  status changed there.
- One voice for failures (`lib/failure.ts`): every message says what
  happened, whether the work is safe and what to do. No status codes, proxy
  error pages or "Failed to fetch" as the message; the server's own reason is
  kept when it gave one. The 16 pages that showed "(502)"-style codes use it.
- Report editor (Claude's decisions):
  - Signed out partway: the bar says "Signed out · kept on this phone", a
    note above the button says the work is kept, and a prompt on any page
    offers "Sign in again" in a new tab (`SignedOutPrompt`, `/signed-in`), so
    nothing on screen is lost. The editor saves by itself once signed in
    (on coming back to the tab, and every 15 s). Before, it said "check
    connection", and a report opened after the session had gone stuck on
    "Loading".
  - Server not answering (502/503/5xx): amber, "kept on this phone", and it
    retries by itself as it already did with no signal. A save still going
    after 8 s says "Still saving · kept on this phone".
  - Problems now show above the button, not below the cards, so they are seen
    on a phone. Amber for signed out or server down, red for a refusal.
  - A refused save (a box over 10,000 characters, a photograph the server
    cannot read) was kept in the save journal and replayed before every later
    save, so the report could never save again even once put right. Refusals
    are now dropped from the journal like conflicts; no answer is still kept
    and replayed unchanged (`lib/saveRequest.ts`, test added).
  - A box over 10,000 characters is pointed out on the card before saving;
    nothing is cut off. The server's refusal names the card.
  - Photographs: each file is checked on its own, so one of the wrong type or
    over 20 MB no longer drops the others chosen with it; the message names
    each one and why. A photograph the server will not take names its card
    and says to remove it. A phone out of storage says so.
- Work held from the no-signal page: if the server is down or the person is
  signed out when it goes up, it now stays exactly as it was, signature
  included, and goes next time. Before, a save refused that way lost the
  phone signature and was handed to the editor (tests added).
- Downloads: the issue register and toolbox talk spreadsheets and the PDF
  download fetch first and say beside the button when they fail, instead of
  a "Failed" download or a file of error text (`DownloadLink`).
- PDF viewer: a PDF this browser cannot draw (old browser, pdf.js) says so and
  offers the download, instead of pdf.js's own error text.
- SharePoint: Microsoft's refusals are in plain words with the status in
  brackets at the end (`graphFailureWords`). A report whose filing misses
  once now shows "Trying SharePoint again … the report is safe in RELAY"
  rather than "needs attention"; it fails only when Microsoft refuses
  outright or RELAY gives up after 8 tries. PDF and notification failures
  show plain words; the technical reason stays on the job for an Admin.
- New page-not-found, error and last-resort pages with a way home and Try
  again (`app/not-found.tsx`, `error.tsx`, `global-error.tsx`). Before, a
  page that broke showed "Application error: a client-side exception".
- Security review (#73) unchanged in effect: the cross-site refusal now also
  carries `code: "cross-site"` so RELAY's screens can say it in their words;
  length limits, headers and sign-in fixes untouched.
- Help: one "What's new" line. Nothing claims real-phone testing.
- Check: `npm run typecheck`, `npm test` (new `tests/failureMessages.test.ts`,
  saveRequest and offlineSign additions). New `scripts/verify-error-messages.mjs`
  (68 checks, phone light and desktop dark) forces each failure and checks the
  words and that the work is still there. Accessibility check now includes
  the page-not-found and signed-in pages. Every `scripts/verify-*.mjs` was
  run against this branch's production build (results in the PR).
  Before and after screenshots: project files `ui-review/errors/`.
- Fresh-context review found 4 things, all fixed: a report that could not
  be opened claimed the phone held no copy without checking; the cross-site
  refusal was called a server fault and retried for ever (it is now said in
  its own words, not retried, and held work waits for a reload); a photo
  upload refused for another reason (report sent elsewhere) asked for a good
  photograph to be deleted (only a refusal of the photograph itself does);
  the error pages promised work was kept, which is not certain (they now say
  open it again to check).
- Browser checks: all 61 `scripts/verify-*.mjs` passed against the first
  build, `verify-pdf-navigation` included; the 12 touched by the review fixes
  (error messages, offline ×5, photo uploads, report editor, sent elsewhere,
  issue link, accessibility, PDF) passed again on the final build.
- Merged main after #75 (first-time use) and #76 (permits to work): the
  permits page uses the same failure words and download. After the merge,
  `verify-error-messages`, `-permits`, `-first-time-use`, `-help`,
  `-accessibility`, `-home-and-sheet` and `-issue-trend` passed.
- Merged main again after #77 (register spreadsheets): `verify-error-messages`,
  `-register-export`, `-toolbox-talks` and `-help` passed. `verify-permits` failed
  once on the tab title being read before it changed (its 5 s wait), then
  passed three runs in a row; not changed here.
- Not verified: a real phone, a live tenant or SharePoint, the live server
  behind Caddy (its own 502 page is simulated in the check), a real screen
  reader.
## 2026-10-21 — Registers and spreadsheet downloads as one set

- Why: a cross-app quality pass (coordinator, under Cal's ask for a clear,
  professional UI). The registers and their downloads were built one feature
  at a time (issues and variations under FE-5, permits #76, toolbox talks
  #72) and had drifted. Not a `docs/tasks.json` task, so no status changed
  there. Not FE-2, EXP-2 or EXP-4: layout, ordering and file shape only,
  nothing new is stored or sent.
- Audited with a busy project (months of reports, 1,694 issues, 415
  variations, 60 permits and 60 talks with accents, typed formulas and
  withdrawn records) at 390px light and 1440px dark: office Issues and
  Variations, snag list, Safety actions, Site diary, Toolbox talks, Permits
  to work, Issues by company. Before and after screenshots:
  `ui-review/registers/` in the project files.
- Downloads (decisions Claude's):
  - One shared module, `lib/sheet.ts`: cell writing with #73's formula
    protection, the byte-order mark, one file name rule
    (`relay-<register>[-<project number>]-<day>.csv`), and days and times.
  - House column order: the record's reference, `Project number`, `Project`,
    what it is, then each event as "<event> on" before "<event> by", then
    status; a withdrawn record keeps its row with `Withdrawn on`,
    `Withdrawn by`, `Withdrawn because` last. Permits and talks gained the
    project columns, a status (talks: Given or Withdrawn) and who withdrew;
    permits lead with the permit number; "Day" is now "Given on".
  - Days were the UTC day of the moment (an issue raised at 00:30 BST showed
    the day before); now the UK day, as on screen. Times stay UK time.
    Not reached: a variation's Instructed on and an issue's target date are
    cut to their first 10 characters when read from SharePoint, so if a live
    list stores a summer day as 23:00 UTC the day before, both would be a day
    early on screen and in the file. Untested (no live tenant); worth a look
    once RELAY reads the live lists.
  - The issue file's "Responsible company" is now "Owner", the heading on the
    register it comes from. Variations: "Instructed on" before "Instructed by".
  - Download error messages left to the error-messages thread.
- Registers: Variations now orders by any column heading on a desk and from
  an Order list on a phone, exactly as Issues does (heading component shared
  in `bits.tsx`), with "Sort: priority" and a foot saying the order; the
  download keeps it. Both registers now have status chips and sort on one
  row, and Project, Trade, then their own filters on a second; Issues used to
  start with Location. Variations says "in this search" when filtered, as
  Issues does. Withdrawn on screen was already alike (tag plus "Withdrawn by
  … · when: why" on permits and talks); left alone. Card-style project pages
  (permits, talks, safety actions, diary) stay cards: they are read on a
  phone on site, not a desk register.
- Checks: `npm run typecheck`, `npm test` (146 + 402). New
  `scripts/verify-register-downloads.mjs` (100 checks): downloads issues,
  variations, permits and talks through their pages as the office at 1440px
  dark and 390px light and as an engineer at 390px, and checks the file name,
  BOM and CRLF, headings (house order and every heading the register shows),
  rows as on screen in the screen's order (Variations sorted by Quoted on a
  desk and Raised on a phone), days and times, accents, and no typed cell
  starting with a formula sign. Also passed: verify-register-export,
  office-desk (its chip locator now skips the sort chip), office-registers,
  office-phone, office-actions, issue-register, accessibility,
  first-time-use, day-walkthrough, busy-projects, help, permits (header
  updated), toolbox-talks (header updated), role-access.
- Opened the four files from a 420-day busy data set (4,098 issues, 949
  variations) in LibreOffice 7 headless (CSV to xlsx) and read them back with
  openpyxl, and with pandas: every day and time column is a real date, no
  formula cells, accents intact. A typed "-Cut riser sleeve" shows as
  `'-Cut riser sleeve` in LibreOffice: the price of #73's protection, kept.
- Not verified: Microsoft Excel itself, a physical phone, a live tenant.
- Proposed, not built: a spreadsheet of a project's safety actions for an
  audit, in the same house order.

## 2026-10-21 — Permits to work

- Why: a new feature chosen by Claude for site and office (Cal's go-ahead to
  add features). Hot works and isolation permits are issued most weeks on an
  M&E job, and the weekly safety inspection already asks "Hot works under
  permit" and "Isolations locked off", but RELAY had nowhere to see which
  permits are open. A hot works permit left open overnight means nobody can
  show the fire watch was kept. Not a `docs/tasks.json` task, so no status
  changed there. Checked against the backlog: not EXP-2 (RELAY does not
  issue, approve or route permits; it records the paper one the principal
  contractor issued, and nothing is sent), not EXP-4 (where the work is stays
  free text in "The work and where"), not FE-2 (no photographs). No report
  editor change.
- What: `/permits?project=…` for every role on a project. Record a permit:
  kind (hot works, electrical isolation, pipework isolation, roof or work at
  height, confined space, other), the work and where, issued by, held by
  (starts as the signed-in person), issued on (today or up to 7 days back),
  runs until (UK date and time, up to 7 days after issue; 17:00 today is
  filled in before 17:00), optional permit number and notes. "Start from a
  recent one" fills in the kind, work and names of the last three different
  permits. A permit stays under "Open now" until someone on the project
  closes it, ticking the closing check for its kind (hot works: "a fire watch
  was kept for at least 60 minutes after") with an optional note. One still
  open after its end time is marked "Past its end time" and listed first.
  Withdraw with a reason (whoever recorded it, or the office), as toolbox
  talks. Download spreadsheet has every permit. Local store kind `permits`;
  nothing is sent or written to SharePoint. Closed projects take no new ones.
- Where: a "Permits to work" row under Issues and safety on the engineer
  home ("1 open · 1 past its end time", red edge while any is past its end
  time), a link in the office project sheet's Issues and safety group, and
  one line per project in the office's Attention list and Needs attention
  ("Hot works permit still open past its end time"), straight after open
  safety actions and ahead of a weekly inspection due. The desk reads
  `GET /api/permits` (no project) with its other records; if that fails it
  keeps the last answer and claims nothing new.
- Decisions (Claude's): anyone on the project may close a permit, because
  the holder may have gone home and the office closes it once site has
  said; the closing check makes that a statement, not a tap. One Needs
  attention line per project, not per permit, as safety actions do. No
  "permit due" warnings: only a permit already recorded can be late. The
  closing checks are Claude's first draft, and the page and Help say a site
  manager has not read them over yet. A permit whose end has already passed
  can still be recorded (the paper one found in a van): the form says it has
  ended and to close it after saving, rather than refusing the record. The
  page's clock moves on every 30 seconds, so a permit turns "Past its end
  time" without a reload. "Closed, last 4 weeks" counts by the day closed.
- Known quirk, left alone: the store's generic `state` column takes
  `row.work` when a record has no `state`, so a permit's work text lands
  there. Nothing reads that column for permits.
- Help: What's new "Permits to work", and a Where to find things entry.
- Check: `npm run typecheck`, `npm test` (398 app tests, new
  `tests/permits.test.ts`). New `scripts/verify-permits.mjs` (85 checks):
  refused saves (signed out, no work, unknown kind, future, too old, too
  long, ends before issue, malformed, missing and complete projects, closing
  unticked), the home row and its red edge, recording from a recent one,
  closing with the check, reload, a retry kept once, withdrawing and who may,
  the spreadsheet, the office Attention list and Needs attention and the line
  leaving once closed, the project sheet link, no connection keeps the form,
  an empty project, axe at 390px light and 1440px dark, 44px controls, no
  sideways scroll. `verify-home-and-sheet.mjs` expects the new row and link;
  `verify-first-time-use.mjs` (from #75) now checks the empty Permits page too.
  Also run and passing against this branch's build: home-and-sheet, help,
  day-walkthrough, accessibility (551), office-desk, role-access (95),
  first-time-use (336, after merging #75), toolbox-talks, navigation, office-landing, engineer-layout, safety-actions.
  In one batch run straight after a build, verify-permits and
  verify-toolbox-talks each failed once; both passed on every rerun
  (permits five times). The one fixed wait in verify-permits was replaced by
  waiting for the desk's answer.
- Not verified: a physical phone, screen readers, a live tenant (none
  needed: nothing leaves RELAY). With no signal a permit cannot be recorded
  or closed; what was typed stays in the form.
- Proposed, not built: record and close permits with no signal; show open
  permits in the site diary and weekly summary; have a site manager read
  over the closing checks.

## 2026-10-21 — First-time use and empty pages

- Why: a cross-app quality pass (coordinator, under Cal's ask for a clear,
  inviting UI). About 70 features were each built and checked with sample
  data; nobody had looked at RELAY with nothing in it, which is what a new
  engineer or office user sees on day one. Not a `docs/tasks.json` task, so
  no status changed there. Not FE-2, EXP-2 or EXP-4: wording and empty
  states only, nothing new is stored or sent.
- Walked with an empty data store (only the fixture projects) as an engineer
  at 390px light and an office manager at 1440px dark, 40-odd pages. Most
  pages already said what goes there. Fixed:
  - Help: someone who has never opened it saw "40 new to you" on the home
    screen and 31 on the office's Help button, and every entry marked New.
    Now the home row says "Start here", the office button shows no number,
    and a first visit opens with How it works (What's new after it, nothing
    marked New). From the second visit it works as before. Decision
    (Claude's): reverses #45's "everything is new on a first visit", because
    to a new person every entry is new and 40 marks say nothing.
  - Site coverage: before any site had sent a report, every active site was
    "Gone quiet" (amber count, list and tags). Now it says no site has sent a
    report through RELAY yet; gone quiet starts once any site has.
  - Issues over time: with nothing in 12 weeks it drew an empty chart, a "1"
    axis and twelve rows of noughts. Now it says so and where issues come
    from; the chart and table come back once anything is raised.
  - Office overview: "Every report has been read" and "Every open issue has
    an owner" with none at all; "all priced, awaiting the client" with no
    variations. Now "No reports received yet", "No open issues", "none
    awaiting instruction", and a short note that nothing has come in yet
    and where it will arrive. Inbox, Issues and Variations say where their
    records come from while the register is empty; Variations no longer says
    "0 instructed worth £0.00".
  - My week: a week with nothing says so once at the top (copy for a
    timesheet is off until there is something to copy). Weekly summary:
    "no reports" and "no changes", not "0 reports" and "0 changes".
  - A draft with no cards: its preview and PDF said "No actions or decisions
    arise from this visit" and the PDF had an empty Updates heading. Now
    "Nothing recorded yet. Cards added to the report show here." Only drafts
    can be empty (a site update needs a card to send). Unit test added.
  - Report preview (screen only): four greys and the gold label were under
    4.5:1 on its paper background; darkened (found by the new check's axe
    scan; the preview is not in verify-accessibility's list).
- Checked and left alone (already clear): engineer home and its rows,
  Issues, Reports, snag list, search, photographs, site diary, Safety
  actions, Before handover, notes for the next visit, Toolbox talks (#72),
  project sheet, Issues by company. The report editor was not changed.
- Check: `scripts/verify-first-time-use.mjs` (new) opens 16 engineer and 12
  office pages with no data at 390px light and 1440px dark: each shows its
  empty message, none shows an error, NaN or "undefined", no sideways scroll
  on a phone, axe-core finds nothing. `verify-help.mjs` now checks a
  newcomer's Help and a returning person's "2 new". Before and after
  screenshots: `ui-review/first-time-use/` in the project files.
- Not verified: a physical phone, a live tenant, screen readers.

## 2026-10-21 — Fifth release check (main at 2cbf367, #2–#73 minus #28)

- Why: integration and release check after the security review, asked for
  by the coordinator. Not a `docs/tasks.json` task, so no status changed
  there. Release notes refreshed in the project files
  (`releases/2026-10-20-release-notes.md`).
- Checked on a fresh checkout of main at 2cbf367 (Node 22): `npm ci`,
  `npm run typecheck`, `npm test` (146 package + 389 app tests), `npm run
  build`, then all 59 `scripts/verify-*.mjs` checks one after another
  against that build. 57 passed first time, `verify-pdf-navigation`
  included. No fault in RELAY was found.
- Two checks failed once and passed on rerun; both were the check reading
  the page a moment too early, so the checks are fixed, not RELAY:
  - `verify-toolbox-talks`: after a withdrawal, focus moves to the talk on
    the next frame, after the Withdrawn tag is drawn. It now waits up to 2 s.
  - `verify-site-notes`: Help draws the latest few What's new entries first
    and the rest once it has read what this person has seen. With seven
    entries added since, "Notes for the next visit" is below the first few,
    so it now waits for the heading.
  Each passed three runs in a row after the change.
- Deploy needs, read from the code (nothing run against the live server):
  no new settings or environment variables, no database change (toolbox
  talks are a new kind of record in the existing store; assignments carry
  two new optional fields), no SharePoint change. Microsoft sign-in still
  comes back by a GET (msal's default `response_mode=query`), so the cross-site check never
  sees it; sign-in is a link, not a form, so `form-action 'self'` does not
  touch it. Against a production build with Caddy-style headers (Host and
  X-Forwarded-Host `app.relaybyleodis.com`, Origin `https://…`), a change
  from RELAY's own address passes the check with or without
  `Sec-Fetch-Site`, and one from another site or subdomain is refused (403).
  No page frames RELAY, so `frame-ancestors 'none'` breaks nothing.
  `deploy/upgrade-pilot.sh` still covers the deploy unchanged.
- Not verified: the Docker image build (no Docker daemon in this session),
  the live server behind Caddy, a live tenant, a real phone.

## 2026-10-21 — Security and permissions review before the first deploy

- Why: 70 PRs merged and none deployed; asked for by the coordinator as a
  quality pass before go-live. Not a `docs/tasks.json` task, so no status
  changed there. Full notes: `docs/security-review-2026-10-21.md`.
- Found nothing that lets a role see or change what it should not: all 35 API
  routes resolve the session, office and Admin acts are checked, drafts stay
  their author's, ids from the browser are checked against the person and
  project. Spreadsheet formula injection and upload checks were already sound.
- Fixed (Claude's decisions, each small):
  - Sign-in open redirect: `safeReturnTo` let `/%09/evil.example` through,
    which browsers read as another site. It now refuses control characters
    and backslashes.
  - The sign-in screen showed any text in `?error=`; it now takes a code and
    shows RELAY's own words (Microsoft's AADSTS number kept).
  - Changes (POST/PUT) posted from another site are refused in middleware
    (`lib/crossSite.ts`), a second lock behind the SameSite cookie.
  - Security headers on every answer (`apps/web/security-headers.mjs`), no
    `X-Powered-By`. No full script CSP (Next.js runs inline scripts).
  - A variation's signed copy is a link only when it is https (SharePoint
    edits bypass RELAY's own check).
  - Length limits on card text boxes (10,000) and issue action notes.
  - Next.js 15.5.25 → 15.5.28 and sharp 0.35.4 → 0.35.5 (patch releases with
    advisories). PostCSS stays flagged: Next pins it and it runs only at build
    time on RELAY's own CSS.
- Help: no "What's new" line. Nothing people use changes, except that a
  sign-in error reads slightly differently.
- Check: `npm run typecheck`, `npm test` (new `apps/web/tests/security.test.ts`
  and `safeReturnTo` tests); `scripts/verify-role-access.mjs` now also checks
  the cross-site refusal, the headers, the sign-in wording and the return
  address (95 checks). All 56 other `scripts/verify-*.mjs` checks passed
  against this branch's production build; `verify-pdf-navigation.mjs` was not
  run (it fails on main, see CLAUDE.md).
- Deploy: nothing needs Entra or SharePoint. Optional Caddy request size limit
  described in the review notes. After deploying, send one test report to
  confirm the cross-site check accepts RELAY's own address through Caddy.
- Not verified: a live tenant, the live server behind Caddy, a real phone.

## 2026-10-21 — Safety in the office's Needs attention

- Why: the last of the day walkthrough's (#65) bigger ideas still open
  besides the inspection PDF: open safety actions and towers due were only
  visible on Safety actions and as a count on one button, so the office's
  Attention list and Needs attention said nothing about a blocked fire exit
  or a tower overdue its seven-day inspection. Not a `docs/tasks.json` task,
  so no status changed there. Checked against the backlog: not EXP-2
  (nothing is routed or sent to anyone; it lists what Safety actions already
  holds), not FE-2 (no photographs), not EXP-4 (tower names stay free text).
  No report editor change.
- Decisions (Claude's):
  - Where: the office's Attention list (the bell), the Office position's
    "Also needs attention" and a project sheet's "Needs attention". The site
    home has no such list; its Safety actions row already says "2 open · 1
    tower due" (#65), and now has the red edge of a late row while anything
    is open or due.
  - What makes a line: one per project with safety actions open ("3 safety
    actions open", with the oldest and what was wrong), not one per action,
    because a weekly inspection can find a dozen and the office's next step
    is the same for all of them (open the project's Safety actions); one per
    tower or podium due; one per project whose weekly safety inspection is
    due. A project never inspected gets no line: the page counts those apart,
    and not every project may use RELAY's inspections.
  - Order: straight after a report the worker gave up on, ahead of overdue
    issues: towers due, then open actions (oldest first), then weekly
    inspections due. A tower due or an open safety action is a risk to
    people on site today; an overdue issue is late work.
  - Counts: the desk now reads `/api/safety-actions` with its other records
    on every refresh, so the Safety actions button, the bell and the lists
    count from one answer. The lines add up to the page's totals (unit test).
    If that read fails, the desk keeps the last answer and claims nothing
    new; it never stops the rest of the desk loading.
  - Links: each line opens that project's Safety actions with Back to Office.
- Help: What's new "Safety in Needs attention".
- Check: `verify-day-walkthrough.mjs` now checks, at 390px and 1440px, that
  Also needs attention and the bell show the podium due and "2 safety actions
  open" first, that the bell's count is its number of lines, that the line
  opens Safety actions with the same 2 open and 1 tower due and comes Back to
  Office, that the project sheet shows both (1440px), and that the site home
  row is marked. Unit tests for `safetyAttention` in `safetyActions.test.ts`.
- Not verified: a physical phone, a live tenant, screen readers.

## 2026-10-21 — Inspection PDFs say what was found wrong

- Why: the last open idea from the day walkthrough (#65). An inspection
  PDF's first section, "Actions arising", listed the check, the action and
  who is to do it, but not what was found: "Fit a proper edge barrier"
  without "open edge with only a strap across it". A client or contractor
  reading page one had to turn to the notes further on to know what the
  action was about. Not a `docs/tasks.json` task, so no status changed
  there. Checked against the backlog: not FE-2 (no photographs), not EXP-2
  (nothing routed or sent), not EXP-4 (no locations).
- Changed (packages/documents only): on an inspection, each Actions arising
  row with notes now reads "Found: …" above the action, in smaller, quieter
  type. Site updates' summary is unchanged.
- Decisions (Claude's): the finding goes in the action cell, not a new
  column, as five columns would squeeze the check and owner on A4. Notes
  over 180 characters are cut at a word with "… (see 03 below)", because the
  row is kept on one page and every action check is also shown in full in
  Notes and photographs. A check with no notes shows only its action;
  nothing is made up. PDFs already made do not change: sent PDFs are stored
  by revision and served from the store, so only newly made PDFs (and draft
  previews) show the line.
- Help: What's new "Inspection PDFs say what was wrong".
- Verified: `npm run typecheck`, `npm test` (2 new tests in
  `apps/web/tests/reportPdf.test.ts`: the Found line, no line without notes,
  long notes cut with a pointer and kept in full below, no Found line on a
  site update). `scripts/render-sample-pdfs.mjs` before and after: safety,
  handover and tower inspections gain the line with the same page count;
  first fix and the site update PDFs have the same text as before. Before
  and after PDFs and page images: `ui-review/pdfs/found-wrong/` in the
  project files.
- Not verified: printed on paper, Acrobat or a phone's PDF viewer (poppler
  and pdf.js only), a real SharePoint-filed PDF.

## 2026-10-21 — Toolbox talks (new feature)

- Why: Claude's choice under Cal's freedom to add features. A toolbox talk
  is the short safety briefing given on site before work starts; principal
  contractors and clients ask for the record (topic, day, who attended) at
  audits, and today it is a paper sheet in the cabin that rarely reaches the
  office. RELAY had nothing for it. It is useful to engineers (record it in a
  minute, repeat last time's names) and to the office (one record per
  project, a spreadsheet for an audit). Not a `docs/tasks.json` task, so no
  status changed there. Checked against the backlog: not FE-2 (no
  photographs), not EXP-2 (nothing is requested, routed or sent for a
  decision), not EXP-4 (no locations at all). Not a report type (EXP-5): it
  needs no PDF, signature or revision, so it is a light record like notes
  for the next visit, and the report editor is untouched.
- What: `/toolbox-talks?project=…` for every role on a project. Record a talk:
  topic (free text, with one-tap starters: this project's own recent topics,
  then 12 common M&E ones), given on (today or up to 31 days back), given by
  (starts as the signed-in person), who attended (one name per line or
  semicolon, the same name twice kept once, up to 60, "Same people as the
  last talk"), optional notes. The page shows the last talk and how long ago
  (caution colour when more than a week), and the last four weeks' talks,
  attendances and different people. Download spreadsheet gives every talk,
  withdrawn ones marked. A talk entered by mistake is withdrawn with a
  reason by whoever recorded it or the office, stays listed struck through,
  and leaves the figures. Nothing is removed, sent or written to SharePoint
  (local store kind `toolbox-talks`). Closed projects take no new talks.
- Where: a "Toolbox talks" row under Issues and safety on the engineer home
  ("Last: Safe isolation · today", from `?summary=1` so the home reads a few
  bytes), and a link in the office project sheet's Issues and safety group.
- Decisions (Claude's): names are typed, not signed, as on most paper
  sheets; commas do not split names, so "Ali Khan, Northbank Electrical" is
  one person. No count added to Needs attention or Safety actions: how often
  talks are due differs by contractor, and a "talk due" warning would be a
  rule nobody agreed.
- Help: What's new "Toolbox talks", and a Where to find things entry.
- Check: `scripts/verify-toolbox-talks.mjs` (new, 68 checks) covers refused
  saves, the home row, recording with a starter and the same people, the
  figures, reload, retries kept once, withdrawing and who may (another
  engineer is refused), the spreadsheet, the office from the project sheet,
  other and complete projects, no connection, axe at 390px light and 1440px
  dark, and focus after a withdrawal. The spreadsheet writes times in UK
  time. `verify-day-walkthrough.mjs` now records the morning toolbox talk
  from the home screen; `verify-home-and-sheet.mjs` expects the new row and
  link. Also run and passing: help, navigation, role-access, accessibility
  (551), busy-projects (38 timings within budget). Unit tests in
  `tests/toolboxTalks.test.ts`.
- Not verified: a physical phone, screen readers, a live tenant (none
  needed: nothing leaves RELAY). With no signal a talk cannot be recorded;
  what was typed stays in the form.
- Proposed, not built: record a talk with no signal (as notes and
  inspections do); show talks in the site diary and weekly summary.

## 2026-10-21 — Report editor on tablets and desktops

- Why: the editor was designed and checked phone first. Some engineers use a
  tablet on site, and the office may write or correct reports at a desk.
  Asked for by the coordinator under Cal's ask for a clear, professional UI;
  what to change is Claude's decision. Not a `docs/tasks.json` task.
- Walked a site update and a safety inspection (plus the first check of the
  handover, first fix and tower inspections) at 390, 768 and 1024 (touch) and
  1366 and 1920 (mouse), light and dark. Found and fixed:
  - From 601px up the editor's own padding replaced the room left for the
    fixed bottom bar, so "+ Add a card" and the signature's Clear and hint
    sat under the bar. The editor now keeps 140px clear below.
  - The bar's contents were 900px wide under a 1,072px page, so the save
    state and the main button did not line up with anything. They now line up
    with the page edges at every width.
  - The check step was one column the width of the page: at 1920 the
    signature box was 1,040 by 150px. From 1000px signing sits in its own
    column beside what is being sent (340 to 440px wide), and from 601px the
    box is 180px tall.
  - With 12 checks the list beside the open check ran far below the screen.
    From 900px it scrolls in its own column, and "Next check" keeps the open
    one in sight there. From 1280px the list is 300px wide, not 260px.
  - The sent screen's "2 cards · 3 photographs" was 18px capitals (a heading
    rule beat the label style); it is now the small label it was meant to be.
  - "Signature" was the only field label in plain text; it now matches.
  - On a phone or portrait tablet "What needs doing" and "Who is to do it"
    ran together with no rule between them; they are now separated like
    every other field.
- Also fixed, from the day-on-site walkthrough (#65), which left the editor alone:
  - The check step counts a defect linked to an issue already raised apart
    from new ones: "1 issue raised · 1 added to an issue already raised".
  - Linking a defect to an issue takes that issue's trade.
  - While changes are still saving it says "being saved to the server", not
    "not yet on the server" (`reportWhere`'s new `saving` option, unit-tested).
  - #65's other two points (tab title, sent-screen date comma) were fixed by #64.
- Check: `scripts/verify-editor-wide.mjs` (new, 274 checks) walks all of the
  above at the five widths in both themes, by touch on tablets and mouse on
  desktops. Screenshots before (main at 232c451) and after are in the project
  files under `ui-review/editor-wide/`.
- Not verified: a real tablet, pen or touchscreen laptop. In Chromium's touch
  emulation the first tap after a drawn signature gives no click (a second tap
  works, a mouse is not affected); the check taps the page once first. Worth
  trying on a real tablet.
- Left as they are: on a site update the check step lists each photograph
  without a caption as its own line (three lines for three photographs); the
  editor's heading and steps take about a third of a 768px-tall landscape
  tablet screen.

## 2026-10-21 — Assign from the issue page

- Why: the day walkthrough (#65) left four bigger ideas; #67 built the
  first. Of the other three, Claude chose "the office issue page shows Not
  yet assigned with no way to assign there". Issues reach the office from
  search, the register, Issues by company and Before handover, all
  of which open the issue page, and giving an issue an owner is the office's
  most common act on one; it meant going back to the desk and finding the
  issue again. The inspection PDF's action list leaving out what was wrong,
  and open safety actions in the overview's Needs attention, stay proposals.
  Not a `docs/tasks.json` task, so no status changed there. Checked against
  the backlog: not EXP-2 (no decision is requested or routed; it is the
  desk's existing Assign, which only records an owner), not FE-2 (no
  photographs), not EXP-4 (no locations). No editor change.
- Changed:
  - Managers and admins see "Who puts it right" on an open, assigned or in
    progress issue, with Assign or Reassign, Responsible (the companies
    already named on the project suggested, free text as everywhere), Target
    date and Instruction. It sends the same `assign` command as the desk.
    Not shown on an issue fixed and waiting to be checked or closed, as the
    server refuses those, nor on a withdrawn one, as the rest of the page
    hides its actions there; engineers never see it. Clearing the date
    removes the target date, as on the desk.
  - The issue's title block shows its target date for everyone.
  - Assignments now record who they went to and the date on the history
    event (`to`, `targetDate`), so the history reads "To Northbank
    Electrical, by 28 Oct 2026" on the issue page and on the desk's issue
    history, whichever assigned it.
    Older assignments have neither and show as before.
  - The server refuses an assignment that names nobody (it used to clear the
    owner while marking the issue assigned), and trims the owner.
- Help: What's new "Assign from the issue itself"; the office day guide
  mentions Assign on the issue.
- Check: `scripts/verify-issue-assign.mjs` (48 checks, incl. the desk history): manager at 390px
  light and 1440px dark assigns, sees owner, target date and history update
  in place, Reassign starts from the current values, an empty owner is
  refused, axe finds nothing in the open form; no Assign on an issue fixed
  and waiting to be checked; an engineer sees the owner but no Assign and
  the API refuses them. Unit test for the event fields and the empty owner.
- Not verified: a physical phone, a live tenant (the owner reaches
  SharePoint by the existing issue sync, not changed here), screen readers.

## 2026-10-21 — Start the inspection that is due from Safety actions

- Why: the day walkthrough (#65) left four bigger ideas as proposals. Claude
  chose "Safety actions offers no way to start the inspection that is due"
  because it helps engineers on site most and closes a loop the page opens:
  it says a tower is due, and the engineer had to go back to the Site page
  and type the tower's name again, where a different spelling would split
  its actions from the tower's history. The other three stay proposals for
  later: the inspection PDF's action list leaving out what was wrong (worth
  doing next, PDF only); assigning from the office issue page; open safety
  actions in the office overview's Needs attention. Not a `docs/tasks.json`
  task, so no status changed there. Checked against the backlog: not FE-2
  (no photographs), not EXP-2 (nothing is routed or sent for a decision),
  not EXP-4 (the tower name is the free text last written, no catalogue).
  No report editor change, as another thread is working there.
- Decisions (Claude's):
  - Engineers only. Managers and admins keep a read-only page, as the
    office does not carry out inspections.
  - Each project has "Do a safety inspection", gold when one is due or none
    has been sent; each tower listed has "Inspect", gold when due. Inspect
    starts a tower inspection named exactly as the tower was last inspected.
  - One of each in draft at a time, as on the site home: with a safety or
    tower inspection already in draft on the project, the page offers
    "Continue the …" instead, and towers show no Inspect until it is sent.
    The engineer's drafts come with the page's data on every load
    (`/api/safety-actions` adds `drafts` for engineers), so coming Back from
    the editor, by the link or the phone's Back, never offers a second start.
    The server still allows a second draft, as it did from the site home.
  - The editor opens with Back to Safety actions, so the engineer returns to
    the page. With no signal the page itself cannot load, so the error says
    to start from the Site page, which works offline.
  - Projects with no safety inspection yet get the button too.
- Help: What's new "Start the inspection that is due from Safety actions";
  the tower guide mentions Inspect.
- Check: `verify-day-walkthrough.mjs` now starts the due podium's
  inspection from Safety actions, checks it is named as last time, comes
  Back (the browser's Back, then the editor's link) and finds "Continue the
  tower inspection of …" in place of Inspect;
  the office's view has no start buttons.
- Not verified: a physical phone, a live tenant, screen readers.

## 2026-10-21 — Fourth release check on main

- Why: an integration and release check across #57 to #65 (typed
  signatures, notes for the next visit and reading them with no signal,
  tower inspection, PDFs, the two wording passes, speed on busy projects,
  the day walkthrough), as the checks in #29, #44 and on 20 Oct at 11a1572
  did. Asked for by the coordinator under Cal's standing ask. Not a
  `docs/tasks.json` task, so no status changed there.
- Checked: main at 232c451 (#2 to #27, #29 to #65). `npm ci`,
  `npm run typecheck`, `npm test` (145 + 371 pass), `npm run build`, and
  all 56 `scripts/verify-*.mjs` one after another (Node 22 here; CI runs
  Node 24). All pass, including busy-projects (38 timings within budget),
  accessibility (551) and pdf-navigation, which now passes in this
  container's Chromium 141 (fixed in #65).
- Fixed: `verify-day-walkthrough.mjs` failed once in four runs with a
  strict-mode clash: `getByText(/Page 1 of \d/)` also matched the PDF's
  own text layer, which carries the footer page count added in #60, when
  it drew before the wait ended. It now matches the viewer's label exactly
  (`/^Page 1 of \d+$/`); three runs in a row passed. No change to RELAY.
- Looked across the features for clashes; none found. The tower inspection
  is data-driven everywhere (no list of type ids left out), raises no
  issues, and SharePoint filing does not read the report type. No new
  environment variables, packages, record tables or SharePoint columns since
  #56; new data is new optional report fields and the `site-notes` record
  kind. `deploy/upgrade-pilot.sh` still covers the deploy.
- Compression (proposed in #62): `encode zstd gzip` in `deploy/Caddyfile` is
  safe (Caddy skips responses that already have Content-Encoding, and RELAY
  sends no event streams) but gains little, since Next and
  `lib/jsonResponse.ts` already compress pages and large answers. The
  upgrade script restarts only web and worker, so it would also need
  `docker compose -f deploy/compose.yaml restart caddy`. Not made.
- Release notes for Cal brought up to date to #65 in the project files
  (`releases/2026-10-20-release-notes.md`), keeping the caveats.
- Not verified: a physical phone, a real screen reader, a live tenant,
  building the Docker image, printing or Acrobat.

## 2026-10-21 — A day on site, end to end

- Why: every feature was tested on its own; nobody had walked a whole day
  across them. Asked for by the coordinator under Cal's standing ask for a
  clear, inviting UI; the fixes are Claude's decisions. Not a
  `docs/tasks.json` task, so no status changed there.
- Walked (local data, 71 pages read as text and screenshots): an engineer on a
  390px phone reads the home screen and notes, does a weekly safety inspection
  (typed signature) and a tower inspection, sends a site update with a defect
  linked to an existing issue, a new defect and a card added with no signal,
  then My week, Safety actions, the diary, Before handover and the home screen
  with no signal; the office on a 390px phone and at 1440px reads the overview,
  Inbox and reader, review queue, issues, the new issue, Safety actions, Before
  handover, snag list, companies, coverage, search, notes, the PDF and summary.
- Fixed:
  - With no signal the site home said "0 open issues", "0 open · every trade"
    and "0 on file", and "Came back from the office" said "Nothing on this
    project yet". It now says RELAY cannot check with the office (with Try
    again) and shows no counts; the notes row shows the copy kept on the phone
    (PR #63), marked "copy on this phone".
  - Safety actions had no count anywhere, so two open actions and a tower due
    were invisible from the home screen and the office overview. The home row
    now reads "2 open · 1 tower due" (and "safety inspection due" when a week
    has passed, "no safety inspection yet" when there has been none); the
    office overview button "Safety actions · 2 open".
    `/api/safety-actions?project=` narrows the work to one project for the home.
  - The report PDF viewer had no tab name; it is now "Report PDF". (#64,
    merged while this PR was open, gave it and the summary the shared header.)
  - The office overview's "Received this week 6 · 7 PM notifications pending"
    counted every report ever waiting; it now says this week's apart from
    older ones ("2 pending · 3 older") and never "notified" while any waits.
  - Engineer Issues had a disabled "Assigned to me · Coming soon" button and a
    developer note under it; removed (owners are companies, not accounts).
- Check: `scripts/verify-day-walkthrough.mjs` (59 checks) runs the whole day
  and compares counts between pages (home, Issues, register download, snag
  list, Before handover, Safety actions, My week). Updated
  `verify-engineer-layout` (no Assigned to me), `verify-navigation` (count on
  the overview button) and `verify-pdf-navigation` (Next's route announcer now
  reads the tab title; the check passes in this container's Chromium 141).
- Not fixed, written up in the PR as proposals or for the report editor thread:
  inspections' browser tab says "Site update"; the check step says "2 issues
  raised" when one defect is linked; a linked defect's trade defaults to the
  engineer's, not the issue's; the inspection PDF's action list leaves out what was wrong; Safety
  actions offers no way to start the inspection that is due.
- Not verified: a physical phone or real loss of signal (Playwright's offline
  switch stands in), a live tenant, screen readers.
## 2026-10-21 — The same words in reports and inspections

- Why: #61 brought the rest of RELAY into line but stopped short of the
  report editor, which another thread was changing. This finishes that pass
  for the editor (site updates and all four inspections: cards, check step,
  signing, sent screen), the draft-conflict and sent-elsewhere panels, the
  on-screen document and PDF pages, and the no-signal page (after #63 merged).
  Not a `docs/tasks.json` task, so no status changed there.
- Decisions (Claude's):
  - Dates come from lib/dates.ts: "Wed 21 Oct, 14:05" on the sent screen and
    its stages (was "Wed, 21 Oct, 02:06" with the browser's comma), "on Wed
    21 Oct at 14:05" inside the conflict panels' sentences, "Wednesday 21
    October 2026" for the visit date and "21 Oct 2026" for photographs on the
    document page (was "2026-10-21" and "21/10/2026"). The no-signal page
    writes dates the same way from parts, in UK time.
  - The PDF matches: visit date "Wednesday 21 October 2026", photographs
    "Taken 21 Oct 2026", signatures "21 Oct 2026, 16:32" (were "21/10/2026").
    packages/documents writes them from parts too; it cannot import the web
    app's lib/dates.ts, so the few lines are repeated there.
  - Counts say "photograph(s)" as the rest of RELAY does (card rows, where
    the work is, Undo bar, conflict panel, no-signal list). Buttons that open
    the camera keep "Take a photo" / "Add another photo"; the no-signal page
    said "Add a photo" and now says "Take a photo" as the editor does.
  - Back always says "Back to …": the editor's fallback is "Back to Site"
    (it named the project), the error page's "← Projects" went to a page an
    engineer does not use and now goes back to Site, and the document page's
    "← Report" is "Back to report", as the PDF page already said. The PDF
    page's "View report summary" is "View the document", the sent screen's
    name for that page.
  - The document and PDF pages take the engineer header (no old Home /
    Companies / Projects bar), via a new `.eng-chrome` marker in
    engineer.css that changes only the header, not the page's own layout.
    The editor's tab says the report type ("Handover inspection"), not "Site
    update" for every type.
  - "Received by RELAY", "On file in RELAY", "Generated by RELAY": the
    product's name as its header writes it. Emails still say Relay (not
    touched: sending is not live).
  - Sent cards say "Owner:" like the PDF (was "For:"); the conflict panel's
    field is "Owner" too. "raise VOs" is "raise variations".
  - On the no-signal page an inspection check asks what the editor asks:
    "Where" (was "Where (for the snag list)"), and for an action "What’s
    wrong", "What needs doing", "Who is to do it"; any other answer has
    "Notes · optional". It used to show "Notes or what is wrong" and the
    action fields for every answer. Service worker cache bumped to v14.
  - Kept: "rev 2" in the editor, since the diary, issue history and office
    all say "rev"; the PDF's "Revision" is a document field label.
- Help: What's new "The same words in reports and inspections".
- Verified: typecheck, npm test, build, every browser check except
  verify-pdf-navigation (known to fail on main). Before and after
  screenshots at 390px light and dark: `ui-review/consistency/editor/` in
  the project files. Not verified: a physical phone, a printed PDF.

## 2026-10-21 — Speed on busy projects

- Why: the pages added on 2026-10-20 add things up across every report, issue
  and inspection on a project, and had only met small seed data. Asked for by
  the coordinator under Cal's ask for a UI people are happy to use; what to
  fix and how is Claude's decision. Not a `docs/tasks.json` task.
- Data: `scripts/seed-busy-projects.mjs` (new) writes three projects with
  fourteen months of weekday updates from three trades, weekly safety and
  tower inspections, first fix and handover inspections, corrections and
  drafts: 3,102 reports, 4,098 issues (20,421 events), 949 variations, about
  25,000 photograph records, notes and chases.
- Check: `scripts/verify-busy-projects.mjs` (new) seeds that, times 18 API
  calls warm, 13 engineer pages on a throttled phone (4x slower processor,
  Chrome's "Fast 4G": 9 Mbps, 60 ms) and 7 office pages on a 1440px desktop,
  and fails when a time or a download size is over budget. Time budgets are
  about twice today's; size budgets are tight, as they do not vary by machine.
- Before and after, same machine and settings (main at 69db524, then this branch):

  | Page or call | Before | After | API data over the network |
  | --- | --- | --- | --- |
  | Issue spreadsheet download (`/api/issues/export`) | 35,091 ms | 111 ms | |
  | Engineer home, phone | 4,470 ms | 1,215 ms | 3,603 → 16 KB |
  | Engineer issues, phone | 4,302 ms | 2,212 ms | 3,279 → 263 KB |
  | Snag list, phone | 4,451 ms | 2,204 ms | 3,285 → 268 KB |
  | Photographs, phone | 4,964 ms | 2,468 ms | 3,695 → 351 KB |
  | Office desk, desktop | 2,837 ms | 1,132 ms | 12,376 → 680 KB, every 15 s |
  | Office inbox, desktop | 5,498 ms | 2,181 ms | 12,376 → 680 KB |
  | Weekly summary (API) | 287 ms | 75 ms | |
  | Issues over time (API) | 213 ms | 30 ms | |
  | Issues by company (API) | 288 ms | 79 ms | |
  | Search (API) | 657 ms | 317 ms | |

  The other pages were already quick and stay within 100 ms or so of before
  (run-to-run noise); every number is in the PR.
- Found and fixed (what the pages show is unchanged):
  - The spreadsheet looked up "review in use" with a query over every report,
    and read a whole report for its reference, once per issue row. Now once
    per file, and the reference comes from the report's summary.
  - API answers were sent uncompressed (Next compresses pages, not route
    handlers). Large JSON answers are now gzipped when the browser accepts it
    (`lib/jsonResponse.ts`): a project's 3.3 MB issue list is 263 KB.
  - The engineer home fetched every issue and variation on the project to show
    six rows and an open count. `/api/came-back` (new) returns just those.
  - The office desk read reports 50 at a time (63 calls on this data, every
    15 s) and every issue with its full history. Office pages are now 500
    reports, and the desk's issues carry only their latest event
    (`deskIssue`); the issue page still loads the whole history.
  - Day and sort helpers made a new date formatter or collator on every call
    (`toLocaleDateString` with a time zone, `localeCompare` with options).
    One of each is now made once; results are identical (unit-tested,
    including the clock changes).
  - The site diary searched the whole issue list for each card; it now looks
    only at the records raised by that report. Search ranks each hit once
    rather than on every comparison, and skips records that cannot match.
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`
  (7 new tests in `apps/web/tests/busyProjects.test.ts`), the new check
  twice in a row within budget, and 29 existing browser checks for the pages
  touched (role access, engineer layout, search, office desk, diary, register,
  export, since last visit, photos, snag list, weekly summary, issues over
  time, by company, chases, my week, safety actions, before handover, home and
  sheet, coverage, office actions, landing, registers, phone, review queue,
  provenance, engineer nav, navigation, help, accessibility).
- Not verified: a real phone (Chrome's throttling stands in for one), the live
  server's own speed, or real site data, whose words repeat less than the
  seed's, so gzip will save somewhat less than shown. The office inbox still
  draws every received report in one list (2.2 s here), and the desk still
  re-reads everything every 15 s; both would need a change to what the pages
  show or how they refresh, so they are left for a separate decision.
- Proposed, not done: `encode zstd gzip` in `deploy/Caddyfile` would compress
  everything else too (pages are already gzipped by Next); it needs a deploy.
  Add `verify-busy-projects.mjs` to the browser checks listed in `CLAUDE.md`.

## 2026-10-21 — Notes for the next visit with no signal

- Why: notes for the next visit (#58) are most needed in a basement, riser or
  plant room, where there is often no signal, and #58 could not show them
  offline. Asked for by the coordinator under Cal's standing ask; the choices
  below are Claude's. Not a `docs/tasks.json` task, so no status changed.
- What: the engineer home now leaves the open notes on every project the
  engineer reports on on the phone (`lib/offlineNotes.ts`, key
  `relay-offline-notes:<person>`, from new `GET /api/site-notes/mine`), next
  to the person and projects the offline page already used (#41). The notes
  page refreshes its project's copy whenever it reads or changes notes. The
  copy holds each note's words, who left it, their trade and when; no ids of
  people and nothing done with. Signing out removes it.
- The no-signal page (`public/offline.js`) shows "Notes for the next visit"
  above "Start a report": one fold per project with notes, the project being
  worked on (or the one in a `/site-notes?project=` address) open, newest
  first, each with who and when, and "Last updated Wed 21 Oct, 14:05" per
  project; a copy over a week old adds "This may be out of date." Opening
  `/site-notes` with no signal lands on it. Service worker cache bumped to
  `relay-public-v13` with the digest in `tests/serviceWorker.test.ts`.
- Decision: read only with no signal. Notes are short and mostly read on
  arrival; leaving or folding one offline would need a queue that replays
  against the 20-note limit and against someone else having folded or put
  back the same note in the meantime, and a note written underground can wait
  for the walk back up. The page says plainly that leaving a note or marking
  one done with needs signal. Revisit if engineers ask for it.
- Notes are still never sent anywhere and never on a report or PDF; the copy
  stays on the phone and the offline page makes no requests about notes (a
  unit test checks it has no `/api/site-notes` call).
- Also: the notes page now writes dates with `whenShort` from #61 ("Wed 21
  Oct, 14:05") instead of the browser's own pattern.
- Help: a What's new entry, and a line each under "No signal" and "Passing
  word on".
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`
  (new `tests/offlineNotes.test.ts`), `npm run build`, new
  `scripts/verify-site-notes-offline.mjs` (36 checks at 390px light and
  1440px dark: copy kept with signal, open notes only, no person ids, same
  projects as the offline page, notes page turns into the no-signal page
  when signal goes, cold start shows notes newest first with who and when,
  read only, last updated time, old copy warning, axe clean, sign-out
  removes it), and the existing `verify-offline-capture`,
  `verify-offline-inspection`, `verify-offline-sign`, `verify-site-notes`,
  `verify-help`, `verify-role-access`, `verify-engineer-layout`.
- Not verified: a physical phone in a real no-signal spot (stopping the
  server stands in for it); a phone that has not opened the engineer home
  since this change has no copy until it does.

## 2026-10-21 — The same words on every page

- Why: pages built separately over the day read like different products. A
  cross-app pass under Cal's standing ask for a clear, professional UI, after
  the navigation (#40), accessibility (#48, #53), office desk (#51) and home
  screen (#54) passes. Every engineer page was read at 390px light and every
  office page at 390px light and 1440px dark (text dump and screenshots of 32
  pages), looking for one thing called by different names.
- Decisions (Claude's):
  - An issue put forward as fixed is "Fixed, to check" on every page and for
    every role (`ISSUE_WORK` in lib/status.ts). It was also "Ready for
    verification", "Awaiting verification", "Verify", "To verify", "Ready to
    verify" and "Waiting for verification". The office's buttons keep the verb
    "Verify", since that is what the office does. SharePoint's Work Status
    column keeps "Awaiting verification" (a stored value, not screen words).
  - Dates read one way, from lib/dates.ts: "Wed 21 Oct", "Wednesday 21
    October 2026", "21 Oct 2026", "Wed 21 Oct, 14:05", UK time. They are
    written from parts because Chromium and Node do not agree on en-GB
    ("Wed, 21 Oct" against "Wed 21 Oct", "Sept" against "Sep"), so the same
    date read differently from page to page. Gone: "11/10/2026" on an issue,
    "2026-10-17" target dates on the office desk and engineer home, "Visit
    2026-10-20" on the project page, "05 Oct" with a leading zero.
  - Issue, variation and project pages share the header the rest of RELAY
    has (the old Home / Companies / Projects bar is gone there), and their
    Back link always says "Back to …"; without a return path it says "Back
    to Issues" or "Back to Site", matching where it goes. The variation page
    names its project in the line under the reference, which the Back link
    used to do. Buttons on these pages no longer touch.
  - A variation done before instruction is "Done, not instructed" on the
    weekly summary too. Search keeps "With the office" for a waiting
    variation, so it matches the variation page it opens.
  - The issue spreadsheet's Work column says "Fixed, to check" like its
    Verification column, and the office's attention lists tag such issues
    "Fixed, to check" (their buttons still say "Verify").
  - The project page says "Start a site update", "cards" and "Received", as
    the engineer home does; the office says "cards", not "sections". Plurals
    fixed: "1 reports", "Needs action hides 1 reports, 1 issues".
  - Project lists on Snag list, Weekly summary, Photographs, Site diary and
    Search name each project by number and name, as the other pages did.
  - "Open issues by company" is "Issues by company", as its link, tab title
    and Back link already said.
- Help: the glossary term is now "Fixed, to check"; the office day and
  closing-an-issue steps say so; What's new "The same words on every page".
  The Help test now checks every status in `ISSUE_WORK` is explained.
- Kept out of the report editor (another thread is adding a report type).
  Still to align there: the editor's own date formats and the draft-conflict
  and sent-elsewhere panels.

## 2026-10-21 — Report and inspection PDFs

- Why: the PDF is what the office sends a client and keeps as the compliance
  record, and it had been extended a type at a time (site updates, three
  inspections, typed signatures, the tower inspection from #59). Asked for by
  the coordinator under Cal's standing ask for a clear, professional output;
  the changes below are Claude's decisions. Not a `docs/tasks.json` task, so
  no status changed there.
- Looked at: `scripts/render-sample-pdfs.mjs` (new) renders one PDF of every
  kind from realistic data (site update with 12 photographs and a long
  unbroken reference, draft, sent without review, correction, safety,
  handover, first fix and tower inspections, drawn, typed and name-only
  signatures). Before and after PDFs and side-by-side images:
  `ui-review/pdfs/` in the project files.
- Found and fixed (packages/documents, plus `correction` in documentModel):
  - Pages after the first said nothing about what they belonged to. The
    footer now reads "Site Progress Report · Tetley Hall Block E ·
    011LME-SPR-004 · Revision 1 · Approved for issue" (and the tower, on a
    tower inspection), shortened with an ellipsis before it meets the page
    number. Characters the footer font lacks (Ł, emoji) fall back to plain
    letters or are left out instead of stopping the PDF (the reference part
    of the footer too).
  - A long reference with no spaces ran off the right edge; runs over 24
    characters may now break. react-pdf marks every such break with a
    hyphen, and a break next to a hyphen already in the text can show as
    "--" (a quirk of its line breaking, seen with a 90-character circuit
    reference; not fixed).
  - "Sign off" could end a page with its boxes on the next; they are one
    block. A card's number, title, words and action are kept on one page
    (only a card too long for that may break), so an action is not parted
    from what it is about; photographs can still follow on the next page.
  - An inspection's results table split with no column heads on the second
    page; they now repeat, and the results open with a tally of each result
    (12 checks; 9 satisfactory; 2 action needed; 1 not applicable).
  - The summary numbered its rows 01, 02… while the updates were 02, 04…;
    each row now carries its update's or check's number.
  - The cards never said who was to act; the action box now ends "Owner:
    …" or "Owner: Awaiting confirmation", as the summary does ("Owner" is
    the office register's word too).
  - A correction gave no sign it was one; it now says "Revision 2 · replaces
    revision 1" and the reason given, under the title block.
  - Drawn signatures were dated to the day, typed ones to the minute; all now
    say how they were made and when ("Drawn signature · 19/10/2026, 16:32",
    "Typed signature …", "Sent without a drawn signature …", "Not signed
    yet"). The PDF's document title names the kind, reference and project.
- Decisions: PDFs already made are kept as they are (they are keyed to the
  sent revision), so only new ones change. Nothing about filing or delivery
  changed. A two-card report whose sign-off no longer fits on page one now
  puts the whole sign-off on page two, rather than its heading alone.
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`
  (7 new tests in `apps/web/tests/reportPdf.test.ts`, which read the
  rendered text back with pdf.js: footer on every page, Ł and emoji, summary
  numbers and owners, signature wording, tally, a card of 70 short lines
  kept whole, correction from the stored
  report), every sample rendered and looked at page by page.
- Not verified: printed on paper; opened in Acrobat or on a phone's PDF
  viewer (checked with poppler and pdf.js); a real SharePoint-filed PDF.
  Real photographs were stand-ins of the same sizes.
- Proposed: add `render-sample-pdfs.mjs` to the commands in `CLAUDE.md`; a
  variation card could print who asked and why (not done: some of those
  fields are pricing notes for the office, not the client).

## 2026-10-20 — Tower inspection (EXP-5, fourth report type)

- Added a fourth checklist type, "Tower inspection" (Tower and Podium
  Inspection, references `-TPI-`): one mobile tower or podium, inspected after
  it is put up or moved and at least every seven days while it stays up, as
  the Work at Height Regulations 2005 expect. 12 checks (tag, built to the
  instructions, ground, castors and legs, stabilisers, braces, damage,
  platform, guardrails and toe boards, inside access, surroundings, height
  and load). Signature required, drawn or typed (#57). The checks are
  Claude's first draft, and the Help entry says they may change.
- Why this type: M&E engineers use towers and podiums every day, the
  inspection record is a legal requirement that today lives on paper tags,
  and it was the type #55 set aside only because inspections had nowhere to
  name what was inspected. Chosen by Claude under Cal's standing instruction.
- What was inspected: a type can now `inspects` one thing. The tower is
  named on the home tile before the inspection starts (free text, never a
  list: EXP-4), stored as `Report.inspected`, shown under the title,
  printed on the PDF under the title block, and named in the office sheet
  and register, site diary, weekly summary, My week and search. The author
  can rename it while it is a draft ("Rename", `POST /api/reports/:id`
  `action: rename`); renaming does not change the draft's version, so an open
  editor is not told its copy is out of date. Sent, it is fixed. Decided
  here: naming it at the start rather than as a field saved with the checks,
  so drafts, held copies on the phone and the offline signature need no
  change; a rename needs signal.
- Actions: like the safety inspection, a tower inspection raises no issues (a
  tower that fails is tagged out of use, not snagged). Each "Action needed"
  goes on Safety actions under its tower, and is cleared only by a later
  inspection of the same tower (names matched ignoring case and spacing).
  Safety actions now lists each tower inspected in the last four weeks with
  its last inspection, and marks one "another is due" after seven days, with
  a "Towers due" figure. A tower not inspected for four weeks is taken to be
  down and no longer listed; its open actions stay. The project's "Last
  safety inspection" and "Inspections due" still count weekly safety
  inspections only.
- No signal: the offline page asks for the tower when a tower inspection is
  chosen and takes it to the server when it starts the report. Service worker
  cache `relay-public-v12`.
- Help: What's new "Tower inspection", a "A tower or podium" guide section,
  and the Safety actions and "Action needed" wording.
- Checks: `npm run typecheck`, `npm test` (346, new
  `tests/towerInspection.test.ts`), `npm run build`, new
  `scripts/verify-tower-inspection.mjs` (112 checks: tile refuses an empty
  name, Cancel, rename, answers, PDF words, signed and sent with no issue,
  rename refused once sent and for anyone but the author, Safety actions with
  a tower overdue, diary, office sheet, 390px light and 1440px dark),
  `verify-offline-inspection` (now also starts a tower inspection with no
  signal), `verify-accessibility` (540, now with the tile form and rename
  open). Also passed: typed-signature, report-types, safety-actions,
  first-fix-inspection, offline-sign, help, engineer-layout, role-access,
  handover-offline, editor-usability, unfinished-reports, before-handover,
  home-and-sheet, site-diary, search, my-week, weekly-summary.
- Review: a fresh-context review found no blocking bugs; fixed what it
  raised: the Full report page now names the tower; a tower is due on the
  seventh day, not the eighth; a phone still on the old offline page (which
  offers the tower inspection but not its name) can start one unnamed, and
  it cannot be sent until named with Rename, rather than failing to go up
  for ever; Before handover names each tower action's tower and counts
  tower inspections; held-work messages name the tower; an action names its
  tower as the tower list does. Left as decided: a rename does not reach an
  editor already open on another device until it reloads; the PM email
  subject (mail is not live) and Since your last visit do not name the tower.
- Seen, not changed: on a phone, tapping "Next check" straight after typing in
  "Who is to do it" can land on "Check & send" instead, because leaving the
  field brings the bottom bar back and moves the page. The new browser check
  leaves the field first. Worth a look in the next editor pass.
- Not verified: a physical phone; Cal or a site manager reading the checks;
  whether "every seven days" matches every client's site rules.
- Proposed (not added to `docs/tasks.json`): starting another tower
  inspection while one is a draft (one per type at a time today); a "towers
  due" line on the engineer home; adding `verify-tower-inspection.mjs` to
  the browser checks in `CLAUDE.md`.

## 2026-10-20 — Notes for the next visit

- Why: when an engineer covers a site, or the next trade arrives, the word
  that matters on the day (where the riser key is, which floor is locked off,
  what goes up on Tuesday) is passed by phone or not at all. Reports are the
  formal record for the client and project manager, so it does not belong in
  them, and Site information (PR #28, unmerged) is the office's standing
  facts about a site, not word passed between visits. Chosen by Claude under
  Cal's standing freedom to add features; it stays out of the report editor
  another thread is in.
- What: new page `/site-notes?project=…`, "Notes for the next visit". Anyone
  on a live project (every engineer trade, Managers, Admins) can leave a note
  of up to 500 characters; each shows who left it, their trade (or Office),
  when and how long ago. "Done with" folds a note away under "Marked done with
  in the last 2 weeks", saying who and when, and "Put back" returns it. The
  engineer home shows a "Notes for the next visit" row first under Reports and
  records with the start of the latest note, who left it and how many are
  open; the office project sheet has it in the same group (both from #54).
- Decisions: a note is RELAY's own record (`site-notes` in the local store);
  it is not part of any report, PDF, issue or variation, writes nothing to
  SharePoint and sends nothing, so events stay distinct. It asks nobody to
  decide anything and routes nothing (not EXP-2, "Do not introduce a
  mandatory request, routing or approval step"), and it is free text with no
  locations (not EXP-4). Notes are never removed (removing data needs Cal's
  go-ahead); "Done with" is reversible and attributed. Anyone on the project
  can mark any note done with, since the note is for the site, not its
  writer. At most 20 open notes per project so the list stays readable.
  Saves carry the form's own id, so a retry after a lost reply is not kept
  twice. Complete or tender projects take no new notes (the API refuses with
  409; the page only offers live projects, as every other page does).
- Rules in `lib/siteNotes.ts`, store `lib/siteNoteStore.ts`, API
  `GET/POST /api/site-notes` and `POST /api/site-notes/[id]` (`{ done }`).
  Help: What's new `site-notes`, Where to find things, a "Passing word on"
  section for site, and a step in "Your day in the office".
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`
  (3 new tests), `npm run build`, new `scripts/verify-site-notes.mjs`
  (45 checks: signed-out and malformed saves refused, missing and complete
  projects refused, engineer home row, leaving a note, kept after reload,
  retries, done with and put back by the office, office reaches it from the
  project sheet, another project starts empty, no connection keeps the words,
  axe at 390px light and 1440px dark, 44px buttons, no sideways scroll; run
  6 times in a row green). Also passed: `verify-home-and-sheet` (updated for
  the new row and link), `verify-accessibility` (now includes the page),
  `verify-help`, `verify-role-access`, `verify-engineer-layout`.
  Screenshots: `ui-review/site-notes/` in the project files.
- Not verified: a physical phone, Safari and Firefox, a real screen reader,
  SharePoint mode. With no signal the page cannot be opened afresh (notes
  are not kept on the phone yet); the home row then says nothing is waiting.
- Proposed (not added to `docs/tasks.json`): NEW-9 notes for the next visit,
  with the acceptance steps in the PR; add `verify-site-notes.mjs` to the
  browser checks in `CLAUDE.md`. Later: keep the open notes on the phone for
  the no-signal page, as Site information (#28) does.

## 2026-10-20 — Signing an inspection without drawing

- Why: an inspection could only be signed by drawing, so someone using only a
  keyboard or a screen reader could not sign one at all (found in PR #53's
  accessibility pass). Asked for by the coordinator under Cal's standing asks
  for a clear UI and for Claude to decide.
- Decision (Claude's): where a signature is required (every inspection type:
  safety, handover, first fix), the signer can choose "Type my name instead",
  type their full name and tick a fixed statement: "I carried out this
  inspection and this record is accurate. Typing my name and ticking this box
  is my signature." Drawing stays the default and works as before. Anyone may
  choose either way; RELAY cannot tell who can draw, and a typed signature is
  kept as traceable as a drawn one:
  - only the author's own signed-in session can send it (as before);
  - the server, not the client, records the statement word for word
    (`TYPED_STATEMENT`, lib/signature.ts), the time (`signedAt`) and who was
    signed in (`signedInAs`), and marks it `typed`;
  - the name box starts with the signed-in person's name, as it always has,
    and they can change it; what is sent is the name in the box when they
    tick, never filled in by the server, and a tick with no name is refused, and typed plus a drawing, or a typed signature on a
    site update, is refused (site updates print the name either way);
  - the office report says "Signature drawn by" or "Signed by typing the name
    … · signed in as …" and shows the statement; the PDF prints the typed name
    where a drawing would go, "Typed signature · date, time · signed in as …"
    and the statement, so it is never mistaken for a drawing.
  Considered and not chosen: a keyboard-driven drawing (still a picture of
  nothing a screen reader can check), or a PIN or second sign-in (RELAY's
  sign-in is Microsoft's; adding another secret is more to forget on site
  for no extra proof, since the session already identifies the person).
- Choosing one way clears the other, so a draft never carries a drawing behind
  a typed name. A ticked typed signature saves with the draft and survives a reload;
  choosing "Type my name instead" without ticking yet is not saved, so a
  reload shows the drawing box again.
  `ReportTypeDef.drawnSignature` is renamed `signatureRequired`.
- No signal: the offline page offers the same choice. A typed signature is
  held like a drawn one (`signed.typed`, no `dataUrl`), locked, and sent by
  itself when signal returns only if nothing changed since. The statement is
  duplicated in public/offline.js; a test checks it matches. Service worker
  cache moves to `relay-public-v11`. Also fixed: the offline page's "Open
  RELAY to send it now" link was 24px tall on a phone (now 48px).
- Help: What's new "Sign an inspection without drawing"; a new site guide
  section "Signing an inspection"; the no-signal step and the office day say
  how typed signatures show. Draft conflicts name a typed signature too.
- Checks: `npm run typecheck`, `npm test` (336, new
  `tests/typedSignature.test.ts`), `npm run build`, the new
  `scripts/verify-typed-signature.mjs` (42 checks: keyboard-only typed
  signing in the editor at 390px light and 1440px dark, a name deleted key
  by key stays empty (also across a reload), reload, switching back to drawing, sent; the office at 1440px light and 390px dark; the PDF
  text; a first fix inspection typed-signed with no signal and sent by itself),
  `verify-accessibility` in full after merging main (518 checks, now also
  choosing, typing and ticking with the keyboard alone on both, and the
  signed state on the no-signal page), `verify-offline-sign`,
  `verify-signature-reload`, `verify-help`, `verify-handover-offline`,
  `verify-offline-inspection`, `verify-first-fix-inspection`,
  `verify-draft-conflict`, `verify-engineer-layout`, `verify-role-access`,
  `verify-editor-usability` and `verify-report-types`.
- Not verified: a real screen reader (VoiceOver, TalkBack, NVDA) or a physical
  phone; whether Leodis's clients or auditors accept a typed signature on an
  inspection (Cal may want to confirm). A fresh-context review found the
  author's name refilling an emptied name box (live and after a reload) and
  two overstated lines here;
  all fixed.
- Proposed (not added to `docs/tasks.json`): a typed signature option for the
  compliance engineer screens; a skip link; main/h1 on compliance pages.

## 2026-10-20 — Chase notes on Issues by company

- Why: Issues by company (#33) tells the office who to chase, but there was
  nowhere to write down that they had: who rang, what was said, and the day
  the company promised to finish. That lives in heads and notebooks today, so
  the next person to ring repeats the call and a broken promise goes
  unnoticed. Chosen by Claude under Cal's standing freedom to add features;
  it sits on an office page, away from the report editor another thread is in.
- What: each company card on `/companies` now has a "Chased" section: the
  latest chase (when, who, what was said, and the promised day if given),
  earlier chases folded under "Earlier chases (n)", and "Log a chase" (a note
  of up to 500 characters and an optional "Promised by" date, today to a year
  ahead). The promise on the latest chase is shown as Promised, "Promise met"
  once nothing is left to put right, or "Promise missed" once the day has gone
  with work still to do; a missed promise is also tagged at the top of the
  card. A later chase with no date sets the old promise aside.
- Decisions: a chase is RELAY's own note (`company-chases` records in the
  local store, like an acknowledgement); it changes no issue, writes nothing
  to SharePoint, sends nothing and asks nobody to approve anything, so events
  stay distinct and it is not EXP-2. Companies are matched ignoring case and
  spacing as the page already does; nothing is checked against a company
  list (EXP-4). Only Managers and Admins can log one, and only against a company
  the page shows them. Chases belong to the company, not a project: fine
  while everyone can open every project, noted in the code for when access
  is narrowed. Each save carries the form's own id, so a retry
  after a lost reply is not logged twice. Chases cannot be edited or removed:
  they are a log, and removing data needs Cal's go-ahead; a correction is a
  new chase.
- Rules in `lib/companyChases.ts`, store in `lib/chaseStore.ts`, API
  `POST /api/company-chases`; `GET /api/company-issues` now carries each
  shown company's ten most recent chases and a count. Help: What's new entry
  `company-chases`, a step in "Your day in the office", and the Issues by
  company link text.
- Also fixed: `verify-accessibility` failed on main before this change, at
  the engineer home's "Since your last visit" link (axe `link-in-text-block`:
  gold text only). It is underlined now.
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`
  (4 new tests), `npm run build`, new `scripts/verify-company-chases.mjs`
  (office-only saves, refused names and past dates, a seeded missed promise,
  logging a chase with a promise, kept after reload, a later chase setting the
  promise aside, earlier chases, retries, issues untouched, no connection
  keeps the note, axe with the form open, 390px light and 1440px dark).
  Also passed: `verify-company-issues`, `verify-help`, `verify-role-access`,
  `verify-accessibility`.
- Review: a fresh-context review found no blocking bugs; fixed what it
  raised: focus now returns to "Log a chase" after Save or Cancel and a
  screen reader hears "Chase saved"; the API refused only names with no
  issue at all, so a company with only withdrawn or long-closed issues
  could be given a note nobody would see (now it must be on the page);
  chase times show the year when it is not this year; a lost reply followed
  by edited words no longer leaves the form stuck on a refusal.
- Not verified: a physical phone, Safari and Firefox (the date box looks
  different in each), a real screen reader, SharePoint mode.
- Proposed (not added to `docs/tasks.json`): NEW-8 chase notes, with the
  acceptance steps in the PR; add `verify-company-chases.mjs` to the browser
  checks in `CLAUDE.md`.

## 2026-10-20 — First fix inspection (EXP-5, third report type)

- Added a third checklist type, "First fix inspection" (First Fix Inspection,
  references `-FFI-`): a walk round one area before its ceilings, walls,
  risers or boxing are closed, asking 12 checks on Leodis's first fix (run to
  every point, supported, pressure, drainage and electrical tests recorded,
  set out for the finishes, access panels, fire stopping, safe zones,
  labelled, void clear). Drawn signature required. Each "Action needed" must
  say where and raises an issue on the snag list, as on the handover
  inspection. The checks are Claude's first draft (Cal named no type, and
  under his 2026-10-20 instruction Claude decided), so the Help entry says
  they may change.
- Why this type: opening a ceiling again after it is boarded costs far more
  than a walk round, and a signed record shows the area was ready when it was
  closed. It fits the existing framework exactly (`lib/reportTypes.ts`), so
  the editor, drafts, photographs, sending, corrections, PDF, site diary,
  weekly summary, office sheet and no-signal page all work without new code.
  Considered and not chosen: a tower and podium inspection (the Work at Height
  Regulations record needs the tower named on the report, and inspections have
  no report-level field yet) and a commissioning record (needs readings, a new
  kind of answer).
- Home screen tiles now take a short label from the type (`tag`: "Safety",
  "Handover", "First fix") rather than the first word of its name, which
  would have read "First".
- No-signal page: knows the new type's name and that its actions say where
  even before the app has left the checklists on the phone. Service worker
  cache moves to `relay-public-v10`.
- Help "What's new": "First fix inspection". Help wording on actions that
  become issues and on starting and signing with no signal now covers every
  inspection.
- Checks: `npm run typecheck`, `npm test` (new `tests/firstFixInspection.test.ts`),
  `npm run build`, the new `scripts/verify-first-fix-inspection.mjs` (110
  checks, 390px light and 1440px dark), `verify-offline-inspection` (now also
  starts a first fix inspection with no signal), `verify-handover-inspection`,
  `verify-report-types`, `verify-offline-sign`, `verify-handover-offline`,
  `verify-help`, `verify-engineer-layout`, `verify-role-access`,
  `verify-editor-usability`, `verify-accessibility`, `verify-before-handover`
  and `verify-unfinished-reports`. A fresh-context review found the Before
  handover gap and the handover wording in the action prompt; both fixed.
- Not verified: a physical phone; Cal or a site manager reading the checks.
  Before handover now counts a first fix inspection's actions as snags on our
  work, under the inspector's trade, as it already did for handover
  inspections (otherwise they fell under "Other trades"); it still lists only
  handover inspections in its inspections section. Safety actions follows
  safety inspections only. Each inspection type now has its own prompt in an
  action's "What needs doing" (first fix: "before it is closed in").
- Proposed (not added to `docs/tasks.json`): a report-level "What was
  inspected" field, which would allow a tower and podium inspection; the
  office editing a checklist's wording; listing first fix inspections on
  Before handover.

## 2026-10-20 — Engineer home screen and office project sheet tidied

- Why: each feature added today put its own link on the engineer home screen
  and the office project sheet, so both had a long, unordered run of links
  (eight rows under "This project" plus single-row "Your week" and "Help"
  sections; seven buttons crowded beside the project's name). Asked for by the
  coordinator under Cal's standing ask for a clear, inviting UI. Screenshots
  before and after, 375px and 1440px, light and dark, are in the project's
  `ui-review/home-and-project-sheet/`.
- Engineer home: "This project" is now two labelled groups, daily ones first.
  Issues and safety: Site issues, Safety actions, Issues over time, Before
  handover. Reports and records: Reports, Site diary, Weekly summary,
  Photographs. My week and Help are one section, "Your week and help", at the
  foot. Each row's note is shorter so none runs past two lines at 375px. The
  Reports view's "Also on this project" row follows the same order.
- Office project sheet: the title keeps one button, "Project page". The six
  project pages sit in one box under the project's figures and above "Needs
  attention", in the same two groups and words as the engineer's home.
- Found and fixed: on a phone the office desk shows a project's register in
  place of its sheet, so none of the project's pages (Before handover, Site
  diary and the rest) could be reached from the office on a phone. The same
  grouped links now show at the top of the register on a phone only (hidden on
  a desktop, where the sheet has them, so there is one set on screen), with
  "Project page" at the end of the records group.
- Decided here: group names "Issues and safety" and "Reports and records";
  "daily first" judged as Site issues and Reports first, then weekly pages,
  then handover. Nothing was removed; every page is still one tap away.
- Help: "What's new" entry "A tidier home screen and project sheet", and a
  line in the office guide saying where a project's pages are.
- Checks: `npm run typecheck`, `npm test`, `npm run build`, the new
  `scripts/verify-home-and-sheet.mjs` (118 checks at 375 and 1440px, light and
  dark; `RELAY_SHOTS_ONLY=1` takes screenshots of older code without the
  checks) and the existing browser checks: navigation, accessibility,
  issue-trend, before-handover, office-desk, office-phone, office-landing,
  engineer-layout, engineer-nav, help, since-last-visit, my-week,
  weekly-summary, safety-actions, site-diary, photo-library, role-access,
  unfinished-reports.
  `verify-navigation.mjs` now finds the home links by the "This project"
  region and expects the new Reports-view order.
- Not changed: the report editor and offline page (another thread is there),
  the left-hand column of the home screen (start tiles and Unfinished
  reports), the office landing's buttons.
- Not verified: real phones, Safari and Firefox, a real screen reader.
- Proposed (not added to `docs/tasks.json`): "UI-5 Home screen and project
  sheet grouping".

## 2026-10-20 — Accessibility follow-ups: the report editor and the no-signal page

- Why: #48 fixed the engineer and office pages but left the report editor
  and the no-signal page (`offline.html`) unscanned while other threads were
  changing them. Engineers spend most of their RELAY time in these two
  screens, often outdoors on a phone. Decided by Claude under Cal's standing
  autonomy.
- How it was found: `scripts/verify-accessibility.mjs` now also walks the
  editor and the no-signal page as an engineer uses them, at 390px and
  1440px in light and dark, after the page scans (so the reports it makes do
  not change those pages): a new site update, an open card with a photo,
  Check & send, sent; a safety inspection just started, a check answered
  "Action needed", its check step; the no-signal page's start form, a card
  with a photo, an inspection, and its "Sign it" panel. Each state gets the
  same checks as the pages (axe-core, one h1, 44px controls on a phone, a
  ring at every Tab stop). Before the fixes it found 9 kinds of problem.
- Contrast: the light theme's gold "Send to office" button turned light gold
  under a mouse, with white text at 1.8:1 (new `--brass-hover` token, darker
  in light, unchanged in dark). Light `--brass` #7d621b to #765a1d, the
  office desk's value since #48, so gold text stays 4.5:1 on hovered and
  pressed backgrounds ("Next check", a chosen suggestion). Access tags and
  card edges use a new `--access-tone`: #56708f in light (was #7f97b5,
  3:1), unchanged in dark. The no-signal page takes the app's grey and gold
  tokens.
- Headings and names: the sent report's sections and cards and the check
  step's "In this report" and "Sign" are headings now (same look); on a
  phone a hidden "Cards"/"Checks" heading sits above the list so a check's
  question is not a skipped level. Kind, Trade affected, Reason, "Has the
  work already been done?", Rough size and "What kind of update is this?"
  name their button groups; the photo button is described by its
  "Photographs · at least one" line. The signature box is named
  "Signature" and says in words whether it is signed; Clear is "Clear
  signature" (also on the no-signal page, whose cards are now named by
  their heading).
- Tap targets on a phone: suggestion chips and "Show more" 44px (were 40
  and 36), photo captions 44px, the no-signal page's "Remove" under a photo
  48px.
- Focus: "Next check", a Stop on the check step, and a row on a wide screen now
  move focus to the card they open, and "Check & send" moves it to the top
  of the check step, rather than leaving it on a button that has just gone.
  On the no-signal page, opening or starting a report moves focus to its
  title. Its date field's year now shows the ring (it used `:focus-visible`,
  which Chromium does not match there).
- Colour alone: the red count on the "Check & send" step now has a ring and
  says "things stop it being sent" to a screen reader; "View the document"
  in a sent report is underlined. Everything else checked (answer tags,
  where-it-is lines, the action bar) already had words.
- Help: "What's new" entry `editor-easier-to-read`. Service worker cache
  `relay-public-v9`.
- Verified (Node 22 here; CI runs Node 24): `npm run typecheck`, `npm test`,
  `npm run build`, `verify-accessibility` (458 checks, passed; new focus checks: Check & send
  and a Stop land on what they open). Also passed: `verify-editor-usability`
  (its step-count check now reads the number, not the new screen-reader
  words), `verify-report-editor`, `verify-report-types`,
  `verify-signature-reload`, `verify-engineer-layout`, `verify-undo-remove`,
  `verify-suggestions`, `verify-help`, `verify-offline-sign`,
  `verify-offline-capture`, `verify-offline-inspection`,
  `verify-offline-drafts`, `verify-handover-offline`. A fresh-context review
  found a focus target that could linger when the card was already open and
  pull focus on a later render; fixed (it waits for that card, or focuses at
  once). Screenshots in the project's `ui-review/editor-accessibility/`.
- Not verified: a real screen reader (VoiceOver, TalkBack, NVDA), a
  physical phone, Safari and Firefox, 200% zoom. A drawn signature still
  needs a pointer, so someone using only a keyboard cannot sign an
  inspection, which requires the drawing; a typed-name alternative would
  change what an inspection's signature means, so it is proposed, not built.
- Proposed (not added to `docs/tasks.json`): follow-ups: a skip link to the
  main content; landmarks and an h1 on the compliance pages; a keyboard way
  to sign; add `verify-accessibility.mjs` to the browser checks in
  `CLAUDE.md`.

## 2026-10-20 — Office desk usability pass on a laptop and desktop

- Walked the office team's day at 1366px and 1920px, light and dark, as an
  Admin: office landing, project sheet, Inbox and its reader, Issues,
  Variations, Safety actions, Search, spreadsheet downloads and Before
  handover. Screenshots before and after are in the project's
  `ui-review/office-desk/`.
- Fixed, because they were wrong rather than a matter of taste:
  - Clicking a row in the Variations register opened the office overview, not
    the variation: the register and the variation sheet's crumbs linked by
    project number while the desk routes by project id. Both now use the id.
  - At 1366px the Variations register scrolled sideways and cut off Decline,
    because the "Raised in the office · name" line under the date could not
    wrap. That line now wraps in plain type, so the row fits.
  - In the Inbox reader the report stages ran into each other ("Waiting for
    the PDF" over "Not yet read") at both widths: the desk's tag style
    stopped them wrapping. Each stage's tag now wraps inside its own step.
- Made consistent across Inbox, Issues and Variations (decided here, since
  Issues already worked this way): a "Clear filters" button when a project,
  trade or reason is chosen; the chosen chip marked pressed for screen
  readers; Variations opens on `#/variations/show/<filter>` and the tab
  itself starts again from "Awaiting instruction"; and an empty list says
  what it means ("Every report has been read", "Nothing is waiting to be
  verified", "No variations have been declined") instead of "Nothing here",
  "No to verify issues" or "No variations all". The Inbox reader no longer
  offers "Open the newest" for an empty list. The Issues register no longer
  shows a lone dash under a date when the source report is unknown.
- A project's sheet names the project in the browser tab ("Tetley Hall -
  Block E · Office"), so several tabs can be told apart. Search opened on
  its own goes "Back to Office" for Managers and Admins (it said "Back to
  Site"). On a desktop the app bar shows the whole name and role instead of
  "Office Admin · A…".
- Help "What's new": "A tidier office desk".
- Not changed: the report editor and offline pages (another thread is
  there), wording of the long notes under each register, column order (each
  register already leads with reference, title, project and date), and the
  standalone pages' layout (Safety actions, Search, Before handover read
  well at both widths).
- Checks: `npm run typecheck`, `npm test`, `npm run build`, the new
  `scripts/verify-office-desk.mjs` (73 checks at 1366 and 1920px, light and
  dark) and the existing office, navigation, search, help, accessibility and
  engineer browser checks (listed in the PR). `verify-issue-register.mjs`
  now expects the new empty-list wording ("for these filters").
- Not verified: Safari, Firefox and Edge; real office screens and zoom
  levels other than 100%; a real screen reader.
- Proposed (not added to `docs/tasks.json`): "UI-4 Office desk usability
  pass at 1366 and 1920px". Follow-ups, too big for this PR: shorten the
  long explanatory notes under each register into a Help link; let the
  Variations register page on the server like Issues once it grows; a
  "Download spreadsheet" on the Inbox; save each register's filters per
  person so they survive a reload.

## 2026-10-20 — Issues over time (new feature, proposed as FE-8)

- Why this feature: every progress meeting asks "is the issue list getting
  shorter?", and RELAY only answered for today (the register, snag lists,
  Before handover). Seeing the trend tells the site team their closing work
  is paying off and tells the office early when a project is slipping.
  Chosen by Claude under Cal's standing autonomy and freedom to add
  features; it is outside the report editor and the offline page, where
  another thread works, and does not touch the office registers.
- What it is: `/issue-trend?project=…`, every role on the project (it counts
  issues every trade can already read). A headline ("Getting shorter: 3
  issues open, down from 6 four weeks ago"), four figures (open now and past
  target, raised and closed in the last four weeks, typical days to close,
  oldest open issue with a link), a 12-week bar chart of what was open at
  the end of each week with the past-target part in the alert colour (tap
  or hover a week to read it out; legend, readout and a table so colour is
  never the only cue), then the same figures week by week as a table.
  Linked from "This project" on the engineer home and the office project
  sheet; Back returns to wherever it was opened from.
- Rules (`lib/issueTrend.ts`, pure): weeks run Monday to Sunday in the office
  calendar; the current week counts up to today. History is rebuilt from what
  each issue holds now: raised day, and for a closed issue the day of its
  last office check. So an issue closed, reopened and still open counts as
  open throughout; put forward as fixed is still open; withdrawn issues are
  left out; a closed issue with no recorded check day counts as raised but
  never as open or closed (the page says how many). "Past target" is judged
  on each week's last day against the issue's target date as it is now, so a
  target moved later shows fewer late in earlier weeks; like the register,
  put forward as fixed still counts as late (Before handover does not). The
  page says all of this in its footer. Hovering a week changes the readout
  only; tapping, clicking or focusing picks it (`aria-pressed`).
  It stores and changes nothing and makes no SharePoint write.
- Not near rejected scope: no locations are grouped or matched (EXP-4), no
  photographs (FE-2), no routing or requests (EXP-2).
- Help: "What's new" entry `issue-trend` and a guide link.
- A fresh-context review found no counting or access bugs; it asked for the
  footer to say how target dates and undated closures count, for hover not
  to change `aria-pressed`, and for the readout not to repeat each bar's
  label to screen readers. All fixed.
- Verified (Node 22 in this session; CI runs Node 24): `npm run typecheck`,
  `npm test` (four new cases in `tests/issueTrend.test.ts`), `npm run build`,
  new `scripts/verify-issue-trend.mjs` (28 checks: 390px light engineer from
  home, 1440px dark manager from the office sheet, headline, figures, chart
  readout by tap and hover, table, no sideways scroll, tap targets, Back
  links, a project with no issues), `verify-accessibility` with
  `/issue-trend` added (340 checks), and `verify-help`,
  `verify-engineer-layout`, `verify-role-access`, `verify-before-handover`,
  `verify-navigation`. Chart colours checked with a palette validator:
  open and past-target bars are far enough apart in both themes for normal
  and colour-blind vision. Screenshots in the project's `ui-review/issue-trend/`.
- Not verified: a physical phone, Safari and Firefox, SharePoint mode, real
  project history (the figures are only as good as the check dates held).
- Not in `docs/tasks.json` (no task covers it). Proposed: "FE-8 Issues over
  time: a project's issues raised, closed and open week by week, read-only".
  Follow-ups: the same across every project on the office desk; a trend by
  company on Issues by company.

## 2026-10-20 — FE-3e: offline capture, third slice (sign an inspection with no signal)

- Why: #46 let an inspection be started and answered with no signal but it
  still had to be signed in RELAY later, so a weekly safety inspection done in
  a basement sat unsent until the engineer remembered to open it. Suggested by
  #46's thread; decided by Claude under Cal's standing autonomy.
- Now, on the offline page, an inspection (started there, or a draft held on
  the phone) has a "Sign it" panel at its foot. Until every check is answered
  it lists what is left, using the same blocking rules as the check step
  (`lib/review.ts`): checks not answered, and for an action what is wrong,
  what needs doing and, on a handover inspection, where. Then the engineer's
  name and a drawn signature. Signing locks the inspection on the phone and
  marks it "Signed · not sent yet" in the list, on the report and on the home
  screen's unfinished list. "Take back signature to change it" unlocks it,
  until RELAY has started sending it.
- Decision: it goes to the office by itself, with no second tap, the next time
  RELAY opens with signal (the existing held-work send, `lib/heldSend.ts`).
  Signing is already the engineer's deliberate act of sending, and the page
  says so on the button ("Sign it. Send when there is signal"); a second tap
  would leave a signed weekly inspection sitting on a phone because nobody
  reopened it. RELAY then says "The inspection you signed on this phone has
  gone to the office", or why not.
- A signature never goes with content that changed after signing: the phone
  records what was signed (`signedContent`, the same function in
  `offline.js` and `lib/offlineStart.ts`, pinned by a test). Before sending,
  the app checks the copy is still exactly that, after it is fitted onto the
  server's checks, so a checklist reworded in a deploy meanwhile also breaks
  it. If it changed, it goes up as an unsigned draft and the engineer is told
  to check it and sign again. Any offline-held inspection saved unsigned
  clears the draft's signature on the server (`signature: null`), so no
  signature, from the phone or from RELAY before the change, is left over
  changed content. The phone signature is kept apart from the report's draft
  signature, so an editor that takes the copy over shows it unsigned.
- Sending: save with the signature, then send at exactly that saved version
  (the server sends what it holds at that version). The copy stays on the
  phone, marked saved, until the send is answered, so a connection lost in
  between finishes next time without saving again. A refusal (4xx) leaves it
  a draft on the server with its signature cleared and names it once; a
  server fault (5xx) keeps it signed and tries again. Sent revisions are not
  touched. Nothing new is sent to SharePoint or by email: the send is the
  existing submit.
- Verified on Node 22 (the session's Node): `npm run typecheck`, `npm test`
  (302 web tests; 16 new in `tests/offlineSign.test.ts`, including the whole
  send against the real store with an in-memory IndexedDB: sent as signed,
  changed after signing, lost answer, no signal between save and send, server
  fault, refusal, conflict handed to the editor, unsigned change clears an old
  signature), `npm run build`. New `scripts/verify-offline-sign.mjs` passed
  (62 checks, server stopped for no signal): 390px light handover inspection
  signed, taken back, changed and signed again, its action on the snag list
  once sent; 1440px dark safety inspection signed and sent with the drawn
  signature, exactly as signed; 390px dark one changed behind the page after
  signing, which went up unsigned and said so. Also passed:
  `verify-offline-inspection`, `verify-offline-capture`,
  `verify-offline-drafts`, `verify-handover-offline`,
  `verify-unfinished-reports`, `verify-help`, `verify-engineer-layout`,
  `verify-signature-reload`, `verify-report-types`, `verify-role-access`,
  `verify-editor-usability`. A fresh-context review found edge cases where a
  phone signature could stay on a draft whose content later changed; fixed as
  above. Service worker cache `relay-public-v8`.
- Not verified: physical iOS and Android phones (so `passes` stays false),
  Safari's service worker, Chromium's own offline mode, SharePoint mode.
  Known narrow cases left: if the same inspection is sent from elsewhere
  after the phone saved it, the phone copy is dropped and the engineer is told
  to check what went; two tabs sending at once can show the draft wording for
  one that was in fact sent.
- Next (proposed, not built): group "On this phone" by project; sign a site
  update on the offline page; add `verify-offline-sign.mjs` and the other
  offline checks to the browser checks in `CLAUDE.md`.

## 2026-10-20 — Before handover (new feature, proposed as FE-7)

- Why this feature: as a job nears completion the project manager and the
  engineers ask one question, "what is stopping us handing this over?". In
  RELAY the answer was spread over the snag list, the issue register, the
  variation register, Safety actions and each handover inspection. Chosen by
  Claude under Cal's standing autonomy and freedom to add features; it is
  outside the report editor and report types, where another thread works.
- What it is: `/handover?project=…`, one page per project, every role (it
  shows only what every trade on the project can already read; no prices).
  A headline ("7 things still open in RELAY, 1 past target"), five counts
  that jump to their lists, then: snags on our work by trade (Electrical,
  HVAC, P&H, each with a link to that trade's snag list), fixes waiting to
  be checked (who put them forward), sent handover inspections with how many
  of their actions are still open, other trades' issues (and those with no
  trade recorded), variations not yet instructed or declined (work already
  done first), and open safety actions. Print or save as PDF. Linked from the
  engineer home ("This project") and the office project sheet.
- Rules: built in `lib/beforeHandover.ts`, pure over reports, issues and
  variations, reusing `issueTrade` (snag list), `isActiveIssue` and
  `safetyActions`. A corrected inspection counts once; an issue raised by an
  earlier revision belongs to the latest one. Locations are ordered as
  written, never matched to a catalogue (EXP-4). Drafts are left out. It
  stores and changes nothing, sends nothing and makes no SharePoint write.
- Not a handover pack: EXP-5 calls packs "a possible later extension". This
  page lists what RELAY holds and says plainly that drawings, certificates,
  O&M manuals and the client's own list are not covered.
- Help: "What's new" entry `before-handover` and a guide link.
- Verified (Node 22 in this session; CI runs Node 24): `npm run typecheck`,
  `npm test` (four new cases in `tests/beforeHandover.test.ts`), `npm run
  build`, new `scripts/verify-before-handover.mjs` (28 checks: 390px light
  engineer, 1440px dark manager, print, 44px targets, back links). Re-ran
  the help, engineer layout and nav, navigation, role access, safety
  actions, office landing, office phone and weekly summary checks.
  After merging main (#48), added `/handover` to
  `verify-accessibility` (axe, 329 checks, passed) and re-ran the new check,
  help, navigation and safety actions.
  Screenshots in the project's `ui-review/before-handover/`.
- A fresh-context review found four gaps, all fixed: an issue with no
  affected trade was counted as our snag because the snag list falls back to
  the reporter's trade (now only a handover inspection's own action does);
  a trade's printed snag list also carries its fixes waiting to be checked
  (now said under the list); an inspection that re-found an existing issue
  claimed to have raised it (now only counted); and the page had no heading
  while loading or on an error.
- Not verified: a physical phone, Safari and Firefox, SharePoint mode.
- Not in `docs/tasks.json` (no task covers it). Proposed: "FE-7 Before
  handover: everything open on one project on one page, read-only, printable".
  Follow-ups: an area filter (by location as written) for phased handovers;
  showing it on the office desk for projects in their last month.
## 2026-10-20 — Accessibility pass over the engineer and office pages

- Audited every engineer and office page built so far (28 pages, as engineer,
  manager, admin and signed out) at 390px and 1440px in light and dark with
  axe-core (WCAG 2.2 A/AA plus best practice), a keyboard walk, and a probe
  for tap-target size, headings, labels and names. Before: about 1,240
  contrast failures (270 distinct elements), 416 elements outside any
  landmark, an office desk with no `main` and no `h1`, chips and small
  buttons 28 to 40px tall on a phone. Already good: every control had a name
  or label, every focus stop showed a ring, and nothing relied on hover.
- Priorities, decided here: (1) text people could not read, because grey
  secondary text is on almost every screen and site engineers read it
  outdoors; (2) the office desk's structure for screen readers; (3) tap
  targets on a phone; (4) the one cue given only by colour.
- Compliance pages: their `.cm` palette is a copy of the office one, so
  they take the same token fixes (decided here, to keep the two palettes
  from drifting apart; the pages are otherwise untouched).
- Contrast: only colour tokens changed, so both themes stay in step. Main
  pages: `--text-3` #6b6c65 to #5f605a (light), #666e75 to #8a9299 (dark).
  Office desk (`.ws`) and the compliance pages (`.cm`), same palette:
  `--text-2`/`--text-3` #5b5f60/#767a7b to #4f5354/#5e6263 (light) and
  #b5b7b6/#868a8b to #c2c4c3/#a5a9aa (dark); gold #816321 to #765a1d (light,
  white text on gold buttons improves to 6.5:1); dark alert #e2705a to
  #ec8a76 (#f09783 on compliance); compliance light aqua #267c76 to #1f6d68.
  Every pair now passes 4.5:1 on its own backgrounds. The dated concept
  files in `docs/` keep the old values.
- Office desk: views sit in a `main` (a flex column, so on a desktop the
  views still fill the desk and scroll inside it; the check now asserts the
  desk fits the window) with a hidden `h1`, "Leodis Developments office";
  headings now run h2 page or column, h3 sheet or panel, h4 group, instead
  of starting at h3/h4/h5. CSS matches either level, so headings look the
  same. The tab bar is named "Office" and marks the current tab
  (`aria-current`). The prototype banner is a named region and the app bar
  nav is named "Main". Empty table header cells say "Action" to screen
  readers.
- Phone tap targets (44px or more under 700px): office chips, buttons,
  search, filters, top bar (logo, Attention, name, Help), "All →"; Back
  links, the app bar brand, segment buttons, Help's "On this page" links,
  the sign-in brand, and the engineer home's "Change ›" (bigger hit area,
  same line, now underlined so it is not told apart by colour alone).
- Colour only: a red count on an office tab ("something is overdue or
  failed") now also has a ring and says ", some need attention" to screen
  readers.
- Kept: wording, features and how data is saved; #40's Back links and page
  titles. Help's "What's new" has one line, "Easier to read and to tap".
- New `scripts/verify-accessibility.mjs` (axe-core 4.10.3 added as a dev
  dependency): 318 checks; zero axe violations on each page in light and dark
  at 390px and 1440px, one h1 per page, controls at least 44px tall on a
  phone (listed exceptions: references inside rows, the coverage grid, hidden
  file inputs, checkboxes inside a label), a ring at every Tab stop.
  Screenshots in the project's `ui-review/accessibility/`.
- Not changed, because another thread is working there: the report editor
  (`/reports/[id]`: "View the document" link in a paragraph is told apart by
  colour only) and the offline page (not scanned). The compliance pages
  (prototype, other company) got the token fixes but still have no `main` or
  `h1`.
- Not verified: a real screen reader (VoiceOver, TalkBack, NVDA), a physical
  phone, Safari and Firefox, Windows high contrast, 200% zoom.
- Proposed (not added to `docs/tasks.json`): "NEW-12 Accessibility pass —
  WCAG 2.2 AA on engineer and office pages; verify-accessibility at 390 and
  1440px". Follow-ups: the two editor items above; a skip link to the main
  content; landmarks and h1 on the compliance pages; add
  `verify-accessibility.mjs` to the browser checks in `CLAUDE.md`; a screen
  reader walk-through by a person.

## 2026-10-20 — Report editor usability pass (proposed as UI-3)

- Why: nine PRs today each added a piece to the report editor (two-step
  editor, conflicts, "Another card here", undo, suggestions, unsaved changes
  as a correction, two inspection types, offline capture). Walking the
  everyday flows at 390px as an engineer (a site update with cards and
  photos, both inspections, a correction, the same with no signal) showed
  friction the pieces made together. Fixed by layout and wording only; no
  feature removed, nothing about saving, syncing or revisions changed.
- What changed, and why each:
  - An open card on a phone no longer says the same thing three times. Its
    row is now its heading (number, kind, place) and whether it is on the
    server yet, plus what stops it if anything does (so a card opened from a
    Stop still says why); the description and photo count, which the open
    card shows just below, come back when it folds. The
    card dropped its kind tag (the Kind buttons show it with a tick), and
    Remove moved to the foot of the card instead of a
    line of its own (labelled "Remove card 1", its accessible name). Undo
    on the phone puts focus on the restored card's row. Side by side (900px+) keeps the card heading and Remove.
    An open check likewise hides its repeated answer tag and question (the
    question stays for screen readers: it names the answer buttons).
  - "Check & send" is offered once, in the action bar. The card's own copy
    competed with it and with "Done with this card".
  - A new inspection said "Check & send 13" and listed twelve identical
    "not answered yet" stops. Unanswered checks are now one stop ("11 checks
    not answered yet") that opens the first; the step badge and the action
    bar count the same rows. The review rules are unchanged (display only).
  - Non-blocking findings are labelled "Optional" instead of "Check", which
    clashed with "Check & send" and with an inspection's checks.
  - The title area: the Draft tag sits beside the title instead of on its own
    line, the line under it no longer repeats "draft" or "correction, rev 2"
    (the tag says "Correction draft" and the correction note says the
    revision), and a sent report names its type rather than its reference twice.
  - The where-it-is line said "Both cards and its photo"; it now says
    "1 photo", and an inspection says "checks", not "cards".
  - The save state with no signal said "On this device only — will retry
    saving when connected" while every card said "Only on this phone"; it is
    now "On this phone only · goes up with signal", and fits on one line.
  - The recent-places hint shows only when there are recent places, and the
    photo caption box says "Add a caption" (its old placeholder was cut off).
  - Hover colours apply only where there is a real pointer (`@media (hover:
    hover)` in globals.css). On a phone a tap left "hover" stuck, so tapping
    "Check & send" lit up "Send to office", which appears under the finger.
- Help: a "What's new" entry (`editor-tidy`). No guide text described the
  changed wording.
- Verified on Node 24: `npm run typecheck`, `npm test` (two new cases in
  `tests/uploadStatus.test.ts`), `npm run build`. New
  `scripts/verify-editor-usability.mjs` passed (55 checks, 390px light and
  1440px dark). All other browser checks re-run and passed (40 scripts,
  listed in the PR), with `verify-undo-remove`, `verify-same-location`,
  `verify-photo-uploads`, `verify-draft-conflict` and `verify-sent-elsewhere`
  updated for the new wording and the open row.
- Scope: no task in `docs/tasks.json` covers this. It rests on Cal's standing
  instructions for this project (take agency; UI that is clear, easy to use
  and inviting; freedom beyond the task list), not on `CLAUDE.md`, whose
  "build only approved scope" rule predates them. The fresh-context review
  flagged this; it is recorded here rather than changed.
- A fresh-context review also found four correctness gaps, all fixed: a card opened from a
  Stop no longer said why (the open row now keeps the stop message), the
  phone's Remove read "Remove this card" while its accessible name was
  "Remove card 1", Undo focused a Remove button out of view at the card's
  foot, and What's new overstated "Check & send" being in one place. Screenshots in the
  project's `ui-review/editor-usability/`.
- Not verified: a physical phone, Safari and Firefox.
- Not picked up: the accessibility pass's editor follow-ups; its PR was not up
  when this started.
- Proposed (not added to `docs/tasks.json`): "UI-3 Report editor usability
  pass: no repeated content in an open card, one Check & send, grouped
  unanswered checks; browser check at 390 and 1440px". Follow-ups: start an
  inspection with last week's open safety actions shown; show the signature
  box nearer the top of the check step for inspections, where it is required.

## 2026-10-20 — Second release check on main

- Ran everything on main at dbb44ad (#2 to #27, #29 to #40, #42) under
  Node 24: `npm run typecheck`, `npm test` (145 package + 252 web tests),
  `npm run build` and all 36 `scripts/verify-*.mjs` browser checks, one
  after another. All passed, `verify-pdf-navigation` included. After
  merging #41 and #43 (774666a) everything was run again, browser checks
  included; results in the PR.
- Looked for faults between features built in parallel: no SQL migrations
  exist (records are JSON), so nothing clashes or depends on order; every
  page route is distinct; every returnable view added since #40 is in
  `lib/viewNavigation.ts`; the summaries built before report types (#39)
  (site diary, weekly summary, My week, since last visit, search, photo
  library, unfinished reports, office desk) all handle inspection checks.
- One fault found between features: #39 changed `public/offline.js` but
  kept the service worker cache at `relay-public-v4`. The worker serves
  `offline.js` from its cache first, so a phone that already held v4 would
  keep the old offline page, which shows an inspection's checks as plain
  untitled cards. #41 (offline capture), merged during this check, bumped
  the cache to `relay-public-v5`, which covers #39's change too. So this PR
  adds only the guard: `tests/serviceWorker.test.ts` pins the digest of
  `offline.js` and `offline.html` (line endings normalised) to the cache
  name, so the next change to either fails until the name is bumped. It
  caught #41's change at once when main was merged in, and then #43
  (pre-handover inspection), which changed `offline.js` again under v5.
  #46 (offline inspection start), merged during this check, then moved the
  cache to `relay-public-v7`, which covers both; the guard records v7.
- `verify-offline-capture` failed once on the merged main ("dark: and the
  photo") and passed on two re-runs: it counted thumbnails right after a
  reload, before the phone's store had drawn them. It now waits for the
  thumbnail first.
- Deploy findings (nothing deployed): no new environment variables, no new
  SharePoint columns. `upgrade-pilot.sh` still makes one live SharePoint
  call (the two Variation Register columns, unchanged). A safety inspection
  is filed as a PDF and listed in the Report Register like any report, with
  its SSI reference as the title, using existing columns.
- Not verified: a Docker image build, the server, a live SharePoint tenant,
  real phones, and rolling back after an inspection exists (the old version
  would show its checks as plain cards; not tried).


## 2026-10-20 — FE-3e: offline capture, second slice (start an inspection)

- Why this slice: #41 proposed it first, and it is the gap engineers would hit
  next. A safety inspection is weekly and a handover walk happens in risers,
  plant rooms and basements, exactly where there is no signal. Until now the
  offline page could only start a site update, so an inspection had to wait
  for signal or be written on paper. Decided by Claude under Cal's standing
  autonomy; grouping held reports by project (#41's other proposal) waits,
  because a phone rarely holds more than a few.
- Now the offline page's start panel is "Start a report": Site update, Safety
  inspection or Handover inspection (Site update chosen by default), then
  project and visit date as before. An inspection starts with every check,
  unanswered, each with its "what to look at" line; answers, notes, Where (a
  handover action) and photographs are taken as on a held inspection. It is
  listed as "New safety inspection · project" with "3 of 12 checks answered",
  and says it is signed in RELAY when there is signal. Checks cannot be added
  or removed, as in the editor.
- Where the checks come from: the offline page is a static file and cannot
  import `lib/reportTypes.ts`, so the app leaves the inspection types and their
  checks on the phone while it has signal (`relay-offline-types`, written by
  `HeldWork`, built by `offlineTypes()`). One source of truth; it is not
  personal, so it stays after sign-out. A phone that has not opened RELAY
  since this change offers a site update only, as before.
- Going up: unchanged path (`lib/heldSend.ts`). The start now carries the
  report type; the server numbers it as that type (SSI/PHI) and starts it with
  its checks, and `fitStartedChecks` moves the phone's answers, words and
  photos onto the server's checks by item. If the checklist wording changed in
  a deploy meanwhile, the server's wording is kept and the answers move
  across; a check gone from the inspection is dropped if left blank; if one
  the phone answered is gone, the copy
  is left as it is, the server refuses it (`invalidShape`) and it stays on the
  phone, named once, rather than lose an answer. A retry with the same key
  for another kind of report is refused (422). Nothing is sent, signed or
  raised as an issue from the phone: the draft is signed and sent in RELAY.
- Also: the home screen's row for a report started offline names its type
  ("New safety inspection · project", "12 checks"); the problem note uses the
  same name; Help's "No signal" section and What's new say inspections can be
  started offline and are signed in RELAY. Service worker cache
  `relay-public-v7` (v6 is taken by the open release check, #44).
- Verified on Node 22 (the cloud session's Node; engines asks for 24):
  `npm run typecheck`, `npm test` (3 new tests in `tests/offlineStart.test.ts`:
  the types left on the phone, the started title, fitting checks unchanged,
  reworded, removed and added; the home screen row; an idempotent offline start
  of an inspection against the real store), `npm run build`. New
  `scripts/verify-offline-inspection.mjs` passed (45 checks, server stopped to
  stand in for no signal): at 390px light a handover inspection and at 1440px
  dark a safety inspection, the checks left on the phone, three choices with
  site update first, every check with its hint, no add or remove, the
  signature note, an action with Where (handover only), notes and a photo,
  two more answers, a reload, nothing on the server while it was down, then
  on opening RELAY one draft of that type and numbering with all 12 checks,
  the answers, Where and photo, no issue raised, opening in its editor, nothing
  left on the phone. Also passed: `verify-offline-capture`,
  `verify-offline-drafts`, `verify-handover-offline`,
  `verify-unfinished-reports`, `verify-engineer-layout`, `verify-help`,
  `verify-report-types`, `verify-role-access`. Screenshots in the project's
  `ui-review/offline-inspection/`.
- Not verified: physical iOS and Android phones (so `passes` stays false),
  Safari's service worker, Chromium's own offline mode (stopping the server
  stands in), SharePoint mode (no live tenant).
- Next (proposed, not built): take the drawn signature on the offline page so
  an inspection is ready to send the moment signal returns; group "On this
  phone" by project; add `verify-offline-inspection.mjs` and
  `verify-offline-capture.mjs` to the browser checks in `CLAUDE.md`.

## 2026-10-20 — Help and what's new (new feature, proposed as NEW-11)

- New `/help` page: how RELAY works in plain words, with two tabs, "On site"
  and "In the office" (engineers land on the first, everyone else on the
  second). It has "What's new" (each addition with its date, what it does and
  a link to try it), "How it works" (a first site update in four steps, after
  you send, a defect on its own, no signal, getting something wrong; for the
  office: the day's work, closing an issue, review, the site meeting), "What
  the words mean" (each status of a sent report, an issue, a variation and a
  safety check, in the screens' own words) and "Where to find things".
- "New" marks: each entry has a stable id. The ids someone has seen are kept
  on their device, per person (`relay-help-seen:<id>`), so an entry says
  "New" until they have opened Help once. Entries new to them are always
  shown; otherwise the latest six, with "Show all". Nothing is stored on the
  server and nothing is sent.
- Ways in: "How RELAY works and what's new" at the foot of the engineer home
  with "N new to you"; the office desk's existing Help button (now shown on a
  phone too, with a count) whose dialog links to the page; "Help" in the app
  bar on other pages. Pages opened from Help offer "← Back to Help" on the
  same tab (`/help` added to `lib/viewNavigation.ts`).
- Why this feature: more than twenty features reached RELAY today, each found
  only by someone who happens to open the right screen, and the office's Help
  dialog said two sentences. People use what they know exists, so this is the
  cheapest way to make the work already done pay off, and it answers Cal's ask
  for a UI that is clear and invites people in. Content is in
  `lib/helpGuide.ts`, not the page, so each future feature adds one entry to
  the top of `WHATS_NEW` (never reuse an id). Claims were checked against the
  code, and a fresh-context review corrected five that were not exact (field
  and card names, what "In progress" means, that review is a project setting
  the office cannot switch on, held work going up once RELAY is opened). For
  example: nothing is emailed because the Graph transport is not
  wired; the closer cannot verify their own issue; Undo lasts 12 seconds. The review also found the office tab offered
  engineers links to office-only pages; those are now left out for them. The
  handover inspection (#43) merged while this was built and is listed.
- Not FE-2, EXP-2 or EXP-4: no photo workflow, no routing, no locations.
  Outside the report editor and report types.
- Verified on Node 24: `npm run typecheck`, `npm test` (10 new tests in
  `tests/helpGuide.test.ts`: office-only pages not offered to engineers, every link goes to a page that exists, ids unique
  and newest first, tab filtering, landing tab, seen and new, a damaged stored
  list, the status words match the screens, dates, Back to Help),
  `npm run build`. New `scripts/verify-help.mjs` passed (33 checks: signed out;
  engineer at 390px light from home with the new count, the guide, a page and
  Back to Help, New gone on the next visit, Show all, the office tab with only
  office-only entries new, the home count gone; 1440px dark, print and Back to
  Site; manager at 1440px dark from the desk's Help with its count, Issues by
  company and Back to Help, the count gone, the app bar link; office phone at
  390px). Also passed: `verify-role-access` (61), `verify-engineer-layout`,
  `verify-navigation` (76), `verify-engineer-nav` (60), `verify-office-landing`
  (19), `verify-office-phone` (95), `verify-my-week`, `verify-safety-actions`.
  Screenshots in the project's `ui-review/help/`.
- Not verified: a physical phone, Safari and Firefox, SharePoint mode.
- Proposed (not added to `docs/tasks.json`): "NEW-11 Help and what's new —
  a guide for site and office, and what's new marked per person; browser
  check at 390 and 1440px". Follow-ups: add `verify-help.mjs` to the browser
  checks in `CLAUDE.md`, and a line in `CLAUDE.md` asking each feature PR to
  add its `WHATS_NEW` entry; let Cal or the office edit the guide's wording.
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
- Verified on Node 24: `npm run typecheck`, `npm test` (9 new tests in
  `tests/handoverInspection.test.ts`), `npm run build`. New
  `scripts/verify-handover-inspection.mjs` passed (99 checks, 390px light and
  1440px dark): start from home beside the other two tiles, Where hidden until
  Action needed, all 12 answered, a missing Where stops sending and says why,
  the draft PDF's words, drawn signature, send, one issue raised with where,
  what, action, owner and photograph, no variation, sent view, site diary card
  naming its issue, the office sheet linking the issue, the issue page.
  Browser checks re-run: see the PR.
- Offline capture (#41, merged in): a held handover inspection is named as one
  on the offline page, and an action there asks Where too (cleared when the
  answer moves off Action needed, as in the editor). New
  `scripts/verify-handover-offline.mjs` passed (14 checks, 390px light and
  1440px dark): held copy named, Where only for an action, sent up by itself
  when signal returns with Where on the server. Starting an inspection offline
  is not built: the offline page starts site updates only.
- A fresh-context review found three gaps, all fixed: the report summary's
  `defectCount` left out a handover inspection's actions, so the office review
  dialog did not say approving confirms its issues (now counted, with a test);
  the office sheet of a sent correction showed "no issue" beside each action
  (it now falls back to the issue the action is linked to, checked in the
  browser script); the offline page could not show or enter Where.
  After the fixes, also passed: `verify-offline-capture`, `verify-offline-drafts`,
  `verify-review-queue`, `verify-office-actions`, `verify-safety-actions`,
  `verify-report-types`, `verify-site-diary`, `verify-engineer-layout`,
  `verify-unfinished-reports`; `verify-handover-inspection` now 104 checks.
- A second review found that a correction moving an action to Satisfactory
  still showed "further sighting of ISS-…" in the office and the diary; a
  check now speaks for its linked issue only while it needs action. The issue
  itself stays open for the office to withdraw, as it does when a defect card
  is changed in a correction (an automatic withdrawal is proposed below).
- Not verified: a physical phone, the PDF rendered by the worker after sending
  (the draft PDF uses the same renderer), SharePoint mode (no live tenant).
- Proposed next (not built): when a correction withdraws an action (or a
  defect), note it on the issue so the office can withdraw it; an area field on the inspection itself (one
  place for the whole walk, prefilled into each action); a third type such as
  a commissioning record with readings; let the office edit checklists; add
  `verify-handover-inspection.mjs` to the browser checks in `CLAUDE.md`.


## 2026-10-20 — FE-3e: offline capture, first slice

- Before: with no signal, RELAY opened a recovery page that could only edit
  the words of reports already held on the phone, and only in a tab that had
  been signed in during the same session. A cold start (opening the app from
  the home screen with no signal) showed nothing, and no report could be
  started and no photo taken.
- Now the offline page (`public/offline.html`, kept by the service worker,
  cache now `relay-public-v5`) opens on a cold start for the person last
  signed in on the phone. It can start a site update on any project they
  could report on when last online, with a visit date (today by default, up
  to 30 days back); add, change and remove cards of every kind; take and
  remove photos (kept on the phone with thumbnails, as the editor does); and
  change reports already held, including photos on an inspection's checks.
  Every card and report says "Only on this phone". The page checks for the
  server every 20 seconds and says "Signal back" with an "Open RELAY" button.
- Once RELAY opens with signal (any page except a report's own editor), held
  work goes up by itself (`lib/heldSend.ts`, `components/HeldWork.tsx`):
  each report started offline is started on the server, then its cards and
  photos are saved, as are changes made on the offline page. A note says what
  went up ("2 reports from this phone are now on the server. They stay drafts
  until you sign and send."). Nothing is ever sent to the office from here.
  A report started offline and not yet on the server is listed under
  Unfinished reports as "New site update · project", "Only on this phone".
- Server: `POST /api/reports` takes an optional client key and visit date
  (both or neither). The key makes the start idempotent per person: a retry
  after a lost answer returns the same report, never a second one, even if the
  project has closed since. The visit date must be a real day, not after
  tomorrow (time zones) and not more than 30 days back.
- Decisions (Cal asked Claude to decide scope): this slice covers site
  updates, the report engineers write most and the one that needs free cards
  and photos on site. Starting a safety inspection offline is left for the
  next slice. The phone keeps the signed-in person's name and id and their
  projects' numbers and names in local storage so a cold start works; no
  credentials, report data or pages are cached, and signing out removes them.
  A shared phone that is not signed out shows the last person's held work,
  which was already on the device. Work typed on the offline page goes up by
  itself because no editor holds it; work an editor holds is still saved by
  that editor. An editor opened on a report still queued to go up takes it
  over; one opened while that report's own save is in flight waits for it
  only, saying "Putting the work from this phone onto the
  server first…", before reading the server or the phone (found in review: it
  could otherwise open on a copy half-way up and then be told the draft
  changed elsewhere). A save refused because the draft
  changed elsewhere is never forced: the copy stays on the phone and the note
  links to the report, whose editor already shows both versions to choose
  from (FE-3c). A start the server refuses is kept and tried again later, and
  each refusal is named once. Fields asked only by the full editor (trade,
  variation reason and the like) are filled there; they were never required.
- Deleting a report started offline also deletes its photos from the phone
  (found in review: the page said it was deleted from the phone).
- Verified on Node 24: `npm run typecheck`, `npm test` (5 new tests in
  `tests/offlineStart.test.ts`: visit date rules, what goes up by itself, the
  wording, the home screen row, and an idempotent start against the real
  store, per person), `npm run build`. New `scripts/verify-offline-capture.mjs`
  passed (53 checks, server stopped to stand in for no signal): at 390px light
  and 1440px dark, the person and projects left on the phone, a cold start in a
  fresh page showing the offline page, starting a report, a defect card with a
  photo, a card added and removed, a held draft changed with a new photo, all
  surviving a reload, nothing reaching the server while it was down, "Signal
  back", then on opening RELAY one new report with today's visit date, the
  card and photo, the held draft's change and photo on the server, the new
  reference under Unfinished reports, nothing left on the phone, nothing sent
  or announced twice; a draft changed on another device left on the phone with
  its editor offering the choice and the server copy untouched; signing out
  removing the person and projects. `verify-offline-drafts` (updated for the
  new list and the app's store version), `verify-engineer-layout`,
  `verify-unfinished-reports`, `verify-photo-uploads`, `verify-draft-conflict`,
  `verify-role-access`, `verify-sent-elsewhere` and `verify-report-types`
  passed. Screenshots in the project's `ui-review/offline-capture/`.
- Not verified: physical iOS and Android phones (FE-3e's second acceptance
  step, so `passes` stays false), Safari's handling of the service worker and
  camera input, Chromium's own offline mode (stopping the server stands in),
  storage pressure on a full phone, SharePoint mode (no live tenant).
- Next (proposed, not built): start a safety inspection offline; show
  "Only on this phone" reports on the offline page grouped by project;
  add `verify-offline-capture.mjs` to the browser checks list in `CLAUDE.md`.

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

## 2026-10-20 — Safety actions (new feature, proposed as NEW-10)

- New `/safety-actions` page: what the weekly safety inspections found
  needing action, on every live project or one. Each action shows the check,
  what was wrong, what to do and who, as last written, how long it has been
  open and how many inspections in a row found it. It stays open until a
  later inspection on the same project answers that check Satisfactory or
  Not applicable; then it moves to "Put right in the last 4 weeks" with the
  inspection that cleared it, who did it and any note. Each project also
  says when its last inspection was and that another is due after 7 days;
  live projects with no inspection yet are named. Reached from "Safety
  actions" under "This project" on the engineer home, the Reports view's
  "Also on this project", and the office overview and each project's sheet.
  New `GET /api/safety-actions`; rules in `lib/safetyActions.ts` (pure).
- Why this feature: the safety inspection (#39) raises no issues on
  purpose, so an action lived only on the PDF it was written on and nobody
  could see which were still outstanding. This was the first follow-up
  proposed in #39 ("track inspection actions to closure"). It is outside the
  report editor, so it does not touch the offline capture work.
- Decisions: nothing is typed in or stored. The next inspection is the
  record that an action was put right, as on a paper inspection, so there is
  no "mark done" button that could clear an action nobody re-checked
  (proposed as a follow-up if the office wants one). An action is followed by
  its check's stable `item` key, so rewording a question keeps the thread. A
  sent correction stands in for the inspection it corrects; drafts are left
  out. Every role may open it, because sent inspections are read by every
  trade. Only active and defects liability projects are covered (the site
  coverage rule), so tender and complete projects are not listed as "no
  inspection yet". Not FE-2 (photographs are only counted), EXP-2 (no
  requests or routing) or EXP-4 (locations stay free text). Nothing is sent
  or written to SharePoint.
- Verified on Node 24: `npm run typecheck`, `npm test` (6 new tests in
  `tests/safetyActions.test.ts`, one in `tests/viewNavigation.test.ts`),
  `npm run build`. New `scripts/verify-safety-actions.mjs` passed (30 checks:
  signed-out refusals; from the engineer home at 390px light, the open action
  found twice and its words, the cleared one folded then opened, the counts,
  a draft left out, no sideways scroll, every project with the corrected
  Kirkstall inspection clearing its action, tender and complete projects
  left out, a report opened and Back; from the Reports view at 1440px dark
  and printed on white with the put-right list opened; from the office as a
  manager). A fresh-context review found printing left the put-right list
  folded and "put right after the same day"; both fixed. `verify-navigation`
  now expects the new links and passed (76). Also passed:
  `verify-role-access` (61), `verify-engineer-layout`, `verify-engineer-nav`,
  `verify-office-landing`, `verify-report-types`, `verify-my-week`,
  `verify-weekly-summary`. Screenshots in the project's
  `ui-review/safety-actions/`.
- Not verified: a physical phone, Safari and Firefox, SharePoint mode (no
  live tenant).
- Proposed task (not added to `docs/tasks.json`): "NEW-10 Safety actions —
  follow each safety inspection action until a later inspection clears it,
  on every live project or one; browser check at 390 and 1440px." Possible
  follow-ups: show last week's open actions on the inspection itself when an
  engineer starts the next one (editor work, after offline capture lands);
  an office "put right" note for actions cleared between inspections; add
  `verify-safety-actions.mjs` to the browser checks list in `CLAUDE.md`.

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
- Verified on Node 24: `npm run typecheck`, `npm test` (9 new tests in
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
