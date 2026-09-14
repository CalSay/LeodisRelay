'use strict';

/**
 * Idempotent migration for the two Variation Register fields RELAY needs for
 * safe synchronization. Existing manual/demo rows are deliberately untouched.
 */
const SITE = 'leodisdevelopments.sharepoint.com,7fc89dbf-9b60-4018-bb49-1bcdb28a5fd6,5213073c-845c-4e0f-aac1-a3e7e1bcfa9e';
const LIST = '78ba0d7f-64df-4284-b95f-8036cea718fc';

async function token() {
  const tenant = process.env.ENTRA_TENANT_ID;
  const client = process.env.ENTRA_CLIENT_ID;
  const secret = process.env.ENTRA_CLIENT_SECRET;
  if (!tenant || !client || !secret) throw new Error('Server Entra application credentials are missing.');
  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST', body: new URLSearchParams({ client_id: client, client_secret: secret, grant_type: 'client_credentials', scope: 'https://graph.microsoft.com/.default' }),
  });
  if (!response.ok) throw new Error(`Microsoft token request failed (HTTP ${response.status}).`);
  return (await response.json()).access_token;
}

async function graph(accessToken, path, init = {}) {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) throw new Error(`Microsoft Graph schema request failed (HTTP ${response.status}).`);
  return response.status === 204 ? undefined : response.json();
}

async function main() {
  const accessToken = await token();
  const base = `/sites/${encodeURIComponent(SITE)}/lists/${encodeURIComponent(LIST)}/columns`;
  let columns = (await graph(accessToken, base)).value;
  const additions = [
    {
      name: 'RelayVariationId', displayName: 'RELAY Variation ID', indexed: true,
      enforceUniqueValues: true, text: { allowMultipleLines: false, maxLength: 255 },
    },
    {
      name: 'WorkUndertakenBeforeInstruction', displayName: 'Work Undertaken Before Instruction',
      boolean: {}, defaultValue: { value: 'false' },
    },
  ];
  for (const definition of additions) {
    if (columns.some(column => column.name === definition.name)) continue;
    console.log(`Adding ${definition.displayName} to the SharePoint Variation Register.`);
    await graph(accessToken, base, { method: 'POST', body: JSON.stringify(definition) });
  }
  columns = (await graph(accessToken, base)).value;
  const identity = columns.find(column => column.name === 'RelayVariationId');
  if (!identity?.indexed || !identity?.enforceUniqueValues) throw new Error('RELAY Variation ID was not created as an indexed unique field.');
  if (!columns.some(column => column.name === 'WorkUndertakenBeforeInstruction' && column.boolean)) throw new Error('Work Undertaken Before Instruction was not created as a Yes/No field.');
  console.log('PASS: SharePoint Variation Register synchronization fields.');
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
