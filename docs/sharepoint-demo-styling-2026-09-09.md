# SharePoint demo records and view styling — 9 September 2026

Applied directly through the signed-in SharePoint UI at the user's request. Three reports and three issues are fictional and labelled DEMO in their titles and descriptive text. Existing projects are used as lookup references only. No project records, client records, photographs or PDFs were modified. No email delivery was initiated by this work.

## View designs

All six views use native SharePoint JSON row formatting: cream cards, deep green headings, muted gold labels, rounded corners, separate status pills and an action opening the native item form. Standard view filters and selection remain available. The DEMO badge appears only when the title begins with DEMO.

| List / view | Design and verification |
|---|---|
| Report Register / All Reports | Green accent, project heading, revision, review/filing/email status, received date and submitter. Three demo reports. |
| Report Register / To Review | Gold accent, AWAITING REVIEW label. One pending current revision. |
| Report Register / Delivery Failures | Red accent, DELIVERY ATTENTION label. One simulated failure. |
| Issue Tracker / All Issues | Green accent, project, location, description, work/confirmation/trade status, target date and owner. Three demo issues. |
| Issue Tracker / Open Issues | OPEN ACTION label. Three non-closed examples. |
| Issue Tracker / Awaiting Verification | Gold accent, READY TO VERIFY label. One example awaiting verification. |

Each view was visually inspected in the desktop browser. Status labels accompany colours. Cards wrap their content, but this was not a separate phone/tablet acceptance test. Lookup and person values use SharePoint's array iteration representation. Received date/time uses toLocaleString on the date field separately from its label; direct concatenation can cause Invalid Date after view navigation. Target dates use the field's existing display value.

## Demo inventory

| Stable RELAY ID | Title | State |
|---|---|---|
| DEMO-REPORT-20260909-001 | DEMO • SPR-001 \| Weekly progress | Pending review; filing pending; email not requested |
| DEMO-REPORT-20260909-002 | DEMO • SPR-002 \| Plantroom inspection | Approved; simulated Filed / Sent |
| DEMO-REPORT-20260909-003 | DEMO • SPR-003 \| First-fix progress | Review not required; simulated filing/email failure |
| DEMO-ISSUE-20260909-001 | DEMO • ISS-001 \| Missing socket label | Provisional / Open / Electrical |
| DEMO-ISSUE-20260909-002 | DEMO • ISS-002 \| Duct insulation incomplete | Confirmed / In progress / HVAC |
| DEMO-ISSUE-20260909-003 | DEMO • ISS-003 \| Basin waste connection repaired | Confirmed / Awaiting verification / P&H |

Reports 001 and 002 and all issues reference Tetley Hall - Block E. Report 003 references The Lawns - Main Contract. Required submitter/reporter fields reference Callum, not a fabricated Microsoft identity. All issue assignments remain empty; the verification example records Callum as closure submitter and leaves verifier empty. No real engineer was assigned work.

The Filed/Sent/Failed states are demonstration values only: there is no corresponding PDF or delivery attempt. No RELAY synchronization was enabled. Remove these six exact DEMO IDs before production synchronization or operational reporting. Do not delete project records or change the saved view formatting when removing examples.

## Maintenance

In each SharePoint view menu, choose **Format current view → Advanced mode** to inspect or copy its saved JSON. This formatting changes presentation only; it does not enforce workflow transitions, user permissions, verification rules or data synchronization. Column internal names and view filters are documented in [the setup record](sharepoint-lists-created-2026-09-09.md).

- [Report Register](https://leodisdevelopments.sharepoint.com/sites/Operations/Lists/Report%20Register/AllItems.aspx)
- [Issue Tracker](https://leodisdevelopments.sharepoint.com/sites/Operations/Lists/Issue%20Tracker/Open%20Issues.aspx)
