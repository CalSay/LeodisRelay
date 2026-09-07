# Product backlog

Updated 7 September 2026. Approval below is approval of product scope, not a
claim of implementation. Broader expansion ideas remain proposals until chosen.

## Agreed front-end improvements

The user approved items 1, 3, 4, 5 and 6 from the front-end review.
All items below are pending unless explicitly marked complete later.

### FE-1: Faster repeat reporting

- Collapse updates into a description, location and photo-count summary.
- Add another update at the same location without copying findings or evidence.
- Suggest responsible companies; any location suggestions must be optional,
  derived from prior entries and require no setup or exact naming conventions.
- Offer undo when removing an update or photograph.

### FE-3: Dependable drafts and recovery

- Preserve signatures across reloads.
- Make pending uploads and server acknowledgement clear.
- Explain and resolve conflicting versions without silently losing work.
- Surface unfinished reports on the home screen.
- Extend offline capability deliberately; current retained-text recovery is not
  full cold-start offline capture. Verify behaviour on physical mobile devices.

### FE-4: Action-focused PM view

- Hide the review queue when review is disabled; review remains off by default.
- Surface new reports, unacknowledged reports, unassigned issues and verification.
- Add explicit PM acknowledgement with actor and timestamp, optionally a note.
- Keep acknowledgement separate from server receipt, delivery, approval and
  issue closure. Never hold sending pending acknowledgement.

### FE-5: Searchable, actionable issue register

- Search and filter by location, responsible company and verification status.
- Show descriptions and/or thumbnails when linking an existing issue.
- Query the whole authorised register, not just the loaded page.
- Design for SharePoint Lists as the authoritative issue store, with pagination
  and conflict-aware cached/pending changes.

### FE-6: Clear submission and correction flow

- Show acceptance, PDF preparation, delivery and PM acknowledgement distinctly.
- Provide traceable corrections/revisions rather than overwriting sent reports.
- Reconcile resulting issue changes while retaining their report provenance.

## Proposed implementation order

Draft reliability (FE-3), faster capture (FE-1), PM and issue workflows
(FE-4/FE-5), then submission/corrections (FE-6). This is a suggested sequence,
not a user-agreed release date or commitment to defer essential delivery status.

## Not included in this approval

Item 2, the photo-workflow expansion (separate camera/library controls, zoom,
reordering, annotations and per-photo progress), was not selected. Existing photo
functionality and necessary reliability fixes remain in scope.

## Broader scope decisions

These decisions refine the earlier proposals. They record scope, not completed
implementation or authority for external integrations/communications.

### EXP-1: Living site diary — agreed

- Assemble a chronological project timeline from existing reports and observations.
- Avoid a second round of diary data entry.
- Preserve report provenance and revision history.

### EXP-2: Decision/information requests — tentative, not approved

- Engineers already contact the PM or design consultant directly.
- Do not introduce a mandatory request, routing or approval step that delays that
  communication or requires duplicate entry.
- Revisit only if a concrete use case adds value beyond the existing conversation.

### EXP-3: Work undertaken without formal sign-off — refine existing variations

- Extend the existing variation-request concept, not a separate change module.
- Distinguish proposed work from work already undertaken without official sign-off.
- The latter requires a site manager signature.
- Client-side sign-off must expressly acknowledge a chargeable variation and
  agreement to pay, not merely confirm attendance or receipt. The user intends
  this to support subsequent billing at Leodis rates.
- Capture the client contracting entity, signer's name, role and stated authority,
  exact work scope, instruction/work dates, pricing basis and signature timestamp.
- Identify and present the actual rate schedule (reference/version/date) or
  agreed price before signature; retain it with the signed record. Do not rely
  on an unspecified reference to standard rates.
- Preserve the exact statement, scope, rates and signature as one immutable
  version; material changes need renewed agreement. Offer a copy to the client.
- A site manager's title or authority declaration alone does not establish their
  authority to bind the client. An unsigned/unauthorised record must remain
  visibly unconfirmed, not be treated as commercial approval.
- Draft wording and implementation requirements are in
  [variation-signoff.md](./variation-signoff.md). Legal review against the actual
  contract/jurisdiction is needed before relying on this for live billing.

### EXP-4: Location-based project history — not proceeding

- The user rejected the setup burden and reliance on engineers consistently
  formatting location names. Do not build a mandatory location hierarchy or
  require exact name matching. Free-text locations remain valid.
- This also constrains FE-1 suggestions and FE-5 location search: neither should
  depend on a maintained location catalogue.

### EXP-5: Additional report-type capacity — agreed

- Support additional report types using shared capture, draft recovery, evidence,
  submission, revision and PDF capabilities.
- Specific report types, fields, signature requirements and domain rules remain
  to be agreed; do not assume all reports follow the progress-report workflow.
- Structured inspections and Compliance templates are possible applications,
  not individually approved specifications.
- Handover packs remain a possible later extension; the user's explicit emphasis
  was additional report-type capacity, not a separately specified pack builder.
