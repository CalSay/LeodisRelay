# Release 1

Decided by Claude on 22 October 2026, at Cal's ask to "define a first release
point and work towards that with haste", with the UI on the engineer's phone
and the office laptop "top notch". This page says what Release 1 is, what it
leaves out, and what has to be true before it goes to the live pilot.

The live pilot runs 03188ee (#2 to #27 and #29 to #99). Main is at b387483 (#180).

## What Release 1 is for

An engineer on site records progress on a phone in a few taps, and the office
sees it clearly on a laptop. Everything in the release serves that loop
(Cal, 21 October 07:02). Nothing new is built for it except the polish tasks
below and fixes the release check finds.

## What is in

**Engineer, on a phone**

- Sign-in, the company hub and the first day (install RELAY, first update).
- The Site page: start today's site update, flag a defect, add a variation,
  unfinished work, what came back from the office.
- The site update: cards, photos, Check & send, the sent receipt, working with
  no signal and sending once there is signal.
- Defects and variations, with their receipts.
- Inspections kept for quality: pre-handover and first fix.
- Issues: the list, "Where are you?", the issue page, putting a fix forward,
  the snag list.
- My week, Photographs, Site notes, Search, Help.

**Office, on a laptop**

- The top bar, the projects overview and a project's sheet.
- Inbox and reading a report, checking fixes, sending a fix back.
- The Issues register and an issue's sheet, Issues over time, Companies.
- Variations, Team, Admin.
- Site coverage, Weekly summary (week and month), Before handover, the site
  diary.
- Report PDFs (site update, inspections, weekly and monthly summary) with the
  logo and accreditation marks.

**Open pull requests that join Release 1 when merged**

- #176 (a site update card stays calm while being filled in), being worked
  on now. #181 (Put forward as fixed stays on the first screen) merged on
  22 October.
- #142 (Undo gets the focus back on a phone, and the site coverage check from
  Thursday to Sunday) is **needed**: it fixes a known fault. It waits on Cal's
  "carry on".
- #130 (a site update with no signal sends from any page) and #154 (Attention
  kind by kind) join if Cal says "carry on" before the final release check.
  If not, they wait for Release 2 and the release goes without them.

## What is out or hidden

- **Safety, permits and deliveries** (toolbox talks, permits to work,
  deliveries, weekly safety and tower inspections, Safety actions): stay
  switched off by default (#85). Nothing is deleted. They are not polished
  for this release.
- **Leodis Compliance** (`/compliance`): screens over invented sample data,
  nothing is saved. Not in Release 1 and not polished (see task E1).
- **Site information** (#28): stuck on a merge, not in.
- **Email and SharePoint filing**: unchanged from the live pilot. Email stays
  in RELAY's local outbox and is not sent. No new SharePoint or Entra work.
- Rejected backlog items stay rejected: photo tags and albums (FE-2),
  decision routing (EXP-2), a list of places (EXP-4), the sole-trader product.

## Exit checklist

Release 1 is ready to deploy when every line is ticked.

1. Every polish task below (E1 to E7, O1 to O7) is merged.
2. #176 and #142 are merged (#181 already is).
3. `npm run typecheck`, `npm test` and `npm run build` pass on the release
   commit.
4. Every `scripts/verify-*.mjs` check passes, run one at a time (they share
   ports). A check that earlier release checks found slow or flaky on cloud
   machines (verify-busy-projects, verify-day-walkthrough) passes on a rerun
   alone, or fails the same way on the previous checked commit. verify-pdf-navigation
   is known to fail on the preinstalled Chromium (pdf.js 6) and is recorded,
   not waved through silently.
5. A full release check on that commit: a walk of an engineer's day at 390px
   and an office person's day at 1440px on the busy example data, light and
   dark; the Docker image builds and starts healthy; the release notes in
   the project files are updated to the commit.
6. Cal's items, which only Cal can do:
   - send the company address, company number and VAT number for the PDF
     footer (#168 left a gap for them);
   - say "carry on" on #142 (needed), and on #130 and #154 if he wants them
     in;
   - give the go-ahead to deploy, and run the prepared deploy line.

What Release 1 will not have been checked on, and the notes must say so: a
real phone, real weak signal, a screen reader, a printer, a tablet, a live
Microsoft tenant.

## UI polish tasks

Each task is one small pull request. There are two lanes so two threads can
work at once without touching the same screens:

- **Lane E (engineer)** owns engineer screens, checked at **390px**, light and
  dark, plus 1440px light to make sure nothing breaks on a laptop.
- **Lane O (office)** owns office screens, checked at **1440px**, light and
  dark, plus 390px light (the office also opens RELAY on a phone).

A screen used by both (Photographs, Search, Help, Weekly summary, Issues over
time, Before handover, the site diary) belongs to one lane only, named below,
and that lane checks it at both widths, light and dark. Within a
lane, tasks go in order. Never two threads in the same lane.

**Every polish task does the same things on its screens:**

- Before and after screenshots at the sizes above, saved under
  `/mnt/project-files/ui-review/release-1/<task>/`.
- Fix what makes the screen look unfinished or hard to read: uneven spacing,
  sections that run into each other (Cal, 21 October 12:59), weak headings,
  more than one gold button, small tap targets on a phone (at least 48px),
  text that is cut off or wraps badly, dark mode colours that are off,
  sideways scroll, long or technical words.
- Take things off the screen rather than add them. No new features, no new
  routes, no data changes.
- Keep the shared files quiet:
  - No polish task changes the colour and size tokens in `globals.css`. If
    one is needed, it is its own small PR between tasks, with both lanes'
    checks run.
  - `engineer.css`, `entry.css`, `search.css` and `stages.css` load on every
    page (from `app/layout.tsx`), so new rules there use selectors that only
    match the lane's own screens. Lane E styles go in `engineer.css` or the
    screen's own CSS; lane O in `workspace.css`, `quickactions.css` or the
    screen's own CSS.
  - Components both lanes render are restyled from the calling screen's CSS,
    not changed themselves: `PageTitle`, `PhotoImage`, `ThemeToggle`,
    `SharePointStatus`, `DownloadLink`, `OfficeWordBox`, `SubmissionStages`,
    `InstallRelay`, `IssueRegister`. If one has to change, the PR says so
    and runs both lanes' checks for the screens that use it.
- Pass the screen's existing verify scripts, `verify-accessibility`, and the
  usual typecheck and tests. Add or update a check only where the change
  moves something a check looks for.
- A Help "What's new" line only if people will notice the change.

### Lane E: engineer phone (390px)

- **E1. Entry screens.** Sign-in, local sign-in, the company hub (`/`),
  `/developments`, `/signed-in`, `/offline`, the install prompt and the
  signed-out prompt (`EntryFrame`, `InstallRelay`, `SignedOutPrompt`), and
  the main navigation in `app/layout.tsx` on a phone. The hub shows Leodis
  Compliance as "Coming later", not a link, so nobody lands on sample data.
  This is the one change of behaviour in the polish tasks, decided by
  Claude under Cal's go-ahead to decide (14:11, 20 October): Compliance is
  not in Release 1 and its invented records look like real ones. It is
  undone by putting the link back.
- **E2. The Site page.** `/engineer` Site view and its Projects view
  (`EngineerWorkspace`, `HeldWork`, `SinceLastVisit`): first screen on a
  phone shows the big button and what needs the engineer, nothing else; the
  folds and rows below line up.
- **E3. Site update.** `/reports/[id]` for a site update: cards, photos, Check
  & send, signature, the sent receipt, the no-signal and conflict states
  (`ObservationEditor`, `SignaturePad`, `SubmissionStages`, `DraftConflict`,
  `SentElsewhere`). Wait for #176 to merge before branching.
- **E4. Defects and variations.** The defect screen and its receipt
  (`IndividualDefect`, `DefectsOnSignal`), the variation card and its
  receipt, `/variations/[id]` on a phone.
- **E5. Inspections.** Pre-handover and first fix in `/reports/[id]`
  (`CheckEditor`, `InspectedName`): the check list, needs action, signing,
  sent. Safety and tower inspections are left alone (switched off).
- **E6. Issues.** The Issues view of `/engineer` and "Where are you?" (its
  part of `EngineerWorkspace`, and `EngineerIssueList`), `/issues/[id]`,
  putting a fix forward, `/issues/snag-list`.
- **E7. The engineer's other pages.** The Reports view of `/engineer`,
  `/my-week`, `/photos`, `/site-notes`, `/search`, `/help` (`MyWeekPage`,
  `PhotoLibraryPage`, `SiteNotesPage`, `SearchPage`, `HelpPage`). Photographs, Search and Help belong to this lane
  and are checked at 1440px light and dark too.

### Lane O: office laptop (1440px)

- **O1. Top bar and projects overview.** `/office` landing and the projects
  list, the overview blocks (Not seen yet, Unassigned issues, Fixed to check,
  Today from site) (`OfficeDesk`, `ProjectsView` overview part, `bits`).
  While #154 is
  open, leave the Attention block's figures as they are.
- **O2. A project's sheet.** The sheet beside the list in `ProjectsView`:
  last visit, latest from site, reports and records links, project manager;
  and the separate `/projects` and `/projects/[id]` pages (`ProjectsPage`).
  Leave the issue sheet to O3.
- **O3. Issues.** The Issues tab and register (`IssuesView`, `IssueRegister`),
  an issue's sheet, checking a fix and sending it back (`CheckFix`, the check
  dialogs in `Dialogs`), Companies (`/companies`, `CompanyIssuesPage`).
- **O4. Inbox and reading a report.** The Inbox tab (`InboxView`), the
  office's report reader (in `InboxView` and the report part of
  `ProjectsView`), `/reports/[id]/preview` and the `/reports/[id]/pdf`
  viewer page, correction and acknowledgement dialogs in `Dialogs`. Wait for
  O2 and O3 to merge (they change `ProjectsView` and `Dialogs`).
- **O5. Weekly summary and month.** `/weekly-summary` week and month, at
  1440px and 390px (`WeeklySummaryPage`, `MonthSheet`, `summaryRows`,
  `week.css`), and `/issue-trend`. This lane owns the engineer's view of
  these too.
- **O6. Coverage, handover and diary.** `/coverage` (`SiteCoveragePage`),
  `/handover` (`BeforeHandoverPage`), `/diary` (`SiteDiaryPage`). Engineers
  open Before handover and the diary too: check both at 390px light and dark.
- **O7. Variations, Team and Admin.** The Variations tab (`VariationsView`),
  Team and Admin (`TeamAdmin`, `/admin`).

PDFs are not polished in these tasks: Cal has a separate "PDF report
template" thread open, and the PDFs change only there.

### Order

Start E1 and O1 together. E3 waits for #176; if it is not merged when the lane
gets there, do E4 or E5 first. When both lanes are done,
run the release check (exit checklist 3 to 5), then ask Cal for the deploy
go-ahead.
