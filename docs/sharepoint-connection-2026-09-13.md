# RELAY / SharePoint connection handover — 13 September 2026

Prepared for the Tetley Hall – Block E pilot. The integration is implemented in this working tree; it has **not been deployed** to Hetzner. The user has deferred server access and the live connection test until tomorrow. Do not infer that browser access proves the server application has access.

## Confirmed today

- RELAY sign-in works at https://app.relaybyleodis.com. The deployed Admin screen still describes SharePoint filing as planned.
- Operations, Project Tracker, Client Database, Report Register and Issue Tracker are accessible in the signed-in SharePoint browser.
- Tetley Hall - Block E is Project Tracker **item 102**, project number **011LME**, status **4. Active**, client **C&AJ Marshall Builders Ltd**, account **LCA0001**, manager Ollie Thompson. Confirmed in the item form and its sharing-dialog item identity. Project numbers are not unique across clients; configure item 102, never just 011LME.
- Entra application `495fc6e5-eae8-4fab-9b37-abd5f7e96601`, tenant `1431dac1-21c1-4c06-959a-9a437f51401c`: Graph application Sites.Selected is consented. Site-specific write access remains unverified. No permission grants were changed.
- Added Report Register **Filed PDF**, internal name `RelayPdfUrl`: optional multiple-lines plain text, append disabled, with an Open PDF column formatter restricted to the Leodis SharePoint host. Existing `PdfLink` remains intact.
- Updated **All Reports**, **To Review** and **Delivery Failures** card formatting to prefer `RelayPdfUrl`, with fallback to `PdfLink`, and included Filed PDF in each view. SharePoint confirmed the formatting saves. Actual filed links will be checked with the first pilot PDF.
- No report, issue or project content was changed. While retrieving the item identity, SharePoint Copy link unexpectedly created an anonymous view link. It was immediately removed through Manage Access. The UI confirmed “Link removed” and then no sharing links. It was not sent to anyone; the existing four groups were retained.

## Local implementation

The default mode remains `off`. `read` enables project/issue reads without writes. `write` requires an explicit project-item allowlist and separately configured report-folder IDs. Connected screens carry a connection-test banner and new references use DEMO prefixes. Old fixture reports are not migrated into SharePoint.

Projects use stable site/list/item identity and cached source metadata. Submissions retain a project snapshot and immutable PDF bytes. Durable SQLite jobs handle issue writes, report registration and PDF filing outside the submission request. Retries recover by stable RELAY IDs; ETag checks block overwriting external changes. PDF uploads use deterministic revision names, refuse replacement, and verify downloaded bytes against the original SHA-256. Admin shows job failures and permits retries without changing their original concurrency preconditions.

Validation completed with Node 24.19.0: **174 tests passed**, including 11 SharePoint tests; shared package build, web typecheck, worker TypeScript compilation and final production Next.js build passed. Diagnostic JavaScript syntax and git whitespace checks passed. These are local tests with mocked Graph responses, not evidence of live server write access. The final API change returns a useful 409 for outstanding issue-sync operations during report actions; the production build validates it.

## Tomorrow: server steps

Recorded host: `2.29.47.29`; checkout `/opt/relay`; environment `/opt/relay/deploy/.env`. Verify the host and SSH username using the user's other PC/Hetzner account. Keep credentials in the existing server environment; do not paste secrets into chat or put them in the source bundle.

1. Transfer and inspect the source archive and SHA-256 file from `.deployment/relay-sharepoint-20260913.*`. Take a copy of the existing checkout/config before extracting into `/opt/relay`. Preserve `deploy/.env` and Docker volumes. The bundle excludes secrets and runtime data.
2. With the existing application still running, execute the read-only check from the checkout:

   ```sh
   sudo docker compose -f deploy/compose.yaml exec -T web node < scripts/check-sharepoint-read.cjs
   ```

   This checks app authentication, lists, the new PDF field, item 102 and the recorded Reports folder. It prints pass/fail labels, not credentials or record contents. It does not prove write access or complete schema compatibility; the worker independently checks required columns and choices before any write.
3. Inspect the app's site-specific Sites.Selected grant. If it is read-only, arrange the narrowly scoped Operations write grant before testing writes; do not substitute a tenant-wide Sites.ReadWrite.All grant.
4. Set mode `read`, project IDs `102`, then run `sudo bash deploy/upgrade-pilot.sh`. The script builds a candidate, backs up the stopped data volume and retains the previous image for rollback. Check web/worker health, logs, sign-in, and the Tetley project/client/manager mapping.
5. Verify that the recorded folder is the **Reports folder below this exact Tetley Block E project**, using Graph metadata and the browser project Documents link. The read diagnostic checks that it is a folder, not its complete project ancestry. Only then add the folder mapping and switch web and worker together to `write` using a controlled restart.

Candidate configuration (folder mapping must be reverified):

```dotenv
RELAY_SHAREPOINT_MODE=read
RELAY_SHAREPOINT_PROJECT_IDS=102
RELAY_SHAREPOINT_ARCHIVE_FOLDERS={"102":{"driveId":"b!v53If2CbGEC7SRvNsopf1jwHE1JchA9OqsGj5-G8-p7bHad39Sa1RbMMg2COJDmO","itemId":"01UMGXW5IIWI2AUN3LCJHZE7SZLD36PEKL"}}
```

The browser-confirmed project Documents location is `Shared Documents/Commercial Accounts/LCA0001 - C&AJ Marshall Builders Ltd/011LME - Tetley Hall - Block E`. Do not guess a replacement drive/folder if validation fails.

## Live acceptance before calling the connection ready

- Confirm the actual person lookup fields resolve for the test author and a separate verifier. Application authentication and user sign-in are separate requirements.
- Submit one clearly labelled DEMO report; confirm one register row, one exact PDF revision in the verified folder, a working PDF button in All Reports and matching project/author/status data.
- Create and update a DEMO issue in RELAY, then edit it in SharePoint. Verify refreshed values and refusal of stale writes. Also test source deletion and a retry after an interrupted response without creating duplicates.
- Test a correction: original PDF remains unchanged, original register row becomes Superseded, and the new revision has its own row/file.
- Test closure and independent verification; no self-verification or guessing a person by display name.
- Stop/restart the worker with queued work; confirm jobs survive. Test transient retry and visible failure/conflict handling.
- Keep mail disabled. This work does not implement live mailbox delivery or send messages to customers.

## Boundaries to retain

This is a scoped pilot, not general production enablement. Original photographs remain in RELAY storage; embedded PDF evidence is filed, but separate photograph-library uploads and optional evidence hyperlinks are not implemented. Conflict jobs are retained for deliberate reconciliation; there is no force-overwrite action or complete operator reconciliation wizard. Only one outstanding operation per issue is allowed. Report actions involving an issue with an outstanding operation return 409 so the user can wait/reconcile rather than lose work.

The transfer client currently accepts only the exact tenant SharePoint host; if the real upload/download session uses a different legitimate Microsoft host, inspect it and make a narrowly justified change before proceeding. No live end-to-end test or server deployment has been completed today.

Technical references: [Graph conditional list updates](https://learn.microsoft.com/en-us/graph/api/listitem-update?view=graph-rest-1.0), [upload sessions](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0), [lookup field values](https://learn.microsoft.com/en-us/graph/api/resources/fieldvalueset?view=graph-rest-1.0). The separate text URL avoids relying on Graph writes to SharePoint hyperlink fields.
