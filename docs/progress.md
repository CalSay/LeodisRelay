# Progress log

Append one entry per thread, newest at the top. Keep each entry short:
what changed, how it was verified, what was not verified, and what comes next.
Earlier history is in `docs/optimisation-progress.md` and the dated docs.

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
