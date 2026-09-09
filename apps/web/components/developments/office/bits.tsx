'use client';
import type { ReactNode } from 'react';
import type { Issue, ReportSummary } from '@/lib/types';
import { deliveryStatus, reviewStatus } from '@/lib/status';
import { KIND, confirmTag, found, toneTag, workTag, type Rollup } from './model';

/** Status as a word, a shape and a colour; never colour alone. */
export const Tag = ({ label, cls }: { label: string; cls: string }) => <span className={`tag ${cls}`}>{label}</span>;
export const WorkTag = ({ i, day }: { i: Issue; day: string }) => <Tag {...workTag(i, day)} />;
export const ConfirmTag = ({ i }: { i: Issue }) => <Tag {...confirmTag(i)} />;
export function DeliveryTag({ r }: { r: ReportSummary }) {
  const s = deliveryStatus(r); if (!s) return null;
  return <Tag label={s.label} cls={toneTag(s.tone)} />;
}
export function ReviewTag({ r, quiet }: { r: ReportSummary; quiet?: boolean }) {
  const s = reviewStatus(r); if (!s || (quiet && s.label === 'No review required')) return null;
  return <Tag label={s.label} cls={toneTag(s.tone)} />;
}
/** What the visit found, as kind chips. Reads from the summary's per-kind counts. */
export function Found({ r }: { r: ReportSummary }) {
  const f = found(r);
  if (!f.length) return <span className="rowsub">nothing recorded</span>;
  return <div className="found">{f.map(x => <span key={x.kind} className={`kind ${KIND[x.kind].tone}`}>{x.n} {x.n === 1 ? KIND[x.kind].one : KIND[x.kind].many}</span>)}</div>;
}
export function Bar({ c }: { c: Rollup }) {
  if (!c.total) return <div className="cbar" />;
  const p = (n: number) => `${(100 * n / c.total).toFixed(1)}%`;
  return <div className="cbar"><i className="ok" style={{ width: p(c.closed) }} /><i className="soon" style={{ width: p(c.verify) }} /><i className="late" style={{ width: p(c.overdue) }} /><i className="none" style={{ width: p(c.open) }} /></div>;
}
export function Meta({ c }: { c: Rollup }) {
  return <div className="meta"><span>{c.total} issues</span>{c.overdue > 0 && <span className="late">{c.overdue} overdue</span>}{c.verify > 0 && <span className="soon">{c.verify} to verify</span>}{c.open > 0 && <span>{c.open} open</span>}{c.total > 0 && !c.overdue && !c.verify && !c.open && <span>all closed</span>}</div>;
}
export const BarKey = () => <div className="cbar-key"><span className="k-ok">closed</span><span className="k-soon">to verify</span><span className="k-late">overdue</span><span className="k-none">open</span></div>;
export const SecH = ({ children, right }: { children: ReactNode; right?: ReactNode }) => <div className="sec-h">{children}{right}</div>;
export const Btn = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={`btn ${p.className ?? ''}`} />;
export const BtnQ = (p: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...p} className={`btn btn-q ${p.className ?? ''}`} />;
