# Engineer site companion — phone and tablet

The Option 3 design is now connected to the existing application. Engineers land
on it at `/`; authenticated users can also open `/engineer`. Admin and Manager
navigation includes **Engineer view** for testing. This changes presentation,
not identity or permissions: an Admin testing here still authors reports as Admin.

## Layout and navigation

- Below 900 CSS pixels: the project card and capture actions precede drafts and
  project information. Report section selectors sit above the editing area.
- At 900 CSS pixels and above: home uses two columns and report section selectors
  sit to the left of the editor. Rotation, split screen and browser resizing use
  the available width; there is no device-name or installed-app detection.
- The last valid project choice is remembered per signed-in account on this
  device. A `project` URL parameter takes precedence. Reports always retain their
  original project, independently of that preference.
- `/engineer?project=proj-011lme&view=issues` opens the project issue view;
  `view=reports` and `view=projects` are also supported.

## Connected to existing logic

- Start a site update through the existing report creation endpoint, or continue
  your own saved draft. Submitted project reports from all trades are available
  in Reports, with pagination.
- Add section creates an existing Observation, not a new storage entity. Section
  labels come from the observation location; kinds, required fields, photograph
  capture, linked issues, autosave, signature and submission rules are preserved.
- Section switching leaves editors mounted. Width changes are CSS-only, so
  rotation cannot reset entered text or the selected section.
- Submission still checks and sends every section. A defect inside a report
  still requires a photograph under the existing validation rules.
- Issues default to the current project; All projects loads the accessible
  projects and labels each register. Existing issue links and commands remain.
- Drafts in the companion belong only to the current stable author ID, including
  when an Admin uses the preview. No role/author spoofing or permission bypass.

## Individual defects

**Flag a defect** opens an independent form on phones and tablets: photographs,
short description, location and affected trade. The trade defaults to the signed-in
engineer's trade; local demo accounts/Admin without a trade choose explicitly.
Electrical, HVAC, P&H and Other / non-Leodis are supported. The server records
the reporter's stable ID, name and own trade independently of the affected trade.

Check then send creates one open, provisional issue, with an ISS reference and
raised event. No report is created or submitted. Photos are validated before
the issue becomes visible. Existing manager confirmation and independent work
verification rules remain. Up to 8 photos, 20 MB each and 40 MB combined.

Unsent defect text and photo references are retained per account/project in
localStorage; original photographs use existing IndexedDB media storage. This
is a device draft, not a server receipt or a guarantee of full offline operation.
A submission becomes immutable while awaiting a receipt: retry sends the same
request ID and bytes. The server returns the existing issue on a duplicate
receipt and refuses changed payloads for an already received request.

Issue lists show photograph previews, descriptions, project/location, work state,
affected trade and reporter. Open, Reported by me, and All issues filters are
available within the selected project scope. Older issues without trade metadata
are labelled as not recorded.

## What the office sees, and what comes back

Added 9 September 2026 with the office desk. The Reports list and a submitted
report show the same words the office uses: received, then review (awaiting,
approved, returned for changes, or no review required), the PDF and the
notification email to the project manager (PDF queued, PM notified, PM not
notified) and whether someone in the office has read it. A
report the office sent back shows the reviewer's note; its author can start a
correction from the report page. The correction is a new draft revision that
keeps the photographs and links its defects to the issues the original raised,
so sending it adds a sighting to each issue instead of raising them again. The
sent revision stays on file and the office sees which revision supersedes which.

## Visible but disabled

- **Trade affected inside report sections:** the report observation model does
  not yet store an affected trade. This selector stays disabled; individual
  defects support affected trade now.
- **Assigned to me:** issue owners are free-text names/companies, not user IDs.
  Do not infer account assignments from names.
- **Team & contacts** and **Project documents:** no complete destinations yet.

Project names/managers still come from the existing fixture project source.
No SharePoint filing or live email delivery was added.

## Test locally

Run `npm --workspace @relay/web run dev` and open `http://localhost:4310`.
With no Entra configuration, development mode offers the existing local engineer
sign-in. Production requires Microsoft configuration. Use `/engineer` from an
Admin session on a configured instance. A Hetzner deployment is still required
before any local changes appear at `app.relaybyleodis.com`.

Try widths 390×844, 820×1180 and 1180×820. Continue a report, add a section,
enter notes, wait for the server save acknowledgement, rotate, switch sections,
reload and submit. Check project scope in Issues and disabled feature labels.

## Verification

`npm test`, `npm run build`, and `node scripts/verify-role-access.mjs`.
`node scripts/verify-engineer-layout.mjs` adds isolated production browser checks
for all three sizes, disabled controls, draft privacy, cross-project issue scope,
section saves across rotation/reload and submission of all sections. Set
`RELAY_PLAYWRIGHT_MODULE` and `RELAY_BROWSER_PATH` when Playwright/Chrome are not
available by default. Optional `RELAY_SCREENSHOT_DIR` captures layout evidence.
These use synthetic sessions and a temporary store; they do not test Entra login
or change the live server.

Defect tests additionally cover no report mutation, attribution, missing/invalid
photographs, media ownership, repeated receipts, changed-payload rejection and
the existing issue work transitions. Browser coverage includes cross-trade
capture, device draft restoration and a deliberately lost submission response.

Implementation: `apps/web/components/EngineerWorkspace.tsx`,
`apps/web/app/engineer/page.tsx`, `apps/web/app/engineer.css`, the home/layout
routes, and `apps/web/app/reports/[id]/page.tsx`.
