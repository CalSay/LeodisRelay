# Leodis Relay: independent project review

Reviewed 7 September 2026.

## Overall assessment

Keep the product direction and visual identity. Relay has a coherent purpose, appropriate construction-document styling, clear field language, and useful domain rules. It is a credible workflow prototype, but is not ready for real site records. The biggest next investment should be connecting the working application to the safeguards already expressed in the shared packages.

Claude's attachment was not visible in this conversation. This review covers the repository and running prototype independently; references in comments to a blueprint, proposal, Appendix C, and ADRs could not be checked against those original documents.

## Review scope and evidence

- Read the project structure, application routes, capture and review screens, stores, authentication, delivery, PDF renderer, and shared lifecycle/sync contracts.
- Inspected the running project list, project page, returned draft and office queue in the browser. At 390 x 844, the header overflowed horizontally and controls extended outside the visible screen.
- A read-only request with an invalid session cookie returned HTTP 200, 15 reports and 6 drafts. No draft contents were altered to prove this.
- `npm test`: 145 passing tests. These run against shared packages, not the application routes or browser journeys.
- `npx tsc --noEmit -p apps/web/tsconfig.json`: passed.
- Generated a review PDF through the existing renderer using an existing two-update draft and example client metadata; inspected both pages. The GIF attachment produced renderer warnings and a blank photo frame. This is a format-handling finding, not evidence that ordinary JPEGs fail.
- Reviewed source-defined light/dark styles. No full light-theme, screen-reader, real-device camera, offline, load, Entra, Graph, or SharePoint acceptance test was performed.
- `npm run build --workspace=@relay/web`: passed after an approved rerun with network access. The initial sandboxed build could not download the Google Fonts. Consider bundling the web fonts locally, as the PDF already does, to remove that build-time network dependency.

## What is worth preserving

1. The separation between capturing a report and submitting it is right. Plain descriptions of where work is stored are valuable.
2. Showing extra fields only for actionable observations keeps ordinary updates short.
3. Blocking omissions and advisory checks are separate. Unknown ownership is stated rather than invented.
4. Tracking issue confirmation separately from repair progress preserves the history when a report is disputed after work has started.
5. Linking repeat sightings to an issue is the right product concept.
6. The action summary before the narrative is useful for report recipients.
7. Ruled lists, restrained brass, and monospace references suit the subject. A wholesale visual redesign is unnecessary.
8. The prototype banner is honest, and should stay until the application meets its operational promises.

## Fix before using real site data

### 1. Enforce authentication and project permissions at every boundary

**Verified defect; critical.** Middleware only checks for a cookie's presence. Report list/detail GET, report PUT, issue GET and PDF GET do not validate a server session. The read-only invalid-cookie test returned real prototype draft records.

Authenticated commands also lack project/ownership permissions. The issue policy currently permits every actor, and authors/reviewers are identified by display names despite stable principal IDs being available. The office's restricted draft summary can be bypassed by using the ordinary list/detail API.

Implement shared server guards for session, project access, and command permission. Use stable principal IDs for authorship and independent review; keep names as display snapshots. Define explicitly who can see draft metadata versus draft content. Check project eligibility on creation, including unknown, closed and tender projects. Validate linked issue ownership against the report's project.

Evidence: `apps/web/middleware.ts`; `apps/web/app/api/reports/route.ts`; `apps/web/app/api/reports/[id]/route.ts`; issue and PDF routes; `apps/web/lib/issueStore.ts`.

### 2. Make draft saving safe under overlapping requests

**Source-confirmed risk; high.** Debouncing does not serialize requests already in flight. An older save can complete after a newer edit, delete the newer IndexedDB copy using only report ID, and display “Saved on server.” The server accepts observations without checking a base revision. Submission cancels a timer but does not coordinate saves already running.

Use one ordered save stream per draft, compare-and-swap server versions, and acknowledgements tied to the exact local mutation. Remove only acknowledged local data. Serialize submission after saves and submit the version the person reviewed. Preserve both copies when a conflict needs resolution.

Evidence: `apps/web/app/reports/[id]/page.tsx:117`; `apps/web/lib/serverStore.ts:103`; `apps/web/lib/localDraft.ts:97`.

### 3. Make recovery and offline wording match actual behaviour

**Source-confirmed gaps; high.** Loading requires a server report before attempting recovery, so a locally held draft cannot be reopened through this code path while disconnected. Recovered work is not automatically saved on an already-online reload; the retry depends on a later edit or online event. A held draft replaces server observations without a base-version comparison. Local records are not scoped by signed-in person.

IndexedDB operations resolve when a request succeeds, before the transaction completes; a subsequent abort can therefore fail after success was reported. Issue updates and signatures have no equivalent durable recovery.

Persist complete, author-scoped draft context and mutation IDs. Resolve writes on transaction completion. Recover locally before depending on the network. Retry on app resume, authenticated reload and connectivity restoration, with explicit pause states for authentication and conflicts. Decide whether offline submission is supported; until then distinguish “will sync draft” from “will submit report.”

Evidence: `apps/web/lib/localDraft.ts`; report page initial load/retry effects; issue page local state.

### 4. Separate receipt, review, document status and delivery

**Verified UI defect and source-confirmed inconsistency; high.** Office counts all non-pending submissions as “approved,” then labels anything not explicitly approved “Returned.” This mislabels `not_required` reports. Returned reports actually move to the draft list. The HTML preview calls a submitted report “Issued,” while the PDF calls it “Draft — not issued” unless explicitly approved. All current fixture projects have review disabled.

Use a shared status-to-label mapping. Present the minimum relevant facts: received by office, review required/not required/approved/changes requested, and delivery pending/sent/failed. An internal receipt must not imply email delivery or external issue. Make the optional-review policy consistent in the document model as well as the API.

Evidence: `apps/web/app/office/page.tsx:47,98`; preview page footer; `packages/documents/src/ReportDocument.tsx`; PDF route mapping.

### 5. Preserve submitted history and make correction idempotent

**Source-confirmed risk; high.** Submission attempts delivery immediately, but returning a report changes that same record to an editable draft with a comment claiming it was never issued. Resubmitting an unlinked defect creates another issue. Linked sightings have no source-revision provenance to support later correction/triage. The UI promises corrections as new revisions, but exposes no correction action.

Freeze every submission as a separate snapshot. Create corrections with a reason and supersession link. Keep previous PDF bytes and delivery records. Give each observation a stable identity across corrections, and use a unique revision/observation effect key to reconcile issues without duplicating them. Preserve repair history when source wording changes.

Separate the autosave version from the public document revision: typing pauses should not determine the revision number printed on a client report.

Evidence: `apps/web/lib/serverStore.ts:176,252`; `apps/web/lib/issueStore.ts:103`; shared `report/lifecycle.ts`.

### 6. Finish the delivery path before treating it as operational

**Known implementation gap; high.** Graph token acquisition is a stub that always throws when mail is enabled. Local outbox files are useful for demonstrations, but are not sent email. There is no actual archive step before mail in `issueReport`, despite the comment describing one. The call passes an empty delivery history, and some failures return a successful submission without a durable retry record. Delivery completion can also write an older submitted object over an intervening review.

Commit receipt and a durable background job together. Render and archive immutable bytes, then deliver that artifact with recorded attempts, bounded retries, and operator-visible failures. Store delivery updates separately from mutable review metadata. Choose and implement the sending mailbox/token model explicitly. Add an office delivery queue with recipient, revision, last attempt and retry action.

Evidence: `apps/web/lib/delivery/transport.ts`; `issueReport.ts`; `serverStore.ts`.

### 7. Replace disposable storage and validate runtime inputs

**Declared prototype limitations; production requirement.** Whole-file synchronous JSON storage is not an operational database. Corrupt reads silently become empty stores; subsequent writes could overwrite recoverable data. Reports, issues and delivery effects are not transactional. TypeScript casts do not validate request bodies: invalid observations, unknown commands and malformed signatures can reach business logic.

Use PostgreSQL transactions, unique constraints, migrations and recoverable backups, with private object storage for evidence. Parse request schemas and return useful field errors; restrict supported media formats and sizes. An unknown review decision should be rejected instead of defaulting to approval. Add structured event/error logging without copying evidence or sensitive payloads into logs.

## Product flow improvements

### Home and project selection

Lead with **Continue my report**, **Returned for changes**, and **My projects**. Add search by project name/code and recent or pinned projects. Keep the compact register below these shortcuts. Show useful summaries such as unsent work and outstanding issues instead of relying only on raw project status.

On a project, place the primary action and existing personal draft ahead of the full metadata block. De-emphasize client account and division during field capture. Offer “Start another visit” without making every accidental tap create an indistinguishable empty draft. Allow visit-date entry separately from creation time; the current UTC creation date cannot represent a previous visit.

### Capture

Keep the plain field wording. Collapse completed updates into location/type/photo summaries, with the current update expanded. Provide separate **Take photo** and **Choose existing** actions. Show thumbnail/upload progress, allow full-image inspection, and provide undo for removing an update or photograph.

Make each “Needed” finding jump to and focus the relevant field. Keep save state visible, but show a useful initial state when a server-backed draft opens. Offer a final preview of the exact content/version being submitted and a clear receipt afterward. Validate required location/action details according to observation type, with an explicit exception path when photography is impossible rather than an unworkable mandatory-photo rule.

### Office

Make Office an action queue: reviews, returned work, unassigned/disputed issues, verification requests, and delivery failures. Keep archive/history searchable by project, author, date and reference. Show report content and review controls together, using a two-pane layout on larger screens, so the reviewer does not navigate away to read the report.

Remove editable “Reviewed by” and “Recorded by” fields: the server already ignores these values and uses the session. Display the actual signed-in identity. Require useful comments for negative decisions and preserve the reviewer's draft comments if data refreshes.

### Issues

Put description, required action, owner and target date before the timeline. `raiseFromReport` currently does not preserve `actionNeeded` as an issue field, so the task loses its clearest instruction. Add assignment/reassignment, due-date editing, withdrawal/triage and a “needs more work” verification outcome; the API/domain support and UI are currently incomplete or mismatched.

Show disputed status in text on register rows, not just a red tone. Highlight overdue, unassigned and awaiting-verification work. Keep full image evidence accessible. Preserve notes/photos when interrupted or offline. Remove the UI's “(no note)” substitution when a transition is supposed to require a reason.

A smaller correctness defect: issue reference numbering counts newly added rows twice (`store.issues` already includes them, then `raised.length` is added), which can skip and eventually repeat references. Use a transactional sequence/unique constraint.

## Visual design and accessibility

- **Retain:** warm paper/dark charcoal surfaces, brass accents, disciplined rules, and monospace codes.
- **Fix the mobile header:** observed horizontal overflow at 390px. Use a compact account menu and move secondary controls out of the single unwrapping row. Make sign-out an explicit menu command rather than a person's name acting as an immediate logout button.
- **Increase legibility:** 10px uppercase tracked labels and muted dark-theme text are too recessive for field use. Use larger sentence-case labels for input tasks; reserve small monospace captions for secondary metadata. Measure contrast in both themes.
- **Use consistent touch sizing:** `.btn-sm`, `.seg`, `.themebtn` and `.whoami` override the stated 48px target with 30–34px heights. Restore larger touch areas on phones.
- **Fix keyboard capture:** file inputs are `display:none` inside labels, leaving no keyboard-focusable photo action. Use a real button connected to the input or an accessible visually hidden input.
- **Expose state accessibly:** announce save/errors with appropriate live regions; use semantic section headings, associated help/error text and visible active navigation. Current nav links never set the `aria-current` attribute already anticipated by CSS.
- **Use theme tokens consistently:** the primary-button hover colour is hard-coded light gold while light-theme text stays white. Signature export also uses theme-dependent ink. Review these combinations explicitly.
- **Reduce page length:** the mobile title block consumes much of the initial viewport before capture begins. Show project, visit and author compactly; move administrative details behind disclosure.
- **Preserve responsive space for errors:** test the fixed action bar with long offline messages, the software keyboard, zoom and safe-area insets.

## Photographs and PDF output

The action-first PDF structure and contained evidence frames are sensible. Improve legibility of small labels and test long project names, long narratives, many images and multipage tables before polishing decorative details. Replace logo/company/accreditation placeholders with verified assets before external distribution.

Specific fixes:

1. The sample's GIF rendered as an empty frame while a photograph number and caption still appeared. Decode/normalize supported images before accepting them, and treat a missing evidence render as an explicit failure. The uploader currently accepts `image/*` without enforcing what the renderer supports.
2. Dark-mode signature strokes use pale theme text on a transparent PNG. Export a separate canonical dark-ink image for the white PDF; retain a display rendition appropriate to the UI. Preserve signatures across reload if the product says they are saved.
3. Summary action numbers are generated after filtering; update numbers are generated before filtering. An action labelled 01 can therefore refer to update 03. Reuse stable observation references throughout.
4. An access restriction with no action text can raise an issue but be absent from the action summary, which may then say there are no actions. Use semantic observation types and explicit action rules consistently.
5. The sample had an almost empty second page and a small continuation-rule fragment. Add pagination fixtures and prevent stranded headings/rule fragments; do not infer robustness from a single short example.
6. HTML preview and PDF use different mappings and omit different information, including sign-off. Share one document view model and distinguish an accessible screen summary from an exact PDF preview.
7. `capturedAt` is set to import time, but output calls it “Taken.” Record import time honestly and distinguish it from capture metadata or a user-confirmed date.

## Efficiency and maintainability

The most expensive pattern is carrying full base64 photographs through every layer. Each edit mirrors the entire observation set, and each save sends the whole report. Office polls every five seconds for full submitted reports and their images. As an illustration, ten 4 MB originals are roughly 53 MB in base64 before JSON overhead; repeatedly downloading that payload is unnecessary.

Store original evidence once, upload resumably, create thumbnails, and send media IDs in draft mutations. Return paginated summaries for lists and fetch detail/evidence on demand. Poll only while visible with backoff, or use a small change feed. Do not discard original evidence merely to improve thumbnail performance.

Reuse the existing lifecycle, retry, manifest and authorization contracts in the application. Keep the current monorepo; there is no demonstrated need for microservices or a replacement framework. Reduce duplicated report/document/status types and unsafe bridging casts. Move shared screen primitives into reusable components once their behaviour is settled.

Update README to distinguish the actual tree from the intended architecture: worker, database/blob adapters, operational infrastructure and several listed packages are future work. Bring referenced decisions into version-controlled docs, with a short implemented/planned status table. Remove stale explanatory comments after reconciling policy.

## Alternative coding approach and performance priorities

If starting this implementation again, I would keep Next.js, React, TypeScript and the monorepo, but change how data moves and where business rules run. The largest expected improvements come from smaller transfers, targeted queries and moving slow work out of interactive requests. These are architectural recommendations, not measured speed claims.

### 1. Upload photographs independently of text saves

Upload each photograph once to private object storage, generate a thumbnail for screens, and attach its media ID to the observation. Give each upload its own progress, retry and acknowledgement. Preserve original evidence separately from display derivatives.

Editing a sentence should send a small text change regardless of the number of photographs already attached. This is likely the largest practical improvement on poor site connections because the current full-report payload contains base64 images.

### 2. Persist small changes through an ordered queue

Represent capture edits as operations such as updating an observation description, attaching a photograph, changing an owner or removing an observation. Persist each operation locally with an ID before transmission, send operations in order per report, and remove only specifically acknowledged operations.

Combine operation IDs with server-side idempotency and base-version checks. This reduces repeated payloads and prevents overlapping saves from clearing newer work. Coordinate submission with the queue so the submitted version is the one the engineer reviewed. An ordered queue with explicit conflict handling is sufficient initially; collaborative editing machinery would add complexity without a demonstrated need.

### 3. Make application services the single route through business rules

Use one execution path:

```text
Screen -> API -> application service -> domain rules -> database
```

For example, a single submit-report service checks permissions, validates the requested version, freezes its snapshot and records the background job transactionally. API routes translate requests and responses; they do not independently recreate lifecycle behaviour. Shared domain functions remain pure and testable, while application services coordinate storage and effects.

This primarily improves development speed, consistency and test coverage rather than raw request latency. It connects the existing shared rules to the actual application and reduces the chance that package tests pass while routes enforce different behaviour.

### 4. Query only what each screen needs

Replace whole-file reads and full-report list responses with PostgreSQL queries, appropriate indexes and pagination.

| Screen | Initial response |
| --- | --- |
| Projects | Project identity, relevant counts and resumable-draft summary |
| Office | Report reference, status, author, project and next action |
| Report | That report's observations and media references |
| Issue | Issue details and an initial page of history |

Fetch full evidence and additional history on demand. This reduces server work, network traffic and browser memory together. Keep permission filtering within the server query/service boundary.

### 5. Run PDF production and delivery in the background

Return the submission receipt after the report and its job are durably committed, rather than waiting for rendering and attempted delivery:

```text
Submit -> commit report and job -> return receipt
                    |
                    v
             Render PDF -> archive -> deliver
```

A database-backed job queue is sufficient initially. The worker should reuse immutable artifacts, record attempts and retry failures safely. Screens show processing and delivery status separately from successful receipt. This shortens the engineer's wait without suggesting that email delivery has already completed.

### 6. Fetch initial online page data on the server

Use Next.js server components for the initial project list, report history and office summaries, with explicit caching and freshness appropriate to authorized data. This can remove the extra browser fetch after a loading-only initial render.

Keep interactive report capture client-side and able to open from durable local storage while offline. Server-rendered online pages complement that path; they do not replace offline recovery.

### 7. Refresh lightweight summaries instead of full reports

Start with summary polling that pauses when the page is hidden, backs off on failure and requests changes since the previous response. Preserve in-progress user input during refreshes. If immediate updates become necessary, consider server-sent events for status notifications rather than introducing them by default.

### Implementation order and measurement

The first performance investments should be separate photo uploads, smaller database-backed screen responses, and background PDF processing, alongside the integrity safeguards already prioritised in this review. Follow with ordered mutations, initial server-rendered data and lightweight refreshes as those boundaries become established.

Measure before and after using representative reports and constrained connections:

- Text-save acknowledgement latency and bytes sent with photographs already attached.
- Submission-to-receipt latency, measured separately from time to archive and deliver.
- Initial usable page time and payload size for project and office lists.
- Office polling traffic while active and hidden.
- Recovery after a lost response, reload or concurrent edit, including duplicate effects and lost work.

Record typical and slower-case timings, such as median and 95th percentile, with dataset sizes and connection conditions. No particular speed multiplier is justified by the current evidence. There is no demonstrated performance reason to replace the language/framework or split the product into microservices.

## Recommended delivery sequence

1. **Trust and integrity:** session/project guards, stable identities, runtime validation, safe saves, correction snapshots and accurate state labels.
2. **One reliable end-to-end path:** engineer captures evidence, interruption/reload preserves it, server receives a version, office acts, the correct immutable PDF is archived, and delivery is observable/retryable.
3. **Field and office usability:** resume draft, compact mobile header, accessible photo capture, actionable validation, searchable queues, issue assignment and verification feedback.
4. **Visual/document finish:** contrast, typography hierarchy, real branding, image format validation, signature export and pagination.
5. **Operational release gate:** migration/restore rehearsal, role/project access tests, lost-response and concurrent-edit journeys, phone/camera testing, monitoring and recovery runbooks.

Wire the web typecheck/build into root checks and add targeted API/browser tests for the failure modes above. The existing 145 green tests are useful evidence for package rules; they are not evidence that the running application's integrations enforce those rules.

The next milestone should be a dependable field-to-office workflow under interruption, rather than a larger feature list. Keep Compliance deferred until this Developments path is proven.
