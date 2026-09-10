# SharePoint Lists created for RELAY — 9 September 2026

Created through the signed-in SharePoint browser UI on the Operations site. Subsequently populated with three clearly labelled DEMO reports and three DEMO issues at the user's request, and all six views formatted. See [demo and styling record](sharepoint-demo-styling-2026-09-09.md). Existing project/client records and files were not changed. RELAY synchronization has not been enabled. Application access remains read-only.

## Lists

Site: https://leodisdevelopments.sharepoint.com/sites/Operations

Site ID: `leodisdevelopments.sharepoint.com,7fc89dbf-9b60-4018-bb49-1bcdb28a5fd6,5213073c-845c-4e0f-aac1-a3e7e1bcfa9e`

| List | ID | Link |
|---|---|---|
| Report Register | `f916d018-d7a7-4703-a9cc-b722fa20b430` | [Open](https://leodisdevelopments.sharepoint.com/sites/Operations/Lists/Report%20Register/AllItems.aspx) |
| Issue Tracker | `4b49efb5-df01-4097-ab64-dae248d5c114` | [Open](https://leodisdevelopments.sharepoint.com/sites/Operations/Lists/Issue%20Tracker/Open%20Issues.aspx) |

Both Project columns are single lookups to the existing Project Tracker (`3e2035e6-3d28-4fe4-9e24-888ffd8e9ef4`), displaying Title. Cascade deletion is not enabled. Use the lookup item ID for identity; project numbers are not globally unique. Existing Client Database and document library remain in use.

## Report Register

One row per submitted report revision, populated by RELAY once integrated. Drafts stay in RELAY. Correction revisions link to the previous revision; they do not overwrite its submission snapshot.

| Display name | Internal name | Type / configuration |
|---|---|---|
| Report Reference | `Title` | Required text |
| RELAY Report ID | `RelayReportId` | Required, unique, indexed text identifying the submitted revision |
| Project | `Project` | Required single project lookup |
| Review Status | `ReviewStatus` | Required choice: Not required, Pending, Approved, Returned; default Not required |
| Filing Status | `FilingStatus` | Required choice: Pending, Filed, Failed; default Pending |
| Email Status | `EmailStatus` | Required choice: Not requested, Pending, Sent, Failed; default Not requested |
| Revision | `Revision` | Required number, zero decimals, minimum/default 1 |
| Visit Date | `VisitDate` | Required date only |
| Received At | `ReceivedAt` | Required date and time |
| Submitted By | `SubmittedBy` | Required single person |
| Reviewed By | `ReviewedBy` | Optional single person |
| Reviewed At | `ReviewedAt` | Optional date and time |
| Review Comments | `ReviewComments` | Optional plain multiline text |
| PDF Link | `PdfLink` | Optional hyperlink |
| Previous Report ID | `PreviousReportId` | Optional text identifying the replaced revision |
| Reporting Trade | `ReportingTrade` | Not specified, Electrical, HVAC, P&H; default Not specified |
| Revision Status | `Revision_x0020_Status` | Required choice: Current, Superseded; default Current |

Views, newest receipt first:
- All Reports (default).
- To Review: Review Status = Pending AND Revision Status = Current.
- Delivery Failures: Filing Status = Failed OR Email Status = Failed.

Indexes: RELAY Report ID, Project, Review Status, Received At.

## Issue Tracker

Individual defects do not require a report. Confirmation and work status remain independent. Affected trade and external responsibility are separate so an electrical defect can still belong to a non-Leodis contractor.

| Display name | Internal name | Type / configuration |
|---|---|---|
| Issue Reference | `Title` | Required text |
| Project | `Project` | Required single project lookup |
| Confirmation Status | `Confirmation_x0020_Status` | Required choice: Provisional, Confirmed, Disputed, Withdrawn; default Provisional |
| Work Status | `Work_x0020_Status` | Required choice: Open, Assigned, In progress, Awaiting verification, Closed; default Open |
| Description | `Description` | Required plain multiline text |
| Location | `Location` | Optional text |
| Required Action | `Required_x0020_Action` | Optional plain multiline text |
| Reporting Trade | `Reporting_x0020_Trade` | Not specified, Electrical, HVAC, P&H; default Not specified |
| Affected Trade | `Affected_x0020_Trade` | Not specified, Electrical, HVAC, P&H, Other; default Not specified |
| Responsibility | `Responsibility` | Unconfirmed, Leodis, Non-Leodis; default Unconfirmed |
| Responsible Company | `Responsible_x0020_Company` | Optional text |
| Assigned To | `Assigned_x0020_To` | Optional single person |
| External Owner | `External_x0020_Owner` | Optional text for people without a Leodis Microsoft account |
| Target Date | `Target_x0020_Date` | Optional date only |
| Raised By | `Raised_x0020_By` | Required single person |
| Raised At | `Raised_x0020_At` | Required date and time |
| Source Report ID | `Source_x0020_Report_x0020_ID` | Optional text; empty for standalone defects |
| RELAY Issue ID | `RELAY_x0020_Issue_x0020_ID` | Required, unique, indexed text |
| Evidence Link | `Evidence_x0020_Link` | Optional hyperlink to supporting evidence |
| RELAY Link | `RELAY_x0020_Link` | Optional hyperlink to issue details |
| Closure Submitted By | `Closure_x0020_Submitted_x0020_By` | Optional single person |
| Verified By | `Verified_x0020_By` | Optional single person |
| Verified At | `Verified_x0020_At` | Optional date and time |

Views, newest raised date first:
- All Issues.
- Open Issues (default): Work Status != Closed AND Confirmation Status != Withdrawn.
- Awaiting Verification: Work Status = Awaiting verification AND Confirmation Status != Withdrawn.

Indexes: RELAY Issue ID, Project, Work Status, Target Date.

## Verification and integration boundaries

- Both Lists have item version history enabled, retaining 50 versions, and SharePoint content approval disabled. RELAY review status is separate from SharePoint content approval.
- Reopened both ID column settings and confirmed required + unique enabled. Verified the created columns and initially empty list views through the UI. Demo items were subsequently added for visual testing as documented in the linked styling record.
- Column names above were read from saved SharePoint column settings links. Standard Created/Modified/Created By/Modified By fields are also present.
- List settings support the workflow but do not themselves enforce RELAY role permissions or independent closure verification. Implement and test those rules in the integration, including handling direct SharePoint edits.
- Detailed issue events, report sections, drafts, submission snapshots and durable processing jobs remain in RELAY; no additional history/section Lists were created.
- Integration must translate display choices to existing application enum values (for example Returned to changes_requested and Awaiting verification to awaiting_verification), resolve people to SharePoint user lookup IDs, and handle lookup/pagination/concurrency correctly.
- RELAY should fill trade and identity fields automatically, default affected trade from the engineer, and keep the engineer submission form minimal. Not specified is a storage fallback, not an extra mandatory engineer selection.
- Next: implement project/client reads, issue synchronization and report registration against these IDs; agree narrowly scoped write access; test retries, duplicate prevention, conflict handling, corrected reports, report filing and access controls on a designated test project before enabling production writes.
- Photos/PDFs belong in the existing project document folders. A URL column alone does not upload a file. Email delivery still requires a separately configured sender and authorization.
