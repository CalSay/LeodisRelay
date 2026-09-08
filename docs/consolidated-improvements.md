# Consolidated RELAY improvements

Consolidated 8 September 2026 from [product backlog](product-backlog.md),
[project review](project-review-2026-09-07.md), and
[optimisation progress](optimisation-progress.md). The product proposal is excluded.

This is a deduplicated work list, not a fresh code audit. Later implementation
notes supersede earlier recommendations where explicit. “Verify/fix” means an
older finding has no explicit completion evidence in these documents; reproduce
it against current code before changing it. Priorities below are a suggested
sequence, not new approval of every recommendation.

Updated with the user's role/trade decisions and engineer-effort constraint.
Order: establish secure roles, protect saved work and recovery, then simplify
field capture before extending office workflows and integrations. Backup/restore
and authorization checks are required before real site use. Accurate PDFs,
SharePoint filing and verified delivery remain prerequisites for external issue;
their position below does not permit treating the pilot as operational early.
Test each change as it is delivered; do not postpone its verification to the end.

## 1. Admin, Manager and Engineer roles with enforced access — first priority

- **Agreed:** Provide distinct Admin, Manager and Engineer views backed by server
  permissions, not just hidden navigation or controls. Associate roles with
  authenticated Microsoft identities; users cannot select their own privilege.
- Admin view: user/role/trade management, settings, integrations and oversight.
  Manager view: reports requiring attention, issues and project history.
  Engineer view: continue a report, start a report and relevant site issues,
  with administrative and management controls removed from routine capture.
- **Agreed:** Managers can access every project now. Keep role and project scope
  separate so Managers can be restricted to assigned projects later. Do not
  introduce Manager project-assignment setup in this release.
- Keep Engineer trade separate from access role and project scope. Record a
  default trade on the user profile; do not infer broader permissions from trade.
  Engineers also have every project initially (confirmed by the user). They see
  submitted reports/issues across trades and edit only their own drafts. Managers
  see draft summaries, not unfinished content. Do not use trade to hide issues.

- **Verify/fix:** Validate server sessions on every report, issue, media and PDF
  endpoint; test missing, forged and expired cookies. Working Microsoft sign-in
  alone does not establish that all API routes enforce authorization.
- Enforce role-aware project scope and command/ownership permissions, including
  who may view draft summaries versus full draft contents, while preserving
  Managers' agreed all-project access for now.
- Use stable principal IDs for authors, reviewers and recorded actions; retain
  names only as display snapshots. Enforce independent review/verification.
- Validate project eligibility when creating reports, including unknown, closed
  and tender projects. Reject linked issues from another project.
- **Verify/fix:** Validate request bodies, observation types, signatures and
  commands at runtime; reject unknown review decisions and return field errors.
- Recheck the dependency audit and resolve any remaining findings with tested
  upgrades. The older PostCSS/Next.js finding is not a current audit result.

## 2. Draft reliability and offline use — agreed scope

- Preserve signatures across reloads and interrupted saves.
- Add explicit comparison/resolution for conflicting local and server versions,
  retaining both copies until resolved; coordinate editing across browser tabs.
- Extend retained-text recovery to full offline capture: define support for
  opening the app from cold, projects, new photos, signatures and issue changes.
  Make offline submission policy explicit rather than implying it already works.
- Verify local data isolation between users on shared devices, transaction
  completion, and recovery on app resume, reauthentication and reconnect.
- Make pending uploads, acknowledged saves, authentication pauses and conflicts
  clear. Never equate a local save with server receipt or a queued submission.
- Reduce remaining whole-observation metadata saves to smaller ordered changes,
  retaining existing mutation IDs, version checks and retry guarantees.

## 3. Operations and release verification

- Perform an isolated backup restore and migration rehearsal covering SQLite,
  photographs and PDFs together; test recovery, not merely backup scheduling.
- Add safe orphan-image cleanup that respects drafts, submitted evidence,
  revisions and retention; monitor disk usage.
- Add useful structured logs, monitoring and recovery/operator runbooks without
  exposing secrets or sensitive evidence in logs.
- Add/complete targeted API/browser tests for project/role permissions, concurrent
  edits, lost responses, corrections, duplicate effects and delivery failures.
- Perform iOS/Android camera, PWA installation, interrupted-network and offline
  acceptance tests; inspect PDFs visually and exercise a real Microsoft tenant.

## 4. Fast engineer capture with automatic trade tracking

- **Agreed design rule:** A normal defect should need no additional trade or
  company input: describe it, attach evidence and continue. Measure taps and
  completion time on a phone; avoid adding a mandatory assignment form.
- Record the reporter's stable identity and trade at the time automatically.
  Preserve that historical trade even if their profile changes later.
- Default “Trade affected” to the Engineer's own trade, displayed as a compact
  control such as “Electrical · Change”. No extra tap in the normal case.
- On Change, allow another affected trade and an outside-Leodis-scope option.
  Preserve affected trade and scope as separate data even when presented together;
  outside Leodis does not replace or erase the trade classification.
- Preserve who raised the issue and their original trade when affected trade or
  scope changes. Keep responsible company optional at capture; a Manager can
  confirm it later. A trade selection must not imply company responsibility.

- **Agreed:** Surface unfinished reports and make continuing a draft prominent.
- **Review recommendation:** Add returned-work shortcuts, project name/code search,
  recent/pinned projects and useful outstanding-work summaries.
- **Review recommendation:** Put personal drafts and the primary project action
  ahead of administrative metadata; avoid accidental duplicate empty drafts and
  support visit dates independently of creation timestamps.
- **Agreed:** Collapse completed updates into description/location/photo-count
  summaries and add another update at the same location without copying evidence.
- **Agreed:** Suggest responsible companies; make location suggestions optional,
  derived from previous entries and independent of a maintained catalogue.
- **Agreed:** Provide undo when deleting an update or photograph.
- **Review recommendation:** Make validation findings focus the relevant field;
  validate required actions by observation type and allow an explicit reason
  when a photograph cannot be taken.

## 5. Mobile usability and accessibility

- **Verify/fix:** Remove mobile header overflow; use a compact account menu with
  explicit sign-out and a shorter title/metadata block.
- Improve field-label legibility and measured contrast in both themes; keep
  secondary metadata visually subordinate without becoming unreadable.
- Restore consistent phone touch targets, including small buttons and selectors.
- Make photo capture keyboard accessible; provide semantic headings, associated
  help/errors, current-page navigation and announced save/error states.
- **Verify/fix:** Use theme tokens for button hover states and test light/dark
  combinations. Dark-ink PDF signature export is already recorded as fixed.
- Test fixed actions/errors with long messages, the software keyboard, zoom and
  device safe areas.

## 6. Submission, corrections and status — agreed scope plus correctness checks

- Use consistent status labels across capture, Office, HTML preview and PDF:
  receipt, PDF preparation, optional review, filing, delivery and PM acknowledgement.
- Keep review off by default and hide irrelevant queues; verify returned reports
  and review-disabled reports appear and are labelled correctly.
- Finish the correction UI with a correction reason, public revision and
  supersession link. Preserve each submitted snapshot, PDF and delivery history.
- **Verify/fix:** Keep autosave versions separate from public document revisions.
- Give observations stable identities across corrections and reconcile resulting
  issues without duplicates or loss of repair history/source provenance.
- Offer an exact-version final preview and a clear submission receipt; verify
  submission remains coordinated with pending saves.

## 7. Issue register and issue actions

- **Agreed:** Carry reporter identity/trade-at-creation, affected trade and Leodis
  scope from the defect into the issue and its history. Make subsequent
  classification changes attributable without rewriting the original report.
- Provide Manager filters for affected trade, reporter's trade and Leodis scope,
  alongside the existing search/filter requirements. These classifications are
  not automatic issue assignments or access restrictions.

- **Agreed:** Search/filter the entire authorized register by location, responsible
  company and verification status, not only the loaded page.
- **Agreed:** Show descriptions/thumbnails when linking an existing issue.
- **Verify/fix:** Preserve required-action text when raising issues from reports;
  prioritize description, action, owner and target date in the detail view.
- **Review recommendation:** Complete assignment/reassignment, due-date editing,
  withdrawal/triage and “needs more work” verification actions.
- **Review recommendation:** Label disputes in text and highlight overdue,
  unassigned and awaiting-verification work; make full evidence accessible.
- Preserve interrupted issue notes/photos and enforce required transition reasons
  instead of substituting “(no note)”.
- **Verify/fix:** Use unique, transactionally allocated issue references; check the
  earlier double-counting/duplicate-reference finding against current storage.

## 8. Project manager and Office workflow

- **Agreed:** Surface new/unacknowledged reports, unassigned issues and work awaiting
  verification. Add explicit PM acknowledgement with actor, timestamp and optional
  note; it must not hold up report sending or imply approval/closure.
- **Review recommendation:** Include disputed work and delivery failures in the
  action queue; make history searchable by project, author, date and reference.
- **Review recommendation:** Show report content alongside review controls on
  larger screens; preserve draft review comments during refreshes.
- **Verify/fix:** Replace editable actor-name fields with signed-in identity and
  require meaningful comments for negative decisions.

## 9. PDF and evidence quality

- **Verify/fix:** Use stable observation references in both action summaries and
  update sections; include access restrictions consistently in action summaries.
- Share one document view model between screen/PDF output, including sign-off,
  while distinguishing a screen summary from an exact PDF preview.
- Label upload/import time honestly; distinguish it from actual capture time or
  a date confirmed by the user.
- Test long project names/text, many photographs, tables and multipage output;
  prevent stranded headings/rules and nearly empty continuation pages.
- Replace company/logo/accreditation placeholders with verified assets before
  external distribution and improve small-label legibility.
- Verify unsupported/corrupt formats fail clearly and missing rendered evidence
  cannot silently become an empty frame. JPEG/PNG/WebP normalization is already
  implemented; HEIC is not accepted and needs real-phone workflow testing.

## 10. SharePoint and delivery — unfinished integrations

- Replace fixture project references with scoped SharePoint project data.
- Connect SharePoint Lists as the authoritative issue store, with paginated
  queries, local pending operations/cache and conflict-aware synchronization.
- Archive the exact immutable PDF bytes in SharePoint before mailbox delivery.
- Implement the sending mailbox and token/permission model, durable recipient
  outcomes, bounded retries and reconciliation when a send outcome is uncertain.
- Add an operator delivery queue showing report revision, recipient, last attempt,
  failure and retry action; preserve review changes during delivery updates.
- Keep local outbox files visibly distinct from actual sent email.

The conversation also discussed SharePoint photograph storage. That is a separate
integration decision, not an implemented capability or a requirement established
by these three source documents. Current photos remain on the server.

## 11. Performance and maintainability

- Benchmark photo-heavy reports on the CX23 and constrained mobile connections:
  save bytes/latency, submission receipt versus filing/delivery time, usable page
  time, list payloads, polling traffic and recovery outcomes. Record median and
  slower-case timings with dataset/device/network conditions.
- Consider server-rendered initial online summaries with appropriate freshness
  and authorization; preserve client-side offline capture/recovery.
- Extend lightweight polling with failure backoff/incremental changes where
  useful and preserve input during refresh. A new real-time service is not required.
- Route business operations through shared application services/domain rules;
  reduce duplicated status/document types and unsafe casts.
- Reuse settled screen primitives and update README/stale comments to separate
  implemented capabilities, fixtures and intended architecture.

## 12. Agreed extensions after the dependable core workflow

- **Living site diary:** Build a chronological timeline from existing reports and
  observations, preserving provenance/revisions and avoiding duplicate data entry.
- **Variation sign-off:** Extend existing variations to distinguish proposed work
  from work undertaken without formal sign-off; capture site-manager signature,
  contracting party, signer role/stated authority, exact scope/dates, explicit
  charge acknowledgement and the actual price/rate schedule version. Preserve
  the signed statement/evidence immutably, require renewed agreement for material
  changes, offer a copy and keep unconfirmed records visibly unconfirmed. The
  backlog calls for review of wording against the actual contract before billing.
- **Additional report-type capacity:** Reuse capture, recovery, evidence,
  submission, revision and PDF foundations. Agree individual report types and
  domain/signature rules separately; no specific Compliance build is implied.

## Already recorded as implemented — do not rebuild

- Role rollout prepared locally on 8 September: Microsoft app-role interpretation,
  Admin/Manager/Engineer landing screens, Engineer trade profiles, server-enforced
  Office/review/issue privileges, draft privacy, stable new-report ownership and
  audited assignment of legacy drafts. Production build, 152 automated tests and
  28 isolated production HTTP checks passed. Microsoft role assignments and the
  upgraded Hetzner deployment still need completing; the live pilot is unchanged.
  Setup and the exact user roster are in [roles-setup.md](roles-setup.md).

- Independent binary photo uploads, immutable IDs, validated JPEG/PNG/WebP,
  oriented PDF derivatives/thumbnails and bounded image processing.
- SQLite transactions/indexes replacing whole-file JSON, paginated report
  summaries and lighter visible-only Office polling.
- Version-aware/idempotent saves, durable retry payloads and retained-text offline
  recovery (not complete offline capture or conflict resolution).
- Transactional submission snapshots/jobs, separate leased PDF worker, PDF reuse
  and deterministic local outbox files (not live delivery).
- Dark-ink PDF signatures, proper PWA icon sizes, local fonts and expanded root
  build/typecheck/test coverage.
- This conversation additionally records successful Hetzner Docker deployment,
  HTTPS/Microsoft sign-in, a user-tested photo/report/PDF flow, enabled server
  backups and data surviving a restart. These are smoke checks, not load, full
  authorization, physical-device acceptance or backup-restore proof.

The review's specific PostgreSQL recommendation is superseded by the later
documented SQLite deployment choice. Do not add a database migration solely to
satisfy that older recommendation.

## Excluded or awaiting a separate decision

- The entire product proposal document.
- Unselected photo-workflow expansion: separate camera/library controls, zoom,
  reordering, annotations and a broader per-photo progress UI. Required upload
  reliability/accessibility remains in scope.
- Decision/information-request workflows: tentative, not approved.
- Mandatory location hierarchies/exact naming: rejected; free-text stays valid.
- Specific new Compliance/inspection types and a handover-pack builder: not yet
  specified or individually approved.
