# Progress log

Append one entry per thread, newest at the top. Keep each entry short:
what changed, how it was verified, what was not verified, and what comes next.
Earlier history is in `docs/optimisation-progress.md` and the dated docs.

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
