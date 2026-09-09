'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Issue, ReportSummary } from '@/lib/types';
import { acknowledgeReport, issueCommand, reviewReportDecision } from '@/lib/api';
import { Modal, formValues, toast } from '@/components/workspace/hooks';
import { InstallRelay } from '@/components/InstallRelay';
import { Btn, BtnQ } from './bits';
import { today } from './model';

export type Dialog =
  | { kind: 'assign'; issue: Issue; owners: string[] }
  | { kind: 'verify'; issue: Issue }
  | { kind: 'reopen'; issue: Issue }
  | { kind: 'confirm'; issue: Issue }
  | { kind: 'withdraw'; issue: Issue }
  | { kind: 'triage'; issue: Issue }
  | { kind: 'acknowledge'; report: ReportSummary }
  | { kind: 'review'; report: ReportSummary }
  | { kind: 'help' };

/**
 * Every office action that changes a record goes through a dialog that says
 * what it will do. Reasons are mandatory where the domain demands one
 * (confirm, withdraw, send back); the server refuses them otherwise, so the
 * dialog asks up front rather than bouncing an error back.
 */
export function Dialogs({ d, close, done }: { d: Dialog; close: () => void; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shell = (title: string, sub: string, body: ReactNode, foot: ReactNode) => <>
    <div className="dlg-head"><div>{sub && <div className="crumbs">{sub}</div>}<h3>{title}</h3></div><button type="button" className="x" onClick={close} aria-label="Close">×</button></div>
    <div className="dlg-body">{body}{error && <div className="note bad" style={{ margin: 0 }}><span>{error}</span></div>}</div>
    {foot && <div className="dlg-foot">{foot}</div>}</>;
  const run = async (work: () => Promise<string>) => {
    setBusy(true); setError('');
    try { const msg = await work(); toast(msg); close(); done(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That could not be recorded.'); }
    finally { setBusy(false); }
  };
  const submit = (work: (v: ReturnType<typeof formValues>) => Promise<string>) => (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); void run(() => work(formValues(e.currentTarget))); };
  const Foot = ({ label, danger }: { label: string; danger?: boolean }) => <><BtnQ onClick={close} disabled={busy}>Cancel</BtnQ><button type="submit" className={`btn ${danger ? 'btn-q' : ''}`} disabled={busy}>{busy ? 'Recording…' : label}</button></>;

  if (d.kind === 'assign') {
    const i = d.issue;
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async v => {
      const owner = v.owner?.trim() ?? ''; if (!owner) throw new Error('Name who is responsible.');
      await issueCommand(i.id, { kind: 'assign', owner, targetDate: v.target ?? '', note: v.note ?? '' });
      return `${i.reference} assigned to ${owner}${v.target ? `, target ${v.target}` : ''}.`;
    })}>
      {shell(i.owner ? 'Reassign' : 'Assign', `${i.reference} · ${i.location || 'no location'}`, <>
        <div className="note info" style={{ margin: 0 }}><span><b>{i.description}</b>{i.actionNeeded && <><br />Action: {i.actionNeeded}</>}</span></div>
        <div className="f-row">
          <div className="f"><label>Responsible</label><input name="owner" list="owners" defaultValue={i.owner} placeholder="Person or company" autoFocus /><datalist id="owners">{d.owners.map(o => <option key={o} value={o} />)}</datalist></div>
          <div className="f"><label>Target date</label><input name="target" type="date" defaultValue={i.targetDate || ''} min={today()} /></div>
        </div>
        <div className="f"><label>Instruction</label><textarea name="note" placeholder="What is expected, access arrangements, who to call on site" /></div>
        <p className="rowsub" style={{ margin: 0 }}>Owners are names or companies, not accounts. The engineer who reported it is not changed.</p>
      </>, <Foot label={i.owner ? 'Reassign' : 'Assign'} />)}
    </form></Modal>;
  }
  if (d.kind === 'verify' || d.kind === 'reopen') {
    const i = d.issue; const verify = d.kind === 'verify';
    const pending = i.work === 'awaiting_verification';
    const title = verify ? 'Verify and close' : pending ? 'Not finished' : 'Reopen';
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async v => {
      await issueCommand(i.id, { kind: verify ? 'verify' : 'reopen', note: v.note ?? '' });
      return verify ? `${i.reference} verified and closed.` : pending ? `${i.reference} sent back to in progress.` : `${i.reference} reopened.`;
    })}>
      {shell(title, `${i.reference} · ${i.location || 'no location'}`, <>
        <div className="note warn" style={{ margin: 0 }}><span><b>{i.description}</b><br />{verify ? `Closure submitted by ${i.closureSubmittedBy ?? 'unknown'}. Verifying says you are satisfied the work is done; the person who did it cannot verify it.` : pending ? 'Sends the work back to in progress with its owner. Say what was found so the engineer knows what is left.' : 'Reopening puts the work back to open. Say what was found so the history explains it.'}</span></div>
        <div className="f"><label>Note</label><textarea name="note" placeholder={verify ? 'What was checked' : 'What is left to do'} autoFocus /></div>
      </>, <Foot label={title} />)}
    </form></Modal>;
  }
  if (d.kind === 'confirm' || d.kind === 'withdraw' || d.kind === 'triage') {
    const i = d.issue;
    const decide = (kind: 'confirm' | 'withdraw', note: string) => run(async () => {
      if (!note.trim()) throw new Error('Say why. The reason is recorded on the issue.');
      await issueCommand(i.id, { kind, note: note.trim() });
      return kind === 'confirm' ? `${i.reference} confirmed.` : `${i.reference} withdrawn.`;
    });
    return <Modal className="ws-dialog" onClose={close}><TriageForm d={d} busy={busy} shell={shell} close={close} decide={decide} />
    </Modal>;
  }
  if (d.kind === 'acknowledge') {
    const r = d.report;
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async v => { await acknowledgeReport(r.id, v.note ?? ''); return `${r.reference} acknowledged. The engineer will see it was read.`; })}>
      {shell('Acknowledge', `${r.reference} · ${r.author}`, <>
        <div className="note info" style={{ margin: 0 }}><span>Records that the office has read this report, with your name and the time. It sends nothing and changes nothing else.</span></div>
        <div className="f"><label>Note · optional</label><textarea name="note" placeholder="Seen, chasing the main contractor" autoFocus /></div>
      </>, <Foot label="Acknowledge" />)}
    </form></Modal>;
  }
  if (d.kind === 'review') {
    const r = d.report;
    const decide = (decision: 'approve' | 'return', note: string) => run(async () => {
      if (decision === 'return' && !note.trim()) throw new Error('Say what needs changing. The engineer has to act on it.');
      await reviewReportDecision(r.id, decision, note.trim());
      return decision === 'approve' ? `${r.reference} approved${r.defectCount ? `; ${r.defectCount} issue${r.defectCount === 1 ? '' : 's'} confirmed` : ''}.` : `${r.reference} sent back to ${r.author}.`;
    });
    return <Modal className="ws-dialog" onClose={close}><ReviewForm r={r} busy={busy} shell={shell} close={close} decide={decide} /></Modal>;
  }
  return <Modal className="ws-dialog" onClose={close}>{shell('Help & install', 'Leodis Relay', <>
    <p className="rowsub" style={{ margin: 0 }}>Engineers use the Engineer view on site for updates and individual defects. The office reads submitted reports and works the issue register; unfinished drafts stay private to their author.</p>
    <div className="panel"><InstallRelay alwaysShow /></div>
  </>, <BtnQ onClick={close}>Close</BtnQ>)}</Modal>;
}

type Shell = (title: string, sub: string, body: ReactNode, foot: ReactNode) => ReactNode;

function TriageForm({ d, busy, shell, close, decide }: { d: Extract<Dialog, { kind: 'confirm' | 'withdraw' | 'triage' }>; busy: boolean; shell: Shell; close: () => void; decide: (kind: 'confirm' | 'withdraw', note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const i = d.issue;
  const title = d.kind === 'triage' ? 'Triage' : d.kind === 'confirm' ? 'Confirm observation' : 'Withdraw';
  return shell(title, `${i.reference} · ${i.location || 'no location'}`, <>
    <div className={`note ${d.kind === 'withdraw' ? 'bad' : 'warn'}`} style={{ margin: 0 }}><span><b>{i.description}</b><br />
      {d.kind === 'triage' ? 'The report that raised this was sent back, so the observation is in doubt. Any work already done stands. Confirm it if it was right; withdraw it if it was not.'
        : d.kind === 'confirm' ? 'Confirming says the observation was right. It does not change who owns the work or when it is due.'
        : 'Withdrawing says the observation was wrong. The issue stays on file as withdrawn; it is not deleted.'}</span></div>
    <div className="f"><label>Reason · recorded on the issue</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Why" autoFocus /></div>
  </>, <>
    <BtnQ onClick={close} disabled={busy}>Cancel</BtnQ>
    {d.kind !== 'confirm' && <BtnQ onClick={() => void decide('withdraw', note)} disabled={busy}>Withdraw</BtnQ>}
    {d.kind !== 'withdraw' && <Btn onClick={() => void decide('confirm', note)} disabled={busy}>Confirm</Btn>}
  </>);
}

function ReviewForm({ r, busy, shell, close, decide }: { r: ReportSummary; busy: boolean; shell: Shell; close: () => void; decide: (decision: 'approve' | 'return', note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  return shell('Review', `${r.reference} · ${r.author} · visit ${r.visitDate}`, <>
    <div className="note info" style={{ margin: 0 }}><span>Reviewed as the person signed in; a report cannot be reviewed by whoever wrote it. {r.defectCount > 0 ? `Approving confirms the ${r.defectCount} issue${r.defectCount === 1 ? '' : 's'} it raised. Sending it back marks them for triage; any work already done on them stands.` : 'Approving accepts it for issue.'} The engineer sees the note and can send a corrected revision.</span></div>
    <div className="f"><label>Comments · required if sending back</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What needs changing, or a note for the file" autoFocus /></div>
  </>, <>
    <BtnQ onClick={close} disabled={busy}>Cancel</BtnQ>
    <BtnQ onClick={() => void decide('return', note)} disabled={busy}>Send back</BtnQ>
    <Btn onClick={() => void decide('approve', note)} disabled={busy}>Approve</Btn>
  </>);
}
