'use client';
import { useEffect, useState } from 'react';
import { fmtS, getVersion, subscribe, type Rollup, type Status } from '@/lib/compliance/model';

// Generic workspace helpers live with the Developments office too; re-exported
// so the Compliance screens keep one import.
export { Modal, Toasts, formValues, parseHash, toast, useHashRoute } from '@/components/workspace/hooks';

/** Re-render whenever the sample model changes. */
export function useModel(): number {
  const [v, setV] = useState(getVersion());
  useEffect(() => subscribe(() => setV(getVersion())), []);
  return v;
}

/** Client-only gate: the model is anchored to the viewer's clock, so nothing renders until mount. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m;
}

/* ------------------------------------------------------------ primitives */
const TAGCLASS: Record<Status['key'], string> = { ok: 'tag-ok', soon: 'tag-caution', late: 'tag-alert', none: 'tag-quiet' };
export const Tag = ({ s, word }: { s: Status; word?: string }) => <span className={`tag ${TAGCLASS[s.key]}`}>{word ?? s.word}</span>;
export function DueCell({ s }: { s: Status }) {
  if (s.key === 'none') return <span className="due fine">Not known</span>;
  const cls = s.key === 'late' ? 'late' : s.key === 'soon' ? 'soon' : '';
  return <span className="due"><b className={cls}>{fmtS(s.next)}</b> · {s.key === 'late' ? `${-(s.days ?? 0)}d late` : `${s.days}d`}</span>;
}
export function Bar({ c }: { c: Rollup }) {
  if (!c.total) return null;
  const p = (k: keyof Rollup) => `${(100 * c[k] / c.total).toFixed(1)}%`;
  return <div className="cbar"><i className="ok" style={{ width: p('ok') }} /><i className="soon" style={{ width: p('soon') }} /><i className="late" style={{ width: p('late') }} /><i className="none" style={{ width: p('none') }} /></div>;
}
export function Meta({ c, extra }: { c: Rollup; extra?: string }) {
  return <div className="meta">{extra && <span>{extra}</span>}<span>{c.total} assets</span>{c.late > 0 && <span className="late">{c.late} overdue</span>}{c.soon > 0 && <span className="soon">{c.soon} due</span>}{c.none > 0 && <span>{c.none} no record</span>}{!c.late && !c.soon && !c.none && <span>all in date</span>}</div>;
}
export const ResultTag = ({ r }: { r: 'pass' | 'fault' }) => r === 'pass' ? <span className="tag tag-ok">Satisfactory</span> : <span className="tag tag-caution">Fault found</span>;
export const BarKey = () => <div className="cbar-key"><span className="k-ok">in date</span><span className="k-soon">due</span><span className="k-late">overdue</span><span className="k-none">no record</span></div>;
