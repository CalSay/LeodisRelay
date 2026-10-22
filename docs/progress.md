# Progress log

Append one entry per thread, newest at the top. Keep each entry short:
what changed, how it was verified, what was not verified, and what comes next.
Earlier history is in `docs/optimisation-progress.md` and the dated docs.

## 2026-10-22 — Release 1 polish E3: the site update editor

- Why: task E3 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch" on
  the engineer's phone). Branched after #176 and #193 merged (79dc5aa).
  Screenshots before and after, 390px light and dark and 1440px light, are in
  `ui-review/release-1/E3/`: a new update, a filled card, a defect, three
  cards, Check & send with stops and clear, signing, and the sent receipt.
- What the walk found: the editor was already in good order (every control
  48px or more except Back). The rest was small: Back was 44px; "Change
  kind", "Remove card N" and the signature's "Clear" were 12px text among
  15px buttons; "What sending does" was a bare label tight under the tally
  while "In this report" and "Sign" are ruled headings; on the receipt "See
  the full report" was a 15px-tall link inside a sentence and "Make a
  correction" a small grey 12px button that looked switched off.
- The no-signal and two-screen states: screenshots from the existing checks
  (`verify-draft-conflict`, `verify-sent-elsewhere`, `verify-offline-capture`
  with `RELAY_SCREENSHOT_DIR`, 390px light and 1440px dark, as those checks
  take them) are in the same folder. In the "changed somewhere else" card
  "Photographs" ran into its value ("PhotographsNone"), and the keep and
  discard buttons were 12px text: both fixed. The no-signal page itself
  (`/offline`) is E1's and was not changed.
- Changed: one block at the end of `engineer.css`, scoped to
  `.eng-report-editor` and `.eng-report-sent`, and in `reports/[id]/page.tsx`
  the full report link sits on its own line (class `eng-full-report`, its
  inline style moved there) and Make a correction is a plain outlined button
  (`btn-quiet eng-correct`). No `globals.css` token changes, no shared
  component changes, no change to cards, saving, offline or drafts.
- No Help "What's new" line: nothing works differently.
- `.eng-report-editor` also wraps the pre-handover and first fix
  inspections, so their "What sending does" heading and signature "Clear"
  button change the same way (E5's screens; checked by the inspection checks
  below).
- Verified: `npm run typecheck`, `npm test` (146 + 591), `npm run build`.
  Browser checks passed: engineer-layout, signature-reload, report-editor
  (58), editor-usability (55), editor-wide (274), quick-update (47),
  quicker-update (109), lighter-card (80), fewest-taps (17),
  calm-while-writing (55), draft-conflict (23), offline-drafts (5),
  offline-sign (62), offline-capture (65), sent-elsewhere (33), engineer-day
  (37), receipt-send-bar (58), typed-signature (42), old-drafts (84), help
  (36), accessibility (584). A fresh-context review found no correctness bugs;
  it asked for the no-signal and two-screen states to be looked at too (done
  above) and for the checks to be named here.
- Not verified: a real phone, a screen reader.

## 2026-10-22 — Release 1 polish O4: Inbox and reading a report

- Why: task O4 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch").
  Before and after screenshots at 1440 light and dark and 390 light are in
  the project files under `ui-review/release-1/O4/` (Inbox, Inbox with a site
  update and an inspection open, a report in its project, a corrected report,
  the Review dialog, the full report, the PDF page). Busy example data, 40
  days, Office Manager. Branched after O3 (#192) merged.
- Found: with a report open the Inbox reader was a 440px strip inside a panel
  inside a box, so the title wrapped, "Received", "Awaiting review" and "Seen
  by the office" broke mid-word, and the reader read as boxes within boxes.
  "Quick actions" was a mono capitals control. On a phone a report's rows left
  the words about 95px beside the tag and button. The PDF page showed
  "Previous page PDF Next page Zoom" with a full-width select before anything
  had loaded. The full report's details sat five and one at a desk and its
  actions table hid the Owner column off the side of a phone. The Review
  dialog said "visit 2026-10-22".
- Changed: `workspace.css` new block at the end: with a report open at a desk
  the list and reader share the width evenly, the engineer's name stays on
  one line and "Received" is plain type; `.report-sheet` / `.report-title`
  give the reader O3's issue-sheet look (title in large type on the sunken
  ground, then cards with `--line-2` edges, no box in a box) in the Inbox and
  a project; on a phone a narrower tag column and Quick actions under the
  words. `InboxView` swaps an inline padding for `.inbox-reader`;
  `ReportReader` adds the two class names. `quickactions.css`: Quick actions
  in sans, 32px tall (44px on touch). PDF page: its own `pdf.css`, the page
  controls only once a PDF has loaded. Full report: its own `preview.css`,
  details three across at a desk (two on a phone), an odd last one spanning the empty cells,
  and on a phone the actions table fits the width. `Dialogs` Review: "visit
  22 Oct". No `globals.css` changes, no `packages/documents` changes, nothing
  added or taken away. #177's "Previous/Next update" line unchanged and its
  check passes. Help "What's new" line.
- Verified: typecheck, `npm test`, build. Browser, one at a time:
  office-inbox (80), inbox-phone (58), office-inspection (66),
  previous-trade-update (44), review-queue (19), submission-stages (145),
  office-desk (73), office-phone (103), office-sections (63),
  came-back-first (29), sent-back-reason (22), seen-by-office (45),
  september-office (43), office-links (65), navigation (76), role-access
  (95), accessibility (584), pdf-navigation (passes here).
- Not verified: a real phone, a tablet or a screen reader; a rendered PDF
  page in the viewer in the screenshots (the example data has no worker-made
  PDFs, so they show "still being made"; pdf-navigation renders its own).
- Next: O5 (weekly summary week and month, issue trend).

## 2026-10-22 — No red on a site update card while it is being filled in

- Why: the coordinator asked for a walk of an engineer on a 390px phone
  arriving on site and starting a site update, from the Site page to the
  first saved entry, on main af20c7b. It is already short: 3 taps (Start
  today's site update, Where, What happened) and the card saves by itself.
  The snag: as soon as "Where" was typed, before "What happened" or the
  camera, the card turned red ("no description of what happened") and Check
  & send got a red "1"; a new defect did the same before its photograph. That
  reads as a mistake when the engineer simply has not finished. Not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the engineer's job simpler, less on screen).
- Changed: `app/reports/[id]/page.tsx` remembers the open card if it was new
  when it opened (blank, or from "+ Another card here" while its kind is
  chosen), and leaves that card's stops out on the cards step until it is
  left (Done, another card) or the engineer goes to Check & send. A
  "+ Another card here" card is new only until first left; a card still
  blank when opened always is (nothing in it to warn about). Check &
  send itself is unchanged: every stop is listed and Send stays disabled, and
  a card opened again from a Stop still says what stops it. Inspections are
  unchanged. Help "What's new" line.
- Decided (Claude): quiet until the card is left rather than until a timer
  or until "What happened" is typed, because leaving the card is when the
  engineer thinks they are done with it, and a timer would turn it red mid-
  sentence.
- Fresh review found: a "+ Another card here" card left with no kind chosen
  went quiet again when reopened (it was still waiting for its kind), and the
  one "photographs with no caption" note could be hidden with the open card's
  findings. Fixed: such a card is new only until first left, and only stops
  are left out. The browser check now covers both reopening routes. A second
  fresh review found a blank card still open after a reload at Check & send
  (which skips the blank-card tidy) went red on typing once back on the
  cards: the open card is now looked at again whenever the step changes.
  That path is checked by reading the code, not by the browser check.
- Verified: typecheck, `npm test` (146 + 570), build. New
  `scripts/verify-calm-while-writing.mjs` (55 checks, 390 and 1440): no red
  after Where, a new defect calm until left then red with "needs at least one
  photograph" and a count of 1, still red when opened again, "+ Another card
  here" calm, Check & send lists both stops with Send disabled, and a card
  opened from a Stop is red and says why, and a "+ Another card here" card
  left without a kind is red when reopened from its row or its Stop. It fails on main at the first
  check. Also passed: verify-fewest-taps, -lighter-card, -quicker-update,
  -engineer-layout, -editor-usability, -help, -old-drafts, -accessibility,
  -day-walkthrough, -draft-conflict, -offline-drafts.
- Not verified: a real phone, a screen reader.
## 2026-10-22 — Release 1 polish E2: the engineer Site and Projects views

- Why: task E2 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch" on
  the engineer's phone). Before and after screenshots at 390 light and dark
  and 1440 light (first screen and full page) are in the project files under
  `ui-review/release-1/E2/`. Busy example data, 60 days, Sam Spark.
- Found: the Site page opened with an "On site" label above the engineer's
  name, which said nothing the page does not, and pushed the office's answers
  down. "This project" repeated the open issue count that the Site issues row
  right under it already gives ("111 open issues" twice). Inside the lists,
  the "Reports from others / Issues / Variations" labels and the folded lines
  ("More on this project", "3 drafts saved to RELAY") started 3px left of the
  row text. On a phone the inspection tiles put a "HANDOVER" or "FIRST FIX"
  tag beside "Do a handover inspection", squeezing the words to three lines.
  On Projects the site names were small (15px) inside a card inside a box,
  so on a phone they sat 32px in from the group's edge.
- Changed: `EngineerWorkspace.tsx` (no "On site" label; no count beside "This
  project"); `engineer.css` new block at the end scoped to `.eng-workspace`
  (labels and folds line up with rows; inspection tags hidden at 600px and
  under; Projects names 17px with roomier cards and less nested padding on a
  phone; a slightly tighter project band on a phone). No `globals.css` token
  changes, no shared component changed, no app bar change (E1, #190).
- Decided (Claude): no Help "What's new" line, as nothing works differently.
- Checks: `verify-day-walkthrough` read "N open issues" from the This project
  heading; it now checks the heading does not repeat the count (the Site
  issues row check above it still checks the number).
- Verified (after rebasing on E1 #190 and #191/#192): typecheck, `npm test`
  (146 + 591), build. Browser, one at a time: engineer-layout, busy-home (35),
  engineer-day (37), day-walkthrough (117), home-and-sheet (254),
  came-back-first (29), engineer-nav (60), accessibility (584), first-time-use
  (375); before the rebase also defect-waiting-on-site (99), first-day (94),
  role-access (95), other-sites-came-back (32). A fresh-context review found
  "Show N more" 3px out of line, one heading rule reaching the Reports and
  Issues views, and this entry missing the checks; all fixed.
- Not verified: a real phone or a screen reader.

## 2026-10-22 — Issues lists draw the first 30 cards first (slow pages on engineer phones, part 2)

- Why: part 1 (#188) took SharePoint off the wait. With a busy project's own
  data, the engineer Issues tab still drew every card at once: on the busy
  seed, All issues for Tetley Hall is 11,500 page elements (266,000 px), Open
  3,700 and Yours 5,800, and the phone's main thread was then busy for up to
  1.9 s after the list showed, so taps and scrolling stuck.
- Changed: `EngineerIssueList` draws the first 30 cards (`FIRST_CARDS`), then
  the rest straight after the first screen is up, as a low-priority React
  update. Cards past the 30th get `content-visibility:auto` in
  `engineer.css`, so the browser lays out and paints only those near the
  screen, holding 180px for each card not yet drawn at phone width (160px
  wider), about the busy seed's average card, so the page starts near its
  true length (Open 86,751 px against 89,503 drawn in full; All 295,653
  against 265,733, as closed cards are shorter) and grows
  or shrinks a little as cards scroll into view. Every card is there a moment
  later, in the same order. Speed only, so no Help line.
- Decided (Claude): not a "Show more" button (that would change the screen
  the Release 1 polish lane owns) and not on the first 30 cards, so a short
  list, and a card that has just been unfolded, behave exactly as before
  (`verify-issues-yours` reads a card's text the moment its fold opens).
- Verified: typecheck, `npm test` (146 + 591). Timed at 390px, 4x slower
  processor, Fast 4G, busy seed, median of five, until the list shows
  (scratch script): All issues 2,110 to 1,615 ms opened fresh and 1,428 to
  1,065 ms with scripts cached; main thread busy after load 1,924 to 397 ms
  and 1,457 to 503 ms. Open 1,725 to 1,674 / 1,129 to 1,046 ms, busy 694 to
  401 / 536 to 243 ms. Yours 1,574 to 1,612 / 944 to 864 ms, busy 682 to 772
  / 537 to 212 ms (fresh opens of Yours are mostly the scripts starting).
  Browser checks passed: issues-yours, simpler-issue-list, issues-here,
  issue-at-place, engineer-layout, quiet-card-list, busy-projects (phone,
  13 timings within budget; Engineer issues 1,529 ms).
- Not verified: a real phone. Not deployed. Also on the pilot (03188ee) the
  Issues tab downloads every issue on the project with its whole history
  (251 KB on the busy seed); main already asks for only "Yours" first.
## 2026-10-22 — Release 1 polish O3: office Issues

- Why: task O3 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch").
  Before and after screenshots at 1440 light and dark and 390 light are in
  the project files under `ui-review/release-1/O3/` (register Open and Fixed,
  check a fix, send back, an issue's sheet, Assign, Issues by company). Busy
  example data, 60 days, Office Manager. Branched after O2 (#189) merged.
- Found: the register's filter chips and search boxes were two bands with a
  gap, so they read as two things; at 1280px and wider the search boxes kept
  their narrow width and cut "Who has to respond" short, and "7 Sep · 45 days
  past target" wrapped down the Target column in capitals over three lines. An
  issue's sheet was the old boxed panel next to O2's new project sheet. On a
  phone the check a fix dialog put "Verify and close" alone on a second row
  below the screen. The Assign dialog's company suggestions touched each other.
- Changed: `workspace.css` new block at the end: the two filter rows joined
  into one block; from 1024px up the search boxes share the row and "N days
  past target" goes under the date (the 1024-1279 rules for these moved
  there); `.issue-sheet` / `.issue-title` give an issue's sheet O2's look
  (title in large type on the sunken ground, figures, notes and history as
  cards with `--line-2` edges); the check a fix footer is sticky, and on a
  phone "Verify and close" is the first, full-width button; gaps between the
  Assign suggestions. `ProjectsView.tsx` adds the two class names to
  `IssueSheet` only. No `globals.css` token changes; `IssueRegister`,
  `CompanyIssuesPage` and data fetching untouched. Help "What's new" line.
- Decided (Claude): Issues by company left as it is: its cards, figures and
  edges already read clearly at both widths. "Back to Office" on it comes from
  the shared `backLabel`, left alone.
- Checks: `verify-issues-laptop` said "N days past target" sits beside the
  date at 1280px and wider; it now checks it is under the date, the filters
  are on one row and each box is readable at every width from 1024.
- Seen on main before E1 (#190) merged, fixed there: the app bar on
  `/companies` cut "Sign out" to "Sign ou…". Seen, not ours: the busy example
  data has no photo files, so photos show as broken images in the screenshots.
- Verified: typecheck, `npm test` (146 + 591), build. Browser, one at a time:
  issues-laptop (284), check-fixes (70), issue-register (70),
  office-registers (225), issue-assign (48), other-trade-defect (59),
  company-issues (28), company-chases (32), office-phone (103),
  office-sections (63), office-desk (73), issue-link (42), issue-at-place
  (38), issue-figures (48), issue-provenance (18), office-links (65),
  navigation (76), role-access (95), help (36), accessibility (584). A
  fresh-context review passed with no findings; of its three notes, the
  doubled line between the two filter rows was fixed. Left as noted: on a
  phone "Verify and close" is shown first but is still last in tab order.
- Not verified: a real phone, a tablet, a screen reader.
## 2026-10-22 — Release 1 polish E1: entry screens, hub and the app bar

- Why: task E1 in `docs/release-1.md` (PR #182), from Cal's 22 Oct ask for a
  top-notch UI on the engineer's phone and the office laptop. Not a
  `docs/tasks.json` task, so no status changed.
- Changed:
  - Hub (`/`): Leodis Compliance Management shows "Coming later" and is not a
    link, so nobody lands on its invented records. A phone that picked
    Compliance before is asked again from the home screen icon instead of
    being sent there. Decided by Claude (Cal's 14:11, 20 Oct); undone by
    putting the link back in `app/page.tsx`.
  - Entry screens on a phone fill the screen edge to edge rather than sitting
    in a framed card; "Put RELAY on your home screen" lines up with the text,
    has its own arrow and keeps the entry colours in dark mode; local sign-in
    loses its stray rule and reads plainer.
  - `/offline` uses the same layout as the other problem pages, with a button
    to what is on the phone (`/offline.html`).
  - App bar (`app/layout.tsx`): Sign out and the theme are two matching
    buttons outside the links. Below 1024px they sit beside RELAY and the
    links get an even grid below (was three or four ragged rows at 390px);
    48px targets. Sign out no longer shows the name and role (it is in the
    tooltip): at 900px the Admin's seven links ran under it.
  - Help "What's new" line.
- Verified: typecheck, `npm test` (146 + 581), build. Browser checks listed
  in the PR. Screenshots before/after at 390 light and dark and 1440 light:
  `/mnt/project-files/ui-review/release-1/E1/`. A fresh review found the
  overlap above and three smaller faults; all fixed.
- Not verified: a real phone, a home screen install.

## 2026-10-22 — Release 1 polish O2: a project's sheet and the projects pages

- Why: task O2 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch").
  Before and after screenshots at 1440 light and dark and 390 light (viewport
  and full) are in the project files under `ui-review/release-1/O2/`. Busy
  example data, 60 days, Office Manager.
- Found: the project sheet was one panel with every part inside it on the same
  colour, so its parts ran together (Cal, 21 Oct 12:59), the same fault O1
  fixed on the overview. The title sat in a boxed band under a "Projects ›
  Project" trail the Projects column already gives. The issue bar floated
  loose between the figures and Latest from site. The project's pages and its
  details had no heading. The project manager's email broke mid-word
  ("example.invali / d"). The register heading left "E" alone on a second
  line. On a phone the project's name appeared only in small capitals in the
  column band, and "And 2 more in the report" pushed the rest of its sentence
  onto a line of its own. `/projects` had two rules between the heading and
  the list (and two above the footnote); `/projects/[id]` had two rules under
  the name, its details three across with one left over, and a gold button the
  full width of a laptop.
- Changed: `ProjectsView.tsx` (ProjectSheet title without the trail, figures
  and bar in one `sheet-standing` block, headings "On this project" and
  "Project details"; the phone register starts with the project's name, its
  number and client); `workspace.css` new block at the end scoped to
  `.cols[data-depth="2"]`, `.project-title`, `.sheet-standing`,
  `.sheet-details`, `.register-name` and `.register-standing` (cards with
  `--line-2` edges on the sunken ground as O1 does, PM column widest, balanced
  register heading); new `app/projects/projects.css` scoped to
  `.project-list-page` and `.project-page` (one rule, details four across,
  button its own width above 700px, full width on a phone). No `globals.css`
  token changes, no shared component changed (`IssueRegister` untouched).
  Help "What's new" line.
- Decided (Claude): the "Details · 011LME" column band stays at depth 2 (it
  labels the column beside the register); O1 hid it only on the overview.
  Branched after O1 (#186) merged, as it changes the same two files.
- Left for lane E: the app bar on `/projects` at 390px wraps to three rows
  (it is `app/layout.tsx`, task E1).
- Checks: `verify-office-phone` read the register's whole name from the
  column band; it now reads it from the new name line (whole, unclipped,
  under the back link) and still checks the band says "Register · name" for
  screen readers (103 checks, was 99).
- Verified: typecheck, `npm test` (146 + 583), build. Browser, one at a time:
  office-phone (103), office-progress (84), office-links (65), home-and-sheet
  (254), office-landing (19), simpler-home (56), navigation (76),
  office-registers (225), sheet-figures-laptop (548), office-desk (73),
  office-sections (63), office-top-bar (1917), september-office (43),
  issue-figures (48), role-access (95), help (36), accessibility (584). A
  fresh-context review found five small things, all fixed (a 44px target for
  "And N more", the name twice on a phone, one selector not scoped to the
  sheet, Help wording).
- Not verified: a real phone, a tablet, a screen reader.

## 2026-10-22 — Reuse a recent SharePoint read (slow pages on engineer phones, part 1)

- Why: Cal finds pages slow on an engineer's phone, the Issues tab for one.
  Timed the engineer pages at 390px (4x slower processor, Fast 4G) on the
  live pilot's commit 03188ee and main 595e500 with the busy seed: both take
  1.5-3 s with that much data (part 2 is about the long lists), but that is
  the local store. On the pilot, which reads SharePoint, every request behind
  the Issues tab, an issue, the Site page, the snag list, search, photos, the
  diary and the summaries first read the whole Issue Tracker (and the
  Variation Register) from Microsoft Graph, 200 rows a request, one after
  another, before answering. Only the project list was reused (60 s). Main
  does the same, so it does not fix this.
- Changed: `lib/sharepoint/recentRead.ts`. A read of the Issue Tracker or the
  Variation Register is reused for 15 s; up to 10 minutes old the stored copy
  answers at once and a new read starts in the background; older than that, or
  before the first read, the page waits as before. Anything about to change a
  record (issue and variation POSTs, new variations, corrections) passes
  `force` and still waits for a new read, so the SharePoint ETag check is
  unchanged. The project list also answers from its copy up to 10 minutes old
  while it is read again, for pages only: anything that creates or changes a
  record (a defect, a report started, a variation, a note, permit, delivery
  or talk, and the issue and variation reads themselves) passes `current` and
  keeps the old 60 s ceiling, so a project closed in SharePoint is not written
  to from an old list (found by the fresh review). Help "What's new" line.
- Decided (Claude): 15 s and 10 minutes. RELAY's own changes go into the
  local store at once and a read never replaces one that has not been sent,
  so only edits made in SharePoint itself show a page or two later. No timer
  reading SharePoint when nobody is using RELAY.
- Verified: typecheck, `npm test` (146 + 587, 4 new in `recentRead.test.ts`).
  A model with a stand-in for Graph (every request 350 ms, 300 issues,
  scratch script, not committed): first open of the Site page 2.2 s both
  before and after; then Issues, an issue, back, Site, snag list each waited
  0.73-0.75 s before and 0-1 ms after.
- Not verified: the live tenant's real Graph timings, or that the pilot's
  `RELAY_SHAREPOINT_MODE` is read or write (its upgrade step talks to the
  Variation Register, so it is very likely on). Not deployed.

## 2026-10-22 — Home screen icon: full screen, no web address bar

- Why: Cal saved RELAY to his phone's home screen and it opens with a bar
  showing the web address. Part of Release 1 (`docs/release-1.md`, engineer
  phone). Not a `docs/tasks.json` task, so no status changed.
- Found: the live manifest (fetched from app.relaybyleodis.com on 22 Oct) is
  right: `display: standalone`, `scope: /`, icons 192 and 512 served as real
  PNGs without signing in. So the bar comes from one of three things on the
  phone's side: (1) the icon was saved as a plain shortcut (Android "Create
  shortcut", or Safari with "Open as Web App" off), which opens a browser tab;
  (2) Microsoft's sign-in is another web address, outside RELAY's scope, so the
  phone shows a bar with it while signing in (an iPhone can finish it in a
  browser sheet over RELAY); (3) Next.js 15 writes `appleWebApp.capable` only
  as `mobile-web-app-capable`, not Apple's own `apple-mobile-web-app-capable`
  that older iPhones look for.
- Changed: `layout.tsx` adds `apple-mobile-web-app-capable`. `middleware.ts`
  marks a visit to the icon's address (`/?open=app`) with a 5-minute cookie
  (`lib/homeScreen.ts`), only when opened directly (Sec-Fetch-Site "none"),
  so coming back to it from Microsoft's sign-in in a browser sheet over a
  properly installed app is not mistaken for a shortcut (fresh review); `IconOpensBrowser` reads it once and, if the page is
  not running full screen, says the icon opened the browser and how to add
  RELAY again (iPhone or Android words), until "Got it". It stays through a
  sign-in on the way in. The sign-in screen (`SignedInElsewhere`) carries on
  to where it was going once a session exists when it comes back into view.
  Install steps on the hub and sign-in say Install, not Create shortcut, and
  to leave Open as Web App on. Help "What's new" line.
- Decided (Claude): say it in the app rather than try to force full screen,
  because a shortcut cannot be turned into an app from the page. The 12-hour
  session was left alone: a longer one means fewer Microsoft sign-ins (and so
  fewer bars) but a lost phone stays signed in longer; that is Cal's call.
- Verified: typecheck, `npm test`, build, new `scripts/verify-home-screen.mjs`
  (23 checks: tags and manifest, not marked when coming from another site,
  note at 390 light/dark and 1440 on Android and
  iPhone words, none when full screen or typed in, cookie read once, through
  sign-in, sign-in carries on, stays put when still signed out). Full screen
  is imitated by answering the display-mode query, as Chromium 141 cannot act
  as an installed app. Screenshots in
  `ui-review/release-1/home-screen/`.
- Not verified: no real phone, so not which of the three causes Cal sees,
  nor an iPhone's sign-in sheet. Live only after the next deploy; an icon
  saved as a shortcut has to be removed and added again.

## 2026-10-22 — Release 1 polish O1: office top bar and overview

- Why: task O1 in `docs/release-1.md` (Cal, 22 Oct 10:02: UI "top notch" for
  the office and the phone). Before and after screenshots at 1440 light and
  dark, 1024 light and 390 light are in the project files under
  `ui-review/release-1/O1/`. Busy example data, 60 days.
- Found: the overview sat as one panel inside the column, with every section
  inside that panel on the same colour, so the sections ran together (Cal,
  21 Oct 12:59). A grey "Overview · Office" band repeated the Projects tab.
  The "Office position" block used about 100px for a title, the company name
  the top bar already shows, and the time. Up to eight gold Assign and Verify
  buttons on the first screen. In the top bar the theme button had a frame
  and nothing else did. On a phone the top bar took three rows (RELAY alone,
  then Attention, name and Help, then search).
- Changed (`workspace.css` new block at the end, its rules on classes only
  the overview and the office top bar use; `ProjectsView.tsx` OfficeSheet and
  the action lists):
  the overview's sections are cards with `--line-2` edges on the sunken
  ground; the column heading is kept for screen readers only (its text,
  "Overview", is what the landing checks read); the title is one line
  ("Office position · Updated ..." with the two buttons right); the list
  buttons are quiet (`BtnQ`); the top bar's controls share one height and
  frame, with a line before Help, Engineer view and Switch company; on a phone
  the company name beside RELAY is hidden, so name, Attention and Help share
  its row, and those three are 48px tall (narrower than 380px the name is
  cut shorter so they keep the row). The company name is then not shown on
  a phone's office desk; on a desk it stays in the top bar. No `globals.css` token changes, no shared component changed. The
  Attention bell, its list and "Also needs attention" are untouched (#154 is
  open on them). Help "What's new" line added.
- Verified: typecheck, `npm test` (146 + 581), build. Browser, one at a
  time: office-landing (19), office-phone (99), office-top-bar (1917),
  office-sections (63), office-desk (73), office-actions (46),
  office-registers (225), office-progress (84), office-links (65),
  september-office (43), simpler-home (56), today-from-site (62),
  not-seen-pile (58), home-and-sheet (254), navigation (76), seen-by-office
  (45), office-words (67), help (36), accessibility (584), busy-projects
  (39 timings within budget). No check needed changing.
- Not verified: a real phone, a tablet, a screen reader.
## 2026-10-22 — Defect receipt: "Fixed it already?"

- Why: the coordinator asked for a walk of an engineer at 390px who finds a
  small fault, fixes it there and then, and wants the office to know it was
  found and already fixed. On main bc864b8 Sam flagged it (Flag a defect, a
  photo, Send), then the receipt offered Back to Site, "Open issue" and "View
  project issues": nothing said "I fixed it already". The way was "Open
  issue", "Add photograph", "Put forward as fixed" on the issue page, which
  then said "Who is fixing it: Nobody yet. The office will say who." 6 taps
  from Site (7 with a Recent places chip). The domain already allows open to
  awaiting verification for exactly this (platform `transitions.ts`). Not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the engineer's job simpler, the office's view of progress clearer).
- Changed: the receipt (`IndividualDefect.tsx`, `FixedAlready`) has "Fixed it
  already? · Take a photo of the fix" straight under Back to Site. It opens
  the camera; then the photo, "Put forward as fixed" and "Add another photo"
  sit in one framed box. "No photo? Put forward as fixed" for a fix with
  nothing to photograph. It is the issue page's `submit_closure` (photos
  uploaded to the issue first, the issue's current etag read first), so the
  office gets it on its usual list to check with both photographs, and someone
  other than the engineer still closes it. The receipt then says "Put forward
  as fixed. The office will check it and close it. If it is not finished, it
  comes back to you." With no signal the photo stays and the words say so
  (and that it will only go once). Only the receipt's words are a live
  region, not its buttons, and focus moves to "Put forward as fixed" once a
  photo is taken.
  The engineer issue page's "Who is fixing it" names who put it forward as
  fixed ("Sam Sparks fixed it") instead of "Nobody yet" once it is waiting to
  be checked. A filled engineer button no longer turns grey under a mouse
  (the global button hover won). Help "What's new" line.
- Decided (Claude): on the receipt, not as a tick box on the defect form. The
  receipt only exists once the defect has reached RELAY, so a defect held with
  no signal never offers it (a held "fixed" would need its own retry path).
  Back to Site stays first: most defects are not fixed on the spot. No note is
  written for the engineer: the history shows it raised and put forward
  minutes apart by the same person, which is what the office reads.
- Verified: typecheck, `npm test` (146 + 578), build. New
  `scripts/verify-fixed-on-the-spot.mjs` (99 checks, 390 light and dark, 1440
  dark): the button under Back to Site; 5 taps from Site to put forward; a
  photo added, a second removed, the issue awaiting verification by the
  engineer with exactly one photo on the closure; the issue page names who
  fixed it; the no-photo way; no signal keeps the photo, changes nothing at the
  office, then goes once on a retry; focus after the photo; 48px targets; no sideways scroll; no page
  errors. `verify-receipt-send-bar` now counts the receipt's own buttons only.
- Not verified: a real phone's camera or real weak signal (files set in a
  phone-sized browser, offline simulated).
## 2026-10-22 — Real company address on report PDFs, no VAT number

- Why: Cal sent the company address and asked why a report needs the VAT
  number. It doesn't: a site report is not an invoice. Not a
  `docs/tasks.json` task.
- Changed: `branding.ts` address is Unit 3 Pool Business Park, Pool Road,
  Pool in Wharfedale, Otley LS21 1FD; `registrationLines` (the placeholder
  company and VAT numbers) removed with its rendering in `ReportDocument.tsx`.
  No branding placeholders are left. The #168 Help "What's new" line says so.
- Decided (Claude): the company number goes too, as we don't have the real
  one and a made-up number on an issued report is worse than none. It can be
  added back as one line in `branding.ts` if Cal wants it.
- Verified: `npm run typecheck`, `npm test`, `node scripts/verify-long-pdfs.mjs`,
  sample PDF first page looked at. Not verified: printed. Not live until the
  next deploy.

## 2026-10-22 — Release 1 defined

- Why: Cal asked to "define a first release point and work towards that with
  haste", with the UI on the engineer's phone and the office laptop top notch.
  Not a `docs/tasks.json` task, so no status changed.
- Changed: new `docs/release-1.md` (docs only). It says what Release 1 holds
  (the engineer's site update, defects, issues and inspections on a phone; the
  office overview, issues, inbox, coverage, weekly and month summary and PDFs
  on a laptop), what stays out or hidden (safety, permits and deliveries
  switched off; Compliance; Site information #28; email and SharePoint
  unchanged from the pilot), an exit checklist, and 14 small UI polish tasks
  in two lanes (E1-E7 engineer at 390px, O1-O7 office at 1440px, light and
  dark) that name their screens and files so two threads never overlap.
- Decided (Claude): #142 is needed for Release 1 (it fixes a known fault);
  #130 and #154 join only if Cal says "carry on" before the final check. The
  hub should show Compliance as "Coming later" rather than open sample data
  (task E1). PDFs are left to Cal's own PDF template thread. Shared colour
  tokens are not changed by polish tasks; shared components are restyled
  from the calling screen. Fresh review fixed screen gaps (/projects, report
  preview, the engineer's Reports and Issues views) and file names.
- Verified: `npm test` (581 pass) on main b387483 before writing. No code
  changed, so no browser checks were run.
- Next: the coordinator dispatches E1 and O1.

## 2026-10-22 — Sixteenth release check: "Put forward as fixed" on the first screen again

- Why: the sixteenth release check on main bc864b8 (#2-#179 minus #28, #130,
  #142, #154, #176) found `verify-office-words` failing at 390 light: an issue
  opened from "Came back from the office" with a long office note landed with
  "Put forward as fixed" at 860px of 844. #174 put the raised photograph in
  the facts; its landing step moved that row under the buttons only when the
  camera button would be off the screen, and measured before the office's
  note box had laid itself out (the box gains its "Show all of it" line in
  its own first layout, pushing the buttons down afterwards).
- Changed (`app/issues/[id]/page.tsx`, engineer view, `?update=1` only): the
  landing step runs on the next frame and judges by the button row, so the
  photograph moves under the buttons whenever "Put forward as fixed" would
  otherwise be off the first screen. Nothing else on the page changes; no
  Help line (it restores what #174's Help line already says).
- Verified: typecheck, `npm test` (146 + 578), build. Browser:
  office-words (67), came-back-to-update (36), issue-raised-photo (91),
  simpler-issue-page (76), sent-back-reason (22).
- Not verified: a real phone.

## 2026-10-22 — Month summary: figures that say what they count

- Why: the coordinator asked for every figure on the Weekly summary's Month
  choice (and its PDF) to be checked against counts taken straight from the
  stored records, on the busy example data, for a past month and this one
  (Tetley Hall, September 2026 and 1 to 22 October 2026, main 460e2b5). Every
  figure matched: days on site (22, 16), site reports (61, 42), issues raised
  (89, 66) and closed (71, 29), variations raised (19, 14) and instructed
  (18, 9), each week row, open (354, 390), past target (196, 222) and fixed,
  to check (110, 119) at the month's end. Two things read wrongly. The line
  under Site reports counted update cards ("42 · 89 progress updates"), bigger
  than the figure above it, and September's 61 held a first fix and a
  handover inspection without saying so. This month showed "Mon 26 Oct to
  Sat 31 Oct" as a row of noughts, which reads as a week nobody was on site,
  and this week's row ran to Sunday on a Thursday. Not a `docs/tasks.json`
  task, so no status changed. Within Cal's 21 Oct direction (the office's view
  of progress clearer).
- Changed (`lib/monthSummary.ts`, `MonthSheet.tsx`): `reportKinds` counts the
  month's site reports by type (site updates and the non-safety inspections),
  adding up to the figure; the line reads "59 site updates, 1 handover
  inspection, 1 first fix inspection", or "all site updates". While the month
  is going a week still to come has no row and this week's row ends today with
  "so far"; the note under the table says weeks still to come are not shown.
  A month that is over is unchanged. Help "What's new" line.
- Decided (Claude): if anything in a later week or later this week is dated
  after today (a visit date may be a day ahead), that week keeps its row and
  its full end, so the rows always add up to the month. The busy seed has two
  variation instructions dated 24 and 25 Oct (made five days after raising),
  so on it this week's row stays "to Sun 25 Oct"; the browser check's own
  data has none and shows "so far". Withdrawn issues stay counted under
  Issues raised (1 in September, 2 in October), as the Weekly summary counts
  them and tags them Withdrawn in the list; left alone.
- Verified: typecheck, `npm test` (146 + 583; two new unit tests: rows this
  month with and without something dated ahead, on a Monday and in a month
  that is over; the Site reports line by type adding up, safety left out).
  `verify-month-summary` (79, now also: no row after today, this week ends
  today with "so far", the note, "all site updates" on last month),
  `verify-month-print`, `verify-weekly-summary`, `verify-weekly-phone`,
  `verify-help` passed. The busy-seed walk again after the change: the same
  figures, the new line and no row for 26 to 31 Oct, 7 PDF pages as before.
  Screens and PDFs in /mnt/project-files/ui-review/month-figures/.
- Not verified: a real phone or printer.

## 2026-10-22 — Office issue sheet: everything open at the same place

- Why: the coordinator asked for a walk of an office person at 1440px on the
  busy example data answering "what's the state of Flat 12?" (main 9afbb1f;
  the seed has no Flat 12, so Flat 204 kitchen on Tetley Hall). The answer was
  there but split over three screens the office had to know about: the Issues
  register (choose the project, type the place: 31 open), Photographs (its own
  Find box) and Search (every project, open and closed together, 272 issues,
  and "flat" also finds "flats"). An issue's sheet gave its place as plain
  text; the engineer's issue page has had "Every open issue here" since #165,
  the office had nothing. Not a `docs/tasks.json` task, so no status changed.
  Within Cal's 21 Oct direction (the office's view of progress clearer).
- Changed: under an office issue sheet's title, "At Flat 204 kitchen: 31 open
  issues · Photographs". The count opens the Issues register on that project
  and place, both filled in (new route `#/issues/show/open/<project>/<place>`;
  the place is the fifth part, encoded, so Back from an issue comes back to the
  same list; the bare Issues tab still starts again from every project).
  Photographs opens `/photos` on that project with the place in Find, and its
  Back returns to the sheet. No place, no line; a place with nothing open says
  "no open issues". `openAtPlace`, `placeRegisterHash`, `placeFromRoute` in
  lib/issueQuery.ts. Help "What's new" line.
- Decided (Claude): counted by the register's own rule (every word of the
  place, any order, open issues on that project), so the number on the sheet
  is the number the register opens on; #165's inward place match was not used
  because the office lands in the register, which matches by words. The
  place is the engineer's typed text; no list of places (EXP-4). Photographs
  rather than a list of recent updates: Photographs already shows each visit's
  pictures at a place by day, and the report behind each is one click from
  there. Kept to the issue sheet; a report card's place was left for later.
- Also changed (from the fresh review): the register's Location (and Company)
  box matched a number inside a longer one, so "Flat 12" counted Flat 120 and
  Flat 212, and "Level 1" every Level 10. A number in the search now has to be
  a whole number in the field (`matchesWords`); words are still found inside
  longer words ("kitch" finds kitchen), and "Flat 2" still finds "Flat 2.04",
  as #165 counts it. The sheet's count and the register move together.
- Verified: typecheck, `npm test` (146 + 580, three new unit tests: whole numbers; the count
  equals `queryIssues` for five project/place pairs including another
  project's and an unknown place; the link keeps a slash inside the place and
  reads back). New `scripts/verify-issue-at-place.mjs` (38 checks, light and
  dark at 1440, light at 390 on the busy seed): the line's words and count
  against the seed, the register filled in and listing exactly those issues,
  Back from an issue keeps the place, the Issues tab clears it, Photographs
  with the place in Find and Back to the sheet, no line without a place, "no
  open issues" for a closed issue alone at its place, axe, no sideways scroll.
  Its axe run leaves out the project list's group headings, which fail colour
  contrast on main (already left out in verify-issue-figures; not touched
  here). Also passed: verify-issue-figures, -issue-register, -issues-here,
  -office-actions, -office-desk, -office-landing, -office-links,
  -office-phone, -office-registers, -office-sections, -photo-library, -help
  (failed once, passed alone), -accessibility, -role-access,
  -engineer-layout. verify-office-words fails at "light 390 long: Put forward
  as fixed still on the first screen" on the engineer's issue page, which
  this change does not touch; it fails the same way on main bc864b8.
  Screens in /mnt/project-files/ui-review/issue-at-place/.
- Not verified: a real phone or screen reader.

## 2026-10-22 — Site page: a defect not sent yet

- Why: the coordinator asked for a walk of an engineer's end of day at 390px
  on main 71e7f88, with one item saved with no signal, checking everything
  reached the office. Sam sent a site update, then flagged a defect with no
  signal: the defect screen said "Defect not sent yet", but once he tapped
  Site nothing showed it, and the "Flag a defect" button still said "sent
  straight away". A site update in the same state already says "Not sent yet"
  on the big button. Not a `docs/tasks.json` task, so no status changed.
  Within Cal's 21 Oct direction (the engineer's job simpler).
- Changed (`EngineerWorkspace.tsx`, engineer home only): while a defect the
  engineer tapped Send on is held on the phone (`heldDefectsToSend`), the
  current project's button reads "Defect not sent yet · Only on this phone,
  not at the office yet. Tap to see it." (caution colours) and opens the
  defect with "Try again" as before. A defect held on another listed project
  is one caution row under the buttons ("Defect not sent yet · Kirkstall Gate
  - Phase 2"), opening that project's defect. `sendHeldDefect` now fires
  `DEFECT_SETTLED_EVENT` whenever a send ends (by itself or a tap), so the
  Site page reads again then, on `storage` (another tab) and on coming back
  from the defect screen. Help "What's new" line.
- Decided (Claude): the button changes in place, like the site update's big
  button, rather than adding a new section, so nothing more is on screen. A
  defect written but never sent, or one RELAY refused and handed back to
  change, is not "waiting" and leaves the button as it was; the refusal
  already has its own red note. The words say "only on this phone, not at
  the office yet" rather than "goes by itself when there is signal": that is
  true whatever holds it up (no signal, RELAY closed, signed out, a missing
  photograph), and the defect screen gives the reason (review).
- Verified: typecheck, `npm test` (146 + 572), build. New
  `scripts/verify-defect-waiting-on-site.mjs` (99 checks, 390 light and dark,
  1440 dark: the button before, while waiting, after RELAY is opened again,
  and after it goes by itself; never-sent draft; another project's row and
  its link; Site tapped during a slow send, then the button goes back by
  itself; 48px targets; no sideways scroll). `verify-defect-send-on-signal`
  now waits for "Defect not sent yet" on the Site page (96 pass). Also
  passed: engineer-layout, engineer-day, came-back-first, home-and-sheet,
  receipt-send-bar, other-trade-defect, defect-recent-places, help,
  role-access, offline-capture, accessibility (584). defect-recent-places
  failed once on a timeout and passed alone on a rerun. Screens: project files
  `ui-review/defect-waiting/`.
- Not verified: a real phone or real weak signal (simulated offline and a
  blocked upload in a phone-sized browser).

## 2026-10-22 — Weekly summary: an earlier week's open issues as they stood

- Why: the coordinator asked for a walk of an office person at 1440 on the
  busy example data telling a client "how did this project go this week?"
  from the Weekly summary, project page and PDF. Wrong figure found: the
  summary's "Open now" was always today's, on every week. Tetley Hall's week
  of 1 June printed today said 390 open, 222 past target; at the end of that
  week it was 260 and 138. The Month summary already reads a past month at its
  end. The open figure was also only at the foot of the Issues section, below
  every report and issue row. Not a `docs/tasks.json` task, so no status
  changed. Within Cal's 21 Oct direction (the office's view of progress
  clearer).
- Changed: `periodSummary` (lib/weeklySummary.ts) gives `open` (was
  `openNow`) with `asOf`: the period's last day once it is over, else today.
  Today it is still `issueFigures`, so this week matches the project sheet;
  otherwise `isOpenOn`/`isLateOn`/`isToCheckOn` (lib/issueTrend.ts), the rules
  Issues over time and the Month use. The page says "Open at the end of the
  week (Sun 18 Oct)" on a week that is over, "Open now" on this week; the
  footnote says which. The Issues raised figure adds "· 390 open now" or
  "· 260 open on Sun 7 Jun" on desks and on paper. Help "What's new" line.
- Decided (Claude): on a phone the figure's open part is hidden (the open line
  under Issues stays), because the extra line pushed the second row of figures
  16px below the first screen that #150 keeps them on. On a week that is over,
  "fixed and waiting to be checked" is words, not the register link, since the
  register shows today's list. weeklySummary.ts now imports issueTrend.ts,
  which imports it back; both only call each other inside functions.
- Verified: `npm run typecheck`, `npm test` (146 + 573, new test for a past
  week's standing), build. Browser: verify-weekly-summary (46, new checks for
  last week at 390 and 1440, print, link vs words), weekly-phone (263),
  issue-figures (48), office-links (65), check-fixes (70),
  office-weekly-review (53), issue-trend (29), help (36), busy-home (35),
  role-access (95). Busy data figures looked at in a desktop browser
  (project files `ui-review/weekly-week-end/`). Not verified: a real phone or
  printer.
## 2026-10-22 — Site updates: the same trade's previous visit

- Why: the coordinator asked for a walk of an office person at 1440px opening
  one received site update and asking "what changed on this site since the
  last visit?" (busy example data, main 9a91c2b). The Inbox reader and the
  project's report view said who sent it and what it found, but nothing about
  when that trade was last there or what they said then: the office had to go
  back to the register and hunt for the earlier report by hand. Not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the office's view of progress clearer); nothing new asked of site.
- Changed: `tradeVisits` (lib/tradeVisits.ts) finds the same trade's site
  update before and after the one open, on the same project. Under a site
  update's title, a line "‹ Previous Electrical update here · Wed 21 Oct, the
  day before · Sam Spark · SPR-831" and, when there is a later one, "Next
  Electrical update here ›". Selecting one opens it in the same place (the
  Inbox reader stays in the Inbox, a project's report in the project). The
  first update says "None before this one". Help "What's new" line.
- Decided (Claude): counted as "Latest from site" counts (sent site updates
  only, a sent correction in place of what it corrects, inspections left out).
  The trade, not the person, because the office asks when Electrical was last
  there, whoever went; an update with no trade is matched to the same person.
  A report's own revisions are never its previous or next visit. Calendar days
  for the gap ("4 days before"), because that is how the office counts between
  visits. A side-by-side "what changed" comparison of cards was left out: card
  text is free-written, so matching cards would guess; opening the two updates
  is honest and one click.
- Also fixed (found by the new check's axe run, on main before this): in dark,
  the "Seen" tag on the picked Inbox row was 4.05:1 (washes stacked), now on
  the panel colour; on a phone with a report open, the Inbox heading is kept
  for screen readers (visually hidden) so "Reader" is not an orphan h3.
- Verified: typecheck, `npm test` (146 + 577, five new unit tests), build.
  New `scripts/verify-previous-trade-update.mjs` (44 checks, 1440 dark and
  390 light): the line's words against the hand-made records, stepping back
  and forward in the Inbox and in the project, a correction in place of what
  it corrects, an old revision stepping past its correction, another
  electrician counting, HVAC, a draft and an inspection skipped, no line on an
  inspection or a trade's only update, and after stepping, "‹ Inbox" (phone)
  or Back (desk) goes straight to the list (stepping in the Inbox replaces the
  open report rather than adding to history), axe, tap size, no sideways
  scroll. Also passed: verify-inbox-phone, -office-inbox, -office-progress,
  -office-inspection, -help, -accessibility, -role-access, -engineer-layout,
  -office-sections, -office-desk, -office-actions, -review-queue. A fresh
  review found no correctness bugs; its two small points (the open report is
  judged by its summary, as the others are; the phone Back) are fixed. A
  future visit date can show as Next (left: the visit date is the engineer's).
  The new check failed once on its first run after a build and passed three
  times after; not seen again.
  Walked on the busy seed at 1440 light and dark and 390.
- Not verified: a real phone or screen reader.

## 2026-10-22 — Gas Safe Register mark on report PDFs

- Why: Cal sent the Gas Safe Register logo pack after #168 put the CHAS,
  REFCOM and MCS marks in the PDF footer. Not a `docs/tasks.json` task.
- Changed: `packages/documents/assets/accreditation-gas-safe.png` (150 px
  high, 2 KB), listed fourth in `branding.ts` `accreditations` (upload
  order). The #168 Help "What's new" line now names it too.
- Verified: `npm run typecheck`, `npm test`, `node scripts/verify-long-pdfs.mjs`
  (all 10 pass), sample PDFs looked at: the four marks fit the footer strip,
  page counts unchanged. Not verified: printed on paper. Not live until the
  next deploy.

## 2026-10-22 — Issue page: the raised photograph near the top

- Why: the coordinator asked for a walk of the engineer's issue page at 390px
  on main 76fa669: an open issue, one the office sent back and one 30 days past
  its target. "Add photograph", "Put forward as fixed" and the office's reason
  were on the first screen in all three, but no photograph of the fault showed
  anywhere until History was opened and scrolled: on site that photograph is
  the quickest way to know which tray, socket or fitting is meant. The old
  issue also gave its target date without saying it had passed, which the
  office screens say since #157. Not a `docs/tasks.json` task, so no status
  changed. Within Cal's 21 Oct direction (the engineer's job simpler).
- Changed (`app/issues/[id]/page.tsx`, engineer view only): a "Photograph(s)"
  row under "Who is fixing it" with the raised photographs as 80px
  thumbnails; each opens a larger copy (`?variant=pdf`) in a new tab, as the
  office's Check a fix does; an older inline photo is shown, not linked.
  "Who is fixing it" adds ", N days past target" in red when past. History
  keeps everything as before. Help "What's new" line.
- Decided (Claude): opened from "Came back from the office" (`?update=1`)
  with a very long description, the row would push "Add photograph" off the
  landing screen (66px in `verify-came-back-to-update`'s longest case), so
  for that visit only the row moves just under the buttons. Thumbnails are
  80px, not 96px: at 96px the check's "long" case (a long description,
  not the longest) landed with "Put forward as fixed" 8px off the screen;
  at 80px it lands with both buttons in view and the row in place. Only the raised photographs, not later ones: those are
  fixes and updates, still in History.
- Verified: typecheck, `npm test` (146 + 569), build. New
  `scripts/verify-issue-raised-photo.mjs` (91 checks, light and dark at
  390x844: photograph, office reason and both buttons on the first screen;
  larger copy loads; inline photo not linked; no row without a photograph;
  days past target only when past; History still holds it; 48px buttons; axe
  on the facts; no sideways scroll; longest description from Came back keeps
  the camera in view; office page unchanged). Also passed: simpler-issue-page
  (76), came-back-to-update (36), sent-back-reason (22), fix-forward-next
  (73), sent-back-fix (29), issue-provenance (18), issue-assign (48),
  issues-here (63), help, accessibility (584), role-access (95),
  engineer-layout. Screens: project files `ui-review/issue-page-phone/`
  (before and after at 390 light, after dark, office 1440 dark).
- Not verified: a real phone; how a phone opens the larger copy in a new tab
  when installed to the home screen. Left as is (review): an unassigned issue
  with a past target date gets no "days past target", since a target is only
  set on assignment.
## 2026-10-22 — Site coverage: trades with no report yet this week

- Why: the coordinator asked for a per-site line on Site coverage naming the
  trades that reported there in the previous fortnight but have sent nothing
  this week, so the office can see "No P&H report yet this week" without
  reading fourteen columns of marks. Not a `docs/tasks.json` task, so no
  status changed. Within Cal's 21 Oct direction (the office's view of
  progress clearer); about progress reports, not people.
- Changed: `siteCoverage` (lib/siteCoverage.ts) gives each project
  `quietTrades`: the trades (Electrical, HVAC, P&H, as the marks use) with a
  sent report from that site in the 14 days before this Monday and none from
  Monday to today (London). Same records as the grid: sent only, a correction
  stands in for what it corrects, switched-off safety and tower inspections
  left out, reports with no trade ignored. `quietTradeWords` says it. Shown
  under the project name, in the key, and Help "What's new".
- Decided (Claude): always about today's week, and shown only on the
  fortnight that holds today, so an older fortnight never carries this week's
  words. Not on a Monday (nobody has had a working day yet, so every trade
  would be named). Not on defects liability sites (visits are occasional, as
  for "quiet"). Trade names in full in the line ("P&H", "Electrical"), as
  elsewhere in office words. The one-visit rule (#163, #172) does not change
  which trades reported, so the line reads the reports directly.
- Verified: typecheck, `npm test` (146 + 572, two new unit tests), build.
  New `scripts/verify-coverage-quiet-trades.mjs` (37 checks) runs two data
  sets on their own servers: a small hand-made one (a draft, an old report,
  a switched-off inspection and a defects liability site say nothing), and
  the busy seed with this week's 014LME P&H turned back into drafts. Every
  row's line is compared with a count made from the stored records, at 1440
  dark and 390 light, and an older fortnight shows no line. Screens: project
  files `ui-review/site-coverage/trades/`.
- Not verified: a real phone or screen reader.

## 2026-10-22 — Leodis logo and accreditation marks on report PDFs

- Why: Cal asked what the PDF template looks like, was shown examples with the
  dashed "LOGO" placeholder, and sent the Leodis Developments logo files
  (grey, light and a PSD). Not a `docs/tasks.json` task, so no status changed.
- Changed: `packages/documents/assets/leodis-developments-logo.png` (the grey
  logo, trimmed and scaled to 640 × 389, 128 colours, 39 KB) is drawn at the
  top left of page 1 at 82 × 50 pt, read from disk like the fonts.
  `branding.ts` now holds the logo file. Cal then sent CHAS, REFCOM F-Gas and
  MCS logo packs: `footer.ts` draws them (assets `accreditation-*.png`, 150 px
  high, 6-10 KB each, embedded once per PDF) at 28 pt high, each at its own
  width, in place of the four dashed frames. `verify-long-pdfs.mjs` treats
  images in the footer strip as page furniture (still checked for stretching)
  rather than photographs. The address, company and VAT numbers stay marked
  TODO. Help "What's new" line.
- Decided (Claude): marks in Cal's upload order (CHAS, REFCOM, MCS); MCS
  kept on its white square as supplied. The grey logo, because PDFs are white paper and the
  light version is white lettering for dark backgrounds. Sized to the logo's
  own proportions rather than the old 132 × 40 box, which would have shrunk it
  to an unreadable 25 pt high or stretched it.
- Verified: `npm run typecheck`, `npm test`, `node scripts/verify-long-pdfs.mjs`
  (all 10 worst-case PDFs pass), `scripts/render-sample-pdfs.mjs`: page counts
  unchanged, each PDF about 75 KB larger (logo and marks, each embedded once). Not
  verified: printed on paper; the weekly summary print has no logo (unchanged).
- Not live: the pilot runs 03188ee; this needs a deploy.

## 2026-10-22 — Site coverage: one mark for each person on site

- Why: the coordinator asked for a walk of an office manager using Site
  coverage to answer "which sites had nobody report this week, and which
  trades are missing?", at 1440 and 390px on main eb4b076, merged up to 76fa669 (busy example
  data and a small hand-made set). On the busy data, Hunslet Depot showed two
  "P&H" marks on Thu 22 Oct: one plumber, Pat Pipe, who sent a site update
  and a first fix inspection. That read as two plumbers on site, and it
  disagreed with the office overview, which since #163 counts one visit per
  person per day. The same thing showed on Kirkstall Gate, Thu 15 Oct. It
  also meant two "Elec" marks could not be told apart from one electrician
  sending two reports, the worry raised about the Team "This week" line
  (#159). Not a `docs/tasks.json` task, so no status changed. Within Cal's
  21 Oct direction (the office's view of progress clearer).
- Changed: `siteCoverage` (lib/siteCoverage.ts) gives one entry per person per
  day, a person known by sign-in or else by name, as `countVisits` does. It
  opens their site update (else their first report), and `references` lists
  every report they sent that day. On the page, the mark's label and title
  name the person and all their reports, the day reads "3 people on site",
  and the key says "Each mark is one person … so two Elec marks are two
  electricians". Help "What's new" line.
- Decided (Claude): no count or badge on a mark with more than one report,
  because a number on a mark would read as people again; the other reports
  are named on the mark and are one tap away on the report. The "which trades
  have not reported this week" line is left for a later task.
- Verified: typecheck, `npm test` (146 + 570, one new unit test, and the
  existing test's second engineer given their own sign-in), build. New
  `scripts/verify-coverage-one-mark.mjs` (17 checks): Sam's update and
  inspection are one mark opening the update and naming both, Jo (a second
  electrician) is a second Elec mark, at 1440 dark and 390 light, no
  sideways scroll. `verify-visits-this-week` (19) and `verify-help` pass.
  `verify-site-coverage` fails at "a draft is not a visit" on this branch and
  on main alike (the Thu-Sun test-data fault fixed in #142). Busy data after
  the change: Hunslet Thu 22 shows 3 marks for 3 people (was 4). Screens:
  project files `ui-review/site-coverage/` (before-busy, after-busy,
  after-small).
- Fresh review found: a mark could open the inspection when a person's two
  reports differed in name spacing or trade (now the site update is chosen
  within each person's reports), and the Help line claimed desktop light
  (now "light and dark" across the two widths). Both fixed, with the unit
  test covering the first.
- Not verified: a real phone or laptop, a screen reader.
- Next: under each active site, say which trades that reported earlier in
  the fortnight have not reported this week.
## 2026-10-22 — Fifteenth release check (main 54c7c93)

- Why: a full check of main before the next deploy, after #165 (issues by
  place), #166 (fixed, to check on Issues over time) and #167 (office desk
  order) merged. Last passed: 73b6d8d (#2-#157). #142 and #154 are not on
  main, so not checked.
- Ran on 54c7c93 (#2-#27, #29-#129, #131-#141, #143-#153, #155-#167):
  `npm ci`, typecheck, `npm test` (146 + 568), build, then all 121
  `scripts/verify-*.mjs` one after another. 118 passed.
  - `verify-undo-remove` and `verify-site-coverage` (Thursday to Sunday): the
    known faults PR #142 fixes (waiting on Cal); not fixed again here.
  - `verify-simpler-home`: with safety, permits and deliveries switched off
    (the default), office Help said "While safety, permits and deliveries
    are switched off, a weekly safety or tower inspection is no longer
    counted as a visit". The "A visit is one person on site on one day"
    line from #163 named the switched-off records. Fixed: that sentence is
    taken out, with the "14 visits this week" example after it, which only
    that sentence explained (a fresh review's point).
  - An earlier, stopped run on 4714a18 failed `verify-deliveries` once
    ("focus returns to Record a delivery"); it passed in the full run on
    54c7c93 and 3 of 3 runs alone. Recorded, not changed.
- With the fix on main eb4b076 (#169 merged after the check): typecheck,
  `npm test` (146 + 569), build, simpler-home, help, issue-assign,
  company-issues, role-access, issue-register and accessibility pass.
- Deploy: no new settings, packages, data change or offline store version
  (still `relay-public-v14`).
- Not verified: a real phone, tablet, printer or screen reader; a live
  tenant; Docker (no build change since the eleventh check).
- Next: once #142 merges, rerun `verify-undo-remove` and
  `verify-site-coverage`; then main is ready.
## 2026-10-22 — Flag a defect: trade in one tap

- Why: the walk in #169 found that on "Flag a defect" at 390px the trade
  starts as the engineer's own and changing it (an electrician flagging a
  plumber's leak as P&H) needs a native dropdown: open it, find P&H, close it.
  On a site update card the same question is four buttons, one tap. Not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the engineer's job simpler, fewer taps).
- Changed: `TradeChoice` in `ObservationEditor.tsx` is the card's existing
  four-button control (Electrical, HVAC, P&H, Other; 48px, `aria-pressed`),
  now used by the defect card and by `IndividualDefect.tsx` in place of the
  `<select>`. It still starts at the engineer's own trade, is held on the
  phone with the rest of the draft, and is disabled with the form while it
  sends. The hint also says what "Other" covers, as the card does. Help
  "What's new" line.
- Decided (Claude): reuse the card's control rather than a second copy, so
  the two stay the same; kept it in `ObservationEditor.tsx` beside
  `Suggestions`, which the defect form already borrows from there.
- Verified: typecheck, `npm test` (146 + 569), build. `verify-engineer-layout`
  now checks the four buttons, Electrical pressed at first, one tap to HVAC,
  and HVAC still pressed after a reload. `verify-other-trade-defect` (59)
  taps P&H instead of choosing it from a list and checks the buttons are 48px.
  Also passed: defect-recent-places (87), defect-send-on-signal (96),
  lighter-card (80), report-editor (58), came-back-to-update (36), help (36),
  role-access (95), accessibility (584). Screens: project files
  `ui-review/defect-trade/` (after: form, filled, no signal, sent at 390 light
  and dark and 1440 dark; before: copied from the #169 and #113 runs).
- Not verified: a real phone.
- Fresh review found no correctness gaps; it suggested plainer hint words and
  a hint for someone with no trade recorded ("Tap the trade whose work it
  is."), both taken.

## 2026-10-22 — Unassigned issues say whose work it is

- Why: the coordinator asked for a walk of an electrician flagging another
  trade's defect, then a check that the office sees whose it is. Walked at
  390px on main 4714a18 (rebased on 54c7c93, #167). Sam (Electrical) flagged a plumber's leak from "Flag a
  defect" in about 6 taps plus typing what was wrong. The trade starts as his
  own and needs a dropdown to change it to P&H (on a site update card it is
  one tap). On the office side, the overview's "Unassigned issues" row
  said only "Flat 2.04 kitchen · raised 22 Oct", with no trade. The Assign box
  did not give the trade either and offered every company on the project in
  A to Z order, so the office had to open the issue to see whose it was and then
  type or pick the company. Not a `docs/tasks.json` task, so no status
  changed. Within Cal's 21 Oct direction (the office's view clearer, with less
  work).
- Changed: the Unassigned row reads "Flat 2.04 kitchen · P&H · raised …"
  (`issueTradeWords` in `lib/snagList.ts`, now also used by the Issues
  register). The office desk's Assign box says "Trade: P&H" and, under
  "Already doing P&H work on this project", offers the companies the office
  has already put on P&H issues on this project as one-tap buttons. The issue
  page's "Who puts it right" offers the same companies as chips. This comes
  from `companiesByTrade` and `companiesForIssue` in `lib/suggestions.ts`, sent
  as `byTrade` by `/api/locations`: newest first, up to 3, only the trade
  the engineer chose (never the reporter's own trade), and placeholders like
  "TBC" are left out. A tap only fills Responsible. Help "What's new" line.
- Decided (Claude): a suggestion only, never auto-assigning (keeps clear of
  EXP-2 decision routing; the office still presses Assign). "Other /
  non-Leodis" offers no company, because it covers the main contractor and
  every other trade. The office desk reads the offer from the server
  rather than from the desk's own list, so `OfficeDesk.tsx` and `model.ts`
  (open PR #154) are not touched. The engineer's trade dropdown on "Flag a
  defect" was left for a later task.
- Verified: typecheck, `npm test` (146 + 569, one new unit test), build. New
  `scripts/verify-other-trade-defect.mjs` (56 checks). Sam flags the leak as
  P&H at 390px. Then the office at 1440 light and dark and 390 light: the Unassigned row
  names P&H, and an "Other" one says so. The desk's Assign box says the trade,
  offers only the plumber's company (not the electrician's), and starts
  empty. A tap fills Responsible and assigns nothing on its own. The issue
  page's chips do the same, are 48px on a phone, and "Who puts it right"
  says the trade. An "Other" defect gets no offer on either. Pressing Assign gives the issue to the plumber. No sideways scroll and no page errors.
  Screens: project files `ui-review/other-trade-defect/` (before, after).
- Not verified: a real phone or laptop.
- Fresh review found: "Who puts it right" named the trade only when it
  had a company to offer (now always), the Help line said one company when up
  to three are offered, and the "Other" check could pass before the companies
  had loaded and did not cover the desk (both fixed).
- Next: "Flag a defect" could use the site update card's one-tap trade
  buttons instead of the dropdown.

## 2026-10-22 — What needs the office, straight under the projects

- Why: the coordinator asked for a look at the office overview's first
  screen and whole page as an office manager starting the day, at 1440 and
  1024px on main 117df61 (busy and small example data). Once the day's site
  updates are in, "Today from site" (#143) shows every card open on the desk
  and runs to about 1,040px at 1440 and 1,210px at 1024, so "Not seen yet",
  "Unassigned issues" and "Fixed, to check" started about 1,770px and 2,020px
  down: two screens below the project list. Nothing on the page was repeated
  enough to cut (the project rows' "Needs action" is per project, the lists
  are the items), so the pick was order, not removal. Not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct
  direction (the office's view of progress clearer).
- Changed: `OfficeSheet` (ProjectsView.tsx) puts the three lists straight
  after "Where each project stands" and "Today from site" after them, on
  widths over 700px. On a phone the order stays as #147 left it (the day
  folded to its bars, then the lists), because the count tiles at the top
  already jump to the lists and the stacked lists are about 1,500px tall.
  Help "What's new" line; the Help guide's office paragraph gives the new
  order (and no longer mentions "new reports", a list removed in #101).
- Decided (Claude): reorder rather than fold the day's cards on the desk,
  because #143 built the open cards for the end-of-day read and nothing is
  lost by moving them under the lists.
- Verified: typecheck, `npm test` (146 + 562), build.
  `verify-today-from-site` (62 checks) now also checks, at 1440 light and
  dark, that the lists sit between Where each project stands and the day and
  start within the first 900px; its inspection is now a first fix one,
  because since #163 a safety inspection is not counted while the safety
  records are off, and the check failed on main at "Tetley Hall's day in one
  line". Screens: project files `ui-review/overview-first-screen/` (before,
  after; 1440, 1024 and 390, busy and small data).
- Not verified: a real laptop or phone; many more projects (a longer
  project list still pushes the lists down).
- Fresh review found: a check still looked for the old inspection's words,
  so proved nothing (fixed); the Help line claimed more than was checked
  (reworded); a phone briefly drew the desk order before the width was known
  (now neither section shows until it is).

## 2026-10-22 — Issues over time shows what is waiting for the office

- Why: a walk of an office manager at 1440px and 390px on main 117df61 (busy
  example data) using Issues over time to answer "are we getting on top of
  Tetley Hall's snags?". Every figure matched the records, the project sheet
  and the Weekly summary (390 open, 222 past target, 14 raised this week, 78
  raised and 37 closed over four weeks) and the page loaded in under half a
  second. The gap: the headline said "Getting longer: 390 open" but 119 of
  those were fixed by site and waiting for the office to check, drawn in grey
  with the issues still to do, so the office could not tell whether site or the
  office was behind. Coordinator's ask (walk and one pick); not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the office's view of progress clearer).
- Changed: `lib/issueTrend.ts` gives each week `toCheck` (the existing
  `isToCheckOn`, never past target as well) and `toCheckNow`.
  `IssueTrendPage`: the headline adds "119 of them are fixed and waiting for the
  office to check."; Open now says "119 fixed, to check"; each bar has a
  fixed, to check part (caution colour, as on the project sheet's bar) between past target and "Open, not late";
  the readout and a new table column carry it; the footer says what it means.
  On a phone the table's weeks read "19 Oct" on one line and each legend label
  stays with its colour. Help "What's new" line.
- Decided (Claude): "fixed, to check" uses the project sheet's words and rule
  (#128) rather than a new term; the headline's direction (fewer/more) is
  unchanged, because a fix only shortens the list once the office checks it.
- Verified: typecheck, `npm test` (146 + 562), build. New
  `scripts/verify-issue-trend-busy.mjs` (36 checks; busy seed, 1440px light and
  dark, 390px light): Open now, past target and fixed, to check equal the
  records and the project sheet; the headline, this week's row, bar and readout
  carry them; every week's parts fit inside its open; loads within 5 s; no
  sideways scroll; legend labels and phone week names on one line. Fails on
  main at Open now. `verify-issue-figures` (48) now also checks the trend's
  headline, row and bar; `verify-issue-trend` (29) reads the new column. Also
  passed: month-summary, accessibility, help, role-access, busy-projects (39
  timings within budget). Screens: project files
  `ui-review/issues-over-time/` (before, after).
- Not verified: a real phone or laptop; a printer.
- Fresh review found: the green first used for fixed, to check disagreed with
  the project sheet's amber (now amber); the busy check did not prove the
  table fits inside its box at 390px (added); a bar part could go negative
  on bad data (clamped).

## 2026-10-22 — The office's reason reaches whoever is fixing it

- Why: the "What the office asked" walk (PR #162) found that when the office
  sends a fix back as "Not finished" with a reason, only the engineer who
  raised the issue saw it at the top of the issue and on the home. Confirmed
  at 390px on main b0d389f: Pat, an electrician who put Sam's socket fix
  forward, had "Nothing on this project yet" under Came back from the office
  (the only sign was "Reopened · Your trade" under Since your last visit,
  without the reason), and the issue page had no box: the reason was only in
  History. Coordinator's ask; not a `docs/tasks.json` task, so no status
  changed. Within Cal's 21 Oct direction (the engineer's job simpler).
- Changed: the issue page shows the office's words box (`OfficeWordBox`) to
  whoever the issue is theirs to see to, the same rule as Issues "Yours"
  (`isYours`: their trade, or worked on it), not only the raiser. For them
  it shows only the "Not finished" reason (`lib/cameBack.ts` `sentBackWord`)
  while it stands: their own event, anyone putting it forward again, a check
  or handing it to another company ends it (a new target date does not);
  a reopen of a checked and closed issue is not a send-back; other notes
  stay for the raiser. Issues "Yours" uses the same rule for someone else's
  issue (it showed any office note, and kept "Sent back" after someone
  else put it forward again). `sentBackToYou`
  / `cameBackIssue`: Came back from the office (this site and other sites)
  also lists an issue the engineer put forward that the office sent back,
  with "you put it forward" and the day instead of "you raised it". The
  raiser's rules are unchanged. Help "What's new" line.
- Decided (Claude): no new access. Every engineer who can open the issue
  could already read the reason in History; the box only moves it up for
  those it is meant for. Another trade still finds it in History. The home
  lists only the one who put the fix forward, not the whole trade, so a
  trade's home does not fill with others' issues; the same trade sees it on
  the issue and first under Issues "Yours" (which already carried it).
  A fresh review found the first cut let a stale reason stay after someone
  else put it forward again or it was reassigned, and showed any office note
  to the same trade; both fixed. A second review found a new target date
  cleared it, a reopened closed issue counted, and the Yours list still
  showed any note; all fixed and unit-tested. A third found a company named
  on the report (no assignment event) lost the reason at a new target date;
  fixed: the first company named since is then the baseline (so a hand-over
  in that one case keeps the reason; accepted). Known, not changed: the
  home's server cut to six newest before sorting (as before #162).
- Verified: typecheck, `npm test` (146 + 560, one new unit test), build. New
  `scripts/verify-sent-back-reason.mjs` (22 checks): Pat at 1440 dark and
  390 light (the reason above Put forward on the first screen, the home row,
  4 taps to put it forward again, then box and row go); Lee (same trade, not
  involved) sees the box but no home row; Pete (another trade) sees no box;
  Sam as before; a fix waiting on the office is not on Pat's home; axe on the
  box; no sideways scroll; no page errors. Also passed: office-words,
  sent-back-fix, came-back-to-update, busy-projects, engineer-layout,
  role-access (95 HTTP checks), help, fix-forward-next, issues-yours,
  simpler-issue-list, day-walkthrough.
  Screens: project files `ui-review/sent-back-reason/` (before/, after/).
- Not verified: a real phone.

## 2026-10-22 — Every open issue where the engineer is standing

- Why: a walk at 390px on main d6ce82d with Sam (busy seed, Tetley Hall:
  390 open issues across 15 places) standing in one flat and wanting every
  open issue there, his and other trades', to fix or check. Issues → Open was
  one list 89,503px long, and Flat 204 kitchen's 31 issues were spread from
  5,757px to 86,411px down. Yours listed 616 cards, only his. Search for
  "Flat 204" mixed in another site and closed issues and stopped at 25. The
  Snag list groups by place, but Flat 204 kitchen started 11,606px down (all
  trades). Coordinator's ask (walk and one pick); not a `docs/tasks.json`
  task, so no status changed. Within Cal's 21 Oct direction (fewer taps,
  less on screen for engineers).
- Changed: on Issues → Open or All issues for one project, "Where are you?"
  lists the places typed on the issues shown, each with its count, after
  "Every place (390)". Picking one lists only the issues at that place (or a
  smaller place inside it, at word edges, so "Flat 204" brings in "Flat 204
  kitchen", never "Flat 2041"; "Flat 204 kitchen" does not bring in "Flat
  204" or every "Kitchen"), from every trade, under
  "Tetley Hall - Block E · Flat 204 kitchen · 31 open". The place is kept in
  the address, so Back from an issue returns to it; All issues keeps it; Yours,
  All projects and changing project drop it. An engineer's issue page has
  an "Every open issue here" row under "Update this issue" (not beside Where:
  that pushed the buttons off the first screen), opening that list. New
  `lib/issuePlaces.ts` (with tests); `EngineerWorkspace.tsx`,
  `app/engineer/page.tsx`, `app/issues/[id]/page.tsx`, `engineer.css`. Help
  "What's new" line.
- Decided (Claude): places come only from what people typed on the issues
  (no location list, EXP-4), one per place however it was typed, in the
  spelling used most and natural order. No choice on All projects, where two
  sites can both have a "Plant room". A place from a link with nothing open
  stays chosen, and the list says "No open issues at …" rather than
  quietly showing everything.
- Verified: typecheck, `npm test` (146 + 562), build. New
  `scripts/verify-issues-here.mjs` (63 checks, 390px light and dark, 1440px
  dark, busy seed): Issues, Open, the place in three taps; the choices and
  counts equal `issuePlaces`; exactly the 31 open issues at Flat 204 kitchen,
  from more than one engineer; 7,905px instead of 89,503px at 390px; Back
  from an issue, All issues, All projects, Yours; "Every open issue here";
  a place typed in another case or spacing; a place with none open; 48px
  controls, no sideways scroll, axe, no page errors. Fresh review: fixed its
  points (a place listed bigger places and every bare "Kitchen" too; the
  count beside a place with none typed said 0; heading words; a place in the
  address with Yours or All projects). Screens: project files
  `ui-review/issues-here/before|after`.
- Not verified: a real phone; a screen reader.
- Next: none from this walk. Possible later: the same choice on the Snag
  list, which already groups by place.
## 2026-10-22 — A visit is one person on site on one day

- Why: a walk of an office manager at 1440px on main 172c277 (busy example
  data) opening Tetley Hall from the overview to answer "how's this job
  going?". Checked against the records: the overview's This week and the
  project's Last visit said 13 or 14 visits (two seeds), the Weekly summary
  for the same week 11 site reports on 4 days. The records were 11 site
  updates and 3 safety and tower inspections, each sent by someone who also
  sent an update that day, so one engineer on site for a day counted twice,
  and the Weekly summary leaves those inspections out while the safety
  records are switched off. Also: the Project page header said "124 fixed, to
  check" where the project's figure said 119 (it counted withdrawn issues).
  Coordinator's ask (walk and one pick, with the second fix if small); not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the office's view of progress clearer).
- Changed: `lib/visits.ts` `countVisits` (one person, by sign-in or name, on
  one visit day) used by `projectStanding` (overview This week, Last visit's
  "N visits this week") and `weeklySummary` (new `visits`; Site reports now
  reads "11 visits over 4 days" under the report count). With the safety
  records switched off, `projectStanding` leaves out weekly safety and tower
  inspections, as the Weekly summary does (`projectStats` and `OfficeDesk`
  pass the switch); first fix and handover inspections still count. Site
  coverage (`api/site-coverage`) leaves them out too while switched off, so
  its last visit and quiet sites agree with the office's.
  `IssueRegister` (Project page): "fixed, to check" and Closed leave withdrawn
  issues out, as `lib/officeActions.ts` does; withdrawn issues stay under All.
  Help "What's new" line.
- Decided (Claude): a visit is a person-day, not a report, because the
  office's question is who was on site; the Weekly summary keeps its report
  count as the big figure (it lists reports) and gives visits under it.
- Verified: typecheck, `npm test` (146 + 561), build. New
  `scripts/verify-visits-this-week.mjs` (19 checks; busy seed plus a first fix
  inspection on the day of a site update and a tower inspection alone from a
  new person today; 1440px light and dark): that tower inspection is neither a
  visit nor today's Last visit; overview,
  project sheet and Weekly summary give the same visits as the records'
  people-days, fewer than the reports; Weekly still counts every report;
  Project page's fixed, to check and Closed equal the records without
  withdrawn issues. On main it fails at the first figure (13 visits for 11).
  Screens: project files `ui-review/project-page/` (before, after).
  `verify-office-progress` now expects 2 visits for Tetley Hall (Sam's
  update, its correction and his safety inspection are one visit) and names
  in the new order; `verify-weekly-phone` reads "N visits over D days". Also
  passed: issue-figures, office-weekly-review, weekly-summary, office-actions,
  team-last-sent, snag-list, first-time-use, month-summary, office-landing,
  help, role-access, engineer-layout, sheet-figures-laptop, office-desk,
  day-walkthrough, busy-home. `verify-site-coverage` fails at "a draft is not
  a visit", the known Thursday-to-Sunday fault in the check that PR #142
  fixes; not changed here.
- Not verified: a real laptop; the switch turned on (then the inspections
  count as visits everywhere, as before).
- Fresh review found: Site coverage would disagree with the office on last
  visit and quiet sites (fixed as above); the check did not prove the switch
  part (tower-only visit added); Help gave the wrong cause for "14 against
  11" (reworded); the Weekly summary could count a visit dated tomorrow
  (visits now up to today, as the overview).
## 2026-10-22 — What the office asked, when a sent-back fix comes in again

- Why: a walk at 390px on main 172c277 with Sam, whose socket fix the office
  marked "Not finished" ("the back box is still loose, send a photo with the
  plate off"). The engineer side was already short: the home's Came back row
  carries the office's words, one tap opens the issue with the reason above
  the buttons, then photo, note and Put forward: 4 taps, none to cut. The gap
  was the office: the second attempt's Check this fix window looked like a
  first attempt, with no sign it had been sent back or what was asked, and
  the Fixed, to check rows did not say "again". Whoever checks it (often not
  who sent it back) could not check the new photo against the ask.
  Coordinator's ask (walk and one pick); not a `docs/tasks.json` task, so no
  status changed. Within Cal's 21 Oct direction (the office's view of
  progress clearer).
- Changed: `lib/checkFix.ts` `sentBackBefore` (who sent it back last, when,
  the reason, how many times since it was last verified) and `againWords`.
  The check window says "Sent back by Jo Office on Wed 21 Oct, 11:00: “…”"
  above the engineer's note (once the full issue has loaded); the overview's
  Fixed, to check rows and Attention say "put forward again" (or "put forward
  3 times"); the office issue sheet's "Closure submitted" note says the same.
  `deskIssue` now keeps a waiting fix's put forward / sent back / verified
  events (notes and photos still stripped) instead of only the latest put
  forward, so the desk can tell. Help "What's new" line.
- Decided (Claude): count send-backs only since the last verified close, so
  an issue reopened as a new defect starts again; show the reason above the
  engineer's note because it is the question the note answers; no change on
  the engineer side, which the walk found already minimal.
- Verified: typecheck, `npm test` (146 + 559), build. New
  `scripts/verify-sent-back-fix.mjs` (29 checks): the engineer's walk (4
  taps, reason above Put forward on the first screen, the new photo on the
  server); for a manager who did not send it back, at 1440 dark and 390
  light, the overview row, Attention, the window (reason before their note,
  the new photo not the first) and the issue sheet; a first attempt says none
  of it; axe on the window; no sideways scroll; no page errors. Also passed:
  check-fixes, fix-waiting, busy-projects, office-top-bar, help,
  office-actions, issue-figures, issue-register, came-back-to-update,
  fix-forward-next, office-words. Screens: project files
  `ui-review/sent-back-fix/` (before, and after/).
- Not verified: a real phone.
- Next: an engineer who fixes an issue someone else raised (same trade) sees
  it under Issues "Yours" but not the office's reason on the issue page
  (the word box is for the raiser only); worth a look.

## 2026-10-22 — An inspection shows what needs action first in the office

- Why: a walk of an office manager at 1440px and 390px on main 79f39c9
  reading a handover inspection that had just come in (12 checks: 3 action
  needed, 1 not applicable; a first fix inspection with none beside it), in
  the Inbox, the reader and the Full report / PDF. Figures agree with the
  records: the Inbox's "3 actions" and "no actions", the reader's three
  actions and their issues ISS-001 to 003, the PDF's actions arising. No
  wrong number found. But the reader then listed all 12 checks alike, each
  with Quick actions and "0 photographs", so the three failures sat among
  eight satisfactory rows (3,596px on a phone) with no line saying how the
  inspection went, and "Not applicable" ran into its check's text.
  Coordinator's ask (walk and one pick); not a `docs/tasks.json` task, so no
  status changed. Within Cal's 21 Oct direction (the office's view clearer).
- Changed (`ReportReader` in `office/ProjectsView.tsx`, `workspace.css`):
  under "Inspection results" a tally line ("3 need action · 8 satisfactory ·
  1 not applicable", or "No actions · …"); checks needing action listed
  first, in checklist order; satisfactory and not applicable checks fold
  under one button ("Show the 8 satisfactory and 1 not applicable checks",
  aria-expanded), closed again for each report. A passing check with a
  correction (an office note) stays above the fold with its change log. The
  answer tag wraps in its column. Breadcrumb links are underlined (axe
  link-in-text-block failed on the reader's "Tetley Hall" crumb). Site
  updates, the PDF and Full report are unchanged. Help "What's new" line.
- Decided (Claude): fold rather than drop the passing checks, so the office
  can still read or note on any of them; the heading keeps "12 checks".
- Verified: typecheck, `npm test`, build. New
  `scripts/verify-office-inspection.mjs` (66 checks, 1440px light and dark,
  390px light): tally equals the answers; only the three action checks with
  their issues before the fold; the button's words and aria-expanded; nine
  in order when opened; "Not applicable" does not overlap; a note on a
  satisfactory check keeps it in view after a reload (7 + 1 folded); a clean
  first fix inspection says No actions and folds all 12; axe on the reader;
  no sideways scroll. Also passed: handover-, first-fix- and
  tower-inspection, report-types, office-inbox, inbox-phone, accessibility,
  help, role-access, engineer-layout, office-sections, safety-actions.
  Fresh review: no reader bugs; fixed its three points (a reload check now
  waits for the corrections; Hide closes an open Quick actions on a folded
  check; an unanswered check on an old record is counted "not answered").
  Screens: project files
  `ui-review/office-inspection/before|after`.
- Not verified: a real phone; a screen reader.
- Next: none from this walk.

## 2026-10-22 — The office's questions before saved drafts on the engineer home

- Why: a walk at 390px on main 73b6d8d with Sam (busy seed, Thursday): three
  sites, a site update left as a draft on each from Tuesday, five fixes the
  office sent back with a question across the three sites, a report returned
  for changes. "Start today's site update" sat at 350px, but "Came back from
  the office" started at 959px and its first row at 997px, under the first
  screen (775px above the bottom bar). Three full rows of drafts saved to
  RELAY (about 330px) came first. Further down, Since your last visit lists
  other trades' issues and variations at length (left alone: below the
  office's questions). Coordinator's ask (walk and one pick); not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the engineer's job simpler, less on screen).
- Changed (`EngineerWorkspace.tsx`, `engineer.css`): Unfinished reports splits
  into what could be lost (started with no signal, edits only on this phone,
  signed or waiting to send, refused) and drafts saved to RELAY. With nothing
  at risk the section goes under Came back from the office, and two or more
  saved drafts fold into one line ("3 drafts saved to RELAY · Visit Tue 20 Oct
  · 3 sites · open to carry on"); one is listed as before. With anything at
  risk the section stays above the office's questions, those rows in full,
  the saved ones folded under "N more drafts, saved to RELAY". Nothing is
  removed. The section waits until the phone's own copies are read (a moment),
  so it does not draw under Came back and then jump above it; a copy the
  server did not list still waits for the server's answer, as before. Help
  "What's new" line.
- Decided (Claude): fold only what the server already holds, so a draft that
  could be lost is never one tap away; keep one section and one heading so it
  is still "Unfinished reports" wherever it sits. No count beside the heading
  when everything is in the fold (the line says it).
- Verified: typecheck, `npm test` (146 + 557), build. New
  `scripts/verify-busy-home.mjs` (35 checks; busy seed; 390px light, 1440px
  dark, and 390px with one waiting to send): the office's first question down
  to its words is on the first screen (now from 605px); the fold says three
  drafts, three sites, opens to all three and each opens its report; with one
  waiting to send it is listed in full above Came back and the other two fold;
  48px rows, no sideways scroll, axe. `verify-unfinished-reports` and
  `verify-offline-capture` updated for the fold and the at-risk order (they
  passed on main as they were). Also passed: engineer-day, old-drafts, home-and-sheet,
  came-back-first, simpler-home, send-on-signal, engineer-layout, and the
  checks listed in the PR. Screens: project files `ui-review/busy-home/`
  (before and after).
- Fresh review found: the new check failing on a Tuesday or some Wednesdays
  (the seed's drafts), a check that let an at-risk row hide, the section
  jumping once the phone's copies load, and Help leaving out a refused report.
  All fixed. Known limit: a copy only on this phone that the server did not
  list (seen when the server cannot be asked) still appears a moment later and
  can move the section above Came back.
- Not verified: a real phone.
- Next: Since your last visit is long on a busy site (other trades' issues
  and variations); worth a walk of its own.
## 2026-10-22 — Fourteenth release check (main 993445f, then 73b6d8d)

- Why: a full check of main before the next deploy. Last passed: 6def5e8
  (#2-#126). #154 (Attention kind by kind) and #142 (phone Undo focus) are
  not on main, so not checked. No app change.
- Ran: `npm ci`, typecheck, `npm test` (146 + 554), build, then all 112
  `scripts/verify-*.mjs` one after another. 109 passed first time.
  - `verify-undo-remove`: focus does not move to Undo after a card is removed
    on a phone. Known fault from the thirteenth check, fixed by PR #142
    (waiting on Cal); not fixed again here.
  - `verify-site-coverage`: "a draft is not a visit" failed on every run.
    The check, not the app: its quiet site's last report (today minus 10
    days) falls inside the fortnight from Thursday to Sunday. PR #142 already
    fixes this line of the check, so it is not changed here.
  - `verify-editor-wide` timed out once waiting for a new inspection to
    open; passed 5 reruns alone. Not reproduced, so recorded, not changed.
- Then #156 and #157 merged, so everything ran again on main 73b6d8d:
  typecheck, `npm test` (146 + 557), build, all 113 browser checks. 110
  passed; undo-remove and site-coverage as above, and `verify-month-summary`
  once read the tab title before it changed to "Monthly summary" (the title
  follows the page a moment after a client-side move to another month). It
  passed alone twice. The check now waits up to 5 s for the title; passes
  3 of 3. No app change.
- Deploy: no new settings, packages, data change or offline store version
  (still `relay-public-v14`). One new read-only route, `/api/monthly-summary`.
- Not verified: a real phone, tablet, printer or screen reader; a live tenant.
- Next: once #142 merges, rerun `verify-undo-remove` and `verify-site-coverage`;
  then main is ready.
  #159 (Team tab, merged after) was not in this run; its own checks plus
  team-last-sent, role-access, help, office-desk, month-summary and
  engineer-layout pass on main with it.

## 2026-10-22 — The Team tab says who has sent updates this week

- Why: a walk of an office manager at 1440px on main e3138df (busy seed, its
  three engineers put on the list) answering "which engineers have been on
  site and sent updates this week, and which sites have gone quiet?". The
  figures agree with the records: each person's Last sent, each project's
  "This week" visits (13, 14, 14), Site coverage's "Reported today 2 of 2"
  and "Gone quiet 0". But Team showed only someone's latest report, so an
  engineer who reported from three sites today read as one, and Site
  coverage marks reports by trade only (the real list has five
  electricians), so the question took hovering over chips. Also, someone
  signed in but not on the list dropped off Team once their session ended,
  with their updates. Coordinator's ask (walk and one pick); not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the office's view of progress clearer).
- Changed: `lib/teamActivity.ts` adds `sentThisWeekByAuthor` (sent reports by
  visit day, Monday to today, London, and their sites), `weekOf` (across a
  person's accounts) and `thisWeekWords` ("This week: Mon, Tue, today · 3
  sites", "Nothing sent this week"). `/api/office/team` returns `thisWeek`
  and lists accounts off the checklist with no session whose latest sent
  report is for a visit in the last 14 days (role read from that report's
  trade). `TeamAdmin.tsx` shows the line under Last sent on the Manager's and
  Admin's lists. Help "What's new" line.
- Decided (Claude): days and site count, not report counts or times, so it
  reads as reporting, not hours; no line for someone who has never sent. A
  list left open into a new week drops last week's days (fresh review). The
  fortnight limit keeps old development or departed accounts off the list.
- Verified: typecheck, `npm test` (146 + 556, one new unit test), build.
  `scripts/verify-team-last-sent.mjs` now 90 checks (week line before and
  after new reports, none for someone who sent nothing, an off-list account
  kept, one last sent three weeks ago left off). Also ran: help,
  role-access, accessibility. Screens: project files `ui-review/team-week/`.
- Not verified: a real phone; the live roster.
- Seen, not changed: Site coverage's Last report names one person when
  several reported that day (left alone in #118); "visits" on the overview
  counts reports, so a site update and an inspection on one day are two.
- Next: none from this walk.

## 2026-10-22 — Late issues say how late, and old dates say their year

- Why: PR #156 found Before handover tagging a snag due last November "Past
  target Fri 7 Nov", which on 22 Oct reads as two weeks away. Coordinator's
  ask: sweep every office and engineer screen and printout on main e3138df
  for dates with no year that may not be this year, and late items shown as a
  date instead of "N days past target". Not a `docs/tasks.json` task, so no
  status changed. Within Cal's 21 Oct direction (the office's view of
  progress clearer).
- Found: three helpers wrote a day with no year whatever its year:
  `dayLabel` (`lib/myWeek.ts`; My week, Issues over time, Before handover's
  "As of", Safety actions), `fmtDay` in `summaryRows.tsx` (every row on the
  Weekly and Month summaries) and in `SiteCoveragePage.tsx` (a site's last
  report). Late issues were "Nd late" on the office Issues list, "N days late"
  on the Month summary, "Past target" with no figure on the snag list and
  nothing at all on the issue page; the issue sheet said "1 days past
  target". Everything else already used
  `lib/dates.ts` with the year added when it is not this year; the report PDF
  always prints the year.
- Changed: `lib/dates.ts` gains `daysBetween` and `pastTarget` ("1 day past
  target", "366 days past target"). `dayLabel` is now written by `dayShort`
  and `dayLong`, adding the year when it is not this year; the two `fmtDay`s
  default to the same. My week's range (page and copied text) comes from a
  new `weekRange`: the year once at the end, and at the start too when the
  week spans New Year ("Mon 29 Dec 2025 to Sun 4 Jan 2026"); the copied
  text's day lines leave the year to that heading. Late issues say
  `pastTarget` on the office Issues list (allowed to wrap in its cell),
  issue sheet, project figures ("oldest …"), the snag list, the Month
  summary (rows and the printed "And N more" line) and the issue page (office view, beside the target date; not for a
  fix waiting to be checked, as on every other count). Issues over time keeps
  "12 Oct" under its chart: the weeks run in order up to Now. Check fixes
  keeps its ", N days past": everything on it is a fix waiting to be checked,
  which RELAY never counts as past target. `myWeek` unit tests no longer
  assume the year they were written in. Help "What's new" line.
- Decided (Claude): the year only when it is not this year, as `lib/dates.ts`
  already does everywhere else, rather than always, so this year's pages read
  as before. Not changed, because open PR #154 (Attention, waiting on Cal)
  edits `office/model.ts`: the work tag "Nd overdue" on the office Issues list
  and issue sheet and the Attention line's tag. They give a number, not a
  date, so nothing reads as still to come; worth "N days past target" once
  #154 is settled. Compliance screens (separate demo) not touched. A fresh
  review found Check fixes calling a fix to check "past target", unit tests
  that would fail from 1 Jan 2027, a loose register check and a printed
  "days late"; all fixed.
- Verified: typecheck, `npm test` (146 + 557, two new `dates` unit tests and `weekRange` cases:
  last year's day with its year, this year's without; days across the year
  end and the clocks changing), build. New `scripts/verify-dates-with-year.mjs`
  (33 checks, 1440px dark and 390px light): an issue 366 days late says so with
  its target's year on the register, issue sheet, project figures, issue page,
  snag list and Month summary; one a day late says "1 day past target"; one due
  next year shows its year and is not late; a fix to check is never called past
  target; a week a year back on the Weekly summary and My week has its year on
  every day; Issues over time gives the oldest issue's year. On main it fails at
  its first check ("366d late"). Also passed: issues-laptop, month-summary,
  office-weekly-review, my-week, issue-trend, site-coverage, before-handover,
  check-fixes, issue-figures, help, role-access, accessibility.
  `verify-site-coverage` fails at "a draft is not a visit", the same on main
  e3138df without this change (not looked into here).
- Not verified: a real phone or printer; a page left open over New Year.
- Next: "N days past target" on the work tag and Attention once #154 is
  settled.

## 2026-10-22 — Before handover says how late each snag is

- Why: a walk of an office manager at 1440px on main 993445f (busy seed,
  Tetley Hall) deciding whether a block nearing handover is ready. The page's
  figures agree with the office overview (390 open issues, 222 past target,
  119 to check, 103 variations, 31 done but not instructed). But each late
  snag said "Past target" and a date with no year: 58 of the 222 had a target
  last year, so "Past target Tue 21 Oct" was really a year and a day late, and
  33 read as dates still to come ("Past target Fri 7 Nov" on 22 Oct). Nobody
  could tell from the page what had sat for a year. Coordinator's ask (walk
  and one pick); not a `docs/tasks.json` task, so no status changed. Within
  Cal's 21 Oct direction (the office's view of progress clearer).
- Changed: `lib/beforeHandover.ts` gives each row `daysLate` (whole days past
  its target when overdue, otherwise 0). `BeforeHandoverPage.tsx` tags a late
  snag "349 days past target", the words the office issue sheet uses; future
  targets and handover inspection dates use `dayShort`, which adds the year
  when it is not this year. Help "What's new" line.
- Decided (Claude): days late instead of the date on the tag, because the
  question at handover is how long it has waited; the date is one tap away on
  the issue. Figures, grouping and order unchanged.
- Verified: typecheck, `npm test` (146 + 555, one new unit test for a target
  across the year end), build. `scripts/verify-before-handover.mjs` (now 33
  checks) adds a second project with a target 350 days ago, one 400 days
  ahead, one a day late and an inspection 380 days ago: "350 days past
  target", "1 day past target", no late tag with a bare date, the year on the
  next-year target and the old inspection, headline "2 past target". Also
  passed: accessibility (584), help, role-access. Screens: project files
  `ui-review/handover-ready/`.
- Not verified: a real phone or printer.
- Seen, not changed: the busy seed's handover inspections have actions with
  no issue raised (the real send always raises one), so the page shows "No
  actions" beside "1 action" there; a seed gap, not an app fault.
- Next: none from this walk.

## 2026-10-22 — A site update says which day it is for

- Why: a walk of an electrician at 390px on main 09bd55c, opening RELAY the
  morning after leaving a site update unsent (on the same site, on another
  site, and one started with no signal). The home screen was clear: the big
  button starts today's update and yesterday's waits under Unfinished reports
  as "visit Wed 21 Oct". A report started with no signal keeps the day it was
  started on when it goes up (`started.visitDate`), and the server fixes the
  visit date when a report is created, so the dates the office gets are
  right. But once opened, neither the cards nor Check & send said the day
  anywhere, so this morning's work could be added to yesterday's update and
  reach the office filed under yesterday (site diary, Today from site, the
  weekly figures). Coordinator's ask (walk and one pick); not a
  `docs/tasks.json` task, so no status changed. Within Cal's 21 Oct direction
  (the office's view of progress, the engineer's job simpler).
- Changed: `lib/visitDay.ts` (`visitDayWords`: "today, Thu 22 Oct",
  "yesterday, Wed 21 Oct" or "Mon 19 Oct"; `leftFromEarlierDay`: an unsent
  site update, not a correction or an inspection, for a day before today in
  London). In `reports/[id]/page.tsx` an unsent report says "For …" under its
  title; one left from an earlier day shows a note instead ("This update is
  for yesterday, Wed 21 Oct. The office files everything in it under that
  day. Send it as it is; anything from today goes in today's update.") with
  "Go to today's update", which opens the engineer's own update for today on
  that site (reading every page of the project's reports, so a busy site's
  50 newest do not hide it), or starts one; with no signal it goes to the
  Site page (which can start one offline), and any other failure is said on
  the note. Check & send's "The office can read it straight
  away" row starts "Filed under …". Help: a "What's new" line and the site
  update guide's paragraph.
- Decided (Claude): no way to change an update's day, and nothing moved
  between updates: the day is what the office files by, and the server never
  changes it after creation. Inspections and corrections get the day line but
  no note: an inspection may take two days, and a correction keeps the day of
  the report it corrects. Nothing is changed or removed in the older update.
- Verified: typecheck, `npm test` (146 + 554, two new `visitDay` unit tests),
  build. New `scripts/verify-old-drafts.mjs` (84 checks, light and dark at
  390px, dark at 1440px): home lists yesterday's with its day; the note and
  its day; Check & send's "Filed under yesterday"; Go to today's update makes
  one dated today on the same site with "For today" and no note, and tapped
  again opens the same one, also after 55 more reports are sent; yesterday's stays a draft with its day and cards
  and is still listed; inspection and correction have no note; no signal goes
  to the Site page; 48px button, axe on the title and note, no sideways
  scroll. On main the first note check fails (no note). Also passed:
  role-access, engineer-layout, signature-reload, report-editor,
  editor-usability, editor-wide, quicker-update, quiet-card-list,
  receipt-send-bar, offline-capture, offline-drafts, accessibility,
  day-walkthrough, engineer-day, fewest-taps, came-back-to-update, help.
  A fresh review found the first-page-only lookup and the silent failure;
  both fixed. Screens: project files `ui-review/old-drafts/`.
- Not verified: a real phone; London midnight on a real device clock.
- Next: none from this walk.

## 2026-10-22 — A day's photographs on the first screen of a phone

- Why: a walk at 390x844 (busy seed, Tetley Hall, 1,146 photographs, engineer
  and office manager alike) finding one day's and one month's photographs.
  The page opened with the heading, a line of explanation and a 420px stack
  of five controls, so the first photograph started at 842px of 844: none
  showed. Choosing a day (2 taps) left its photographs below the screen (first
  at 900px), so every day needed a scroll down, and every Newer day or Older
  day a scroll back up to the buttons and down again. Cal's 21 Oct ask: easy
  for engineers, clear for the office. Not a `docs/tasks.json` task (picked
  from the walk under Cal's 20 Oct go-ahead to decide); no status changed.
- Changed (`PhotoLibraryPage.tsx`, `photos.css`), phones (640px and less)
  only: choosing a month or a day, Newer day, Older day, Every day or a month
  step scrolls so the count line sits just under the top bar, with the day
  steps and the photographs below it. A link that names a day or a month (the
  Weekly summary's "N photographs", the month sheet's "Every photograph from
  October") does the same once the photographs load. The line under the
  heading is left off, and Month and Day lose their small titles on screen
  (kept for screen readers): they read "Every month", "Every day" or the
  choice. Typing in the find box and changing project do not move the page.
  Wider screens are unchanged. Help "What's new" line added.
- Decided: titles hidden rather than Month and Day side by side, because at
  390px half the width cuts "Thu 15 Oct 2026 · 15 photographs" to
  "Thu 15 Oct 20…". An instant jump, not a smooth scroll, so it reads as the
  page opening on the choice. Only a choice moves the page, never typing or
  a project change.
- Verified: typecheck, `npm test`, build. New
  `scripts/verify-photos-phone.mjs` (76 checks: engineer light and manager
  dark at 390x844, 1440 light): photographs on the first screen, after each
  choice and step the count is under the top bar with the steps and a whole
  row of photographs on screen, links naming a day or month, find box and
  project change do not move the page, no sideways scroll, 1440 unchanged.
  It fails on main ("photographs show on the first screen", first at 842px of
  844). Also passed: verify-photo-library, verify-photos-month, verify-help,
  verify-weekly-summary, verify-month-summary, verify-accessibility (584).
  Screens: project files `ui-review/photos-phone/` (`walk/` before, `after/`;
  the busy seed's photographs have no image files, so tiles show as blank).
- Not verified: a real phone (the native day list, iOS Safari's own scroll),
  browsers other than Chromium 141.
- Next: nothing further from this walk.

## 2026-10-22 — "Not seen yet" counts the last two weeks

- Why: a walk of an office manager at 1440 and 390px on main 199503f (busy
  example data from `scripts/seed-busy-projects.mjs`) working through the
  Inbox's "Not seen yet". The overview, the Inbox filter and its heading said
  1,542. Checked against the records: 1,223 of those (79%) arrived more than
  90 days ago and only 53 in the last 14 days. Opening a report is the only
  way to clear one, so the figure could only grow and did not tell the office
  what to read today. It also counted 14 originals already replaced by a sent
  correction (both the original and the correction were listed). Cal's 21 Oct
  ask: the office should see progress clearly. Not a `docs/tasks.json` task
  (out-of-queue work under Cal's 20 Oct go-ahead to decide); no status changed.
- Changed: `notSeen` in `lib/officeActions.ts` splits unopened sent reports at
  14 calendar days back (London, counting today) and leaves out any report a
  sent correction replaces. The office overview's "Not seen yet" group (sub
  now "Received in the last two weeks, nobody in the office has opened it"),
  each project's "N reports not seen yet" under Needs action, and the Inbox
  filter and heading all count the recent part. Under the Inbox's "Not seen
  yet" list a line says how many older reports were never opened and "are not
  counted", with "List them too" to show them after the newer ones (the figure
  stays the last two weeks). Help: a "What's new" line, and the "Seen" word
  explained says the office counts the last two weeks.
- Decided (Claude): two weeks, because the busy data's unopened reports from
  the last fortnight (about 50) are a list someone can work through, and a
  report older than that has been overtaken by later visits from the same
  site. Did not add "mark all as seen": it would tell engineers "Seen by the
  office" for reports nobody opened, and change records. No data changes; an
  engineer's own report still says "Not seen yet" until someone opens it.
- Verified: typecheck, `npm test` (146 + 552, new unit test for the split,
  London midnight and corrections), build. New
  `scripts/verify-not-seen-pile.mjs` (58 checks, busy seed, 1440px light and
  dark, 390px light): overview group, phone count strip, each project's Needs
  action, Inbox chip, heading and rows match figures worked out from the
  records; the older line and List them too / Hide them; opening a report
  takes exactly one off; axe and no sideways scroll. On main the overview
  shows 1,542 where the records give 53, so the first check fails. Also
  passed: office-inbox, office-actions, office-phone, seen-by-office,
  inbox-phone, office-progress, issue-figures, submission-stages,
  role-access, help, office-links, office-desk, office-landing,
  office-sections, office-words, today-from-site, search. Screens: project
  files `ui-review/not-seen-pile/before|after`.
- Not verified: a real phone or laptop, browsers other than Chromium 141.
- Next: none from this walk.

## 2026-10-22 — The Weekly summary reads on a phone

- Why: a walk of an office manager at 390px (latest main, busy example data
  from `scripts/seed-busy-projects.mjs`) reading Tetley Hall's Weekly summary
  for last week (12 to 18 Oct) and its Month choice for September, to answer
  "how did this project do?". The figures matched the records, recounted
  from the store: week 13 site reports over 5 days, 3 engineers, 22 issues
  raised, 6 put forward as fixed, 0 closed (the seed checks fixes 15 days
  after raising, so none fell last week), 2 variations raised and 2
  instructed; September 22 days, 61 reports, 143 progress updates, 89
  raised, 71 closed, 19 and 18 variations. The 14 safety and tower
  inspections are left off because the safety switch is off. Reading it did not fit a phone:
  the choices (project, Week/Month, three step buttons on two rows, a full
  width gold "Print or save as PDF") filled the first screen, so no figure
  showed until about 770px down, and "Week by week" showed only Week, Days
  and Reports; issues and variations were off the side in a sideways scroll
  with nothing to say so. Asked for by the coordinator as the walk's one
  pick; not a `docs/tasks.json` task, so no status changed. Decided without
  asking Cal (his autonomy message), within his 07:02 direction (the
  office's view of progress).
- Changed (`WeeklySummaryPage.tsx`, `MonthSheet.tsx`, `weekly-summary/week.css`):
  on a phone (640px or less) the choices take three rows: the project; Week or
  Month beside "Print or save as PDF", which is a plain outlined button there;
  then Previous, This and Next in one row (labels may wrap inside the
  button). The sheet is a little tighter. The week's four figures and the
  month's first two now end within the first 844px screen at 390px and
  wider; at 360 and 375px the week's first two do (the engineers' names wrap). "Week by week" on a phone
  shows each week as a block: its dates (still opening that week), then its
  six figures, each named, three to a row; the header row is kept for
  screen readers only, the visible names are left out of what they read
  (`content: … / ""`), and the table roles are written out so a browser
  that drops a restyled table's meaning keeps it. The table, its header and print are unchanged
  (`@media screen` only). On the desk the print button moved beside Week and
  Month (it is next in the page order too), and the steps went to the
  second row; same height, and the project name is no longer cut short.
- Decisions (Claude): kept the button names ("← Previous week" and so on) so
  existing checks and screen readers hear the same words. Print stays on a
  phone, outlined, because saving a PDF to send on is a real use.
- Checks: typecheck, `npm test` (146 + 551), build. New
  `scripts/verify-weekly-phone.mjs` (263 checks, 390px light and dark and
  360, 375, 412 and 430px light, a mouse at 600px, busy
  seed over ten weeks: the week's figures against the records, three rows
  of choices, print beside Week and Month and outlined, figures on the first
  screen, every week's six named figures inside the screen, matching the
  month's records and adding up to the month line and the figures above, a
  week opens from its line, no sideways scroll, axe; 1440 and print still a
  table with its header). It fails on main ("the week's choices take three
  rows (5)"). Also passed: weekly-summary, month-summary, month-print,
  photos-month, help, office-weekly-review, accessibility (584),
  role-access. Screens: project files `ui-review/weekly-phone/` (`before/`,
  `after/`).
- Review: a fresh-context review found that from about 400px print fell to
  a row of its own (412px Android and large iPhones), that hovering print
  with a mouse in a narrow window gave brass text on darker brass, that
  screen readers would hear each figure's name twice, and that the month's
  first two figures ended 7px below the screen at 360px; also the check's
  port clashed with verify-photos-month. All fixed and now checked.
- Not verified: a real phone, a screen reader (only Chromium's
  accessibility tree), Safari, phones narrower than 360px.
- Ideas for later (not built): on a phone the week's "On site" list runs to
  about 3,500px on a busy week, before Issues; folding each report's work
  lines, as Today from site does, would bring the issues up.

## 2026-10-22 — A shorter Check & send for a site update

- Why: a walk of an engineer at 390px (latest main 3b03173) sending the
  shortest useful end-of-day update: one place, one line, two photographs,
  from the Site page to sent. 7 taps over 4 screens (Start, Where, What
  happened, two photos, Check & send, Send to office), none spare; the office
  sees it under "Today from site" straight away. The clutter was on Check &
  send, about 1,360px for one progress card: a four-box tally with three
  zeros, and a full signature pad (name, drawing box, Clear) that the page
  itself said was optional. Asked for by the coordinator as the walk's one
  pick; not a `docs/tasks.json` task, so no status changed. Decided without
  asking Cal (his autonomy message), within his 07:02 direction (less on
  screen for engineers).
- Changed (`reports/[id]/page.tsx`, `engineer.css`): on a site update the
  tally lists only the kinds in it ("Progress 1"; progress and a defect show
  two boxes). An optional signature folds behind one "Add your signature"
  button (48px); tapping it opens the pad and moves focus to it. A draft
  already signed (drawn or typed), or with a name other than the author's,
  opens with the pad showing, and Clear does not fold it away. With no cards
  the tally and its heading are left out. Inspections, whose signature is required, are unchanged,
  as is their tally. Check & send for the walk's update is now about 940px.
  Taps stay at 7; what the office gets is unchanged.
- Decisions (Claude): kept the "Sign · optional" heading so an engineer who
  wants to sign still sees where; kept the optional caption note and "What
  sending does" (the one line that says RELAY does not email the PM yet).
- Checks: typecheck, `npm test`, build. New `scripts/verify-quick-update.mjs`
  (light and dark at 390, dark at 1440: 7 taps or fewer, tally without zeros,
  no pad until "Add your signature", 48px button, focus moves to the pad,
  Check & send 1,000px or less at 390, progress plus defect shows two boxes,
  the office gets place, line and both photos and Today from site shows it).
  Updated for the fold: signature-reload (a signed draft opens with the pad),
  day-walkthrough, editor-wide, send-on-signal, engineer-day, report-editor.
  Also passed: accessibility (584), help, engineer-layout, fewest-taps,
  quicker-update, one-caption-line, report-types, editor-usability,
  offline-sign, quiet-card-list, role-access. Screens:
  project files `ui-review/quick-update/` (`walk/` before, `after/`).
- Review: a fresh-context review found verify-report-editor still waited for
  the pad, a name changed from the author's was hidden behind the button after
  a reload, an update with no cards showed an empty tally box, and three kinds
  sat two and one on a phone. All fixed (three kinds are three across).
- Not verified: a real phone, a screen reader.

## 2026-10-22 — A project's figures on a laptop

- Why: the office laptop walk (PR #145) found a project sheet's four figures
  cramped at 1024px. On 1024-1400px screens the sheet has only about
  460-680px inside it (it shares the desk with the register and, from
  1180px, the Projects column), so each figure had a 115-170px cell:
  "Overdue actions" and "Fixed, to check" broke onto two lines and the words
  under a figure took four to six lines. Cal's 21 Oct ask: the office should
  see progress clearly. Not a `docs/tasks.json` task (out-of-queue work under
  Cal's 20 Oct go-ahead to decide); no status changed.
- Changed (CSS only): a sheet's four-cell figure blocks go two by two
  whenever the inside of the sheet is narrower than 680px, using a container
  query on `.sheet`, with a line between cells across and down. This replaces
  the 701-1023px media rule that did the same for narrower desks only. It
  covers the project's figures and details, and the four facts at the top of
  an issue or a variation (same CSS; measured only on the project sheet).
  At 1440px the sheet has 724px inside (694px with Windows-style scrollbars)
  and stays four in a row; phones are unchanged (already two by two).
- Decided: a container query rather than another media range, because the
  sheet's width does not grow with the screen (1180px gives a narrower sheet
  than 1100px, when the Projects column comes back) and scrollbars take
  about 30px on Windows. 680px keeps 1440px four in a row either way.
- Verified: new `scripts/verify-sheet-figures-laptop.mjs` (busy seed, 390,
  800, 1000-1920px, light and dark at 1024 and 1280, and 1280/1366/1440/1920
  with scrollbars showing): 548 checks pass; on main it reports 51 failures
  (labels on two lines, sub-lines of four to six lines, four across at
  1024-1365). At 1024 the words under each figure now take one or two lines.
  Also ran verify-office-links, verify-office-top-bar, verify-home-and-sheet,
  verify-office-progress, verify-issues-laptop and verify-role-access.
  Screens: project files `ui-review/office-laptop/figures/before|after`.
- Not verified: a real laptop, browsers other than Chromium 141.
- Next: Projects-column issue rows truncated at 1180-1365 (same walk).

## 2026-10-22 — A quieter list of cards in a site update

- Why: a walk of an engineer at 390px (latest main) writing one site update
  across five places (flats, corridor, roof, stair core, plant room) with seven
  photographs, then Check & send: 24 taps, four for each extra place (add,
  where, what happened, photo), none of them spare. The clutter was in the list
  of cards above the one being written: every saved card had a line of its own
  saying so (the bar at the bottom says it too), and each time a card folded it
  showed amber "Not saved to RELAY yet · changes and 1 photograph" for a second
  or two while its save went through, which reads as a fault. Asked for by the
  coordinator as the walk's one pick; not a `docs/tasks.json` task, so no
  status changed. Decided without asking Cal (his autonomy message), within his
  07:02 direction (less on screen for engineers).
- Changed (`reports/[id]/page.tsx` `CardWhereMark`, `CardWhereLine`,
  `photoWhereOf`; `engineer.css`): a saved card shows a green dot at the end of
  its place's line, with "Saved" for screen readers only (the photo tiles'
  rule since #114). A card or photograph waiting only for the save already
  under way says "Saving" (photo tiles "Uploading") with a grey dot, not the
  amber warning. Work that has not gone up and is not being saved (no signal,
  RELAY not answering, a refused save) keeps its amber line as before, also
  while RELAY retries it: the quiet "Saving" is only for a save after one
  that worked, and only when the phone has kept its copy. Inspections' check
  rows follow the same rule (not covered by the new check). A folded card at 390px is
  three lines (about 91px) instead of four (106px).
- Decisions (Claude): the dot goes at the right of the place line, clear of
  the + so it is not read as part of the place name. Kept the amber line for
  real problems: that is the one an engineer must notice.
- Checks: typecheck, `npm test` (146 + 551), build. New
  `scripts/verify-quiet-card-list.mjs` (66 checks, 390px light and dark: five
  places and seven photos in at most 24 taps, a held save shows "Saving" with
  no "not saved" on the card or its photos, every saved card one dot on its
  place's line with "Saved" for screen readers, folded cards 96px or less, no
  signal keeps its amber line, the office gets every place and photo). It
  fails on main ("a card whose save is on its way says Saving"). Also passed,
  one at a time: photo-uploads, send-on-signal, quicker-update, fewest-taps,
  lighter-card, engineer-layout, offline-capture, one-caption-line,
  draft-conflict, editor-wide, report-editor, day-walkthrough, engineer-day,
  accessibility (584), offline-drafts, handover-offline, offline-inspection,
  quicker-inspections. undo-remove fails as on main (open PR #142 fixes it).
  Screens: project files `ui-review/site-update-trades/` (`walk/` before,
  `after/`, `check/`).
- Review: a fresh-context review found the cards would turn to "Saving"
  every 15 seconds while RELAY retried a failed save, the "Saving" dot was
  amber, screen readers would hear the place and "Saved" run together, and
  the new check could catch photos still uploading. All fixed.
- Not verified: a real phone, real weak signal, a screen reader; the wide
  (desk) editor and inspection rows only through the existing checks.
- Ideas for later (not built): the progress card has no trade, so a site
  manager writing up several trades files them all under their own trade on
  "Today from site"; "+ Another card here" and "Done with this card" sit
  between the open card and "+ Progress" for an update across many places.

## 2026-10-22 — Today from site fits a phone

- Why: a walk of an office manager at 390px on the office overview (latest
  main, busy example data from `scripts/seed-busy-projects.mjs`; screens in
  project files `ui-review/office-overview-phone/`), asking "what happened on
  site today and what needs me?". The figures matched the records: 9 updates
  today, 3 a project; each bar's access and raised counts add up to its cards;
  1,542 not seen equals the projects' 553 + 493 + 496; Attention 1,369 equals
  their needs-action figures. The read did not fit a phone: the nine cards
  under "Today from site" ran to about 2,700px, so "Not seen yet",
  "Unassigned issues" and "Fixed, to check" started about 4,700px down.
  Asked for by the coordinator as the walk's one pick; not a
  `docs/tasks.json` task, so no status changed. Decided without asking Cal
  (his autonomy message), within his 07:02 direction (the office's view of
  progress).
- Changed: on a phone (700px or less) each project's cards fold under its bar
  behind a "Show the 3 site updates" button (`aria-expanded`, "Hide the site
  updates" when open; `TodayProject` in `ProjectsView.tsx`, `.today-fold` in
  `workspace.css`). Folded cards are not loaded, not even for the moment
  before the page knows it is on a phone (`usePhoneKnown`); once opened they
  stay loaded, so Hide and Show again do not read the reports again. The
  desk is unchanged. The
  busy overview on a phone went from 6,890px to 4,622px tall, and "Not seen
  yet" now starts about 2,000px down.
- Decisions (Claude): fold rather than cut the cards to one line, because the
  bar already says what the day found and the cards are the engineers' words,
  read when wanted. Folded by default on every visit (not remembered), so the
  overview always opens the same way.
- Checks: typecheck, `npm test` (146 + 551), build.
  `scripts/verify-today-from-site.mjs` now also checks, at 390px, that both
  projects start folded with their counts, the folded day is under one
  screen, the action groups follow it, axe finds nothing folded, each fold
  opens and says so, Hide folds it again, opening again reads nothing new,
  no card is read before a fold is opened, and the desk has no fold (58
  checks; fails on main).
  Also passed: help, office-phone, office-sections, office-landing,
  office-links, office-progress, role-access, accessibility, day-walkthrough.
- Not verified: a real phone; a live tenant.

## 2026-10-22 — Plain words on engineer screens

- Why: Cal's 21 Oct ask that RELAY be easy for hands-on engineers, "not IT
  guys". A walk of every engineer screen at 390px on latest main (home,
  Issues, an issue, Flag a defect, a site update's cards, check and sent
  screens, a handover inspection, site diary, My week, Photographs, Notes for
  the next visit, Weekly summary, Search, sign-in, page not found, no signal)
  listed IT-speak ("On the server", "Saved on server", "on this device"),
  office-speak ("assign", "sighting", "chargeable", "needs an instruction"),
  and text said twice. Not a `docs/tasks.json` task; no status changed.
- Changed (words only; nothing works differently): where work is now says
  "Saved to RELAY" (the bar), "Saved" (a card or photo), "Not saved to
  RELAY yet", "RELAY not answering · kept on this phone" and "Waiting for
  RELAY to answer", the save and send problem notes say "RELAY" instead of
  "RELAY's server", and the two-versions screen says "Saved copy"; the home button no longer says to sign a
  site update (signing is optional), Request a variation says "Extra work, for
  the office to price", an issue with no owner says "nobody on it yet" in the home list,
  inspections say "anything to fix goes on the snag list", Reports says "2
  sent"; on Check & send, "RELAY does not email A. Whitfield yet. If it cannot
  wait, tell them yourself." (the same as the sent report), "Ones you linked are
  added to the issue already raised", "The office says who fixes them"; on a
  card, plainer hints for linking an issue, who should fix it and work already
  done; Flag a defect says "Photo of the problem", "Kept on this phone · not sent
  yet" and a plainer trade hint; My week says "open it to finish and send", with its footnote cut to three sentences; Notes for the
  next visit and Photographs lose a repeated sentence. "Since your last visit"
  with nothing new shows one line instead of two saying the same thing.
- Decided: one word for where work is, "RELAY", set against "this phone",
  since engineers already see "No signal, or no answer from RELAY". Words the
  office also reads (status names such as Awaiting instruction, the weekly
  summary and My week's "variation required" (kept the same as each other),
  "Variation required" on PDFs, "Who needs to respond") are left as
  they are.
- Help: "What's new" line; the first-update, no-signal and unfinished-reports
  steps say "Saved to RELAY" and "until you send it".
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test`, build; every `scripts/verify-*.mjs` except
  pdf-navigation (fails on main) run on this change, one at a time, with
  checks that read the old words updated to the new ones: 99 pass. Three
  did not: toolbox-talks (its known tab-title race; passed when rerun),
  undo-remove (focus on Undo) and site-coverage (a date that falls inside the
  fortnight), both red on main and fixed by open PR #142. Before and after screens and the words on
  each screen in project files `ui-review/plain-words/` (before = main).
- Not verified: real phones, screen readers.

## 2026-10-22 — The Issues list on a small laptop

- Why: a walk of an office manager at 1024 and 1280px on main 8af52ef (busy
  example data from `scripts/seed-busy-projects.mjs`, 60 days; screens in
  project files `ui-review/office-laptop/before|after/`). The overview, Inbox,
  a project sheet and the Weekly summary read well. The Issues register at
  1024px did not: the heading's buttons dropped under the title and the
  filters took two rows, so the first issue started at 580px, and each Open
  row averaged 184px because the description had about 110px and wrapped to
  five or six lines while Work and Confirmation tags broke into a column of
  words ("FIXED, / TO / CHECK"). 55 of 100 tags were on two or more lines at
  every width from 1024 to 1365. Asked for by the coordinator as the walk's one
  pick; not a `docs/tasks.json` task, so no status changed. Decided without
  asking Cal (his autonomy message), within his 07:02 direction (the office's
  view of progress).
- Changed (`IssuesView.tsx`, `workspace.css`, only the Issues register): from
  1024px its Work and Confirmation tags stay on one line. At 1024-1279px the
  heading keeps its four buttons on one row beside the title (the summary line
  wraps instead), the five filters share one row, the Project column gives way
  to the project's name under the reference, and "45d late" goes under the
  target date; with a filter set, "Clear filters" goes under the filters, and a
  download that fails says so under the buttons. Below 1024px (cards) it is
  as before; from 1280px only the tags change (one line, so no wider).
- Measured (`RELAY_REPORT_ONLY=1` on main, then the branch, at 1024x800):
  first issue 580px to 511px from the top; an Open row 184px to 106px, a
  Fixed, to check row 144px to 123px; tags on two lines 55 of 100 to 0. At
  1280px the rows are the same height as before (tags were not what made them
  tall there) and the tags are on one line.
- Decisions (Claude): the Project column goes rather than the description
  being cut, because every reference already starts with the project's code
  and the name under it keeps the full name in the row. Sorting by project is
  not offered at 1024-1279px as a result; sorting by Ref groups by project.
  The summary line wraps under the title rather than the buttons, because the
  buttons are what you press. Kept to the Issues register: the Variations and
  Inbox tables read well at 1024 in the walk.
- Checks: typecheck, `npm test`, build. New `scripts/verify-issues-laptop.mjs`
  (260 checks at 1000, 1024, 1100, 1180, 1279, 1280, 1365 and 1440px, light
  and dark at 1024 and 1280, Open, Fixed, to check and with a location typed:
  heading on one row,
  filters on one row and wide enough to read, project under the reference or
  in its column by width, "Nd late" under or beside the date, every tag on one
  line, first issue by 520px and Open rows 130px or less at 1024, cards
  with their Project line below 1024, nothing sideways, no cell
  over the next, Verify inside its panel, a failed download's message inside
  the heading, no page errors). Against main it fails as listed above. Also
  passed: office-top-bar, issue-register, office-registers, check-fixes,
  office-phone, office-desk, help, issue-figures, fix-waiting, accessibility,
  role-access, engineer-layout, snag-list and issue-assign.
- A fresh-context review found a failed download's message would have pushed
  the heading sideways at 1024-1279 (now wraps under the buttons), the filter
  boxes too narrow with "Clear filters" on the row (it now goes under them,
  checked), and the Help text overstating "as before" at 1280-1365 (fixed).
- Not verified: a real laptop with browser zoom or a larger system font, a
  screen reader, a printer.

## 2026-10-22 — A shorter printed month

- Why: a walk of an office manager at 1440px (latest main, busy example data
  from `scripts/seed-busy-projects.mjs`) printing Tetley Hall's Weekly summary
  as a PDF to share progress: last week, this week and September (screens and
  PDFs in project files `ui-review/weekly-pdf/`). The figures matched the
  records: the month's week rows add up to its totals, the 196 past target
  equal the companies' past-target figures, and the 354 still open equal the
  companies' open issues. The week printed cleanly in 7 pages. The month did
  not: it came to 28 A4 pages, 22 of them the "Issues past their target" list,
  because print showed every one of the 196. Asked for by the coordinator as
  the walk's one pick; not a `docs/tasks.json` task, so no status changed.
  Decided without asking Cal (his autonomy message), within his 07:02
  direction (the office's view of progress).
- Changed: on paper "Behind or stuck" shows the ten longest-late issues, the
  same ten as the screen, then "And 186 more past their target on Wed 30 Sep
  2026, each no more days late than these. Each company's open and past-target figures are
  under “Still open, with whom”." (`MonthSheet.tsx`, `week.css`
  `.month-late-extra`, `.month-print-only`). With "Show all" open on screen,
  print still gives every one. Every place under "Where work moved on" still
  prints. The screen is unchanged. September now prints in 7 pages.
- Decisions (Claude): ten, because it is what the screen already shows and the
  company figures that print below account for the rest. Kept "Show all" as
  the way to print the full list rather than adding a print option.
- Checks: typecheck, `npm test` (146 + 551), build. New
  `scripts/verify-month-print.mjs` (32 checks, light and dark 1440 on the busy
  data: ten printed in the API's order, the "more" line and its count, every
  place, each company, white sheet, eight A4 pages or fewer, Show all prints
  every one with no "more" line, screen unchanged). It fails on main ("ten
  late issues printed (196)"). Also passed: month-summary, weekly-summary,
  help.
- Not verified: a real printer or another browser's print dialog (PDFs are
  Chromium's); a live tenant; a real phone.

## 2026-10-22 — Today from site on the office overview

- Why: a walk of an office manager reading the end of the day's site updates at
  1440px (busy example data from `scripts/seed-busy-projects.mjs`: three
  projects, nine site updates and an inspection sent today; screens in project
  files `ui-review/office-reading/`). The overview's figures all matched the
  records. The read did not: to see what every site did today, what held it up
  and what needs an answer, the office opened each project's Latest from site
  in turn, or each report in the Inbox, where every defect and access problem
  is listed twice. Asked for by the coordinator as the walk's one pick; not a
  `docs/tasks.json` task, so no status changed. Decided without asking Cal
  (his autonomy message), within his 07:02 direction (the office's view of
  progress).
- Changed: the overview has "Today from site" under "Where each project
  stands" (`ProjectsView.tsx` `TodayFromSite`). One edged block a project with
  a site update whose visit date is today, in the overview's project order. Its bar names the
  project (opens its sheet) and what the day found: site updates and
  inspections, access problems (marked red) and the defects and variations
  raised (marked amber). Under it, every site update for today's visit (not only each
  trade's newest, so two electricians are both read), by trade and then as
  sent, with the same cards as Latest from site (`FromSiteVisits`, shared)
  saying when each was sent; access problems come first so the ones the bar
  counts come before "and N more" (a report with more access problems than
  lines shown still folds the rest into it). Three lines a card on a desk, two on
  a phone. A day with nothing yet says so. Rules in `lib/projectStanding.ts`
  (`today`, `inspectionsToday`, `dayFound`), read from the report summaries the
  desk already holds; each card reads its report for the lines, as Latest from
  site does.
- Fixed (a wrong number): "waiting N days" on a fix to check counted whole
  24-hour periods, so a fix put forward at 5pm yesterday said "waiting 0 days"
  at 9am, and the overview said 407 days where the project's figure said put
  forward 9 Sep 2025 (408 calendar days). It now counts London calendar days
  in one helper (`daysWaiting`/`waitingWords`, `lib/checkFix.ts`) used by the
  overview's Fixed, to check rows, the Attention list and the issue sheet, and
  says "waiting 1 day" and "waiting since today". `daysSince` is gone.
- Decisions (Claude): the section goes after the project list and before the
  action groups, so the read runs "where it stands", "what happened today",
  "what needs you". Kept "Access" and "variations" (the words the cards and
  the Weekly summary already use) instead of new ones. Inspections are counted
  on the bar, not shown as cards: they answer a checklist, not progress.
  Defects and variations on the bar are not links, because the registers they
  would open list every open one, not today's.
- Checks: typecheck, `npm test` (146 + 550; new tests in
  `projectStanding.test.ts` and `checkFix.test.ts`), build. New
  `scripts/verify-today-from-site.mjs` (46 checks, light and dark 1440 and
  light 390: the section's day and count, one block a project with an update
  today in order, each bar's words and marks, every update by trade then as
  sent, access first, yesterday and the inspection's checks left out, an
  update opens its report and a name its sheet, three lines a card on a desk
  and two on a phone, the fix's calendar-day wait, no sideways scroll, no
  page errors, axe). Not run against main: the section does not exist there.
  Also passed: office-progress, office-landing, office-sections,
  home-and-sheet, fix-waiting, check-fixes, office-top-bar, help, office-phone,
  office-desk, issue-figures, accessibility, role-access, engineer-layout and
  busy-projects (Office desk 1.5 s and 760 KB, budgets 2.5 s and 1200 KB).
- A fresh-context review found no crash or wrong figure in the normal case.
  From its notes: the Help text said "sent today" where the rule is today's
  visit date (now says "for today's visit"); "never cut off" was overstated
  (now says what happens); the phone's two-line limit is now checked; the
  known limits are listed below.
- Known limits: it goes by the visit date the engineer gave, as the rest of
  the overview does, so an update sent today for yesterday's visit is not in
  it. The bar counts every access card; one with only photos has no line under
  it. A report saved before RELAY kept card counts counts its access problems
  as defects, as Latest from site already does. Scope: not a `docs/tasks.json`
  task; built under the project instructions' freedom to add features, which
  CLAUDE.md's "approved scope" rule predates.
- Not verified: a live tenant, a real phone, a screen reader, a printer.

## 2026-10-22 — Straight on to the next issue after putting a fix forward

- Why: a walk of an electrician on a 390px phone (latest main, local example
  data: six of their issues on Tetley Hall) putting three fixes forward with a
  photograph and a note found five taps a fix (the issue, photograph, note,
  "Put forward as fixed", then Back to the list for the next), and after the tap
  the page stayed as it was: the empty form and "Record an update" still there,
  only a thin note saying it was done. Picked by this thread and posted before
  building, under Cal's 21 Oct ask to make the engineer's job simpler. Not a
  `docs/tasks.json` task; no status changed.
- Changed: on the engineer's issue page, "Put forward as fixed" now gives a box,
  "Put forward as fixed. It is waiting for the office to check it. If it is not
  finished, it comes back to you.", with one big button to the next of the
  engineer's issues on the same site ("Next: Spur not labelled", where, and how
  many are left to do there), then Back. The next one is the top of the site's
  "Yours" list (`nextYourIssue` in `lib/yourIssues.ts`, the same rule and order
  as the Issues tab), never the one just done, another site's, or one already
  waiting on the office. With none left it says "That was the last one for you
  on <site>". While an issue is waiting on the office (just put forward or opened
  later), the form is folded under "Add a note for the office", which still
  records an update. Focus moves to the box once, as the tapped button has gone (not again
  when the next issue arrives, so a note being typed is not interrupted). The
  office's issue page is unchanged.
- Decided: offer the next issue only on the same site (the engineer is on that
  site; other sites stay on the Issues tab), and only straight after putting one
  forward, not on any issue opened later that is already waiting. If the list
  cannot be fetched (no signal), the box shows with Back and no Next, rather than
  guessing.
- Help: a "What's new" line.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (new unit test for `nextYourIssue`), build. New
  `scripts/verify-fix-forward-next.mjs` (73 checks): six fixes put forward one
  after another from the Issues tab in 24 counted taps (the first issue, then
  four a fix: photograph, note, Put forward, Next; on main it was five, with Back
  and the next card), Next names the top of "Yours" each time
  with where and how many are left, never another site, trade or engineer's
  issue, box and Next on screen without scrolling at 390px, focus on the box,
  form folded, each Next opens that issue ready to put forward; the last says
  so with no Next; when the list answers slowly, a note typed meanwhile keeps
  focus;
  with no answer for the list, the box still shows with Back; opened later, the
  plain note shows and the fold records an update that leaves it Fixed, to
  check; the office keeps Verify and close; light and dark, no sideways scroll,
  axe, no page errors. Screens in project files `ui-review/fix-forward/` (before
  = main, after = this change). Also passed: came-back-first,
  came-back-to-update, engineer-day, issue-assign, issues-yours, my-week-counts,
  office-words, other-sites-came-back, photo-library, photos-month,
  simpler-issue-page, help, engineer-layout, role-access, accessibility, search,
  signature-reload. A fresh-context review found four gaps, all fixed: the box
  promised the Site page for issues the engineer had not raised (now "it comes
  back to you"); focus jumped back to the box when a slow answer arrived (now
  once only, checked with a 2.5 s answer); the Help line named only "Back to
  Issues"; and the check's tap count and "fresh" check claimed more than they
  tested (taps now counted, the check renamed).
- Not verified: real phones, real weak signal, screen readers.

## 2026-10-22 — The checking fixes walk's small findings

- Why: the checking fixes walk (project files
  `ui-review/checking-fixes/walk-notes.md`) left small findings after #131 (the
  dialog) and #134 (the top bar). Asked for by the coordinator; not a
  `docs/tasks.json` task, so no status changed. Decided without asking Cal (his
  autonomy message). All five still open on main b62f4ac are built here; none is
  safety, supplier, FE-2, EXP-2 or EXP-4, so none was skipped.
- Office, how long a fix has waited: "waiting N days" counted from the issue's
  last event, so a note added after a fix was put forward started the count
  again (a fix put forward 2 days ago with a note today said 0 days). It now
  counts from the latest "put forward as fixed" (`putForwardAt`,
  `lib/checkFix.ts`) on the overview's Fixed, to check rows, Attention and the
  issue sheet, which also says the day it was put forward. The desk's trimmed
  copy of an issue (`deskIssue`, #62) now keeps that event as well as the latest
  one for a fix waiting to be checked, without notes or photos, so the desk
  needs no extra request. Records with no such event fall back to the latest
  event, as before.
- Office, order: "Verify the oldest" picked the oldest defect, not the fix that
  had waited longest. It now starts at the fix put forward longest ago, on the
  server's button and the dialog's list alike (`byPutForward`); the overview,
  Attention and each project's list use the same order. The project's Fixed, to
  check figure said "put forward" with the date of whichever issue came first in
  storage; it now says "oldest put forward" and that date. The register's own
  order (target date) is unchanged: it is the office's choice of sort.
- Office, issue sheet: the target read "2026-10-13" where every other screen
  says "13 Oct"; it now reads the same.
- Engineer, Issues "Yours": "3 put forward as fixed, waiting for the office to
  check" was plain text. It now sits under the site's list (to do first) and
  opens to show those fixes, newest put forward first; each opens its issue and
  Back returns to Yours. Folded at first, so the page is no longer than before.
- Engineer, home: "Came back from the office" counted a fix still waiting to be
  checked as "from the office" when the office had assigned it before it was put
  forward. A fix waiting for the office is no longer counted unless the office
  has written to the engineer on it since; it is still listed with its "Fixed,
  to check" tag, as the engineer's own records are.
- Decisions (Claude): kept the button's words "Verify the oldest" (the oldest fix
  is the one waiting longest; Help says so) so nobody relearns it; the waiting
  fixes go under the to-do list rather than above it, so what is the engineer's
  to do comes first.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 547; new tests in `checkFix.test.ts`,
  `yourIssues.test.ts`, `busyProjects.test.ts`), build. New
  `scripts/verify-fix-waiting.mjs` (41 checks: overview order and days, project
  figure, issue sheet put forward/waiting/target, Verify the oldest then the
  next, engineer home count; light and dark 1440, light 390; engineer 390 light
  and 1440 dark; no sideways scroll, no page errors). It fails on main b62f4ac at
  the first wait ("waiting 0 days" for a fix put forward 2 days ago).
  `verify-issues-yours` now opens the waiting fixes and follows one to its issue
  and back (48 checks). Also passed: check-fixes, came-back-first,
  issue-register, office-landing, issue-figures, office-progress, office-desk,
  office-sections, office-top-bar, engineer-layout, role-access, busy-projects,
  other-sites-came-back, engineer-day, simpler-issue-list.
- A fresh-context review found no blocking gap. From its notes: a question from
  the office on a fix still waiting now counts on the engineer home (it was
  listed with the office's words but left out of the count); the check's
  longest-waiting fix now has the newest note, so the order check fails on main
  too; the +/− on the fold is hidden from screen readers; stale comments fixed.
- Not verified: a live tenant, real SharePoint issue lists, a real phone, a
  screen reader.

## 2026-10-22 — The site diary starts higher on a phone

- Why: a walk of the site diary at 390px (local example data from
  `scripts/verify-site-diary.mjs`; screens in project files
  `ui-review/site-diary/`) found the first screen was mostly heading and
  controls: a three-line explanation, a Project list already set to the site
  the engineer came from, Find and the filter buttons. The first visit began
  about 685px down a 900px screen. Each entry also carried "Rev 1" and
  repeated the date the day heading gives. Asked for by the coordinator as the
  walk's one pick; not a `docs/tasks.json` task, so no status changed.
  Decided without asking Cal (his autonomy message).
- Changed (`components/SiteDiaryPage.tsx`, `app/diary/diary.css`): the
  explanation is one line; below 640px the Project list hides when the diary
  is opened with a project (it still shows with none chosen, after picking one
  on the page so a wrong pick can be changed, and on wide screens); the Rev tag shows only from rev 2; a report (or earlier revision)
  sent on its visit day says "sent 12:00", otherwise the day and time as before.
  The first visit now starts about 550px down.
- Decided: hide the list on phones rather than everywhere, so the office desk
  can still switch project without going back; an engineer switches site from
  the home, as everywhere else.
- Help: one "What's new" line for everyone.
- Checks: typecheck; `npm test`; build; `scripts/verify-site-diary.mjs` (43
  checks, 8 new: no Project list on the phone when opened from a site, but
  shown with none chosen and kept after a pick on the page, first visit within
  the first 600px, no Rev tag on an uncorrected report, time only when sent on
  the visit day, the list still shown at 1440). Also passed: help,
  role-access, engineer-layout, accessibility.
- Not verified: a real phone, a screen reader.

## 2026-10-22 — Back to Site after a defect, and nothing under the Send bar

- Why: the two-site walk (project files `ui-review/two-site-day/walk-notes.md`,
  items 3 and 4) found the "Defect sent to the office" receipt offered Open issue
  and View project issues but no way back to Site (the engineer used the bottom
  tabs), and the Send bar covered part of "What sending does" on Check & send.
  The coordinator approved both as one small task. Not a `docs/tasks.json` task;
  no status changed.
- Changed: the receipt's buttons are stacked full width, "Back to Site" first
  (the engineer is mid-visit), then "Open issue" and "View project issues". Back
  to Site goes to the same site's home with the Site tab on. The report editor
  (site updates and every inspection: the only screen with this bar) now sizes
  its bottom space from the bar itself (`ResizeObserver` → `--actionbar-space`,
  bar height + 32px) instead of a fixed 230px/190px/140px. While a field has the
  keyboard the bar is hidden and the last height is kept, so the page does not
  jump.
- Found: measured on main with the bar at the end of the page, a 390px phone had
  room for the usual bar (95px tall, 148px spare) but not when "Waiting for
  signal" was in it (245px tall: the end of Check & send 3px under it); at 1440px
  the waiting note left 45px under it and Undo 9px. Now every case ends 32-45px
  clear. Note: the walk's screenshot was a full-page capture, which draws the
  fixed bar mid-page; at the top of Check & send the bar always covers whatever
  is at the bottom of the screen until you scroll, as any fixed bar does.
- Help: a "What's new" line.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test`, build. New `scripts/verify-receipt-send-bar.mjs`
  (58 checks, light and dark at 390px, dark at 1440px): the receipt's three
  buttons in order, 48px or taller, above the bottom tabs, Back to Site lands on
  the same site's home; the cards step, Check & send on a site update (three
  "What sending does" rows) and on a handover inspection, Check & send with
  "Waiting for signal", and the cards step with Undo, each scrolled to the end
  with nothing under the bar (columns that scroll by themselves count only what
  they show); after Back to Site, Flag a defect opens a blank form; no sideways
  scroll, no page errors. Screens in project files `ui-review/receipt-send-bar/`
  (before = main, after = this change; viewport captures, so the fixed bar is
  where it really is). Also passed: engineer-layout, defect-recent-places,
  defect-send-on-signal, help, editor-usability, editor-wide, quicker-update,
  one-caption-line, same-place-issues, fewest-taps, engineer-day, role-access,
  accessibility, offline-capture, report-editor. A fresh-context review found one
  check named for more than it tested; it now taps Flag a defect again.
- Fixed on the way: `verify-report-editor` failed on main since #133 (the bar
  now steps aside once a tap has finished, and the check looked straight after
  the click). It now waits up to 3 s for the bar to hide and to come back.
- Not verified: real phones (including a phone's own toolbar and keyboard),
  real weak signal, screen readers.

## 2026-10-22 — Photographs by month

- Why: the monthly progress walk found the office Photographs page showed one
  day or every photograph (811 on Tetley Hall), so last month's photographs for
  the progress meeting meant paging back through every day since. #129 gave the
  Weekly summary a Month choice; Photographs had none. The coordinator picked it
  from the queue. Not a `docs/tasks.json` task; no status changed.
- Changed: a Month choice beside Day on `/photos` ("September 2026 · 4
  photographs", newest first, counting what the find box and kind filter
  leave). A chosen month shows its photographs grouped by day, with "← Previous
  month", "This month" and "Next month →" as on the Weekly summary, the same
  calendar months (`monthOf`, `shiftMonth`, `monthName`, now in
  `lib/monthSummary.ts`) and the same London day each photograph is already
  grouped under. With a month chosen, the Day choice (and Newer day, Older day)
  stays inside it, and the day's middle button reads "All of September". The
  month is in the page's link (`month=YYYY-MM`); a link naming a day outside
  the month opens the day in its own month, a month after this one opens this
  month (dropping a day in that later month), and anything not a month is ignored. Choosing another project goes
  back to every month. On the Weekly summary's Month choice, "Every photograph
  from September 2026, by day" under "A few photographs" opens it, and Back
  returns there. The controls now sit two by two (Project, Month; Day, Find)
  from 641px up, so the chosen month and day are never cut off.
- Decided: months filter on the page from the one download Photographs already
  makes, rather than a new month query, so switching months is instant and the
  page fetches nothing new. "Previous month" is off before the oldest month with
  photographs (the Weekly summary has no such limit, but here an endless run of
  empty months helps nobody); months between with none can still be stepped
  through and say so. Plain display of photographs already sent: no tags,
  albums or annotations (FE-2 stays out).
- Help: a "What's new" line, and the Photographs line in the page list.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 545 on top of #136), build. New
  `scripts/verify-photos-month.mjs` (43 checks): month choices and counts, a
  fix added to an issue counted in its month, grouped by day, Day choice and
  Newer/Older day kept inside the month, the find box narrowing a month's
  count, Previous into a month with none and to the oldest (then off), This
  month and Next month off at this month, Every month, project change, links
  with a day outside the month, a future month and a non-month, Back from a
  report, the Weekly summary link and Back, 1440 light and dark and 1024 light
  and dark (two by two, nothing cut off, no sideways scroll), 390 engineer
  (no sideways scroll, month buttons' words fit), no page errors. Screenshots
  in project files `ui-review/photos-month/`. `verify-busy-projects` now also
  times last month's photographs in the office: 1228 ms (budget 2500), 372 KB
  (budget 500), on the 24,717-photograph seed; the whole check passed. Also
  passed: photo-library, month-summary, help, office-top-bar.
  A fresh-context review found two things, both fixed: a link with a future
  month and a day in it kept the day outside the month it opened; and the test
  count here was wrong.
- Not verified: real phones, tablets, screen readers.

## 2026-10-22 — The office's questions from other sites on the engineer's home

- Why: a two-site walk (`ui-review/two-site-day/walk-notes.md`, item 2) found
  the office's question on a Kirkstall Gate fix shown nowhere while the
  engineer was at Tetley Hall: "Came back from the office" read one project.
  Asked for by the coordinator; not a `docs/tasks.json` task, so no status
  changed. Decided without asking Cal (his autonomy message). Item 5 of the
  walk (the number counting the engineer's own records) was fixed by #135;
  this builds on its `office` flag.
- Changed: `/api/came-back?elsewhere=1&projectId=` returns, from every other
  site the engineer reports on, only what waits on them: an issue they raised
  that the office wrote on, sent back ("Not finished") or disputed; a
  variation the office wrote on; a sent report returned and not yet corrected,
  or written on when opened (`cameBackElsewhere` in `lib/cameBack.ts`, reports
  from `ownSentReports`). Their own new records from other sites are left out,
  so another site adds only the office's words. The home lists the current
  site's rows first, then the other sites', each line starting with the site's
  name. Decided: still six rows at most (`cameBackRows`): other sites keep two
  places at least and take the engineer's own new records' places beyond
  that, while the current site always keeps two rows and its own answers.
  The heading's "N from the office" counts the other sites' rows too.
  The current site's rows show as soon as they come; the other sites' are
  added when they arrive, and if they cannot be asked (weak signal) the
  current site's rows stay. Decided: other sites list only the office's
  words and send-backs, not an assignment or a price with no note, so a
  second site never adds rows with nothing to read.
- Opening an issue from another site's home adds a "Site" line above Where,
  so the engineer knows which site it is on (variations and reports already
  name their project). Opened from its own site's home, nothing changes.
  Back returns to the site they were on.
- Help: one "What's new" line for engineers.
- Checks: typecheck; `npm test` (146 + 543); build;
  `scripts/verify-other-sites-came-back.mjs` (new, 32 checks, light and dark
  at 390: the Kirkstall question listed at Tetley after Tetley's rows, named,
  with the office's words; the engineer's own Kirkstall report and defect not
  listed; "1 from the office"; the tap opens it ready to update with its
  site; at Kirkstall it shows without a site name and nothing from Tetley;
  with the other sites' answer lost or 4 s slow, Tetley's rows show first; 48px rows; no
  sideways scroll; no page errors). Screens in
  `ui-review/office-questions-sites/`. Also passed: came-back-first,
  seen-by-office, office-words, came-back-to-update, home-and-sheet,
  issues-yours, engineer-layout, role-access, same-place-issues,
  simpler-home, engineer-day. Fresh review: no requirement gaps; fixed its
  points (a slow other-sites answer held the current site's rows back; one
  scan for corrections, not one per report; no raw project id on the Site line).
- Not verified: a real phone, a screen reader, a live tenant.
- Next: other walk findings stay in the notes (receipt with no way back to
  Site; Send bar over "What sending does").

## 2026-10-22 — Defect cards ask only about issues in the same place

- Why: a walk of one engineer's day on two sites at 390px (Tetley Hall then
  Kirkstall Gate, local example data; notes, tap counts and screenshots in
  project files `ui-review/two-site-day/`) found every defect card put
  "Is this something already raised?" between Where and What's wrong, listing up
  to six open issues from anywhere on site, each with a photo: at Flat 1.03 it
  listed issues in Riser 2 and Flat 2.04. With two open issues it took about
  290px; on a busy site six rows and "Show all", and a wrong tap links the new
  defect to an old issue. The coordinator approved it as the walk's one pick. Not
  a `docs/tasks.json` task; no status changed.
- Changed: defect and access cards list only the open issues at the card's place
  and the one the card is linked to (`issuesHere` in `lib/issueLink.ts`). With
  none, one line says "No open issue at Flat 1.03." (or asks for the place first),
  and "Link to an issue somewhere else · 11 open" opens the full picker as before;
  "Only issues at Flat 1.03" folds it again. A link made before, to an issue
  anywhere, is always listed and stays chosen. Variation cards are unchanged (their
  question is already folded under "More for the office"). It filters the issues
  the report page already has, so it works the same with no signal.
- Decided: places are typed, not picked from a list, so "the same place" is the
  same words ignoring case and spaces, or one place inside the other ("Block E"
  and "Block E, flat 2.04"; "Flat 2" and "Flat 2.04"), so a defect seen again in
  a part of a room still finds its issue. The shorter one must sit between word
  edges, so "Level 1" no longer matches "Level 12" (the old contains rule did).
  The picker's ordering uses the same rule.
- Also (small, approved): the number beside "Came back from the office" counted
  every row, including the report and defects the engineer had just sent. It now
  says "N from the office" and counts only rows the office has done something on
  (opened or reviewed a report; assigned, checked, sent back, confirmed, priced,
  decided or wrote on an issue or variation: `officeActed`/`officeOpened` in
  `lib/cameBack.ts`); with none it shows no number. The rows are unchanged.
- Help: a "What's new" line.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 540; between 23:00 and 00:00 UTC
  `offlineStart.test.ts` fails on main too, fixed separately in #133), build. New
  `scripts/verify-same-place-issues.mjs` (61 checks, light and dark at
  390px): nothing listed before a place; at a new place one line (117px instead
  of a list) and the rest one tap away, counted, 48px; "Flat 2.04" lists the flat
  and its bathroom, "Level 1" not "Level 12"; linking an issue elsewhere through
  the fold, kept and shown after folding and after a reload; a link to an issue
  since withdrawn still says it is linked and "No — this is new" unlinks it; an
  access card with
  no signal matches the issues already on the phone; home counts "1 from the
  office" before and after sending a report and defects; no sideways scroll, no
  page errors. `verify-issue-link` now opens the fold before checking the full
  picker. Also passed: issue-link, fewest-taps, engineer-day, came-back-first,
  simpler-home, seen-by-office, office-words, came-back-to-update, home-and-sheet,
  issues-yours, help, engineer-layout, role-access, accessibility, quicker-update,
  same-location, editor-wide, editor-usability, report-editor, offline-capture.
  A fresh-context review found two things, both fixed: a card linked to an issue
  no longer open lost "No — this is new" and the linking hint; and folding the
  list away when nothing was left elsewhere removed the button with focus on it
  (focus now goes to the chosen answer).
- Not verified: real phones, real weak signal, screen readers.
- Seen on the walk, left as notes: the office's question on another site is not
  shown while at this one; the defect receipt has no way back to Site; the Send
  bar covers part of "What sending does".

## 2026-10-22 — The office fits a smaller laptop or a tablet

- Why: the checking fixes walk (#131) found the office top bar 156px wider
  than a 1024px window, so the whole page scrolled sideways. The cause was
  wider than the top bar: the office desk (`.ws`) was held at `min-width:
  1180px`, so every tab scrolled sideways below 1180px, and on busy data the
  Issues and Variations registers ran past their panel up to about 1250px.
- What changed (CSS only, `workspace.css`): no minimum width. From 701 to
  1179px the top bar takes two rows (RELAY and the search box; then
  Attention, name, theme, Help, Engineer view, Switch company, in the same
  order as the keyboard moves through them); a long name gives way first and
  ends in "…" (the full name is still read out and the button still signs
  out), and the Attention list opens under the taller bar. With a project open, the Projects
  column steps aside and the register and details share the width, with
  "‹ Projects" at the top of the register (the link the phone already had);
  a project's figures go two by two below 1024px. Below 1024px the office
  registers (Inbox, Issues, Variations, Team, Admin) use the phone's one-card-per-row layout and
  the "Order" choice in place of column headings; up to 1365px registers pack
  their cell padding, wrap tags and stack a row's buttons, so Verify and Not
  finished stay inside the panel. The Team tab's side panel is 360px there.
  At every width the register heading wraps rather than cutting the
  project's name (it was cut at 1280 and 1440 too on "Register · Tetley Hall
  - Block E"); that is the only change at 1366px and wider. Phone (700px and
  below) is unchanged.
- Decisions (Claude, under Cal's 2026-10-20 14:11 autonomy): cards rather
  than a sideways-scrolling table below 1024, because a table scrolled inside
  its panel hid the Verify buttons off to the right; two top bar rows rather
  than a "More" menu, so every item stays one tap away and in words. A
  fresh-context review found the first two-row layout (Attention on row one,
  search on row two) took the keyboard from the logo down to the search box
  and back up; the rows now follow the page order and the check tests it.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test`, build. New `scripts/verify-office-top-bar.mjs`
  (busy example data, an Admin with a long name): at 768, 1024, 1280 and
  1440px, on the overview, a project, a project with an issue open, Inbox,
  Inbox with a report open, Issues, Fixed to check, Variations, Team and
  Admin, nothing scrolls sideways (page, columns, views, panels); every top
  bar item reads in the same order as the keyboard reaches it, is inside the window, not covered, not overlapping another, at
  least 24px, and says what it is in words; Help and Attention open, and
  Attention's list is inside the window under the bar; "‹ Projects" shows
  whenever the Projects column does not; the register heading shows the whole
  name; the first Verify button is inside its panel; coverage, companies,
  issue trend, weekly summary, site diary, photographs, search and Help do
  not scroll sideways; light and dark for the overview, a project and Issues;
  no page errors. 1,917 checks. Also passed with `RELAY_WIDTHS=701,768,800,900,
  1023,1100,1179,1180,1200,1366` (4,791 checks). It fails on main at the
  first page (overview at 768px scrolls sideways). Screenshots in project
  files `ui-review/office-top-bar/`. Also passed: office-sections,
  office-phone, office-desk, office-registers, issue-register, check-fixes,
  office-inbox, inbox-phone, office-landing, home-and-sheet, office-links,
  office-progress, office-words, issue-figures, accessibility, help,
  role-access, search, engineer-layout. `npm test` once failed in
  `offlineStart.test` ("a report started with signal still takes today")
  between midnight London time and midnight UTC; #133 fixed that test, and
  `npm test` passes after bringing it in.
- Found, not fixed: the Leodis Compliance office (`/compliance`, screens over
  invented sample data, not in the first release) is still held at 1240px and
  has no phone layout; it scrolls sideways below 1240px. The other walk notes
  (the issue sheet's "2026-10-13" target date, "waiting N days" counting from
  the last event, the engineer's waiting-fixes line that cannot be opened,
  "Came back from the office" listing fixes still waiting) are not in the top
  bar and are left for their own task.
- Not verified: a real tablet or small laptop, touch on a tablet, a screen
  reader, browser zoom.
- docs/tasks.json: no task covers this (a fix from a walk, like #131), so it
  is unchanged.

## 2026-10-22 — Two flaky browser checks, two real bugs (one fixed by #132)

- Why: `verify-busy-projects` and `verify-day-walkthrough` failed now and then
  on cloud machines and passed on a rerun, so release checks waved them
  through. Asked for by the coordinator; not a `docs/tasks.json` task, so no
  status changed. Decided without asking Cal (his autonomy message).
- Busy projects: the over-budget failure tonight was real. #128 made Issues over
  time read every issue's London day again for each of its twelve weeks, so
  `/api/issue-trend` went from 23 ms to 85-101 ms against a 100 ms budget: it
  failed only when it crossed 100. Found here and fixed the same way in
  parallel by #132 (merged first, so this PR keeps #132's code). Its budget is
  now 60 ms (about 25 ms with the fix), so a slowdown like that fails every
  time (checked on a 40ff4fd build: 83, 99 and 100 ms, all failed).
- Busy projects, the machine: misses in earlier release checks (10-80 ms on some
  API calls, 0.5-2 s on some pages, on old and new builds alike) were a
  shared machine stalling. A page or API call over its time budget is now
  timed again (pages up to three tries, APIs three more calls) and the fastest
  counts; the output says when. Budgets unchanged; sizes count the first try
  and are never retried. A real slowdown is slow every time and still fails.
- Day walkthrough: the "More for the office" failure was a real phone bug.
  While typing, the Check & send bar hides; a tap low on the screen made the
  text box lose focus, the bar came back under the finger between press and
  release, and the tap went nowhere. Whether it hit depended on where the card
  had scrolled to. `reports/[id]/page.tsx` now changes the bar only once the
  tap is over (after the click, a cancelled touch, or half a second after
  the finger lifts with no click). The
  walkthrough now scrolls "More for the office" to the bottom of the screen
  while typing and taps it on purpose: fails on the old build 2 of 2, passes
  with the fix.
- Both checks now stop with a plain message if a server from an earlier run is
  still on their port (it answered in place of the new one, with other data).
- Also: `offlineStart.test.ts` expected the UTC date where the app uses
  London's, so `npm test` failed every night between 23:00 and midnight UTC in
  summer time. It now expects `londonDay`.
- Help: one "What's new" line for engineers (the tap).
- Checks: typecheck; `npm test` (146 + 535) at 23:05 UTC; build.
  Five runs in a row of each, after the fresh review's fixes: busy-projects
  5/5 (38 timings, nothing needed timing again); day-walkthrough 5/5 (117
  checks). Before the fixes, on the same machine: busy-projects failed 1 of 1
  (issue-trend 101 ms), day-walkthrough failed 1 of 3 at "More for the
  office", 5 of 5 times when the card sat low on the screen. With budgets set
  impossibly low, the second go runs in a new browser and still fails.
  Fresh review: no correctness bugs; four small gaps fixed (a re-timed API
  call's status is checked; second goes start in a new browser so they are no
  warmer; a long press no longer brings the bar back mid-tap; What's new wording).
- Not verified: a real phone (the tap order there is press, release, then the
  mouse events; the fix waits for the click, which covers it), a screen reader.
- Next: nothing from this task.

## 2026-10-21 — Issues over time quick again on busy projects

- Why: the twelfth release check (main 40ff4fd, #2-#129) ran every browser
  check; `verify-busy-projects` failed on `/api/issue-trend` at 173-184 ms in
  three runs against its 100 ms budget. The same check on 6def5e8 answered in
  44 ms. #128 made each week's open and past-target counts call `isOpenOn` and
  `isLateOn`, which worked out the London day of the raise date, the closing
  check and every event again for each of 12 weeks per issue.
- Changed: `lib/issueTrend.ts` works those days out once per issue
  (`issueDays`) and passes them in. The rules are untouched; the monthly
  summary still calls the same functions and gets the same answers.
- Verified: typecheck, `npm test` (146 + 537), build; `verify-busy-projects`
  passes alone with issue-trend at 54 ms. A fresh-context review found the
  change behaves exactly as before.
- Not verified: real phones or a live server.

## 2026-10-21 — Check fixes one after another

- Why: a walk of an office manager checking 25 fixes put forward by three
  engineers (1440px, local example data on Tetley Hall and Kirkstall Gate; notes
  and screenshots in project files `ui-review/checking-fixes/`) found that Verify
  and "Not finished" on the overview, the register and "Verify the oldest" opened
  a dialog showing only the description and who put it forward: no photo of the
  defect, no photo or note sent with the fix. To see them the office opened the
  issue and scrolled its history (the fix at the top, the defect at the bottom),
  and after verifying the screen stayed on the closed issue: about three clicks
  and a scroll per fix. "Not finished" also went through with no reason, so the
  engineer saw the issue back as plain "In progress" with no word why. The
  coordinator approved this as the walk's one pick. Not a `docs/tasks.json` task;
  no status changed.
- Changed: a fix waiting to be checked opens "Check this fix"
  (`components/developments/office/CheckFix.tsx`): the defect's photos as raised
  beside the photos sent with the latest fix (`lib/checkFix.ts`), the engineer's
  note, who put it forward and when, the company and target. Photos open full size
  in a new tab (the issue page has no photo viewer to share). "No photo was taken
  of the defect", "No photo was sent with the fix" and "No note was sent with the
  fix" are said plainly, and such a fix can still be verified. The office desk's
  copy of an issue carries no photos (#62), so each fix is loaded whole, and the
  next one ahead of time. After Verify or Not finished the next fix on the same
  list opens ("4 of 25"): the overview's Fixed, to check panel and the Attention
  list in their order; a register row through every page of the register's
  current filters and order; "Verify the oldest" oldest first, by the register's
  own rule. Skip changes nothing; Stop, Esc or the end of the list closes it and
  says what was done ("1 verified, 1 sent back."). Each decision refreshes the
  office records, so every figure behind comes from #128's shared helper; the
  dialog has no figures of its own. A fix someone else checked meanwhile says so
  and can only be skipped. No form, so Enter never verifies; focus goes to the
  fix's heading, or to the note when opened with Not finished. The person who put
  a fix forward sees no Verify button, as before. The issue sheet's own buttons
  open the same dialog for that one issue.
- Decided: a reason is needed to send a fix back, in the dialog and on the server
  (`lib/issueStore.ts`), with the same words, so an older app open on a phone gets
  "Say what is left to do, so the engineer knows why it came back." rather than a
  silent send-back. Reopening a closed issue is unchanged. Records already sent
  back without a word are left as they are and still show as sent back;
  `verify-came-back-first` now makes such a record directly instead of through the
  refused command. Help: a "What's new" line and a step under "Closing an issue".
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 537; new `checkFix.test.ts`), build. New
  `scripts/verify-check-fixes.mjs` (70 checks): 25 fixes; from the overview the
  dialog follows the panel's order, Enter changes nothing, Verify moves on, an
  empty Not finished is refused in plain words and nothing changes, then goes with
  a reason, Skip changes nothing, Esc stops and the panel, Issues tab, register
  chips and project list all agree; the server refuses an empty send-back; "Verify
  the oldest" goes oldest first; a register row filtered to one company goes
  through its 3 fixes in the register's order and closes by itself; no photo and
  no note said plainly; photos load full size; side by side at 1440 and 1024,
  stacked at 390, light and dark, axe on the dialog, 44px buttons on a phone, no
  page errors. Screenshots `ui-review/checking-fixes/after-*`. Also passed:
  issue-register (its dialog step now presses "Verify and close" in the new
  dialog, then Stop), office-registers, simpler-issue-page, office-actions,
  issues-yours, my-week-counts, role-access, came-back-first, help, office-desk,
  office-phone, office-words, issue-figures, office-landing, office-links,
  seen-by-office. A fresh-context review found six things, all fixed: deciding
  before the register's list had loaded closed the dialog (deciding now waits
  for the list), a decision refused because the issue changed kept the old copy
  (it is read again), loads were repeated, Esc while recording lost the summary,
  a list could hold one issue twice, and a linked photo's caption was not read
  out.
- Found, not fixed: on the verify script's data the office top bar is 156px wider
  than a 1024px window (the page scrolls sideways before the dialog opens; the
  walk's data at 1024 did not); the issue sheet shows its target as "2026-10-13"
  where everything else says "13 Oct"; "waiting N days" counts from an issue's
  last event, not from when it was put forward; the engineer's "N put forward as
  fixed, waiting for the office" line cannot be opened; "Came back from the
  office" also lists fixes still waiting, because the office assigned them earlier.
- Not verified: a live tenant, real SharePoint issue lists, a real phone, a
  screen reader.
- Next: the twelfth release check after this and the no-signal site update PR.

## 2026-10-21 — A month on one page

- Why: the monthly progress walk (project files
  `ui-review/monthly-progress/walk-notes.md`) found RELAY has no month: October
  on Tetley Hall was five weekly summaries, the first starting 28 Sep, added up
  by hand. Built on #128's figures. Decided without asking Cal (his autonomy
  message); not a `docs/tasks.json` task, so no status changed.
- Added a Week / Month choice on the Weekly summary (`?period=month&month=YYYY-MM`,
  `/api/monthly-summary`, `lib/monthSummary.ts`, `components/MonthSheet.tsx`).
  One calendar month of one project: figures (days on site, site reports,
  issues raised and closed, variations raised and instructed), a row a week
  cut to the month's days so rows add up to the month; "Where work moved on"
  (one line a place, newest progress line, trade, date, how many updates);
  "Behind or stuck" (issues past target, places with access problems on more
  than one day); "Still open, with whom" (each company's open and past-target
  issues, each company opening its list); up to eight photographs, the newest
  progress photograph from each place. Every figure opens a list on the page
  with exactly that many records (#108's rule). Prints like the weekly one; the
  lists behind the figures stay off paper.
- Decisions: the month counts with the weekly page's own code
  (`weeklySummary.ts` now has `periodSummary` and `sentReports`), so a record
  counts the same on its week and its month. Month-end standing uses the same
  per-issue rules as Issues over time (`issueTrend.ts` now exports `isOpenOn`,
  `isLateOn`, `isToCheckOn`, which its own figures use); for the month in
  progress they are the register's rules (`isActiveIssue`, `isOverdueIssue`),
  so they match the project sheet. Safety inspections, toolbox talks, permits
  and deliveries never appear, even switched on. Photographs are plain display
  of existing progress photos. Week rows link to the full weekly page; Back
  returns to the month (week rows are full page loads, as the page keeps its
  choice in state).
  An issue closed twice in a month counts once, in the week it was last closed.
- Checks: typecheck; `npm test` (146 + 535; new `monthSummary.test.ts`, 10
  tests, incl. October 2026 starting on a Thursday, BST/GMT month end, figures
  equal to `issueFigures` today); build. New `scripts/verify-month-summary.mjs`
  (73 checks): last month seeded across week boundaries with safety records on;
  every figure opens exactly that many rows; each week row equals the weekly
  page's records on those days (from `/api/weekly-summary`) and a full week's
  page shows the same figures; places, behind or stuck, Acme 3 open / 2 past
  target (a fixed-to-check issue past target is not), eight photographs
  loaded; axe light and dark; print hides controls and lists, every place
  printed, white sheet from dark mode, A4 PDF; 390px no sideways scroll.
  Screenshots and print preview in project files `ui-review/monthly-progress/month-*`.
  Also passed: weekly-summary, issue-trend, issue-figures, help, office-links,
  home-and-sheet, role-access, navigation, photo-library, accessibility.
  Fresh review found two things, both fixed: this month's open count missed an
  issue with no recorded raise date (now the register's own rule today), and a
  page that followed its address could flip back on a late router update
  (removed; week rows load the page afresh).
- Not verified: a live tenant, real SharePoint registers, a real phone, a
  printer (PDF only), a screen reader.
- Next: nothing left from the walk's pick; ideas only: a month choice on
  Photographs.

## 2026-10-21 — Office issue figures agree

- Why: a walk of an office manager preparing a monthly progress meeting (1440px,
  local example data: Tetley Hall and Kirkstall Gate, 45 days from three
  engineers; notes and screenshots in project files
  `ui-review/monthly-progress/`) found the project list card for Tetley Hall
  saying "146 issues, 55 overdue, 52 open" with nothing to check, while the
  sheet beside it said "Fixed, to check 22" and the overview said "107 open".
  The register, the project list, the sheet, Attention, Issues by company and
  snag lists counted an issue put forward as fixed but past its target as
  overdue; the Weekly summary and Before handover did not. The coordinator put
  this before the walk's own pick (a month view) because wrong numbers mislead
  the office every day and a month page would show the same figures. Decided
  without asking Cal (his autonomy message). Not a `docs/tasks.json` task; no
  status changed.
- One meaning for each figure, everywhere the office sees it
  (`lib/officeActions.ts`: `isOverdueIssue`, `issueFigures`):
  **open** is every issue not closed or withdrawn (fixed, to check included);
  **fixed, to check** is put forward as fixed and waiting for someone to check
  it; **overdue** (also "past target") is open, past its target date and not
  put forward as fixed. Fixed, to check is never overdue: the company has done
  its part and the wait is the office's.
- Changed: the register's Overdue filter, chips, priority sort and spreadsheet
  "days late" (`issueQuery` re-exports the one rule); the project list bar and
  its line now read "7 open · 2 overdue · 3 to check" (the bar's last part is
  "open, not late"; "N issues" is gone, as it left out withdrawn issues while the
  register's Issues chip counts them); the sheet, the phone summary,
  "Where each project stands", the Issues tab count and Attention (a fixed
  issue past target was listed twice, as overdue and to check); Issues by
  company and snag lists; the Weekly summary and Before handover now call the
  shared helper instead of their own copy of the rule; Issues over time leaves
  out of "past target" an issue that was put forward as fixed by the end of that
  week and not sent back (from its history), so today's figure matches the
  sheet. Engineer My week has no open or overdue figures, so nothing changed
  there. Team list (#125) and the phone Inbox report screen (#122) untouched.
  Help "What's new" line added.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 526; new tests in
  `officeActions.test.ts` and `issueTrend.test.ts`; the company and snag list
  tests that asserted the old rule now assert the new one), build. New
  `scripts/verify-issue-figures.mjs` (45 checks, 1440 light and dark, 390
  light): Tetley Hall with 2 overdue, 3 fixed to check (2 of them past
  target), a closed and a withdrawn issue past target: the overview row, the
  Issues tab, the project list card and bar, the sheet, the register heading
  and chips, Issues by company, the snag list, the Weekly summary, Issues over
  time and the phone summary all say 7 open, 2 overdue, 3 to check; Overdue
  actions opens 2 rows and Fixed, to check 3 (desk and phone); no fixed issue
  is shown as overdue anywhere; axe; no sideways scroll. Screenshots
  `ui-review/monthly-progress/figures-*`. `verify-company-issues` asserted the
  old rule and now asserts the new one (Acme: 1 past target, not 2). Also
  passed: office-links, office-progress, snag-list, issue-trend,
  issue-register, weekly-summary, before-handover, day-walkthrough (second
  run; the first timed out filling a defect card, and it passed on main too),
  home-and-sheet, office-phone, register-export, office-sections,
  september-office, help, company-chases, office-actions, office-landing,
  office-desk, role-access, register-downloads, issue-assign.
- Found, not fixed: in light mode the project list's group headings (Active,
  Defects liability period) measure 4.2 to 4.4:1 against their wash, under
  the 4.5:1 axe asks for; the new check leaves them out of its axe run.
- Not verified: a live tenant, real SharePoint issue lists, a real phone, a
  screen reader.
- Next: the walk's pick, a "Month" choice on the Weekly summary page (month
  figures and a row a week, progress grouped by place, behind or stuck, still
  open and with whom, a few photographs), built on these figures. Walk notes:
  project files `ui-review/monthly-progress/walk-notes.md`.

## 2026-10-21 — Eleventh release check: main ready at 6def5e8

- Why: eight merges since the tenth check (#119 to #126), with inspections
  now moving on by themselves (#121) beside three offline sends (site update,
  defect, inspection), and the office Inbox, overview and Team tab changed.
- Checked main at f6fda15 (#124), then 261611e (#125) and 6def5e8 (#126) as
  they merged: typecheck, `npm test` (146 + 524 at 6def5e8), build. All 91
  browser check scripts one at a time at f6fda15: 90 pass first time;
  `verify-day-walkthrough` timed out once on "What needs doing" under "More
  for the office" and passed on both reruns (unchanged since #114). Rerun at
  261611e: the 17 checks for the Team tab, office, Help, accessibility,
  inspections and sending with no signal. Rerun at 6def5e8: My week (both),
  Help, day walk-through, role access, engineer layout, signature reload,
  search, PDF viewer. All pass. Clean Docker build (no cache) of 6def5e8:
  healthy, /signin 200. No deploy change: no new settings, packages, data
  change or offline store version (`relay-public-v14`).
- A scratch walk (105 checks, not kept in the repo) at 261611e and 6def5e8:
  a double tap on Satisfactory answers one check, not two; a mis-tap shows
  on its row and changes in place; answers made with no signal survive a
  reload; a signed inspection sent with no signal, with a second tab and
  "Try now" as signal returned, arrives once with all 12 answers. One phone
  holding a site update, a quick defect and an offline-signed inspection:
  each arrives exactly once across two tabs and a reload. Office and engineer
  pages at 390px and 1440px, light and dark: no errors, no sideways scroll.
- No fault found, so no fix PR.
- Seen, not changed: a site update sent with no signal goes by itself only
  while its page is open (#105); a defect goes from any page (#116). Moving
  on leaves the update on home as "Send today's update". Proposal: send it
  from any page, like a defect.
- Release notes updated in project files
  (`releases/2026-10-20-release-notes.md`).
- Not verified: real phones, real weak signal, a locked phone, screen
  readers, printers, tablets.
- Next: deploy 6def5e8 when Cal says so (deploy thread).

## 2026-10-21 — My week counts every issue raised, and says what happened to a fix

- Why: written up in PR #123. My week's "Defects flagged" counted only defects
  flagged on their own, so an engineer who raised every defect in their site
  updates read 0; and "Put forward as fixed" stayed on an issue the office had
  since sent back or closed. Decided without asking Cal (his autonomy message
  and 07:02 ask). Not a `docs/tasks.json` task; no status changed.
- Office side checked: the Weekly summary's "Issues raised" counts every issue
  raised on the project that week by its UK raised day, whatever route (report
  defect and access cards, inspection actions, defects flagged on their own).
  The overview and Last visit name people and count report cards, not issues
  per person. The office count was right, so only My week changed.
- Now (`lib/myWeek.ts`, `MyWeekPage.tsx`): the tile is "Issues raised": every
  issue the person raised in the week on projects open to them
  (`raisedIssue` from `lib/cameBack.ts`, by `raisedAt` UK day), each once, the
  same rule as the Weekly summary. A further sighting in a later update, or a
  sent correction, links to the existing issue and raises nothing, so neither
  counts again. Issues raised in a report stay under that report's line ("2
  defects, 1 access problem"); only defects flagged on their own get a row, as
  before. `totals.flagged` became `totals.raised`. A "Put forward as fixed" row
  now adds "Since then the office sent it back as not finished." (reopened
  first), "Since then the office checked it and closed it." (verified first,
  or closed in SharePoint with no decision recorded here), or "Since then the
  office closed it, then opened it again." The footnote says what the count
  covers. Help "What's new" line `my-week-issues-raised`.
- Edge: a report sent this week for last week's visit is listed under last
  week, but its issues count in the week they were raised, as on the Weekly
  summary; the footnote says so. Duplicates the office withdraws still count,
  as on the Weekly summary.
- Fresh-context review: no correctness bugs; three low findings fixed (the
  footnote line above, "closed, then opened again" instead of "sent back",
  SharePoint closures say closed).
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 521; two new `myWeek.test.ts` cases),
  build. New `scripts/verify-my-week-counts.mjs` (13 checks): seeds through the
  real code a site update with two defects and an access problem, a later
  sighting, a sent correction, another engineer's defect, a fix sent back and
  one closed; flags a defect from the phone; checks Issues raised 3 then 4 at
  390px light and dark, the two "Since then" lines, and the office Weekly
  summary's Issues raised 4 for the same site and week. `verify-my-week`
  updated for the new label and passes. Screenshots in project files
  `ui-review/my-week-counts/`.
- Not verified: real phones, screen readers.

## 2026-10-21 — "Last sent" on the Team tab

- Why: walked the office getting a new site reporting on main 88d0589
  (1440px, local example data, no SharePoint, Entra or email): the new
  project, a new engineer added on the Team tab, an engineer already on
  another site moving to it, through to the first update. Projects come from
  the SharePoint Project Tracker, so RELAY has no "add a project" step; with
  SharePoint off the new site is an example project ("No visit yet" on the
  overview). Adding the engineer took 4 clicks and 3 fields, and the welcome
  message works. The gap was after that: the list's "Now" column said "No
  session" for almost everyone, so never signed in looked the same as signed
  in yesterday (one click per person to find out), and nothing said which
  site anyone was reporting from (scan every project row or the Inbox).
  Picked and built without asking Cal (his autonomy message; 07:02 ask that
  the office gets the information it needs easily); coordinator agreed. Not a
  `docs/tasks.json` task; no status changed.
- Changed: the Team list (Admin's and Manager's) has "Last sent" instead of
  "Now": the site of the person's latest sent report and the visit day
  ("Kirkstall Gate - Phase 2 · Visit today"), linked to that report;
  "Nothing sent yet" (with when they signed in, while a sign-in is on
  record); or "Not signed in yet". Drafts do not count, and the latest visit
  day wins, so a correction to an old report or an update sent days late does
  not move someone back to an old site. Reports sent under any account id the person signed in
  with count (`lib/teamActivity.ts`, `/api/office/team` adds `lastSent`).
  Whether someone is signed in now moved to their own panel ("Signed in now"
  / "Not signed in now" under Signed in) for the Admin, and to "Signed in
  now" under "Signed in at" on the Manager's list, so nothing the session
  showed is lost. Help "What's new" line added.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 522 after merging main, 3 new in `teamActivity.test.ts`),
  build. New `scripts/verify-team-last-sent.mjs` (58 checks; Admin 1440 dark
  and light, Manager 1440 dark and light, Admin 390 light): not signed in
  yet, nothing sent yet after signing in with only a draft, then the new site
  and today for the new engineer and for the engineer who moved; the site
  opens the report; a late correction to an old site does not move Ray back;
  signed in now on the panel and the Manager's list; no session words left; axe;
  no sideways scroll. Also passed: verify-first-day, verify-office-registers,
  verify-help (second run; the first stopped on its known title race),
  verify-september-office, verify-role-access, verify-first-time-use.
  Screenshots: project files `ui-review/new-site-setup/`.
- Not verified: a live tenant (real sign-ins, real projects from SharePoint),
  a real phone, a screen reader.
- Next (proposals from the walk, not built): the welcome message could name
  the engineer's site and link straight to it (`/engineer?project=`), so a new
  starter skips "Which site are you on?"; the 16 roster people with "Name
  needed" crowd the list during setup.

## 2026-10-21 — Engineer's end of week: "Yours" on the Issues tab

- Why: a walk of an engineer's Friday afternoon on main at 390px, light and
  dark (three sites, three weeks of their own reports, defects for their trade
  and others', one sent back by the office with a question, two unsent drafts).
  My week, Unfinished reports and the Weekly summary did their job: both unsent
  drafts were called out. The hunt was "what is still mine to do on each
  site?": Issues opened on one project with every trade's open issues mixed in;
  seeing every site meant "All projects" in a dropdown (two taps), then about
  2,800px of every trade's issues, each site with its own Open / Reported by me
  / All buttons; and Back from an issue reset the dropdown to "This project",
  so the next site's issue had gone. Putting two issues on two sites forward as
  fixed took 11 taps from home. Decided without asking Cal (his autonomy
  message, and his 07:02 ask for an easy system). Not a `docs/tasks.json` task;
  no status changed.
- Now (`EngineerWorkspace.tsx`, `EngineerIssueList.tsx`, `lib/yourIssues.ts`):
  the Issues tab opens on "Yours": on every site the engineer works on, the
  open issues they raised, added to, or that are for their trade, a section
  per site (the one they are on first) with "N to do". Sent back or written on
  by the office comes first, marked "Sent back" with what the office wrote (the
  #110 two-line word); then newest first. Put forward as fixed waits on the
  office, so it leaves the list and the site says "N put forward as fixed,
  waiting for the office to check". One row of buttons for every site: Yours /
  Open / All issues ("Reported by me" folded into Yours); the project dropdown
  shows only for Open and All. The choice is kept in the address (`show`,
  `scope`), so Back from an issue returns to the same list. Cards are the #94
  short cards.
- Trade: RELAY records the company fixing an issue, not a person, so trade is
  the nearest thing to "assigned to me". An engineer with no trade set still
  gets what they raised or added to. Nothing open says so ("Nothing open for
  you on any of your N sites") with one tap to "See all issues".
- After: two issues on two sites put forward in 7 taps from home (was 11);
  the Yours page in the check's data is 1,791px at 390px, against 2,817px for
  every trade on all projects.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 518; new `yourIssues.test.ts`), build.
  New `scripts/verify-issues-yours.mjs` (43 checks: 390px light whole flow
  with tap count, 390px and 1440px dark, no trade, nothing open, Open/All keep
  the project choice after Back, 48px targets, no sideways scroll). Updated for
  the new default: `verify-simpler-issue-list` (Yours replaces Reported by me),
  `verify-engineer-day`, `verify-engineer-layout` and `verify-day-walkthrough`
  (press Open, or `show=open`, where they check every trade),
  `verify-first-time-use` (Yours empty message, and Open's).
  Also run and passing: verify-navigation, verify-engineer-nav,
  verify-came-back-first, verify-came-back-to-update, verify-simpler-issue-page,
  verify-snag-list, verify-help, verify-accessibility, verify-role-access,
  verify-search, verify-signature-reload, verify-my-week, verify-office-words,
  verify-issue-trend, verify-office-actions, verify-review-queue,
  verify-weekly-summary, verify-busy-projects.
- The home's "Site issues" row counts every trade's open issues on the
  project, so it opens "Open" on that project; the Issues button opens Yours.
- Speed: the first build loaded every trade's issues on every site for Yours,
  and `verify-busy-projects` caught it (Engineer issues 790 KB, budget 400).
  Yours now asks the server for the engineer's own open issues only
  (`GET /api/issues?only=yours`, same `isYours` rule, access-checked per
  project): 130 KB, 2.1 s against a 4.5 s budget.
- Fresh-context review found four things, all fixed: the old one-project list
  could flash under Yours when tapping Issues again (the list now clears
  whenever its source changes: Yours, one project or all projects); the
  home's "Site issues" row said "every trade" but opened Yours (it now opens
  Open); site headings read "Tetley Hall3 to do" to a screen reader (space
  added); the heading mentioned a trade for engineers with none, and the empty
  state's "See all issues" showed one project (now every project).
  A second review found two more, fixed: the defect receipt's "View project
  issues" opened Yours (it now opens Open on the project, and
  verify-engineer-layout checks it), and the empty Yours line mentioned a
  trade for engineers with none.
- Help: "What's new" line `issues-yours`.
- Screenshots: `ui-review/end-of-week-pass/` in project files.
- Not verified: real phones, screen readers, an engineer working across
  trades (RELAY keeps one trade per person).
- Seen, not changed: My week's "Defects flagged 0" counts only defects flagged
  on their own, so a week of defects raised from site updates reads as none;
  My week shows "Put forward as fixed" for an issue the office has since sent
  back or closed. Both are small My week wording jobs.

## 2026-10-21 — Last week's summary from the office overview

- Why: walked an office manager's Monday look back at last week on main
  88d0589 at the desk (1440, dark and light; three projects, three engineers,
  six weeks of seeded reports, issues and variations). The Weekly summary
  answers the questions well (who came on which day, the work in their
  words, issues raised and closed, what is still open, print to PDF).
  Reaching last week was the hard part: the overview speaks only of this
  week ("0 visits, nobody yet" on every project on a Monday morning); the
  Weekly summary link is the first of six under "Latest from site" on the
  project sheet, about 1,220px down a 900px window; and it opens on this
  week, so Previous week is another click. Three projects took 7 clicks and
  a scroll. Coordinator approved the pick; decided without asking Cal (his
  autonomy message, and the 07:02 ask that the office gets what it needs
  easily). Not a `docs/tasks.json` task; no status changed.
- Changed (`ProjectsView.tsx`, `workspace.css`, `WeeklySummaryPage.tsx`):
  each row of "Where each project stands" has "Last week's summary" under
  the project's reference (spoken as "Last week's summary for <project>").
  It opens that project's Weekly summary on last Monday to Sunday, and Back
  returns to the overview. The project box at the top of the summary keeps
  the week, so the next project is one pick away. The row still opens the
  project: the project name is now the row's link, stretched over the row,
  with the summary link above it (a link cannot sit inside a link). The
  focus ring still goes round the whole row. Desk rows keep their height
  (79px at 1440, 93px at 1280, as before); on a phone the link shares the
  reference line and is 44px tall (rows 25px taller). The summary's
  heading now says "· last week" after the dates (as it says "· this week
  so far"), on screen and on paper. Help "What's new" line and the office
  guide's "For the site meeting" updated.
- Result: three projects' last week in 5 clicks with no scrolling (was 7
  and a scroll), straight from the overview.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 514), build. New
  `scripts/verify-office-weekly-review.mjs` (53; 1440 dark and light, 1280,
  390): a link a row named for its project, its address (project, last
  Monday, back to the overview), tap size, name column no taller than the
  figures, the link on top of the row, axe on the project list, Tab from
  project to its summary with a ring, the rest of the row still opens the
  project, the summary shows last week only and says "last week", another
  project keeps the week, the printed heading, two weeks back is dates only,
  this week still "so far", Back to the overview. `verify-accessibility`:
  the project name link is allowed under 44px on a phone (its row is the
  target) and a ring drawn by `::after` counts. Also passed:
  verify-accessibility (584), verify-office-progress, verify-office-phone,
  verify-office-landing, verify-weekly-summary, verify-help,
  verify-office-sections, verify-seen-by-office, verify-site-diary,
  verify-photo-library, verify-office-links, verify-role-access,
  verify-first-time-use, verify-day-walkthrough.
- Screenshots: project files `ui-review/office-weekly-review/`.
- Not verified: a real phone, a screen reader.
- Seen on the walk, not built: the overview's "This week" counts
  inspections as visits while the summary's "Site reports" does not, so
  the two numbers differ; the summary's "On site" is long for a busy week
  (3,500px for seven reports).

## 2026-10-21 — Quicker inspections on a phone

- Why: walked an engineer through a handover inspection on main 433691d at
  390px (12 checks: three needing action, each with a recent place, words
  and a photo; one not applicable; the rest satisfactory; draw a signature,
  send). 43 taps and about 3,960px of scrolling. Ten of the taps did nothing
  but move on: "Next check" after every satisfactory or not applicable
  answer (8), "All answered · check & sign" (1), and opening check 1, since
  on a phone no check was open on arrival (the wide editor already opened
  it). The Recent places panel on an action check was the old boxed list,
  one full-width row per place (about 260px with its Where box), where site
  update cards have had compact chips since #107. Coordinator approved the
  pick; decided without asking Cal, per his 07:02 ask (fewer taps, less on
  screen). Not a `docs/tasks.json` task; no status changed.
- Changed (report editor, `CheckEditor.tsx`, `reports/[id]/page.tsx`):
  on a phone an inspection opens at its first check still to answer (once,
  as the draft opens, like #114's empty card). A first answer of
  Satisfactory or Not applicable opens the next check still to answer by
  itself, with focus on it (its row on a phone, its body side by side);
  after the last one Check & sign opens, focus on its heading, Back returns
  to the checks. Action needed stays open to fill in, and changing an
  answer already given never moves on. The folded row now says the answer
  in words ("Satisfactory", "Action needed", "Not applicable", was "OK",
  "Action", "N/A") so a mis-tap is easy to spot; one tap on the row opens
  the check again. Recent places on an action check are compact chips
  (`Suggestions compact`, as on site update cards), with the places this
  inspection's other checks named first (`placesToOffer` now includes
  checks when asked for a check). Recent companies unchanged. Safety and
  tower inspections (behind the Safety, permits and deliveries switch) get
  the same behaviour through the shared editor; nothing else of theirs
  changed. Help "What's new" line added.
- Review (fresh context) found two small gaps, both fixed: a check's change
  now builds on the latest copy of the report (a photograph read in the
  background could have undone an answer given meanwhile; this was already
  so before), and a check moves on at most once, so a quick second tap
  before the page redraws cannot leave Action needed folded.
- Result: the same walk is 33 taps and about 3,220px of scrolling. The Where
  box with its places is 125px.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 514, 1 new in `quickCards.test.ts`),
  build. New `scripts/verify-quicker-inspections.mjs` (100, light and dark
  at 390px, dark at 1440px): first check open on arrival, Satisfactory moves
  on with focus, no "Next check" on a check still to answer, the row says
  Satisfactory, one tap reopens, Action needed and a changed answer stay
  put, compact chips (no count, shared rows, 48px), this inspection's place
  first, a chip fills Where and is saved, the last answer opens Check &
  sign with focus, all answers saved, every row says its answer, axe on an
  open action check, no sideways scroll. Updated for the new flow (they
  tapped "Next check" after every answer, or tapped check 1's row, which now
  folds it): verify-handover-inspection, verify-first-fix-inspection,
  verify-report-types, verify-tower-inspection, verify-editor-usability,
  verify-editor-wide, verify-accessibility, verify-day-walkthrough; all
  pass (verify-day-walkthrough, 114, after merging main with #120's fix to
  its permit step; its first run after the merge stopped before the
  inspections, the second passed). Also passed: verify-offline-inspection, verify-offline-sign,
  verify-handover-offline, verify-typed-signature, verify-safety-actions,
  verify-recent-places, verify-fewest-taps, verify-quicker-update,
  verify-help. Screenshots before and after: project files
  `ui-review/quicker-inspections/`.
- Not verified: a real phone, a screen reader.

## 2026-10-21 — Inbox report on its own screen on a phone

- Why: a manager's phone walk on main (390px, light and dark; three
  projects, three engineers, four weeks of reports, 214 in the Inbox) checked
  who was on site today, what each engineer sent, what came back fixed, and
  putting one item back. Most of it was fine: who was on site today is on the
  overview's first screen (#118), fixed items open to Verify or Not finished
  in one or two taps, a project opens with its four figures (#111). The
  break was the Inbox: tapping a report only highlighted the row, because the
  reader opened under the whole list, 41,819px down. Picked and built without
  asking Cal (his autonomy message; 07:02 ask that the office gets what it
  needs easily). Not a `docs/tasks.json` task; no status changed.
- Change (`InboxView.tsx`, `workspace.css`, phone only, 700px and under):
  with a report open the Inbox heading, filters and list step aside, so the
  report is at the top of the screen. "‹ Inbox" (44px tall) in the reader's
  heading, and the phone's own Back, return to the list at the place it was
  scrolled to, with the same filter. How: picking a report notes the filter
  and scroll position on the list's own history entry (`replaceState`), and
  the list reads it back when that entry comes back. A popstate flag did not
  work: the router re-renders before a second listener runs. The Inbox tab
  pushes a fresh entry with no note, so it still opens on All at the top,
  even with a report open. A report opened by its address has "‹ Inbox" go
  to the list. Leaving the Inbox for another tab and coming back by Back
  restores the list too; "‹ Inbox" after that opens it on All. Opening still
  marks it seen (#88). "Drafts on site" with a report in the address keeps
  its filters on screen. The button's spoken name is "Back to Inbox". The
  desk keeps the list and reader side by side (1440 and 1280 checked).
- Same screen: inspection tags ("Tower inspection · Podium P3, plant room")
  were cut off at the right edge of phone rows; `.kind` tags now wrap in
  phone cards like `.tag` does. An empty "Status" label (a report nobody has
  opened) no longer shows on phone rows.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 513), build. New
  `scripts/verify-inbox-phone.mjs` (58): report at the top, list hidden,
  Seen by the office, "‹ Inbox" and Back return within 40px of the place,
  "Not seen yet" kept (count one fewer), the Inbox tab pressed with a report
  open goes to All at the top, Back after turning the phone sideways keeps
  the filter, Drafts on site keeps its filters, no tag cut,
  no sideways scroll, desk side by side at 1440 dark and 1280 light.
  `verify-office-inbox` now expects the report on its own on a phone (was
  "the reader is under the list"). Also run and passing: verify-office-inbox
  (80), verify-seen-by-office, verify-office-phone, verify-help,
  verify-office-sections, verify-office-links, verify-role-access,
  verify-accessibility (584), verify-day-walkthrough, verify-first-time-use,
  verify-office-actions, verify-office-desk, verify-office-registers,
  verify-review-queue, verify-september-office. verify-day-walkthrough
  failed once and passed on a rerun on the same build (no Inbox step failed).
- A fresh-context review found no blocking bugs and five smaller points:
  the Inbox tab and the phone turned sideways (both fixed as above), Drafts
  on site (fixed), the "‹" read aloud (fixed), and a check that did not test
  the tab (now it does).
- Screenshots: project files `ui-review/manager-phone-pass/` (before: a
  tapped report with nothing visible changing, a cut tag; after: the report
  open, the list, the desk).
- Not verified: real phones (iPhone or Android Back gesture), screen readers.
- Next (proposal, not built): Inbox rows on a phone are up to 221px tall
  (label column for each field), so 214 reports are about 44,000px; a
  two-line phone row (who · project · time, then what was found) would
  roughly halve that.

## 2026-10-21 — Tenth release check: main ready at 0d56773

- Why: about ten merges since the ninth check (#110 to #118), several on the
  same screens (engineer home, report editor, Flag a defect, office phone),
  and two offline sends (#105 site update, #116 defect) that now meet.
- Checked main at c405f31 (#116), then again in full at 0d56773 once #117
  and #118 merged: typecheck, `npm test` (146 + 513), build, all 86 browser
  check scripts one at a time (all pass at 0d56773 with this PR's fix to the
  day walk-through below, verify-busy-projects too), and
  a clean Docker build (healthy, /signin 200). No deploy change: no new
  settings, packages, data change or offline store version (`relay-public-v14`).
- A scratch walk (not kept in the repo) at 390px and 1440px, light and dark:
  a site update and a defect both sent with no signal, a third tab opened as
  signal returned, "Try again" during the send, reloads: exactly one report
  and one issue each time, nothing left on the phone; then the office pages
  (overview, project, Issues, Weekly summary, Site diary, Photographs, the
  report) with no errors or sideways scroll.
- One failure, in a check, not the app: `verify-day-walkthrough` timed out
  saving a permit. After 17:00 UK the permit form leaves "Runs until" empty
  on purpose (`defaultEnds` in `PermitsPage.tsx`) and the check never filled
  it, so it failed every evening on any build. It now fills noon tomorrow,
  UK time (date worked out as in `verify-permits`); the script's 114 checks
  pass.
- Seen, not changed: a defect still waiting for signal is not shown on the
  engineer home (a site update is); #116 lists it as next.
- Release notes updated in project files
  (`releases/2026-10-20-release-notes.md`).
- Not verified: real phones, real weak signal, a locked phone, screen
  readers, printers, tablets.
- Not covered: #119 (office Inbox), merged after this check; it waits for
  the next one.
- Next: deploy 0d56773 when Cal says so (deploy thread).

## 2026-10-21 — Office Inbox tidy-up

- Why: the office walk-through for #118 (1440px, dark and light, weeks of
  reports from three engineers on three sites) found three Inbox problems.
  Coordinator queued them as one PR; decided without asking Cal, per his
  autonomy message and his 07:02 ask for less on screen. Not a
  `docs/tasks.json` task; no status changed.
- Inbox with nothing open (`InboxView.tsx`): the empty Reader panel (440px,
  "Select a report to read it here", "Open the newest") has gone, so the list
  has the whole width (1,392px at 1440, was 928px). Project and engineer names
  stay on one line at a desk (`.inbox-list`, above 700px); "Found" wraps
  instead. Picking a report brings the reader in beside the list as before;
  then the list leaves "Found" to the reader (it shows it for the open
  report) and names may wrap, so a laptop never scrolls sideways (the review
  caught 102px of sideways scroll at 1200px with names kept on one line).
  With busy reports (defects, a variation, access, progress) rows were up to
  85px with names on two lines at 1440 (four lines at 1280 with a report
  open); now 65px, names on one line, at 1440 and 1280 open or not, and two
  lines at most at 1200 with a report open. On a phone the empty reader under
  the list has gone too.
- "Not seen yet" order (`lib/officeActions.ts`): the office position's group
  listed oldest first. That came from #15 (four action groups), when "Not yet
  read" was a queue worked through with an Acknowledge button, so the longest
  wait went first. Since #88 opening a report is what marks it seen, so there
  is no queue to work through; and with four rows shown, an old unopened
  report could push today's newest out of view altogether (it did in the
  check's data: today's Tetley Hall report was missing). The group's "Show
  all" opened the Inbox, which was already newest first, so the two orders
  disagreed. Decision: newest first, the same as the Inbox. Older unopened
  reports still count in the group's number and are a click away.
- Today: a report received today says "Today, 14:05" in the Inbox and in
  "Not seen yet" (`fmtReceived` in `office/model.ts`, London day). No "Today"
  filter: with newest first, today's reports are the top rows and say so, and
  the existing New filter (since the last working day) covers "what came in";
  another chip would be one more control for what the list already shows.
- Light theme `--access` (#5f7a9c to #4c6585): the "1 access" tag was below
  4.5:1 on the panel (axe colour-contrast on the Inbox), now passes.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 513; `officeActions` test now expects
  newest first), build. New `scripts/verify-office-inbox.mjs` (80, 1440px dark
  and light, 1280px dark, 1200px light, 390px light; `RELAY_REPORT_ONLY=1`
  measures older builds; sideways scroll measured on the page and the desk's
  own scrolling view): no reader with nothing open, list width, names on one
  line, rows at most 72px, Found left to the reader once one is open, newest first in the Inbox and both "Not seen yet" lists, "Today" with
  the time, reader beside the list once opened with its edge, axe, no
  sideways scroll. Help "What's new" line added. Screenshots before and after:
  project files `ui-review/office-inbox/`.
- Not verified: a real phone or tablet, a screen reader.

## 2026-10-21 — Everyone who was on site, on the office overview

- Why: walked an office manager's end-of-day check at the desk (1440px, dark
  and light, 42 days of seeded reports from three engineers on three sites).
  "Who was on each site today?" comes first, but "Where each project stands"
  named only the last person to send: Tetley Hall said "Sam Spark,
  Electrical" when Hana Duct and Pat Pipe had sent from there too. Finding
  everyone took a click per project and reading Latest from site; Site
  coverage gives trades, not names. Coordinator approved the pick; decided
  without asking Cal, per his autonomy message. Not a `docs/tasks.json` task;
  no status changed.
- Changed: `projectStanding` now returns `lastDayPeople` (everyone who sent a
  visit on the last visit day, once each by sign-in, in Site coverage's
  order; a correction stands
  in for what it corrects, an inspection is a visit, as before), and
  `peopleWords` says it: one person with their trade, two or three by name,
  past three "A, B and N more". The overview's Last visit cell and the
  project sheet's Last visit figure (desk and phone) use it. The day stays as
  it was ("Today", "Yesterday" or the date), so an earlier visit never reads
  as today. On the overview a quiet site still shows how long it has gone
  quiet there instead; the project column line and Site coverage still
  name one visit (left as they were). The names stay on one line at 1440px. Help "What's new" line added.
- Checked: typecheck, `npm test` (146 + 511, 2 new in
  `tests/projectStanding.test.ts`), build. `verify-office-progress` (84, new:
  everyone named on the overview and sheet, the names on one line at 1440px, a quiet site's
  earlier day names its people and never says today), office-links (65),
  home-and-sheet (254), office-sections (63), office-desk (73), help (36),
  office-phone (99), office-landing (19), role-access (95). Screenshots
  before/after in project files `ui-review/office-progress-pass/`.
- Not verified: a real phone or tablet, a screen reader.
- Noticed on the walk, not built (queued by the coordinator): the Inbox table
  is squashed when no report is open (project names wrap to 3 or 4 lines);
  "Not seen yet" lists oldest first so today's arrive at the bottom; the
  Inbox has no "Today" filter.

## 2026-10-21 — The office's answers first on the engineer's home

- Why: walked one engineer's whole visit at 390px on main a3bbb55 (open
  RELAY, pick the site, a two-card site update with three photos, a quick
  defect, fix an issue the office sent back, send, leave): 26 taps, with no
  wasted screens left after #105-#115. The weak spot was the home screen:
  "Came back from the office" started at 1,012px, below the first screen
  (775px above the bottom bar), under the two inspection tiles, and the
  office's question was the third of four rows, behind the engineer's own new
  defect and a report the office had only received. Cal (07:02) wants an easy
  system that gets the office the information it needs; an answer the
  engineer does not see is not acted on. Coordinator agreed the pick; decided
  without asking Cal, per his autonomy message. Not a `docs/tasks.json` task;
  no status changed.
- Change (`EngineerWorkspace.tsx`, `lib/cameBack.ts`): "Came back from the
  office" now sits under "Flag a defect" and "Request a variation" (and under
  "Unfinished reports" when there are any), above Inspections, in the page order (so screen readers and the keyboard
  meet it there too). Rows the office wrote on, or sent back, come first,
  newest first; the rest follow newest first (`waitingOnYouFirst`). Sent back
  means a returned report not yet corrected, an issue disputed from a returned
  report, or an issue the office reopened ("Not finished", note or not) that
  the engineer has not added to since (`issueReopened`). The line under the tiles ("A
  defect goes to the office as soon as you send it. Your site update stays a
  draft until you sign and send it.") is gone: the tiles already say both, it
  said nothing about no signal, and signing a site update is optional now. On
  a desktop the section moves from the top of the right-hand column to under
  the buttons on the left (still on the first screen, 631px); Since your last
  visit now heads the right-hand column. Help "What's new" line and the
  "After you send" guide updated. Taps unchanged; what changes is scrolling
  and reading past rows.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (new unit tests for the order and for
  `issueReopened`), build. New `scripts/verify-came-back-first.mjs`
  (29 checks, 390px light and dark, 1440px dark, where the office reopens
  without a note; `RELAY_MEASURE_ONLY=1` gives
  main's numbers): before Inspections in page order; the answered issue is
  the first row, its title and the office's words on the first screen (words
  end 740px, screen ends 775px; on main the row was 1,012-1,110px and third);
  the rest newest first; no help line; rows 48px+; no sideways scroll; tapping
  it opens the issue ready to update. Reran, all passing: office-words,
  came-back-to-update, simpler-home, engineer-layout, home-and-sheet (its
  section order updated to the new one), help, accessibility, first-time-use,
  since-last-visit, seen-by-office, first-day, role-access,
  unfinished-reports, engineer-nav. `verify-day-walkthrough` fails at saving
  a permit to work (`.pt-permit` never shows), the same on main a3bbb55, so
  not this change; left for the next release check. Screenshots before and after: project files
  `ui-review/site-visit-pass/`.
- The first-screen measurement is with no unfinished reports; with some, the
  section starts lower.
- Not changed: `/api/came-back` still sends the engineer's six newest issues
  and variations, so an office question on an older issue, behind six newer
  ones of theirs, still does not show (as before). An assignment's note is
  still not shown as the office writing (by design since #110).
- Not verified: a real phone, a screen reader.

## 2026-10-21 — Defects send by themselves when signal returns

- Why: Cal's 07:02 direction (engineers are hands-on people). After #113 a
  defect flagged with no signal stayed on the phone as "Defect not sent yet"
  until the engineer came back and tapped "Try again"; a site update has gone
  by itself since #105. Engineers should not have to remember. Decided
  without asking Cal, per his autonomy message. Not a `docs/tasks.json` task;
  no status changed.
- What changed:
  - New `lib/heldDefect.ts`: the one way a frozen defect is sent, by a tap or
    by itself. It reads the defect the phone already holds
    (`relay-defect:<person>:<project>`), so only a defect the engineer tapped
    Send on goes, as they wrote it.
  - New `components/DefectsOnSignal.tsx` in the root layout: on every RELAY
    page (the report editor too) it sends held defects when the phone says it
    is online, when RELAY comes back into view, and every 15 s, like #105. No
    background sync, so a closed RELAY sends when it is next opened. Away from
    the defect screen it says "Defect sent to the office by itself once there
    was signal: <ref>" with "Open it".
  - The defect screen says "Waiting for signal" (or "Waiting for RELAY's
    server") and that it goes by itself, keeps "Try again", and once sent says
    "Sent by itself once there was signal."
- Only once:
  - The server already keeps one issue per person and request id.
  - On the phone, sends from one page share one upload. Tabs take turns with
    a Web Lock, and a tab only sends by itself while the phone still holds
    that request.
  - A receipt left on the phone (`relay-defect-receipt:<person>:<project>`)
    lets another tab show it went without uploading again.
- A refusal (403, 409, a missing photo) is not retried by itself until RELAY
  is reopened or "Try again" is tapped; it says "RELAY did not take it". A 422 or
  413 unfreezes it to change, as before. Signed out (401), a server fault, or
  the route's own 400 "retry the same submission" keep waiting.
- Fresh-context review found 5 points, all fixed: after a refusal, "Try
  again" with no signal said it would go by itself but would not; a normal
  send could be labelled "sent by itself"; a tab left open by someone who
  signed out on a shared phone could send their defect in the new person's
  name (it now checks the person last signed in on the phone first); Help
  said "any page", but the "No signal" page sends nothing; the refusal note's
  "Open it" did not change the engineer home, and it had no Dismiss.
- Checked: typecheck, `npm test` (146 + 509, 12 new in
  `tests/heldDefect.test.ts`), build. New
  `scripts/verify-defect-send-on-signal.mjs` (96 checks: 390px light and
  dark, 1440px dark). It covers: sent by itself on the defect screen, from the
  Site page, and when RELAY opens again; two tabs at once (one issue, one
  upload); "Try again" as it goes by itself (one upload); a lost answer then a
  flicker of signal (one issue); a defect not sent is never sent by itself; a
  refusal not retried. Passed 5 runs in a row on the final build.
  `verify-defect-recent-places` now keeps uploads cut off until its "Try
  again" taps, because the defect would otherwise go by itself first (87
  checks, passed 3 runs in a row). Also passed: send-on-signal,
  engineer-layout, offline-capture, help, accessibility (584), role-access,
  engineer-day.
- Not verified: a real phone, real weak signal, a locked phone that pauses
  the page, browsers without Web Locks (the server still keeps one issue).
- Next: the home screen could show a defect still waiting to go, as it does
  for a site update.

## 2026-10-21 — Whole project names on a phone

- Why: after #111 a project opened in the office on a phone headed its
  register "REGISTER · TETLEY HA…", so the office could not see at a glance
  which site it was looking at. Cal (07:02) wants the office to get what it
  needs plainly. Coordinator's pick; decided without asking Cal, per his
  autonomy message. Not a `docs/tasks.json` task; no status changed.
- Walked 16 phone screens at 390px, light and dark, with the project renamed
  locally to "Tetley Hall - Block E, Phase 2 Residential" (not committed):
  engineer home, Reports, Issues, Projects, Weekly summary, Site diary,
  Photographs, project page, snag list, and the office overview, project,
  report, issue, Weekly summary, Site diary and Photographs. For each element
  showing the name it measured whether the text was cut or ran off screen.
  Only the office column heading cut it; every other name already wrapped.
- Changed (CSS only, phones up to 700px; the desk is unchanged): office
  column headings wrap instead of ending in "…". Where a heading has a back
  link ("‹ Projects", "‹ Register"), the link and the counts share the top
  line and the heading has the line under it. The back link no longer breaks
  over two lines. No wording, pages or routes changed. Help "What's new":
  "Whole project names on a phone".
- Checks: `verify-office-phone` now checks the register heading shows the
  whole name on its own line under the back link at 320px and 390px (fails on
  main at 320px light, passes with the change).
- Not verified: a real phone, a screen reader, the live server.

## 2026-10-21 — Quicker site update writing

- Why: Cal's 07:02 direction (simple for hands-on engineers). The #110
  walk-through found two slow spots in the site update editor at 390px: an
  empty card opened from "Carry on" was folded (one more tap before typing),
  and each photo tile was 287px tall with "On the server" on it, so four
  photos took 586px and pushed the next card far down. Decided without asking
  Cal, per his autonomy message. Not a `docs/tasks.json` task; no status changed.
- Change: on a phone, a draft whose last card is still empty (`isBlankCard`)
  opens that card ready to type, once as it opens (not with `?add=`, not
  inspections, not wide screens, which already open the last card). Cards
  with anything on them stay folded. Photo tiles (`PhotoField`, used by update
  cards and inspection checks) are now the picture with the caption box under
  it: photo number top left, Remove top right (48px, away from the caption),
  and where it is bottom left. "On the server" shows as a green dot and is
  still read out to screen readers; "Not yet on the server" and "Only on this
  phone" still show in words. 287px to 179px a tile, four photos 586px to
  369px at 390px. Display only: no new photo features (FE-2 stays out). Help
  "What's new" line.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test`, build. New `scripts/verify-quicker-update.mjs`
  (109 checks, 390px light and dark, 1440px dark): empty card opens ready to
  type from "Carry on" and saves typing; once written it opens folded; only
  the empty third card opens on a three-card draft; tile height, two to a
  row, Remove 48px on the picture and clear of the caption, "On the server"
  read out but a dot, a photo added with no signal says so in words, a
  caption saves, Remove works, no sideways scroll. Also rerun, one at a time
  all passing: one-caption-line, send-on-signal, recent-places,
  fewest-taps, lighter-card, offline-capture, photo-uploads, undo-remove,
  editor-wide, engineer-layout, help, report-types, accessibility (its
  first run caught Remove's focus ring drawn on the label, not the button;
  fixed). A fresh-context review passed; its one note (the `?add=` guard
  never fired) is fixed.
  Screenshots before and after: project files `ui-review/quicker-update/`.
- Not verified: a real phone, a screen reader.

## 2026-10-21 — Quick defect: recent places, no check screen

- Why: Cal's 07:02 direction (simple for hands-on engineers). The #110
  walk-through found "Flag a defect" had no recent places, so the engineer
  typed a place already used on the job; and its "Check defect" screen only
  repeated the form before "Send defect". Decided without asking Cal, per his
  autonomy message. Not a `docs/tasks.json` task; no status changed.
- Change (`components/IndividualDefect.tsx`): "Where on site?" shows #107's
  compact Recent places chips (`Suggestions compact`, unchanged), from the
  same `projectSuggestions` list a site update card uses. Free text stays; no
  list of places. The form's button sends straight away and names the site
  ("Send defect to Tetley Hall - Block E"), as the coordinator asked after
  #112's wrong-site fix. The check screen is gone; its useful parts stay: the
  site name is on the button and above the form, the sharing note is a line
  under the button, photos still block the button while they are prepared.
  A send with no receipt shows "Defect not sent yet" with what was written
  and "Try again" (same request id, so it only goes once); "Failed to fetch"
  became "No signal, or no answer from RELAY. Your defect is kept on this
  phone." A reason it can't send is scrolled into view, since the button is
  at the bottom. Help "What's new" line.
- Taps from the Site page to a sent defect with a photo: tile, photo,
  Check defect, Send defect (4) plus typing the place; now tile, photo, a
  place chip, send (4) with nothing to type for the place, or 3 when the place
  is typed.
- Limit, unchanged from before: a defect with no signal does not go by
  itself when signal returns (site updates do since #105); the engineer taps
  "Try again". Possible later task.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 493), build. New
  `scripts/verify-defect-recent-places.mjs` (87 checks, 390px light and dark,
  1440px dark): chips under Where from yesterday's update, a tap fills and is
  held on the device, the place in the box not offered, free text kept, none
  on an empty project, one tap sends with the chip's place on the issue,
  nothing sent without a description (reason in view, again on a second tap),
  no signal held through
  a reload and sent once with "Try again", a lost receipt still one issue,
  48px, no sideways scroll. `verify-engineer-layout` updated for the new
  buttons. Also passing: recent-places (site update cards unchanged, 109),
  help, engineer-day, home-and-sheet, accessibility (584), role-access.
  Screenshots: project files `ui-review/defect-recent-places/`.
- Review: a fresh-context review found one point (a repeated reason was not
  scrolled back into view), fixed and checked.
- Not verified: a real phone, real weak signal, a screen reader.

## 2026-10-21 — An engineer's first day

- Why: Cal's 07:02 direction (engineers are hands-on people, not IT people).
  If the first ten minutes confuse them, they won't use RELAY. Walked a new
  engineer's path on main at 390px, light and dark: the office adds them, then
  sign-in, home screen icon, finding the site, first update. Decided without
  asking Cal, per his autonomy message. Not a `docs/tasks.json` task; no status
  changed.
- Worst problem found: a new engineer was put on the first project in the
  list without being asked. Their first update could go to the wrong site
  unless they spotted "Change ›". Now, with more than one site and nothing
  started, RELAY asks "Which site are you on?" once (one tap) and remembers
  the answer. It does not ask with one site, with a draft, with a project in
  the link, with work waiting to send, or when RELAY was used on that phone
  before (it keeps the sites for no signal).
- Also changed:
  - The Admin's Team tab gives a copy-only welcome message for someone who has
    never signed in (checked against identities, which are kept, not sessions):
    the link straight to `/developments`, putting RELAY on the home screen,
    signing in with their work email, and finding their site. RELAY sends
    nothing.
  - The home screen icon opens `/?open=app`, which goes to the company picked
    last time (an httpOnly `relay-company` cookie set by middleware when
    `/developments` or `/compliance` is opened, not on prefetch). The hub at
    `/` still asks.
  - Sign-in says which account to use and where it leads. A missing RELAY
    role reads "Ask the office to sort it", not Entra words. The home screen
    steps are plainer, and the out-of-date line saying offline working was not
    possible is gone. It now matches what RELAY does today (start with no
    signal; send by itself when signal returns, #105).
  - Help "What's new" line and the first Help step.
- Checked: typecheck, `npm test` (146 + 497), build. New
  `scripts/verify-first-day.mjs` (94 checks: 390px light and dark, office at
  1440px dark and 390px light). On the final build, one at a time: help,
  first-time-use, engineer-day, offline-capture, accessibility,
  came-back-to-update, simpler-home, engineer-layout, office-registers,
  september-office, navigation, role-access, day-walkthrough. Also
  editor-usability, editor-wide, fewest-taps and lighter-card: these opened
  bare `/engineer` as brand-new engineers, and now set a saved site first.
  handover-offline, offline-inspection, offline-sign, site-notes-offline,
  typed-signature, signature-reload and search passed on the build before the
  review fixes, which only make the question rarer.
  Screenshots: project files `ui-review/first-day/`.
- Not verified: real phones (whether iPhone honours the manifest
  `start_url`, and the separate sign-in an iPhone home screen app needs), the
  live tenant, a real Microsoft sign-in. No Entra or SharePoint setting was
  changed. `docs/phone-installation-checks.md` lists the steps to try on a
  phone.

## 2026-10-21 — A project at a glance on a phone

- Why: Cal (2026-10-21 07:02) wants RELAY to get the office the information
  it needs. Walked an office Manager's questions on main b4d2b24 at 390px,
  light and dark, with six weeks of seeded busy-project records
  (`seed-busy-projects.mjs`, 42 days). "What's waiting on me?" (overview count
  tiles), "Was anyone on site today?" (Latest from site, Last visit) and "Which
  variations are new this week?" (Variations, order "Raised, newest first")
  each took one to three taps. The slow ones were "How is Tetley Hall going?"
  and "Show me today's photos": on a phone a project opened on the register
  alone. The sheet's four figures (Last visit, Overdue actions, Fixed, to
  check, Variations), which the desk shows and #108 made open what they
  count, were not shown at all, and Weekly summary, Site diary and
  Photographs sat about 10,900px down, under 57 issues and every variation.
  Decided without asking Cal, per his autonomy message. Not a
  `docs/tasks.json` task; no status changed.
- Changed (office project on a phone only; desk unchanged): the register
  starts with the sheet's four figures (one shared `SheetFigures`, so the
  same links as the desk), then the project's pages (Reports and records,
  Issues, Project page; the Safety group only while the switch is on), then
  Latest from site, then the register's filters and lists. The project pages
  are no longer repeated at the bottom. The register's "Last visit today ·
  Electrical" line is gone (the Last visit figure says it and opens the same
  report). No new pages, counts or routes. Help "What's new": "A project at a
  glance on a phone".
- Measured on the seeded data: Photographs link 10,928px → 539px down a
  project at 390px (on the first screen); the four figures on the first
  screen; page height about the same (11,303px → 11,493px).
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 493 after rebasing on #110), build.
  `verify-office-progress` (77; now expects the figures first, the project
  pages before Latest from site and on the first screen, listed once),
  `verify-office-links` (65; the four figures' links now checked on the
  phone too) and `verify-home-and-sheet` (254; phone links now before Latest
  from site and the register). Then one at a time: verify-september-office
  (43), verify-accessibility (584), verify-office-phone (91),
  verify-first-time-use (366), verify-help (36; failed once on its known
  tab-title race, passed twice on rerun), and before the rebase
  verify-office-sections, -desk, -landing, -registers, -actions,
  role-access, day-walkthrough, before-handover, issue-trend, site-notes,
  seen-by-office, error-messages, simpler-home, photo-library, issue-assign,
  review-queue, submission-stages, unfinished-reports. A fresh-context
  review found two points, both fixed: #108's Help line still described the
  removed last-visit link, and a phone CSS rule was left unused.
  Screenshots: project files `ui-review/project-on-phone/`.
- Not verified: a real phone, a screen reader, the live server.
- Runner-up, not built: the phone's register heading cuts the project name
  ("REGISTER · TETLEY HA…"); a plain project name at the top would help.

## 2026-10-21 — What the office wrote, where the engineer looks

- Why: Cal's 07:02 direction (simple for hands-on engineers, the office gets
  what it needs). Walking an engineer's day at 390px on main 4f08eb5 (site
  gate, a site update with three photos, a defect, a variation, an issue the
  office queried, the next morning), the worst moment left was the queried
  issue: the office sent a fix back with "Still a gap at the top of the
  riser. Can you send a photo of the top?", but the home row said only "In
  progress" and the issue page hid the question in folded History (a
  disputed one even said "Open History for why"). The engineer could not see
  what was asked without digging, so would ring the office or not answer.
  Runners-up noted below. Decided without asking Cal, per his autonomy
  message. Not a `docs/tasks.json` task; no status changed.
- Change: `lib/cameBack.ts` gains `issueWord`, `variationWord` and
  `reportWord`: the latest note a person (not RELAY) wrote on a record the
  engineer raised, while it still waits on them. Came back rows show "Olive
  Office wrote on Wed 21 Oct: …" in two lines at most; the issue page shows
  it above "Update this issue" and a variation under the office's answer, in
  `components/OfficeWordBox.tsx` (cut at three lines with "Show all of it",
  48px). A returned report's reason, or a note left on opening it, shows on
  its row until the engineer sends a correction. No office screen, API or
  stored data changed; events stay as they were. Help "What's new" line.
- Decisions (Claude's): only words a person typed count. RELAY's own notes
  ("needs triage", "Confirmed at report review", "Quoted £…", a correction's
  links) never show as someone writing. Anything the engineer adds answers
  it. A later decision without a note (checked, withdrawn, priced, a
  correction) moves past an older note. Other engineers' updates are not the
  office's answer, and assignment notes are left to "Who is fixing it" (they
  are for the fixer, and showing them pushed the buttons down on very long
  issues). Limit: an office "Record an update" on an issue is a `progress`
  event like an engineer's, so it does not show; the office's "Not
  finished"/reopen does.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 493; new `officeWord.test.ts`),
  build. New `scripts/verify-office-words.mjs` (67 checks, 390px light and
  dark, 1440px dark): who, when and what on the rows; "Put forward as fixed"
  on the first screen with a short note and with a long one under a dispute
  line; "Show all of it"; RELAY's dispute note not shown; answered notes
  leave the top; office view unchanged. Also passing, one at a time:
  came-back-to-update, engineer-day, offline-capture, send-on-signal,
  simpler-issue-page, simpler-home, help, accessibility (584). Two
  fresh-context review passes found 14 points (RELAY's own notes shown as
  someone writing, old notes after a decision, other engineers' updates, the
  page not checking who raised it, a corrected report), all fixed or
  recorded above. Screenshots before and after: project files
  `ui-review/office-words/`.
- Not verified: a real phone, a screen reader.
- Ideas for later (not built): an empty card opened from "Carry on" is
  folded, one more tap; each photo tile on a card says "On the server" and is
  about 290px tall, so several photos push the next card far down; the quick
  defect's "Where on site?" has no recent places; the office has no plain
  "write to the engineer" on an issue.

## 2026-10-21 — Ninth release check: main ready at 616a06d

- Why: a release check of everything merged since 03188ee (the eighth
  check's ready commit, prepared for the live deploy but not yet run):
  #100 to #108, with most attention on #105 (sending with no signal).
  Not a `docs/tasks.json` task; no status changed.
- Checked: typecheck, `npm test` (146 + 480) and build at a69a9fe, 4f08eb5
  and 616a06d. Every browser check one at a time: 77 of 77 at a69a9fe, all
  78 at 4f08eb5 (#107 changed the report editor), then the 25 office,
  accessibility and sending checks at 616a06d (incl. new verify-office-links).
  verify-busy-projects: over on two phone pages once; reruns passed one in
  full on the new build while 03188ee failed both of its runs, so it is the
  machine. A scratch phone-sized day (17 checks, not committed): offline
  send waits through a retry, then exactly one report, issue and variation
  with both photographs; the office reads it (Seen), Weekly summary shows
  the work, Photographs offers and shows that day; the engineer opens the
  issue and sees "Seen by the office"; closed while waiting and reopened
  with signal sends once. Production Docker image built from a clean copy
  of 616a06d and started healthy. Release notes updated (project files
  `releases/2026-10-20-release-notes.md`); screenshots in
  `ui-review/ninth-release-check/`.
- Deploy needs nothing new since 03188ee: no settings, packages, database,
  SharePoint or deploy script change; offline store still `relay-public-v14`.
- Faults: none found.
- Not verified: real phones, real weak signal, a locked phone while waiting
  to send, printers, screen readers, tablets, the live server or tenant.
- Next: deploy 616a06d in place of 03188ee, with Cal's go-ahead.

## 2026-10-21 — Recent places take less room on a new card

- Why: Cal's 07:02 direction (simple for hands-on engineers). Two
  walk-throughs found that on a new card at 390px the Recent places box (a
  panel with a count, three full-width rows) and its hint line pushed "Take a
  photo" to about 1,040px down the page: 572px down the card, and "What
  happened" off the first screen. #102's write-up suggested cutting the hint
  and the chip for a place already in "Where". Decided without asking Cal, per
  his autonomy message. Not a `docs/tasks.json` task; no status changed.
- Change (site update card only; `Suggestions` gains a `compact` mode used
  for places in `ObservationEditor`): chips sit under "Where" as wide as
  their words (sans 14px, still 48px tall), with no panel, count or hint; "Show
  N more" sits on the chip rows; the place already in "Where" (any case or
  spacing) is not offered. Places stay one tap away and "Where" stays free
  text (no catalogue, EXP-4). Recent companies, inspection checks and the
  other pages' chips are unchanged. Help "What's new" line added.
- Measured (new `scripts/verify-recent-places.mjs`, 109 checks, light and dark
  at 390px, dark at 1440px): "Take a photo" 572px → 392px down a new card at
  390px (180px higher), "What happened" on the first screen; 527px → 477px at
  1440px. Screenshots: project files `ui-review/recent-places/`.
- `verify-editor-usability` now expects no hint line under recent places.
- Not verified: a real phone, a screen reader.

## 2026-10-21 — Office counts that open what they count

- Why: Cal (2026-10-21 07:02) wants RELAY to get the office the information
  it needs. #106 proposed linking the Weekly summary's "N photographs" to that
  day's photographs. Walking the office screens on main 4f08eb5 (desk 1440px
  dark, phone 390px light) found more figures the office would click that
  went nowhere: the project sheet's four figures (Last visit, Overdue actions,
  Fixed, to check, Variations), Latest from site's "And N more in the
  report", the phone register's last visit line, and the Weekly summary's
  "N fixed and waiting to be checked". Not a
  `docs/tasks.json` task; no status changed.
- Changed (existing links and filters only; no new pages or counts):
  Weekly summary "N photographs" opens Photographs on the visit day with the
  report's reference in Find, so the count matches what shows (it can
  differ when a correction dropped photographs, which keep the reference) (another
  engineer's photographs that day are left out; "Every day" and clearing Find
  widen it). For office people, "fixed and waiting to be checked" opens the
  Issues register on that project; engineers keep the words and the snag list
  link. "Past target" stays words: it leaves out issues already put forward as
  fixed, which the register's Overdue keeps, so the list would not match. The Issues and Variations registers now take a
  project after the filter in the desk link (`#/issues/show/overdue/<project>`);
  a link without one, or the tab itself, is every project again. Project sheet figures open the
  last visit's report, the register on Overdue or Fixed, to check, and
  Variations on Awaiting instruction, each on that project; a figure with
  nothing to open stays plain text. Style: the figure keeps its colour, a row's
  "›" arrow marks it, the small line underlines on hover; other new links are
  underlined in the line's own colour. Help "What's new": "Figures that open
  what they count".
- Decided not to link: the "Where each project stands" cells (each row is
  already one link to the project, whose figures now open the lists; links
  inside a link are not allowed, and the row is the phone's tap target); the
  project column's lines (same reason); the bar's "3 issues · 1 overdue · 1 to
  check" under the sheet figures (the figures above it now open the same
  lists). Site coverage already links each visit and last report.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 480), build. New
  `scripts/verify-office-links.mjs` (52 checks, 1440px dark and 390px light,
  plus an engineer). Browser checks one at a time: verify-office-progress
  (75), verify-september-office (43), verify-accessibility (584),
  verify-help (36), verify-photo-library (51), verify-office-sections (63),
  verify-office-desk (73), verify-office-phone (91), verify-home-and-sheet
  (254), verify-role-access (95), verify-day-walkthrough (114; stopped once
  in the engineer's defect card, which this does not touch, then passed twice
  and on main). Screenshots: project files `ui-review/office-links/`.
  A fresh-context review found three points, all fixed: the photographs link
  printed brass and underlined (now plain black, checked), "past target"
  opened a longer list than it counts (now words), and the Issues or
  Variations tab kept a linked project (now every project).
- Not verified: a real phone, the live server or tenant.

## 2026-10-21 — Photographs from one day

- Why: Cal (2026-10-21 07:02) wants RELAY to get the office the information
  it needs. Walking the office's questions on a seeded busy project (overview,
  project sheet, Before handover, Not seen yet all answer in a click or two),
  "show me last Tuesday's photographs on Tetley Hall" was the slow one, and
  #103 named it as its runner-up. Photographs paged 60 at a time from today
  and the find box could not search by date. Not a `docs/tasks.json` task; no
  status changed.
- Changed: Photographs has a Day choice ("Every day", then each day with
  photographs, newest first, with its count under the current find words and
  filter). A chosen day shows only that day, with "Newer day", "Every day"
  and "Older day" buttons (each naming the day it goes to). The day is in the
  link (`day=YYYY-MM-DD`, ignored if not a real date), kept by Back from a
  record, and cleared when the project changes. A day with nothing says so.
  Day means the report's visit day, or the day evidence was added to an issue
  or variation, as before. Nothing else on the page changed; styling stays in
  `app/photos/photos.css`. Help "What's new": "Photographs from one day".
- Measured (busy-projects seed, 420 days, 8,494 photographs on 011LME): last
  week's Tuesday took 2 "Show more" presses and was 5,854px down at 1440px
  (7,126px at 390px); three weeks back took 6 presses and 19,567px. Now one
  choice, under 0.2 s, the day starting 519px down (773px at 390px). The Day
  list has 403 entries; page load unchanged (no API change).
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 480 after rebasing on #105, two new unit tests), build;
  browser checks one at a time: verify-photo-library (51, 13 new for the day),
  verify-help, verify-accessibility, verify-first-time-use,
  verify-home-and-sheet, verify-navigation, verify-snag-list,
  verify-office-progress (75), verify-september-office (43),
  verify-role-access, verify-busy-projects (38 timings within budget).
  A fresh-context review found three small points, all fixed: keep the day
  across projects (now cleared), Help wording, step buttons' spoken names.
  Screenshots: project files `ui-review/photos-by-day/` (the busy-project
  shots have no image files, so tiles show empty frames).
- Not verified: a real phone, the live server or tenant.
- Next (proposal, not built): the Weekly summary's "N photographs" on each
  visit could link to that day's photographs.

## 2026-10-21 — Sent with no signal, it goes by itself

- Why: Cal (2026-10-21 07:02) wants RELAY easy for hands-on engineers and
  the office to get the information. Walking an engineer's day at 390px on
  main 34ff4ef (site gate, progress with photos, a defect and a variation,
  sending in a basement, the next morning), the worst moment was sending
  with no signal: "Send to office" said "try again when you have signal",
  nothing happened when signal came back, and the home screen still said
  "Carry on with today's update". An engineer who pocketed the phone
  thought it had gone; the office never got it. Chosen over trimming Recent
  places (the hint and three full-width rows put "Take a photo" about
  1,040px down a new card), which stays the next idea. Not a
  `docs/tasks.json` task; no status changed.
- Built on what was there, not a second outbox: the report's held copy on
  the phone (localDraft.ts) is the work; `lib/sendOnSignal.ts` only notes,
  per device and person, that Send was tapped. The send is the editor's own
  (save, then submit), which the server already makes safe to repeat: a
  submit whose answer was lost returns the sent report, and a save whose
  answer was lost comes back as the same cards.
- Changed: with no signal (or the server not answering, not when signed
  out) Check & send says "Waiting for signal. It goes to the office by
  itself as soon as this phone has signal, while RELAY is open", with
  "Don't send yet"; the button reads "Try now". It tries on the browser's
  online event, on coming back into view, on focus and every 15 s (no
  background sync, which many phones lack). Sent, it says "Sent to the
  office by itself". Closed first, the home's big button says "Send today's
  update · Not sent yet" (no second Unfinished row for it) and opening it
  with signal sends it at once. Only what the blocking checks allow goes.
- Decisions: going back to the cards (button or the phone's Back),
  changing the signature, or another version arriving from elsewhere stops
  it going by itself, so nothing goes that the engineer did not see on
  Check & send; Check & send then sends the latest version. It only sends
  while RELAY is open (said on screen and in Help); the no-signal page's
  own sending is unchanged.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 477; new `sendOnSignal.test.ts`),
  build. New `scripts/verify-send-on-signal.mjs` (69 checks, 390px light
  and dark, 1440px dark): open page waits then sends once (one report, one
  issue, one variation, all cards and photos); closed then reopened from
  home sends within 8 s; Don't send yet, signature change, Cards and the
  phone's Back stop it; a lost answer to the submit, and to its save, make
  one report. Also passing, one at a time: offline-capture, engineer-day,
  report-editor, editor-usability, fewest-taps, signature-reload,
  engineer-layout, role-access, help, simpler-home, unfinished-reports,
  sent-elsewhere, draft-conflict, offline-drafts, offline-sign,
  submission-stages, error-messages, day-walkthrough, search, lighter-card,
  one-caption-line, editor-wide, accessibility (584). A fresh-context
  review found five gaps (phone Back, signature change, conflicts, a slow
  resume, a lost save answer), all fixed and covered by the new check.
  Screenshots: project files `ui-review/send-on-signal/`.
- Not verified: a real phone, real weak signal (the browser's offline
  switch and cut responses only), a phone that suspends the page while
  locked.

## 2026-10-21 — Clearer edges on the office desk

- Why: Cal (2026-10-21 12:59, with a screenshot of the dark office desk, a
  project open) said the top bar, the tabs and the Projects column "all
  blend into one". On main they did: top bar and tabs were the same panel
  colour, and every dividing line (`--line-2`) was 1.3 to 1.6:1 against its
  surfaces; project cards had no gap or border, only a 1px rule.
- Change (CSS only, `workspace.css`): two new tokens, `--edge` (a dividing
  line at least 3:1 against both sides in both themes) and `--chrome` (the
  top bar's surface: the sunken shade in light, a darker charcoal in dark).
  Top bar (chrome), tabs (panel) and column headers (panel-3) now each have
  their own shade with an `--edge` line between them, and the columns are
  divided by `--edge`. Column headers lose the doubled grey and gold
  underline for one line. The Projects column sits on the sunken shade with
  each project as its own card (8px gap, border); the open project has a
  gold outline and a gold-tinted fill. No content added or removed. Help
  "What's new": "Clearer edges on the office desk".
- Measured (new `scripts/verify-office-sections.mjs`, 1440 and 1180px, light
  and dark, plus 390px): on main 48 of the 59 checks it had then failed (no
  surface change between top bar and tabs, edges 1.32-1.64:1, cards 0px
  apart; the card-fill check was added after); now all 63 pass. Screenshots before and after: project files
  `ui-review/office-sections/`.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 472), build; browser checks
  verify-office-sections, verify-accessibility, verify-office-desk,
  verify-office-phone, verify-office-landing, verify-office-progress,
  verify-office-registers, verify-office-actions, verify-september-office,
  verify-role-access, verify-help.
- Not verified: Cal's own screen or the live pilot (the pilot runs an
  older build), a real office monitor.

## 2026-10-21 — The week in the engineers' words (Weekly summary)

- Why: Cal's 07:02 direction (get the office the information it needs).
  Walked through the office on seeded projects with six weeks of reports,
  asking "what happened on site X this week?", "which jobs haven't had a
  visit?", "what issues and variations does Y have?" and "show me Tuesday's
  photos". The last three are answered in a click or two (Where each project
  stands, the project sheet, Photographs grouped by day). The first was not:
  the Weekly summary listed each visit only as counts and places ("2
  progress updates, 1 defect"), so the office had to open every report, 7
  reports and about 16 clicks for one week on Tetley Hall. The site diary
  has the words, but it runs back months and mixes in every card.
  Decided without asking Cal, per his autonomy message. Not a
  `docs/tasks.json` task; no status changed.
- Changed: under each site report in the Weekly summary's "On site", its
  progress updates in the order written (place in bold, then what was
  done). Three show; "Show all N updates" opens the rest. Each is shown in
  full, never cut (a fresh review found a two-line cut hid the end of notes
  on a phone with no way to open them, so the cut was dropped). Printed, all
  of them show. Defects, access problems and variations are left out of
  these lines: the page lists them under Issues and Variations with their
  references. Inspections keep their check counts. The places line now
  shows only for a visit with no progress written. Built from the same
  reports the person may already read (`canReadReport`), corrections in
  place of what they correct. Help "What's new" line added.
- Busy project (busy-projects seed, last week on Tetley Hall, 13 reports):
  API 145 ms and 24 KB (was 134 ms, 18 KB on main), page ready in about
  0.5 s either way, page 7,479 px tall at 1440 (was 6,489) and 11,081 px
  at 390 (was 9,652), printed PDF 8 A4 pages on both. Screenshots and the
  PDF: project files `ui-review/weekly-work-done/`.
- Checks: `npm run typecheck`, `npm test` (146 + 473 on main with #102, one new unit test),
  `npm run build`; browser checks one at a time: verify-weekly-summary (38,
  new: work lines, Show all and Show less, nothing cut, all printed),
  verify-help, verify-office-progress, verify-september-office,
  verify-role-access, verify-accessibility, verify-day-walkthrough,
  verify-error-messages, verify-first-time-use, verify-home-and-sheet,
  verify-navigation, verify-simpler-home, verify-site-coverage and
  verify-busy-projects (38 timings within budget). verify-office-progress
  failed once while another run overlapped it and passed alone (75).
- Not verified: a real phone or printer, the live tenant.
- Next (proposed, not built): Photographs could open on a chosen day (today
  a past week's Tuesday needs a few "Show more" taps).

## 2026-10-21 — One caption line before sending

- Why: Cal (2026-10-21 07:02) wants RELAY easy for hands-on engineers.
  Walking an engineer's day at 390px, "Check & send" listed "a photograph has
  no caption" once for every photograph without one. Most photographs never
  get a caption (the card already says where and what), so a site update with
  six photographs opened on six Optional lines, mixed in among the notes the
  office needs (a variation with no photograph, nobody named who asked for
  it). Chosen over the Recent places ideas left in #98, which save less.
  Not a `docs/tasks.json` task; no status changed.
- Decision: keep the nudge, as one line (the coordinator pointed out captions
  do help the office read photographs), rather than drop it. `lib/review.ts`
  now gives one non-blocking finding, "6 photographs have no caption", after
  every other note, opening the first card with a photograph to caption.
  Inspections get the same one line. Nothing that stops sending changed, and
  the caption box under each photograph is unchanged. Help "What's new": "A
  shorter list before sending".
- Measured (new `scripts/verify-one-caption-line.mjs`, four cards, seven
  photographs, one captioned, a variation done on a say-so): on main 1b27cc6
  8 lines, list 610px tall, "In this report" 724px down the step at 390px;
  now 3 lines, 203px, 317px (1440px: 430px to 158px).
- Checks: `npm run typecheck`, `npm test` (146 + 472, new
  `captionLine.test.ts`), `npm run build`; browser checks listed in the PR.
  Screenshots before and after: project files `ui-review/one-caption-line/`.
- Not verified: a real phone, a real engineer, the live server or tenant.

## 2026-10-21 — Simpler office screens: one place for each thing

- Why: Cal's 07:02 direction (RELAY gets the office the information it
  needs, simply). With #86/#88/#91 and the September work (#97) both on the
  office, some things were shown or built twice. Decided without asking Cal,
  per his autonomy message; reasons below.
- Overview on a desk: the left Projects column is gone at the top level.
  "Where each project stands" already listed every project with the same
  last visit and variations, as a phone already did. The column returns
  once a project is open, to move between projects.
- Office position: the "New reports" group is removed (it mostly repeated
  "Not seen yet"; already-opened new reports are on the Inbox's New
  filter). Three groups remain: Not seen yet, Unassigned issues, Fixed, to
  check (one row on a desk, three tiles on a phone). The subtitle counts
  that repeated the tab counts became "Updated <time>"; the "Day by day →"
  link that repeated the Site coverage button is gone.
- "Also needs attention" is now built from model.ts `attention()`, the
  Attention bell's list, less unassigned and fixed-to-check (own groups),
  one line per record. Before, a second hand-built list could disagree.
- People: editing (names, roles, add person, take off/put back, change log)
  moved from Admin > People to the Team tab for the Admin; Managers keep
  the read-only "Who can sign in". `#/admin/roles` opens Team; Admin opens
  on Notifications & processing. The server still refuses non-Admins
  (`/api/admin/people` 403; now checked in verify-september-office).
  SharePoint connection's Refresh and Retry buttons got app styling (they
  were browser-default and under 44px, caught once Admin opened there).
- Kept: every September feature, #88's automatic Seen (no Acknowledge
  button), the Safety, permits and deliveries switch, off by default.
- Review: a fresh-context review found the bar and a card both said "Saved to
  RELAY" (checks waiting for a save could stop at a card; the card now says
  "Saved"), Help claiming the office sees a saved draft (it does not until
  sent), error notes still naming the server, My week disagreeing with the
  weekly summary, and three checks still reading old words. All fixed.
- Checks: typecheck, `npm test` (146 + 467), build. All 75 browser checks
  run one at a time on this branch: 72 passed first time; verify-help (tab
  title race) and verify-company-chases (axe target size on /companies,
  untouched here) passed on rerun; verify-busy-projects missed only
  engineer-side speed budgets, by 9 to 400 ms and a different one each run
  over four runs, office budgets met every time. Updated checks:
  office-actions, office-phone, office-landing, office-progress,
  office-registers, role-access, september-office, and the three that
  opened a project from the old column (photo-library, site-diary,
  weekly-summary). Screenshots: project files ui-review/simpler-office/.
- Not verified: real phone, real tablet, live tenant.
- Next (proposals, not built): the reader's "Actions and decisions" summary
  repeats cards shown below it; worth trying without it on short reports.

## 2026-10-21 — Eighth release check

- Checked main at 03188ee (#2 to #27, #29 to #99, including #97, the
  September office work). Ready to deploy; the deploy itself waits for Cal.
- Typecheck, `npm test` (146 + 467), `npm run build`, and all 75 browser
  checks run one at a time (Node 22). 74 pass first time. verify-busy-projects
  went over budget on the same pages (engineer issues, photographs, office
  inbox) on main and on the seventh check's 3e470fc alike, so it is this
  machine today, not a slowdown. verify-september-office: 34 checks pass.
- Walkthrough (a scratch script, not added to the repo): a phone report with
  a photograph, a defect and a variation, read in the office at 390px light
  and 1440px dark (marked Seen, issue and variation raised, PDF made), then
  the engineer's Issues tab, the issue and the sent report showing "Seen by
  the office": 26 checks, on 0e56592 and again on 03188ee.
- Production Docker image built from a clean `git archive` of 03188ee and
  started healthy (/api/health ok, /signin 200). Docker here needs `dockerd`
  started by hand and the proxy certificate for npm inside the build (scratch
  Dockerfile copy only, not in the repo).
- Found one fault, fixed in #99: the office report's "Actions and decisions"
  rows squashed their words on a phone.
- Release notes refreshed: project files `releases/2026-10-20-release-notes.md`.
- Not verified: a real phone, the live tenant, the server's own Docker build.

## 2026-10-21 — September office work merged into main

- Why: Cal asked to deploy all recent changes (10:25). The first deploy
  failed safely at the image build: the live pilot runs a branch,
  `office-release-2`, deployed on 21 September from Cal's office PC and
  never merged (4 commits on 13e96a0). Main unpacked over it left those
  files behind, and deploying main alone would have removed screens the
  office has used for a month. Cal chose (decision card, 10:58): merge it
  into main first, then deploy.
- Kept from September, ported onto today's office screens: names set in
  RELAY (Admin > People: add, rename, change role, take off and put back on
  the checklist, with a change log; never grants access), office
  corrections (Quick actions on each card of a sent report: falls under
  our contract, already raised, add a note, with a change log under the
  card; the report and PDF stay as sent), Within contract variations (not
  charged, own filter, reopenable), a note-only issue event, add a
  variation from the office (Variations tab and project sheet), the
  read-only SharePoint connection check (Admin > Notifications &
  processing), and the upgrade script running the Variation Register
  schema step inside the live container. Server code merged as written.
- Not kept: the September visual redesign of the office (stub cards,
  marks, its own CSS, a Reports tab). Decision: main's office has moved on
  since (#51, #86, #88, #91 and others: plainer words, Seen by the office,
  the Safety, permits and deliveries switch), so the features were ported
  onto it rather than bringing back a second look. The Inbox's widen
  reader button and per-row "corrected" chips were part of that redesign
  and are left out; the reader shows the count instead.
- Note for the deploy: the upgrade script's schema step now stops the
  upgrade unless the SharePoint Variation Register's Instruction column
  offers "Within contract". It only reads that column. Live has run the
  September code since 21 September, so it should already be there.
- Checks: `npm run typecheck`, `npm test` (146 + 464), `npm run build`;
  all 72 browser checks one at a time (verify-busy-projects missed one
  speed budget by 16 ms and passed on a re-run, as before) and the new
  `verify-september-office` (34 checks: People, quick actions, within
  contract, add a variation, axe, 390px light and 1440px dark).
- Not verified: no live tenant, no real phone; the live data's existing
  corrections and names were not opened in this build.

## 2026-10-21 — Report's actions readable on an office phone

- Found by the eighth release check (walkthrough on main 0e56592): on a
  390px phone, the office report reader's "Actions and decisions" rows put
  the words, the reference and the tag side by side, so a variation's words
  ran one or two to a line ("Variation / to / instruct / · Plant / room").
  Not a `docs/tasks.json` task; no status changed.
- Changed (`app/workspace.css`, phone widths only): those rows wrap, so the
  words take the full width and the reference and tag sit underneath, as
  Needs attention already does. Desktop unchanged. A layout fix, not a new
  feature, so no Help "What's new" line.
- Checks: `npm run typecheck`, `npm test`, `npm run build`; a phone report
  with a photo, a defect and a variation, read in the office at 390px light
  and 1440px dark (26 checks, screenshots before and after); verify-office-phone,
  verify-office-desk, verify-seen-by-office, verify-office-progress.
- Not verified: a real phone.

## 2026-10-21 — Came back from the office, straight to the update

- Why: the second idea in PR #92. Cal (2026-10-21 07:02) wants RELAY easy
  for hands-on engineers. Not a `docs/tasks.json` task; no status changed.
- Measured first (new `scripts/verify-came-back-to-update.mjs`, 390x844):
  from the Site page an engineer already put an issue forward as fixed in 4
  taps (the issue, photograph, note, "Put forward as fixed"; the note is
  optional). Decision: no tap can be cut without dropping the photograph or
  the choice of button, so taps stay at 4 and the gain is what is on screen
  on landing. With a one-line description everything was already in view.
  With a realistic three-line description and "What needs doing", "Put
  forward as fixed" sat 120px below the screen; with a very long one, the
  photograph button 288px and "Put forward as fixed" 467px.
- Found: the issue heading was meant to be 21px (#92) but `.eng-page h1`
  (28px) won on specificity, so long descriptions took seven lines. Fixed
  (`.eng-page .issue-eng-title`); this applies however the issue is opened.
- Changed: rows for issues under "Came back from the office" link to
  `/issues/<id>?update=1`. On the engineer's issue page that scrolls once,
  only as far as needed to bring the photograph and the buttons into view,
  and never so far that what is wrong goes under the app bar. Opened from
  the Issues list or anywhere else, the page starts at the top as before.
  The office's issue page ignores it. Help "What's new": "Straight to the
  update".
- After: 4 taps. Three-line description: lands 35px down, photograph, "Put
  forward as fixed", what is wrong and where all in view. Very long one:
  lands 93px down with the photograph button and what and where in view;
  "Put forward as fixed" is 175px below (was 467px), because scrolling
  further would hide what is wrong.
- Checks: `npm run typecheck`, `npm test` (146 + 441), `npm run build`.
  Browser checks passing: came-back-to-update (36: 390px light and dark,
  short, long and very long descriptions, Issues list and office start at
  the top), simpler-issue-page, simpler-issue-list, help, engineer-day,
  simpler-home, seen-by-office, home-and-sheet, role-access,
  engineer-layout, accessibility (584), issue-provenance, issue-assign,
  day-walkthrough, first-time-use, fewest-taps, since-last-visit,
  signature-reload, search, navigation, error-messages. Fresh-context
  review: Help line overclaimed for very long issues (softened) and one
  weak assertion (tightened). Screenshots before and after: project files
  `ui-review/came-back-to-update/`.
- Not verified: no real phone, no real engineer, no live tenant.

## 2026-10-21 — A shorter card in the site update

- Why: Cal (2026-10-21 07:02) wants RELAY simple for engineers. Every open
  card in a site update began with four big Kind buttons (Progress, Defect,
  Variation, Access), though the kind was already chosen by "Start today's
  site update" or "+ Defect" and the like, and the card's heading says it.
  Picked over FE-1 (Undo, another card at the same place and recent places
  are already built) and the small wording ideas left in #90 to #96. Not a
  `docs/tasks.json` task; no status changed.
- Changed (`components/ObservationEditor.tsx`, `app/reports/[id]/page.tsx`,
  `app/engineer.css`): the Kind buttons come out only after "Change kind",
  which sits with "Remove card" at the foot of the card on a phone and beside
  "Remove" in the card's heading on a wide screen. Picking a kind folds them
  away again and puts focus back on "Change kind". "+ Defect" (or any kind)
  while the last card is still blank turns that card into the kind asked for
  instead of adding a second card under an empty one, so starting the day
  with a defect is still one tap. Help: "What's new" line "A shorter card",
  and the site-update step no longer says to tap Defect at the top of a card.
- Measured (new `scripts/verify-lighter-card.mjs`, 390px): from the top of a
  new progress card to "Take a photo", 732px on main 3cde9ab, 572px now; the
  open card is 712px tall instead of 872px.
- Checks: `npm run typecheck`, `npm test`, `npm run build`, browser checks
  listed in the PR. verify-fewest-taps, verify-engineer-layout and
  verify-day-walkthrough changed where they used the Kind buttons.
- Review: a fresh-context review found one broken check line (fixed) and
  that a photograph still being read could put a just-retyped card back to
  progress, because the photo and the card's change used the card and report
  as they were when the photo started. Both now write onto the latest card
  and report. The wide card's "Remove" is now 48px tall too.
- Not verified: no real phone, no real engineer, no live server or tenant.

## 2026-10-21 — No-signal check brought up to date

- Why: `verify-offline-capture` failed at its Unfinished reports step on
  main (found in PR #93), and a deploy of 5107b78 was waiting on whether
  no-signal work could be lost. Not a `docs/tasks.json` change (FE-3e
  already passes), so no status changed.
- Finding: an out-of-date check, not an app fault. Every server-side
  assertion passed: cards, photos and edits made with no signal reach the
  server whole and nothing is made twice. Since #90 the big "Carry on with
  today's update" button opens today's draft the server saved last (the
  engineer page reads drafts by `updated DESC, id DESC`), and any other draft
  of today is listed under Unfinished reports. The check assumed the new
  offline draft was always in that list, so it passed or failed on which of
  the two drafts the phone sent last. Decision: keep #90's rule and the
  app's order (most recently saved first is fixed and sensible), and change
  only the check.
- Changed: the check now works out from the server which of today's drafts
  was saved last, and proves that one is on the big button (and not listed
  twice) while every other one, the new offline draft, the held draft and
  (dark run) the draft changed elsewhere, is under Unfinished reports with
  its reference. No app change, so no Help "What's new" line.
- Checks: `npm run typecheck`, `npm test`, `npm run build`.
  verify-offline-capture passed 7 runs (62 checks); both orders came up
  (new draft on the button 3 runs, held draft 1 run, 3 unlogged). The
  "not listed twice" step waits for the row to go, because the home screen
  re-reads what the phone holds just after its refresh. Also passed:
  offline-drafts, offline-inspection, offline-sign, site-notes-offline,
  handover-offline, engineer-day, day-walkthrough, engineer-layout.
- Not verified: no real phone, no live tenant.

## 2026-10-21 — Shorter issues list for engineers

- Why: Cal (2026-10-21 07:02): engineers are hands-on people and want a
  simple system. PR #92 proposed this: each card on the engineer's Issues tab
  repeated the project name (already the list's heading), the trade, who
  reported it and where it came from, while not saying who is fixing it. Not a
  `docs/tasks.json` task; no status changed.
- Changed (`components/EngineerIssueList.tsx`, `app/engineer.css`): each card
  shows the reference and status, what is wrong, where, and (while open) "Who
  is fixing it: <owner>, by <date>" or "Nobody yet", the same words as the
  issue page. Trade, reporter and source lines are gone from the card; they
  stay on the issue page under History. On a phone the photo is a 72px square
  beside the words instead of a full-width 140px band. Filters ("Reported by
  me" still uses who reported it) and links unchanged. Office lists unchanged.
- Measured (new `scripts/verify-simpler-issue-list.mjs`, 390px): three open
  issue cards took 1,131px on main 5107b78 and take 450px now.
- Verified: typecheck, `npm test` (146 + 441), verify-simpler-issue-list (49
  checks, 390px light and dark, 1440px dark, office issue page). Other
  browser checks listed in the PR. Screenshots before and after: project files
  `ui-review/simpler-issue-list/`.
- Not verified: a real phone, a real engineer, the live server or tenant.

## 2026-10-21 — A sent report, at a glance (engineer)

- Why: the first "bigger idea" in PR #90. Cal (2026-10-21 07:02) wants
  RELAY easy for engineers. A sent report showed an engineer five steps
  (received, PDF, delivery, seen, plus review where asked) and a note that
  repeated "Received by RELAY". The PDF and delivery steps matter to the
  office, not the engineer. Not a `docs/tasks.json` task, so no status
  changed there.
- Changed: on the engineer's report page (`/reports/[id]`, anyone who is not
  a Manager or Admin) a sent report shows Received, Review (only where the
  project asks for it) and Seen. PDF and Delivery fold under "PDF and
  delivery", whose line says how each stands ("PDF ready · Delivery not
  emailed"). A PDF or delivery step that went wrong stays out of the fold,
  so a problem is never hidden. The note above no longer repeats "Received
  by RELAY" (the Received step shows it with its time). The office reader
  and Managers and Admins on the report page still see every step open, so
  the events stay distinct. Help "What's new": "A sent report, at a glance".
- Checks: `npm run typecheck`, `npm test` (146 + 441), `npm run build`.
  Browser checks passing: submission-stages (145, adds fold checks for every
  case, alerts kept open, office unchanged), seen-by-office, engineer-day,
  engineer-layout, role-access, signature-reload, search, help,
  accessibility (584), day-walkthrough, first-time-use, office-actions,
  office-phone, office-desk, error-messages, unfinished-reports,
  sent-elsewhere. Scripts updated: engineer pages now have two `ol.stages`
  lists, so waits use the first; engineer-layout waits for the Received step;
  engineer-day opens the fold before reading the delivery words.
  verify-offline-capture fails at line 151 (new offline draft under
  Unfinished reports) on main too, before this change: #90 made today's
  draft open from the big button rather than that list. Not fixed here.
  Screenshots before and after: project files
  `ui-review/sent-report-two-steps/`.
- Not verified: no real phone, no live tenant, no real engineer.

## 2026-10-21 — Simpler issue page for engineers

- Why: Cal (2026-10-21 07:02): engineers are hands-on people, not IT people.
  PR #90 named the issue page as the next thing to slim: on a 390px phone it
  opened on an office grid (Work status, Confirmation, Owner, Target date,
  Raised) and the history, with the photograph button and "Put forward as
  fixed" at the bottom. Not a `docs/tasks.json` task; no status changed.
- Changed (engineer view only, `app/issues/[id]/page.tsx`; Manager and Admin
  see the page exactly as before):
  - First screen: the issue reference and status, what is wrong as the
    heading, then Where, What needs doing (the update's own words, which the
    engineer's page never showed before) and Who is fixing it, by when.
  - "Update this issue" straight under it: Add photograph, an optional note,
    "Put forward as fixed" (now the main button) and "Record an update".
    Once put forward it says it is waiting for the office to check it; a
    closed issue says so and has no form (it used to show a note box with no
    button to press).
  - Folded under "History · N": project, confirmation, raised date and
    source, trade affected, who reported it, the disputed note and the full
    history with its report links. History says "Put forward as fixed" and
    "Checked and closed" for the engineer.
  - A disputed issue keeps its red tag and says in one line that the office
    is checking whether it needs fixing; the full note is in History. A
    withdrawn issue says nothing about the office checking it.
  - The first-screen measurement uses a one-line description; a long
    description or "What needs doing" can push the buttons a little lower.
- Measured (new `scripts/verify-simpler-issue-page.mjs`, 390x844): taps from
  the Site page to put an issue forward as fixed with a photograph and a note
  stay at 5 (Issues, the issue, photograph, note, the button; the note is
  optional, so 4 without it). Decision: no tap could be cut without dropping
  the photograph or the choice of button, so the gain is scrolling: on
  opening, "Put forward as fixed" was 833px below the first screen and is now
  on it; the photograph button was 713px down and is now on it.
- Verified: typecheck, `npm test` (146 + 441). Browser checks:
  simpler-issue-page (76, 390px light and dark, office 390px light and
  1440px dark), issue-provenance, issue-assign, engineer-day (updated: the
  engineer's history is folded), review-queue, accessibility (584),
  role-access, engineer-layout, day-walkthrough (114), photo-library,
  snag-list, fewest-taps, help, issue-register, company-issues,
  since-last-visit, error-messages, first-time-use, navigation,
  before-handover, register-downloads, register-export, issue-trend,
  site-diary, search, signature-reload. Screenshots: project files
  `ui-review/simpler-issue-page/` (before and after).
- Not verified: a real phone, a real engineer, the live server or tenant.

## 2026-10-21 — Manager's day, simplified

- Why: Cal (2026-10-21 07:02) wants RELAY to get the office the information
  it needs about site progress, simply. A working day as an office manager on
  /office after #85, #86 and #88 (1440px and 390px, light and dark, on a
  seeded month of three trades): where each project stands, unseen reports,
  issues and variations, a project's sheet, the weekly summary, site coverage,
  issues by company, a report and its PDF page, Team and Admin. Not a
  `docs/tasks.json` task, so no status changed there.
- Changed (office screens only, nothing added):
  - Report lists (Inbox, New reports on the overview, a project's register)
    no longer tag every row "PM not notified" (or "PDF ready"): the pilot has
    no mail server, so it was on every report and meant nothing to a manager.
    A row now carries a delivery tag only when something went wrong. The
    report itself still shows every step (received, PDF, delivery, seen), so
    the events stay distinct. The Inbox's "PM not notified" filter went; an
    Admin still sees the waiting notifications under Admin > Notifications &
    processing.
  - A project's sheet no longer repeats "Needs attention" and "Latest
    reports": the register column right beside it (shown above 700px; a
    phone shows the register instead of the sheet) has the same lines under
    Needs action and Reports. The sheet is now where it stands, Latest from
    site, the project's pages and its details.
  - Team tab in plain words: "Who can sign in", Person / Role / Can see /
    Signed in at / Now, roles as "Engineer · Electrical" not
    "Engineer.Electrical", "Not signed in" not "No session", and a shorter
    note. Admin > Roles & access keeps the Microsoft app role names, which
    the Admin needs for Entra.
  - Top bar "Companies" (it goes to the Developments / Compliance chooser,
    and sat next to "Issues by company") is now "Switch company".
  - Admin's "Projects & review · Planned" chip, which did nothing, is gone.
  - The overview's closing paragraph about the server, filing and the PM
    email is one line: opening a report marks it seen.
  - Help "What's new": "A simpler office".
- Looked at and left (decisions): the desk's left project list beside "Where
  each project stands" (it is the navigation once a project is open);
  "Verify" stays the word for checking a fix (managers use it, and the group
  above it says "Fixed, to check"); sent safety and tower reports from before
  the switch still list in the Inbox, as #85 decided; the weekly summary,
  site coverage and issues by company read clearly and were not changed.
- Checks: `npm run typecheck`, `npm test`. Browser checks, all passing:
  office-progress, home-and-sheet, office-landing, office-phone,
  office-actions, office-desk, seen-by-office, help, role-access,
  navigation, first-time-use, review-queue, submission-stages,
  office-registers, accessibility, day-walkthrough, search,
  engineer-layout, signature-reload.
  verify-day-walkthrough now finds the safety lines in the project's
  register, and verify-home-and-sheet expects the project links after
  Latest from site. Screenshots, before and after: project files
  `ui-review/manager-day-simplified/`.
- Not verified: no live tenant, no real phone or tablet, no live mail.
- Proposed, not built: a Weekly summary link on each "Where each project
  stands" row; put the phone overview's project list above the four action
  counts; a plainer word than "Verify" if managers say so.

## 2026-10-21 — An engineer's day, in plainer words

- Why: Cal (2026-10-21 07:02) wants RELAY really easy for hands-on
  engineers. A walk through an engineer's whole day on the simplified RELAY
  at 390px (after #85, #87 and #88): sign in, today's site update with a
  photograph and a variation, no signal for part of it, an unfinished report
  from yesterday, sent reports and what the office did with them, a defect on
  its own, issues and Help. Not a `docs/tasks.json` task, so no status changed.
- Found and fixed (engineer screens only, no new features or fields):
  - The big "Carry on with today's update" button opened a site update left
    from an earlier day, so today's cards went on yesterday's visit. Decision:
    the big button is always today's (a correction still carries on there);
    an earlier day's update waits under "Unfinished reports" with its visit
    day (`EngineerWorkspace.tsx`, `currentDraft`).
  - The report the big buttons open was also listed under "Unfinished
    reports". It is no longer listed twice, unless the list has something to
    add (held on the phone, refused, signed).
  - Every sent report on the home screen and the Reports tab carried "PM not
    notified", which in the pilot is always true and told the engineer nothing.
    Those rows now show the delivery tag only when it went wrong or the
    project manager was emailed. The report's own steps still show Delivery.
  - Plain words in place of IT ones: the Delivery step says "RELAY does not
    email anyone yet. If it cannot wait, tell the project manager yourself."
    (was "The pilot holds notification emails in a local outbox"; the office
    sees the same step, as before); "View the document" is "See the full report";
    "a correction is sent as a new revision" is "to put something right, make
    a correction"; on Check & send "is emailed when the mailbox is live" is
    "is emailed only once RELAY's email is switched on; until then, tell them
    yourself", and "raise issues/variations" is "go on the issue list", "for
    the office to price" (inspections: "go on the snag list"); the offline
    page no longer says "server report" or "sync"; "No connection" is "No
    signal", as on the rest of the home screen.
  - A card just added showed a red "no description of what happened" and a
    red "1" on Check & send before anything was typed. A blank card is left
    off at Check & send anyway (#87), so it no longer counts as stopping it.
  - Signing a site update is optional but looked required: the heading says
    "Sign · optional" and the hint "You do not have to sign a site update:
    your name is printed on it either way." (was "The client signs the paper
    copy"). Inspections are unchanged.
  - Defect on its own: "Individual defect" is "Defect", "Defect received" is
    "Defect sent to the office", "awaiting confirmation … was not submitted"
    is "on the project's issue list now … your site update has not been
    sent"; the file-type line and "Your own trade remains recorded" went.
  - Issues: "Project scope" is "Show", "Showing issues only for the selected
    project" is "Issues on this project, from every trade"; on an issue,
    "Submit as complete" is "Put forward as fixed" (the glossary's words; the
    office sees the same button, and the printed snag list says it too), and
    "Site observation"/"Individual defect" are "From a site update"/"Defect
    flagged on its own". Projects tab: "All projects open to your role" is
    "Pick the site you are on".
  - Help: "What's new" line, the Delivery meaning and where an unfinished
    update waits.
- Verified: typecheck, `npm test`; new `scripts/verify-engineer-day.mjs`
  (390px, light and dark, 35 checks); browser checks listed in the PR.
  Screenshots before and after: project files
  `ui-review/engineer-day-simplified/`.
- Not verified: no real phone, no live tenant, no real engineer.
- Proposals, not built: see the PR ("Bigger ideas").

## 2026-10-21 — Seventh release check (main at 3e470fc, #83 to #88)

- Why: a release check before any deploy, asked for by the coordinator after
  #85 hid the safety, permits and deliveries records (Cal, 07:02). Not a
  `docs/tasks.json` task; no code changed.
- Run on 2243efb, then dad1563 (#86) and 3e470fc (#87, #88) as they merged:
  `npm run typecheck`, `npm test` (146 + 441), `npm run build`, all 69
  `scripts/verify-*.mjs` on Node 22. The busy-projects speed check went over
  its tightest API budgets by 10 to 80 ms on different pages each run, on
  the #85 and #86 builds alike, and passed alone; the deliveries check read
  the focus early once and passed three times in a row after.
- Switch off: seeded a talk, a short delivery, an overdue permit, a sent
  safety inspection with an open action and a sent tower inspection, then
  read 30 engineer and office pages (390px and 1440px) and the issue
  spreadsheet. Nothing of them shows apart from sent safety and tower
  reports in report lists, Came back from the office, the Inbox and the site
  diary, as #85 chose. Switch on brings all back; nothing deleted. A safety
  and a tower inspection held offline still reached the server after the
  switch was turned off while they were held.
- A full site update on a 390px phone (progress and photo, defect and photo,
  variation), seen in Where each project stands, Latest from site, Issues,
  Variations, its PDF and the phone register; the engineer then saw "Seen
  by the office". No fault found.
- Release notes refreshed in the project files
  (`releases/2026-10-20-release-notes.md`): #83 to #88, where the Admin turns
  the switch on, rollback with the switch, after-deploy checks.
- Not verified: a real phone, a screen reader, the live server or tenant,
  the Docker image build.

## 2026-10-21 — Seen by the office

- Why: Cal (2026-10-21 07:02) wants RELAY to get the office the information it
  needs while staying easy for engineers. FE-4 (approved) asks for PM
  acknowledgement. It already existed as an "Acknowledge" button with a note,
  so few reports were ever marked read and the engineer rarely knew a report
  had landed. Decision: make that same record automatic rather than build a
  second one. Opening a sent report is the acknowledgement.
- Changed:
  - A Manager or Admin opening a sent report in the office reader, the full
    report or the report page (from search, say) records it as seen, with
    their name and the time (`components/useMarkSeen.ts`, rule `opensAsSeen`
    in `lib/officeActions.ts`). Opening your own report does not count, and
    the server refuses it too (`acknowledgeReport`). Engineers cannot mark
    anything seen (403, unchanged).
  - The "Acknowledge" buttons and dialog are gone. The API still takes an
    optional note and older notes still show ("Opened by Tom: Chasing").
  - Words: "Read" is now "Seen" everywhere. The engineer sees "Seen by the
    office" on the report's steps and on its row under "Came back from the
    office". The office desk group is "Not seen yet" (each row a link, nothing
    to press); the Inbox filter is "Not seen yet"; "Where each project stands"
    says "N reports not seen yet" per project. Help glossary, office guide
    and "What's new" updated.
  - Phone: the "Not seen yet" rows are 44px tall now they have no button.
- Verified: typecheck, `npm test` (new tests for `opensAsSeen`, the author
  rule and the stage words). Browser checks: new
  `scripts/verify-seen-by-office.mjs` (390px and 1440px, light and dark:
  counts before and after, author and engineer do not mark it, engineer
  home and report say "Seen by the office"); updated verify-office-actions,
  verify-office-phone, verify-submission-stages (engineer first, then the
  office opening marks it seen), verify-office-progress and verify-help.
  Screenshots: project files `ui-review/seen-by-office/`.
- Not verified: no live tenant, no real phone. Reports already on the server
  stay "Not seen yet" until someone in the office opens them.
- Not a `docs/tasks.json` status change: FE-4c stays done; its notes say
  what changed.

## 2026-10-21 — Fewer taps for a site update

- Why: Cal (2026-10-21 07:02) wants RELAY really easy for hands-on engineers,
  getting the office the progress information it needs. A fewest-taps pass on
  writing and sending a site update on a 390px phone, asked for by the
  coordinator. Not a `docs/tasks.json` task, so no status changed there.
- Measured with the new `scripts/verify-fewest-taps.mjs`: open RELAY, send a
  site update with a progress card and a photograph, a defect with a
  photograph at the same place, and a variation somewhere else, marked not
  done yet. Tapping into a box counts, typing does not; "Take a photo" counts
  once (the phone's shutter is not counted). The cheapest way RELAY offers is
  taken each time ("+ Another card here" on main, a recent place now).
  - Main (after #85): **16 taps**; the open defect card was 1,598px tall and
    the variation card 1,784px; 29 buttons on the way were under 48px (44px).
  - Now: **14 taps**; defect card 1,541px (most of it is the photograph), the
    variation card 1,182px; no button on the way under 48px.
  - Screenshots, before and after: project files `ui-review/fewest-taps/`.
- Changed:
  - "Start today's site update" (and "Start another site update") opens the
    new update on a progress card, ready for where, what and a photograph,
    instead of a "What kind of update is this?" picker. The kind row on the
    card changes it in one tap, the same as the picker was.
  - "+ Add a card" then a kind is now one button per kind under the cards
    ("+ Progress", "+ Defect", "+ Variation", "+ Access"), on the phone and in
    the wide editor's rail. The wide editor's "+ Add another card" in the card
    went, since the rail has the same buttons.
  - "Where" offers the places already on this update first (latest first),
    then the project's recent places, so a second card in the same room is one
    tap even before the first card has saved (`lib/quickCards.ts`).
  - A card's optional questions fold under "More for the office · optional":
    on a defect or access card, what needs doing and who should respond; on a
    variation, the reason, who asked, rough size, parts and a linked issue.
    "Has the work already been done?" stays on the card, and "Who asked" comes
    out of the fold when it has been (the office needs it for sign-off). The
    fold opens by itself when anything in it has an answer, so nothing written
    is hidden.
  - A card with nothing in it (no place, words, photo, link or answer) is left
    off when the engineer taps "Check & send", so the progress card an update
    opens on never stops a defect-only update. Nothing in it can be lost.
  - Every tap target in the engineer pages that was 44px is now 48px (kind
    buttons, trades, chips, yes/no, caption boxes, Undo, "Change").
  - Found and fixed on the way: a card added from the home screen
    ("Request a variation", and now the first progress card) was not saved
    until the next edit, because `addCard` called an `update` made before the
    sign-in was known. It now saves straight away.
- Decisions (Claude's): kept the two-step "Check & send" then "Send to
  office": sending cannot be undone and the check step is where the engineer
  sees what will be raised. Kept "+ Another card here". Did not pre-fill a new
  card's place from the last card: a wrong place on a defect costs the office
  more than one tap costs the engineer. Variations' "already done" is not
  defaulted, for the same reason.
- Offline: drafts are kept exactly as before (the same `update` path). The
  check writes a defect with no signal, leaves the blank card off, reloads,
  and finds the defect still there and the blank card not back, then saved
  once signal returns.
- Checks: `npm run typecheck`, `npm test` (146 + 434; four new in
  `apps/web/tests/quickCards.test.ts`). Browser checks, all passing:
  verify-fewest-taps (new), accessibility, day-walkthrough, editor-usability,
  editor-wide, engineer-layout, error-messages, issue-link, offline-capture,
  report-editor, same-location, sent-elsewhere, suggestions, undo-remove,
  signature-reload, typed-signature, draft-conflict, offline-drafts,
  photo-uploads, report-types, home-and-sheet, simpler-home, role-access,
  search, first-time-use, help. Eight were updated for the new buttons and
  the fold.
- Not verified: no real phone, no gloves, no real poor signal (the browser's
  offline switch only). Help's guide and "What's new" are updated and say so.
- Next (proposed, not built): measure the same round trip on a real phone on
  site; photo first ("Take a photo" above "Where") if engineers say they
  shoot first; the offline page's own editor (`offline.html`) still asks for
  the kind first.

## 2026-10-21 — Office view of project progress

- Why: Cal, 07:02 today: RELAY is for site auditing of project progress and
  has to get the office the information it needs. A pass on /office from the
  seat of a manager who has to know where every project stands. Not a
  `docs/tasks.json` task, so no status changed there.
- Walked: the office position, project sheet, phone register, Site coverage
  and Weekly summary at 1440px dark and 390px light, over three projects with
  a month of seeded reports. For each project: when was it last visited, what
  progress was reported, what is outstanding, which variations wait, what
  needs the office. Last visit and progress were on no office screen (only
  Site coverage, one page away); the overview answered "what needs the
  office" but not "where does each project stand"; on a phone the project
  list sat about 5,000px down, under every other list.
- Changed (decisions Claude's):
  - Office position opens with "Where each project stands": one row a
    project, Active then Defects liability, each giving last visit (who and
    trade), visits this week and by which trades, open issues and how many
    overdue, variations waiting (done without an instruction, to price), and
    the office's count. An active site with no report for three working days
    is marked, as Site coverage marks it; a defects liability site never is.
    Rules in `lib/projectStanding.ts`, counted as Site coverage counts (a
    sent correction stands in for what it corrects; inspections are visits).
  - Cut from the overview: the "Received this week / Overdue actions /
    Variations pending" block (now per project in the list) and the latest
    reports table (the New reports group and the Inbox have them). "PM
    notifications pending" goes with the block: it is an outbox state, still
    on each report's tag.
  - On a phone, the overview's list replaces the second project column that
    sat under everything; the four count tiles stay on top.
  - Project sheet: the first figure is now Last visit (with visits this
    week), and "Latest from site" shows each trade's newest site update from
    the last fortnight: its progress and access lines in the engineer's
    words (four, then "and N more"), with defects and variations counted, not
    repeated. The project's own pages and its details (project manager,
    client account, review, engineers) moved below its reports.
  - Phone register (which stands in for the sheet): starts with the last
    visit and Latest from site (two lines a trade); the project's pages moved
    after its records. The project column on the desk gives each project's
    last visit, or that it has gone quiet.
  - Rows no longer stay shaded after a tap on a phone (`.arow:hover` only
    where there is a pointer): the new check's axe run found an alert tag on
    a tapped row at 4.32:1.
- Nothing new is asked of engineers; nothing sends, writes to SharePoint or
  deletes. Help: the office day steps and What's new "Where each project
  stands".
- Checks: `npm run typecheck`, `npm test` (146 + 436; new
  `tests/projectStanding.test.ts`), `npm run build`. New
  `scripts/verify-office-progress.mjs` (74 checks: the five answers per
  project and the count matching the register, quiet and defects liability sites, a correction counted once,
  inspections left out of Latest from site, words of the correction not the
  original, what is left out said, the row and trade headings opening the
  right pages, a report that will not load, a project with no recent update,
  axe at 1440px dark and 390px light, tap sizes, no sideways scroll; passed
  five runs). Updated for the new layout: `verify-office-landing`,
  `verify-office-phone`, `verify-day-walkthrough` (reads the project's row in
  place of the cut "Received this week"), `verify-first-time-use`,
  `verify-home-and-sheet` (links after Needs attention / after the
  register). Every browser check run after merging main (#85): see the PR.
  Screenshots before and after in the project files,
  `ui-review/office-progress/`.
- Not verified: a real phone or tablet, a screen reader, the live server.
- Proposed, not built: a "Behind" flag per project needs a programme or
  target dates RELAY does not hold, so it was left out; the Weekly summary
  could open from each project row.

## 2026-10-21 — Simpler RELAY for site engineers

- Why: Cal, 07:02 today: too much health and safety and checking of outside
  factors that are not site auditing of project progress; engineers are
  hands-on people, not IT people, and need an easy system that gets the
  office what it needs. Not a `docs/tasks.json` task; EXP-5's notes record
  that its safety and tower types are now behind the switch.
- Decision (Claude's, Cal was asked whether to delete instead): hide, don't
  delete. One office switch, "Safety, permits and deliveries", off by
  default, on the Admin tab under Site records (Admin only, audited). It
  covers toolbox talks, permits to work, deliveries, the weekly safety and
  tower inspections and Safety actions. Off: no row, tile, link, count or
  Needs attention line for them on the Site page, Reports, the office
  overview, project sheet or phone register; My week, the weekly summary and
  Before handover leave them out; Help drops their What's new entries, guide
  section, page links and glossary sentences. Their four pages say plainly
  they are not in use with a way back, their API answers 404, and a safety
  or tower inspection cannot be started online or from the no-signal page.
  One already started with no signal is still accepted, and a draft already
  open still shows, so no work is stranded. Stored data is untouched;
  turning the switch on brings everything back.
- Decision: pre-handover and first fix inspections stay. Walking the Site
  page, they did not get in the way once grouped under "Inspections" below
  the main buttons; they are quality checks on our own work whose actions go
  on the snag list, which is progress and snags, not health and safety.
- The engineer's Site page, tidied round the site report: one big gold
  "Start today's site update" (or "Carry on with today's update") button,
  then Flag a defect and Request a variation; Unfinished reports only when
  there are some; Came back from the office ahead of Since your last visit;
  This project down to Site issues, Reports, Notes for the next visit and
  Photographs, with Weekly summary, Site diary, Before handover and Issues
  over time folded under "More on this project"; rows at least 56px tall on
  a phone. On a 390px phone the page is 2,436px tall, down from 3,241px, and
  the big button sits in the first screen. The office keeps its view of
  progress, issues and variations; its project sheet groups pages as
  Reports and records, then Issues.
- Screenshots: `ui-review/simpler-for-engineers/` in the project files,
  before and after, phone 390px light and desktop 1440px dark, plus the
  Site page with the switch on.
- Checks: `npm run typecheck`, `npm test`, `npm run build`. New
  `scripts/verify-simpler-home.mjs` (both states, the Admin turning the
  switch on from the Admin tab, a Manager refused, data kept).
  `verify-home-and-sheet.mjs` rewritten for the new home and sheet in both
  states. Every check that uses the hidden records now turns the switch on
  first; `verify-first-time-use` and `verify-help` expect a first day with
  it off; checks that tapped "Start a site update" or a folded page now tap
  "Start today's site update" or open "More on this project" first. All 65
  browser checks passed against this branch's build (simpler-home 56,
  home-and-sheet 254, accessibility 584, first-time-use 364, day-walkthrough
  112, help 36 and the rest), plus `npm test` (146 + 428).
- Search, My week and the weekly summary also leave out sent safety and
  tower inspections while the switch is off; they stay in report lists, the
  Inbox and the site diary, which are the record of what was sent (found by
  the fresh-context review). A safety draft carried on while off still says
  its actions go on Safety actions; left, as such drafts are rare.
- Not verified: a physical phone, screen readers, the live server.
- Proposed, not built: remove the hidden records entirely if Cal says so;
  shorter inspection blurbs (they repeat "actions go on the snag list").

## 2026-10-21 — PDFs with long, real content

- Why: a quality pass asked for by the coordinator. Clients, auditors and the
  office keep these PDFs, and until now they were only looked at with tidy
  sample data. Not a `docs/tasks.json` task, so no status changed there.
- How: `scripts/long-pdf-cases.mjs` builds ten worst cases across every
  report type (site update, weekly safety, pre-handover, first fix, tower and
  podium): 40 cards; notes, actions, owners, a place and a correction reason
  at the 10,000-character limit; a list of 120 short lines; long accented
  company and person names with apostrophes; 33 photographs on one report,
  each its own picture put through the app's own PDF resize, including
  500×2000 and 4000×600 ones; typed and drawn signatures; every check failed;
  an all-clear tower; a report with one empty card and one with none. Pages
  were rendered to images and looked at, before and after; the pairs are in
  the project files under `ui-review/pdfs/long-content/`.
- Found on main, and fixed in `packages/documents`:
  - A summary row, a card's action box, a correction or a card's title taller
    than a page was kept on one page anyway: it ran under the footer and off
    the paper, and the words there were lost (the layout engine warned nine
    times on one report). The card's owner was also left out of the estimate
    of how tall a card is, so a long owner kept a card together that could not
    fit, and its parts were drawn over each other. Now each may carry on to
    the next page when it is too tall for one, and the estimate counts the
    owner. A caption over 600 characters may part from its photograph.
  - In the summary, an item, action or owner longer than 160, 400 and 160
    characters (or more than six lines) is shortened at a word and points to
    the card, as "Found:" lines do (#70), so each row still fits on a page.
    Shorter text prints as written, line breaks and all.
  - A project name long enough to wrap printed its lines over each other
    (the page's 14pt line height reached the 21pt title) and pushed the
    reference past the margin. The title now takes the room the reference
    leaves and has its own line height, with a negative margin taking the
    extra height back, so a one-line title sits where it always has (checked:
    every word on the tidy samples is where it was on main). On a wrapped
    name the rule under the title is as close to the last line as it always
    was to a one-line title. A card's long place name ran
    under its type label; it now wraps short of it.
  - A title-block value on more than one line had its label level with the
    last line; labels are now set from the top, which puts them in the same
    place on one line and level with the first line on more.
  - A panorama (at least 2.5 times as wide as tall) was 34pt high in a
    half-width frame; it now has its own row across the card at the height it
    needs. A photograph at least 2.5 times as tall as wide was 32pt wide; it
    now has its own row in a 320pt frame. Every other photograph is laid out
    as before. Read from the image's own size, so nothing new is stored.
  - Labels, table heads, photograph dates and the footer's ACCREDITATIONS
    were #83868c: 3.6:1 on white and 3.3:1 on the table heads' wash, faint
    for 6pt type on paper. Now #6c6f75 (5.0:1 and 4.6:1).
  - A run of more than 20 characters with no space now breaks every 20, not
    every 24: a 24-character name ran 5pt into the margin in the summary's owner
    column.
- Decisions (Claude's): photographs stay at the app's 1,600-pixel PDF copy,
  about 330 KB each, so a 33-photograph report is about 10.7 MB. They are
  evidence and are zoomed into; nothing is emailed (delivery files to
  SharePoint). Proposed in the PR, not built: a smaller copy for PDFs if
  reports are ever emailed. A 10,000-character place name prints as a title
  pages long in the card; it is what was typed, so it is not cut. PDFs
  already made are cached per sent revision and are not made again.
- Priority: part-way through, Cal asked (via the coordinator) for RELAY to
  focus on progress reporting, with the site update PDF first and the safety
  and tower ones left alone. Every fix here is in the one renderer all report
  types share, so the site update gets all of them; nothing was added that is
  only for safety or tower inspections. Their worst cases stay in the check
  because they cost nothing extra to keep.
- Not changed: anything in the report editor; registers (spreadsheets, not
  PDFs). The pages people print from the browser (weekly summary, snag list,
  before handover, safety actions, My week) were printed to PDF with a year of
  busy data (`seed-busy-projects`) and looked at: nothing cut off or
  overlapping, so left as they are.
- Checks: `npm run typecheck`, `npm test` (146 + 427; two new in
  `apps/web/tests/reportPdf.test.ts`: boxes at the limit print in full with
  no page-tall block and the summary points to the card; a long project name
  wraps without overlapping or leaving the margin; both fail on main). New
  `scripts/verify-long-pdfs.mjs` builds the ten worst cases and checks, read
  back with pdf.js: no block taller than a page, a footer and "Page n of N" on
  every page, no text off the page or into the footer, no line drawn over
  another, every long box there to its last words, no page ending on a
  heading or card title (a card's head line holds its title, number and label), photographs not stretched and at least 40pt, the
  page count in range and the file no more than 400 KB beyond its
  photographs. It passes on this branch and fails 9 of 10 cases on main. The
  tidy samples (`scripts/render-sample-pdfs.mjs`) render pixel for pixel as
  on main apart from the darker grey, the one 1600×500 panorama, one check
  title on the pre-handover sample that used to touch its label and now
  wraps, and a long reference and a signed-in email address that now break
  every 20 characters. Browser checks after
  `npm run build`, all passed: `verify-help`, `verify-typed-signature`,
  `verify-report-types`, `verify-first-fix-inspection`,
  `verify-handover-inspection`, `verify-tower-inspection`,
  `verify-role-access`, `verify-pdf-navigation`, `verify-day-walkthrough`
  and `verify-error-messages`.
- Not verified: printing on paper, Adobe Acrobat or a phone's PDF viewer
  (pages were read with pdf.js and drawn with poppler only); real phone
  photographs (the photographs were made from noise, sized and compressed as
  the app does).

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
- Second full run on main at 04334f5 (after #80 and #81): typecheck,
  `npm test` (146 + 425), build and all 64 browser checks; 63 passed.
  `verify-toolbox-talks` failed once reading where the keyboard focus was
  a split second before the page moved it (the same race #74 fixed for the
  withdrawn talk, on the other three focus checks). Those checks, and the
  same eight in the permits and deliveries checks copied from it, now wait
  up to 2 s for the focus. Each of the three checks passed three runs in a
  row.
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

## 2026-10-21 — Second day-on-site walkthrough

- Why: asked for by the coordinator after #71 to #80 added safety actions in
  Needs attention, toolbox talks, the security changes, empty pages, permits
  to work, registers and downloads, failure messages, SharePoint dates and
  deliveries. Like #65, a whole day was played in the browser: an engineer on
  a 390px phone (toolbox talk, a hot works permit opened and closed, a short
  delivery, a site update with a linked defect, photographs, signed out once,
  a card added with no signal, safety and tower inspections), then the office
  at 390px and 1440px picking it up. Not a `docs/tasks.json` task, so no
  status changed there.
- What did not join up, and what changed (decisions Claude's):
  - My week said "Nothing recorded this week yet" on a day the engineer had
    given a toolbox talk, recorded and closed a permit and taken in a delivery.
    It now lists the talks, permits (recorded or closed) and deliveries
    (recorded or sorted) the person made themselves, each linking to its page,
    and the timesheet copy counts them ("1 toolbox talk, 1 permit, 1
    delivery"). Withdrawn records are left out (`lib/myWeek.ts`).
  - The Weekly summary, "for the site meeting", left out the week's toolbox
    talks, permits and deliveries. It has a new section for them: talks given,
    permits issued or closed in the week (one issued last Friday and closed on
    Monday counts), and deliveries with any still to sort (`lib/weeklySummary.ts`).
  - The office on a phone sees a project as its register, whose "Needs action"
    said 0 and "No report needs attention" while the project had a tower due,
    open safety actions and a short delivery (the desktop sheet showed them).
    The register now lists the project's safety, permit and delivery lines
    under Needs action and counts them in its chip.
  - The engineer's Deliveries row now turns red while a delivery is to sort,
    as Permits to work does for a permit past its time and as the office's
    Needs attention flags it.
  - Help: one "What's new" line; the meetings guide names Toolbox talks,
    Permits to work and Deliveries among a project's pages.
- Looked at and left (fine together): the home screen and project sheet with
  every row (grouping from #54 holds), counts on the home screen, Safety
  actions, Before handover, snag list and register download (all agree, the
  check compares them), sign-out and no-signal messages on the permit and
  delivery forms (both keep what was typed).
- Proposals, not built: Search covers reports, issues and variations only,
  so a delivery or permit cannot be found by supplier or permit number; the
  Site diary is made from reports only and could show the day's talks,
  permits and deliveries; the register's "Needs action" (reports and issues)
  and the sheet's "Needs attention" could share one name; the Needs attention
  pop-up's "Issues →" link reads oddly when its lines are safety or deliveries.
- Check: `npm run typecheck`, `npm test` (146 + 428; new tests in
  `tests/myWeek.test.ts` and `tests/weeklySummary.test.ts`).
  `scripts/verify-day-walkthrough.mjs` now also records the toolbox talk,
  permit and short delivery from the home rows, is signed out partway through
  the site update and saves once back, closes the permit, reads My week, and
  in the office checks Needs attention and the phone register, sorts the
  delivery from Needs attention, downloads the permit and delivery
  spreadsheets and reads the Weekly summary (112 checks). Every
  `scripts/verify-*.mjs` was run against this branch's production build
  (results in the PR). Screenshots: project files `ui-review/day-walkthrough-2/`.
- Fresh-context review: no correctness gaps; 5 smaller points, all fixed: My
  week showed the time a record was typed against the day it happened (now
  only when the same day); the Weekly summary dated a permit issued last week
  outside the week (now the day it was closed, with "issued" beside it) and
  left out a delivery sorted this week that arrived last week (now in, like
  permits); a permit recorded and closed counted twice in My week's figure;
  the Help line said "on a phone" though the register shows on a desktop too.
- Browser checks: all 64 `scripts/verify-*.mjs` passed on the final build
  once `verify-site-notes` and `verify-toolbox-talks` opened the full What's
  new list (this PR's entry pushes theirs past the latest six); main's #81
  made the same fix, so its version is kept after merging main.
- Not verified: a real phone or tablet, a live tenant or SharePoint, a real
  screen reader.

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
