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

## Variation Register (added 10 September 2026)

Created on the Operations site on 10 September 2026. List ID `78ba0d7f-64df-4284-b95f-8036cea718fc`. [Open](https://leodisdevelopments.sharepoint.com/sites/Operations/Lists/Variation%20Register/AllItems.aspx). Two DEMO rows are in it for layout checking. Columns were read back from the list's field definitions through the signed-in browser on 10 September; the app's `Variation` record in `apps/web/lib/types.ts` mirrors them field for field, and `apps/web/lib/variations.ts` works the three calculated columns the same way.

| Display name | Internal name | Type / configuration | RELAY field |
|---|---|---|---|
| Reference | `Title` | Required text, `011LME-VO-001 \| short description` | `reference` + `description` |
| Project | `Project` | Single project lookup | `projectId` (resolve to the Project Tracker item) |
| Linked Issue | `LinkedIssue` | Single lookup to Issue Tracker | `linkedIssueId` |
| Source Report ID | `SourceReportId` | Text | `raisedByReport` |
| RELAY Link | `RelayLink` | Hyperlink | `/office#/projects/<code>/variation/<id>` |
| Evidence Link | `EvidenceLink` | Hyperlink | Report photographs; filed with the report PDF |
| Raised By | `RaisedBy` | Person | `raisedBy` / `raisedById` |
| Raised At | `RaisedAt` | Date and time | `raisedAt` |
| Description | `Description` | Plain multiline text, 6 lines | `description` (engineer's wording; office edits recorded as events) |
| Trade | `Trade` | Choice: Electrical, HVAC, P&H, Multi | `trade` (defaults to the reporting engineer's trade) |
| Reason | `Reason` | Choice: Client instruction, Design change, Site condition, Damage by others, Omission, Spec change | `reason` (set by the office) |
| Location | `Location` | Text | `location` |
| Instruction | `Instruction` | Choice: Instructed, Pending, Declined; default Pending | `instruction` (`instructed` / `pending` / `declined`) |
| Instruction Reference | `InstructionReference` | Text | `instructionReference` |
| Instructed By | `InstructedBy` | Text | `instructedBy` |
| Instructed On | `InstructedOn` | Date only | `instructedOn` |
| Signed Instruction | `SignedInstruction` | Hyperlink | `signedInstruction` |
| Expected Labour (hours) | `ExpectedLabour` | Number, 1 decimal | `labourHours` |
| Labour Rate | `LabourRate` | Currency | `labourRate` |
| Expected Parts Cost | `ExpectedPartsCost` | Currency | `partsCost` |
| Plant and Subcontract | `PlantSubcontract` | Currency | `plantSubcontract` |
| Uplift % | `Uplift` | Number, whole | `upliftPct` |
| Quoted Value | `QuotedValue` | Currency | `quotedValue` |
| Instructed Value | `InstructedValue` | Currency | `instructedValue` |
| Expected Cost | `ExpectedCost` | Calculated: labour × rate + parts + plant | `expectedCost()` |
| Estimated Margin | `EstimatedMargin` | Calculated: (instructed value if instructed, else quoted) − expected cost | `estimatedMargin()` |
| Margin % | `MarginPct` | Calculated: margin ÷ value, 0 when value ≤ 0 | `marginPct()` (undefined rather than 0 when there is no value) |

Views: All Variations (default, newest raised first), Pending, Instructed (grouped by project, instructed value and margin totalled), Declined.

Not on the list, held in RELAY only: `workDone` (work already carried out on a verbal say-so, before any written instruction; EXP-3), the event history, and the reporting engineer's own trade. `workDone` is the fact the office needs most and should be added as a Yes/No column ("Work Undertaken Before Instruction") before synchronisation is enabled; until then it is flagged in the RELAY register and the Attention list only.

Integration notes: the app writes the engineer's wording to Description and never overwrites a value typed directly in SharePoint without recording an event; Reference is `<ref> | <first line of the description>` to match the demo rows; people resolve to SharePoint user IDs as for the other two lists.
