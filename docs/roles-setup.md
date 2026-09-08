# RELAY role rollout

Prepared 8 September 2026. Local implementation; assign Microsoft roles before
deploying this version. Existing role-less sessions must sign in again.

## Agreed policy

- Admin, Manager and Engineer have separate navigation/landing screens.
- All three roles can access every project initially. Project scope remains a
  separate policy function so assignments can narrow it later.
- Engineers see submitted reports/issues and only their own drafts. Managers
  and Admin can see other draft summaries, never unfinished draft contents/PDFs/photos.
- All roles can capture their own reports and record progress/submit issue work
  for verification. Manager/Admin perform review, issue assignment, confirmation,
  withdrawal, reopening and independent verification.
- New report authorship and issue actions use account IDs, with display-name
  snapshots. Engineer trade is stored automatically on new reports. Defect
  affected-trade/scope controls belong to the later capture improvement.
- Admin has a team assignment checklist, current-session overview and audited
  legacy-draft ownership assignment. Role/trade assignments are managed in
  Microsoft, not by editing an email allowlist or self-selecting a role.

## Microsoft setup (before deployment)

In App registrations > RELAY by Leodis > App roles, create the following five
enabled roles. Allowed member types: Users/Groups. Values are case-sensitive.

| Display name | Value | Description |
| --- | --- | --- |
| Admin | Admin | RELAY administration and project oversight |
| Manager | Manager | RELAY project management and verification |
| Electrical Engineer | Engineer.Electrical | Site reporting, electrical trade |
| HVAC Engineer | Engineer.HVAC | Site reporting, HVAC trade |
| P&H Engineer | Engineer.PH | Site reporting, plumbing and heating trade |

These are three application access levels, with three Engineer trade variants.
They are not tenant administrator roles and grant no Microsoft directory admin
privilege. No additional Graph permissions are required for the app-role claim.

In Enterprise applications > RELAY by Leodis > Users and groups, give each
account exactly one role below. Replace the old Default Access assignment where
necessary; leave Assignment required enabled. Do not assign several RELAY roles
to the same person (including via groups): ambiguous assignments fail closed.

| Role | Accounts |
| --- | --- |
| Admin | callum@leodisme.com |
| Manager | tom@leodisme.com; ollie@leodisme.com; jonny@leodisme.com; russel@leodisme.com |
| Engineer.Electrical | john@leodisme.com; damien@leodisme.com; graham.stephenson@leodisme.com; bryony@leodisme.com; tyler.parker@leodisme.com |
| Engineer.HVAC | danny@leodisme.com; anthony.dyson@leodisme.com |
| Engineer.PH | chris@leodisme.com; aidan@leodisme.com; marcus@leodisme.com; harvey.obrien@leodisme.com; nicky.cunningham@leodisme.com |

Sources: [Microsoft app roles](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps)
and [user assignment](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/assign-user-or-group-access-portal).

## Deploy and verify

Back up the shared SQLite/media volume before upgrading and retain the prior
image. Rebuild/deploy using deploy/README.md after assignments are ready.
The tenant/client/secret/callback environment values do not change.

Check one real account per role: Admin opens Administration, Manager opens
Office, Engineer opens Site reporting with their trade and resumable drafts.
Verify direct API/URL access as well as navigation. Existing submitted test
reports remain readable; old drafts stay private until Admin assigns an original
author in Administration. That author must have signed in first. The assignment
increments the version, so stale local edits cannot silently overwrite the draft.
It does not infer historical trade from a current profile.

Role changes are reflected at the next Microsoft sign-in. Existing sessions last
up to 12 hours; removing a Microsoft assignment alone does not instantly revoke
a RELAY session. For urgent revocation, remove the Microsoft assignment and have
the server operator delete the affected account's sessions (or all sessions)
from the SQLite session store. Restarting containers does not revoke sessions.
Self-service instant revocation and Graph directory synchronization are not part
of this first role rollout.

Local demonstration sign-in only grants Engineer access. Never enable local
authentication on Hetzner. The HTTP verification script seeds isolated synthetic
sessions and does not exercise Microsoft or alter pilot data.
