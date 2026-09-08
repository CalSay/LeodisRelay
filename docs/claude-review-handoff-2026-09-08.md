# RELAY: implementation and deployment handoff for Claude

Prepared 8 September 2026. This document summarizes work in the Hetzner/setup
conversation and identifies where to review it. It is not a claim that RELAY is
ready for operational site records.

Repository: https://github.com/CalSay/LeodisRelay

Local workspace: `C:\Users\Admin\Documents\GitHub\LeodisRelay`

All paths below are relative to that repository root. Starting commit before
this work: `337c3c6` (Optimise Relay reporting and document deployment and product
roadmap). Review the commit containing this document against its parent. Several
features described in older reviews were already implemented at the starting
commit; they should not be credited to this work or rebuilt unnecessarily.

## 1. Outcome and live-state evidence

| Area | What changed / evidence | Status |
| --- | --- | --- |
| Hetzner hosting | User created CX23 in Helsinki, Ubuntu 24.04; configured SSH, sudo administrator, UFW and Docker using guided commands | User confirmed working |
| Domain and HTTPS | app.relaybyleodis.com points to 2.29.47.29; Caddy fronts web/worker deployment | DNS checked; user confirmed HTTPS/app access |
| Microsoft sign-in | User created RELAY app registration, Web callback, secret and delegated identity consent; enabled assignment-required and assigned users | User confirmed sign-in |
| Persistence | Web and worker share SQLite/media volume; user checked reports/images/PDF after restart | Restart persistence confirmed; not a restore test |
| Roles | Added app-role interpretation, role-specific views and API authorization; user created/assigned the five Microsoft role values | Upgrade output confirmed; complete per-account acceptance not independently observed |
| Installation | Added install guidance and conditional browser-native prompt | User installed through Android Chrome and reported working sign-in/report/photo/PDF flow; Firefox offered no install option on their device |
| PDF return navigation | Replaced raw PDF new-window navigation with in-app PDF.js viewer | Local build/browser checks passed; deployment archive supplied, latest deployment/phone Back fix not yet confirmed |
| Backups | Hetzner backups enabled; role upgrade script made a stopped-volume backup and retained old image | User supplied successful output; off-server copy and restore test pending |

Reported role-upgrade backup: `/opt/relay-backups/20260908T090732Z`.
Reported retained image: `relay:before-roles-20260908T090732Z`.
Server checkout: `/opt/relay`; server secrets: `/opt/relay/deploy/.env`.
No server password, private SSH key or client-secret value is included here.
Server commands were executed by the user; this agent did not directly administer
the remote host or Microsoft tenant.

## 2. Product decisions to preserve

- Three access levels: Admin, Manager, Engineer. All can access every project
  initially. Future project assignments must remain separate from role/trade.
- Engineers edit only their own drafts and see submitted reports/issues across
  trades. Managers/Admin get other draft summaries, not unfinished content,
  signatures, photographs or draft PDFs. No Admin content bypass was introduced.
- Engineers need a quick capture experience. Own trade should be automatic;
  the proposed defect “Trade affected” control defaults to it with no extra tap.
  An exception can select another trade/outside-Leodis scope; responsible company
  remains optional for capture and can be confirmed by a Manager later.
- Reporter identity and trade-at-the-time must not change when affected trade
  changes. Role/trade profile support and new-report author trade are implemented;
  the defect selector, scope fields, issue trade filters and full trade provenance
  are still backlog work.
- Preserve review-off-by-default, receipt/review/delivery/acknowledgement as
  distinct states, and the prototype banner while operational gaps remain.
- The product proposal document was explicitly excluded from prioritization.
  No broad business-management/accounting expansion is authorized by this work.

## 3. Infrastructure and upgrade files

| Files | Purpose / review focus |
| --- | --- |
| `Dockerfile` | Node 24 build stage runs npm ci/build; runtime runs as node user; writable /data; web starts from apps/web |
| `.dockerignore` | Excludes secrets, local evidence/state, generated builds, Git and archives from build context |
| `.gitignore` | Adds .deployment/ for local source bundles/screenshots/manifests |
| `deploy/compose.yaml` | One web service and one worker using relay:pilot and a shared named data volume; Caddy publishes only 80/443; local auth/live mail disabled; bounded Docker logs |
| `deploy/Caddyfile` | HTTPS reverse proxy for app.relaybyleodis.com to web:4310 |
| `deploy/.env.example` | Placeholder-only Entra tenant/client/secret/callback configuration |
| `deploy/README.md` | Build/load/start guidance, persistence, backup/rollback precautions and pilot limitations |
| `deploy/upgrade-roles.sh` | Initial role rollout: retain current image, build candidate, stop writers, archive/verify volume, start candidate, check sign-in HTTP/worker; attempt previous-image recovery on failure |
| `deploy/upgrade-pilot.sh` | Reusable copy of that workflow using generic update image tags |
| `deploy/rollback-roles.sh` | Restore a recorded prior application image without overwriting user data |

The scripts copy configuration/secret files into a root-only backup directory,
then back up the complete data volume while both writers are stopped. They do
not use `down -v`, prune images or overwrite the SQLite volume on rollback.
Data-backup archive readability/checksum is checked, but this is not restoration.
Candidate build currently happens on the CX23 while the old app runs.

Local ignored bundles under `.deployment/` were used for manual SCP transfers:
`relay-pilot.tar.gz`, `relay-roles-20260908.tar.gz`,
`relay-install-20260908.tar.gz`, and `relay-pdf-fix-20260908.tar.gz`.
They are not committed and are not release artifacts to reuse blindly. Source
bundles were checked to exclude .env files, SQLite/photos and generated output.

## 4. Identity, roles and access enforcement

| Files | Changes |
| --- | --- |
| `packages/platform/src/auth/session.ts` | Optional role/trade fields on Principal; existing IDs remain based on Entra oid |
| `apps/web/lib/auth/access.ts` | Central role/command/read/ownership predicates; exactly one recognized app-role claim required; all-project pilot scope |
| `apps/web/lib/auth/provider.ts` | Check configured tenant claim, interpret app roles, attach role/trade; local demo receives Engineer only |
| `apps/web/lib/auth/session.ts` | Reject pre-role sessions so users must authenticate again |
| `apps/web/lib/auth/guard.ts` | Full-report visibility uses stable ownership/access predicates; non-owner drafts are denied rather than returning a partly redacted full object |
| `apps/web/lib/auth/roster.ts` | User-supplied assignment checklist, never an email-based authorization source |
| `apps/web/lib/auth/legacyDrafts.ts` | Admin-only, transactional assignment of unowned legacy drafts to a currently signed-in account; increment version and record audit event |
| `apps/web/app/api/admin/legacy-drafts/route.ts` | Session/Admin guard and validation for that assignment action |
| `apps/web/lib/types.ts` | New optional authorId, authorTrade, reviewedById, issue actorId and closureSubmittedById fields |
| `apps/web/lib/serverStore.ts` | Persist new-report stable authorship/trade; filter drafts before pagination; allowlist other people's draft summaries; stable independent review and correction reviewer metadata cleanup |
| `apps/web/lib/issueStore.ts` | Stable actor attribution for report/issue actions, closure independence and review-derived history events; display labels retained |
| `apps/web/lib/validatePhotos.ts` | Validate linked issue exists in the same project as the report |
| `apps/web/app/api/reports/route.ts` | Manager/Admin-only Office summaries; role-filtered report list; validate reportable fixture project and create with session identity |
| `apps/web/app/api/reports/[id]/route.ts` | Ownership enforcement for draft edits/submission, Manager/Admin review, stable reviewer ID; additional action/note/signature validation |
| `apps/web/app/api/reports/[id]/pdf/route.ts` | Apply the same read policy to PDFs; later add explicit attachment download option |
| `apps/web/app/api/media/[id]/route.ts` | Draft media upload/read follows stable report ownership; submitted/issue evidence stays available to authenticated roles |
| `apps/web/app/api/issues/[id]/route.ts` | Validate command shape, enforce role/action permissions, overwrite client attribution with session name/ID |

Manager/Admin actions: report review; issue assign, verify, reopen, confirm,
withdraw. Engineers can record progress and submit work for verification. All
roles can author their own reports. Assignment to a trade grants no extra access.

Microsoft role values (case-sensitive): `Admin`, `Manager`,
`Engineer.Electrical`, `Engineer.HVAC`, `Engineer.PH`.
These are RELAY app roles, not Microsoft directory administrator roles.

Initial roster (all addresses end in `@leodisme.com`):

| Assignment | Local parts |
| --- | --- |
| Admin | callum |
| Manager | tom, ollie, jonny, russel |
| Engineer.Electrical | john, damien, graham.stephenson, bryony, tyler.parker |
| Engineer.HVAC | danny, anthony.dyson |
| Engineer.PH | chris, aidan, marcus, harvey.obrien |

Do not infer ownership of historical drafts from a matching display name. The
Admin legacy-assignment tool exposes metadata only and requires human confirmation
of the original author. Historical trade is not guessed from today's profile.

## 5. Role-specific screens

| Files | Behaviour |
| --- | --- |
| `apps/web/app/page.tsx` | Admin -> /admin; Manager -> /office; Engineer sees trade, latest own drafts and projects |
| `apps/web/components/ProjectsPage.tsx` | Reused original client-side project register |
| `apps/web/app/projects/page.tsx`, `apps/web/app/projects/layout.tsx` | Authenticated all-project route/tree |
| `apps/web/app/admin/page.tsx` | Server-guarded assignment checklist, current-session team overview, links to Office/projects/Entra and legacy-draft assignment |
| `apps/web/components/LegacyDrafts.tsx` | Select verified author for legacy draft; server enforces Admin and one-time assignment |
| `apps/web/app/office/layout.tsx` | Direct Office navigation guarded against Engineer access |
| `apps/web/components/PrincipalContext.tsx` | Provide server-resolved principal to client controls |
| `apps/web/app/layout.tsx` | Role navigation, explicit sign-out label and principal context; later installation component/Apple metadata |
| `apps/web/app/projects/[id]/page.tsx` | Other people's draft rows direct Managers to summaries in Office rather than editable report |
| `apps/web/app/issues/[id]/page.tsx` | Hide Manager-only issue actions from Engineers; API independently enforces them |
| `apps/web/app/globals.css` | Wrap expanded navigation for phones, touch sizing, Admin table and installation guidance styles |

Admin is deliberately an initial overview, not a full settings/integration UI or
live directory sync. Role/trade assignments remain in Entra. Session overview
must not be mistaken for a complete current membership list.

## 6. Installable app and PDF navigation

| Files | Behaviour |
| --- | --- |
| `apps/web/components/InstallRelay.tsx` | Expandable iPhone/Android guidance; captures beforeinstallprompt when supported; handles dismissal/failure; hides in standalone mode or after appinstalled |
| `apps/web/app/manifest.ts` | Explicit stable app id `/`; existing start URL/icons/standalone mode retained |
| `apps/web/app/layout.tsx` | Apple standalone metadata; install guidance available including sign-in page |
| `apps/web/app/reports/[id]/preview/page.tsx` | PDF link now navigates to in-app route; return link points to report instead of Office |
| `apps/web/app/reports/[id]/pdf/page.tsx` | Lazy PDF.js load and same-origin worker; authorized fetch; canvas rendering one page at a time, fit/zoom, previous/next, text alternative, retry and explicit return links |
| `apps/web/app/api/reports/[id]/pdf/route.ts` | `?download=1` returns attachment disposition; normal viewing fetch preserves the existing authorized PDF bytes |
| `apps/web/package.json`, `package-lock.json` | Added pdfjs-dist (resolved 6.3.289) and its dependency changes |

PDF cause observed in source: `target="_blank"` linked directly to the raw PDF.
User reported that Android Back left the installed app. The replacement keeps
normal viewing within a Next.js route/history and leaves downloading explicit.
PDFs are not sent to a third-party renderer or stored in a new browser PDF cache.
The viewer adds a page-text alternative but is not a full tagged-PDF accessibility
implementation. Mobile rendering/performance on long real reports needs checking.

Existing `apps/web/components/PwaRegistration.tsx` and
`apps/web/public/sw.js` were inspected but not changed. Existing service worker
caches public assets/offline recovery, not private HTML/PDFs. No forced reload or
skipWaiting was added during capture. Installation does not provide complete
offline capture; recovery remains retained-text/tab-identity dependent.

## 7. Planning and review documents

- `docs/consolidated-improvements.md`: deduplicates product-backlog,
  project-review-2026-09-07 and optimisation-progress; excludes product proposal,
  preserves rejected/tentative items, flags older findings for verification,
  separates implemented work and incorporates/reprioritizes role/trade decisions.
- `docs/roles-setup.md`: policy, full roster, Microsoft setup, rollout, legacy
  ownership, session expiry/revocation caveats.
- `docs/phone-installation-checks.md`: physical iPhone/Android installation,
  sign-in, capture, offline and update checks; PDF return-navigation validation.
- This document: `docs/claude-review-handoff-2026-09-08.md`.

Older `docs/deployment-pilot.md`, `docs/entra-setup.md`,
`docs/optimisation-progress.md`, `README.md` and the original review contain
historical statements that may now be stale. Their unqualified “not deployed”
wording is superseded by the live-state evidence above, not by a claim of full
production readiness. Original review and backlog remain useful context.

## 8. Verification evidence and reproduction

- `npm test`: 145 shared-package tests plus 7 web tests (152 total) passed.
- `npm run build`: production Next build/type validation and worker compilation
  passed after the PDF viewer change.
- `apps/web/tests/access.test.ts`: explicit/ambiguous roles, same-name identities,
  draft filtering/redaction, legacy assignment/audit and independent actions.
- `scripts/verify-role-access.mjs`: 28 isolated production HTTP checks plus role
  landing assertions; invalid cookies, Office/Admin access, draft/PDF/media privacy,
  Engineer mutation restrictions and allowed progress. Passed after PDF changes.
- `scripts/verify-pdf-navigation.mjs`: headless Chromium at 390px/2x, synthetic
  two-page PDF, visible rendered ink, paging/zoom, no new window, browser Back
  to preview and explicit Back to report. Passed; screenshot visually inspected.
- Upgrade/rollback scripts passed Bash syntax checks; initial upgrade workflow
  additionally has user-supplied successful live output. Failure rollback was
  not deliberately exercised on the server.
- Git whitespace checks passed. Generated builds, screenshots, archives and
  synthetic data are not committed.

Run `npm test` and `npm run build` before standalone scripts; they use compiled
test helpers and the production build. HTTP script starts localhost:4327; PDF
script starts localhost:4328. Both create isolated synthetic data and terminate
their server/clean their data afterward. They do not test actual Entra token
exchange. PDF browser script accepts `RELAY_PLAYWRIGHT_MODULE` and
`RELAY_BROWSER_PATH` for locally installed Playwright/Chrome; Playwright is not
added as an application dependency. Neither script runs automatically in npm test.

## 9. Suggested Claude review priorities and known limits

1. Check every API read/write and media/PDF path against agreed role/draft policy;
   examine stable IDs, pagination-before-disclosure and legacy-assignment audit.
   Validate whether additional request-shape/error handling is needed; the added
   checks are not a complete schema-validation overhaul.
2. Review authorization lifecycle: Microsoft role claims are copied into sessions
   lasting up to 12 hours. Entra changes do not instantly revoke local sessions.
   Missing/multiple/unknown role values fail closed. App profile Admin alone does
   not give permission to edit the Microsoft tenant. The initial implementation
   uses one configured tenant, not multi-tenant identity namespaces.
3. Confirm intended Manager/Admin issue-command boundaries and independent
   verification; trusted store helpers still assume callers passed route guards.
4. Review PDF.js worker bundling, browser compatibility, memory use and rapid
   page/zoom/navigation cleanup. Physical Android installed-app Back and iPhone
   behaviour remain pending. Intentional Download may invoke a device viewer.
5. Review backup/rollback scripts: single-host names are fixed; sign-in HTTP and
   worker running are smoke checks, not business-flow health checks. Local
   backup/old image survive, but no off-server recovery or failure drill is proven.
   Build while serving may strain 4 GB RAM. No destructive volume reset is used.
6. The runtime Docker image copies the full built tree, including development
   dependencies; image-size/dependency minimization and script deduplication are
   follow-ups, not completed hardening.
7. npm install reported two dependency audit findings (one moderate, one high).
   No forced major upgrade was applied. Re-run npm audit to establish current
   advisories and remediation; the older docs mention Next/PostCSS but that is
   not proof of the current advisory details.
8. Fixture projects and SQLite issue storage remain. SharePoint photo storage,
   project/issue adapters, PDF filing and live email delivery are unfinished.
   Live mail stays disabled. No PostgreSQL migration is needed solely because an
   older review suggested one.
9. Signature persistence, full offline capture, conflict/multi-tab UI, correction
   UI/issue reconciliation, PM acknowledgement, affected-trade controls and future
   report types remain backlog work. The user prioritizes low engineer input.

No invitations, email or other messages were sent to staff. No secrets, evidence
files or generated PDF artifacts should be part of this commit.
