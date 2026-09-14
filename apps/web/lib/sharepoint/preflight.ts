import { graph } from './graph';
import { OPERATIONS } from './config';
let validUntil = 0;
/** Refuse writes if the Lists no longer match the agreed schema. No provisioning side effects. */
export async function checkSchema(): Promise<void> {
  if (validUntil > Date.now()) return;
  const definitions: { list: string; id: string; required: string[]; choices: Record<string, string[]> }[] = [
    { list: OPERATIONS.issues, id: 'RELAY_x0020_Issue_x0020_ID', required: ['Title','Project','Description','Raised_x0020_By','Raised_x0020_At','Confirmation_x0020_Status','Work_x0020_Status','Location','Required_x0020_Action','Reporting_x0020_Trade','Affected_x0020_Trade','External_x0020_Owner','Target_x0020_Date','Source_x0020_Report_x0020_ID','Closure_x0020_Submitted_x0020_By','Verified_x0020_By','Verified_x0020_At'],
      choices: { Confirmation_x0020_Status: ['Provisional','Confirmed','Disputed','Withdrawn'], Work_x0020_Status: ['Open','Assigned','In progress','Awaiting verification','Closed'] } },
    { list: OPERATIONS.reports, id: 'RelayReportId', required: ['Title','Project','Revision','VisitDate','ReceivedAt','SubmittedBy','ReviewStatus','FilingStatus','EmailStatus','PreviousReportId','ReportingTrade','Revision_x0020_Status','ReviewedBy','ReviewedAt','ReviewComments','RelayPdfUrl'],
      choices: { ReviewStatus: ['Not required','Pending','Approved','Returned'], FilingStatus: ['Pending','Filed','Failed'], EmailStatus: ['Not requested','Pending','Sent','Failed'] } },
  ];
  for (const definition of definitions) {
    const columns = await graph.columns(definition.list);
    for (const name of [definition.id, ...definition.required]) if (!columns.some(c => c.name === name)) throw new Error(`SharePoint schema check failed: missing ${name}.`);
    const identity = columns.find(c => c.name === definition.id)!;
    if (!identity.required || !identity.indexed) throw new Error('The RELAY identity column must be required and indexed.');
    if (columns.find(c => c.name === 'Project')?.lookup?.listId.toLowerCase() !== OPERATIONS.projects.toLowerCase()) throw new Error('A Project lookup points at an unexpected list.');
    for (const [name, choices] of Object.entries(definition.choices)) {
      if (!choices!.every(choice => columns.find(c => c.name === name)?.choice?.choices.includes(choice))) throw new Error(`Unsupported SharePoint choices for ${name}.`);
    }
  }
  validUntil = Date.now() + 300000;
}
