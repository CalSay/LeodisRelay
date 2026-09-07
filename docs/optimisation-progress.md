# Optimisation progress — 7 September 2026

## Implemented

- New photographs are uploaded as immutable binary files, referenced by ID in
  text saves. JPEG, PNG and WebP are decoded before acknowledgement; originals
  remain untouched. EXIF orientation is normalized into 1,600px JPEG PDF copies
  and 480px thumbnails. Processing is limited to two images concurrently, with a
  50-megapixel decode limit. Browser-created thumbnails reduce local preview load.
- Reports, sessions and prototype issues now use SQLite instead of whole-file
  JSON rewrites. Existing JSON is imported transactionally and left intact.
  Ordinary issue updates touch one record; report-source queries are indexed.
- Submission checks the saved version, freezes content and queues PDF work in
  one transaction. It no longer waits for PDF rendering or local mail creation.
- A separate worker renders one report at a time, with leases, lease renewal,
  bounded retries and recorded failure. Completed PDFs are reused from disk.
  Draft previews are cached by save version but still render in the web process.
- The local outbox has deterministic filenames for retries. UI wording explicitly
  distinguishes local outbox files from emailed reports. Live mail is blocked
  pending SharePoint filing and mailbox integration.
- Report lists select precomputed summaries in pages of 50. Office polling waits
  for each response, pauses while hidden, and runs every 15 seconds while visible.
- Autosaves use the latest acknowledged server version. A save acknowledges only
  its captured edit; local compare-and-delete is one IndexedDB transaction.
- Save request IDs and exact payloads persist in IndexedDB before transfer.
  Lost responses replay before later edits. Server receipts store hashes and
  versions, not another whole report per keystroke. Reusing an ID with different
  content is rejected. Recovered drafts retain their original base version.
- A cached offline recovery screen can reopen, edit and export retained draft
  text. It uses this tab's last signed-in identity, does not submit reports and
  does not add new projects/photos. Authenticated reload resumes saving.
- PDF signatures export dark ink independently of the screen theme. PWA icons
  now include actual 192px, 512px and 180px iOS variants.
- Web fonts are bundled locally, and root checks include web tests/typechecking.
- Compose describes one VPS, shared SQLite/evidence volume and separate worker.
  The unused PostgreSQL scaffold/dependencies were removed; no existing database
  or user records were deleted.

## Verification

- Production web build and worker compilation passed.
- 145 shared-package tests and 5 web tests passed (rerun before the main-branch handoff).
- Web tests cover immutable/scoped uploads, stale-save rejection, transactional
  rollback, submission retry, snapshot preservation, summary payloads, concurrent
  PDF coalescing, disk reuse, lease recovery and stale-lease rejection.
- Added image dimensions/orientation, corrupt-image refusal, WebP normalization,
  idempotent saves, changed-payload rejection and lost-response ordering checks.
- The worker test also renders a real PDF and prepares a local .eml message.
  It checks PDF bytes, not visual layout or mobile performance.

An isolated production browser check also passed: save online, stop the server,
edit, reload into offline recovery, edit again, reload offline, restart the server,
and automatically synchronize the latest text. Synthetic test data and the test
server were removed afterward; existing project data was not used or changed.

These are correctness checks, not before/after latency benchmarks. No physical
phone, Docker deployment or real Microsoft tenant was verified. Offline recovery
requires previously retained work and a remembered identity in the current tab;
it is not a complete cold-start offline app. Signature persistence and concurrent
multi-tab editing/conflict resolution remain unfinished.

## Evening mobile preview and handoff

- Started a LAN development preview; the user tested it on mobile and reported
  that functionality looked good. This is not formal iOS/Android acceptance testing.
- Replaced browser randomUUID calls with getRandomValues-based IDs so draft and
  photo capture can work over local HTTP. Added the fifth web test for these IDs.
- Local authentication redirects now retain the browser's host rather than the
  server bind address. LAN sign-in and a signed-in page returned successfully.
- Development logs showed first-route compilation delays of several seconds;
  no production-performance conclusion should be drawn from that preview.
- A production-preview cookie opt-in was added before that server-switch task
  was cancelled: RELAY_LOCAL_HTTP=yes only relaxes Secure cookies when local auth
  is explicitly allowed and no Entra tenant/client credentials are configured.
  It is for local demonstrations only, was not exercised in a production LAN
  preview, and must not be enabled on a real deployment.
- Tests (150 total) and typechecking passed for the handoff. The earlier production
  build passed before the final LAN changes; it has not been rerun for this handoff.
- Source and documentation belong in Git; local reports, photos, SQLite state,
  generated builds and real environment files do not. Pulling on another PC does
  not transfer local test data or start the server. Follow deployment-pilot.md
  with Node 24+, npm ci and the documented build/app/worker commands.

Dependency audit reports two findings through Next.js's PostCSS dependency
(one moderate, one high), not Sharp. These must be resolved/tested before deployment;
no forced major framework upgrade was applied as part of the image work.

## Next work, in order

1. Benchmark realistic photo-heavy reports on the target VPS and test camera
   formats/installation/offline recovery on iOS and Android. HEIC is not accepted.
2. The present queue still sends all observation metadata. Add smaller mutations,
   signature persistence, explicit conflict comparison/resolution and multi-tab
   coordination. Complete cold-start offline capture beyond retained text edits.
3. Connect SharePoint Lists as the authoritative issue store, with local pending
   operations/cache, scoped access and conflict-aware synchronization. Projects
   and list schemas are still fixtures/local today.
4. File exact PDF bytes in SharePoint before mailbox delivery. Add operator
   retry controls, recipient-level outcomes and uncertain-send reconciliation.
5. Finish correction UI and issue provenance/reconciliation, PM acknowledgement,
   stable author IDs, project permissions, image cleanup and backup/restore tests.

See [deployment-pilot.md](./deployment-pilot.md) for agreed hosting/product choices.
