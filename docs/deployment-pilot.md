# Deployment pilot: agreed direction

Updated 7 September 2026. This brief supersedes the earlier PostgreSQL/Azure
suggestions in historical reviews.

## Agreed product and hosting choices

- Review stays off by default. Receiving a report, reviewing it, delivering it
  and the PM acknowledging it are separate events.
- PM acknowledgement is planned: record who read it, when, and an optional note.
  It must not imply approval or issue closure.
- Installable web app on iOS and Android, without app-store distribution.
- One Hetzner VPS running the web application and a separate PDF worker.
  The user's accepted server budget is €8–9/month, not a live provider quote.
- Microsoft Entra sign-in stays. Hosting outside Azure does not change that.
- SharePoint Lists will be the authoritative issue-tracking store. SharePoint
  document libraries will hold distributed PDFs. SQLite is for local operational
  state: drafts, immutable submissions, jobs, sessions, and the future issue
  cache/pending operations. No separately hosted database is required.

## Current implementation versus deployment target

| Area | Implemented now | Still needed |
| --- | --- | --- |
| Persistence | SQLite WAL transactions, indexed records, one-time JSON import with originals preserved | Backup/restore rehearsal; SharePoint issue adapter |
| Photos | Private originals, decode validation, orientation handling, 480px thumbnails and 1,600px JPEG PDF copies | Camera/device tests, HEIC strategy, retention |
| Submission | Version check, durable save request IDs, immutable snapshot and PDF job transaction | Smaller mutations, conflict-resolution UI, signature retention |
| PDF | Separate single-worker process; stored bytes reused for download and local delivery | Representative large-photo benchmarks and visual pagination QA |
| Delivery | Local .eml outbox; retries and accurate local-only status | SharePoint filing, app-only mailbox credentials, delivery reconciliation |
| Lists | Indexed report summaries, 50-row pages, visibility-aware office polling | Issue-history pagination and incremental refresh |
| PWA | Sized icons, cached retained-draft text recovery/editor, static asset caching | Full cold-start offline capture and physical-device testing |
| Corrections | Snapshot preservation and initial store helper | User-facing correction flow and issue reconciliation |
| PM acknowledgement | Product decision recorded | Implementation |

The app still uses fixture projects and a local issue store. It is not yet
connected to SharePoint and must not be described as deployed or production-ready.
The prototype banner remains. Live mail is deliberately blocked in the worker
until the required filing and mailbox integration exists.

## PDF path

1. Upload photographs separately from text saves.
2. Save and validate the report; on submission, freeze the accepted version and
   commit its PDF job in the same SQLite transaction.
3. Return the Relay receipt immediately after commit, without rendering or mail.
4. The separate worker renders once and stores an artifact keyed to the revision.
5. Downloads and delivery reuse those exact bytes. A pending download returns a
   retryable response rather than starting another render.
6. Before real mail is enabled, add SharePoint filing followed by delivery.
   SharePoint issue operations should run independently of PDF rendering.

Keep React-PDF and the existing PDF footer-stamping pass until measurements show
a worthwhile reason to replace them. The current savings remove repeat rendering,
large list payloads and image retransmission from text saves; no measured end-user
speed multiplier is claimed.

## Running locally

Use Node 24 or newer. From the repository root:

    npm ci
    npm test
    npm run typecheck
    npm run build
    npm --workspace @relay/web run start

Run the worker in a second terminal:

    npm --workspace @relay/web run worker

For development, build the shared packages and worker first, then run the app:

    npm run build:packages
    npx tsc -p apps/web/tsconfig.worker.json
    npm --workspace @relay/web run dev

Both processes must share RELAY_DATA_ROOT and RELAY_MEDIA_ROOT. Defaults resolve
under apps/web/.relay-prototype when launched via the workspace commands. Do not
run the worker from a different working directory without setting absolute roots.

## Hosting preparation

Docker Compose defines web and worker services on one persistent local volume.
It intentionally contains no PostgreSQL service. The web port binds to localhost
for an HTTPS reverse proxy. No VPS, DNS, Microsoft tenant or external send has
been provisioned by this work.

Configure Entra using [entra-setup.md](./entra-setup.md) and the example environment
file. Keep secrets outside source control. Production must use Entra, not local
development identity. Register the exact public HTTPS callback URL.

Before real use:

- Connect actual projects, issue List schema and PDF library, with scoped Graph
  permissions. Handle List concurrency, retries, throttling and external edits.
- Configure a sender mailbox and filing-before-mail. Treat uncertain mail
  responses separately from confirmed failures; do not promise exactly-once email.
- Test a consistent SQLite backup (not a naked copy of the live main database
  while WAL writes continue), evidence backup and off-server restoration.
- Test installation, camera formats, reload, offline edits, reconnect, concurrent
  saves and large PDFs on actual iPhones and Android devices.
- Finish project permissions/stable author IDs, corrections, PM acknowledgement,
  operational failure/retry controls and monitoring.

The offline recovery screen edits existing retained text, not new projects or
photographs. It requires the tab's remembered identity and cannot replace full
cold-start offline capture. Do not promise background submission after an iPhone
app has closed; resume synchronization when the app can run and authenticate again.

Tomorrow's tenant-dependent inputs are listed in
[sharepoint-handover.md](./sharepoint-handover.md).
