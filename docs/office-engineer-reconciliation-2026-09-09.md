# Office ↔ engineer reconciliation for the Portfolio desk

**Status, 9 September 2026 (later the same day):** G1, G2, G3 and D1 to D6
are done and the desk is built; see the entry of the same date in
[design-decisions.md](design-decisions.md). Chase was left out; Triage is a
dialog offering confirm or withdraw with a reason; "Reopen" on a closure
awaiting verification became "Not finished" because the state graph sends it
back to in progress, not to open. Two things the audit missed and the build
found: reassigning an already-assigned issue was refused by the state graph
(fixed in the store), and the dev server's working directory decides where
photographs are stored, so the two launch configurations use different stores.
D2 was reversed on the user's steer: the email is only a notification to the
project manager that a report came in, so it is shown quietly ("PM notified"
or "PM not notified") and never leads the attention list. Only a processing
failure carries alert weight.

9 September 2026. Concept 1 (Portfolio desk) from
[developments-office-admin-concepts-2026-09-09.html](developments-office-admin-concepts-2026-09-09.html)
was chosen for the Developments Office and Admin. Before it is built, this checks
every engineer-side action against what the office draws, and every office
action against what the engineer side will see. Read against:
`components/EngineerWorkspace.tsx`, `components/IndividualDefect.tsx`,
`app/reports/[id]/page.tsx`, `app/issues/[id]/page.tsx`, `lib/serverStore.ts`,
`lib/issueStore.ts`, `lib/defectStore.ts`, `lib/reportWorker.ts`, `lib/status.ts`
and the `api/reports` and `api/issues` routes.

## What already marries up

| Engineer does | Office sees (Concept 1) | Status |
| --- | --- | --- |
| Starts or continues a site update; autosave to server | Register column “Drafts on site” with a summary; contents private | Works. The allowlist for other people’s drafts returns reference, author, visit date, last saved. It zeroes the section count and omits the author’s trade, so the mock’s “Electrical · 3 sections” is not available (see D3). |
| Sends to office (signature, blocking checks) | Received, then review, then delivery as three separate facts | Works. `receiptStatus`, `reviewStatus`, `deliveryStatus` already produce the words. |
| Defect or access restriction in a report | Issue raised provisional at submission; “Not reviewed” in the Issues tab | Works. Variations do not raise issues; they appear only in the report. |
| Links a section to an existing issue (further sighting) | A progress event on that issue, not a new one | Works. The office reader must say “further sighting of ISS-00x”, not “raised” (see D6). |
| Flags an individual defect (photos, location, affected trade) | Open, unassigned, provisional issue; Attention “unassigned” | Works. `raisedByReport` is empty and `source` is `individual` (see D5). |
| Records progress with photos; submits work as complete | Work status moves; “Awaiting verification” lands in the verify lane | Works. Verification independence is enforced server-side by stable ID. |
| Reads submitted reports across trades; own drafts only | Same rule for the office, plus other people’s draft summaries | Works. |
| Own trade recorded on reports and as reporter trade on defects | Trade filters | Works, with a caveat: report-raised issues have no affected trade (the section model has none), so a trade filter must treat them as “not recorded”. |

Office actions with an existing command: **Assign** and **Reassign** (`assign`,
owner plus target date), **Verify** (`verify`), **Reopen** (`reopen`),
**Confirm** and **Withdraw** (`confirm`/`withdraw`, a reason is mandatory, so
each needs a dialog, not a bare button), and report **Approve** / **Send back**
(`review`). Admin: the assignment checklist, signed-in sessions (last sign-in is
the latest session’s `issuedAt`), older drafts. Search is client-side over the
loaded registers, which the current Office page already fetches in full.

## Gaps that break the loop

Ordered by how much they matter. The first three are the ones an engineer would
notice.

**G1 · A returned report is a dead end for the engineer.** Send back sets
`review: returned` but the report stays submitted and immutable. The editor’s
“Sent back by …” note renders only for drafts, so it never shows; the engineer’s
Reports list says “Received” regardless; `correctReport` exists in the store but
no route calls it. So the office can return a report and dispute its issues, and
the engineer has no way to see why or to respond. Fix: expose a correction
action (`POST /api/reports/:id { action: 'correct', reason }`, author only, uses
`correctReport`), show “Returned — make a correction” on the engineer’s report
and list, and show “Rev 2 supersedes Rev 1” in the office register. The concept
already draws a Rev column. This is FE-6.

**G2 · Engineers cannot see review or delivery.** Their list shows Draft or
Received only, and the submitted report page says it was received and can no
longer be edited, which reads as “the project manager has it”. In the pilot
nothing is emailed. Fix: reuse `status.ts` on the engineer Reports list and on
the submitted report page so both sides read the same three words.

**G3 · Acknowledgement does not exist.** It is the reader’s primary action in
the concept (FE-4) and would let the engineer see “Read by Tom, 09:12”. Needs a
field on the report (who, when, optional note), a manager-only action on the
report route, and a line in the draft allowlist. Kept separate from receipt,
review and delivery, as the backlog says.

## Data the concept assumes and the summary does not carry

**D1 · Found column.** The stored summary has `defectCount` (defects plus access
restrictions together) and no variation count. Add per-kind counts to the
summary in `lib/storage.ts` and to `ReportSummary`; cheap, no migration since
summaries are rewritten on save.

**D2 · “Not emailed” severity.** `deliveryStatus` gives the local-outbox state a
`draft` tone. The office should show it at alert severity: the project manager
has not received the report. One-line change; the engineer page then inherits
the same wording from G2.

**D3 · Draft summary.** Decide whether a section count and the author’s trade
are contents or not. Recommendation: allowlist both; a count and a trade reveal
nothing an engineer wrote. Otherwise the register row shows reference, author
and last saved only.

**D4 · Not-reviewed count.** On projects with review off (all three today) issues
stay provisional until someone confirms them one by one. Add a “Not reviewed”
chip to the Issues tab and to Attention, alongside overdue, verify, unassigned
and disputed, or the office will never notice them.

**D5 · Raised column.** `raisedByReport` is a report ID, so the register needs
the loaded reports to print `SPR-010`; for individual defects print “Flagged on
site by G. Stephenson” and link nothing.

**D6 · Further sightings.** In the reader, a section with `linkedIssueId` is
“further sighting of ISS-00x”, not “raised ISS-00x”. The full report carries the
field.

## Vocabulary on the office that has no command

- **Chase**: no command. Either record it as a `progress` event with the note
  “Chased C&AJ Marshall” (it will move an open issue to in progress, which is
  arguably right), or leave it off the first build. Recommendation: leave it off.
- **Triage**: not a command; it is Confirm or Withdraw on a disputed issue. Draw
  it as a dialog offering both, each with its reason.
- **Assign** picks an owner as free text. Owners are names or companies, not
  accounts, so the Team tab cannot be an assignee list and “assigned to me”
  stays impossible on the engineer side. The dialog should suggest previous
  owners on the project (FE-1), not the roster.
- **Team tab** is the roster and sessions, which Admin already has. For Managers
  it is read-only. Fine, but it must not imply a directory.

## Things the concept omits that must stay

- The prototype banner above the chrome, and the local-identity warning.
- **Engineer view** for Managers and Admin on desktop (the mock has it only on
  the phone). Put it beside Companies in the top bar.
- **Help & install** from the current Office. Put it under the whoami menu or
  the Admin tab, not as a tab.
- The issue page is shared by both roles. Its back link goes to
  `/engineer?…`; when opened from the office it should return to the office.
- Drafts held only on a device (IndexedDB) are invisible to the office. The
  register foot should say so, as the current Office does.
- `/developments` sends Admin to `/admin`. With Admin as a tab, `/admin` should
  land on `/office` with the Admin tab open, keeping the `isAdmin` check on that
  tab and `canManage` on the layout.

## Compliance side

The Compliance workspace runs on invented sample data and persists nothing, so
there is no data flow to reconcile yet. The only coupling is the shared
component set, which is the point of choosing Concept 1: the tags, refs, chips,
panels, tab strip and phone tab bar are the same primitives with a different
accent. When a real Compliance store arrives, the same three facts (received,
review, delivery) and the same two issue axes should be reused rather than
reinvented.

## Suggested order

1. G2 and D2 (an hour: shared status words on the engineer side, outbox at alert).
2. D1, D3, D5, D6 (summary counts and allowlist, before the register is built on them).
3. G1 (correction route and engineer UI; office Rev column).
4. G3 (acknowledgement).
5. Build the office and Admin from Concept 1, with D4 and the Chase/Triage decisions above applied.
