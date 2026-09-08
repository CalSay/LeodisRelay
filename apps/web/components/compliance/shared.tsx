'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtS, getVersion, subscribe, type Rollup, type Status } from '@/lib/compliance/model';

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

/**
 * Hash navigation with an internal history, so back works even where the host
 * blocks URL changes, and a deep link still opens the right screen.
 */
export function useHashRoute(fallback: string): { hash: string; go: (h: string) => void; back: () => void } {
  const [hash, setHash] = useState(fallback);
  const stack = useRef<string[]>([]);
  useEffect(() => {
    const h = window.location.hash;
    if (h.startsWith('#/')) setHash(h);
    const onPop = () => { if (window.location.hash.startsWith('#/')) setHash(window.location.hash); };
    window.addEventListener('popstate', onPop); window.addEventListener('hashchange', onPop);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('hashchange', onPop); };
  }, []);
  const go = useCallback((h: string) => {
    setHash(prev => { if (prev !== h) { stack.current.push(prev); if (stack.current.length > 40) stack.current.shift(); } return h; });
    try { if (window.location.hash !== h) window.history.pushState(null, '', h); } catch { /* URL cannot change here; state still moves */ }
  }, []);
  const back = useCallback(() => {
    const prev = stack.current.pop() ?? fallback;
    setHash(prev);
    try { if (window.location.hash !== prev) window.history.pushState(null, '', prev); } catch { /* as above */ }
  }, [fallback]);
  return { hash, go, back };
}
export function parseHash(hash: string): string[] { return hash.replace(/^#\/?/, '').split('/').filter(Boolean); }

/* --------------------------------------------------------------- toasts */
type Listener = (msgs: { id: number; text: string }[]) => void;
let toastSeq = 0; let toasts: { id: number; text: string }[] = []; const toastSubs = new Set<Listener>();
export function toast(text: string): void {
  const t = { id: ++toastSeq, text }; toasts = [...toasts, t]; toastSubs.forEach(l => l(toasts));
  setTimeout(() => { toasts = toasts.filter(x => x.id !== t.id); toastSubs.forEach(l => l(toasts)); }, 4200);
}
export function Toasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => { toastSubs.add(setList); return () => { toastSubs.delete(setList); }; }, []);
  return <div className="cm-toasts" aria-live="polite">{list.map(t => <div key={t.id} className="toast">{t.text}</div>)}</div>;
}

/* --------------------------------------------------------------- modals */
export function Modal({ className, onClose, children }: { className: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  return <dialog ref={ref} className={className} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>{children}</dialog>;
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

/** Read a standard <form> into a plain record. */
export function formValues(form: HTMLFormElement): Record<string, string> & { all: (name: string) => string[] } {
  const fd = new FormData(form); const out: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === 'string' && !(k in out)) out[k] = v; });
  return Object.assign(out, { all: (name: string) => fd.getAll(name).filter((v): v is string => typeof v === 'string') });
}
