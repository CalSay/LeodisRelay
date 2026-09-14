// Explicit live acceptance test. Creates labelled DEMO records and never deletes them.
(async () => {
  if (process.env.RELAY_ACCEPTANCE_TEST !== 'I_UNDERSTAND_THIS_CREATES_DEMO_RECORDS') {
    throw new Error('Set the explicit RELAY_ACCEPTANCE_TEST opt-in before running this script.');
  }
  if (process.env.RELAY_SHAREPOINT_MODE !== 'write') throw new Error('SharePoint must be in write mode.');
  if (process.env.RELAY_MAIL_ENABLED === 'yes') throw new Error('Mail must remain disabled during acceptance testing.');
  const writeIds = (process.env.RELAY_SHAREPOINT_WRITE_PROJECT_IDS ?? process.env.RELAY_SHAREPOINT_PROJECT_IDS ?? '')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (writeIds.length !== 1 || writeIds[0] !== '102') throw new Error('Acceptance writes must be restricted to project item 102.');

  const { database, records } = require('../apps/web/.worker/lib/storage.js');
  const { refreshProjects } = require('../apps/web/.worker/lib/projects.js');
  const { graph } = require('../apps/web/.worker/lib/sharepoint/graph.js');
  const { sendIssueOperation } = require('../apps/web/.worker/lib/sharepoint/issues.js');
  const now = Date.now();
  const sessions = records('sessions')
    .filter(session => new Date(session.expiresAt).getTime() > now && ['Admin', 'Manager'].includes(session.principal?.role))
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  const actor = sessions[0];
  if (!actor) throw new Error('Sign in to RELAY as a Manager or Admin before running live acceptance.');
  const verifier = sessions.find(session => session.principal?.id && session.principal.id !== actor.principal.id);

  await refreshProjects(true);
  const project = records('projects').find(row => row.source?.itemId === '102' && !row.tombstoned);
  if (!project) throw new Error('Tetley Block E project item 102 is not in the connected cache.');

  const origin = process.env.RELAY_ACCEPTANCE_ORIGIN ?? 'http://web:4310';
  async function api(path, method = 'GET', body, session = actor) {
    const response = await fetch(origin + path, {
      method,
      headers: { Cookie: `relay_session=${session.id}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${path} failed (HTTP ${response.status}): ${data.reason ?? 'unknown response'}`);
    return data;
  }
  async function waitFor(label, work, timeout = 240000) {
    const until = Date.now() + timeout;
    let last;
    while (Date.now() < until) {
      last = await work();
      if (last?.done) return last.value;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error(`${label} timed out${last?.detail ? `: ${last.detail}` : ''}.`);
  }

  const tag = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const created = await api('/api/reports', 'POST', { projectId: project.id });
  const observation = {
    id: `obs-acceptance-${tag}`,
    type: 'access',
    location: 'AUTOMATED ACCEPTANCE TEST — NO SITE ACTION',
    whatHappened: `DEMO AUTOMATED SHAREPOINT ACCEPTANCE ${tag}. This is not a real defect.`,
    actionNeeded: 'No action. Retain temporarily as RELAY integration evidence.',
    owner: '',
    photos: [],
    affectedTrade: 'Other / non-Leodis',
  };
  const saved = await api(`/api/reports/${created.id}`, 'PUT', {
    observations: [observation], expectedVersion: created.version, requestId: crypto.randomUUID(),
  });
  await api(`/api/reports/${created.id}`, 'POST', {
    expectedVersion: saved.version, signature: { name: actor.principal.name },
  });
  console.log(`CREATED: DEMO report ${created.reference} (${created.id})`);

  const filed = await waitFor('Report PDF filing', async () => {
    const report = await api(`/api/reports/${created.id}`);
    if (report.delivery === 'failed' || report.sharepoint?.status === 'failed') {
      throw new Error(report.deliveryError ?? report.sharepoint?.error ?? 'Report processing failed.');
    }
    return report.delivery === 'filed' && report.sharepoint?.status === 'filed'
      ? { done: true, value: report }
      : { done: false, detail: `${report.delivery ?? 'no delivery'} / ${report.sharepoint?.status ?? 'no SharePoint status'}` };
  });
  if (!String(filed.sharepoint?.url ?? '').startsWith('https://leodisdevelopments.sharepoint.com/')) {
    throw new Error('Filed report URL is outside the expected SharePoint host.');
  }
  console.log('PASS: PDF filed and Report Register row acknowledged');

  let issue = await waitFor('Issue synchronization', async () => {
    const page = await api(`/api/issues?projectId=${encodeURIComponent(project.id)}`);
    const found = page.issues.find(row => row.raisedByReport === created.id);
    if (found?.sync?.status === 'failed' || found?.sync?.status === 'conflict') throw new Error(found.sync.error ?? found.sync.status);
    return found?.sync?.status === 'synced' ? { done: true, value: found } : { done: false, detail: found?.sync?.status ?? 'not visible' };
  });
  console.log(`PASS: DEMO issue ${issue.reference} created and synchronized`);

  const issueJob = database().prepare("SELECT id,payload FROM jobs WHERE kind='sharepoint-issue' AND json_extract(payload,'$.issue.id')=? ORDER BY rowid LIMIT 1").get(issue.id);
  if (!issueJob) throw new Error('The completed issue job could not be inspected for replay testing.');
  await sendIssueOperation(JSON.parse(String(issueJob.payload)), String(issueJob.id));
  const replayed = await graph.byKey('4b49efb5-df01-4097-ab64-dae248d5c114', 'RELAY_x0020_Issue_x0020_ID', issue.id);
  if (!replayed || replayed.id !== issue.sync.itemId) throw new Error('Issue retry did not resolve to the original SharePoint item.');
  console.log('PASS: identical issue retry reused the original SharePoint item');

  const originalEtag = issue.sync.etag;
  await api(`/api/issues/${issue.id}`, 'POST', { kind: 'confirm', note: 'Automated acceptance confirmation.', expectedEtag: originalEtag });
  issue = await waitFor('Issue confirmation synchronization', async () => {
    const current = await api(`/api/issues/${issue.id}`);
    if (current.sync?.status === 'failed' || current.sync?.status === 'conflict') throw new Error(current.sync.error ?? current.sync.status);
    return current.confirmation === 'confirmed' && current.sync?.status === 'synced' && current.sync.etag !== originalEtag
      ? { done: true, value: current } : { done: false, detail: `${current.confirmation} / ${current.sync?.status}` };
  });
  console.log('PASS: issue confirmation updated SharePoint and advanced its ETag');

  const stale = await fetch(origin + `/api/issues/${issue.id}`, {
    method: 'POST', headers: { Cookie: `relay_session=${actor.id}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'assign', note: 'This stale request must be refused.', owner: 'Nobody', expectedEtag: originalEtag }),
    signal: AbortSignal.timeout(60000),
  });
  if (stale.status !== 409) throw new Error(`Stale issue update returned HTTP ${stale.status}, expected 409.`);
  console.log('PASS: stale issue update was refused');

  await api(`/api/issues/${issue.id}`, 'POST', { kind: 'progress', note: 'Automated acceptance progress.', expectedEtag: issue.sync.etag });
  issue = await waitFor('Issue progress synchronization', async () => {
    const current = await api(`/api/issues/${issue.id}`);
    if (current.sync?.status === 'failed' || current.sync?.status === 'conflict') throw new Error(current.sync.error ?? current.sync.status);
    return current.work === 'in_progress' && current.sync?.status === 'synced' ? { done: true, value: current } : { done: false };
  });
  await api(`/api/issues/${issue.id}`, 'POST', { kind: 'submit_closure', note: 'Automated acceptance closure submission.', expectedEtag: issue.sync.etag });
  issue = await waitFor('Closure submission synchronization', async () => {
    const current = await api(`/api/issues/${issue.id}`);
    if (current.sync?.status === 'failed' || current.sync?.status === 'conflict') throw new Error(current.sync.error ?? current.sync.status);
    return current.work === 'awaiting_verification' && current.sync?.status === 'synced' ? { done: true, value: current } : { done: false };
  });
  const selfVerify = await fetch(origin + `/api/issues/${issue.id}`, {
    method: 'POST', headers: { Cookie: `relay_session=${actor.id}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'verify', note: 'Self verification must fail.', expectedEtag: issue.sync.etag }),
    signal: AbortSignal.timeout(60000),
  });
  if (selfVerify.status !== 422) throw new Error(`Self-verification returned HTTP ${selfVerify.status}, expected 422.`);
  console.log('PASS: closure submitter could not verify their own work');
  if (verifier) {
    await api(`/api/issues/${issue.id}`, 'POST', { kind: 'verify', note: 'Independent automated acceptance verification.', expectedEtag: issue.sync.etag }, verifier);
    issue = await waitFor('Independent verification synchronization', async () => {
      const current = await api(`/api/issues/${issue.id}`, 'GET', undefined, verifier);
      if (current.sync?.status === 'failed' || current.sync?.status === 'conflict') throw new Error(current.sync.error ?? current.sync.status);
      return current.work === 'closed' && current.sync?.status === 'synced' ? { done: true, value: current } : { done: false };
    });
    console.log('PASS: a different authenticated manager/admin verified closure');
  } else {
    console.log('NEEDS USER: sign in as a second Manager/Admin to complete successful independent verification');
  }

  const correction = await api(`/api/reports/${created.id}`, 'POST', { action: 'correct', reason: 'Automated correction acceptance test.' });
  await api(`/api/reports/${correction.id}`, 'POST', {
    expectedVersion: correction.version, signature: { name: actor.principal.name },
  });
  const filedCorrection = await waitFor('Correction PDF filing', async () => {
    const report = await api(`/api/reports/${correction.id}`);
    if (report.delivery === 'failed' || report.sharepoint?.status === 'failed') throw new Error(report.deliveryError ?? report.sharepoint?.error ?? 'Correction processing failed.');
    return report.delivery === 'filed' && report.sharepoint?.status === 'filed' ? { done: true, value: report } : { done: false };
  });
  if (filedCorrection.revision !== 2 || filedCorrection.corrects !== created.id) throw new Error('Correction relationship or revision is incorrect.');
  const originalRemote = await graph.byKey('f916d018-d7a7-4703-a9cc-b722fa20b430', 'RelayReportId', created.id);
  const correctionRemote = await graph.byKey('f916d018-d7a7-4703-a9cc-b722fa20b430', 'RelayReportId', correction.id);
  if (originalRemote?.fields?.Revision_x0020_Status !== 'Superseded') throw new Error('Original Report Register row was not marked Superseded.');
  if (correctionRemote?.fields?.PreviousReportId !== created.id || Number(correctionRemote.fields.Revision) !== 2) throw new Error('Correction Register row is not linked as revision 2.');
  console.log(`PASS: correction ${filedCorrection.reference} revision 2 filed; original retained and superseded`);

  console.log('LIVE WRITE ACCEPTANCE COMPLETE');
  console.log(`Inspect report IDs: ${created.id}, ${correction.id}`);
  console.log(`Inspect issue ID: ${issue.id}`);
})().catch(error => {
  console.error('LIVE WRITE ACCEPTANCE FAILED: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
