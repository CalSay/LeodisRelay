# Leodis Relay

Site and compliance reporting platform for Leodis Developments and Leodis
Compliance Management.

## Scope

First release covers **Main Hub and Developments**. Compliance Management is
documented future scope — its domain rules are deferred, but the shared report
engine is proven against a Compliance-shaped fixture so it is not built around
Developments assumptions alone.

## Layout

    apps/web/          routes, shell, client screens, HTTP adapters
    apps/web/worker.ts separate leased PDF/outbox worker process
    packages/
      contracts/       API schemas, domain ports, versioned event types
      platform/        auth, revisions, media, sync, audit, jobs
      documents/       React-PDF document renderer and footer stamping
    apps/web/tests/    media, storage and background-processing checks
    docs/              decisions, runbooks, acceptance evidence

Domain packages depend on platform contracts and their own repositories, never
another domain's tables. Adapters are wired at the application boundary, so pure
rule tests need neither Graph nor a browser.

## Commands

    # Node 24+
    npm ci
    npm run typecheck
    npm test

## Where data lives

| Data | Store |
| --- | --- |
| Reports, immutable snapshots, jobs, sessions | Local SQLite |
| Issue tracking | Local prototype today; authoritative SharePoint Lists at deployment |
| Photograph originals and generated PDFs | Private local volume |
| Project reference data | Fixtures today; SharePoint integration planned |
| Distributed PDFs | SharePoint library integration planned |

PDF work runs separately from the web server. Run both the app and worker as
described in the deployment brief below. Local outbox messages are not sent email.

## Pilot deployment

The parked, exploratory commercial-product direction is captured in
[RELAY by Leodis — initial product proposal](docs/relay-product-proposal.md).
It does not replace the current pilot plan or authorise full-suite development.

Agreed front-end improvements and unapproved expansion ideas are tracked in
[docs/product-backlog.md](docs/product-backlog.md).

Current completed optimisations, test evidence and remaining work are recorded in
[docs/optimisation-progress.md](docs/optimisation-progress.md).

The agreed low-cost PWA pilot, its Microsoft Entra setup, deployment
prerequisites and go-live checklist are documented in
[docs/deployment-pilot.md](docs/deployment-pilot.md). This is the intended
route to an installable iOS/Android web app without app-store distribution.
