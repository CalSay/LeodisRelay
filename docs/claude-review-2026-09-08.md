# Review of the deployment, roles, install and PDF work

Reviewing `docs/claude-review-handoff-2026-09-08.md` and the code it describes.
Everything below was checked against the running application rather than read
off the handoff. Where I could fix something cheaply and safely I have; where a
change needs a decision or a measurement I have said so instead of guessing.

Verification as it stands: `npm test` 7 passing, `npx tsc --build` clean,
`npm run build` clean, `node scripts/verify-role-access.mjs` **50** production
HTTP permission checks passing (was 28).

## The one real defect

**Any signed-in person could attach a photograph to any issue on any project,
and read it back.** `GET`/`PUT` on `/api/media/[id]` authorised report media
properly, but for issue media the only test was whether the issue *existed*:

```ts
} else if (!await getIssue(issueId!)) return NextResponse.json({ reason: 'Issue not found.' }, { status: 404 });
```

Existence is not permission. I reproduced it end to end — an engineer uploaded a
valid PNG against an issue on an unrelated project and got `200`, then read the
bytes back with another `200`.

Fixed: both verbs now go through `canAccessProject(principal, issue.projectId)`.
Be clear about what that buys today — the pilot deliberately grants every
project to every role, so the answer does not change yet. What changes is that
issue media is now *expressed* as a project-scoped decision, so when
`canAccessProject` grows a real grants model this comes with it for free instead
of being the one place someone forgets. The new test asserts the check actually
runs rather than asserting today's permissive answer.

This is the same shape as the two bugs Codex and I already found — a route
deciding something the domain layer was supposed to decide. Worth treating as a
pattern rather than three incidents: **an adapter that answers an authorisation
question inline is a bug waiting to happen.** I would make that an explicit
review rule.

## What I checked and found sound

- **Role mapping fails closed.** `accessFromRoles` demands exactly one known
  assignment; email and display name grant nothing. Pre-role sessions are
  rejected in `currentSession` rather than promoted.
- **The tenant claim is verified before roles are read**, so a matching role
  name in another tenant is not a way in.
- **`reportsFor` filters in SQL before pagination**, so a page of 50 cannot be
  silently short. The manager view then applies an explicit allowlist. I now
  assert the redaction on field *names* — `reviewNote`, `issued` and `signature`
  are absent — not just on the zeroed counts, which is what a regression would
  actually break first.
- **`putMedia` is the best-built thing in this change.** Immutable bytes,
  digest-and-owner comparison on collision, magic-byte MIME validation, `wx`
  writes. No notes.
- **Legacy draft reassignment** is Admin-only, atomic, and audited with the
  previous author's label retained.
- **`INITIAL_ROSTER` is display-only.** I checked every reference; it is never
  consulted for an authorisation decision. Good — a roster that drifts is
  otherwise a silent grant.

New assertions I added, all passing: Admin gets the same `403` as a Manager on
another author's draft, PDF and media (there is no administrative reading
bypass, which was claimed but untested); `?download=1` does not slip past the
PDF guard; no role may edit or submit another person's draft; a photograph
cannot be pushed onto a report the uploader does not own; `verify` and `reopen`
are manager commands; a Manager cannot reassign legacy drafts; media on an
issued report is readable by the project team.

## Deployment: the gap was the restore

`upgrade-pilot.sh` takes a verified, checksummed backup on **every** run. There
was no scripted way to use one. `rollback-roles.sh` deliberately restores the
image only and says so. So the documented answer to corrupted data was prose in
`deploy/README.md` and improvised `docker run` commands typed under pressure.

Added `deploy/restore-data.sh`. It verifies the checksum and the archive
*before* stopping anything — finding a truncated tar after emptying the volume
is the worst possible moment — requires the operator to type `RESTORE`, and
takes its own backup of current data first, so a restore from the wrong
timestamp is itself reversible.

**It is syntax-checked, not executed.** There is no Docker on this machine and I
will not claim otherwise. Rehearse it on the box against a throwaway volume
before it is ever needed in anger. That rehearsal is the single most valuable
hour available on this project right now: an untested restore is a backup you
only *believe* you have.

### Health checks were asking the wrong question

All three deploy scripts proved the release worked by fetching
`https://app.relaybyleodis.com/signin`. That goes out to public DNS, back
through Caddy, and requires a valid certificate — so an expired certificate, a
DNS problem and a broken application were indistinguishable, and the script's
response to all three was to roll the application back. For two of them that
fixes nothing and discards a good deployment.

- Added `GET /api/health`. Unauthenticated by necessity (the caller is a
  container runtime), and deliberately more than a bare `200` — it opens the
  record store and counts, so a container that has lost its data volume reports
  unhealthy instead of serving a hollow application. It discloses nothing but
  `{"status":"ok"}`; two new tests assert both halves of that.
- Added a `HEALTHCHECK` to the image, disabled for the worker, which serves no
  HTTP.
- The deploy scripts now gate on container health (fatal, triggers the existing
  rollback) and report external reachability separately as a warning that names
  the likely cause and says explicitly **not** to roll back.
- `stop_grace_period: 60s` moved onto the shared anchor. Both services write
  SQLite and photos; only the worker had it.

### Line endings

Added `.gitattributes` pinning `*.sh`, `Dockerfile`, `Caddyfile` and the compose
files to LF. Committed copies are already LF, so this changes nothing today —
but `core.autocrlf=true` means the Windows *working tree* has CRLF, and the
README says to run from an "extracted" checkout. A tarball built on Windows
would land scripts that fail as `/usr/bin/env bash^M: not found`, which reads
like a missing interpreter rather than a line ending and would cost an
unpleasant hour.

## In-app PDF viewer

Well built — local rendering, no navigation out to the device viewer, extracted
page text for screen readers, correct cancellation on unmount. Two real faults:

1. **Unbounded canvas.** At 200% zoom on a retina screen the surface could
   exceed Safari's ~16.7M pixel limit, which returns a *blank* canvas rather
   than an error. Fixed by reducing the device pixel ratio until the surface
   fits. This is a phone-first application; a silently blank report is a bad
   failure mode.
2. **"Sign in" was offered on every error**, including page-render faults. It
   now appears only on a `401`. Sending someone to fix a session that is not
   broken wastes their time and teaches them to distrust the message.

## Install guidance

Accurate and honest about what installation does *not* give you, which I would
keep. Two changes:

1. It rendered above the content of **every** page — a permanent band of
   installation advice above the report an engineer was in the middle of
   writing. Now shown on the home and sign-in screens only, which are the two
   places someone is when they think about installing it. It stays reachable for
   every role because everyone passes through sign-in.
2. Its `<h2>` subsections claimed top-level page structure on every screen for
   screen-reader users. Now `<h3>` under the summary that already heads them.

## What I would do next, in order

1. **Rehearse the restore.** Nothing else on this list matters if the backups
   turn out not to work. One hour, on the box, this week.
2. **Immutable submission snapshots and a correction action.** This is still the
   most serious open item from Codex's review and it is a correctness problem,
   not a polish one: a returned report can claim it was never issued while the
   email has already gone. Everything else here is defence in depth; this one is
   the system telling a client something untrue.
3. **Answer the confirmation question.** With review off, every issue sits
   `provisional` for ever and `confirmed`/`disputed` are unreachable — a whole
   axis of the domain model is dead code in the shipped configuration. My
   recommendation: submission confirms directly, and a manager retains
   `dispute`/`withdraw`. That keeps the two-axis model meaningful without
   reintroducing the review step you removed for good reasons.
4. **Per-project grants.** `canAccessProject` is a placeholder returning true.
   Fine for a pilot on one division; it is the thing to build before Compliance
   Management shares the instance.
5. **Prune devDependencies from the runtime image** and consider memory limits
   in compose. I did neither: the first needs the container actually started to
   confirm nothing is misfiled, and the second needs a measured PDF render with
   real photographs before capping anything — a limit set by guesswork
   OOM-kills the worker mid-report, which is worse than no limit.
6. **`caddy_data` is not backed up.** Only the certificates live there, and
   Let's Encrypt reissues, so this is low severity — but reissue is rate
   limited, so it is worth one line in the backup script rather than a surprise
   during an outage.

## Smaller notes, not actioned

- `POST /api/reports/[id]` parses the request body **before** `requireSession()`.
  Not exploitable — Next bounds the body — but the ordering is backwards and
  costs nothing to swap.
- The `postcss` advisories are build-time only. The override cannot be applied
  because Next pins `8.4.31` exactly; I tried both override forms and reverted
  rather than leave a non-functional one in `package.json`.
- `ENTRA_TENANT_ID` is compared as an opaque string. If someone configures the
  tenant *domain* rather than the GUID, sign-in fails with "this account is not
  in the configured Leodis tenant", which points at the account rather than the
  configuration. A format check at startup would turn a confusing support call
  into a clear one.
