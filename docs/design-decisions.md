# Interface design decisions

8 September 2026 — approved entry design, now implemented in the app.

- Desktop sign-in: option 2, "Site & structure", from the three initial drafts.
  Retain the split composition, structured typography and brass accents.
- Mobile sign-in: approved compact refinement, "Welcome to RELAY", with the
  sign-in button higher up, short copy and no large promotional hero section.
- Both support light and dark appearances. Microsoft authentication behaviour
  and honest prototype/local-sign-in messaging must remain in implementation.
- Approved references are banked in `designs/`. In the desktop reference select
  option 2; options 1 and 3 are retained only as historical alternatives.
- Company hub: revised option 3 (Editorial) approved for desktop and mobile.
- Final coordinated reference: `designs/entry-approved.html`. This supersedes the
  earlier sign-in colours; earlier drafts are retained as history only.
- Shared neutral charcoal/grey, off-white text, gold labels and primary actions.
  Aquamarine is reserved for the Compliance label/accent. Both company arrow
  boxes use the sign-in button's gold fill and contrasting foreground.
- Permanent internal padding keeps company text away from the hover background
  edges. Desktop sign-in retains the split hero; mobile omits the large hero.
- `/` is company selection. `/developments` routes Admin to `/admin`, Manager to
  `/office`, and Engineer to `/engineer`. Existing authenticated deep links remain.
- `/compliance` routes by the same Microsoft role assignment as Developments:
  Admin and Manager to `/compliance/office` (the portfolio browser), Engineer to
  `/compliance/engineer` (the site view). Workspace Home links retain the
  role-based destination; Companies and the RELAY brand return to the hub.
- Company selection is navigation, not a substitute for access control. Compliance
  functionality must not be implied to exist merely by the appearance of a mockup.

Authentication and role checks remain in place. Local prototype identity warnings,
sign-in errors, appearance control and installation guidance remain available.

## Implementation verification

- Production build passed, including TypeScript checks and the worker build.
- All 153 automated tests passed (145 shared and 8 web).
- Headless Edge smoke checks passed for local sign-in, company selection,
  Compliance/back navigation, the Engineer destination and sign-out.
- Layout checks passed at 320, 390 and 1280 pixels, including light/dark themes,
  stable company-row hover geometry and matching gold heading/action colours.
- Desktop sign-in and mobile hub screenshots were visually inspected.
- Live Microsoft tenant authentication was not tested; Admin/Manager routing was
  inspected in code but not exercised with live accounts.

8 September 2026 — Compliance workspace built from the approved prototypes.

- Office: the portfolio browser (Clients › Buildings › Assets › Details) with
  Due, Overdue, Remedials, Reports, Engineers and Admin tabs. Engineer: the phone
  view with today, diary, visit logistics, building assets and service forms.
  References: `compliance-home-concepts-2026-09-08.html`,
  `compliance-portfolio-prototype-2026-09-08.html`,
  `compliance-engineer-mobile-prototype-2026-09-08.html`.
- Both views render from `apps/web/lib/compliance/model.ts`: invented, seeded
  sample data anchored to the day the page opens. Nothing persists. It is a
  prototype of the screens, not a compliance record, and the app-wide prototype
  banner stays. A real store replaces the module; the views keep the shapes.
- Accent roles inside Compliance: aquamarine for the company mark, references
  and active state (the role brass plays in Developments); gold stays on the one
  primary action per screen, as on the hub. Status vocabulary is fixed at four
  words everywhere: in date, due, overdue, no record. No record is never shown
  as compliant and never counts as overdue.
- Service forms are placeholder templates, one per requirement, labelled as
  drafts against the named standard. Leodis's actual forms replace them. The
  statutory intervals in the model are typical UK practice and must be
  confirmed with Leodis before they drive anything.
- Booking a visit never changes compliance status; only a filed report moves the
  date. Marking a visit on site does not file anything.
- The Compliance workspace owns its chrome; the Developments navigation is hidden
  under `/compliance`. Authentication and role checks are unchanged.

9 September 2026 — Developments Office and Administration rebuilt from the
approved Portfolio desk concept.

- Concept 1, "Portfolio desk", in `developments-office-admin-concepts-2026-09-09.html`
  is approved for desktop and mobile. Concepts 2 and 3 are retained as history;
  their reader ordering (actions and decisions first) and action lanes (every
  attention item carries its verb) were folded into the build as recommended.
- One workspace stylesheet, `apps/web/app/workspace.css` (scope `.ws`), lifted
  from `compliance.css` with the accent as a variable: gold for Developments,
  aquamarine for Compliance. Neutrals are the Compliance workspace's, so both
  offices sit on one palette and differ only in the accent role. Compliance
  still loads its own `compliance.css`; moving it onto `workspace.css` is a
  follow-up, not a change made here.
- `/office` is the desk for Managers and Admins: Projects › Register › Details,
  Inbox with the reader beside it, Issues, Team, and Admin for the Admin role
  only. `/admin` opens the same desk on the Admin tab, so the hub's Admin
  destination and older links keep working. Hash routes carry the position:
  `#/projects/011LME/report/<id>`, `#/projects/011LME/issue/<id>`,
  `#/inbox/<id>`, `#/issues`, `#/team`, `#/admin/roles|drafts|delivery|help`.
- Below 700px the tab strip is a bottom bar, the column browser shows one
  level at a time with a back link, and tables scroll inside their panel. The
  phone lists drawn in the concept were not rebuilt as cards in this pass.
- The engineer side was changed so the two sides marry (findings and order in
  `office-engineer-reconciliation-2026-09-09.md`): the engineer's report list
  and page use the office's review, notification and read words; the email to
  the project manager is shown for what it is, a notification that a report
  came in ("PM notified" or "PM not notified", quiet), never as delivery of the
  report, which is on file the moment it is received; report summaries carry
  per-kind counts so the register can say what a visit found; the office sees
  the section count and trade on another engineer's draft, never its contents;
  the author of a sent report can start a correction (a new revision that keeps
  the photographs and links its defects to the issues already raised, so
  sending it adds a sighting rather than a duplicate); the office can
  acknowledge a report, and the engineer sees who read it.
- Two store rules met while building. An issue raised with an owner named on
  site is already "assigned", so assigning again updates the owner and target
  without a state change instead of being refused. A closure the office is not
  satisfied with goes back to in progress ("Not finished"), because the state
  graph does not allow awaiting verification to reopen.
- Development only: `RELAY_LOCAL_ROLE=Manager` or `Admin` in
  `apps/web/.env.local` lets local sign-in open the office. A production build
  ignores it, so a demonstration build still receives Engineer only.
- Not built, on purpose: Chase (no command behind it), Projects & review
  settings (shown as planned), Team as an assignee list (issue owners are names
  or companies typed on site, not accounts).

10 September 2026 — Variation register built into the Developments office;
engineer views drafted for review.

- A "Variation required" update now raises a variation record at submission,
  beside the issues a report raises, numbered `011LME-VO-001` per project.
  The record mirrors the Variation Register list on the Operations site field
  for field (columns recorded in
  [sharepoint-lists-created-2026-09-09.md](sharepoint-lists-created-2026-09-09.md));
  expected cost, estimated margin and margin % are worked in
  `apps/web/lib/variations.ts` exactly as the list's calculated columns.
- Instruction is one state: pending, instructed, declined. The office prices
  (labour, rate, parts, plant, uplift, quoted value), then records the client's
  instruction (reference, who, when, value, signed copy link) or declines with
  a reason; reopening needs a reason. An instructed value is fixed until the
  variation is reopened. Every act is an event on the record.
- `workDone` (work carried out on a say-so before any written instruction,
  EXP-3) is a fact of its own, set by the office for now. It outranks
  everything but overdue issues in Attention as "Done, not instructed", and
  the sheet carries the sign-off warning from
  [variation-signoff.md](variation-signoff.md). It is not yet a list column;
  add one before synchronisation.
- Desk: a Variations tab (chips for awaiting instruction, needs a quote, done
  not instructed, instructed, declined; project, trade and reason filters;
  totals in the footer), a Variations chip in the project register, a
  variation sheet at `#/projects/011LME/variation/<id>`, the reader's
  "Actions and decisions" linking each variation to its VO reference and
  state, and a "Variations pending" figure on the office and project sheets.
  Engineers may add a note to a variation; pricing, instructing, declining,
  reopening and editing details are Manager and Admin acts, enforced on the
  route.
- Engineer views: three concepts for phone and tablet in
  [engineer-views-concepts-2026-09-10.html](engineer-views-concepts-2026-09-10.html),
  with a section 0 audit of what the office extracts from each kind of update
  and the five optional observation fields any concept needs (affected trade
  on a defect; reason, already done, who asked, rough size on a variation).
  Recommendation in the document: build Concept 1 (one thing at a time), take
  the "what came back" list and entry page from Concept 2 and the area chips
  and "still open here" from Concept 3. Nothing engineer-side was changed in
  the app in this pass.
- Later the same day: Concept 1 (one thing at a time) approved for the
  engineer views on phone and tablet. The olive band behind the current
  project is dropped in favour of the sign-in and hub charcoal (`#282b2d` on
  the light theme, `#202224` on dark, gold label), so the engineer screens sit
  on the same palette as the hub and the office. The engineer view as built
  still uses the olive; it changes when Concept 1 is built.

10 September 2026 (evening) — Concept 1 built into the app.

- Engineer home: the charcoal current-project band, one big tile to start or
  continue today's update, tiles to flag a defect (still sent on its own) or
  request a variation (opens the site update with a variation card started),
  then "Came back from the office": the engineer's own reports, issues and
  variations on the project with the office's tags (received, read, PM
  notified; assigned, ready for verification; with the office, quoted,
  instructed, done not instructed). Olive is gone from the engineer screens.
- Report editor: cards, not sections. A new card shows the kind picker first
  (progress, defect, variation, access) and then only that kind's questions.
  Where offers the places already typed on this project (a new
  `/api/locations` route over submitted reports, issues and variations; free
  text always allowed, no catalogue). A defect asks the trade affected, what
  needs doing and who, and offers open issues as pictures and words for a
  repeat sighting. A variation asks what extra work and why, the reason (the
  register's six), whether it has already been done on a say-so, who asked,
  a rough size (½ day, 1 day, 2 days, more) and the cost of parts if known.
  Check & send: counts by kind, stops and checks, "what sending does", sign.
- Five optional fields on an observation carry this (`affectedTrade`,
  `variationReason`, `workDone`, `askedBy`, `roughSize`, `partsEstimate`).
  At submission the trade lands on the issue; the reason, already-done, who
  asked, parts and a starting labour figure (4, 8 or 16 hours) land on the
  variation, so the office's Price dialog opens prefilled.
- `/variations/<id>` is the engineer's view of a variation after sending:
  the office's answer in the band, the words and pictures as sent, the
  history, and a note back (the only variation act an engineer has).
- Defect cards are allowed in a site update again. The option had been
  disabled on 8 September without a recorded reason; the approved concept
  draws it, the store has always raised issues from it, and the individual
  defect remains for a photo-and-note sent on its own.
- Verified: typecheck; 26 web tests including a new check that card fields
  reach the issue and the variation; phone (375px) and tablet (1024px)
  layouts in the browser through a full send; no console errors.

## Implementation verification, 9 September 2026

- Production build passed under Node 24, including the worker build.
- 145 shared tests and 18 web tests passed, the web set including new checks
  for corrections (no duplicate issues, photographs kept), acknowledgement,
  the draft allowlist, reassignment of an assigned issue and the quiet
  notification words.
- `scripts/verify-role-access.mjs` passed 61 checks against the production
  build. Three of its landing-page assertions were brought in line with the
  8 September decision that `/` is company selection and `/developments`
  routes by role; they had not been updated when the hub landed.
- Local browser checks on the development server with a seeded store: the
  Projects browser, project sheet, report reader, issue sheet, Inbox with
  reader, Issues, Team and the Admin sections rendered; an Assign command was
  run end to end from the issue sheet; the phone layout was checked at 375
  pixels (one column per level, back links, fixed bottom tab bar, no
  horizontal scroll); the engineer's returned report showed the reviewer's
  note and the same status words as the office.
- Not exercised: the Playwright engineer-layout script (Playwright is not
  installed in this checkout), live Microsoft sign-in, and the worker sending
  a notification, which the pilot does not do.
