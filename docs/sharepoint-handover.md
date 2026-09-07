# SharePoint setup handover

No SharePoint resources, permissions or mailbox settings have been changed.
We can do the tenant-dependent work when you are available.

## What to bring

1. The SharePoint site URL and existing project List URL. We need actual internal
   column names and example field types, not just their display labels.
2. Whether an issue List already exists. If it does, its URL and column layout.
   If not, we will agree the small schema before creating it.
3. The document library/folder where site-report PDFs should be filed, including
   how project folders are currently identified.
4. The Microsoft mailbox reports should come from and where each project's PM
   email address is stored. Sign-in permissions do not include permission to send.
5. Someone able to approve the necessary Entra/SharePoint application access.
   Do not paste passwords or client secrets into the conversation; we will enter
   credentials through the appropriate local configuration or Microsoft flow.

## Proposed issue data — confirm against existing Lists first

- Stable Relay issue ID (unique/indexed), project identifier, reference.
- Location, description, required action, assigned owner, target date.
- Separate confirmation and work-status fields; PM report acknowledgement must
   not be used as a substitute for either of these.
- Source report/revision and observation identifiers, for duplicate prevention
   and correction history.
- History as individually identifiable events, rather than repeatedly replacing
   an ever-growing JSON timeline in one field. We can use a companion event List
   if the existing SharePoint structure does not provide suitable history.

Owner fields need a practical choice: Microsoft people only, or free-text names
that also cover subcontractors. We should not invent tenant user IDs from names.

## Integration rules already agreed

- SharePoint Lists are the authoritative issue store, not a reporting mirror of
   an independently authoritative local database.
- SQLite holds app drafts, immutable submission snapshots, jobs, sessions and
   the local issue cache/pending operations.
- PDF preparation is independent of issue synchronization. Persist retries and
   honor SharePoint throttling without holding the engineer's submission open.
- File the exact stored PDF before attempting live email. Resolve the recipient
   from actual project data. Local outbox files are not emails sent to PMs.
- Review remains off by default. PM acknowledgement is a separate future action.

## Acceptance check before enabling live delivery

Use a designated test project and recipient. Demonstrate issue creation, update,
external List edit/concurrency handling, interrupted-request retry without a
duplicate issue, PDF filing, and the intended sender mailbox. Confirm the result
in SharePoint and the mailbox rather than treating an HTTP receipt as delivery.
