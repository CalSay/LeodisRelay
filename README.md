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
    apps/worker/       leased background-job execution
    packages/
      contracts/       API schemas, domain ports, versioned event types
      platform/        auth, revisions, media, sync, audit, jobs
      hub/             authorised summaries and personal preferences
      developments/    project observations and commercial rules
      ui/              accessible reusable components
      adapters/        PostgreSQL, blob storage, Microsoft Graph
    tests/             fixtures, contracts, journeys, recovery
    infra/             environments, deployment, monitoring
    docs/              decisions, runbooks, acceptance evidence

Domain packages depend on platform contracts and their own repositories, never
another domain's tables. Adapters are wired at the application boundary, so pure
rule tests need neither Graph nor a browser.

## Commands

    npm install
    npm run typecheck
    npm test

## Where data lives

| Data | Store |
| --- | --- |
| Reports, revisions, observations, issues, jobs | PostgreSQL |
| Clients, identity, grants, audit, templates | PostgreSQL |
| Photograph originals and derivatives, handover certificates | Private blob |
| Project reference data | SharePoint (read) |
| Issued signed PDFs | SharePoint (write) |

Two integrations cross into SharePoint: project references in, issued PDFs out.
