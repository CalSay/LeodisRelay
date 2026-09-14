'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { Issue, ReportSummary, Variation } from '@/lib/types';
import { acknowledgeReport, issueCommand, reviewReportDecision, variationCommand } from '@/lib/api';
import { VARIATION_REASONS, VARIATION_TRADES, estimatedMargin, expectedCost, fmtMoney, fmtPct, marginPct, readCosting, suggestedQuote, type Costing } from '@/lib/variations';
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
  | { kind: 'variation-price'; variation: Variation }
  | { kind: 'variation-instruct'; variation: Variation }
  | { kind: 'variation-decline'; variation: Variation }
  | { kind: 'variation-reopen'; variation: Variation }
  | { kind: 'variation-details'; variation: Variation }
  | { kind: 'help' };

/**
 * Every office action that changes a record goes through a dialog that says
 * what it will do. Reasons are mandatory where the domain demands one
 * (confirm, withdraw, send back, decline, reopen); the server refuses them
 * otherwise, so the dialog asks up front rather than bouncing an error back.
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
      await issueCommand(i.id, { expectedEtag:i.sync?.etag, kind: 'assign', owner, targetDate: v.target ?? '', note: v.note ?? '' });
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
      await issueCommand(i.id, { expectedEtag:i.sync?.etag, kind: verify ? 'verify' : 'reopen', note: v.note ?? '' });
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
      await issueCommand(i.id, { expectedEtag:i.sync?.etag, kind, note: note.trim() });
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

  /* ------------------------------------------------------------ variations */
  if (d.kind === 'variation-price') {
    return <Modal className="ws-dialog" onClose={close}><PriceForm v={d.variation} busy={busy} shell={shell} close={close} price={(costing, note) => run(async () => {
      const read = readCosting(costing); if (!read.ok) throw new Error(read.reason);
      if (read.value.quotedValue === undefined) throw new Error('Give the quoted value. The expected cost plus the uplift is suggested beside it.');
      await variationCommand(d.variation.id, { kind: 'price', note, costing });
      return `${d.variation.reference} quoted at ${fmtMoney(read.value.quotedValue)}.`;
    })} /></Modal>;
  }
  if (d.kind === 'variation-instruct') {
    const v = d.variation;
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async f => {
      if (!f.reference?.trim()) throw new Error("Record the client's instruction reference: a CVI number, an email subject, a signed sheet.");
      if (!f.by?.trim()) throw new Error('Say who gave the instruction.');
      await variationCommand(v.id, { kind: 'instruct', note: f.note ?? '', instruction: { reference: f.reference.trim(), by: f.by.trim(), on: f.on ?? '', value: f.value ?? '', signedInstruction: f.signed?.trim() ?? '' } });
      return `${v.reference} instructed by ${f.by.trim()}.`;
    })}>
      {shell('Record the instruction', `${v.reference} · ${v.location || 'no location'}`, <>
        <div className="note info" style={{ margin: 0 }}><span><b>{v.description}</b><br />{v.quotedValue === undefined ? 'No quote has been recorded. It can still be instructed, on rates, but say so in the note.' : `Quoted ${fmtMoney(v.quotedValue)}. The instructed value fixes what the variation is worth from here on.`}{v.workDone && ' This work has already been carried out, so the instruction is retrospective; the signer must be accepting a chargeable variation, not confirming attendance.'}</span></div>
        <div className="f-row three">
          <div className="f"><label>Instruction reference</label><input name="reference" placeholder="CVI-014, email of 8 Sep" autoFocus /></div>
          <div className="f"><label>Instructed by</label><input name="by" placeholder="Name and company" /></div>
          <div className="f"><label>Instructed on</label><input name="on" type="date" defaultValue={today()} max={today()} /></div>
        </div>
        <div className="f-row">
          <div className="f"><label>Instructed value · £</label><input name="value" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={v.quotedValue ?? ''} placeholder="Blank if instructed on rates" /></div>
          <div className="f"><label>Signed copy · link</label><input name="signed" type="url" placeholder="https://… SharePoint document" /></div>
        </div>
        <div className="f"><label>Note · optional</label><textarea name="note" placeholder="How it was agreed, anything the file should know" /></div>
        <p className="rowsub" style={{ margin: 0 }}>The instruction is recorded against you, with the date given. It is a record of what the client said, not the signature itself; the signed copy stays where it was filed.</p>
      </>, <Foot label="Record instruction" />)}
    </form></Modal>;
  }
  if (d.kind === 'variation-decline' || d.kind === 'variation-reopen') {
    const v = d.variation; const decline = d.kind === 'variation-decline';
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async f => {
      if (!f.note?.trim()) throw new Error(decline ? 'Say why it was declined. The reason is recorded on the variation.' : 'Say why it is being reopened. The reason is recorded on the variation.');
      await variationCommand(v.id, { kind: decline ? 'decline' : 'reopen', note: f.note.trim() });
      return decline ? `${v.reference} declined.` : `${v.reference} reopened; it is awaiting instruction again.`;
    })}>
      {shell(decline ? 'Decline' : 'Reopen', `${v.reference} · ${v.location || 'no location'}`, <>
        <div className={`note ${decline ? 'bad' : 'warn'}`} style={{ margin: 0 }}><span><b>{v.description}</b><br />{decline ? 'Declined says the client will not instruct it, or Leodis will not do it. The variation stays on the register as declined; it is not deleted.' : v.instruction === 'instructed' ? 'Reopening an instructed variation puts it back to awaiting instruction. The recorded instruction stays in the history.' : 'Reopening a declined variation puts it back to awaiting instruction.'}{v.workDone && decline && ' This work has already been carried out; declining leaves it unrecoverable unless the record is corrected.'}</span></div>
        <div className="f"><label>Reason · recorded on the variation</label><textarea name="note" placeholder="Why" autoFocus /></div>
      </>, <Foot label={decline ? 'Decline' : 'Reopen'} danger={decline} />)}
    </form></Modal>;
  }
  if (d.kind === 'variation-details') {
    const v = d.variation;
    return <Modal className="ws-dialog" onClose={close}><form onSubmit={submit(async f => {
      if (!f.description?.trim()) throw new Error('Describe the variation.');
      await variationCommand(v.id, { kind: 'details', note: f.note ?? '', details: { description: f.description, location: f.location ?? '', trade: f.trade ?? '', reason: f.reason ?? '', workDone: f.workDone === 'on' } });
      return `${v.reference} updated.`;
    })}>
      {shell('Edit details', `${v.reference} · raised by ${v.raisedBy}`, <>
        <div className="f"><label>Variation</label><textarea name="description" defaultValue={v.description} autoFocus /></div>
        <div className="f-row three">
          <div className="f"><label>Location</label><input name="location" defaultValue={v.location} /></div>
          <div className="f"><label>Trade</label><select name="trade" defaultValue={v.trade ?? ''}><option value="">Not set</option>{VARIATION_TRADES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="f"><label>Reason</label><select name="reason" defaultValue={v.reason ?? ''}><option value="">Not set</option>{VARIATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div className="f check"><input id="vd-done" name="workDone" type="checkbox" defaultChecked={v.workDone} /><label htmlFor="vd-done">Work already carried out without a written instruction</label></div>
        <div className="f"><label>Note · optional</label><textarea name="note" placeholder="What changed and why" /></div>
        <p className="rowsub" style={{ margin: 0 }}>The engineer’s original wording stays in the history. Ticking “already carried out” puts it at the top of Attention until it is instructed: that is work Leodis cannot yet invoice.</p>
      </>, <Foot label="Save details" />)}
    </form></Modal>;
  }
  return <Modal className="ws-dialog" onClose={close}>{shell('Help & install', 'Leodis Relay', <>
    <p className="rowsub" style={{ margin: 0 }}>Engineers use the Engineer view on site for updates, individual defects and variation requests. The office reads submitted reports, works the issue register and prices and instructs variations; unfinished drafts stay private to their author.</p>
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
    <div className="note info" style={{ margin: 0 }}><span>Reviewed as the person signed in; a report cannot be reviewed by whoever wrote it. {r.defectCount > 0 ? `Approving confirms the ${r.defectCount} issue${r.defectCount === 1 ? '' : 's'} it raised. Sending it back marks them for triage; any work already done stands.` : 'Approving accepts it for issue.'} The engineer sees the note and can send a corrected revision.</span></div>
    <div className="f"><label>Comments · required if sending back</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What needs changing, or a note for the file" autoFocus /></div>
  </>, <>
    <BtnQ onClick={close} disabled={busy}>Cancel</BtnQ>
    <BtnQ onClick={() => void decide('return', note)} disabled={busy}>Send back</BtnQ>
    <Btn onClick={() => void decide('approve', note)} disabled={busy}>Approve</Btn>
  </>);
}

/**
 * Pricing, with the arithmetic shown as it is typed. Expected cost, the
 * suggested quote and the margin are the register's own calculations; the
 * quoted value is the office's decision and is never filled in silently.
 */
type Draft = Record<Exclude<keyof Costing, 'instructedValue'>, string>;
const FIELDS: [keyof Draft, string, string][] = [['labourHours', 'Expected labour · hours', '12'], ['labourRate', 'Labour rate · £/hour', '45.00'], ['partsCost', 'Expected parts · £', '640.00'], ['plantSubcontract', 'Plant and subcontract · £', '0.00'], ['upliftPct', 'Uplift · %', '25']];
function PriceForm({ v, busy, shell, close, price }: { v: Variation; busy: boolean; shell: Shell; close: () => void; price: (costing: Draft, note: string) => Promise<void> }) {
  const s = (n: number | undefined) => n === undefined ? '' : String(n);
  const [c, setC] = useState<Draft>({ labourHours: s(v.labourHours), labourRate: s(v.labourRate), partsCost: s(v.partsCost), plantSubcontract: s(v.plantSubcontract), upliftPct: s(v.upliftPct), quotedValue: s(v.quotedValue) });
  const [note, setNote] = useState('');
  const read = readCosting(c);
  const costing: Costing = read.ok ? read.value : {};
  const cost = expectedCost(costing), suggest = suggestedQuote(costing);
  const preview = { ...costing, instruction: 'pending' as const };
  const margin = estimatedMargin(preview), pct = marginPct(preview);
  const set = (k: keyof Draft, value: string) => setC(prev => ({ ...prev, [k]: value }));
  return <form onSubmit={e => { e.preventDefault(); void price(c, note); }}>
    {shell(v.quotedValue === undefined ? 'Price the variation' : 'Reprice the variation', `${v.reference} · ${v.location || 'no location'}`, <>
      <div className="note info" style={{ margin: 0 }}><span><b>{v.description}</b><br />{v.trade ?? 'Trade not set'} · {v.reason ?? 'reason not set'} · raised by {v.raisedBy}{v.workDone && ' · work already carried out'}</span></div>
      <div className="f-row three">
        {FIELDS.map(([k, label, ph], i) => <div className="f" key={k}><label>{label}</label><input type="number" step={k === 'labourHours' || k === 'upliftPct' ? '0.5' : '0.01'} min="0" inputMode="decimal" value={c[k]} onChange={e => set(k, e.target.value)} placeholder={ph} autoFocus={i === 0} /></div>)}
        <div className="f"><label style={{ display: 'flex' }}>Quoted value · £{suggest !== undefined && String(suggest) !== c.quotedValue && <button type="button" className="suggest" onClick={() => set('quotedValue', String(suggest))}>use {fmtMoney(suggest)}</button>}</label><input type="number" step="0.01" min="0" inputMode="decimal" value={c.quotedValue} onChange={e => set('quotedValue', e.target.value)} placeholder={suggest === undefined ? 'What was put to the client' : String(suggest)} /></div>
      </div>
      <dl className="calc">
        <dt>Expected cost · labour × rate + parts + plant</dt><dd>{fmtMoney(cost)}</dd>
        <dt>Cost plus uplift · suggested quote</dt><dd>{fmtMoney(suggest)}</dd>
        <div className="rule" />
        <dt>Estimated margin at the quoted value</dt><dd className={`big ${margin !== undefined && margin < 0 ? 'late' : ''}`}>{fmtMoney(margin)}{pct !== undefined && ` · ${fmtPct(pct)}`}</dd>
      </dl>
      {!read.ok && <div className="note bad" style={{ margin: 0 }}><span>{read.reason}</span></div>}
      <div className="f"><label>Note · optional</label><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Basis of the figures, who they were sent to" /></div>
      <p className="rowsub" style={{ margin: 0 }}>Blank means not known, and is kept apart from zero. The figures replace the previous pricing together; the earlier figures stay in the history.</p>
    </>, <><BtnQ onClick={close} disabled={busy}>Cancel</BtnQ><button type="submit" className="btn" disabled={busy || !read.ok}>{busy ? 'Recording…' : 'Record pricing'}</button></>)}
  </form>;
}
