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
